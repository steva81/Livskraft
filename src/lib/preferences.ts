export const mealSlots = ["Frukost", "Lunch", "Middag", "Mellanmål"] as const
export type MealSlot = typeof mealSlots[number]
export const measurementLabels = { hip: "Höft", chest: "Bröst", thigh: "Lår", arm: "Överarm", neck: "Hals", calf: "Vad" } as const
export type MeasurementKey = keyof typeof measurementLabels
export const healthOptions = { none: "Ingen särskild hälsoanpassning", prediabetes: "Prediabetes", type1: "Typ 1-diabetes", type2: "Typ 2-diabetes", undisclosed: "Vill inte ange / Annat" }
export type Preferences = {
  dailySteps: number; cookingMinutes: number; workoutMinutes: number; trainingDays: number
  budget: string; likedFoods: string; equipment: string; workSchedule: string
  measurements: string
  health: keyof typeof healthOptions; language: "sv" | "en"
  mealSlots: MealSlot[]; trackedMeasurements: MeasurementKey[]
}
export const defaultPreferences: Preferences = {
  dailySteps: 5000, cookingMinutes: 30, workoutMinutes: 30, trainingDays: 3,
  budget: "normal", likedFoods: "", equipment: "kroppsvikt", workSchedule: "dagtid", measurements: "",
  health: "none", language: "sv", mealSlots: ["Frukost", "Lunch", "Middag"], trackedMeasurements: [],
}
export function validSlots(value: unknown): value is MealSlot[] {
  return Array.isArray(value) && value.length <= 4 && new Set(value).size === value.length && value.every(v => mealSlots.includes(v))
}
export function validPreferences(p: Preferences): boolean {
  return !!p && ["low", "normal", "high"].includes(p.budget) && ["dagtid", "kvall", "natt", "skift", "oregelbundet"].includes(p.workSchedule) &&
    Object.hasOwn(healthOptions, p.health) && ["sv", "en"].includes(p.language) && validSlots(p.mealSlots) &&
    Array.isArray(p.trackedMeasurements) && p.trackedMeasurements.length <= 6 && p.trackedMeasurements.every(k => Object.hasOwn(measurementLabels, k)) &&
    [p.likedFoods, p.equipment, p.measurements].every(v => typeof v === "string" && v.length <= 500) &&
    [[p.dailySteps,0,50000],[p.cookingMinutes,5,180],[p.workoutMinutes,10,120],[p.trainingDays,0,5]].every(([v,min,max]) => Number.isInteger(v) && v>=min && v<=max)
}
export function readPreferences(raw: string | null): Preferences {
  try {
    const parsed = JSON.parse(raw ?? "{}")
    const p = { ...defaultPreferences, ...parsed }
    return validPreferences(p) ? {...p,trackedMeasurements:(Object.keys(measurementLabels) as MeasurementKey[]).filter(k=>p.trackedMeasurements.includes(k))} : { ...defaultPreferences }
  } catch { return { ...defaultPreferences } }
}
export function readMeasurements(raw: string | null): Partial<Record<MeasurementKey, number>> {
  try {
    const values = JSON.parse(raw ?? "{}")
    return Object.fromEntries(Object.keys(measurementLabels).flatMap(k => typeof values?.[k] === "number" && Number.isFinite(values[k]) && values[k]>0 && values[k]<=250 ? [[k,values[k]]] : []))
  } catch { return {} }
}

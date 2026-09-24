export type Preferences = {
  dailySteps: number; cookingMinutes: number; workoutMinutes: number; trainingDays: number
  budget: string; likedFoods: string; equipment: string; workSchedule: string
  measurements: string
}

export const defaultPreferences: Preferences = {
  dailySteps: 5000, cookingMinutes: 30, workoutMinutes: 30, trainingDays: 3,
  budget: "normal", likedFoods: "", equipment: "kroppsvikt", workSchedule: "dagtid", measurements: "",
}

export function readPreferences(raw: string | null): Preferences {
  try { return { ...defaultPreferences, ...JSON.parse(raw ?? "{}") } }
  catch { return defaultPreferences }
}

import { mealSlots, validSlots, type MealSlot } from "./preferences"
export type PlannedMeal = {
  slot: MealSlot
  recipeId: string
  title: string
}

export function startOfWeekMonday(from = new Date()): Date {
  const date = new Date(from)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return date
}

export function parsePlannedMeals(raw: string): PlannedMeal[] {
  try {
    const value = JSON.parse(raw)
    const parsed: unknown = Array.isArray(value) ? value : value?.meals
    if (!Array.isArray(parsed)) return []
    return parsed.map((item, index) => {
      if (typeof item === "string") {
        const slot: PlannedMeal["slot"] = index === 0 ? "Frukost" : index === 1 ? "Lunch" : "Middag"
        return { slot, recipeId: item, title: item }
      }
      const obj = item as Partial<PlannedMeal>
      return {
        slot: obj.slot ?? "Middag",
        recipeId: obj.recipeId ?? "",
        title: obj.title ?? "Måltid",
      }
    })
  } catch {
    return []
  }
}

export function selectedSlots(raw: string): MealSlot[] {
  try { const value = JSON.parse(raw); if (validSlots(value?.selectedSlots)) return value.selectedSlots } catch { /* legacy */ }
  return mealSlots.filter(slot => parsePlannedMeals(raw).some(meal => meal.slot === slot))
}
export function encodeMeals(meals: PlannedMeal[], slots: MealSlot[]): string {
  return JSON.stringify({ version: 1, selectedSlots: slots, meals })
}

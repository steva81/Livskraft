export type PlannedMeal = {
  slot: "Frukost" | "Lunch" | "Middag"
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
    const parsed = JSON.parse(raw) as unknown
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

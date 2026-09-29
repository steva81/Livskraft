import { parseNutrition, type Nutrition } from "./nutrition"
import { mealSlots } from "./preferences"

type Intake = { kind: "consumed-meal"; key: string; title: string; nutrition: Nutrition }
type Recipe = { id: string; title: string; nutrition: string | null }

// DailyLog.mealsEaten historically held string keys (or legacy meal titles).
// New entries snapshot intake without depending on a mutable plan or recipe.
function records(raw: string | null | undefined): (string | Intake)[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]")
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((entry): (string | Intake)[] => {
      if (typeof entry === "string" && entry) return [entry]
      if (entry?.kind === "consumed-meal" && typeof entry.key === "string" && typeof entry.title === "string") {
        return [{ kind: "consumed-meal", key: entry.key, title: entry.title, nutrition: parseNutrition(JSON.stringify(entry.nutrition ?? {})) }]
      }
      return []
    })
  } catch { return [] }
}

export function mealCompletionKeys(raw: string | null | undefined): string[] {
  return records(raw).map(entry => typeof entry === "string" ? entry : entry.key)
}

export function consumedMealIntake(raw: string | null | undefined, recipes: Recipe[]): Intake[] {
  const unique = new Map<string, Intake>()
  for (const entry of records(raw)) {
    if (typeof entry !== "string") { unique.set(entry.key, entry); continue }
    const separator = entry.indexOf(":")
    const isKey = mealSlots.some(slot => slot === entry.slice(0, separator))
    const matches = recipes.filter(recipe => isKey ? recipe.id === entry.slice(separator + 1) : recipe.title === entry)
    // Ambiguous legacy titles or removed recipes retain an intake count, with
    // unknown nutrition. Do not guess from today's replacement meal.
    const recipe = matches.length === 1 ? matches[0] : undefined
    unique.set(entry, { kind: "consumed-meal", key: entry, title: recipe?.title ?? entry, nutrition: parseNutrition(recipe?.nutrition ?? null) })
  }
  return [...unique.values()]
}

export function recordConsumedMeal(raw: string | null | undefined, meal: { slot: string; recipeId: string; title: string }, recipes: Recipe[]): string {
  const intake = consumedMealIntake(raw, recipes)
  const key = `${meal.slot}:${meal.recipeId}`
  if (!intake.some(entry => entry.key === key || entry.key === meal.title)) {
    const recipe = recipes.find(recipe => recipe.id === meal.recipeId)
    intake.push({ kind: "consumed-meal", key, title: meal.title, nutrition: parseNutrition(recipe?.nutrition ?? null) })
  }
  return JSON.stringify(intake)
}

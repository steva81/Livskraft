import { parseStringList, canonicalFoodTerm, type RecipeLike } from "./dietary"
import { type Preferences, type MealSlot } from "./preferences"
import type { PlannedMeal } from "./plan-types"
export function recipeScore(recipe: RecipeLike, p: Preferences): number {
  const tags = parseStringList(recipe.tags)
  const ingredients = recipe.ingredients.toLowerCase()
  const likes = p.likedFoods.toLowerCase().split(",").map(canonicalFoodTerm).filter(Boolean)
  return likes.filter(word=>ingredients.includes(word)).length +
    (tags.includes(`budget:${p.budget}`) ? 2 : 0) +
    (["prediabetes","type1","type2"].includes(p.health) ? (tags.includes("fiber-source") ? 3 : 0) + (tags.includes("balanced-meal") ? 2 : 0) : 0)
}
export function rankRecipes<T extends RecipeLike>(recipes: T[], p: Preferences): T[] {
  return [...recipes].sort((a,b)=>recipeScore(b,p)-recipeScore(a,p))
}
const tags: Record<MealSlot,string> = { Frukost:"breakfast", Lunch:"lunch", Middag:"dinner", Mellanmål:"snack" }
export function chooseMeals(recipes: (RecipeLike & {id:string;title:string})[], slots: MealSlot[], day: number): PlannedMeal[] {
  const used = new Set<string>()
  return slots.flatMap((slot,index) => {
    const pool = recipes.filter(r=>parseStringList(r.tags).includes(tags[slot]))
    if (!pool.length) return []
    const start = (day + index * 3) % pool.length
    const rotated = [...pool.slice(start), ...pool.slice(0,start)]
    const recipe = rotated.find(r=>!used.has(r.id)) ?? rotated[0]
    used.add(recipe.id)
    return [{ slot, recipeId: recipe.id, title: recipe.title }]
  })
}

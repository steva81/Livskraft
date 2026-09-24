import type { Recipe, Workout } from "@prisma/client"
import prisma from "@/lib/prisma"
import { parseStringList, recipeMeetsConstraints } from "@/lib/dietary"
import { type PlannedMeal, startOfWeekMonday } from "@/lib/plan-types"
import { readPreferences } from "./preferences"
import { workoutFits } from "./training"
import { activityGuidance } from "./activity"

export type { PlannedMeal }
export { startOfWeekMonday, parsePlannedMeals } from "@/lib/plan-types"

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(date.getDate() + days)
  return next
}

function pickRotating<T>(items: T[], index: number, fallback: T): T {
  if (items.length === 0) return fallback
  return items[index % items.length]
}

function slotRecipes(recipes: Recipe[], tag: string): Recipe[] {
  return recipes.filter((r) => {
    const tags = parseStringList(r.tags).map((t) => t.toLowerCase())
    return tags.includes(tag)
  })
}

export async function generateWeeklyPlanForUser(userId: string, options?: { preferHome?: boolean; nextWeek?: boolean }) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return null

  const restrictions = parseStringList(user.dietRestrictions)
  const dislikes = parseStringList(user.dislikedFoods)
  const lifestyle = parseStringList(user.lifestyle)
  const preferences = readPreferences(user.preferences)

  const allRecipes = await prisma.recipe.findMany()
  const allowed = allRecipes.filter((r) => recipeMeetsConstraints(r, restrictions, dislikes) && r.prepTime <= preferences.cookingMinutes)
    .sort((a, b) => {
      const liked = preferences.likedFoods.toLowerCase().split(",").map(s => s.trim()).filter(Boolean)
      const score = (recipe: Recipe) => liked.filter(word => recipe.ingredients.toLowerCase().includes(word)).length +
        (preferences.budget === "low" && /lins|bön|kikärt|havre/.test(recipe.ingredients.toLowerCase()) ? 1 : 0)
      return score(b) - score(a)
    })

  const breakfasts = slotRecipes(allowed, "breakfast")
  const lunches = slotRecipes(allowed, "lunch")
  const dinners = slotRecipes(allowed, "dinner")
  const anyMeal = allowed

  const workouts = await prisma.workout.findMany()
  const location = user.trainingLocation || "both"
  const level = user.trainingLevel || "beginner"
  const preferHome = options?.preferHome || location === "home"

  const matching = workouts.filter((w) => {
    if (!workoutFits(w, level, preferences.equipment, preferences.workoutMinutes)) return false
    if (preferHome || location === "home") return w.type === "home"
    if (location === "gym") return w.type === "gym"
    return true
  })
  const pool = matching
  const homeShort = pool.find((w) => w.type === "home" && w.duration <= 15) ?? pool.find((w) => w.type === "home")
  const mainWorkout = pool.find((w) => w.duration >= 20) ?? pool[0]

  const recentFrom = new Date(); recentFrom.setDate(recentFrom.getDate()-14)
  const stepLogs = await prisma.dailyLog.findMany({ where: { userId, date: { gte: recentFrom }, OR: [{stepsRecorded:true},{steps:{gt:0}}] } })
  const lowSteps = stepLogs.length >= 4 && stepLogs.reduce((sum,l)=>sum+l.steps,0)/stepLogs.length < user.stepGoal*0.7

  const startDate = startOfWeekMonday()
  if (options?.nextWeek) startDate.setDate(startDate.getDate() + 7)
  const endDate = addDays(startDate, 6)

  return prisma.$transaction(async tx => {
  await tx.weeklyPlan.deleteMany({
    where: { userId, startDate: { lte: endDate }, endDate: { gte: startDate } },
  })

  const weeklyPlan = await tx.weeklyPlan.create({
    data: { userId, startDate, endDate },
  })

  const trainingDays = new Set([0, 3, 5, 1, 4].slice(0, preferences.trainingDays))

  for (let i = 0; i < 7; i++) {
    const date = addDays(startDate, i)
    const breakfast = pickRotating(breakfasts.length ? breakfasts : anyMeal, i, anyMeal[0])
    const lunch = pickRotating(lunches.length ? lunches : anyMeal, i + 1, anyMeal[0])
    const dinner = pickRotating(dinners.length ? dinners : anyMeal, i + 2, anyMeal[0])

    const meals: PlannedMeal[] = allowed.length ? [
      { slot: "Frukost", recipeId: breakfast.id, title: breakfast.title },
      { slot: "Lunch", recipeId: lunch.id, title: lunch.title },
      { slot: "Middag", recipeId: dinner.id, title: dinner.title },
    ] : []

    let workout: Workout | undefined
    if (trainingDays.has(i)) {
      workout = i % 2 === 0 ? mainWorkout : homeShort ?? mainWorkout
    }

    const activity = activityGuidance({ index:i, training:!!workout, stepGoal:user.stepGoal, preferences, lifestyle, lowSteps })

    await tx.planDay.create({
      data: {
        weeklyPlanId: weeklyPlan.id,
        dayOfWeek: date.getDay(),
        date,
        meals: JSON.stringify(meals),
        workoutId: workout?.id ?? null,
        activity,
      },
    })
  }

  return tx.weeklyPlan.findUnique({
    where: { id: weeklyPlan.id },
    include: { planDays: { orderBy: { date: "asc" } } },
  })
  })
}

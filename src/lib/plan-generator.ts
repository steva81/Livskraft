import { profileReadiness } from "./profile-readiness"
import type { Workout } from "@prisma/client"
import prisma from "@/lib/prisma"
import { parseStringList, recipeMeetsConstraints } from "@/lib/dietary"
import { type PlannedMeal, startOfWeekMonday } from "@/lib/plan-types"
import { chooseMeals, rankRecipes } from "./recipe-ranking"
import { encodeMeals } from "./plan-types"
import { readPreferences } from "./preferences"
import { workoutFits } from "./training"
import { activityGuidance } from "./activity"

import { savedGoalSafety } from "./goal-safety"

export type { PlannedMeal }
export { startOfWeekMonday, parsePlannedMeals } from "@/lib/plan-types"

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(date.getDate() + days)
  return next
}

export async function generateWeeklyPlanForUser(userId: string, options?: { preferHome?: boolean; nextWeek?: boolean }) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || !profileReadiness(user).ready) return null
  if (savedGoalSafety(user)?.level === "blocked") return null

  const restrictions = parseStringList(user.dietRestrictions)
  const dislikes = parseStringList(user.dislikedFoods)
  const lifestyle = parseStringList(user.lifestyle)
  const preferences = readPreferences(user.preferences)

  const allRecipes = await prisma.recipe.findMany()
  const allowed = rankRecipes(allRecipes.filter(r => recipeMeetsConstraints(r, restrictions, dislikes) && r.prepTime <= preferences.cookingMinutes), preferences)

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
    const meals = chooseMeals(allowed, preferences.mealSlots, i)

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
        meals: encodeMeals(meals, preferences.mealSlots),
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

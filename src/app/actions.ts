"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnboardingData {
  name?: string
  email?: string
  currentWeight?: string | number
  targetWeight?: string | number
  timeframeWeeks?: string | number
  height?: string | number
  activityLevel?: string
  mode?: string
  dietRestrictions?: string[]
  dislikedFoods?: string[]
  lifestyle?: string[]
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

export async function submitOnboarding(data: OnboardingData) {
  const weeks = Number(data.timeframeWeeks) || 12
  const currentWeight = parseFloat(String(data.currentWeight)) || 0
  const targetWeight = parseFloat(String(data.targetWeight)) || 0
  const weightLoss = currentWeight - targetWeight
  const isAggressive = weightLoss > 0 && weightLoss / weeks > 1.0

  // Personalised step goal — not a hard-coded 10 000
  let stepGoal = 7000
  if (data.activityLevel === "active" || data.activityLevel === "very_active") stepGoal = 10000
  if (data.activityLevel === "sedentary") stepGoal = 5000

  const user = await prisma.user.create({
    data: {
      name: data.name || "Ny Användare",
      email: data.email || `user_${Date.now()}@example.com`,
      currentWeight: currentWeight || null,
      targetWeight: targetWeight || null,
      timeframeWeeks: weeks,
      height: parseFloat(String(data.height)) || null,
      activityLevel: data.activityLevel || "light",
      stepGoal,
      mode: data.mode || "simple",
      dietRestrictions: JSON.stringify(data.dietRestrictions ?? []),
      dislikedFoods: JSON.stringify(data.dislikedFoods ?? []),
      lifestyle: JSON.stringify(data.lifestyle ?? []),
    },
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  await prisma.dailyLog.create({
    data: {
      userId: user.id,
      date: today,
      steps: 0,
      weight: user.currentWeight,
      mealsEaten: JSON.stringify([]),
      workouts: JSON.stringify([]),
    },
  })

  return { success: true, userId: user.id, isAggressive }
}

// ─── User ─────────────────────────────────────────────────────────────────────

export async function getUser(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } })
}

// ─── Daily Log ────────────────────────────────────────────────────────────────

export async function getTodayData(userId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const log = await prisma.dailyLog.findUnique({
    where: { userId_date: { userId, date: today } },
  })

  if (log) return log

  return prisma.dailyLog.create({
    data: {
      userId,
      date: today,
      steps: 0,
      mealsEaten: JSON.stringify([]),
      workouts: JSON.stringify([]),
    },
  })
}

// ─── Rules Engine & Meals ─────────────────────────────────────────────────────

export async function getRecommendedRecipes(userId: string) {
  const user = await getUser(userId)
  if (!user) return []

  const restrictions = JSON.parse(user.dietRestrictions ?? "[]") as string[]
  const dislikes = JSON.parse(user.dislikedFoods ?? "[]") as string[]

  const allRecipes = await prisma.recipe.findMany()

  return allRecipes.filter((recipe) => {
    const tags = JSON.parse(recipe.tags ?? "[]") as string[]
    const ingredients = JSON.parse(recipe.ingredients ?? "[]") as string[]
    const ingredientsStr = ingredients.join(" ").toLowerCase()

    // Hard constraints — dietary restrictions
    for (const restriction of restrictions) {
      if (restriction === "vegetarian" && !tags.includes("vegetarian")) return false
      if (restriction === "vegan" && !tags.includes("vegan")) return false
      if (restriction === "lactose-free" && !tags.includes("lactose-free")) return false
      if (restriction === "gluten-free" && !tags.includes("gluten-free")) return false
    }

    // Hard constraints — dislikes / allergies
    for (const dislike of dislikes) {
      if (ingredientsStr.includes(dislike.toLowerCase())) return false
    }

    return true
  })
}

// ─── Steps ────────────────────────────────────────────────────────────────────

export async function updateSteps(userId: string, stepsToAdd: number) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const log = await prisma.dailyLog.findUnique({
    where: { userId_date: { userId, date: today } },
  })

  if (log) {
    await prisma.dailyLog.update({
      where: { id: log.id },
      data: { steps: log.steps + stepsToAdd },
    })
    revalidatePath("/dashboard")
  }
}

// ─── Training ─────────────────────────────────────────────────────────────────

export async function getWorkouts() {
  return prisma.workout.findMany()
}

export async function getWorkoutLogs(userId: string) {
  return prisma.workoutLog.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: 20,
  })
}

export async function logWorkout(userId: string, workoutId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const result = await prisma.workoutLog.create({
    data: { userId, workoutId, date: today, completed: true },
  })
  revalidatePath("/training")
  revalidatePath("/dashboard")
  return result
}

// ─── 7-Day Plan ───────────────────────────────────────────────────────────────

export async function getWeeklyPlan(userId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Find the current week's plan
  const plan = await prisma.weeklyPlan.findFirst({
    where: {
      userId,
      startDate: { lte: today },
      endDate: { gte: today },
    },
    include: { planDays: { orderBy: { date: "asc" } } },
  })

  return plan
}

"use server"

import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getAuthenticatedUserId } from "@/lib/auth"
import { parseStringList, recipeMeetsConstraints } from "@/lib/dietary"
import { generateWeeklyPlanForUser } from "@/lib/plan-generator"
import { parsePlannedMeals, startOfWeekMonday } from "@/lib/plan-types"
import { hashPassword } from "@/lib/password"
import { defaultPreferences, readPreferences, type Preferences } from "@/lib/preferences"
import { aggregateIngredients } from "@/lib/shopping"
import { adaptiveStateForUser, decideAdaptiveWeek } from "@/lib/adaptive"
import { recordManualSteps } from "@/lib/steps"
import { activityGuidance } from "@/lib/activity"

interface OnboardingData {
  name?: string
  email?: string
  password?: string
  currentWeight?: string | number
  targetWeight?: string | number
  timeframeWeeks?: string | number
  height?: string | number
  activityLevel?: string
  mode?: string
  dietRestrictions?: string[]
  dislikedFoods?: string[]
  lifestyle?: string[]
  trainingLocation?: string
  trainingLevel?: string
  waist?: string | number
  preferences?: Preferences
}

export type PublicUser = {
  id: string
  name: string
  email: string
  mode: string
  preferences: string | null
  currentWeight: number | null
  targetWeight: number | null
  timeframeWeeks: number | null
  height: number | null
  waist: number | null
  activityLevel: string | null
  stepGoal: number
  trainingLocation: string
  trainingLevel: string
  dietRestrictions: string | null
  dislikedFoods: string | null
  lifestyle: string | null
  createdAt: Date
  updatedAt: Date
}

function toPublicUser(user: {
  id: string
  name: string
  email: string
  mode: string
  preferences: string | null
  currentWeight: number | null
  targetWeight: number | null
  timeframeWeeks: number | null
  height: number | null
  waist: number | null
  activityLevel: string | null
  stepGoal: number
  trainingLocation: string
  trainingLevel: string
  dietRestrictions: string | null
  dislikedFoods: string | null
  lifestyle: string | null
  createdAt: Date
  updatedAt: Date
}): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    mode: user.mode,
    preferences: user.preferences,
    currentWeight: user.currentWeight,
    targetWeight: user.targetWeight,
    timeframeWeeks: user.timeframeWeeks,
    height: user.height,
    waist: user.waist,
    activityLevel: user.activityLevel,
    stepGoal: user.stepGoal,
    trainingLocation: user.trainingLocation,
    trainingLevel: user.trainingLevel,
    dietRestrictions: user.dietRestrictions,
    dislikedFoods: user.dislikedFoods,
    lifestyle: user.lifestyle,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

function todayDate() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

export async function submitOnboarding(data: OnboardingData) {
  const weeks = Number(data.timeframeWeeks) || 12
  const currentWeight = parseFloat(String(data.currentWeight)) || 0
  const targetWeight = parseFloat(String(data.targetWeight)) || 0
  const weightLoss = currentWeight - targetWeight
  const isAggressive = weightLoss > 0 && weightLoss / weeks > 1.0
  if (!Number.isFinite(currentWeight) || currentWeight < 30 || currentWeight > 400 ||
      !Number.isFinite(targetWeight) || targetWeight < 30 || targetWeight > 400 ||
      !Number.isInteger(weeks) || weeks < 1 || weeks > 520) {
    return { success: false as const, error: "Kontrollera vikt och tidsram." }
  }
  if (isAggressive) return { success: false as const, error: `Välj minst ${Math.ceil(weightLoss)} veckor. Planen ska inte kräva extrem begränsning eller kompensation.` }
  const preferences = { ...defaultPreferences, ...data.preferences }
  if ([preferences.budget, preferences.likedFoods, preferences.equipment, preferences.workSchedule, preferences.measurements]
      .some(value => typeof value !== "string" || value.length > 500)) {
    return { success: false as const, error: "Profilens textfält får innehålla högst 500 tecken." }
  }
  for (const [raw, min, max] of [[data.height, 100, 250], [data.waist, 30, 250]] as const) {
    if (raw != null && raw !== "" && (!Number.isFinite(Number(raw)) || Number(raw) < min || Number(raw) > max)) {
      return { success: false as const, error: "Kontrollera längd och midjemått." }
    }
  }
  for (const [value, min, max] of [[preferences.dailySteps, 0, 50000], [preferences.cookingMinutes, 5, 180], [preferences.workoutMinutes, 10, 120], [preferences.trainingDays, 0, 5]]) {
    if (!Number.isInteger(value) || value < min || value > max) return { success: false as const, error: "Kontrollera dina vardags- och träningsval." }
  }
  if (!["simple", "advanced"].includes(data.mode ?? "simple") ||
      !["home", "gym", "both"].includes(data.trainingLocation ?? "both") ||
      !["beginner", "intermediate", "advanced"].includes(data.trainingLevel ?? "beginner")) {
    return { success: false as const, error: "Ogiltigt profilval." }
  }
  if ([data.dietRestrictions, data.dislikedFoods, data.lifestyle].some(list => list != null &&
      (!Array.isArray(list) || list.length > 50 || list.some(item => typeof item !== "string" || item.length > 100)))) {
    return { success: false as const, error: "Kontrollera dina kost- och livsstilsval." }
  }

  let stepGoal = 7000
  if (data.activityLevel === "active" || data.activityLevel === "very_active") stepGoal = 10000
  if (data.activityLevel === "sedentary") stepGoal = 5000
  if (data.activityLevel === "moderate") stepGoal = 8000
  if (data.activityLevel === "light") stepGoal = 6500

  const email = (data.email || "").trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !data.password || data.password.length < 10 || data.password.length > 256) {
    return { success: false as const, error: "Ange giltig e-post och lösenord med 10–256 tecken." }
  }
  if (data.preferences) stepGoal = Math.min(12000, Math.max(2000, preferences.dailySteps + 1000))

  try {
    await prisma.user.create({
      data: {
        name: data.name || "Ny Användare",
        email,
        password: await hashPassword(data.password),
        preferences: JSON.stringify(preferences),
        waist: Number(data.waist) > 0 ? Number(data.waist) : null,
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
        trainingLocation: data.trainingLocation || "both",
        trainingLevel: data.trainingLevel || "beginner",
        dailyLogs: { create: { date: todayDate(), weight: currentWeight, waist: Number(data.waist) || null,
          measurements: preferences.measurements || null, mealsEaten: "[]", workouts: "[]" } },
      },
    })

    // Account and first log are atomic; the dashboard creates the plan on demand.
    return { success: true as const, isAggressive }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false as const, error: "Det finns redan ett konto med den e-postadressen." }
    }
    throw error
  }
}

export async function getUser() {
  const userId = await getAuthenticatedUserId()
  if (!userId) return null
  const user = await prisma.user.findUnique({ where: { id: userId } })
  return user ? toPublicUser(user) : null
}

export async function getTodayData() {
  const userId = await getAuthenticatedUserId()
  if (!userId) return null
  const today = todayDate()

  return prisma.dailyLog.upsert({
    where: { userId_date: { userId, date: today } },
    update: {},
    create: {
      userId,
      date: today,
      steps: 0,
      mealsEaten: JSON.stringify([]),
      workouts: JSON.stringify([]),
    },
  })
}

export async function getRecommendedRecipes() {
  const user = await getUser()
  if (!user) return []

  const restrictions = parseStringList(user.dietRestrictions)
  const dislikes = parseStringList(user.dislikedFoods)
  const allRecipes = await prisma.recipe.findMany()

  return allRecipes.filter((recipe) => recipeMeetsConstraints(recipe, restrictions, dislikes))
}

export async function updateSteps(stepsToAdd: number) {
  if (!Number.isInteger(stepsToAdd) || stepsToAdd < 0 || stepsToAdd > 50000) throw new Error("Ogiltigt stegantal")
  const userId = await getAuthenticatedUserId()
  if (!userId) return
  const today = todayDate()

  await recordManualSteps(userId, today, stepsToAdd, true)
  revalidatePath("/dashboard")
}

export async function getWorkouts() {
  if (!await getAuthenticatedUserId()) return []
  return prisma.workout.findMany({ orderBy: { duration: "asc" } })
}

export async function getWorkoutLogs() {
  const userId = await getAuthenticatedUserId()
  if (!userId) return []
  return prisma.workoutLog.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: 20,
  })
}

export async function logWorkout(workoutId: string) {
  const userId = await getAuthenticatedUserId()
  if (!userId) return null
  const today = todayDate()
  const result = await prisma.$transaction(async tx => {
    const existing = await tx.workoutLog.findFirst({ where: { userId, workoutId, date: today } })
    if (existing) return existing
    return tx.workoutLog.create({ data: { userId, workoutId, date: today, completed: true } })
  })
  revalidatePath("/training")
  revalidatePath("/dashboard")
  revalidatePath("/progress")
  return result
}

export async function getWeeklyPlan(nextWeek = false) {
  const userId = await getAuthenticatedUserId()
  if (!userId) return null
  const today = todayDate()
  if (nextWeek === true) today.setDate(today.getDate() + 7)

  const existing = await prisma.weeklyPlan.findFirst({
    where: {
      userId,
      startDate: { lte: today },
      endDate: { gte: today },
    },
    include: { planDays: { orderBy: { date: "asc" } } },
  })

  const monday = startOfWeekMonday(today)
  const isCalendarWeek = existing?.planDays.length === 7 && existing.planDays.every((day, index) => {
    const expected = new Date(monday)
    expected.setDate(expected.getDate() + index)
    return day.date.getTime() === expected.getTime()
  })
  if (existing && isCalendarWeek) {
    const safe = await getRecommendedRecipes()
    const user = await getUser()
    const decision = await prisma.adaptiveDecision.findUnique({where:{userId_targetStart:{userId,targetStart:monday}}})
    const changedActivities: string[] = decision?.status === "accepted"
      ? (JSON.parse(decision.summary).changes as {dayId:string;activity?:string}[]).filter(c=>c.activity).map(c=>c.dayId) : []
    const from = todayDate(); from.setDate(from.getDate()-13)
    const steps = await prisma.dailyLog.findMany({where:{userId,date:{gte:from,lte:todayDate()},OR:[{stepsRecorded:true},{steps:{gt:0}}]}})
    const lowSteps = user && steps.length>=4 ? steps.reduce((sum,l)=>sum+l.steps,0)/steps.length < user.stepGoal*0.7 : false
    return { ...existing, planDays: existing.planDays.map((day,index) => ({ ...day,
      activity: user && !changedActivities.includes(day.id) ? activityGuidance({index,training:!!day.workoutId,stepGoal:user.stepGoal,preferences:readPreferences(user.preferences),lifestyle:parseStringList(user.lifestyle),lowSteps}) : day.activity,
      meals: JSON.stringify(parsePlannedMeals(day.meals).flatMap(meal => {
        const recipe = safe.find(recipe => recipe.id === meal.recipeId)
        return recipe ? [{ ...meal, title: recipe.title }] : []
      })),
    })) }
  }
  return generateWeeklyPlanForUser(userId, { nextWeek: nextWeek === true })
}

export async function getAdaptiveWeek() {
  const userId = await getAuthenticatedUserId()
  return userId ? adaptiveStateForUser(userId) : null
}

export async function chooseAdaptiveWeek(accept: boolean, key: string) {
  const userId = await getAuthenticatedUserId()
  if (!userId || typeof accept !== "boolean" || typeof key !== "string") return null
  const state = await decideAdaptiveWeek(userId,accept,key)
  revalidatePath("/plan")
  revalidatePath("/progress")
  return state
}

export async function getProgressSummary() {
  const userId = await getAuthenticatedUserId()
  if (!userId) return null
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return null

  const from = todayDate()
  from.setDate(from.getDate() - 13)

  const logs = await prisma.dailyLog.findMany({
    where: { userId, date: { gte: from } },
    orderBy: { date: "asc" },
  })

  const weekStart = todayDate()
  weekStart.setDate(weekStart.getDate() - 6)
  const workoutLogs = await prisma.workoutLog.findMany({
    where: { userId, date: { gte: startOfWeekMonday() }, completed: true },
  })

  const weights = logs.filter((l) => l.weight != null).map((l) => l.weight as number)
  const average = (values: number[]) => values.length >= 2 ? values.reduce((sum, value) => sum + value, 0) / values.length : null
  const currentAverage = average(logs.filter(l => l.date >= weekStart && l.weight != null).map(l => l.weight!))
  const previousAverage = average(logs.filter(l => l.date < weekStart && l.weight != null).map(l => l.weight!))
  const latestWeight = weights.at(-1) ?? user.currentWeight
  const latestMeasurement = await prisma.dailyLog.findFirst({where:{userId, measurements:{not:null}},orderBy:{date:"desc"},select:{measurements:true,date:true}})
  const firstWeight = weights[0] ?? user.currentWeight
  const avgSteps =
    logs.length > 0 ? Math.round(logs.reduce((sum, l) => sum + l.steps, 0) / logs.length) : 0
  const recentLogs = logs.filter(l => l.date >= weekStart && (l.stepsRecorded || l.steps > 0))
  const weeklyAverageSteps = recentLogs.length ? Math.round(recentLogs.reduce((sum, l) => sum + l.steps, 0) / recentLogs.length) : null

  const weeklyPlan = await getWeeklyPlan()
  const plannedWorkouts = weeklyPlan?.planDays.filter(day=>day.workoutId).length ?? readPreferences(user.preferences).trainingDays

  return {
    currentAverage, previousAverage, weeklyAverageSteps,
    stepGoalDays: recentLogs.filter(l => l.steps >= user.stepGoal).length,
    latestWeight,
    latestMeasurement,
    firstWeight,
    avgSteps,
    workoutsThisWeek: workoutLogs.length,
    logs: logs.map((l) => ({ date: l.date, steps: l.steps, stepsRecorded: l.stepsRecorded || l.steps > 0, weight: l.weight, waist: l.waist, measurements: l.measurements })),
    plannedWorkouts,
    waist: user.waist,
    stepGoal: user.stepGoal,
  }
}

export async function getTodayPlanContext() {
  const plan = await getWeeklyPlan()
  const today = todayDate()
  const day = plan?.planDays.find((d) => new Date(d.date).toDateString() === today.toDateString())
  const meals = day ? parsePlannedMeals(day.meals) : []
  const workouts = await getWorkouts()
  const workout = day?.workoutId ? workouts.find((w) => w.id === day.workoutId) ?? null : null
  return { meals, workout, activity: day?.activity ?? null }
}

export async function getShoppingList() {
  if (!await getAuthenticatedUserId()) return []
  return (await getShoppingListState()).items
}

export async function getShoppingListState() {
  const userId = await getAuthenticatedUserId()
  if (!userId) throw new Error("Logga in först")
  const plan = await getWeeklyPlan()
  const recipes = await getRecommendedRecipes()
  const planned = plan?.planDays.flatMap(day => parsePlannedMeals(day.meals)) ?? []
  const items = aggregateIngredients(planned.flatMap(meal => {
    const recipe = recipes.find(r => r.id === meal.recipeId)
    return recipe ? [recipe] : []
  }))
  const checked = plan ? await prisma.shoppingCheck.findMany({
    where: { weeklyPlanId: plan.id, weeklyPlan: { userId } }, select: { item: true },
  }) : []
  return { planId: plan?.id ?? null, items, checked: checked.map(row => row.item).filter(item => items.includes(item)) }
}

export async function setShoppingItemChecked(planId: string, item: string, checked: boolean) {
  const userId = await getAuthenticatedUserId()
  if (!userId) throw new Error("Logga in först")
  if (typeof planId !== "string" || typeof item !== "string" || typeof checked !== "boolean") throw new Error("Ogiltig inköpsrad")
  const state = await getShoppingListState()
  if (state.planId !== planId || !state.items.includes(item)) throw new Error("Inköpslistan har ändrats. Ladda om sidan.")
  await prisma.$transaction(async tx => {
    const plan = await tx.weeklyPlan.findFirst({ where: { id: planId, userId }, select: { id: true } })
    if (!plan) throw new Error("Inköpslistan saknas")
    if (checked) await tx.shoppingCheck.upsert({
      where: { weeklyPlanId_item: { weeklyPlanId: plan.id, item } },
      create: { weeklyPlanId: plan.id, item }, update: {},
    })
    else await tx.shoppingCheck.deleteMany({ where: { weeklyPlanId: plan.id, item } })
  })
}

export async function saveMeasurements(input: { weight?: number; waist?: number; measurements?: string }) {
  const userId = await getAuthenticatedUserId()
  if (!userId) throw new Error("Logga in först")
  for (const [value, min, max] of [[input.weight, 30, 400], [input.waist, 30, 250]]) {
    if (value != null && (!Number.isFinite(value) || value < min! || value > max!)) throw new Error("Kontrollera dina mått")
  }
  if ((input.measurements?.length ?? 0) > 500) throw new Error("Måttanteckningen är för lång")
  const date = todayDate()
  await prisma.$transaction([
    prisma.dailyLog.upsert({ where: { userId_date: { userId, date } }, create: { userId, date, ...input }, update: input }),
    prisma.user.update({ where: { id: userId }, data: { currentWeight: input.weight, waist: input.waist } }),
  ])
  revalidatePath("/progress")
}

export async function saveMode(mode: "simple" | "advanced") {
  const userId = await getAuthenticatedUserId()
  if (!userId || !["simple", "advanced"].includes(mode)) throw new Error("Kunde inte spara visningsläget")
  await prisma.user.update({ where: { id: userId }, data: { mode } })
}

export async function setDailySteps(steps: number) {
  const userId = await getAuthenticatedUserId()
  if (!userId) throw new Error("Logga in först")
  if (!Number.isInteger(steps) || steps < 0 || steps > 100000) throw new Error("Kontrollera stegantalet")
  const date = todayDate()
  await recordManualSteps(userId,date,steps)
}

export async function completeMeal(slot: string, recipeId: string) {
  const userId = await getAuthenticatedUserId()
  if (!userId) return
  const context = await getTodayPlanContext()
  if (!context.meals.some(m => m.slot === slot && m.recipeId === recipeId)) return
  const log = await getTodayData()
  if (!log) return
  const eaten = new Set(parseStringList(log.mealsEaten))
  eaten.add(`${slot}:${recipeId}`)
  await prisma.dailyLog.update({ where: { userId_date: { userId, date: todayDate() } }, data: { mealsEaten: JSON.stringify([...eaten]) } })
}

export async function getCoachContext() {
  const user = await getUser()
  if (!user) return null
  const [day, log, recipes, workouts, history] = await Promise.all([getTodayPlanContext(),getTodayData(),getRecommendedRecipes(),getWorkouts(),getWorkoutLogs()])
  const preferences = readPreferences(user.preferences)
  const eaten = parseStringList(log?.mealsEaten)
  return {
    userName:user.name.split(" ")[0], restrictions:parseStringList(user.dietRestrictions), dislikedFoods:parseStringList(user.dislikedFoods),
    stepGoal:user.stepGoal, stepsToday:log?.steps??0, todayMeals:day.meals.map(m=>`${m.slot}: ${m.title}`),
    plannedMeals:day.meals.map(m=>({...m,completed:eaten.includes(`${m.slot}:${m.recipeId}`)||eaten.includes(m.title)})),
    todayWorkout:day.workout?.title??null, activity:day.activity,
    completedWorkoutsThisWeek:history.filter(w=>w.completed&&w.date>=startOfWeekMonday()).length,
    recipes, workouts, trainingLevel:user.trainingLevel, trainingLocation:user.trainingLocation,
    homeEquipment:preferences.equipment, workoutMinutes:preferences.workoutMinutes, likedFoods:preferences.likedFoods,
  }
}

export async function getCoachOverview() {
  const context = await getCoachContext()
  if (!context) return null
  return { name:context.userName, nextMeal:context.plannedMeals.find(m=>!m.completed)?.title??null,
    hasMealPlan:context.plannedMeals.length>0, restrictions:context.restrictions, dislikedFoods:context.dislikedFoods,
    workout:context.todayWorkout, steps:context.stepsToday, stepGoal:context.stepGoal }
}

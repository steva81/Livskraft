"use server"

import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getAuthenticatedUserId } from "@/lib/auth"
import { parseStringList, recipeMeetsConstraints } from "@/lib/dietary"
import { generateWeeklyPlanForUser } from "@/lib/plan-generator"
import { parsePlannedMeals, startOfWeekMonday, selectedSlots, encodeMeals } from "@/lib/plan-types"
import { hashPassword, verifyPassword } from "@/lib/password"
import { defaultPreferences, readPreferences, validPreferences, validSlots, mealSlots, readMeasurements, type MealSlot, type MeasurementKey, type Preferences } from "@/lib/preferences"
import { workoutFits } from "@/lib/training"
import { chooseMeals, rankRecipes } from "@/lib/recipe-ranking"
import { filterShoppingDays, shoppingItems, type ShoppingFilter } from "@/lib/shopping-filters"
import { aggregateIngredients } from "@/lib/shopping"
import { adaptiveStateForUser, decideAdaptiveWeek } from "@/lib/adaptive"
import { recordManualSteps } from "@/lib/steps"
import { activityGuidance } from "@/lib/activity"

import { assessGoal, savedGoalSafety } from "@/lib/goal-safety"

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
  const weeks = Number(data.timeframeWeeks)
  const currentWeight = Number(data.currentWeight)
  const targetWeight = Number(data.targetWeight)
  const safety = assessGoal(data)
  if (safety.level === "blocked") return { success: false as const, error: safety.message }
  const isAggressive = safety.level === "aggressive"
  const preferences = { ...defaultPreferences, ...data.preferences }
  if (!validPreferences(preferences)) return { success: false as const, error: "Kontrollera dina profilval." }
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

  return rankRecipes(allRecipes.filter((recipe) => recipeMeetsConstraints(recipe, restrictions, dislikes)), readPreferences(user.preferences))
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
  const goalUser = await prisma.user.findUnique({ where: { id: userId } })
  if (goalUser && savedGoalSafety(goalUser)?.level === "blocked") return null
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
      meals: encodeMeals(parsePlannedMeals(day.meals).flatMap(meal => {
        const recipe = safe.find(recipe => recipe.id === meal.recipeId)
        return recipe ? [{ ...meal, title: recipe.title }] : []
      }), selectedSlots(day.meals)),
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
    preferences: readPreferences(user.preferences),
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

export async function getShoppingListState(filter: ShoppingFilter = {}) {
  const userId = await getAuthenticatedUserId()
  if (!userId) throw new Error("Logga in först")
  const plan = await getWeeklyPlan()
  const recipes = await getRecommendedRecipes()
  const days = filterShoppingDays(plan?.planDays ?? [], filter)
  const slots = filter.slots ?? [...mealSlots]
  if (!validSlots(slots)) throw new Error("Ogiltiga måltider")
  const planned = days.flatMap(day => parsePlannedMeals(day.meals)).filter(meal=>slots.includes(meal.slot))
  const items = shoppingItems(aggregateIngredients(planned.flatMap(meal => {
    const recipe = recipes.find(r => r.id === meal.recipeId)
    return recipe ? [recipe] : []
  })), filter.hidePantry === true)
  const checked = plan ? await prisma.shoppingCheck.findMany({
    where: { weeklyPlanId: plan.id, weeklyPlan: { userId } }, select: { item: true },
  }) : []
  return { days: (plan?.planDays ?? []).map(day=>({id:day.id,date:day.date})), planId: plan?.id ?? null, items, checked: checked.map(row => row.item).filter(item => items.includes(item)) }
}

export async function setShoppingItemChecked(planId: string, item: string, checked: boolean, filter: ShoppingFilter = {}) {
  const userId = await getAuthenticatedUserId()
  if (!userId) throw new Error("Logga in först")
  if (typeof planId !== "string" || typeof item !== "string" || typeof checked !== "boolean") throw new Error("Ogiltig inköpsrad")
  const state = await getShoppingListState(filter)
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

export async function saveMeasurements(input: { weight?: number; waist?: number; measurements?: string; values?: Partial<Record<MeasurementKey,number>> }) {
  const userId = await getAuthenticatedUserId()
  if (!userId) throw new Error("Logga in först")
  for (const [value, min, max] of [[input.weight, 30, 400], [input.waist, 30, 250]]) {
    if (value != null && (!Number.isFinite(value) || value < min! || value > max!)) throw new Error("Kontrollera dina mått")
  }
  if (input.measurements != null && (typeof input.measurements !== "string" || input.measurements.length > 500)) throw new Error("Måttanteckningen är för lång")
  if (input.values) {
    const user = await prisma.user.findUniqueOrThrow({where:{id:userId}})
    const tracked = readPreferences(user.preferences).trackedMeasurements
    if (Object.entries(input.values).some(([key,value])=>!tracked.includes(key as MeasurementKey) || typeof value !== "number" || !Number.isFinite(value) || value<=0 || value>250)) throw new Error("Kontrollera dina mått")
    const old = await prisma.dailyLog.findUnique({where:{userId_date:{userId,date:todayDate()}}})
    input.measurements = JSON.stringify({...readMeasurements(old?.measurements ?? null),...input.values})
  }
  const storedInput = { weight: input.weight, waist: input.waist, measurements: input.measurements }
  const date = todayDate()
  await prisma.$transaction([
    prisma.dailyLog.upsert({ where: { userId_date: { userId, date } }, create: { userId, date, ...storedInput }, update: storedInput }),
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
    health: preferences.health, language: preferences.language, budget: preferences.budget, workSchedule: preferences.workSchedule,
    goal: { currentWeight:user.currentWeight, targetWeight:user.targetWeight, timeframeWeeks:user.timeframeWeeks },
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

export async function updateWeightGoal(input: { currentWeight: number; targetWeight: number; timeframeWeeks: number }) {
  const userId = await getAuthenticatedUserId()
  if (!userId) return { success: false as const, error: "Logga in först." }
  const safety = assessGoal(input)
  if (safety.level === "blocked") return { success: false as const, error: safety.message }
  await prisma.user.update({ where: { id: userId }, data: {
    currentWeight: Number(input.currentWeight), targetWeight: Number(input.targetWeight), timeframeWeeks: Number(input.timeframeWeeks),
  } })
  revalidatePath("/profile")
  revalidatePath("/plan")
  return { success: true as const }
}

export async function savePreferences(patch: Partial<Preferences>) {
  const userId = await getAuthenticatedUserId()
  if (!userId) throw new Error("Logga in först")
  await prisma.$transaction(async tx => {
    const user = await tx.user.findUniqueOrThrow({where:{id:userId}})
    const clean = Object.fromEntries(Object.entries(patch).filter(([key])=>Object.hasOwn(defaultPreferences,key)))
    const preferences = {...readPreferences(user.preferences),...clean}
    if (!validPreferences(preferences)) throw new Error("Kontrollera dina profilval")
    await tx.user.update({where:{id:userId},data:{preferences:JSON.stringify(preferences)}})
  })
  revalidatePath("/", "layout")
}

export async function selectPlanMeals(planId: string, slots: MealSlot[], dayId?: string) {
  const userId = await getAuthenticatedUserId()
  if (!userId) throw new Error("Logga in först")
  if (!validSlots(slots)) throw new Error("Ogiltiga måltider")
  await prisma.$transaction(async tx => {
    const user = await tx.user.findUniqueOrThrow({where:{id:userId}})
    if (savedGoalSafety(user)?.level === "blocked") throw new Error("Justera målet i Min profil")
    const plan = await tx.weeklyPlan.findFirst({where:{id:planId,userId},include:{planDays:{orderBy:{date:"asc"}}}})
    if (!plan || (dayId && !plan.planDays.some(day=>day.id===dayId))) throw new Error("Planen saknas")
    const preferences = readPreferences(user.preferences)
    const recipes = rankRecipes((await tx.recipe.findMany()).filter(r=>recipeMeetsConstraints(r,parseStringList(user.dietRestrictions),parseStringList(user.dislikedFoods)) && r.prepTime<=preferences.cookingMinutes),preferences)
    for (const [index,day] of plan.planDays.entries()) {
      if (dayId && day.id!==dayId) continue
      const existing = parsePlannedMeals(day.meals)
      const choices = chooseMeals(recipes,slots,index)
      const meals = choices.map(choice=>existing.find(m=>m.slot===choice.slot && recipes.some(r=>r.id===m.recipeId)) ?? choice)
      await tx.planDay.update({where:{id:day.id},data:{meals:encodeMeals(meals,slots)}})
    }
  })
  revalidatePath("/plan"); revalidatePath("/meals"); revalidatePath("/dashboard")
}

export async function changeAccountPassword(currentPassword:string, newPassword:string) {
  const userId=await getAuthenticatedUserId()
  if(!userId) throw new Error("Logga in först")
  if(typeof currentPassword!=="string" || typeof newPassword!=="string" || currentPassword.length>256 || newPassword.length<10 || newPassword.length>256) return {success:false}
  const user=await prisma.user.findUnique({where:{id:userId}})
  if(!user?.password || !await verifyPassword(currentPassword,user.password)) return {success:false}
  const result=await prisma.user.updateMany({where:{id:userId,password:user.password},data:{password:await hashPassword(newPassword)}})
  return {success:result.count===1}
}

export async function saveMyPlan(input:{dietRestrictions:string[];dislikedFoods:string[];lifestyle:string[];trainingLocation:string;trainingLevel:string;activityLevel:string;preferences:Partial<Preferences>}) {
  const userId=await getAuthenticatedUserId()
  if(!userId) throw new Error("Logga in först")
  if(!input || !["home","gym","both"].includes(input.trainingLocation) || !["beginner","intermediate","advanced"].includes(input.trainingLevel) || !["sedentary","light","moderate","active","very_active"].includes(input.activityLevel) || [input.dietRestrictions,input.dislikedFoods,input.lifestyle].some(v=>!Array.isArray(v)||v.length>50||v.some(s=>typeof s!=="string"||s.length>100))) throw new Error("Kontrollera dina profilval")
  await prisma.$transaction(async tx=>{
    const user=await tx.user.findUniqueOrThrow({where:{id:userId}})
    const keys=["dailySteps","cookingMinutes","workoutMinutes","trainingDays","budget","likedFoods","equipment","workSchedule","health","mealSlots","trackedMeasurements"]
    const preferences={...readPreferences(user.preferences),...Object.fromEntries(Object.entries(input.preferences??{}).filter(([k])=>keys.includes(k)))}
    if(!validPreferences(preferences))throw new Error("Kontrollera dina profilval")
    await tx.user.update({where:{id:userId},data:{preferences:JSON.stringify(preferences),dietRestrictions:JSON.stringify(input.dietRestrictions),dislikedFoods:JSON.stringify(input.dislikedFoods),lifestyle:JSON.stringify(input.lifestyle),trainingLocation:input.trainingLocation,trainingLevel:input.trainingLevel,activityLevel:input.activityLevel,stepGoal:Math.min(12000,Math.max(2000,preferences.dailySteps+1000))}})
    // Refresh upcoming days in place; keep day selections, shopping identities and past logs.
    const recipes=rankRecipes((await tx.recipe.findMany()).filter(r=>recipeMeetsConstraints(r,input.dietRestrictions,input.dislikedFoods)&&r.prepTime<=preferences.cookingMinutes),preferences)
    const workouts=(await tx.workout.findMany()).filter(w=>(input.trainingLocation==="both"||w.type===input.trainingLocation)&&workoutFits(w,input.trainingLevel,preferences.equipment,preferences.workoutMinutes))
    const trainingDays=new Set([0,3,5,1,4].slice(0,preferences.trainingDays))
    const days=await tx.planDay.findMany({where:{weeklyPlan:{userId},date:{gte:todayDate()}},orderBy:{date:"asc"}})
    for(const day of days){const index=(day.dayOfWeek+6)%7;const slots=selectedSlots(day.meals);await tx.planDay.update({where:{id:day.id},data:{meals:encodeMeals(chooseMeals(recipes,slots,index),slots),workoutId:trainingDays.has(index)?workouts[index%Math.max(workouts.length,1)]?.id??null:null}})}
    await tx.adaptiveDecision.deleteMany({where:{userId,targetStart:{gte:startOfWeekMonday()}}})
  })
  revalidatePath("/","layout")
  return getUser()
}

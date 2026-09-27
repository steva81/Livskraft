import prisma from "./prisma"
import { nutritionTarget, parseNutrition, totalNutrition, primaryGoal, weightTrend } from "./nutrition"
import { parsePlannedMeals } from "./plan-types"
import { parseStringList } from "./dietary"

export async function dailyNutritionForUser(userId: string, date = new Date()) {
  const start = new Date(date); start.setHours(0,0,0,0)
  const end = new Date(start); end.setDate(end.getDate()+1)
  const from = new Date(start); from.setDate(from.getDate()-28)
  const [user, day, log, ownMeals, recipes, logs] = await Promise.all([
    prisma.user.findUniqueOrThrow({where:{id:userId}}),
    prisma.planDay.findFirst({where:{weeklyPlan:{userId},date:{gte:start,lt:end}},orderBy:{date:"desc"}}),
    prisma.dailyLog.findUnique({where:{userId_date:{userId,date:start}}}),
    prisma.ownMeal.findMany({where:{userId,eatenAt:{gte:start,lt:end}},orderBy:{eatenAt:"asc"}}),
    prisma.recipe.findMany(),
    prisma.dailyLog.findMany({where:{userId,date:{gte:from,lte:start}},orderBy:{date:"asc"}}),
  ])
  const meals = parsePlannedMeals(day?.meals ?? "[]")
  const eaten = parseStringList(log?.mealsEaten)
  const nutrients = (id: string) => parseNutrition(recipes.find(r=>r.id===id)?.nutrition ?? null)
  const completed = meals.filter(m=>eaten.includes(`${m.slot}:${m.recipeId}`)||eaten.includes(m.title))
  return {
    target: nutritionTarget(user), goal: primaryGoal(user), ownMeals,
    planned: totalNutrition(meals.map(m=>nutrients(m.recipeId))),
    consumed: totalNutrition([...completed.map(m=>nutrients(m.recipeId)), ...ownMeals.map(m=>parseNutrition(m.nutrition))]),
    completedMeals: completed.length, plannedMeals: meals.length,
    trend: weightTrend(logs), steps: log?.stepsRecorded ? log.steps : null,
  }
}

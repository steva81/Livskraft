"use server"
import prisma from "@/lib/prisma"
import { getAuthenticatedUserId } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { dailyNutritionForUser } from "@/lib/daily-nutrition"
import { type Nutrition } from "@/lib/nutrition"
import { nutritionProposal, decideNutrition, type BalanceScope } from "@/lib/nutrition-balancing"
import { type BodyData, validBodyData } from "@/lib/body-data"
import { readPreferences } from "@/lib/preferences"
import { primaryGoal } from "@/lib/nutrition"
import { startOfWeekMonday } from "@/lib/plan-types"

export type OwnMealInput = { id?: string; name: string; components: string; portion: string; mealType: string; eatenAt: string; nutrition: Nutrition }
async function identity() {
  const id = await getAuthenticatedUserId()
  if (!id) throw new Error("Logga in först / Sign in first")
  return id
}
export async function getDailyNutrition() { return dailyNutritionForUser(await identity()) }
export async function saveOwnMeal(input: OwnMealInput) {
  const userId = await identity()
  if (!input || typeof input.name !== "string" || !input.name.trim() || input.name.length > 120 ||
    typeof input.components !== "string" || input.components.length > 2000 || typeof input.portion !== "string" || input.portion.length > 200 ||
    !["breakfast","lunch","dinner","snack","other"].includes(input.mealType)) throw new Error("Kontrollera måltiden / Check the meal")
  const eatenAt = new Date(input.eatenAt)
  if (!Number.isFinite(+eatenAt) || +eatenAt > Date.now()+300000 || +eatenAt < Date.UTC(2000,0,1)) throw new Error("Ogiltig tid / Invalid time")
  const nutrition = {} as Nutrition
  for (const key of ["calories","protein","carbs","fat","fibre"] as const) {
    const value = input.nutrition?.[key]
    if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > (key === "calories" ? 10000 : 1000))) throw new Error("Ogiltigt näringsvärde / Invalid nutrition value")
    nutrition[key] = value
  }
  const data = {name:input.name.trim(),components:input.components.trim(),portion:input.portion.trim(),mealType:input.mealType,eatenAt,nutrition:JSON.stringify(nutrition)}
  if (input.id) {
    const result = await prisma.ownMeal.updateMany({where:{id:input.id,userId},data})
    if (result.count !== 1) throw new Error("Måltiden finns inte / Meal not found")
  } else await prisma.ownMeal.create({data:{...data,userId}})
  revalidatePath("/", "layout")
}
export async function deleteOwnMeal(id: string) {
  const userId = await identity()
  const result = await prisma.ownMeal.deleteMany({where:{id,userId}})
  if (result.count !== 1) throw new Error("Måltiden finns inte / Meal not found")
  revalidatePath("/", "layout")
}
export async function listOwnMeals() {
  return prisma.ownMeal.findMany({where:{userId:await identity()},orderBy:{eatenAt:"desc"},take:100})
}
export async function getNutritionProposal(scope:BalanceScope) {return nutritionProposal(await identity(),scope)}
export async function chooseNutritionProposal(scope:BalanceScope,key:string,accept:boolean) {
  if (typeof accept!=="boolean") throw new Error("Invalid decision")
  await decideNutrition(await identity(),scope,key,accept)
  revalidatePath("/", "layout")
}
export async function saveBodyData(input:BodyData & {height:number|null;currentWeight:number|null}) {
  // Baseline correction only: dated measurements are explicitly saved in Progress.
  const userId=await identity()
  if (!input || !validBodyData(input) || [[input.height,100,250],[input.currentWeight,30,400]].some(([value,min,max])=>value!==null&&(typeof value!=="number"||!Number.isFinite(value)||value<min!||value>max!))) throw new Error("Kontrollera grunddata / Check baseline data")
  await prisma.$transaction(async tx=>{
    const user=await tx.user.findUniqueOrThrow({where:{id:userId}})
    const preferences={...readPreferences(user.preferences),birthYear:input.birthYear,sexForEnergy:input.sexForEnergy}
    const goal=primaryGoal(user), maintaining=goal==="maintain"||goal==="retain-muscle"
    await tx.user.update({where:{id:userId},data:{preferences:JSON.stringify(preferences),height:input.height,currentWeight:input.currentWeight,...(maintaining&&user.targetWeight!==null?{targetWeight:input.currentWeight}:{} )}})
  })
  revalidatePath("/","layout")
}
export async function getWeeklyNutrition() {
  const userId=await identity(), start=startOfWeekMonday(), end=new Date(start);end.setDate(end.getDate()+7)
  const days=await Promise.all(Array.from({length:7},(_,i)=>{const date=new Date(start);date.setDate(date.getDate()+i);return dailyNutritionForUser(userId,date).then(data=>({date,planned:data.planned,consumed:data.consumed,ownMeals:data.ownMeals.length}))}))
  const decisions=await prisma.nutritionDecision.count({where:{userId,status:"accepted",createdAt:{gte:start,lt:end}}})
  return {days,decisions}
}

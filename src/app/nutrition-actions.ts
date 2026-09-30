"use server"
import prisma from "@/lib/prisma"
import { getAuthenticatedUserId } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { dailyNutritionForUser } from "@/lib/daily-nutrition"
import { type Nutrition } from "@/lib/nutrition"
import { nutritionProposal, decideNutrition, type BalanceScope } from "@/lib/nutrition-balancing"
import { type BodyData, validBodyData } from "@/lib/body-data"
import { readPreferences, readMeasurements, measurementLabels, type MeasurementKey } from "@/lib/preferences"
import { primaryGoal } from "@/lib/nutrition"
import { startOfWeekMonday } from "@/lib/plan-types"
import { createHash } from "node:crypto"

export type OwnMealInput = { id?: string; name: string; components: string; portion: string; mealType: string; eatenAt: string; nutrition: Nutrition }
async function identity() {
  const id = await getAuthenticatedUserId()
  if (!id) throw new Error("Logga in först / Sign in first")
  return id
}
export async function getDailyNutrition() { return dailyNutritionForUser(await identity()) }
// A stable per-draft token makes a lost response or double-click safe to retry.
// Only reviewed text/nutrients are accepted; the photo and provider response are never persisted.
export async function savePhotoMeal(input: { token: string; name: string; components: string; portion: string; mealType: string; nutrition: Nutrition }) {
  const userId = await identity()
  if (!input || typeof input.token !== "string" || !/^[a-f0-9-]{36}$/i.test(input.token) ||
    typeof input.name !== "string" || !input.name.trim() || input.name.length > 120 ||
    typeof input.components !== "string" || input.components.length > 2000 ||
    typeof input.portion !== "string" || input.portion.length > 200 ||
    !["breakfast", "lunch", "dinner", "snack", "other"].includes(input.mealType)) throw new Error("Kontrollera måltiden / Check the meal")
  const nutrition: Nutrition = { calories: null, protein: null, carbs: null, fat: null, fibre: null }
  for (const key of ["calories", "protein", "carbs", "fat", "fibre"] as const) {
    const value = input.nutrition?.[key]
    if (key === "fibre" && value === null) continue
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > (key === "calories" ? 10000 : 1000)) throw new Error("Kontrollera näringsvärden / Check nutrition values")
    nutrition[key] = value
  }
  const id = `photo-${createHash("sha256").update(JSON.stringify([userId,input.token])).digest("hex")}`
  await prisma.ownMeal.upsert({ where: { id }, update: {}, create: {
    id, userId, name: input.name.trim(), components: input.components.trim(), portion: input.portion.trim(), mealType: input.mealType,
    eatenAt: new Date(), nutrition: JSON.stringify(nutrition),
  } })
  revalidatePath("/", "layout")
}
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
export async function getBodyMeasurements() {
  const logs=await prisma.dailyLog.findMany({where:{userId:await identity(),measurements:{not:null}},orderBy:{date:"asc"},select:{measurements:true}})
  return logs.reduce((values,log)=>({...values,...readMeasurements(log.measurements)}),{} as Partial<Record<MeasurementKey,number>>)
}
export async function saveBodyData(input:BodyData & {height:number|null;currentWeight:number|null;waist?:number;trackedMeasurements?:MeasurementKey[];values?:Partial<Record<MeasurementKey,number>>}) {
  const userId=await identity()
  if (!input || !validBodyData(input) || [[input.height,100,250],[input.currentWeight,30,400]].some(([value,min,max])=>value!==null&&(typeof value!=="number"||!Number.isFinite(value)||value<min!||value>max!))) throw new Error("Kontrollera grunddata / Check baseline data")
  if (input.waist!==undefined && (!Number.isFinite(input.waist)||input.waist<30||input.waist>250)) throw new Error("Kontrollera midjemåttet / Check waist measurement")
  if (input.trackedMeasurements!==undefined && (!Array.isArray(input.trackedMeasurements)||input.trackedMeasurements.length>6||input.trackedMeasurements.some(key=>!Object.hasOwn(measurementLabels,key)))) throw new Error("Kontrollera dina mått / Check measurements")
  await prisma.$transaction(async tx=>{
    const user=await tx.user.findUniqueOrThrow({where:{id:userId}})
    const preferences={...readPreferences(user.preferences),birthYear:input.birthYear,sexForEnergy:input.sexForEnergy,...(input.trackedMeasurements?{trackedMeasurements:[...new Set(input.trackedMeasurements)]}:{})}
    if(input.values && Object.entries(input.values).some(([key,value])=>!preferences.trackedMeasurements.includes(key as MeasurementKey)||typeof value!=="number"||!Number.isFinite(value)||value<=0||value>250)) throw new Error("Kontrollera dina mått / Check measurements")
    const goal=primaryGoal(user), maintaining=goal==="maintain"||goal==="retain-muscle"
    await tx.user.update({where:{id:userId},data:{preferences:JSON.stringify(preferences),height:input.height,currentWeight:input.currentWeight,waist:input.waist,...(maintaining&&user.targetWeight!==null?{targetWeight:input.currentWeight}:{} )}})
    // Use the existing unique user/day measurement record; hidden fields and older days survive.
    if((input.trackedMeasurements!==undefined&&input.currentWeight!==null)||input.waist!==undefined||Object.keys(input.values??{}).length){
      const date=new Date();date.setHours(0,0,0,0)
      const old=await tx.dailyLog.findUnique({where:{userId_date:{userId,date}}})
      const data={weight:input.currentWeight??undefined,waist:input.waist,...(Object.keys(input.values??{}).length?{measurements:JSON.stringify({...readMeasurements(old?.measurements??null),...input.values})}:{})}
      await tx.dailyLog.upsert({where:{userId_date:{userId,date}},create:{userId,date,...data},update:data})
    }
  })
  revalidatePath("/","layout")
}
export async function getWeeklyNutrition() {
  const userId=await identity(), start=startOfWeekMonday(), end=new Date(start);end.setDate(end.getDate()+7)
  const days=await Promise.all(Array.from({length:7},(_,i)=>{const date=new Date(start);date.setDate(date.getDate()+i);return dailyNutritionForUser(userId,date).then(data=>({date,planned:data.planned,consumed:data.consumed,ownMeals:data.ownMeals.length}))}))
  const decisions=await prisma.nutritionDecision.count({where:{userId,status:"accepted",createdAt:{gte:start,lt:end}}})
  return {days,decisions}
}

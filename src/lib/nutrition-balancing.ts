import { createHash } from "node:crypto"
import prisma from "./prisma"
import { dailyNutritionForUser } from "./daily-nutrition"
import { nutritionTarget, parseNutrition, primaryGoal, weightTrend } from "./nutrition"
import { readPreferences } from "./preferences"
import { parseStringList, recipeMeetsConstraints } from "./dietary"
import { encodeMeals, parsePlannedMeals, selectedSlots, startOfWeekMonday } from "./plan-types"

export type BalanceScope = "day" | "week" | "trend"
export async function nutritionProposal(userId: string, scope: BalanceScope) {
  if (!["day","week","trend"].includes(scope)) throw new Error("Invalid scope")
  const user = await prisma.user.findUniqueOrThrow({where:{id:userId}})
  const target = nutritionTarget(user), p = readPreferences(user.preferences)
  const daily = await dailyNutritionForUser(userId)
  const today = new Date();today.setHours(0,0,0,0)
  const start = new Date(today), end = startOfWeekMonday(today);end.setDate(end.getDate()+7)
  const base = {scope,key:"",changes:[] as {dayId:string;date:Date;before:string;after:string;from:string;to:string;delta:number}[], reason:"minor" as "minor"|"incomplete"|"unavailable"|"proposed"|"insufficient", status:"open" as string}
  if (!target || p.health !== "none") return {...base,reason:"unavailable" as const}
  const recentDecision=await prisma.nutritionDecision.findFirst({where:{userId,status:"accepted",createdAt:{gte:today}}})
  if (recentDecision) return {...base,reason:"unavailable" as const}
  let evidence = ""
  let direction = -1
  if (scope === "trend") {
    const since = new Date(today);since.setDate(since.getDate()-28)
    const logs = await prisma.dailyLog.findMany({where:{userId,date:{gte:since,lte:today}},orderBy:{date:"asc"}})
    evidence=JSON.stringify(logs.map(l=>({date:l.date,weight:l.weight})))
    const trend = weightTrend(logs)
    if (!trend) return {...base,reason:"insufficient" as const}
    const goal = primaryGoal(user), rate = trend.weeklyChange
    if (goal === "lose" && rate > -0.1) direction=-1
    else if ((goal === "maintain" || goal === "retain-muscle") && Math.abs(rate)>target.maintenance/2000) direction=rate>0?-1:1
    else if (goal === "build-muscle" && (rate<0.05||rate>0.4)) direction=rate>0.4?-1:1
    else return base
    start.setTime(+end);end.setDate(end.getDate()+7)
  } else {
    if (daily.consumed.unknown.calories || daily.consumed.count===0) return {...base,reason:"incomplete" as const}
    // Only observed intake exceeding the full daily target qualifies, never an unlogged meal.
    if (daily.consumed.sum.calories-target.calories<200) return base
    if (scope === "day") end.setTime(+today+86400000)
    else start.setDate(start.getDate()+1)
  }
  const days = await prisma.planDay.findMany({where:{weeklyPlan:{userId},date:{gte:start,lt:end}},orderBy:{date:"asc"}})
  const recipes = await prisma.recipe.findMany()
  const allowed = recipes.filter(r=>recipeMeetsConstraints(r,parseStringList(user.dietRestrictions),parseStringList(user.dislikedFoods))&&r.prepTime<=p.cookingMinutes)
  const logs = await prisma.dailyLog.findMany({where:{userId,date:{gte:start,lt:end}}})
  for (const day of days) {
    const meals = parsePlannedMeals(day.meals), eaten = parseStringList(logs.find(l=>+l.date===+day.date)?.mealsEaten)
    for (let i=0;i<meals.length;i++) {
      const meal=meals[i], original=recipes.find(r=>r.id===meal.recipeId)
      if (!original || eaten.includes(`${meal.slot}:${meal.recipeId}`)||eaten.includes(meal.title)) continue
      const old=parseNutrition(original.nutrition)
      if (old.calories===null||old.protein===null||old.fibre===null) continue
      const dayEnergy=meals.reduce((sum,m)=>sum+(parseNutrition(recipes.find(r=>r.id===m.recipeId)?.nutrition??null).calories??0),0)
      const tag=({Frukost:"breakfast",Lunch:"lunch",Middag:"dinner",Mellanmål:"snack"})[meal.slot]
      const replacement=allowed.find(r=>{
        const n=parseNutrition(r.nutrition), delta=(n.calories??0)-old.calories!
        return r.id!==original.id && dayEnergy+delta>=Math.max(1500,target.baseline??0,target.calories*0.9) && parseStringList(r.tags).includes(tag) && n.calories!==null && n.protein!==null && n.fibre!==null && n.protein>=old.protein! && n.fibre>=old.fibre! && delta*direction>=25 && delta*direction<=Math.min(100,target.calories*0.05)
      })
      if (!replacement) continue
      const updated=[...meals];updated[i]={...meal,recipeId:replacement.id,title:replacement.title}
      base.changes.push({dayId:day.id,date:day.date,before:day.meals,after:encodeMeals(updated,selectedSlots(day.meals)),from:original.title,to:replacement.title,delta:parseNutrition(replacement.nutrition).calories!-old.calories})
      break // At most one modest swap per day; no portion cuts or workout changes.
    }
    if (base.changes.length>=3) break
  }
  base.reason=base.changes.length?"proposed":"unavailable"
  base.key=createHash("sha256").update(JSON.stringify({scope,target,evidence,consumed:daily.consumed,changes:base.changes})).digest("hex")
  const decision=await prisma.nutritionDecision.findUnique({where:{userId_proposalKey:{userId,proposalKey:base.key}}})
  base.status=decision?.status??"open"
  return base
}
export async function decideNutrition(userId:string,scope:BalanceScope,key:string,accept:boolean) {
  const proposal=await nutritionProposal(userId,scope)
  if (proposal.key!==key||proposal.reason!=="proposed"||proposal.status!=="open") throw new Error("Förslaget har ändrats. Ladda om / Proposal changed. Reload")
  await prisma.$transaction(async tx=>{
    const today=new Date();today.setHours(0,0,0,0)
    if (accept && await tx.nutritionDecision.findFirst({where:{userId,status:"accepted",createdAt:{gte:today}}})) throw new Error("En anpassning är redan sparad idag / An adjustment was already saved today")
    if (accept) for (const change of proposal.changes) {
      const updated=await tx.planDay.updateMany({where:{id:change.dayId,weeklyPlan:{userId},meals:change.before},data:{meals:change.after}})
      if (updated.count!==1) throw new Error("Plan changed")
    }
    await tx.nutritionDecision.create({data:{userId,proposalKey:key,status:accept?"accepted":"declined",summary:JSON.stringify(proposal)}})
  })
}

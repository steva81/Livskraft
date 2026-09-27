import { savedGoalSafety } from "./goal-safety"
import prisma from "./prisma"
import { startOfWeekMonday } from "./plan-types"
import { readPreferences } from "./preferences"
import { workoutFits } from "./training"
import { generateWeeklyPlanForUser } from "./plan-generator"
import { createHash } from "node:crypto"

type Change = { dayId: string; workoutId?: string; activity?: string; description: string }
export type AdaptiveState = {
  status: "insufficient" | "unchanged" | "proposed" | "accepted" | "declined"
  targetStart: Date; reason: string; changes: Change[]; unchanged: string; evidenceDays: number; key: string
}

export async function adaptiveStateForUser(userId: string): Promise<AdaptiveState> {
  const today = new Date(); today.setHours(0,0,0,0)
  const targetStart = startOfWeekMonday(today); targetStart.setDate(targetStart.getDate()+7)
  const base: AdaptiveState = { status:"insufficient", targetStart, reason:"Vi har ännu för lite data för att göra en meningsfull anpassning. Fortsätt logga några dagar så får du ett bättre förslag.", changes:[], unchanged:"Måltider, kostregler, träningsdagar och personligt stegmål behålls.", evidenceDays:0, key:"" }
  const user = await prisma.user.findUnique({where:{id:userId}})
  if (!user) return base
  const safety = savedGoalSafety(user)
  if (safety?.level === "blocked") return { ...base, reason: safety.message }
  const stored = await prisma.adaptiveDecision.findUnique({where:{userId_targetStart:{userId,targetStart}}})
  if (stored) return {...base,...JSON.parse(stored.summary),targetStart,status:stored.status as "accepted"|"declined"}
  const from = new Date(today); from.setDate(from.getDate()-13)
  const logs = await prisma.dailyLog.findMany({where:{userId,date:{gte:from,lte:today}},orderBy:{date:"asc"}})
  const workouts = await prisma.workoutLog.findMany({where:{userId,completed:true,date:{gte:from,lte:today}}})
  // Merely visiting Today creates an empty log and is not evidence.
  const dates = new Set(logs.filter(l=>l.stepsRecorded || l.steps>0 || l.weight!=null || l.waist!=null || (l.mealsEaten && l.mealsEaten!=="[]")).map(l=>l.date.getTime()))
  workouts.forEach(w=>dates.add(w.date.getTime()))
  const observed = Array.from(dates).sort((a,b)=>a-b)
  base.evidenceDays = observed.length
  if (observed.length<5 || (observed.at(-1)!-observed[0])/86400000<6) return base

  const preferences = readPreferences(user.preferences)
  let next = await prisma.weeklyPlan.findFirst({where:{userId,startDate:targetStart},include:{planDays:{orderBy:{date:"asc"}}}})
  if (!next) next = await generateWeeklyPlanForUser(userId,{nextWeek:true})
  if (!next) return base
  const library = await prisma.workout.findMany()
  const due = await prisma.planDay.findMany({where:{weeklyPlan:{userId},date:{gte:from,lt:today},workoutId:{not:null}}})
  const completedDays = new Set(workouts.filter(w=>w.date<today).map(w=>w.date.toDateString())).size
  const reasons: string[] = []
  if (due.length>=2 && completedDays/due.length<0.6) {
    for (const day of next.planDays) {
      const current = library.find(w=>w.id===day.workoutId)
      if (!current) continue
      const shorter = library.filter(w=>w.type===current.type && workoutFits(w,user.trainingLevel,preferences.equipment,preferences.workoutMinutes) && w.duration<current.duration)
        .sort((a,b)=>b.duration-a.duration)[0]
      if (shorter && base.changes.filter(c=>c.workoutId).length<2) {
        base.changes.push({dayId:day.id,workoutId:shorter.id,description:`${day.date.toLocaleDateString("sv-SE",{weekday:"long"})}: ${current.title} (${current.duration} min) byts till ${shorter.title} (${shorter.duration} min).`})
      }
    }
    if (base.changes.length) reasons.push(`Du har loggat träning ${completedDays} av ${due.length} hittills planerade dagar under de senaste två veckorna. Kortare pass kan bli lättare att få plats med.`)
  }
  const stepLogs = logs.filter(l=>l.stepsRecorded || l.steps>0)
  if (stepLogs.length>=4 && stepLogs.reduce((sum,l)=>sum+l.steps,0)/stepLogs.length<user.stepGoal*0.7) {
    const restDays = next.planDays.filter(d=>!d.workoutId).slice(0,2)
    for (const day of restDays) {
      const activity = "Prova två lugna rörelsepauser på ungefär 5 minuter i stället för en längre promenad. Välj tid runt din vardag. Helt frivilligt – inga missade steg behöver tas igen."
      if (day.activity!==activity) base.changes.push({dayId:day.id,activity,description:`${day.date.toLocaleDateString("sv-SE",{weekday:"long"})}: promenadförslaget delas upp i två korta rörelsepauser.`})
    }
    if (restDays.length) reasons.push(`Stegen har legat under ditt mål på de ${stepLogs.length} loggade dagarna. Vi föreslår mindre, praktiska rörelsepauser utan att höja målet.`)
  }
  base.status = base.changes.length ? "proposed" : "unchanged"
  base.reason = reasons.join(" ") || "Det finns inget tydligt, genomförbart skäl att ändra nästa vecka utifrån dina loggar. Fortsätt i din takt."
  base.key = createHash("sha256").update(JSON.stringify(base.changes)).digest("hex")
  return base
}

export async function decideAdaptiveWeek(userId: string, accept: boolean, expectedKey: string): Promise<AdaptiveState> {
  const state = await adaptiveStateForUser(userId)
  if (state.status!=="proposed") return state
  if (state.key!==expectedKey) throw new Error("Förslaget har uppdaterats. Läs det nya förslaget innan du väljer.")
  await prisma.$transaction(async tx => {
    const existing = await tx.adaptiveDecision.findUnique({where:{userId_targetStart:{userId,targetStart:state.targetStart}}})
    if (existing) return
    if (accept) for (const change of state.changes) {
      const result = await tx.planDay.updateMany({where:{id:change.dayId,weeklyPlan:{userId,startDate:state.targetStart}},data:{workoutId:change.workoutId,activity:change.activity}})
      if (result.count!==1) throw new Error("Planen har ändrats. Ladda om förslaget.")
    }
    await tx.adaptiveDecision.create({data:{userId,targetStart:state.targetStart,status:accept ? "accepted":"declined",summary:JSON.stringify(state)}})
  })
  return adaptiveStateForUser(userId)
}

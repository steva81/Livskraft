import type { PrismaClient } from "@prisma/client"
import { startOfWeekMonday } from "./plan-types"
import type { WorkoutCandidate } from "./training"
import { isFollowUp } from "./coach-conversation"
import { mealCompletionKeys } from "./meal-intake"

export type RecentCoachActivity = {
  today:string; weekStartsOn:string; from:string
  workouts:{date:string;title:string;type:string;exercises:string[]}[]
  workoutsTruncated:boolean
  steps:{date:string;steps:number|null}[]
  meals?:{date:string;registered:number}[]
  todayPlan:{status:"workout"|"rest"|"unknown";title?:string;type?:string}
}
export function calendarDate(date:Date):string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`
}
function exerciseNames(raw:string):string[] {
  try {
    const values = JSON.parse(raw)
    return Array.isArray(values) ? values.slice(0,6).flatMap(value=>typeof value?.name === "string" ? [value.name.slice(0,80)] : []) : []
  } catch {return []}
}
// Same calendar-day convention as actions.todayDate(), including DST boundaries.
export async function recentCoachActivity(userId:string,db:Pick<PrismaClient,"workoutLog"|"dailyLog"|"ownMeal">,plan:WorkoutCandidate|null|undefined,now=new Date()):Promise<RecentCoachActivity> {
  const today=new Date(now);today.setHours(0,0,0,0)
  const from=new Date(today);from.setDate(from.getDate()-6)
  const until=new Date(today);until.setDate(until.getDate()+1)
  const [workouts,logs,ownMeals]=await Promise.all([
    db.workoutLog.findMany({where:{userId,completed:true,date:{gte:from,lt:until}},orderBy:[{date:"desc"},{id:"desc"}],take:29,
      select:{date:true,workout:{select:{title:true,type:true,exercises:true}}}}),
    db.dailyLog.findMany({where:{userId,date:{gte:from,lt:until}},orderBy:{date:"asc"},take:7,select:{date:true,steps:true,stepsRecorded:true,mealsEaten:true}}),
    db.ownMeal.groupBy({by:["eatenAt"],where:{userId,eatenAt:{gte:from,lt:until}},_count:{_all:true}}),
  ])
  const steps=Array.from({length:7},(_,index)=>{
    const day=new Date(from);day.setDate(day.getDate()+index)
    const date=calendarDate(day),log=logs.find(log=>calendarDate(log.date)===date)
    return {date,steps:log && (log.stepsRecorded || log.steps>0) ? log.steps : null}
  })
  const meals=steps.map(({date})=>({date,registered:
    new Set(mealCompletionKeys(logs.find(log=>calendarDate(log.date)===date)?.mealsEaten)).size+
    ownMeals.filter(meal=>calendarDate(meal.eatenAt)===date).reduce((sum,meal)=>sum+meal._count._all,0)}))
  return {today:calendarDate(today),weekStartsOn:calendarDate(startOfWeekMonday(today)),from:calendarDate(from),steps,meals,
    workouts:workouts.slice(0,28).map(log=>({date:calendarDate(log.date),title:log.workout.title.slice(0,120),type:log.workout.type.slice(0,30),exercises:exerciseNames(log.workout.exercises)})),workoutsTruncated:workouts.length>28,
    todayPlan:plan ? {status:"workout",title:plan.title.slice(0,120),type:plan.type.slice(0,30)} : {status:plan===null?"rest":"unknown"}}
}
export function needsRecentActivity(input:string,history:{role:string;text:string}[]):boolean {
  const previous=history.filter(message=>message.role==="user").slice(-3).map(message=>message.text).join(" ")
  const activity=/trän|train|workout|exercise|bröst|\bben\b|rumpa|band|pass|överkropp|underkropp|chest|legs|steg|steps|måltid|mål mat|registrerat mat|meal|food log|igår|yesterday|imorgon|tomorrow|den här veckan|this week/i
  return activity.test(input) || (isFollowUp(input) && activity.test(previous))
}
export function recentActivityReply(input:string,activity:RecentCoachActivity,en:boolean):string|null {
  const training=/trän|workout|train|\bpass\b/i.test(input), meals=/måltid|mål mat|registrerat mat|meal|food log/i.test(input), steps=/steg|steps/i.test(input)
  const factual=/registr|logg|logged|hur (?:många|mycket|har)|how (?:many|much|have)|vad.*tränade|what.*train|vad har.*tränat|what have.*train|har jag|have i|veckan.*sett|week.*look/i.test(input)
  if (factual && (meals || /hur många pass|how many workouts/i.test(input) || [training,meals,steps].filter(Boolean).length>1 || (steps && /hur många|how many/i.test(input)))) {
    const inPeriod=(date:string)=>/igår|yesterday/i.test(input)?date===yesterday(activity.today):/\bidag\b|\btoday\b/i.test(input)?date===activity.today:/veck|week/i.test(input)?date>=activity.weekStartsOn:true
    const parts:string[]=[]
    if(training){const count=activity.workouts.filter(row=>inPeriod(row.date)).length;parts.push(en?`You have logged ${activity.workoutsTruncated?"at least ":""}${count} completed workouts.`:`Du har registrerat ${activity.workoutsTruncated?"minst ":""}${count} avklarade pass.`)}
    if(meals){const rows=activity.meals?.filter(row=>inPeriod(row.date));parts.push(rows?(en?`You have registered ${rows.reduce((sum,row)=>sum+row.registered,0)} meals.`:`Du har registrerat ${rows.reduce((sum,row)=>sum+row.registered,0)} måltider.`):(en?"Meal logs are unavailable.":"Måltidsregistreringarna är inte tillgängliga."))}
    if(steps){const rows=activity.steps.filter(row=>inPeriod(row.date)),known=rows.filter(row=>row.steps!==null);parts.push(!known.length?(en?"No steps are recorded for this period; the step count is unknown.":"Inga steg är registrerade för perioden; stegantalet är okänt."):en?`Recorded steps: ${known.reduce((sum,row)=>sum+row.steps!,0)} across ${known.length} recorded days. ${rows.length-known.length} days are unlogged/unknown.`:`Registrerade steg: ${known.reduce((sum,row)=>sum+row.steps!,0)} under ${known.length} registrerade dagar. ${rows.length-known.length} dagar saknar registrering och är okända.`)}
    const start=/igår|yesterday/i.test(input)?yesterday(activity.today):/\bidag\b|\btoday\b/i.test(input)?activity.today:/veck|week/i.test(input)?activity.weekStartsOn:activity.from
    const end=/igår|yesterday/i.test(input)?start:activity.today
    return (en?`Based only on Livskraft logs (${start}–${end}):`:`Baserat endast på Livskrafts registreringar (${start}–${end}):`)+"\n"+parts.join("\n")+(en?"\nUnlogged food and activity are unknown.":"\nOregistrerad mat och aktivitet är okända.")
  }
  if (/steg|steps/i.test(input) && /senaste|dagarna|recent|last.*days|igår|yesterday|veck|week/i.test(input)) {
    const rows=activity.steps.filter(row=>/igår|yesterday/i.test(input)?row.date===yesterday(activity.today):/veck|week/i.test(input)?row.date>=activity.weekStartsOn:true)
    return (en?"Logged steps (unlogged days are unknown):":"Registrerade steg (dagar utan registrering är okända):")+"\n"+rows.map(row=>`${row.date}: ${row.steps===null?(en?"not logged":"inte registrerat"):row.steps}`).join("\n")
  }
  if (!/vad.*tränade|what.*(?:train|workout)|vad har.*tränat|what have.*(?:train|workout)|registrerat.*träning|logged.*workout/i.test(input)) return null
  const rows=activity.workouts.filter(row=>/igår|yesterday/i.test(input) ? row.date===yesterday(activity.today) : /\bidag\b|\btoday\b/i.test(input) ? row.date===activity.today : /veck|week/i.test(input) ? row.date>=activity.weekStartsOn : true)
  if (!rows.length) return en?"There is no completed workout logged for that period. That does not mean you did not exercise; I only know what is logged.":"Det finns inget avklarat träningspass registrerat för den perioden. Det betyder inte att du inte tränade; jag känner bara till det som är registrerat."
  return (en?"Completed workouts logged:":"Registrerade avklarade pass:")+"\n"+rows.map(row=>`${row.date}: ${row.title}${row.exercises.length?` (${row.exercises.join(", ")})`:""}`).join("\n")+(activity.workoutsTruncated?(en?"\nOnly the most recent 28 entries are shown.":"\nEndast de senaste 28 registreringarna visas."):"")
}
function yesterday(today:string):string {
  const [year,month,day]=today.split("-").map(Number)
  const date=new Date(year,month-1,day);date.setDate(date.getDate()-1)
  return calendarDate(date)
}

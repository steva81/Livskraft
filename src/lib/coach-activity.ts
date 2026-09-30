import type { PrismaClient } from "@prisma/client"
import { startOfWeekMonday } from "./plan-types"
import type { WorkoutCandidate } from "./training"
import { isFollowUp } from "./coach-conversation"

export type RecentCoachActivity = {
  today:string; weekStartsOn:string; from:string
  workouts:{date:string;title:string;type:string;exercises:string[]}[]
  workoutsTruncated:boolean
  steps:{date:string;steps:number|null}[]
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
export async function recentCoachActivity(userId:string,db:Pick<PrismaClient,"workoutLog"|"dailyLog">,plan:WorkoutCandidate|null|undefined,now=new Date()):Promise<RecentCoachActivity> {
  const today=new Date(now);today.setHours(0,0,0,0)
  const from=new Date(today);from.setDate(from.getDate()-6)
  const until=new Date(today);until.setDate(until.getDate()+1)
  const [workouts,logs]=await Promise.all([
    db.workoutLog.findMany({where:{userId,completed:true,date:{gte:from,lt:until}},orderBy:[{date:"desc"},{id:"desc"}],take:29,
      select:{date:true,workout:{select:{title:true,type:true,exercises:true}}}}),
    db.dailyLog.findMany({where:{userId,date:{gte:from,lt:until}},orderBy:{date:"asc"},take:7,select:{date:true,steps:true,stepsRecorded:true}}),
  ])
  const steps=Array.from({length:7},(_,index)=>{
    const day=new Date(from);day.setDate(day.getDate()+index)
    const date=calendarDate(day),log=logs.find(log=>calendarDate(log.date)===date)
    return {date,steps:log && (log.stepsRecorded || log.steps>0) ? log.steps : null}
  })
  return {today:calendarDate(today),weekStartsOn:calendarDate(startOfWeekMonday(today)),from:calendarDate(from),steps,
    workouts:workouts.slice(0,28).map(log=>({date:calendarDate(log.date),title:log.workout.title.slice(0,120),type:log.workout.type.slice(0,30),exercises:exerciseNames(log.workout.exercises)})),workoutsTruncated:workouts.length>28,
    todayPlan:plan ? {status:"workout",title:plan.title.slice(0,120),type:plan.type.slice(0,30)} : {status:plan===null?"rest":"unknown"}}
}
export function needsRecentActivity(input:string,history:{role:string;text:string}[]):boolean {
  const previous=history.filter(message=>message.role==="user").slice(-3).map(message=>message.text).join(" ")
  const activity=/trän|train|workout|exercise|bröst|\bben\b|överkropp|underkropp|chest|legs|steg|steps|igår|yesterday|imorgon|tomorrow|den här veckan|this week/i
  return activity.test(input) || (isFollowUp(input) && activity.test(previous))
}
export function recentActivityReply(input:string,activity:RecentCoachActivity,en:boolean):string|null {
  if (/steg|steps/i.test(input) && /senaste|dagarna|recent|last.*days|igår|yesterday|veck|week/i.test(input)) {
    const rows=activity.steps.filter(row=>!/igår|yesterday/i.test(input)||row.date===yesterday(activity.today))
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

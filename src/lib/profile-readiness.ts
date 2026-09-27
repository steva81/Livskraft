import { readPreferences } from "./preferences"
export const readinessLabels = {
  sv: { currentWeight:"Nuvarande vikt",height:"Längd",goal:"Huvudmål",activity:"Aktivitetsnivå",training:"Träningsnivå",location:"Träningsplats",confirmation:"Bekräfta dina vardags- och planeringsval" },
  en: { currentWeight:"Current weight",height:"Height",goal:"Primary goal",activity:"Activity level",training:"Training level",location:"Training location",confirmation:"Confirm your daily-life and planning choices" },
}
export type ReadinessProfile = { currentWeight?:number|null;height?:number|null;activityLevel?:string|null;trainingLevel?:string|null;trainingLocation?:string|null;preferences:string|null }
export function profileReadiness(user:ReadinessProfile) {
  const p=readPreferences(user.preferences),missing:(keyof typeof readinessLabels.sv)[]=[]
  if (!user.currentWeight || user.currentWeight<30 || user.currentWeight>400) missing.push("currentWeight")
  if (!user.height || user.height<100 || user.height>250) missing.push("height")
  if (!p.primaryGoal) missing.push("goal")
  if (!["sedentary","light","moderate","active","very_active"].includes(user.activityLevel??"")) missing.push("activity")
  if (!["beginner","intermediate","advanced"].includes(user.trainingLevel??"")) missing.push("training")
  if (!["home","gym","both"].includes(user.trainingLocation??"")) missing.push("location")
  if (p.planningConfirmed!==true) missing.push("confirmation")
  return {ready:missing.length===0,missing}
}
export function welcomeGreeting(name:string|null|undefined,first:boolean,en=false) {
  const firstName=name?.trim().split(/\s+/)[0]
  const greeting=en?(first?"Welcome to Livskraft":"Welcome back"):(first?"Välkommen till Livskraft":"Välkommen tillbaka")
  return `${greeting}${firstName?`, ${firstName}`:""}!`
}

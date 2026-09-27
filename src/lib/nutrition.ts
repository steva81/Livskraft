import { profileReadiness } from "./profile-readiness"
import { readPreferences } from "./preferences"
import { savedGoalSafety } from "./goal-safety"
import { ageFromBirthYear } from "./body-data"

export const primaryGoals = ["lose", "maintain", "retain-muscle", "build-muscle"] as const
export type PrimaryGoal = typeof primaryGoals[number]
export const goalLabels = {
  sv: { lose: "Gå ner i vikt", maintain: "Behålla vikten", "retain-muscle": "Behålla vikt och muskelmassa", "build-muscle": "Bygga muskler" },
  en: { lose: "Lose weight", maintain: "Maintain weight", "retain-muscle": "Maintain weight and muscle mass", "build-muscle": "Build muscle" },
}
type Profile = { trainingLevel?: string | null; trainingLocation?: string | null; preferences: string | null; currentWeight: number | null; height?: number | null; activityLevel?: string | null; targetWeight?: number | null; timeframeWeeks?: number | null }
export function primaryGoal(user: Profile): PrimaryGoal {
  const p = readPreferences(user.preferences)
  return p.primaryGoal ?? (user.targetWeight != null && user.currentWeight != null ? user.targetWeight < user.currentWeight ? "lose" : user.targetWeight > user.currentWeight ? "build-muscle" : "maintain" : "maintain")
}
export function nutritionTarget(user: Profile, recentSteps?: number) {
  const p = readPreferences(user.preferences), goal = primaryGoal(user), weight = user.currentWeight
  if (!profileReadiness(user).ready || !weight || weight < 30 || weight > 250 || savedGoalSafety(user)?.level === "blocked") return null
  // Mifflin–St Jeor requires age, height and physiological sex coefficient.
  // Without these, 30 kcal/kg is only a broad planning heuristic, not a BMR formula.
  const age = ageFromBirthYear(p.birthYear)
  const baseline = age !== null && (p.sexForEnergy === "male" || p.sexForEnergy === "female") && user.height ? 10 * weight + 6.25 * user.height - 5 * age + (p.sexForEnergy === "male" ? 5 : -161) : null
  const activityFactor = ({ sedentary: 1.3, light: 1.45, moderate: 1.6, active: 1.75, very_active:1.85 } as Record<string, number>)[user.activityLevel ?? ""] ?? 1.45
  // Blend overlapping indicators rather than adding exercise calories on top.
  const steps = recentSteps ?? p.dailySteps
  const movementFactor = Math.min(1.85,1.25 + Math.min(15000,Math.max(0,steps))/30000 + p.trainingDays*0.02)
  const factor = activityFactor*0.75 + movementFactor*0.25
  const maintenance = Math.round((baseline ? baseline * factor : weight * 30 * factor/1.45) / 50) * 50
  if (maintenance < 1500) return null
  const adjustment = goal === "lose" ? -Math.min(300, maintenance * 0.1) : goal === "build-muscle" ? Math.min(200, maintenance * 0.05) : 0
  const calories = Math.max(Math.ceil(Math.max(1500, baseline ?? 0)/50)*50, Math.round((maintenance + adjustment)/50)*50)
  const protein = Math.round(weight * (goal === "maintain" ? 1.2 : 1.6))
  const fat = Math.round(calories * 0.3 / 9)
  return { goal, age, confidence: baseline===null?"lower" as const:"higher" as const, activityFactor:factor, baseline: baseline === null ? null : Math.round(baseline), maintenance, calories, protein, fat, carbs: Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4)), method: baseline === null ? "weight-heuristic" : "mifflin-st-jeor", estimated: true as const }
}
export type Nutrition = { calories: number | null; protein: number | null; carbs: number | null; fat: number | null; fibre: number | null }
export function parseNutrition(raw: string | null): Nutrition {
  let value: Record<string, unknown> = {}
  try { value = JSON.parse(raw ?? "{}") ?? {} } catch { /* unknown stays unknown */ }
  return Object.fromEntries(["calories", "protein", "carbs", "fat", "fibre"].map(key => [key, typeof value[key] === "number" && Number.isFinite(value[key]) && Number(value[key]) >= 0 ? value[key] : null])) as Nutrition
}
export function totalNutrition(values: Nutrition[]) {
  const sum = { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 }
  const unknown = { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 }
  for (const value of values) for (const key of Object.keys(sum) as (keyof Nutrition)[]) {
    if (value[key] === null) unknown[key]++; else sum[key] += value[key]!
  }
  return { sum, unknown, count: values.length }
}
export function goalGuidance(goal: PrimaryGoal, en = false): string {
  const text = {
    lose: ["Följ en lugn vikttrend, behåll regelbundna måltider, protein och återhämtning.", "Follow a gradual weight trend, with regular meals, protein and recovery."],
    maintain: ["Stabil vikt är målet. Mer viktnedgång är inte bättre.", "Stable weight is the goal. More weight loss is not better."],
    "retain-muscle": ["Prioritera stabil vikt, protein, regelbunden styrketräning och återhämtning.", "Prioritize stable weight, protein, regular resistance training and recovery."],
    "build-muscle": ["Ett litet energiöverskott, protein och gradvis progression i styrketräningen stödjer målet. Följ även mått och återhämtning.", "A small energy surplus, protein and gradual strength progression support your goal. Track measurements and recovery too."],
  }
  return text[goal][en ? 1 : 0]
}

export function weightTrend(logs: { date: Date; weight: number | null }[]) {
  const values = logs.filter(l => l.weight !== null).sort((a,b) => +a.date - +b.date)
  if (values.length < 6 || +values.at(-1)!.date - +values[0].date < 14 * 86400000) return null
  const mid = Math.floor(values.length / 2), first = values.slice(0, mid), last = values.slice(mid)
  const average = (rows: typeof values) => rows.reduce((n,l) => n + l.weight!, 0) / rows.length
  const meanDate = (rows: typeof values) => rows.reduce((n,l)=>n + +l.date,0)/rows.length
  return { change: average(last) - average(first), weeklyChange:(average(last)-average(first))*7*86400000/(meanDate(last)-meanDate(first)), days: Math.round((+values.at(-1)!.date - +values[0].date) / 86400000) }
}
export function progressGuidance(goal:PrimaryGoal,change:number|null,en=false) {
  if(change===null)return en?"More measurements across two weeks are needed before interpreting a trend.":"Fler mätningar över två veckor behövs innan vi tolkar trenden."
  if(goal==="maintain"||goal==="retain-muscle")return Math.abs(change)<0.5?(en?"Weight is broadly stable, consistent with your goal.":"Vikten är ungefär stabil, i linje med ditt mål."):(en?"Weight is moving away from stability. Review the longer trend, meals and recovery; no automatic restriction.":"Vikten rör sig från stabilitet. Granska den längre trenden, maten och återhämtningen; ingen automatisk begränsning.")
  if(goal==="build-muscle")return en?"Some weight gain can fit muscle building. It does not prove muscle gain: also follow measurements, training consistency and recovery.":"En viss viktuppgång kan passa muskelbygge. Den bevisar inte ökad muskelmassa: följ också mått, träningskontinuitet och återhämtning."
  return en?"Follow gradual changes over time. A single weight reading does not call for eating less or training more.":"Följ lugna förändringar över tid. En enskild vägning innebär inte att du behöver äta mindre eller träna mer."
}

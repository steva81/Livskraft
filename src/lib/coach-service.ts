import { parseStringList, recipeMeetsConstraints } from "./dietary"
import { displayValue } from "./display"
import { workoutFits, workoutInstructions, type WorkoutCandidate } from "./training"

type CoachRecipe = { id:string; title:string; ingredients:string; tags:string; prepTime:number }
export interface CoachContext {
  userName:string; restrictions:string[]; dislikedFoods:string[]; stepGoal:number; stepsToday?:number
  todayMeals:string[]; todayWorkout:string|null; completedWorkoutsThisWeek:number
  safeAlternatives?:string[]
  recipes?:CoachRecipe[]
  plannedMeals?:{slot:string;recipeId:string;title:string;completed:boolean}[]
  workouts?:WorkoutCandidate[]; trainingLevel?:string; trainingLocation?:string; homeEquipment?:string; workoutMinutes?:number
  likedFoods?:string; activity?:string|null
}

type Intent = "medical"|"compensation"|"missing"|"timed-training"|"missed"|"restaurant"|"food"|"steps"|"training"|"motivation"|"general"
export function coachIntent(input:string):Intent {
  const text=input.toLowerCase()
  if (/insulin|medicin|läkemedel|diagnos|diabet/.test(text)) return "medical"
  if (/stor måltid|åt för mycket|överåt|kompensera|fasta|svält/.test(text)) return "compensation"
  if (/(?:ingen|inga|inget|saknar|slut på)\s/.test(text) && !/tid|träna|gym|pass/.test(text)) return "missing"
  if (/\d+\s*(?:minut|min\b)/.test(text) && /träna|träning|pass|gym|hemma/.test(text)) return "timed-training"
  if (/hann inte|missat|missade|hinner inte/.test(text) && /träna|träning|pass|gym/.test(text)) return "missed"
  if (/restaurang|äta ute/.test(text)) return "restaurant"
  if (/vad kan jag äta|vad ska jag äta|laga mat|måltid|hungrig/.test(text)) return "food"
  if (/steg|promenad/.test(text)) return "steps"
  if (/träna|träning|gym|pass/.test(text)) return "training"
  if (/motivat/.test(text)) return "motivation"
  return "general"
}

export function missingIngredients(input:string):string[] {
  const match=input.toLowerCase().match(/(?:ingen|inga|inget|saknar|slut på)\s+(.+)/)
  if (!match) return []
  return match[1].split(/\b(?:hemma|idag|just nu|kan jag|vad kan)\b|[.!?]/)[0]
    .split(/,|\boch\b|\beller\b/).map(s=>s.trim().replace(/^någon?\s+/,"")).filter(Boolean)
}

function safeRecipes(ctx:CoachContext) {
  const likes=(ctx.likedFoods??"").toLowerCase().split(",").map(s=>s.trim()).filter(Boolean)
  return (ctx.recipes??[]).filter(r=>recipeMeetsConstraints(r,ctx.restrictions,ctx.dislikedFoods))
    .sort((a,b)=>likes.filter(l=>b.ingredients.toLowerCase().includes(l)).length-likes.filter(l=>a.ingredients.toLowerCase().includes(l)).length)
}

export function buildSystemPrompt():string {
  return "Klassificera frågan. Svara endast med food, training, restaurant, steps eller general. Ge inga egna råd."
}

async function classifyExternally(input:string):Promise<Intent|null> {
  const key=process.env.AI_API_KEY
  const endpoint=process.env.AI_API_URL
  if (process.env.AI_COACH_LIVE_ENABLED!=="true" || !key || !endpoint) return null
  try {
    const response=await fetch(endpoint,{method:"POST",signal:AbortSignal.timeout(8000),headers:{"Content-Type":"application/json",Authorization:`Bearer ${key}`},body:JSON.stringify({model:process.env.AI_API_MODEL||"gpt-4o-mini",messages:[{role:"system",content:buildSystemPrompt()},{role:"user",content:input}]})})
    if (!response.ok) return null
    const data=await response.json() as {choices?:{message?:{content?:string}}[]}
    const value=data.choices?.[0]?.message?.content?.trim()
    return value && ["food","training","restaurant","steps","general"].includes(value) ? value as Intent : null
  } catch { return null }
}

export async function getCoachReply(input:string,ctx:CoachContext):Promise<string> {
  let intent=coachIntent(input)
  // Preserve explicit intent and ingredient/time details even if an external classifier is enabled.
  if (intent==="general") intent=await classifyExternally(input)??intent
  const recipes=safeRecipes(ctx)
  const empty="Jag hittar inget kontrollerat recept som passar just nu. Jag föreslår inget osäkert byte. Kontrollera ingredienser och allergenmärkning innan du väljer mat."
  if (intent==="medical") return "Jag kan hjälpa med allmän måltidsplanering, men inte diagnos eller läkemedelsdosering. Ta sådana frågor med din vårdkontakt."
  if (intent==="compensation") return "Återgå till din vanliga plan vid nästa måltid. Du behöver inte hoppa över mat eller lägga till extra träning."
  if (intent==="missing") {
    const unavailable=missingIngredients(input)
    const alternative=recipes.find(r=>unavailable.every(word=>!`${r.title} ${parseStringList(r.ingredients).join(" ")}`.toLowerCase().includes(word)))
    return unavailable.length && alternative ? `Inga problem, ${ctx.userName}. Utan ${unavailable.join(" och ")} kan du välja ${alternative.title} (${alternative.prepTime} min). Receptet passerar dina kostfilter. Se ingredienser och steg under Recept.` : empty
  }
  if (intent==="timed-training" || intent==="training") {
    const requested=Number(input.match(/(\d+)\s*(?:minut|min\b)/i)?.[1]??ctx.workoutMinutes??20)
    const location=/hemma|hemmapass/.test(input.toLowerCase()) ? "home" : /gym/.test(input.toLowerCase()) ? "gym" : ctx.trainingLocation??"both"
    const candidates=(ctx.workouts??[]).filter(w=>(location==="both"||w.type===location) && workoutFits(w,ctx.trainingLevel??"beginner",ctx.homeEquipment??"kroppsvikt",Math.min(requested,ctx.workoutMinutes??120)))
      .sort((a,b)=>b.duration-a.duration || Number(b.title===ctx.todayWorkout)-Number(a.title===ctx.todayWorkout))
    const workout=candidates[0]
    if (!workout) return `Jag hittar inget pass som matchar din nivå, plats och tid på ${requested} minuter. Välj återhämtning eller se andra alternativ under Träning; inget extra pass behövs senare.`
    return `${ctx.userName}, välj ${workout.title}: ungefär ${workout.duration} minuter, ${displayValue(workout.type).toLowerCase()}, ${displayValue(workout.level).toLowerCase()}. ${workoutInstructions(workout)}. Vila mellan seten och anpassa tempot. Öppna Träning för att registrera passet.`
  }
  if (intent==="missed") {
    const walk=(ctx.stepsToday??0)<ctx.stepGoal ? " Om det känns skönt kan du ta en kort, lugn promenad för frisk luft. Det är helt frivilligt, inte kompensation." : " Du har redan nått ditt stegmål; vila gärna om du vill."
    return `Det händer, ${ctx.userName}. Ett missat pass är ingen katastrof och du behöver inte ta igen det. Du kan välja ett kort pass på din nivå eller vänta till nästa planerade pass.${walk}`
  }
  if (intent==="restaurant") {
    const profile=ctx.restrictions.map(displayValue).join(", ")
    const lactose=ctx.restrictions.includes("lactose-free") ? " Fråga efter laktosfria alternativ och vad såserna innehåller." : " Fråga vad rätten och såserna innehåller."
    return `Njut av middagen, ${ctx.userName}!${profile ? ` Din kostprofil: ${profile}.` : ""}${ctx.dislikedFoods.length ? ` Be att få slippa ${ctx.dislikedFoods.join(", ")}.` : ""}${lactose} Berätta om eventuella allergier och kontrollera innehållet med restaurangen. Fortsätt med din vanliga plan efteråt; ingen kompensation behövs.`
  }
  if (intent==="food") {
    const remaining=(ctx.plannedMeals??[]).find(m=>!m.completed && recipes.some(r=>r.id===m.recipeId))
    if (remaining) return `Nästa oavklarade måltid i din plan är ${remaining.slot.toLowerCase()}: ${remaining.title}. Öppna Recept för tillagningen och markera måltiden klar på Idag när du ätit. Anpassa tidpunkten efter hunger och din vakna tid.`
    if (!recipes.length) return empty
    return `Du har ingen oavklarad måltid i dagens plan. Om du är hungrig finns ${recipes[0].title} bland dina filtrerade recept. Se Recept för innehåll och tillagning.`
  }
  if (intent==="steps") return `Du har ${(ctx.stepsToday??0).toLocaleString("sv-SE")} av ditt personliga mål ${ctx.stepGoal.toLocaleString("sv-SE")} steg idag. ${ctx.activity??"Välj gärna en behaglig promenad om du vill."} Inga missade steg behöver tas igen.`
  if (intent==="motivation") return `Varje litet steg räknas, ${ctx.userName}. Välj en sak som känns möjlig idag och fortsätt därifrån.`
  return `Berätta gärna vad du behöver, ${ctx.userName}: ett matalternativ, ett pass som ryms i tiden eller hjälp när dagen ändras?`
}

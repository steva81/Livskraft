"use client"
import Link from "next/link"
import {primaryGoals,goalLabels,type PrimaryGoal} from "@/lib/nutrition"
import {readPreferences} from "@/lib/preferences"
import {useLanguage,Localize} from "@/lib/i18n/provider"
import {useEffect,useState} from "react"
import {getUser,updateWeightGoal,type PublicUser} from "@/app/actions"
import {assessGoal,timeframeOptions} from "@/lib/goal-safety"
import {Button} from "@/components/ui/button"
export function GoalEditor({user,onSaved}:{user:PublicUser;onSaved:(user:PublicUser)=>void}) {
 const {language}=useLanguage(),en=language==="en"
 const [goal,setGoal]=useState<PrimaryGoal|"">(readPreferences(user.preferences).primaryGoal??"")
 const [target,setTarget]=useState(String(user.targetWeight??"")),[weeks,setWeeks]=useState(String(user.timeframeWeeks??""))
 const [message,setMessage]=useState(""),[saving,setSaving]=useState(false)
 useEffect(()=>{setGoal(readPreferences(user.preferences).primaryGoal??"");setTarget(String(user.targetWeight??""));setWeeks(String(user.timeframeWeeks??""))},[user])
 const changing=goal==="lose"||(goal==="build-muscle"&&(target!==""||weeks!==""))
 const safety=changing?assessGoal({currentWeight:user.currentWeight,targetWeight:target,timeframeWeeks:weeks}):null
 return <Localize><form className="wellness-panel space-y-4 p-5 sm:p-6" onSubmit={async e=>{
 e.preventDefault();if(!goal)return;setSaving(true);setMessage("")
 try {const result=await updateWeightGoal({primaryGoal:goal,targetWeight:target?Number(target):null,timeframeWeeks:weeks?Number(weeks):null});if(!result.success){setMessage(result.error);return}const updated=await getUser();if(updated)onSaved(updated);setMessage("Målet har sparats.")}catch{setMessage("Kunde inte spara målet. Försök igen.")}finally{setSaving(false)}
 }}>
 <h2 className="font-semibold">{en?"Your goal":"Ditt mål"}</h2>
 <p data-localize="off" className="text-sm">{en?"Current weight":"Nuvarande vikt"}: {user.currentWeight??"—"} kg · <Link className="underline" href="#body">{en?"Edit in Body and baseline data":"Ändra under Kropp och grunddata"}</Link></p>
 <label className="block text-sm">{en?"Primary goal":"Huvudmål"}<select required className="mt-1 w-full rounded border p-2" value={goal} onChange={e=>{setGoal(e.target.value as PrimaryGoal);setTarget("");setWeeks("")}}><option value="">{en?"Choose a goal…":"Välj mål…"}</option>{primaryGoals.map(g=><option key={g} value={g}>{goalLabels[language][g]}</option>)}</select></label>
 {(goal==="maintain"||goal==="retain-muscle")&&<p data-localize="off">{goal==="maintain"?(en?"Focus on a stable weight. No weight-loss target or deadline is needed.":"Fokus på stabil vikt. Inget viktminskningsmål eller slutdatum behövs."):(en?"Focus on stable weight, strength training and protein.":"Fokus på stabil vikt, styrketräning och protein.")}</p>}
 {(goal==="lose"||goal==="build-muscle")&&<div className="grid gap-3 sm:grid-cols-2" data-localize="off">
 <label className="text-sm">{goal==="build-muscle"?(en?"Gain target (kg, optional)":"Målvikt vid ökning (kg, frivilligt)"):(en?"Target weight (kg)":"Målvikt (kg)")}<input required={goal==="lose"} className="mt-1 w-full rounded border p-2" type="number" min="30" max="400" step="any" value={target} onChange={e=>setTarget(e.target.value)}/></label>
 <label className="text-sm">{en?"Timeframe":"Tidsram"}<select required={changing} className="mt-1 w-full rounded border p-2" value={weeks} onChange={e=>setWeeks(e.target.value)}><option value="">{en?"Choose…":"Välj…"}</option>{weeks&&!timeframeOptions.some(o=>o.weeks===Number(weeks))&&<option value={weeks}>{weeks} {en?"weeks":"veckor"}</option>}{timeframeOptions.map(o=><option key={o.weeks} value={o.weeks}>{en?o.weeks+(o.weeks===1?" week":" weeks"):o.label}</option>)}</select></label>
 {goal==="build-muscle"&&<p className="text-sm sm:col-span-2">{en?"You can start without a gain target. If you add one, choose a sensible timeframe too.":"Du kan börja utan mål för viktökning. Om du anger ett mål väljer du också en rimlig tidsram."}</p>}
 </div>}
 {safety?.message&&<p role="alert" className="rounded bg-amber-50 p-3 text-sm">{safety.message}</p>}{message&&<p role="status">{message}</p>}
 <Button type="submit" disabled={saving||!goal||safety?.level==="blocked"}>{saving?"Sparar…":"Spara mål"}</Button>
 </form></Localize>
}

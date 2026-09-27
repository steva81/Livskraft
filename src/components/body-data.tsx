"use client"
import { useEffect, useState } from "react"
import { bodyLabels, type BodyData } from "@/lib/body-data"
import { readPreferences } from "@/lib/preferences"
import { useLanguage } from "@/lib/i18n/provider"
import { saveBodyData } from "@/app/nutrition-actions"
import { getUser, type PublicUser } from "@/app/actions"
import { Button } from "./ui/button"
export function BirthInputs({value,onChange}:{value:BodyData;onChange:(value:BodyData)=>void}) {
  const {language}=useLanguage(), labels=bodyLabels[language]
  return <div className="space-y-3" data-localize="off"><p className="text-sm">{labels.explanation}</p><div className="grid gap-3 sm:grid-cols-2"><label>{labels.year}<input className="w-full border rounded p-2" type="number" min={new Date().getFullYear()-100} max={new Date().getFullYear()-18} value={value.birthYear??""} onChange={e=>onChange({...value,birthYear:e.target.value?Number(e.target.value):undefined})}/></label><label>{labels.sex}<select className="w-full border rounded p-2" value={value.sexForEnergy??"undisclosed"} onChange={e=>onChange({...value,sexForEnergy:e.target.value as BodyData["sexForEnergy"]})}>{(["undisclosed","male","female"] as const).map(key=><option key={key} value={key}>{labels[key]}</option>)}</select></label></div></div>
}
export function BodyDataEditor({user,onSaved}:{user:PublicUser;onSaved:(user:PublicUser)=>void}) {
  const {language}=useLanguage(), labels=bodyLabels[language], en=language==="en"
  const [body,setBody]=useState<BodyData>(readPreferences(user.preferences)),[height,setHeight]=useState(String(user.height??"")),[weight,setWeight]=useState(String(user.currentWeight??""))
  useEffect(()=>{setBody(readPreferences(user.preferences));setHeight(String(user.height??""));setWeight(String(user.currentWeight??""))},[user.preferences,user.height,user.currentWeight])
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("")
  return <form id="body" className="rounded-lg border p-4 space-y-4" data-localize="off" onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage("");try{await saveBodyData({birthYear:body.birthYear,sexForEnergy:body.sexForEnergy,height:height?Number(height):null,currentWeight:weight?Number(weight):null});const updated=await getUser();if(updated)onSaved(updated);setMessage(en?"Baseline data saved.":"Grunddata sparade.")}catch(e){setMessage(e instanceof Error?e.message:en?"Could not save.":"Kunde inte spara.")}finally{setBusy(false)}}}>
    <h2 className="text-xl font-semibold">{labels.title}</h2><BirthInputs value={body} onChange={setBody}/>
    <div className="grid gap-3 sm:grid-cols-2"><label>{labels.height}<input className="w-full border rounded p-2" type="number" min="100" max="250" step="any" value={height} onChange={e=>setHeight(e.target.value)}/></label><label>{labels.weight}<input className="w-full border rounded p-2" type="number" min="30" max="400" step="any" value={weight} onChange={e=>setWeight(e.target.value)}/></label></div>
    <p className="text-sm">{en?"Optional adult planning data. Without weight, no numerical energy target is shown. Changing weight may require reviewing your weight goal.":"Frivilliga grunddata för vuxnas planering. Utan vikt visas inget numeriskt energimål. Ändrad vikt kan kräva att du granskar viktmålet."}</p>
    <Button disabled={busy}>{en?"Save baseline data":"Spara grunddata"}</Button><p role="status">{message}</p>
  </form>
}

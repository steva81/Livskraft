"use client"
import { useEffect, useState } from "react"
import { bodyLabels, type BodyData } from "@/lib/body-data"
import Link from "next/link"
import { readPreferences, measurementLabels, type MeasurementKey } from "@/lib/preferences"
import { useLanguage } from "@/lib/i18n/provider"
import { saveBodyData, getBodyMeasurements } from "@/app/nutrition-actions"
import { getUser, type PublicUser } from "@/app/actions"
import { Button } from "./ui/button"
export function BirthInputs({value,onChange}:{value:BodyData;onChange:(value:BodyData)=>void}) {
  const {language}=useLanguage(), labels=bodyLabels[language]
  return <div className="space-y-3" data-localize="off"><p className="text-sm">{language==="en"?"Used only to improve the energy estimate.":"Används endast för att förbättra energiuppskattningen."}</p><details><summary className="cursor-pointer text-sm underline">{language==="en"?"Why do we ask?":"Varför frågar vi?"}</summary><p className="mt-2 text-sm">{labels.explanation}</p></details><div className="grid gap-3 sm:grid-cols-2"><label>{labels.year}<input className="w-full border rounded p-2" type="number" min={new Date().getFullYear()-100} max={new Date().getFullYear()-18} value={value.birthYear??""} onChange={e=>onChange({...value,birthYear:e.target.value?Number(e.target.value):undefined})}/></label><label>{labels.sex}<select className="w-full border rounded p-2" value={value.sexForEnergy??"undisclosed"} onChange={e=>onChange({...value,sexForEnergy:e.target.value as BodyData["sexForEnergy"]})}>{(["undisclosed","male","female"] as const).map(key=><option key={key} value={key}>{labels[key]}</option>)}</select></label></div></div>
}
export function BodyDataEditor({user,onSaved}:{user:PublicUser;onSaved:(user:PublicUser)=>void}) {
  const {language}=useLanguage(), labels=bodyLabels[language], en=language==="en"
  const [body,setBody]=useState<BodyData>(readPreferences(user.preferences)),[height,setHeight]=useState(String(user.height??"")),[weight,setWeight]=useState(String(user.currentWeight??""))
  useEffect(()=>{setBody(readPreferences(user.preferences));setHeight(String(user.height??""));setWeight(String(user.currentWeight??""))},[user.preferences,user.height,user.currentWeight])
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("")
  const [tracked,setTracked]=useState(readPreferences(user.preferences).trackedMeasurements),[waist,setWaist]=useState(String(user.waist??"")),[values,setValues]=useState<Partial<Record<MeasurementKey,string>>>({}),[loaded,setLoaded]=useState(false)
  useEffect(()=>{let active=true;getBodyMeasurements().then(saved=>{if(active){setValues(Object.fromEntries(Object.entries(saved).map(([key,value])=>[key,String(value)])));setLoaded(true)}}).catch(()=>{if(active)setMessage(en?"Could not load measurements. Reload before saving.":"Kunde inte läsa måtten. Ladda om före sparande.")});return()=>{active=false}},[user.id,en])
  const names={hip:en?"Hip":"Höft",chest:en?"Chest":"Bröst",thigh:en?"Thigh":"Lår",arm:en?"Upper arm":"Överarm",neck:en?"Neck":"Hals",calf:en?"Calf":"Vad"}
  return <form id="body" className="wellness-panel p-5 sm:p-6 space-y-4" data-localize="off" onSubmit={async e=>{e.preventDefault();if(!loaded||busy)return;setBusy(true);setMessage("");try{await saveBodyData({birthYear:body.birthYear,sexForEnergy:body.sexForEnergy,height:height?Number(height):null,currentWeight:weight?Number(weight):null,waist:waist?Number(waist):undefined,trackedMeasurements:tracked,values:Object.fromEntries(tracked.flatMap(key=>values[key]?.trim()?[[key,Number(values[key])]]:[]))});const updated=await getUser();if(updated)onSaved(updated);setMessage(en?"Body data and measurements saved.":"Kropp och mått sparade.")}catch(e){setMessage(e instanceof Error?e.message:en?"Could not save.":"Kunde inte spara.")}finally{setBusy(false)}}}>
    <h2 className="text-xl font-semibold">{labels.title}</h2><fieldset disabled={busy||!loaded} className="space-y-4"><BirthInputs value={body} onChange={setBody}/>
    <div className="grid gap-3 sm:grid-cols-2"><label>{labels.height}<input className="w-full border rounded p-2" type="number" min="100" max="250" step="any" value={height} onChange={e=>setHeight(e.target.value)}/></label><label>{labels.weight}<input className="w-full border rounded p-2" type="number" min="30" max="400" step="any" value={weight} onChange={e=>setWeight(e.target.value)}/></label></div>
    <p className="text-sm">{en?"Weight and height are needed for your personal plan. Birth year and sex for calculation are optional.":"Vikt och längd behövs för din personliga plan. Födelseår och kön för beräkning är frivilliga."}</p>
    <section id="measurements" className="space-y-3"><h3 className="font-semibold">{en?"Body measurements":"Kroppsmått"}</h3>
      <label className="block">{en?"Waist (cm)":"Midja (cm)"}<input className="w-full min-w-0 border rounded p-2" type="number" min="30" max="250" step="any" value={waist} onChange={e=>setWaist(e.target.value)}/></label>
      <details><summary className="cursor-pointer py-3 text-sm">{en?"+ Add / hide body measurements":"+ Lägg till / dölj kroppsmått"}</summary><div className="flex flex-wrap gap-4">{(Object.keys(measurementLabels) as MeasurementKey[]).map(key=><label key={key} className="flex min-h-11 gap-2 items-center"><input type="checkbox" checked={tracked.includes(key)} onChange={e=>setTracked(e.target.checked?[...tracked,key]:tracked.filter(value=>value!==key))}/>{names[key]}</label>)}</div></details>
      <div className="grid gap-3 sm:grid-cols-2">{(Object.keys(measurementLabels) as MeasurementKey[]).filter(key=>tracked.includes(key)).map(key=><label key={key}>{names[key]} (cm)<input className="w-full min-w-0 border rounded p-2" type="number" min="1" max="250" step="any" value={values[key]??""} onChange={e=>setValues({...values,[key]:e.target.value})}/></label>)}</div>
      <p className="text-sm">{en?"Values are saved to today's history. Empty or hidden measurements leave history unchanged.":"Värden sparas i dagens historik. Tomma eller dolda mått ändrar inte tidigare historik."}</p><Link href="/progress" className="underline">{en?"View history in Progress":"Visa historik i Framsteg"}</Link>
    </section>
    <Button disabled={busy||!loaded}>{en?"Save body data and measurements":"Spara kropp och mått"}</Button></fieldset><p role="status">{message}</p>
  </form>
}

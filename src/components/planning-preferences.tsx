"use client"
import { Localize } from "@/lib/i18n/provider"

import { useState } from "react"
import { healthOptions, mealSlots, measurementLabels, readMeasurements, type Preferences, type MeasurementKey, type MealSlot } from "@/lib/preferences"
import { savePreferences } from "@/app/actions"
import { Button } from "./ui/button"

export function SlotChoices({value,onChange,disabled=false}:{value:MealSlot[];onChange:(value:MealSlot[])=>void;disabled?:boolean}) {
  return <Localize>{<div className="flex flex-wrap gap-x-4 gap-y-1">{mealSlots.map(slot=><label key={slot} className="flex min-h-11 items-center gap-2 text-sm"><input disabled={disabled} type="checkbox" checked={value.includes(slot)} onChange={e=>onChange(e.target.checked?[...value,slot]:value.filter(s=>s!==slot))}/>{slot}</label>)}</div>}</Localize>
}
export function MeasurementChoices({value,onChange}:{value:MeasurementKey[];onChange:(value:MeasurementKey[])=>void}) {
  return <Localize>{<details><summary className="cursor-pointer py-3 text-sm">+ Lägg till övriga kroppsmått</summary><div className="flex flex-wrap gap-4">{(Object.keys(measurementLabels) as MeasurementKey[]).map(key=><label key={key} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={value.includes(key)} onChange={e=>onChange(e.target.checked?[...value,key]:value.filter(k=>k!==key))}/>{measurementLabels[key]}</label>)}</div></details>}</Localize>
}
export function MeasurementInputs({tracked,values,onChange}:{tracked:MeasurementKey[];values:Partial<Record<MeasurementKey,number>>;onChange:(values:Partial<Record<MeasurementKey,number>>)=>void}) {
  return <Localize>{<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{(Object.keys(measurementLabels) as MeasurementKey[]).filter(key=>tracked.includes(key)).map(key=><label key={key} className="text-sm">{measurementLabels[key]} (cm)<input type="number" min="1" max="250" step="0.1" className="w-full border rounded p-2" value={values[key]??""} onChange={e=>{const next={...values};if(e.target.value) next[key]=Number(e.target.value);else delete next[key];onChange(next)}}/></label>)}</div>}</Localize>
}
export function PlanningPreferences({value,onChange,initialMeasurements=false}:{value:Preferences;onChange:(p:Preferences)=>void;initialMeasurements?:boolean}) {
  return <Localize>{<div className="space-y-4">
    <label className="block text-sm">Hälsoanpassning (valfritt)<select className="w-full border rounded p-2" value={value.health} onChange={e=>onChange({...value,health:e.target.value as Preferences["health"]})}>{Object.entries(healthOptions).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <p className="text-sm text-muted-foreground">Kost- och planeringsstöd, inte behandling eller ersättning för vårdens råd. Vi ändrar aldrig medicin eller insulindos. Allergier och kostkrav går alltid först.</p>
    <label className="block text-sm">Arbetstider<select className="w-full border rounded p-2" value={value.workSchedule} onChange={e=>onChange({...value,workSchedule:e.target.value})}>{Object.entries({dagtid:"Dagtid",kvall:"Kvällstid",natt:"Natt",skift:"Skift",oregelbundet:"Oregelbundna tider"}).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <label className="block text-sm">Matbudget<select className="w-full border rounded p-2" value={value.budget} onChange={e=>onChange({...value,budget:e.target.value})}>{Object.entries({low:"Låg",normal:"Normal",high:"Hög"}).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <fieldset><legend className="text-sm font-medium">Måltider för nya veckor</legend><SlotChoices value={value.mealSlots} onChange={mealSlots=>onChange({...value,mealSlots})}/><p className="text-xs text-muted-foreground">Befintliga veckor ändras på Veckoplan. En bortvald måltid betyder att du planerar den själv, inte att du ska hoppa över mat.</p></fieldset>
    <MeasurementChoices value={value.trackedMeasurements} onChange={trackedMeasurements=>onChange({...value,trackedMeasurements})}/>
    {initialMeasurements && <MeasurementInputs tracked={value.trackedMeasurements} values={readMeasurements(value.measurements)} onChange={values=>onChange({...value,measurements:JSON.stringify(values)})}/>}
  </div>}</Localize>
}
export function PreferencesEditor({preferences,onSaved}:{preferences:Preferences;onSaved:()=>void}) {
  const [value,setValue]=useState(preferences),[saving,setSaving]=useState(false),[message,setMessage]=useState("")
  return <Localize>{<form className="rounded-lg border p-4 space-y-4" onSubmit={async e=>{e.preventDefault();setSaving(true);try{await savePreferences({health:value.health,budget:value.budget,workSchedule:value.workSchedule,mealSlots:value.mealSlots,trackedMeasurements:value.trackedMeasurements});setMessage("Dina val är sparade.");onSaved()}catch{setMessage("Kunde inte spara. Kontrollera dina val.")}finally{setSaving(false)}}}><h2 className="font-semibold">Planering och kroppsmått</h2><PlanningPreferences value={value} onChange={setValue}/><Button disabled={saving}>Spara planeringsval</Button><p role="status" className="text-sm">{message}</p></form>}</Localize>
}

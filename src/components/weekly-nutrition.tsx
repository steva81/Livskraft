"use client"
import { useEffect, useState } from "react"
import { getWeeklyNutrition } from "@/app/nutrition-actions"
import { useMode } from "@/lib/ModeContext"
import { useLanguage } from "@/lib/i18n/provider"
export function WeeklyNutrition() {
  const [data,setData]=useState<Awaited<ReturnType<typeof getWeeklyNutrition>>|null>(null), {mode}=useMode(),{language}=useLanguage(),en=language==="en"
  useEffect(()=>{void getWeeklyNutrition().then(setData).catch(()=>setData(null))},[])
  if(!data)return null
  return <section className="border rounded-xl p-4 space-y-3" data-localize="off"><h2 className="font-semibold">{en?"This week's nutrition overview":"Veckans näringsöversikt"}</h2><p>{en?"Own meals logged":"Registrerade egna måltider"}: {data.days.reduce((sum,d)=>sum+d.ownMeals,0)} · {en?"Approved adaptations":"Godkända anpassningar"}: {data.decisions}</p>{mode==="advanced"&&<><p className="text-sm">{en?"Known estimates only; unlogged food is not included.":"Endast kända uppskattningar; oregistrerad mat ingår inte."}</p><div className="grid gap-2 sm:grid-cols-2">{data.days.map(day=><div key={String(day.date)} className="rounded border p-2"><p>{new Date(day.date).toLocaleDateString(en?"en-GB":"sv-SE",{weekday:"short",day:"numeric"})}</p><p>{en?"Planned":"Planerat"}: {day.planned.unknown.calories?en?"incomplete":"ofullständigt":`${Math.round(day.planned.sum.calories)} kcal`}</p><p>{en?"Logged":"Registrerat"}: {Math.round(day.consumed.sum.calories)} kcal · {Math.round(day.consumed.sum.protein)} g protein{day.consumed.unknown.calories||day.consumed.unknown.protein?en?" (incomplete)":" (ofullständigt)":""}</p></div>)}</div></>}</section>
}

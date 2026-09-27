"use client"
import {profileReadiness} from "@/lib/profile-readiness"
import { bodyLabels } from "@/lib/body-data"
import { useEffect, useState } from "react"
import { getUser, type PublicUser } from "@/app/actions"
import { goalLabels, goalGuidance, primaryGoal, nutritionTarget } from "@/lib/nutrition"
import { useLanguage } from "@/lib/i18n/provider"
import { useMode } from "@/lib/ModeContext"
export function GoalSummary() {
  const [user,setUser]=useState<PublicUser|null>(null), {language}=useLanguage(), {mode}=useMode()
  useEffect(()=>{void getUser().then(setUser).catch(()=>setUser(null))},[])
  if(!user || !profileReadiness(user).ready)return null
  const goal=primaryGoal(user), target=nutritionTarget(user)
  return <div className="rounded-xl border p-4 space-y-2" data-localize="off"><p className="font-semibold">{goalLabels[language][goal]}</p><p>{goalGuidance(goal,language==="en")}</p>{target&&<p className="text-sm">{bodyLabels[language][target.confidence]}</p>}{mode==="advanced"&&target&&<p>{language==="en"?"Approximate daily guidance":"Ungefärlig daglig vägledning"}: {target.calories} kcal · {target.protein} g protein</p>}</div>
}

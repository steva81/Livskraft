"use client"
import { useState } from "react"
import { getNutritionProposal, chooseNutritionProposal } from "@/app/nutrition-actions"
import { useLanguage } from "@/lib/i18n/provider"
import { useMode } from "@/lib/ModeContext"
import { useRouter } from "next/navigation"
import { Button } from "./ui/button"

export function NutritionBalance({trend=false,onChanged}: {trend?:boolean;onChanged?:()=>Promise<void>}) {
  const {language}=useLanguage(), {mode}=useMode(), router=useRouter(), en=language==="en"
  const t=(sv:string,english:string)=>en?english:sv
  const [proposal,setProposal]=useState<Awaited<ReturnType<typeof getNutritionProposal>>|null>(null)
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("")
  const run=async(action:()=>Promise<void>)=>{setBusy(true);setMessage("");try{await action()}catch(e){setMessage(e instanceof Error?e.message:t("Försök igen.","Try again."))}finally{setBusy(false)}}
  return <section className="wellness-panel space-y-3 p-5" data-localize="off">
    <h2 className="font-semibold">{trend?t("Näring i nästa adaptiva vecka","Nutrition in the next adaptive week"):t("Fortsätt i din takt","Continue at your own pace")}</h2>
    <p className="text-sm">{t("Det går alltid bra att fortsätta normalt. Förslag behåller måltider, protein och fibrer. Rörelse är frivilligt för välbefinnande, inte för att betala för mat.","Continuing normally is always an option. Suggestions preserve meals, protein and fibre. Movement is optional for wellbeing, not to pay for food.")}</p>
    <div className="flex flex-wrap gap-2">{(trend?["trend"] as const:["day","week"] as const).map(scope=><Button key={scope} variant="outline" disabled={busy} onClick={()=>void run(async()=>setProposal(await getNutritionProposal(scope)))}>{scope==="trend"?t("Granska veckotrend","Review weekly trend"):scope==="day"?t("Granska varsamt dagsförslag","Review gentle day option"):t("Granska resten av veckan","Review rest of week")}</Button>)}</div>
    {proposal && <>
      {proposal.reason!=="proposed"?<p>{proposal.reason==="minor"?t("Ingen ändring behövs utifrån registrerade värden. Fortsätt med din vanliga plan.","No adjustment is needed from the logged values. Continue normally."):proposal.reason==="insufficient"?t("Vi behöver minst sex viktmätningar över minst två veckor för ett trendförslag.","At least six weight entries across two weeks are needed for a trend suggestion."):proposal.reason==="incomplete"?t("Registreringen är ofullständig. Vi räknar inte fram en minskning från okända värden.","Logging is incomplete. We do not calculate reductions from unknown values."):t("Inget verifierat varsamt byte finns. Det kan bero på kostregler, hälsoanpassning, återstående måltider eller saknade näringsvärden. Behåll planen.","No verified gentle swap is available. Dietary rules, health preferences, remaining meals or missing nutrition data may limit options. Keep the plan.")}</p>:<>
        <ul className="space-y-2">{proposal.changes.map(c=><li key={c.dayId} className="break-words">{new Date(c.date).toLocaleDateString(en?"en-GB":"sv-SE")}: {c.from} → {c.to}{mode==="advanced"?` (${c.delta>0?"+":""}${Math.round(c.delta)} kcal)`:""}</li>)}</ul>
        <p className="text-sm">{t("Godkännande byter endast dessa måltider. Veckoplan, näringssummor, Coach och inköpslista följer de nya recepten.","Approval replaces only these meals. Weekly Plan, nutrition totals, Coach and shopping follow the new recipes.")}</p>
        {proposal.status==="open"?<div className="flex flex-wrap gap-2">{[true,false].map(accept=><Button key={String(accept)} disabled={busy} variant={accept?"default":"outline"} onClick={()=>void run(async()=>{await chooseNutritionProposal(proposal.scope,proposal.key,accept);setProposal({...proposal,status:accept?"accepted":"declined"});await onChanged?.();router.refresh()})}>{accept?t("Godkänn byten","Approve swaps"):t("Behåll planen","Keep plan")}</Button>)}</div>:<p role="status">{proposal.status==="accepted"?t("Bytena har sparats.","Swaps saved."):t("Planen behålls.","Plan unchanged.")}</p>}
      </>}
    </>}
    {message&&<p role="alert">{message}</p>}
  </section>
}

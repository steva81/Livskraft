"use client"
import {ProfileReadinessCard} from "@/components/profile-readiness"
import { bodyLabels } from "@/lib/body-data"
import { GoalSummary } from "@/components/goal-summary"
import { Localize, useLanguage } from "@/lib/i18n/provider"

import Link from "next/link"
import { formatTimeframe } from "@/lib/goal-safety"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getUser, type PublicUser } from "@/app/actions"
import { readPreferences, healthOptions, measurementLabels } from "@/lib/preferences"
import { parseStringList } from "@/lib/dietary"
import { translate } from "@/lib/i18n/catalog"
import { displayValue } from "@/lib/display"
import { useMode } from "@/lib/ModeContext"

export default function ProfilePage() {
  const {language}=useLanguage()
  const { mode } = useMode()
  const [user, setUser] = useState<PublicUser | null>(null)
  const [error, setError] = useState("")
  useEffect(() => { getUser().then(setUser).catch(() => setError("Kunde inte ladda profilen. Försök igen.")) }, [])
  if (!user) return <Localize>{<p role="status">{error || "Laddar din profil…"}</p>}</Localize>
  const preferences = user.preferences ? readPreferences(user.preferences) : null
  const list = (raw: string | null, localize = false) => {
    const values = parseStringList(raw)
    return values.length ? values.map(v => localize ? translate(displayValue(v),language) : v).join(", ") : "Inga angivna"
  }
  const groups = [
    {title:"Dina mål", rows:[
      [preferences?.planningConfirmed?"Personligt stegmål":(language==="en"?"Unconfirmed step suggestion":"Obekräftat stegförslag"), `${user.stepGoal.toLocaleString(language==="en"?"en-GB":"sv-SE")} steg`],
      ["Nuvarande vikt", user.currentWeight == null ? "Ej angivet" : `${user.currentWeight.toLocaleString(language==="en"?"en-GB":"sv-SE")} kg`],
      ["Målvikt", user.targetWeight == null ? "Ej angivet" : `${user.targetWeight.toLocaleString(language==="en"?"en-GB":"sv-SE")} kg`],
      ["Tidsram", user.timeframeWeeks == null ? "Ej angivet" : formatTimeframe(user.timeframeWeeks)],
      ["Midjemått", user.waist == null ? "Ej angivet" : `${user.waist.toLocaleString(language==="en"?"en-GB":"sv-SE")} cm`],
      ["Längd", user.height == null ? "Ej angivet" : `${user.height.toLocaleString(language==="en"?"en-GB":"sv-SE")} cm`],
      ["Spårade kroppsmått", [translate("Vikt",language),translate("Midja",language),...(preferences?.trackedMeasurements.map(key=>translate(measurementLabels[key],language))??[])].join(", ")],
    ]},
    {title:"Träning och vardag", rows:[
      ["Träningsplats", displayValue(user.trainingLocation)], ["Träningsnivå", displayValue(user.trainingLevel)],
      ["Träningsdagar per vecka", preferences ? String(preferences.trainingDays) : "Ej angivet"],
      ["Tid per pass", preferences ? `${preferences.workoutMinutes} minuter` : "Ej angivet"],
      ["Utrustning hemma", preferences?.equipment || "Ej angivet"],
      ["Arbetstider", preferences ? displayValue(preferences.workSchedule) : "Ej angivet"],
      ["Aktivitetsnivå", displayValue(user.activityLevel)], ["Livsstil och mat på jobbet", list(user.lifestyle,true)],
      ["Uppskattade steg per dag vid start", preferences ? preferences.dailySteps.toLocaleString(language==="en"?"en-GB":"sv-SE") : "Ej angivet"],
    ]},
    {title:"Mat som passar dig", rows:[
      ["Kostregler och allergier", list(user.dietRestrictions,true)],
      ["Mat du gillar", preferences?.likedFoods || "Inga angivna"], ["Mat du ogillar", list(user.dislikedFoods)],
      ["Tid för matlagning", preferences ? `${preferences.cookingMinutes} minuter` : "Ej angivet"],
      ["Matbudget", preferences ? displayValue(preferences.budget) : "Ej angivet"],
      ["Hälsoanpassning",healthOptions[preferences?.health??"none"]],
    ]},
  ]
  return <Localize>{<div className="max-w-3xl mx-auto space-y-6">
      <GoalSummary /><ProfileReadinessCard user={user}/>{!preferences?.planningConfirmed&&<p data-localize="off" className="rounded bg-amber-50 p-4">{language==="en"?"The stored activity, training and daily-life values below may include starting suggestions. Review and confirm them in My Plan before they are used for personal recommendations.":"Sparade aktivitets-, tränings- och vardagsvärden nedan kan innehålla startförslag. Granska och bekräfta dem i Min plan innan de används för personliga rekommendationer."}</p>}
      <div data-localize="off" className="border rounded p-4"><p>{bodyLabels[language].year}: {preferences?.birthYear??"—"}</p><p>{bodyLabels[language].sex}: {bodyLabels[language][preferences?.sexForEnergy??"undisclosed"]}</p></div>
    <div><h1 className="text-3xl font-bold">Min profil</h1><p className="text-muted-foreground">Din sparade profil och dina vardagsval.</p></div>
    <Card><CardHeader><CardTitle>{user.name}</CardTitle><CardDescription>{user.email}</CardDescription></CardHeader><CardContent>
      {user.email === "anna@demo.com" && <p className="bg-amber-50 text-amber-900 p-3 rounded mb-3">Demokonto med exempeldata.</p>}
      <p className="text-sm mb-3">Visningsläge: {mode === "advanced" ? "Avancerat" : "Enkelt"}. Gym innebär vanliga gymmaskiner och fria vikter; utrustningsvalet gäller hemma.</p>
      <p className="text-sm text-muted-foreground mb-3">Startuppgifterna kommer från din onboarding. Nya mätningar sparar du under Framsteg.</p>
      <p className="text-sm">Språk: {language==="en"?"English":"Svenska"}</p>
      <div className="flex flex-wrap gap-4 mt-4 underline"><Link href="/my-plan">Redigera i Min plan</Link><Link href="/account">Kontoinställningar</Link></div>
    </CardContent></Card>
    {groups.map(group => <Card key={group.title}><CardHeader><CardTitle>{group.title}</CardTitle></CardHeader><CardContent>
      <dl className="space-y-3">{group.rows.map(([label,value]) => <div key={label} className="grid sm:grid-cols-2 gap-1 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium break-words">{value}</dd></div>)}</dl>
    </CardContent></Card>)}
  </div>}</Localize>
}

"use client"
import { signOut } from "next-auth/react"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getUser, type PublicUser } from "@/app/actions"
import { readPreferences } from "@/lib/preferences"
import { parseStringList } from "@/lib/dietary"
import { displayValue } from "@/lib/display"

export default function ProfilePage() {
  const [user, setUser] = useState<PublicUser | null>(null)
  const [error, setError] = useState("")
  useEffect(() => { getUser().then(setUser).catch(() => setError("Kunde inte ladda profilen. Försök igen.")) }, [])
  if (!user) return <p role="status">{error || "Laddar din profil…"}</p>
  const preferences = user.preferences ? readPreferences(user.preferences) : null
  const list = (raw: string | null, translate = false) => {
    const values = parseStringList(raw)
    return values.length ? values.map(v => translate ? displayValue(v) : v).join(", ") : "Inga angivna"
  }
  const groups = [
    {title:"Dina mål", rows:[
      ["Personligt stegmål", `${user.stepGoal.toLocaleString("sv-SE")} steg`],
      ["Nuvarande vikt", user.currentWeight == null ? "Ej angivet" : `${user.currentWeight.toLocaleString("sv-SE")} kg`],
      ["Målvikt", user.targetWeight == null ? "Ej angivet" : `${user.targetWeight.toLocaleString("sv-SE")} kg`],
      ["Tidsram", user.timeframeWeeks == null ? "Ej angivet" : `${user.timeframeWeeks} veckor`],
      ["Midjemått", user.waist == null ? "Ej angivet" : `${user.waist.toLocaleString("sv-SE")} cm`],
    ]},
    {title:"Träning och vardag", rows:[
      ["Träningsplats", displayValue(user.trainingLocation)], ["Träningsnivå", displayValue(user.trainingLevel)],
      ["Träningsdagar per vecka", preferences ? String(preferences.trainingDays) : "Ej angivet"],
      ["Tid per pass", preferences ? `${preferences.workoutMinutes} minuter` : "Ej angivet"],
      ["Utrustning hemma", preferences?.equipment || "Ej angivet"],
      ["Arbetstider", preferences ? displayValue(preferences.workSchedule) : "Ej angivet"],
      ["Aktivitetsnivå", displayValue(user.activityLevel)], ["Livsstil och mat på jobbet", list(user.lifestyle,true)],
    ]},
    {title:"Mat som passar dig", rows:[
      ["Kostregler och allergier", list(user.dietRestrictions,true)],
      ["Mat du gillar", preferences?.likedFoods || "Inga angivna"], ["Mat du ogillar", list(user.dislikedFoods)],
      ["Tid för matlagning", preferences ? `${preferences.cookingMinutes} minuter` : "Ej angivet"],
      ["Matbudget", preferences ? displayValue(preferences.budget) : "Ej angivet"],
    ]},
  ]
  return <div className="max-w-3xl mx-auto space-y-6">
    <div><h1 className="text-3xl font-bold">Min profil</h1><p className="text-muted-foreground">Din sparade profil och dina vardagsval.</p></div>
    <Card><CardHeader><CardTitle>{user.name}</CardTitle><CardDescription>{user.email}</CardDescription></CardHeader><CardContent>
      {user.email === "anna@demo.com" && <p className="bg-amber-50 text-amber-900 p-3 rounded mb-3">Demokonto med exempeldata.</p>}
      <p className="text-sm mb-3">Visningsläge: {user.mode === "advanced" ? "Avancerat" : "Enkelt"}. Gym innebär vanliga gymmaskiner och fria vikter; utrustningsvalet gäller hemma.</p>
      <Button variant="outline" onClick={() => signOut({callbackUrl:"/login"})}>Logga ut</Button>
    </CardContent></Card>
    {groups.map(group => <Card key={group.title}><CardHeader><CardTitle>{group.title}</CardTitle></CardHeader><CardContent>
      <dl className="space-y-3">{group.rows.map(([label,value]) => <div key={label} className="grid sm:grid-cols-2 gap-1 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium break-words">{value}</dd></div>)}</dl>
    </CardContent></Card>)}
  </div>
}

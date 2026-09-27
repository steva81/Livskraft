"use client"
import { Localize, LanguageSelector, useLanguage } from "@/lib/i18n/provider"

import { BirthInputs } from "@/components/body-data"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { submitOnboarding } from "@/app/actions"
import { primaryGoals, goalLabels, type PrimaryGoal } from "@/lib/nutrition"
import { defaultPreferences } from "@/lib/preferences"
import { assessGoal, timeframeOptions } from "@/lib/goal-safety"
import { signIn } from "next-auth/react"

export default function OnboardingPage() {
  const {language}=useLanguage()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showGoalErrors, setShowGoalErrors] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    currentWeight: "",
    height: "", waist: "", allergies: "",
    preferences: { ...defaultPreferences, primaryGoal: "lose" as PrimaryGoal },
    targetWeight: "",
    timeframeWeeks: "12",
    activityLevel: "moderate",
    dietRestrictions: [] as string[],
    dislikedFoods: "",
    lifestyle: [] as string[],
    mode: "simple",
    trainingLocation: "both",
    trainingLevel: "beginner",
  })

  const handleNext = () => setStep(s => s + 1)
  const handleBack = () => setStep(s => s - 1)

  const handleCheckbox = (field: "dietRestrictions" | "lifestyle", value: string) => {
    setFormData(prev => {
      const arr = prev[field]
      if (arr.includes(value)) {
        return { ...prev, [field]: arr.filter(v => v !== value) }
      } else {
        return { ...prev, [field]: [...arr, value] }
      }
    })
  }

  const maintaining = ["maintain","retain-muscle"].includes(formData.preferences.primaryGoal)
  const safety = formData.currentWeight || formData.targetWeight ? assessGoal({...formData,targetWeight:maintaining?formData.currentWeight:formData.targetWeight}) : {level:"normal",message:""}
  const warning = (showGoalErrors || (formData.currentWeight && formData.targetWeight)) ? safety.message : ""
  const checkSafety = () => {
    setShowGoalErrors(true)
    return safety.level !== "blocked"
  }

  const handleComplete = async () => {
    if (!formData.email || formData.password.length < 10) {
      setError("Ange e-post och ett lösenord med minst 10 tecken (steg 1).")
      setStep(1)
      return
    }
    if (!checkSafety()) { setStep(1); return }

    setLoading(true)
    setError("")
    const dataToSubmit = {
      ...formData,
      targetWeight:maintaining?formData.currentWeight:formData.targetWeight,
      preferences:{...formData.preferences,language,dailySteps:({sedentary:4000,light:5500,moderate:7000,active:9000} as Record<string,number>)[formData.activityLevel]??5000},
      dietRestrictions: [...formData.dietRestrictions, ...formData.allergies.split(",").map(s => s.trim().toLowerCase()).filter(Boolean).map(s => `allergy:${s}`)],
      dislikedFoods: formData.dislikedFoods.split(",").map((s) => s.trim()).filter(Boolean),
    }

    try {
    const res = await submitOnboarding(dataToSubmit)
    if (res.success) {
      const login = await signIn("credentials", {
        redirect: false,
        email: formData.email,
        password: formData.password,
      })
      if (login?.error) {
        router.push("/login?created=1")
      } else {
        router.push("/my-plan?welcome=1")
      }
    } else {
      setError(res.error || "Kunde inte skapa kontot.")
    }
    } catch { setError("Kunde inte skapa kontot. Försök igen.") } finally { setLoading(false) }
  }

  return <Localize>{(
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50/50">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <LanguageSelector />
          <CardTitle>Steg {step} av 4: Välkommen till Livskraft</CardTitle>
          <CardDescription>Vi bygger en plan som anpassar sig efter ditt liv.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p role="alert" className="text-sm text-red-700 mb-3">{error}</p>}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Mål och profil</h3>
              <div>
                <label className="text-sm font-medium leading-none">Ditt namn</label>
                <input aria-label="Ditt namn" type="text" className="w-full p-2 border rounded-md mt-1" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Namn" />
              </div>
              <div>
                <label className="text-sm font-medium leading-none">E-post</label>
                <input aria-label="E-post" type="email" className="w-full p-2 border rounded-md mt-1" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="namn@epost.se" required />
              </div>
              <div>
                <label className="text-sm font-medium leading-none">Lösenord</label>
                <input aria-label="Lösenord" type="password" className="w-full p-2 border rounded-md mt-1" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Minst 10 tecken" />
              </div>
<BirthInputs value={formData.preferences} onChange={body=>setFormData({...formData,preferences:{...formData.preferences,...body}})}/><label className="block">{language==="en"?"Primary goal":"Huvudmål"}<select className="w-full border rounded p-2" value={formData.preferences.primaryGoal} onChange={e=>setFormData({...formData,preferences:{...formData.preferences,primaryGoal:e.target.value as PrimaryGoal}})}>{primaryGoals.map(g=><option key={g} value={g}>{goalLabels[language][g]}</option>)}</select></label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium leading-none">Nuvarande vikt (kg)</label>
                  <input aria-label="Nuvarande vikt (kg)" type="number" className="w-full p-2 border rounded-md mt-1" value={formData.currentWeight} onChange={e => setFormData({...formData, currentWeight: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium leading-none">Målvikt (kg)</label>
                  <input aria-label="Målvikt (kg)" type="number" className="w-full p-2 border rounded-md mt-1" disabled={maintaining} value={maintaining?formData.currentWeight:formData.targetWeight} onChange={e => setFormData({...formData, targetWeight: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium leading-none">Önskad tidsram</label>
                <select aria-label="Önskad tidsram" className="w-full p-2 border rounded-md mt-1" value={formData.timeframeWeeks} onChange={e => setFormData({...formData, timeframeWeeks: e.target.value})}>
                  {timeframeOptions.map(option => <option key={option.weeks} value={option.weeks}>{option.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">{(["height"] as const).map(key => <label key={key} className="text-sm">{key === "height" ? "Längd (cm)" : "Midjemått (cm, valfritt)"}<input type="number" className="w-full border rounded p-2" value={formData[key]} onChange={e => setFormData({...formData, [key]: e.target.value})} /></label>)}</div>
              {warning && <div role="alert" className="p-3 bg-amber-50 text-amber-900 text-sm rounded-md">{warning}</div>}
              <Button onClick={() => { if(checkSafety()) handleNext() }} className="w-full">Nästa</Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Kostval och allergier</h3>
              <p className="text-sm text-muted-foreground">Dina val filtrerar recept, veckoplan och coachens matförslag. Laktosfri kost är inte samma sak som mjölkallergi; ange mjölk under allergier om det gäller dig.</p>
              
              <div className="space-y-2">
                {["vegetarian", "vegan", "lactose-free", "gluten-free", "halal", "kosher"].map(res => (
                  <label key={res} className="flex min-h-11 sm:min-h-0 cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={formData.dietRestrictions.includes(res)} onChange={() => handleCheckbox("dietRestrictions", res)} />
                    <span>{res === "lactose-free" ? "Laktosfri" : res === "gluten-free" ? "Glutenfri" : res === "vegetarian" ? "Vegetarisk" : res === "vegan" ? "Vegansk" : res === "halal" ? "Halal" : "Kosher"}</span>
                  </label>
                ))}
              </div>

              {step === 2 && <><label className="block text-sm">Allergier (komma mellan, t.ex. nötter, mjölk, ägg, soja)<input className="w-full border rounded p-2" value={formData.allergies} onChange={e => setFormData({...formData, allergies: e.target.value})} /></label><p className="text-xs text-muted-foreground">Okända allergier och kostkrav utan verifierade recept ger en tom matplan. Kontrollera alltid märkningen på de produkter du använder.</p></>}
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleBack} className="w-full">Tillbaka</Button>
                <Button onClick={handleNext} className="w-full">Nästa</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Livsstil och vardag</h3>
              <div>
                <label className="text-sm font-medium leading-none">Allmän aktivitetsnivå</label>
                <select aria-label="Allmän aktivitetsnivå" className="w-full p-2 border rounded-md mt-1" value={formData.activityLevel} onChange={e => setFormData({...formData, activityLevel: e.target.value})}>
                  <option value="sedentary">Låg (Mestadels stillasittande)</option>
                  <option value="light">Lätt (Lätt rörelse under dagen)</option>
                  <option value="moderate">Måttlig (Regelbunden träning/rörelse)</option>
                  <option value="active">Aktiv (Tränar ofta, aktiv livsstil)</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium leading-none">Var vill du träna?</label>
                <select aria-label="Var vill du träna?" className="w-full p-2 border rounded-md mt-1" value={formData.trainingLocation} onChange={e => setFormData({...formData, trainingLocation: e.target.value})}>
                  <option value="both">Både hemma och gym</option>
                  <option value="home">Hemma</option>
                  <option value="gym">Gym</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium leading-none">Träningsnivå</label>
                <select aria-label="Träningsnivå" className="w-full p-2 border rounded-md mt-1" value={formData.trainingLevel} onChange={e => setFormData({...formData, trainingLevel: e.target.value})}>
                  <option value="beginner">Nybörjare</option>
                  <option value="intermediate">Medelnivå</option>
                  <option value="advanced">Avancerad</option>
                </select>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleBack} className="w-full">Tillbaka</Button>
                <Button onClick={handleNext} className="w-full">Nästa</Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Visningsläge</h3>
              <p className="text-sm text-muted-foreground">Hur mycket detaljer vill du se i appen?</p>
              
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="radio" name="mode" className="mt-1" checked={formData.mode === "simple"} onChange={() => setFormData({...formData, mode: "simple"})} />
                  <div>
                    <div className="font-medium">Håll det enkelt åt mig</div>
                    <div className="text-sm text-muted-foreground">Fokusera på vad jag ska göra härnäst utan för mycket siffror.</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="radio" name="mode" className="mt-1" checked={formData.mode === "advanced"} onChange={() => setFormData({...formData, mode: "advanced"})} />
                  <div>
                    <div className="font-medium">Jag vill se fler detaljer</div>
                    <div className="text-sm text-muted-foreground">Visa receptens näringsvärden, mätgrafer och loggade värden. Planen är densamma; du kan byta läge på alla appsidor.</div>
                  </div>
                </label>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleBack} className="w-full" disabled={loading}>Tillbaka</Button>
                <Button onClick={handleComplete} className="w-full" disabled={loading}>
                  {loading ? "Skapar plan..." : "Skapa min plan"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )}</Localize>
}

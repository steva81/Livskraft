"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { submitOnboarding } from "@/app/actions"
import { defaultPreferences } from "@/lib/preferences"
import { signIn } from "next-auth/react"

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [warning, setWarning] = useState("")

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    currentWeight: "",
    height: "", waist: "", allergies: "",
    preferences: { ...defaultPreferences },
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

  const checkSafety = () => {
    const cw = parseFloat(formData.currentWeight)
    const tw = parseFloat(formData.targetWeight)
    const wks = parseInt(formData.timeframeWeeks)
    if (cw && tw && wks) {
      const diff = cw - tw
      if (diff > 0 && (diff / wks) > 1.0) {
        setWarning(`Målet är för snabbt för denna beta. Välj minst ${Math.ceil(diff)} veckor, gärna längre. Vi planerar inte extrem begränsning eller kompensation.`)
        return false
      }
    }
    setWarning("")
    return true
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
        router.push("/dashboard")
      }
    } else {
      setError(res.error || "Kunde inte skapa kontot.")
    }
    } catch { setError("Kunde inte skapa kontot. Försök igen.") } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50/50">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Steg {step} av 4: Välkommen till Livskraft</CardTitle>
          <CardDescription>Vi bygger en plan som anpassar sig efter ditt liv.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p role="alert" className="text-sm text-red-700 mb-3">{error}</p>}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Mål & Profil</h3>
              <div>
                <label className="text-sm font-medium leading-none">Ditt namn</label>
                <input type="text" className="w-full p-2 border rounded-md mt-1" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Namn" />
              </div>
              <div>
                <label className="text-sm font-medium leading-none">E-post</label>
                <input type="email" className="w-full p-2 border rounded-md mt-1" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="namn@epost.se" required />
              </div>
              <div>
                <label className="text-sm font-medium leading-none">Lösenord</label>
                <input type="password" className="w-full p-2 border rounded-md mt-1" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Minst 10 tecken" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium leading-none">Nuvarande vikt (kg)</label>
                  <input type="number" className="w-full p-2 border rounded-md mt-1" value={formData.currentWeight} onChange={e => setFormData({...formData, currentWeight: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium leading-none">Målvikt (kg)</label>
                  <input type="number" className="w-full p-2 border rounded-md mt-1" value={formData.targetWeight} onChange={e => setFormData({...formData, targetWeight: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium leading-none">Önskad tidsram (veckor)</label>
                <select className="w-full p-2 border rounded-md mt-1" value={formData.timeframeWeeks} onChange={e => setFormData({...formData, timeframeWeeks: e.target.value})}>
                  <option value="4">4 veckor</option>
                  <option value="8">8 veckor</option>
                  <option value="12">12 veckor</option>
                  <option value="24">24 veckor</option><option value="52">52 veckor</option><option value="104">104 veckor</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">{(["height", "waist"] as const).map(key => <label key={key} className="text-sm">{key === "height" ? "Längd (cm)" : "Midjemått (cm, valfritt)"}<input type="number" className="w-full border rounded p-2" value={formData[key]} onChange={e => setFormData({...formData, [key]: e.target.value})} /></label>)}</div>
              {warning && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md">{warning}</div>}
              <Button onClick={() => { if(checkSafety()) handleNext() }} className="w-full">Nästa</Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Kost & Restriktioner (Hårda Regler)</h3>
              <p className="text-sm text-muted-foreground">Detta används som strikta filter för all mat och alla recept.</p>
              
              <div className="space-y-2">
                {["vegetarian", "vegan", "lactose-free", "gluten-free", "halal", "kosher"].map(res => (
                  <label key={res} className="flex items-center gap-2">
                    <input type="checkbox" checked={formData.dietRestrictions.includes(res)} onChange={() => handleCheckbox("dietRestrictions", res)} />
                    <span>{res === "lactose-free" ? "Laktosfri" : res === "gluten-free" ? "Glutenfri" : res === "vegetarian" ? "Vegetarisk" : res === "vegan" ? "Vegansk" : res === "halal" ? "Halal" : "Kosher"}</span>
                  </label>
                ))}
              </div>

              <div>
                <label className="text-sm font-medium leading-none">Mat du ogillar (separera med komma)</label>
                <input type="text" className="w-full p-2 border rounded-md mt-1" value={formData.dislikedFoods} onChange={e => setFormData({...formData, dislikedFoods: e.target.value})} placeholder="T.ex: nötter, svamp, lever" />
              </div>

              {step === 2 && <><label className="block text-sm">Allergier (komma mellan, t.ex. nötter, mjölk, ägg, soja)<input className="w-full border rounded p-2" value={formData.allergies} onChange={e => setFormData({...formData, allergies: e.target.value})} /></label><p className="text-xs text-muted-foreground">Okända allergier och kostkrav utan verifierade recept ger en tom matplan. Kontrollera alltid märkningen på de produkter du använder.</p><label className="block text-sm">Mat du gillar<input className="w-full border rounded p-2" value={formData.preferences.likedFoods} onChange={e => setFormData({...formData, preferences: {...formData.preferences, likedFoods: e.target.value}})} /></label></>}
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleBack} className="w-full">Tillbaka</Button>
                <Button onClick={handleNext} className="w-full">Nästa</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Livsstil & Vardag</h3>
              <div className="space-y-2">
                {[
                  { id: "office-worker", label: "Stillasittande arbete" },
                  { id: "active-job", label: "Fysiskt aktivt arbete" },
                  { id: "travels", label: "Reser mycket i jobbet" },
                  { id: "family", label: "Familj / Barn" },
                  { id: "no-microwave", label: "Saknar mikrovågsugn på jobbet" },
                  { id: "no-fridge", label: "Saknar kylskåp" },
                  { id: "meal-prep", label: "Kan förbereda matlådor" }
                ].map(ls => (
                  <label key={ls.id} className="flex items-center gap-2">
                    <input type="checkbox" checked={formData.lifestyle.includes(ls.id)} onChange={() => handleCheckbox("lifestyle", ls.id)} />
                    <span>{ls.label}</span>
                  </label>
                ))}
              </div>
              
              <div>
                <label className="text-sm font-medium leading-none">Allmän aktivitetsnivå</label>
                <select className="w-full p-2 border rounded-md mt-1" value={formData.activityLevel} onChange={e => setFormData({...formData, activityLevel: e.target.value})}>
                  <option value="sedentary">Låg (Mestadels stillasittande)</option>
                  <option value="light">Lätt (Lätt rörelse under dagen)</option>
                  <option value="moderate">Måttlig (Regelbunden träning/rörelse)</option>
                  <option value="active">Aktiv (Tränar ofta, aktiv livsstil)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {([{key: "dailySteps", label: "Ungefärliga steg per dag", min: 0, max: 50000}, {key: "cookingMinutes", label: "Tid för matlagning (min)", min: 5, max: 180}, {key: "trainingDays", label: "Realistiska träningsdagar/vecka", min: 0, max: 5}, {key: "workoutMinutes", label: "Tid per pass (min)", min: 10, max: 120}] as const).map(field => <label key={field.key} className="text-sm">{field.label}<input type="number" min={field.min} max={field.max} className="w-full border rounded p-2" value={formData.preferences[field.key]} onChange={e => setFormData({...formData, preferences: {...formData.preferences, [field.key]: Number(e.target.value)}})} /></label>)}
              </div>
              <label className="block text-sm">Arbetstider<select className="w-full border rounded p-2" value={formData.preferences.workSchedule} onChange={e => setFormData({...formData, preferences: {...formData.preferences, workSchedule: e.target.value}})}><option value="dagtid">Dagtid</option><option value="skift">Skift / oregelbundet</option><option value="natt">Natt</option></select></label>
              <label className="block text-sm">Matbudget<select className="w-full border rounded p-2" value={formData.preferences.budget} onChange={e => setFormData({...formData, preferences: {...formData.preferences, budget: e.target.value}})}><option value="normal">Normal</option><option value="low">Låg</option></select></label>
              <label className="block text-sm">Utrustning hemma<input className="w-full border rounded p-2" value={formData.preferences.equipment} onChange={e => setFormData({...formData, preferences: {...formData.preferences, equipment: e.target.value}})} /></label>
              <p className="text-xs text-muted-foreground">Utrustningen gäller hemmapass. Gym innebär tillgång till vanliga gymmaskiner och fria vikter. Kroppsviktspass kan använda golv och vägg.</p>
              <label className="block text-sm">Övriga kroppsmått (valfritt)<input className="w-full border rounded p-2" value={formData.preferences.measurements} onChange={e => setFormData({...formData, preferences: {...formData.preferences, measurements: e.target.value}})} /></label>
              <div>
                <label className="text-sm font-medium leading-none">Var vill du träna?</label>
                <select className="w-full p-2 border rounded-md mt-1" value={formData.trainingLocation} onChange={e => setFormData({...formData, trainingLocation: e.target.value})}>
                  <option value="both">Både hemma och gym</option>
                  <option value="home">Hemma</option>
                  <option value="gym">Gym</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium leading-none">Träningsnivå</label>
                <select className="w-full p-2 border rounded-md mt-1" value={formData.trainingLevel} onChange={e => setFormData({...formData, trainingLevel: e.target.value})}>
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
              <h3 className="text-lg font-medium">App-upplevelse</h3>
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
                    <div className="font-medium">Jag vill se all statistik</div>
                    <div className="text-sm text-muted-foreground">Visa kalorier, makros, trender och all data.</div>
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
  )
}

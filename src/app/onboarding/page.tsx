"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { submitOnboarding } from "@/app/actions"

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [warning, setWarning] = useState("")

  const [formData, setFormData] = useState({
    name: "",
    currentWeight: "",
    targetWeight: "",
    timeframeWeeks: "12",
    activityLevel: "moderate",
    dietRestrictions: [] as string[],
    dislikedFoods: "",
    lifestyle: [] as string[],
    mode: "simple"
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
        setWarning("Detta mål innebär en viktnedgång på över 1 kg per vecka. Vi rekommenderar en längre tidsram för en hållbar, säker och långsiktig förändring utan extrem dieter.")
        return false
      }
    }
    setWarning("")
    return true
  }

  const handleComplete = async () => {
    // If warning is active, let user re-read it — require a second click to proceed
    if (warning) {
      setWarning("") // clear on second click to allow submission
      return
    }
    checkSafety()

    setLoading(true)
    const dataToSubmit = {
      ...formData,
      dislikedFoods: formData.dislikedFoods.split(",").map((s) => s.trim()).filter(Boolean),
    }

    const res = await submitOnboarding(dataToSubmit)
    if (res.success) {
      // Account created — redirect to login so NextAuth establishes a real session.
      // (In production this would auto-sign-in with credentials after creation.)
      router.push("/login?created=1")
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50/50">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Steg {step} av 4: Välkommen till Livskraft</CardTitle>
          <CardDescription>Vi bygger en plan som anpassar sig efter ditt liv.</CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Mål & Profil</h3>
              <div>
                <label className="text-sm font-medium leading-none">Ditt namn</label>
                <input type="text" className="w-full p-2 border rounded-md mt-1" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Namn" />
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
                  <option value="24">24 veckor</option>
                </select>
              </div>
              {warning && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md">{warning}</div>}
              <Button onClick={() => { if(checkSafety()) handleNext() }} className="w-full">Nästa</Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Kost & Restriktioner (Hårda Regler)</h3>
              <p className="text-sm text-muted-foreground">Detta används som strikta filter för all mat och alla recept.</p>
              
              <div className="space-y-2">
                {["vegetarian", "vegan", "lactose-free", "gluten-free"].map(res => (
                  <label key={res} className="flex items-center gap-2">
                    <input type="checkbox" checked={formData.dietRestrictions.includes(res)} onChange={() => handleCheckbox("dietRestrictions", res)} />
                    <span>{res === "lactose-free" ? "Laktosfri" : res === "gluten-free" ? "Glutenfri" : res === "vegetarian" ? "Vegetarian" : "Vegan"}</span>
                  </label>
                ))}
              </div>

              <div>
                <label className="text-sm font-medium leading-none">Mat du ogillar / Allergier (separera med komma)</label>
                <input type="text" className="w-full p-2 border rounded-md mt-1" value={formData.dislikedFoods} onChange={e => setFormData({...formData, dislikedFoods: e.target.value})} placeholder="T.ex: nötter, svamp, lever" />
              </div>

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
                  { id: "no-microwave", label: "Saknar micro på jobbet" }
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

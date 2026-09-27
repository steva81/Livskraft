"use client"
import { Localize, useLanguage } from "@/lib/i18n/provider"

import { savedGoalSafety } from "@/lib/goal-safety"
import { displayValue } from "@/lib/display"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Circle, Utensils, Dumbbell, Footprints } from "lucide-react"
import { useMode } from "@/lib/ModeContext"
import { getUser, getTodayData, setDailySteps, completeMeal, getTodayPlanContext } from "@/app/actions"
import type { PublicUser } from "@/app/actions"
import type { DailyLog, Workout } from "@prisma/client"
import type { PlannedMeal } from "@/lib/plan-types"
import { profileReadiness } from "@/lib/profile-readiness"
import { ProfileReadinessCard } from "@/components/profile-readiness"
import Link from "next/link"
import { DailyNutrition } from "@/components/daily-nutrition"

export default function DashboardPage() {
  const {language}=useLanguage()
  const { userId, sessionStatus } = useMode()
  const [user, setUser] = useState<PublicUser | null>(null)
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null)
  const [meals, setMeals] = useState<PlannedMeal[]>([])
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [activity, setActivity] = useState<string | null>(null)
  const [stepInput, setStepInput] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (sessionStatus === "loading") return
    if (!userId) {
      setLoading(false)
      return
    }
    Promise.all([getUser(), getTodayData(), getTodayPlanContext()]).then(([u, log, plan]) => {
      setUser(u)
      setTodayLog(log)
      setMeals(plan.meals)
      setWorkout(plan.workout)
      setActivity(plan.activity)
      setStepInput(String(log?.steps ?? 0))
      setLoading(false)
    })
  }, [userId, sessionStatus])

  const handleAddSteps = async () => {
    setSaving(true)
    try { await setDailySteps(Number(stepInput)); setTodayLog(await getTodayData()); setError("") }
    catch { setError("Kunde inte spara. Ange ett heltal mellan 0 och 100 000.") }
    finally { setSaving(false) }
  }

  if (sessionStatus === "loading" || loading) {
    return <Localize>{<div className="p-8 text-center text-muted-foreground">Laddar din dag...</div>}</Localize>
  }

  if (!user || !todayLog) {
    return <Localize>{<div className="p-8 text-center text-muted-foreground">Kunde inte ladda din dag. Logga in igen.</div>}</Localize>
  }

  if(!profileReadiness(user).ready)return <div className="mx-auto max-w-3xl space-y-5"><h1 className="text-3xl font-bold">{language==="en"?"Today":"Idag"}</h1><ProfileReadinessCard user={user}/><p>{language==="en"?"General guidance: eat regularly and make room for rest. Your own meals can still be logged below.":"Allmän vägledning: ät regelbundet och ge plats för vila. Du kan fortfarande registrera egen mat nedan."}</p><DailyNutrition/></div>
  const goalSafety = savedGoalSafety(user)
  const stepProgress = Math.min((todayLog.steps / user.stepGoal) * 100, 100)
  const eaten = (() => {
    try {
      return JSON.parse(todayLog.mealsEaten ?? "[]") as string[]
    } catch {
      return []
    }
  })()

  return <Localize>{(
    <div className="max-w-4xl mx-auto space-y-6">
      {goalSafety?.message && <div role="alert" className="rounded bg-amber-50 p-3 text-sm text-amber-900"><p>{goalSafety.message}</p><Link href="/my-plan" className="underline">Ändra målet i Min plan</Link></div>}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Idag</h1>
          <p className="text-muted-foreground">{language==="en"?"Your day, at your pace.":"Din dag, i din takt."}</p>
        </div>
      </div>

      <div className="rounded-xl bg-primary/5 p-4 space-y-2"><p>Nästa steg: {meals.find(m => !eaten.includes(`${m.slot}:${m.recipeId}`) && !eaten.includes(m.title))?.title ?? "Fortsätt med rörelse eller återhämtning i din takt."}</p><p className="text-sm">Dagen behöver inte bli perfekt. Fortsätt med nästa vanliga måltid eller pass.</p><Link className="text-primary underline text-sm" href="/meals">Kontrollera veckans ingredienser och inköpslista</Link></div>
      <DailyNutrition refreshKey={todayLog.mealsEaten ?? ""} onPlanChanged={async()=>{const day=await getTodayPlanContext();setMeals(day.meals);setWorkout(day.workout);setActivity(day.activity)}} />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Utensils className="h-5 w-5 text-primary" />
              Dagens måltider
            </CardTitle>
            <CardDescription>Dina måltider för idag, filtrerade efter dina kostregler</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {meals.length === 0 && (
              <p className="text-sm text-muted-foreground">Ingen måltidsplan ännu. Öppna Veckoplan för att skapa en.</p>
            )}
            {meals.map((meal) => {
              const done = eaten.includes(`${meal.slot}:${meal.recipeId}`) || eaten.includes(meal.title)
              return <Localize key={`${meal.slot}-${meal.recipeId}`}>{(
                <div key={`${meal.slot}-${meal.recipeId}`} className="flex items-start gap-4">
                  {done ? (
                    <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-6 w-6 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium">{meal.title}</p>
                    {!done && <Button variant="outline" size="sm" onClick={async () => { await completeMeal(meal.slot, meal.recipeId); setTodayLog(await getTodayData()) }}>Markera måltid klar</Button>}
                    <p className="text-sm text-muted-foreground">
                      {meal.slot}
                      {done ? " • Klar" : ""}
                    </p>
                  </div>
                </div>
              )}</Localize>
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Footprints className="h-5 w-5 text-primary" />
              Rörelse
            </CardTitle>
            <CardDescription>Dagligt mål: {user.stepGoal.toLocaleString(language==="en"?"en-GB":"sv-SE")} steg</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center py-4">
              <div className="text-4xl font-bold text-primary mb-2">{todayLog.steps.toLocaleString(language==="en"?"en-GB":"sv-SE")}</div>
              <p className="text-sm text-muted-foreground mb-4">steg hittills</p>
              <div className="w-full bg-gray-100 rounded-full h-2.5 mb-2">
                <div className="bg-primary h-2.5 rounded-full transition-all" style={{ width: `${stepProgress}%` }} />
              </div>
              <p className="text-xs text-center text-muted-foreground mt-4 mb-4">
                {stepProgress >= 100
                  ? "Snyggt jobbat! Dagens mål är nått."
                  : "Du är på god väg. En kort promenad tar dig närmare målet."}
              </p>
              {activity && <p className="text-xs text-center text-muted-foreground mb-3">{activity}</p>}
              <label className="text-sm">Dagens totala steg<input aria-label="Dagens totala steg" type="number" min="0" max="100000" className="border rounded p-2 w-full mb-2" value={stepInput} onChange={e => setStepInput(e.target.value)} /></label>
              <Button variant="outline" size="sm" disabled={saving} onClick={handleAddSteps}>Spara steg</Button>
              {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-primary" />
              Träning
            </CardTitle>
            <CardDescription>Dagens planerade pass — skilt från steg och promenader</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 rounded-lg p-4 border flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="font-medium">{workout ? workout.title : "Vilodag från styrketräning"}</h4>
                <p className="text-sm text-muted-foreground">
                  {workout
                    ? `${workout.duration} minuter · ${workout.type === "home" ? "Hemma" : "Gym"} · ${displayValue(workout.level)}`
                    : "Idag räcker vardagsrörelse. Inget extra pass som straff."}
                </p>
              </div>
              {workout && (
                <Link href="/training">
                  <Button>Öppna träning</Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )}</Localize>
}

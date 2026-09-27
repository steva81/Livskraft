"use client"
import { GoalSummary } from "@/components/goal-summary"
import { Localize, useLanguage } from "@/lib/i18n/provider"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarDays, Dumbbell, Utensils } from "lucide-react"
import { useMode } from "@/lib/ModeContext"
import { getWeeklyPlan, getWorkouts, getUser, selectPlanMeals } from "@/app/actions"
import { parsePlannedMeals, selectedSlots, type PlannedMeal } from "@/lib/plan-types"
import type { Workout } from "@prisma/client"
import { SlotChoices } from "@/components/planning-preferences"
import { type MealSlot } from "@/lib/preferences"
import { readPreferences } from "@/lib/preferences"
import type { PublicUser } from "@/app/actions"
import { parseStringList } from "@/lib/dietary"
import Link from "next/link"
import { savedGoalSafety } from "@/lib/goal-safety"
import { Button } from "@/components/ui/button"

const DAY_NAMES = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"]

export default function WeeklyPlanPage() {
  const {language}=useLanguage()
  const { userId, sessionStatus } = useMode()
  const [planDays, setPlanDays] = useState<
    { id: string; dayOfWeek: number; date: Date; meals: PlannedMeal[]; selected: MealSlot[]; workoutId: string | null; activity: string | null }[]
  >([])
  const [planId,setPlanId]=useState("")
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState("")
  const [weekSlots,setWeekSlots]=useState<MealSlot[]>(["Frukost","Lunch","Middag"])
  const [user, setUser] = useState<PublicUser | null>(null)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [nextWeek, setNextWeek] = useState(false)

  useEffect(() => {
    if (sessionStatus === "loading") return
    setLoading(true)
    Promise.all([getWeeklyPlan(nextWeek), getWorkouts(), getUser()]).then(([plan, ws, u]) => {
      setPlanDays([])
      if (plan) {
        setPlanId(plan.id)
        setPlanDays(
          plan.planDays.map((d) => ({
            ...d,
            date: new Date(d.date),
            meals: parsePlannedMeals(d.meals), selected: selectedSlots(d.meals),
          }))
        )
      }
      setWorkouts(ws)
      setUser(u)
    }).catch(()=>setError("Kunde inte ladda veckoplanen. Försök igen.")).finally(()=>setLoading(false))
  }, [userId, sessionStatus, nextWeek])

  const saveSlots=async(slots:MealSlot[],dayId?:string)=>{
    const previous=planDays
    setPlanDays(days=>days.map(day=>!dayId||day.id===dayId ? {...day,selected:slots} : day))
    setSaving(true);setError("")
    try {await selectPlanMeals(planId,slots,dayId);const plan=await getWeeklyPlan(nextWeek);if(plan) setPlanDays(plan.planDays.map(d=>({...d,date:new Date(d.date),meals:parsePlannedMeals(d.meals),selected:selectedSlots(d.meals)})))}
    catch {setPlanDays(previous);setError("Kunde inte spara måltiderna. Försök igen.")} finally {setSaving(false)}
  }
  if (sessionStatus === "loading" || loading) {
    return <Localize>{<div className="p-8 text-center text-muted-foreground">Laddar veckoplan...</div>}</Localize>
  }

  const safety = user ? savedGoalSafety(user) : null
  if (safety?.level === "blocked") return <Localize>{<div role="alert" className="space-y-3 rounded border p-4"><p>{safety.message}</p><Link className="underline" href="/my-plan">Ändra målet i Min plan</Link></div>}</Localize>

  if (planDays.length === 0) {
    return <Localize>{(
      <div className="max-w-4xl mx-auto p-8 text-center text-muted-foreground">
        {error || "Ingen veckoplan hittades. Logga in och öppna sidan igen så skapas en plan automatiskt."}
      </div>
    )}</Localize>
  }

  const sorted = [...planDays].sort((a, b) => {
    const order = (d: number) => (d === 0 ? 7 : d)
    return order(a.dayOfWeek) - order(b.dayOfWeek)
  })

  return <Localize>{(
    <div className="max-w-4xl mx-auto space-y-6">
      <GoalSummary />
      {safety?.message && <p role="alert" className="rounded bg-amber-50 p-3 text-sm text-amber-900">{safety.message}</p>}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <CalendarDays className="h-8 w-8 text-primary" /> Veckoplan
        </h1>
        <p className="text-muted-foreground">
          Måndag–söndag med mat, träning och promenad — anpassad efter din vardag och dina kostregler.
        </p>
      </div>

      {user && <p className="text-sm text-muted-foreground">Personligt stegmål: {user.stepGoal.toLocaleString(language==="en"?"en-GB":"sv-SE")} steg. {readPreferences(user.preferences).workSchedule!=="dagtid" ? "Lägg måltider och rörelse runt din vakna tid." : "Anpassa måltider efter hunger och vardag."} {parseStringList(user.lifestyle).includes("meal-prep") ? "Förbered gärna morgondagens mat samtidigt." : ""} {parseStringList(user.lifestyle).includes("no-fridge") ? "Använd kylväska eller välj mat nära måltiden när kylskåp saknas." : ""} {parseStringList(user.lifestyle).includes("no-microwave") ? "Välj kall mat bland dina recept eller använd mattermos när mikrovågsugn saknas." : ""}</p>}
      {error && <p role="alert">{error}</p>}
      <fieldset className="border rounded p-3"><legend>Måltider för hela veckan</legend><SlotChoices value={weekSlots} disabled={saving} onChange={setWeekSlots}/><Button disabled={saving} onClick={()=>saveSlots(weekSlots)}>Använd för veckans alla dagar</Button><p className="text-xs mt-2">Ersätter dagarnas val. Anpassa sedan enskilda dagar nedan.</p></fieldset>
      <div className="space-y-4">
        <Button variant="outline" onClick={() => setNextWeek(value => !value)}>{nextWeek ? "Visa denna vecka" : "Visa nästa vecka"}</Button>
        {sorted.map((day) => {
          const workout = workouts.find((w) => w.id === day.workoutId)
          const isToday = day.date.toDateString() === new Date().toDateString()

          return <Localize key={day.id}>{(
            <Card key={day.id} className={isToday ? "border-primary ring-1 ring-primary/30" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    {DAY_NAMES[day.dayOfWeek]}
                    <span className="text-sm font-normal text-muted-foreground">
                      {day.date.toLocaleDateString(language==="en"?"en-GB":"sv-SE", { day: "numeric", month: "short" })}
                    </span>
                  </span>
                  {isToday && (
                    <span className="text-xs font-medium bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                      Idag
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <fieldset className="mb-3"><legend className="text-sm">Planera måltider denna dag</legend><SlotChoices value={day.selected} disabled={saving} onChange={slots=>saveSlots(slots,day.id)}/></fieldset>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium mb-2 text-muted-foreground">
                      <Utensils className="w-4 h-4" /> Måltider
                    </div>
                    <div className="space-y-1">
                      {day.meals.length === 0 && <p className="text-sm text-muted-foreground">Ingen måltid planerad, eller inget kontrollerat recept matchar dina val. Du planerar bortvalda måltider själv.</p>}
                      {day.meals.map((meal) => (
                        <p key={`${meal.slot}-${meal.recipeId}`} className="text-sm">
                          <span className="text-muted-foreground">{meal.slot}: </span>
                          {meal.title} <Link className="text-primary underline" href={`/meals?recipe=${encodeURIComponent(meal.recipeId)}`}>Visa recept</Link>
                        </p>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium mb-2 text-muted-foreground">
                      <Dumbbell className="w-4 h-4" /> Träning &amp; Rörelse
                    </div>
                    {workout ? (
                      <p className="text-sm font-medium">
                        {workout.title} ({workout.duration} min)
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Vilodag från styrketräning</p>
                    )}
                    {day.activity && <p className="text-sm text-muted-foreground mt-1">{day.activity}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}</Localize>
        })}
      </div>
    </div>
  )}</Localize>
}

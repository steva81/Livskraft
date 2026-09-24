"use client"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarDays, Dumbbell, Utensils } from "lucide-react"
import { useMode } from "@/lib/ModeContext"
import { getWeeklyPlan, getWorkouts, getUser } from "@/app/actions"
import { parsePlannedMeals, type PlannedMeal } from "@/lib/plan-types"
import type { Workout } from "@prisma/client"
import { readPreferences } from "@/lib/preferences"
import type { PublicUser } from "@/app/actions"
import { parseStringList } from "@/lib/dietary"
import { Button } from "@/components/ui/button"

const DAY_NAMES = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"]

export default function WeeklyPlanPage() {
  const { userId, sessionStatus } = useMode()
  const [planDays, setPlanDays] = useState<
    { id: string; dayOfWeek: number; date: Date; meals: PlannedMeal[]; workoutId: string | null; activity: string | null }[]
  >([])
  const [user, setUser] = useState<PublicUser | null>(null)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [nextWeek, setNextWeek] = useState(false)

  useEffect(() => {
    if (sessionStatus === "loading") return
    setLoading(true)
    Promise.all([getWeeklyPlan(nextWeek), getWorkouts(), getUser()]).then(([plan, ws, u]) => {
      if (plan) {
        setPlanDays(
          plan.planDays.map((d) => ({
            ...d,
            date: new Date(d.date),
            meals: parsePlannedMeals(d.meals),
          }))
        )
      }
      setWorkouts(ws)
      setUser(u)
      setLoading(false)
    })
  }, [userId, sessionStatus, nextWeek])

  if (sessionStatus === "loading" || loading) {
    return <div className="p-8 text-center text-muted-foreground">Laddar veckoplan...</div>
  }

  if (planDays.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center text-muted-foreground">
        Ingen veckoplan hittades. Logga in och öppna sidan igen så skapas en plan automatiskt.
      </div>
    )
  }

  const sorted = [...planDays].sort((a, b) => {
    const order = (d: number) => (d === 0 ? 7 : d)
    return order(a.dayOfWeek) - order(b.dayOfWeek)
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <CalendarDays className="h-8 w-8 text-primary" /> Veckoplan
        </h1>
        <p className="text-muted-foreground">
          Måndag–söndag med mat, träning och promenad — anpassad efter din vardag och dina kostregler.
        </p>
      </div>

      {user && <p className="text-sm text-muted-foreground">Personligt stegmål: {user.stepGoal.toLocaleString("sv-SE")} steg. {readPreferences(user.preferences).workSchedule!=="dagtid" ? "Lägg måltider och rörelse runt din vakna tid." : "Anpassa måltider efter hunger och vardag."} {parseStringList(user.lifestyle).includes("meal-prep") ? "Förbered gärna morgondagens mat samtidigt." : ""} {parseStringList(user.lifestyle).includes("no-fridge") ? "Använd kylväska eller välj mat nära måltiden när kylskåp saknas." : ""} {parseStringList(user.lifestyle).includes("no-microwave") ? "Välj kall mat bland dina recept eller använd mattermos när mikrovågsugn saknas." : ""}</p>}
      <div className="space-y-4">
        <Button variant="outline" onClick={() => setNextWeek(value => !value)}>{nextWeek ? "Visa denna vecka" : "Visa nästa vecka"}</Button>
        {sorted.map((day) => {
          const workout = workouts.find((w) => w.id === day.workoutId)
          const isToday = day.date.toDateString() === new Date().toDateString()

          return (
            <Card key={day.id} className={isToday ? "border-primary ring-1 ring-primary/30" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    {DAY_NAMES[day.dayOfWeek]}
                    <span className="text-sm font-normal text-muted-foreground">
                      {day.date.toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}
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
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium mb-2 text-muted-foreground">
                      <Utensils className="w-4 h-4" /> Måltider
                    </div>
                    <div className="space-y-1">
                      {day.meals.length === 0 && <p className="text-sm text-muted-foreground">Inga kontrollerade recept matchar dina kostkrav och din matlagningstid. Vi föreslår ingen osäker ersättning.</p>}
                      {day.meals.map((meal) => (
                        <p key={`${meal.slot}-${meal.recipeId}`} className="text-sm">
                          <span className="text-muted-foreground">{meal.slot}: </span>
                          {meal.title}
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
          )
        })}
      </div>
    </div>
  )
}

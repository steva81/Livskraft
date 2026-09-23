"use client"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarDays, Dumbbell, Utensils } from "lucide-react"
import { useMode } from "@/lib/ModeContext"
import { getWeeklyPlan, getWorkouts } from "@/app/actions"
import type { Workout } from "@prisma/client"

const DAY_NAMES = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"]

export default function WeeklyPlanPage() {
  const { userId } = useMode()
  const [planDays, setPlanDays] = useState<
    { id: string; dayOfWeek: number; date: Date; meals: string[]; workoutId: string | null; activity: string | null }[]
  >([])
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    Promise.all([getWeeklyPlan(userId), getWorkouts()]).then(([plan, ws]) => {
      if (plan) {
        setPlanDays(
          plan.planDays.map((d) => ({
            ...d,
            date: new Date(d.date),
            meals: JSON.parse(d.meals) as string[],
          }))
        )
      }
      setWorkouts(ws)
      setLoading(false)
    })
  }, [userId])

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Laddar veckoplan...</div>
  }

  if (planDays.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center text-muted-foreground">
        Ingen veckoplan hittades. Kör fröskriptet för att generera din första plan.
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <CalendarDays className="h-8 w-8 text-primary" /> Veckoplan
        </h1>
        <p className="text-muted-foreground">
          Din personliga 7-dagarsplan anpassad efter dina mål och preferenser.
        </p>
      </div>

      <div className="space-y-4">
        {planDays.map((day) => {
          const workout = workouts.find((w) => w.id === day.workoutId)
          const isToday = day.date.toDateString() === new Date().toDateString()

          return (
            <Card
              key={day.id}
              className={isToday ? "border-primary ring-1 ring-primary/30" : ""}
            >
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
                  {/* Meals */}
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium mb-2 text-muted-foreground">
                      <Utensils className="w-4 h-4" /> Måltider
                    </div>
                    <div className="space-y-1">
                      {day.meals.map((meal, i) => (
                        <p key={i} className="text-sm">
                          {meal}
                        </p>
                      ))}
                    </div>
                  </div>

                  {/* Training / Activity */}
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium mb-2 text-muted-foreground">
                      <Dumbbell className="w-4 h-4" /> Träning &amp; Rörelse
                    </div>
                    {workout ? (
                      <p className="text-sm font-medium">{workout.title}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Vilodagen</p>
                    )}
                    {day.activity && (
                      <p className="text-sm text-muted-foreground mt-1">{day.activity}</p>
                    )}
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

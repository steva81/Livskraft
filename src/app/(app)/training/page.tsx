"use client"
import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dumbbell, Home as HomeIcon, Clock, CheckCircle2 } from "lucide-react"
import { useMode } from "@/lib/ModeContext"
import { getWorkouts, getWorkoutLogs, logWorkout } from "@/app/actions"
import type { Workout, WorkoutLog } from "@prisma/client"

type Exercise = { name: string; sets: number; reps: string }

export default function TrainingPage() {
  const { mode, userId } = useMode()
  const [activeTab, setActiveTab] = useState<"plan" | "log">("plan")
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [logs, setLogs] = useState<WorkoutLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getWorkouts(), userId ? getWorkoutLogs(userId) : Promise.resolve([])]).then(
      ([w, l]) => {
        setWorkouts(w)
        setLogs(l)
        setLoading(false)
      }
    )
  }, [userId])

  const handleLogWorkout = async (workoutId: string) => {
    if (!userId) return
    const entry = await logWorkout(userId, workoutId)
    setLogs((prev) => [entry, ...prev])
  }

  const isCompletedToday = (workoutId: string) => {
    const today = new Date().toDateString()
    return logs.some(
      (l) => l.workoutId === workoutId && new Date(l.date).toDateString() === today
    )
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Laddar träningsplan...
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Träning</h1>
        <p className="text-muted-foreground">Din personliga träningsplan.</p>
      </div>

      <div className="flex gap-4 border-b">
        <button
          className={`pb-2 font-medium ${
            activeTab === "plan"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground"
          }`}
          onClick={() => setActiveTab("plan")}
        >
          Min Plan
        </button>
        <button
          className={`pb-2 font-medium ${
            activeTab === "log"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground"
          }`}
          onClick={() => setActiveTab("log")}
        >
          Träningslogg
        </button>
      </div>

      {activeTab === "plan" && (
        <div className="space-y-4">
          {/* Life-Happens banner */}
          <div className="bg-primary/10 p-4 rounded-lg flex items-center justify-between border border-primary/20 gap-4">
            <div>
              <h3 className="font-semibold text-primary">Ont om tid idag?</h3>
              <p className="text-sm text-gray-600">
                Inga problem — välj ett kortare hemmapass. Missat ett pass är ingen katastrof.
              </p>
            </div>
            <Button variant="outline" size="sm" className="bg-white shrink-0">
              10-min alternativ
            </Button>
          </div>

          {workouts.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Inga träningspass hittades. Kör fröskriptet igen för att fylla databasen.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {workouts.map((workout) => {
                const exercises = JSON.parse(workout.exercises ?? "[]") as Exercise[]
                const done = isCompletedToday(workout.id)
                return (
                  <Card key={workout.id} className={done ? "opacity-75" : ""}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {workout.type === "home" ? (
                              <HomeIcon className="w-5 h-5 text-primary" />
                            ) : (
                              <Dumbbell className="w-5 h-5 text-primary" />
                            )}
                            {workout.title}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-1 mt-1">
                            <Clock className="w-4 h-4" /> {workout.duration} minuter
                            {" · "}
                            {workout.level}
                          </CardDescription>
                        </div>
                        {done && <CheckCircle2 className="w-6 h-6 text-primary shrink-0" />}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 mb-4">
                        {exercises.map((ex, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>{ex.name}</span>
                            {mode === "advanced" ? (
                              <span className="text-muted-foreground">
                                {ex.sets} set × {ex.reps}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">{ex.sets} set</span>
                            )}
                          </div>
                        ))}
                      </div>
                      <Button
                        className="w-full"
                        disabled={done}
                        onClick={() => handleLogWorkout(workout.id)}
                      >
                        {done ? "Passet avklarat ✓" : "Markera som klar"}
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "log" && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Träningslogg</h2>
          {logs.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Du har inte loggat några pass ännu. Klicka &quot;Markera som klar&quot; för att
                börja.
              </CardContent>
            </Card>
          ) : (
            logs.map((entry) => {
              const workout = workouts.find((w) => w.id === entry.workoutId)
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-4 bg-white border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{workout?.title ?? "Okänt pass"}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(entry.date).toLocaleDateString("sv-SE", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

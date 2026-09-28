"use client"
import {profileReadiness} from "@/lib/profile-readiness"
import {ProfileReadinessCard} from "@/components/profile-readiness"
import type {PublicUser} from "@/app/actions"
import { GoalSummary } from "@/components/goal-summary"
import { Localize, useLanguage } from "@/lib/i18n/provider"

import { ExerciseHelp } from "@/components/exercise-help"
import { type Exercise } from "@/lib/exercise-media"
import { displayValue } from "@/lib/display"
import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dumbbell, Home as HomeIcon, Clock, CheckCircle2 } from "lucide-react"
import { useMode } from "@/lib/ModeContext"
import { getUser, getWorkouts, getWorkoutLogs, logWorkout } from "@/app/actions"
import type { Workout, WorkoutLog } from "@prisma/client"

import { readPreferences } from "@/lib/preferences"
import { workoutFits } from "@/lib/training"



export default function TrainingPage() {
  const {language}=useLanguage()
  const { mode, userId, sessionStatus } = useMode()
  const [user,setUser]=useState<PublicUser|null>(null)
  const ready=!!user&&profileReadiness(user).ready
  const [activeTab, setActiveTab] = useState<"plan" | "log">("plan")
  const [placeFilter, setPlaceFilter] = useState<"all" | "home" | "gym">("all")
  const [showShort, setShowShort] = useState(false)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [logs, setLogs] = useState<WorkoutLog[]>([])
  const [preferredPlace, setPreferredPlace] = useState<string>("both")
  const [preferences, setPreferences] = useState(readPreferences(null))
  const [preferredLevel, setPreferredLevel] = useState("beginner")
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (sessionStatus === "loading") return
    Promise.all([getWorkouts(), getWorkoutLogs(), getUser()]).then(([w, l, u]) => {
      setUser(u)
      setWorkouts(w)
      setLogs(l)
      setPreferredLevel(u?.trainingLevel ?? "beginner")
      setPreferences(readPreferences(u?.preferences??null))
      setPreferredPlace(u?.trainingLocation ?? "both")
      if (u && profileReadiness(u).ready && (u.trainingLocation === "home" || u.trainingLocation === "gym")) {
        setPlaceFilter(u.trainingLocation)
        setPreferredPlace(u.trainingLocation)
      }
      setLoading(false)
    })
  }, [userId, sessionStatus])

  const handleLogWorkout = async (workoutId: string) => {
    setSavingId(workoutId)
    try {
      const entry = await logWorkout(workoutId)
      if (entry) setLogs((prev) => [entry, ...prev.filter(log => log.id !== entry.id)])
    } catch { setError("Kunde inte spara passet. Försök igen.") }
    finally { setSavingId(null) }
  }

  const isCompletedToday = (workoutId: string) => {
    const today = new Date().toDateString()
    return logs.some((l) => l.workoutId === workoutId && new Date(l.date).toDateString() === today)
  }

  const visible = useMemo(() => {
    return workouts.filter((w) => {
      if (placeFilter !== "all" && w.type !== placeFilter) return false
      if (showShort && w.duration > 15) return false
      return true
    })
  }, [workouts, placeFilter, showShort])

  if (sessionStatus === "loading" || loading) {
    return <Localize>{<div className="p-8 text-center text-muted-foreground">Laddar träningsplan...</div>}</Localize>
  }

  return <Localize>{(
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Träning</h1>
        <p className="text-muted-foreground">
          Styrkepass hemma eller på gym — separat från steg och promenader.
        </p>
        {ready&&<p className="text-sm text-muted-foreground mt-2">Utrustning hemma: {preferences.equipment}. Gym innebär vanliga gymmaskiner och fria vikter. Du kan bläddra bland alla nivåer; rekommenderade pass passar din profil och tidsbudget.</p>}
      </div>

      <GoalSummary />{user&&<ProfileReadinessCard user={user}/>}
      <div className="flex gap-4 border-b">
        <button
          aria-pressed={activeTab === "plan"}
          className={`min-h-11 pb-2 font-medium ${activeTab === "plan" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
          onClick={() => setActiveTab("plan")}
        >
          Pass att välja bland
        </button>
        <button
          aria-pressed={activeTab === "log"}
          className={`min-h-11 pb-2 font-medium ${activeTab === "log" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
          onClick={() => setActiveTab("log")}
        >
          Träningslogg
        </button>
      </div>
      {error && <p role="alert" className="text-red-700">{error}</p>}

      {activeTab === "plan" && (
        <div className="space-y-4">
          <div className="bg-primary/10 p-4 rounded-lg flex flex-wrap items-center justify-between border border-primary/20 gap-4">
            <div>
              <h3 className="font-semibold text-primary">Ont om tid idag?</h3>
              <p className="text-sm text-gray-600">
                Inga problem — visa korta hemmapass. Ett missat pass är ingen katastrof.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="bg-white shrink-0"
              onClick={() => {
                setShowShort((v) => !v)
                setPlaceFilter(showShort ? "all" : "home")
              }}
            >
              {showShort ? "Visa alla pass" : "Hemma, högst 15 min"}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["all", "home", "gym"] as const).map((key) => (
              <Button
                key={key}
                size="sm"
                variant={placeFilter === key ? "default" : "outline"}
                onClick={() => { setPlaceFilter(key); setShowShort(false) }}
              >
                {key === "all" ? "Alla" : key === "home" ? "Hemma" : "Gym"}
              </Button>
            ))}
          </div>

          {visible.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Inga pass matchar filtret. Prova att visa alla.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {visible.map((workout) => {
                const exercises = JSON.parse(workout.exercises ?? "[]") as Exercise[]
                const done = isCompletedToday(workout.id)
                const recommended = ready && (preferredPlace === "both" || workout.type === preferredPlace) && workoutFits(workout,preferredLevel,preferences.equipment,preferences.workoutMinutes)
                return <Localize key={workout.id}>{(
                  <Card key={workout.id} className={done ? "border-primary/30 bg-[#f6f9f3]" : ""}>
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
                          <CardDescription className="flex flex-wrap items-center gap-2 mt-3">
                            <Clock className="w-4 h-4" /> {workout.duration} minuter
                            {" · "}
                            {displayValue(workout.level)}
                            <span className="rounded-full bg-muted px-2 py-1 text-xs">{displayValue(workout.type)}</span>{recommended && <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">{language==="en"?"Recommended":"Rekommenderad"}</span>}
                          </CardDescription>
                          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{exercises.slice(0,2).map((ex,index)=><span key={index}>{index > 0 && " · "}{ex.name}</span>)}</p>
                        </div>
                        {done && <CheckCircle2 className="w-6 h-6 text-primary shrink-0" />}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <details className="mb-4 rounded-xl border bg-background/60 px-3"><summary>{language==="en"?"Exercises & instructions":"Övningar & instruktioner"} <span className="text-muted-foreground">({exercises.length})</span></summary><div className="space-y-3 pb-3">
                        {exercises.map((ex, idx) => (
                          <div key={idx} className="flex flex-wrap justify-between gap-2 border-t pt-3 text-sm">
                            <span>{ex.name}</span>
                            <ExerciseHelp exercise={ex}/>
                            {mode === "advanced" ? (
                              <span className="text-muted-foreground">
                                {ex.sets} set × {ex.reps}
                                {ex.durationMin ? ` · ${ex.durationMin} min` : ""}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">{ex.sets} × {ex.reps}</span>
                            )}
                          </div>
                        ))}
                      </div></details>
                      <Button className="w-full" disabled={done || savingId !== null} onClick={() => handleLogWorkout(workout.id)}>
                        {done ? "Passet avklarat" : "Markera som klar"}
                      </Button>
                    </CardContent>
                  </Card>
                )}</Localize>
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
                Du har inte loggat några pass ännu. Klicka &quot;Markera som klar&quot; för att börja.
              </CardContent>
            </Card>
          ) : (
            logs.map((entry) => {
              const workout = workouts.find((w) => w.id === entry.workoutId)
              return <Localize key={entry.id}>{(
                <div key={entry.id} className="flex items-center justify-between p-4 bg-white border rounded-lg">
                  <div>
                    <p className="font-medium">{workout?.title ?? "Okänt pass"}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(entry.date).toLocaleDateString(language==="en"?"en-GB":"sv-SE", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                      {workout ? ` · ${workout.duration} min · ${displayValue(workout.type)}` : ""}
                    </p>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                </div>
              )}</Localize>
            })
          )}
        </div>
      )}
    </div>
  )}</Localize>
}

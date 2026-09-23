"use client"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  CheckCircle2,
  Circle,
  Utensils,
  Dumbbell,
  Footprints,
  Info,
} from "lucide-react"
import { useMode } from "@/lib/ModeContext"
import { getUser, getTodayData, updateSteps } from "@/app/actions"
import type { User, DailyLog } from "@prisma/client"

export default function DashboardPage() {
  const { mode, setMode, userId } = useMode()
  const [user, setUser] = useState<User | null>(null)
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    Promise.all([getUser(userId), getTodayData(userId)]).then(([u, log]) => {
      setUser(u)
      setTodayLog(log)
      if (u?.mode === "advanced") setMode("advanced")
      setLoading(false)
    })
  }, [userId, setMode])

  const handleAddSteps = async () => {
    if (!userId) return
    await updateSteps(userId, 1000)
    const log = await getTodayData(userId)
    setTodayLog(log)
  }

  if (loading || !user || !todayLog) {
    return <div className="p-8 text-center text-muted-foreground">Laddar din dag...</div>
  }

  const stepProgress = Math.min((todayLog.steps / user.stepGoal) * 100, 100)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Idag</h1>
          <p className="text-muted-foreground">
            Välkommen tillbaka, {user.name.split(" ")[0]}!
          </p>
        </div>
        <button
          onClick={() => setMode(mode === "simple" ? "advanced" : "simple")}
          className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 hover:bg-primary/20 transition"
        >
          <Info className="w-4 h-4" />
          {mode === "simple" ? "Enkelt läge" : "Avancerat läge"}
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Meals Card */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Utensils className="h-5 w-5 text-primary" />
              Matplan
            </CardTitle>
            <CardDescription>Dina måltider för idag</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Krämig Havregröt med Bär</p>
                <p className="text-sm text-muted-foreground">Frukost • Klar</p>
                {mode === "advanced" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    320 kcal • 12 g protein • 45 g kolhydrater • 8 g fett
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Circle className="h-6 w-6 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Lax med rostad potatis</p>
                <p className="text-sm text-muted-foreground">Lunch</p>
                {mode === "advanced" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    540 kcal • 35 g protein • 50 g kolhydrater • 18 g fett
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Circle className="h-6 w-6 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Snabb Kycklingwok med Nudlar</p>
                <p className="text-sm text-muted-foreground">Middag</p>
                {mode === "advanced" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    450 kcal • 45 g protein • 40 g kolhydrater • 12 g fett
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Steps Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Footprints className="h-5 w-5 text-primary" />
              Rörelse
            </CardTitle>
            <CardDescription>
              Dagligt mål: {user.stepGoal.toLocaleString("sv-SE")} steg
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center py-4">
              <div className="text-4xl font-bold text-primary mb-2">
                {todayLog.steps.toLocaleString("sv-SE")}
              </div>
              <p className="text-sm text-muted-foreground mb-4">steg hittills</p>
              <div className="w-full bg-gray-100 rounded-full h-2.5 mb-2">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all"
                  style={{ width: `${stepProgress}%` }}
                />
              </div>
              <p className="text-xs text-center text-muted-foreground mt-4 mb-4">
                {stepProgress >= 100
                  ? "Snyggt jobbat! Dagens mål är nått. 🎉"
                  : "Du är på god väg! En kort promenad tar dig närmare målet."}
              </p>
              <Button variant="outline" size="sm" onClick={handleAddSteps}>
                + 1 000 steg (Demo)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Training Card */}
        <Card className="col-span-1 lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Dumbbell className="h-5 w-5 text-primary" />
                Träning
              </CardTitle>
            </div>
            <CardDescription>Dagens planerade pass</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 rounded-lg p-4 border flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="font-medium">Hemmaträning: Helkropp</h4>
                <p className="text-sm text-muted-foreground">
                  20 minuter • Ingen utrustning krävs
                </p>
                {mode === "advanced" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    3 övningar • 9 set totalt
                  </p>
                )}
              </div>
              <Button>Starta Pass</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

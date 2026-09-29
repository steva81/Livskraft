"use client"
import { PageHeading } from "@/components/page-heading"
import { goalGuidance, goalLabels, progressGuidance } from "@/lib/nutrition"
import { WeeklyNutrition } from "@/components/weekly-nutrition"
import { NutritionBalance } from "@/components/nutrition-balance"
import Link from "next/link"
import { Localize, useLanguage } from "@/lib/i18n/provider"

import { MeasurementInputs } from "@/components/planning-preferences"
import { readMeasurements, measurementLabels, type MeasurementKey } from "@/lib/preferences"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LineChart, TrendingDown, Settings2 } from "lucide-react"
import { useMode } from "@/lib/ModeContext"
import { getAdaptiveWeek, chooseAdaptiveWeek, getProgressSummary, saveMeasurements } from "@/app/actions"

import { adherenceMessage, completedWorkoutsText } from "@/lib/display"
import type { AdaptiveState } from "@/lib/adaptive"

type Summary = Awaited<ReturnType<typeof getProgressSummary>>

export default function ProgressPage() {
  const {language}=useLanguage()
  const { mode, sessionStatus } = useMode()
  const [summary, setSummary] = useState<Summary>(null)
  const [adaptive, setAdaptive] = useState<AdaptiveState | null>(null)
  const [loading, setLoading] = useState(true)
  const [weight, setWeight] = useState("")
  const [waist, setWaist] = useState("")
  const [values,setValues]=useState<Partial<Record<MeasurementKey,number>>>({})
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)


  useEffect(() => {
    if (sessionStatus === "loading") return
    Promise.all([getProgressSummary(), getAdaptiveWeek()]).then(([s,a]) => {
      setSummary(s); setAdaptive(a)
    }).catch(() => setMessage("Kunde inte läsa framstegen. Ladda om sidan.")).finally(() => setLoading(false))
  }, [sessionStatus])

  if (sessionStatus === "loading" || loading) {
    return <Localize>{<div className="p-8 text-center text-muted-foreground">Laddar framsteg...</div>}</Localize>
  }

  const latest = summary?.latestWeight
  const first = summary?.previousAverage
  const average = summary?.currentAverage
  const trendText =
    average != null && first != null
      ? average < first
        ? `Veckosnittet har minskat (${first.toLocaleString(language==="en"?"en-GB":"sv-SE", {minimumFractionDigits:1,maximumFractionDigits:1})} → ${average.toLocaleString(language==="en"?"en-GB":"sv-SE", {minimumFractionDigits:1,maximumFractionDigits:1})} kg). Fokusera på veckan, inte en enskild dag.`
        : average > first
          ? `Vikten har rört sig uppåt i loggarna. Det är data, inte ett omdöme — vi ändrar inte planen till något extremt.`
          : "Vikten är stabil i de loggar vi har. Det är ett bra utgångsläge."
      : "Logga vikt här över tid. Vi jämför två veckosnitt först när båda veckorna har minst två mätningar."

  const stepLogs = summary?.logs.filter(l=>l.stepsRecorded) ?? []
  const maxSteps = Math.max(1,...stepLogs.map(l=>l.steps))
  const weightLogs = summary?.logs.filter(l=>l.weight!=null) ?? []
  const canChartWeight = weightLogs.length>=4 && first!=null && average!=null
  const minWeight = Math.min(...weightLogs.map(l=>l.weight!))-0.5
  const maxWeight = Math.max(...weightLogs.map(l=>l.weight!))+0.5
  const firstDate = weightLogs.length ? new Date(weightLogs[0].date).getTime() : 0
  const lastDate = weightLogs.length ? new Date(weightLogs[weightLogs.length-1].date).getTime() : 0
  const weightPoints = weightLogs.map(l=>({x:20+(new Date(l.date).getTime()-firstDate)*260/Math.max(1,lastDate-firstDate),y:110-(l.weight!-minWeight)/(maxWeight-minWeight)*90,log:l}))
  const choose = async (accept: boolean) => {
    if (!adaptive) return
    setSaving(true)
    try { setAdaptive(await chooseAdaptiveWeek(accept,adaptive.key)); setMessage("") }
    catch { setMessage("Förslaget kunde inte sparas. Ladda om och granska det igen.") }
    finally { setSaving(false) }
  }

  return <Localize>{(
    <div className="app-page max-w-4xl mx-auto space-y-6">
      <div>
        <PageHeading section="progress" />
        <p className="text-muted-foreground">Trender, mätningar och din adaptiva vecka.</p>
      </div>

      {summary?.ready && <div data-localize="off" className="wellness-intro rounded-3xl border p-5 space-y-2"><p className="font-semibold">{goalLabels[language][summary.primaryGoal]}</p><p>{goalGuidance(summary.primaryGoal,language==="en")}</p><p>{progressGuidance(summary.primaryGoal,average!=null&&first!=null?average-first:null,language==="en")}</p></div>}
      <WeeklyNutrition />
      <NutritionBalance trend />
      <Card><CardHeader><CardTitle>Registrera dagens mätning</CardTitle><CardDescription>Frivilligt. En enskild mätning ändrar inte planen.</CardDescription></CardHeader><CardContent>
        <form className="space-y-3" onSubmit={async e => {
          e.preventDefault(); setSaving(true)
          try { await saveMeasurements({ weight: weight ? Number(weight) : undefined, waist: waist ? Number(waist) : undefined, values: Object.keys(values).length ? values : undefined }); setSummary(await getProgressSummary()); setAdaptive(await getAdaptiveWeek()); setMessage("Mätningen är sparad.") }
          catch { setMessage("Kunde inte spara. Kontrollera värdena och försök igen.") }
          finally { setSaving(false) }
        }}>
          <div className="grid grid-cols-2 gap-3"><label>Vikt (kg)<input type="number" min="30" max="400" step="0.1" className="border rounded p-2 w-full" value={weight} onChange={e => setWeight(e.target.value)} /></label><label>Midja (cm)<input type="number" min="30" max="250" step="0.1" className="border rounded p-2 w-full" value={waist} onChange={e => setWaist(e.target.value)} /></label></div>
          <Link className="text-sm underline" href="/my-plan#measurements">Välj kroppsmått i Min plan</Link>
          <MeasurementInputs tracked={summary?.preferences.trackedMeasurements??[]} values={values} onChange={setValues}/>
          <Button disabled={saving || (!weight && !waist && !Object.keys(values).length)}>Spara mätning</Button><p role="status" className="text-sm">{message}</p>
        </form>
      </CardContent></Card>
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader><CardTitle className="flex items-center gap-2 text-primary"><Settings2 className="w-5 h-5" />Adaptiv vecka</CardTitle>
          <CardDescription>{completedWorkoutsText(summary?.workoutsThisWeek ?? 0)} av {summary?.plannedWorkouts ?? 0} planerade den här veckan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>{adherenceMessage(summary?.workoutsThisWeek ?? 0,summary?.plannedWorkouts ?? 0)}</p>
          {adaptive && <>
            <p className="text-sm font-medium">Gäller veckan som börjar {new Date(adaptive.targetStart).toLocaleDateString(language==="en"?"en-GB":"sv-SE", {day:"numeric",month:"long"})}.</p>
            <p className="text-sm">{adaptive.reason}</p>
            {adaptive.changes.length>0 && <div><p className="font-medium">{adaptive.status==="accepted" ? "Sparade ändringar för nästa vecka" : adaptive.status==="declined" ? "Förslaget du avböjde" : "Förslag för nästa vecka"}</p><ul className="list-disc pl-5 text-sm space-y-1">{adaptive.changes.map(c=><li key={c.dayId+c.description}>{c.description}</li>)}</ul><p className="text-sm mt-2">{adaptive.unchanged}</p></div>}
            {adaptive.status==="proposed" && <div className="flex gap-3 flex-wrap"><Button disabled={saving} onClick={()=>choose(true)}>Ja, anpassa nästa vecka</Button><Button disabled={saving} variant="outline" onClick={()=>choose(false)}>Nej, behåll planen</Button></div>}
            {adaptive.status==="accepted" && <p role="status" className="font-medium text-primary">Nästa vecka är anpassad. Ditt val är sparat.</p>}
            {adaptive.status==="declined" && <p role="status" className="font-medium">Planen behålls. Ditt val är sparat.</p>}
          </>}
        </CardContent>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-primary" /> Vikt &amp; trender
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">{trendText}</p>
            <div className="flex items-end gap-2 mb-6">
              <span className="text-4xl font-bold">{latest != null ? latest.toLocaleString(language==="en"?"en-GB":"sv-SE", {minimumFractionDigits:1,maximumFractionDigits:1}) : "–"}</span>
              <span className="text-muted-foreground mb-1">kg</span>
            </div>
            {mode === "advanced" && canChartWeight ? <div>
              <svg viewBox="0 0 300 130" role="img" aria-label="Registrerad vikt över de senaste två veckorna" className="w-full h-40">
                <polyline points={weightPoints.map(p=>p.x+","+p.y).join(" ")} fill="none" stroke="currentColor" className="text-primary" strokeWidth="2" />
                {weightPoints.map(p=><circle key={String(p.log.date)} cx={p.x} cy={p.y} r="3" fill="currentColor" className="text-primary"><title>{new Date(p.log.date).toLocaleDateString(language==="en"?"en-GB":"sv-SE")}: {p.log.weight} kg</title></circle>)}
              </svg>
              <p className="text-xs text-muted-foreground">Punkterna visar registrerad vikt i datumordning, ingen prognos.</p>
            </div> : <p className="text-sm text-muted-foreground">{canChartWeight ? "Byt till avancerat läge för mätgrafen." : "Logga fler mätningar över tid för att se din vikttrend."}</p>}
            {mode === "advanced" && weightLogs.length>0 && <ul className="text-xs mt-3 space-y-1">{weightLogs.map(log=><li key={String(log.date)}>{new Date(log.date).toLocaleDateString(language==="en"?"en-GB":"sv-SE")}: {log.weight?.toLocaleString(language==="en"?"en-GB":"sv-SE")} kg</li>)}</ul>}

          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <LineChart className="w-5 h-5 text-primary" /> Kroppsmått
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium">Midjemått</span>
              <span className="text-sm text-muted-foreground">
                {summary?.waist != null ? `${summary.waist} cm (senast sparat)` : "Ingen mätning sparad"}
              </span>
            </div>
            {summary?.preferences.trackedMeasurements.map(key=>{
              const history=summary.logs.flatMap(log=>{const value=readMeasurements(log.measurements)[key];return value==null?[]:[{date:log.date,value}]})
              const delta=history.length>=2 ? history[history.length-1].value-history[0].value : null
              return <Localize key={key}>{<div key={key}><p className="font-medium">{measurementLabels[key]}: {history.at(-1)?.value??"–"} cm</p><p className="text-sm text-muted-foreground">{delta==null?"Minst två mätningar på olika dagar behövs för en jämförelse.":`Förändring mellan registrerade mätningar: ${delta>0?"+":""}${delta.toLocaleString(language==="en"?"en-GB":"sv-SE")} cm.`}</p><ul className="text-xs">{history.map(log=><li key={String(log.date)}>{new Date(log.date).toLocaleDateString(language==="en"?"en-GB":"sv-SE")}: {log.value} cm</li>)}</ul></div>}</Localize>
            })}
          </CardContent>
        </Card>
        <Card className="md:col-span-2"><CardHeader><CardTitle>Träning denna vecka</CardTitle></CardHeader><CardContent><p>{completedWorkoutsText(summary?.workoutsThisWeek ?? 0)} av {summary?.plannedWorkouts ?? 0} planerade.</p><a className="text-sm text-primary underline" href="/training">Se pass och träningslogg</a></CardContent></Card>
        <Card className="md:col-span-2"><CardHeader><CardTitle>Steg &amp; vardagsrörelse</CardTitle><CardDescription>Senaste sju dagarna: {summary?.weeklyAverageSteps?.toLocaleString(language==="en"?"en-GB":"sv-SE") ?? "–"} steg i snitt per loggad dag. {summary?.ready ? `Personligt mål: ${summary.stepGoal?.toLocaleString(language==="en"?"en-GB":"sv-SE")} steg.` : (language==="en"?"Confirm your step goal in My Plan.":"Bekräfta stegmål i Min plan.")}</CardDescription></CardHeader><CardContent>
          {summary?.ready&&<p className="text-sm mb-3">Stegmålet nåddes {summary?.stepGoalDays ?? 0} {(summary?.stepGoalDays ?? 0)===1 ? "dag" : "dagar"}. Ologgade dagar räknas inte som noll.</p>}
          {mode === "advanced" && stepLogs.length>0 && <><p className="text-xs text-muted-foreground mb-2">Loggade dagar under de senaste två veckorna</p><div className="h-28 flex items-end gap-2" role="img" aria-label="Steg per loggad dag">{stepLogs.map(l=><div key={String(l.date)} className="flex-1 bg-primary rounded-t" style={{height:(l.steps/maxSteps*100)+"%"}} title={new Date(l.date).toLocaleDateString(language==="en"?"en-GB":"sv-SE")+": "+l.steps+" steg"} />)}</div><ul className="text-xs mt-3 space-y-1">{stepLogs.map(l=><li key={String(l.date)}>{new Date(l.date).toLocaleDateString(language==="en"?"en-GB":"sv-SE")}: {l.steps.toLocaleString(language==="en"?"en-GB":"sv-SE")} steg</li>)}</ul></>}
          {stepLogs.length===0 && <p className="text-sm text-muted-foreground">Spara dagens steg på Idag-sidan för att börja.</p>}
        </CardContent></Card>
      </div>
    </div>
  )}</Localize>
}

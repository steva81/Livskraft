"use client"
import { primaryGoal, primaryGoals, goalLabels, type PrimaryGoal } from "@/lib/nutrition"
import { useLanguage } from "@/lib/i18n/provider"
import { Localize } from "@/lib/i18n/provider"

import { useEffect, useState } from "react"
import { getUser, updateWeightGoal, type PublicUser } from "@/app/actions"
import { assessGoal, formatTimeframe, timeframeOptions } from "@/lib/goal-safety"
import { Button } from "@/components/ui/button"

export function GoalEditor({ user, onSaved }: { user: PublicUser; onSaved: (user: PublicUser) => void }) {
  const {language}=useLanguage()
  const [goal,setGoal]=useState<PrimaryGoal>(primaryGoal(user))
  const maintaining=goal === "maintain" || goal === "retain-muscle"
  const [currentWeight, setCurrentWeight] = useState(String(user.currentWeight ?? ""))
  const [targetWeight, setTargetWeight] = useState(String(user.targetWeight ?? ""))
  const [weeks, setWeeks] = useState(String(user.timeframeWeeks ?? 12))
  useEffect(()=>{setCurrentWeight(String(user.currentWeight??""));setTargetWeight(String(user.targetWeight??""));setWeeks(String(user.timeframeWeeks??12));setGoal(primaryGoal(user))},[user])
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)
  const safety = assessGoal({ currentWeight, targetWeight: maintaining ? currentWeight : targetWeight, timeframeWeeks: weeks })
  return <Localize>{<form className="space-y-3 rounded-lg border p-4" onSubmit={async event => {
    event.preventDefault()
    setSaving(true); setMessage("")
    try {
      const result = await updateWeightGoal({ currentWeight: Number(currentWeight), targetWeight: Number(maintaining ? currentWeight : targetWeight), timeframeWeeks: Number(weeks), primaryGoal:goal })
      if (!result.success) { setMessage(result.error); return }
      const updated = await getUser()
      if (updated) onSaved(updated)
      setMessage("Målet har sparats.")
    } catch { setMessage("Kunde inte spara målet. Försök igen.") } finally { setSaving(false) }
  }}>
    <h2 className="font-semibold">Ändra viktmål</h2>
    <label className="block text-sm">{language === "en" ? "Primary goal" : "Huvudmål"}<select className="mt-1 w-full rounded border p-2" value={goal} onChange={e=>setGoal(e.target.value as PrimaryGoal)}>{primaryGoals.map(g=><option key={g} value={g}>{goalLabels[language][g]}</option>)}</select></label>
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="text-sm">Nuvarande vikt (kg)<input className="mt-1 w-full rounded border p-2" type="number" step="any" value={currentWeight} onChange={e => setCurrentWeight(e.target.value)} /></label>
      <label className="text-sm">Målvikt (kg)<input className="mt-1 w-full rounded border p-2" type="number" step="any" disabled={maintaining} value={maintaining ? currentWeight : targetWeight} onChange={e => setTargetWeight(e.target.value)} /></label>
      <label className="text-sm">Önskad tidsram<select className="mt-1 w-full rounded border p-2" value={weeks} onChange={e => setWeeks(e.target.value)}>
        {!timeframeOptions.some(option => option.weeks === Number(weeks)) && <option value={weeks}>{formatTimeframe(Number(weeks))}</option>}
        {timeframeOptions.map(option => <option key={option.weeks} value={option.weeks}>{option.label}</option>)}
      </select></label>
    </div>
    {safety.message && <p role="alert" className="rounded bg-amber-50 p-3 text-sm text-amber-900">{safety.message}</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
    <Button disabled={saving || safety.level === "blocked"} type="submit">{saving ? "Sparar…" : "Spara mål"}</Button>
  </form>}</Localize>
}

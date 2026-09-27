"use client"
import { Localize } from "@/lib/i18n/provider"

import { useMode } from "@/lib/ModeContext"

export function ModeControl() {
  const { mode, setMode, modeReady, modeSaving, modeError } = useMode()
  return <Localize>{<div className="max-w-4xl mx-auto mb-5 text-sm">
    <label className="flex flex-wrap items-center justify-end gap-2">Visningsläge
      <select aria-describedby="mode-help" value={mode} disabled={!modeReady || modeSaving}
        onChange={e => setMode(e.target.value as "simple" | "advanced")}
        className="border rounded-md bg-white p-2">
        <option value="simple">Enkelt</option><option value="advanced">Avancerat</option>
      </select>
    </label>
    <p id="mode-help" className="text-xs text-muted-foreground text-right mt-1">{mode === "simple" ? "Översikt och nästa steg." : "Även näringsvärden, mätgrafer och historik."} Samma plan i båda lägena.</p>
    {modeError && <p role="alert" className="text-red-700 text-right">{modeError}</p>}
  </div>}</Localize>
}

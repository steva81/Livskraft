"use client"

import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { getUser, saveMode } from "@/app/actions"

type Mode = "simple" | "advanced"

interface ModeContextType {
  mode: Mode
  modeReady: boolean
  modeSaving: boolean
  modeError: string
  setMode: (mode: Mode) => void
  userId: string | null
  sessionStatus: "loading" | "authenticated" | "unauthenticated"
}

const ModeContext = createContext<ModeContextType>({
  mode: "simple",
  modeReady: false, modeSaving: false, modeError: "",
  setMode: () => {},
  userId: null,
  sessionStatus: "loading",
})

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, updateMode] = useState<Mode>("simple")
  const [modeReady, setModeReady] = useState(false)
  const [modeSaving, setModeSaving] = useState(false)
  const [modeError, setModeError] = useState("")
  const { data: session, status } = useSession()
  const userId = session?.user?.id ?? null
  useEffect(() => {
    let active = true
    updateMode("simple")
    setModeReady(false)
    setModeError("")
    if (userId) getUser().then(user => { if (active) updateMode(user?.mode === "advanced" ? "advanced" : "simple") })
      .catch(() => { if (active) setModeError("Kunde inte läsa sparat läge. Ladda om sidan.") })
      .finally(() => { if (active) setModeReady(true) })
    return () => { active = false }
  }, [userId])
  const setMode = useCallback((value: Mode) => {
    if (!userId || !modeReady || modeSaving) return
    setModeSaving(true)
    setModeError("")
    void saveMode(value).then(() => updateMode(value))
      .catch(() => setModeError("Kunde inte spara läget. Försök igen."))
      .finally(() => setModeSaving(false))
  }, [userId, modeReady, modeSaving])

  return (
    <ModeContext.Provider value={{ mode, setMode, modeReady, modeSaving, modeError, userId, sessionStatus: status }}>
      {children}
    </ModeContext.Provider>
  )
}

export function useMode() {
  return useContext(ModeContext)
}

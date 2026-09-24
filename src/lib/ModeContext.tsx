"use client"

import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { getUser, saveMode } from "@/app/actions"

type Mode = "simple" | "advanced"

interface ModeContextType {
  mode: Mode
  setMode: (mode: Mode) => void
  userId: string | null
  sessionStatus: "loading" | "authenticated" | "unauthenticated"
}

const ModeContext = createContext<ModeContextType>({
  mode: "simple",
  setMode: () => {},
  userId: null,
  sessionStatus: "loading",
})

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, updateMode] = useState<Mode>("simple")
  const { data: session, status } = useSession()
  const userId = session?.user?.id ?? null
  useEffect(() => {
    let active = true
    updateMode("simple")
    if (userId) getUser().then(user => { if (active) updateMode(user?.mode === "advanced" ? "advanced" : "simple") })
    return () => { active = false }
  }, [userId])
  const setMode = useCallback((value: Mode) => {
    updateMode(value)
    void saveMode(value)
  }, [])

  return (
    <ModeContext.Provider value={{ mode, setMode, userId, sessionStatus: status }}>
      {children}
    </ModeContext.Provider>
  )
}

export function useMode() {
  return useContext(ModeContext)
}

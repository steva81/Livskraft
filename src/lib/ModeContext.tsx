"use client"

import React, { createContext, useContext, useState } from "react"
import { useSession } from "next-auth/react"

type Mode = "simple" | "advanced"

interface AppSession {
  user?: {
    id?: string
    name?: string | null
    email?: string | null
  }
}

interface ModeContextType {
  mode: Mode
  setMode: (mode: Mode) => void
  userId: string | null
}

const ModeContext = createContext<ModeContextType>({
  mode: "simple",
  setMode: () => {},
  userId: null,
})

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("simple")
  const { data: session } = useSession()

  // Safely extract the user id that NextAuth places on the session via the callback
  const typedSession = session as AppSession | null
  const userId = typedSession?.user?.id ?? null

  return (
    <ModeContext.Provider value={{ mode, setMode, userId }}>
      {children}
    </ModeContext.Provider>
  )
}

export function useMode() {
  return useContext(ModeContext)
}

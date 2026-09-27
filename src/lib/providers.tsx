"use client"
import { LanguageProvider } from "./i18n/provider"
import { SessionProvider } from "next-auth/react"

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider><LanguageProvider>{children}</LanguageProvider></SessionProvider>
}

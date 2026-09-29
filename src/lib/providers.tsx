"use client"
import { LanguageProvider } from "./i18n/provider"
import { SessionProvider } from "next-auth/react"
import type { Session } from "next-auth"
import type { Language } from "./i18n/catalog"

export function Providers({ children, session, language }: { children: React.ReactNode; session: Session | null; language: Language }) {
  return <SessionProvider session={session}><LanguageProvider initialLanguage={language} initialUserId={session?.user?.id ?? null}>{children}</LanguageProvider></SessionProvider>
}

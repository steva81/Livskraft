"use client"

import type { ReactNode } from "react"
import { Localize, useLanguage } from "@/lib/i18n/provider"

const headings = {
  today: ["DIN DAG", "YOUR DAY", "Idag", "Today"],
  week: ["ÖVERBLICK", "OVERVIEW", "Min vecka", "My week"],
  recipes: ["MAT & KOST", "FOOD & NUTRITION", "Recept", "Recipes"],
  training: ["RÖRELSE & ÅTERHÄMTNING", "MOVEMENT & RECOVERY", "Träning", "Training"],
  progress: ["UTVECKLING", "YOUR PROGRESS", "Framsteg", "Progress"],
  coach: ["DIN COACH", "YOUR COACH", "Coach", "Coach"],
  plan: ["DINA VAL", "YOUR CHOICES", "Min plan", "My Plan"],
  profile: ["OM DIG", "ABOUT YOU", "Min profil", "My profile"],
  account: ["INSTÄLLNINGAR", "SETTINGS", "Kontoinställningar", "Account settings"],
} as const

export function PageHeading({ section, children }: { section: keyof typeof headings; children?: ReactNode }) {
  const { language } = useLanguage()
  const text = headings[section]
  const en = language === "en"
  return <header className="page-heading">
    <p className="wellness-eyebrow" data-localize="off">{text[en ? 1 : 0]}</p>
    <h1 data-localize="off">{text[en ? 3 : 2]}</h1>
    {children && <div className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground"><Localize>{children}</Localize></div>}
  </header>
}

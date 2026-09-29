"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { LifestyleMosaic } from "@/components/lifestyle-mosaic"
import { ArrowRight, Utensils, Dumbbell, CalendarDays, TrendingUp, MessageCircle, Target, Sun, Footprints } from "lucide-react"
import { getHomeOverview } from "@/app/actions"
import { useLanguage } from "@/lib/i18n/provider"
import { profileReadiness, readinessLabels, welcomeGreeting } from "@/lib/profile-readiness"
import { ProfileReadinessCard } from "@/components/profile-readiness"

export default function HomePage() {
  const { language } = useLanguage()
  const en = language === "en"
  const started = useRef(false)
  const [data, setData] = useState<Awaited<ReturnType<typeof getHomeOverview>>>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    void getHomeOverview().then(setData).catch(() => setError(true))
  }, [])

  if (!data) return <p role="status">{error ? (en ? "Could not load your home. Reload to try again." : "Kunde inte läsa startsidan. Ladda om och försök igen.") : (en ? "Opening your home…" : "Öppnar din startsida…")}</p>

  const readiness = profileReadiness(data.user)
  const total = Object.keys(readinessLabels[language]).length
  const completed = total - readiness.missing.length
  const firstName = data.user.name?.trim().split(/\s+/)[0]
  const greeting = data.firstVisit ? welcomeGreeting(data.user.name, true, en) : `${en ? "Hi" : "Hej"}${firstName ? ` ${firstName}` : ""}`
  const cards = [
    { href: "/dashboard", icon: Utensils, title: en ? "Food & nutrition" : "Mat & kost", text: en ? "Today's food, your own meals, recipes and shopping." : "Dagens mat, egna måltider, recept och inköpslista.", action: en ? "Open today's food" : "Öppna dagens mat", color: "bg-[#d9efdc] text-[#284e39]" },
    { href: "/training", icon: Dumbbell, title: en ? "Training" : "Träning", text: en ? "Your workouts and training plan." : "Dina pass och din träningsplan.", action: en ? "See workouts" : "Se dina pass", color: "bg-[#f7d7bf] text-[#71492e]" },
    { href: "/plan", icon: CalendarDays, title: en ? "My week" : "Min vecka", text: en ? "This week's meals and training at a glance." : "Veckans måltider och träning i överblick.", action: en ? "View the week" : "Visa veckan", color: "bg-[#ceebfa] text-[#345b75]" },
    { href: "/progress", icon: TrendingUp, title: en ? "Progress" : "Framsteg", text: en ? "Weight, measurements, steps and training progress." : "Vikt, kroppsmått, steg och träningsutveckling.", action: en ? "Follow your progress" : "Följ utvecklingen", color: "bg-[#f2eccb] text-[#64552d]" },
    { href: "/coach", icon: MessageCircle, title: "Coach", text: en ? "Ask about food, training, hunger, motivation and recovery." : "Fråga om mat, träning, hunger, motivation och återhämtning.", action: en ? "Ask a question" : "Ställ en fråga", color: "bg-[#d9efdc] text-[#284e39]" },
    { href: "/my-plan", icon: Target, title: en ? "My Plan" : "Min plan", text: en ? "Goals, food choices, training and everyday preferences." : "Mål, kostval, träning och vardagsinställningar.", action: en ? "Adjust your plan" : "Justera planen", color: "bg-[#f3f2e8] text-[#3f4d40]" },
  ]

  return <div className="home-reference mx-auto max-w-4xl space-y-8 pb-3" data-localize="off">
    <section className="home-welcome rounded-[2rem] border border-[#e3e6d9] p-6 sm:p-8 lg:p-10">
      <div className="home-welcome-lead"><div>
      <p className="inline-flex items-center gap-2 rounded-full bg-[#dcefd9] px-3 py-1 text-xs font-semibold text-[#244d36]"><Sun size={15} aria-hidden="true" /><span className="first-letter:uppercase">{new Date().toLocaleDateString(en ? "en-GB" : "sv-SE", { weekday: "long", day: "numeric", month: "long" })}</span></p>
      <h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">{greeting}</h1>
      <p className="mt-2 text-lg leading-relaxed text-[#617064]">{en ? "What would you like to focus on today?" : "Vad vill du fokusera på idag?"}</p>
      </div><LifestyleMosaic variant="home" /></div>
      <div className="mt-7 grid gap-3 lg:grid-cols-3">
        <div className="rounded-[1.5rem] bg-white/85 p-4">
          <p className="home-eyebrow">{en ? "YOUR PACE" : "DIN TAKT"}</p>
          <p className="mt-2 text-sm font-medium">{en ? "Make room for food, movement and rest." : "Ge plats för mat, rörelse och vila."}</p>
        </div>
        <div className="rounded-[1.5rem] bg-white/85 p-4">
          <p id="home-profile-label" className="home-eyebrow">{en ? "YOUR PROFILE" : "DIN PROFIL"}</p>
          <p className="mt-2 text-xs text-[#617064]">{en ? `${completed} of ${total} required details complete` : `${completed} av ${total} obligatoriska uppgifter klara`}</p>
          <div role="progressbar" aria-labelledby="home-profile-label" aria-valuemin={0} aria-valuemax={total} aria-valuenow={completed} className="mt-2 h-2 overflow-hidden rounded-full bg-[#f0f1e8]"><div className="h-full rounded-full bg-[#487653]" style={{ width: `${completed / total * 100}%` }} /></div>
        </div>
        <Link href={readiness.ready ? "/dashboard" : "/my-plan#body"} className="home-next flex min-h-20 items-center justify-between gap-4 rounded-[1.5rem] bg-[#426f50] p-4 text-white transition-colors hover:bg-[#355e41]">
          <span><span className="block text-xs font-semibold tracking-wider text-[#e0eddf]">{en ? "NEXT STEP" : "NÄSTA STEG"}</span><span className="mt-2 block text-sm font-semibold">{readiness.ready ? (en ? "Open your day" : "Öppna din dag") : (en ? "Complete your plan" : "Komplettera din plan")}</span></span><ArrowRight size={21} aria-hidden="true" />
        </Link>
      </div>
    </section>

    <ProfileReadinessCard user={data.user} />
    <section aria-labelledby="home-destinations">
      <p className="home-eyebrow">{en ? "EXPLORE" : "UTFORSKA"}</p>
      <h2 id="home-destinations" className="mb-4 mt-1 text-xl font-semibold">{en ? "Where would you like to go?" : "Vart vill du gå?"}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map(card => <Link key={card.href} href={card.href} className="home-destination group flex flex-col rounded-[1.75rem] border border-[#e3e3da] bg-white p-5 sm:p-6 transition-colors hover:border-[#91b49a]">
          <span className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full ${card.color}`}><card.icon size={21} aria-hidden="true" /></span>
          <h3 className="text-xl font-semibold">{card.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-[#657269]">{card.text}</p>
          <span className="mt-auto flex items-center gap-2 pt-4 text-sm font-medium text-[#224c35]">{card.action}<ArrowRight size={16} aria-hidden="true" /></span>
        </Link>)}
      </div>
    </section>

    <Link href="/progress" className="home-destination block rounded-[1.75rem] border border-[#e3e3da] bg-white p-5 sm:p-6 hover:border-[#91b49a]">
      <div className="flex items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#d9efdc] text-[#284e39]"><Footprints size={21} aria-hidden="true" /></span><div><p className="text-sm font-medium">{en ? "Movement at your own pace" : "Rörelse i din takt"}</p><p className="mt-1 text-sm text-[#657269]">{en ? "See your logged steps and follow your progress." : "Se dina registrerade steg och följ din utveckling."}</p></div></div>
      <span className="mt-4 flex items-center gap-2 text-sm font-medium text-[#224c35]">{en ? "View progress" : "Se framsteg"}<ArrowRight size={16} aria-hidden="true" /></span>
    </Link>
    <nav aria-label={en ? "More in Livskraft" : "Mer i Livskraft"} className="flex flex-wrap gap-3">{[["/meals", en ? "Recipes & shopping" : "Recept & inköp"], ["/profile", en ? "My profile" : "Min profil"], ["/account", en ? "Account settings" : "Kontoinställningar"]].map(([href, label]) => <Link key={href} href={href} className="inline-flex min-h-12 items-center rounded-xl border bg-white px-4 text-sm font-medium">{label}</Link>)}</nav>
  </div>
}

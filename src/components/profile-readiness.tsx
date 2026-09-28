"use client"
import Link from "next/link"
import { useLanguage } from "@/lib/i18n/provider"
import { profileReadiness,readinessLabels,type ReadinessProfile } from "@/lib/profile-readiness"
export function ProfileReadinessCard({user}: {user:ReadinessProfile}) {
  const {language}=useLanguage(),en=language==="en",state=profileReadiness(user)
  if(state.ready)return null
  return <section data-localize="off" className="rounded-2xl border border-emerald-100 bg-[#f0f5ee] p-6 space-y-4"><h2 className="font-semibold text-lg">{en?"Let's make your plan personal":"Låt oss göra planen personlig"}</h2><p>{en?"Your profile needs a few details before we can create a personalized plan.":"Din profil behöver kompletteras innan vi kan skapa en personlig plan."}</p><ul className="grid gap-2 text-sm sm:grid-cols-2">{state.missing.map(key=><li className="rounded-lg bg-white/80 px-3 py-2" key={key}>{readinessLabels[language][key]}</li>)}</ul><p className="text-sm">{en?"These help us adapt food and training. Birth year and sex for energy calculation are optional. Previously saved suggestions are kept for you to review.":"Uppgifterna hjälper oss anpassa mat och träning. Födelseår och kön för energiberäkning är frivilliga. Tidigare sparade förslag finns kvar att granska."}</p><Link className="inline-flex min-h-12 items-center rounded-xl bg-primary px-5 font-medium text-white" href="/my-plan#body">{en?"Complete My Plan":"Komplettera min plan"}</Link></section>
}

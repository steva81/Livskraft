"use client"
import { useEffect,useRef,useState } from "react"
import Link from "next/link"
import { ArrowUpRight,Utensils,Dumbbell,CalendarDays,TrendingUp,MessageCircle,SlidersHorizontal,Leaf } from "lucide-react"
import { getHomeOverview } from "@/app/actions"
import { useLanguage } from "@/lib/i18n/provider"
import { profileReadiness,welcomeGreeting } from "@/lib/profile-readiness"
import { ProfileReadinessCard } from "@/components/profile-readiness"
export default function HomePage(){
 const {language}=useLanguage(),en=language==="en",started=useRef(false)
 const [data,setData]=useState<Awaited<ReturnType<typeof getHomeOverview>>>(null),[error,setError]=useState(false)
 useEffect(()=>{if(started.current)return;started.current=true;void getHomeOverview().then(setData).catch(()=>setError(true))},[])
 if(!data)return <p role="status">{error?(en?"Could not load your home. Reload to try again.":"Kunde inte läsa startsidan. Ladda om och försök igen."):(en?"Opening your home…":"Öppnar din startsida…")}</p>
 const ready=profileReadiness(data.user).ready
 const cards=[
  {href:"/dashboard",icon:Utensils,title:en?"Food & nutrition":"Mat & kost",text:en?"Today's meals, your own food and a little help along the way.":"Dagens måltider, din egen mat och lite stöd på vägen.",color:"bg-orange-50 text-orange-800"},
  {href:"/training",icon:Dumbbell,title:en?"Training":"Träning",text:en?"Find your next workout and make room for recovery.":"Hitta nästa pass och ge plats för återhämtning.",color:"bg-emerald-50 text-emerald-800"},
  {href:"/plan",icon:CalendarDays,title:en?"My week":"Min vecka",text:en?"Meals and training together, with room for real life.":"Mat och träning tillsammans, med utrymme för livet.",color:"bg-sky-50 text-sky-800"},
  {href:"/progress",icon:TrendingUp,title:en?"Progress":"Framsteg",text:en?"Weight, measurements, steps and the habits you are building.":"Vikt, mått, steg och vanorna du bygger.",color:"bg-violet-50 text-violet-800"},
  {href:"/coach",icon:MessageCircle,title:"Coach",text:en?"Talk about food, cravings, training or a day that changed.":"Prata om mat, sötsug, träning eller en dag som blev annorlunda.",color:"bg-rose-50 text-rose-800"},
  {href:"/my-plan",icon:SlidersHorizontal,title:en?"My Plan":"Min plan",text:en?"Your goals, preferences and everyday life. Always yours to change.":"Dina mål, önskemål och din vardag. Alltid möjliga att ändra.",color:"bg-stone-100 text-stone-800"},
 ]
 return <div className="mx-auto max-w-6xl space-y-6 pb-3" data-localize="off">
  <section className="relative overflow-hidden rounded-3xl bg-[#174d3d] p-6 text-white shadow-sm sm:p-10"><div aria-hidden="true" className="absolute -right-12 -top-16 h-64 w-64 rounded-full border-[32px] border-white/5"/><div className="relative max-w-2xl"><p className="mb-5 flex items-center gap-2 text-sm font-medium text-emerald-100"><Leaf size={18}/>{en?"YOUR LIFE. YOUR PACE.":"DITT LIV. DIN TAKT."}</p><h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{welcomeGreeting(data.user.name,data.firstVisit,en)}</h1><p className="mt-4 max-w-lg text-base leading-relaxed text-emerald-50">{ready?(en?"What would you like to focus on today? Start wherever feels right.":"Vad vill du fokusera på idag? Börja där det känns rätt."):(en?"A few details will help us shape your plan. We will take it one step at a time.":"Några uppgifter hjälper oss forma din plan. Vi tar ett steg i taget.")}</p></div></section>
  <ProfileReadinessCard user={data.user}/>
  <div className="flex items-end justify-between gap-3"><h2 className="text-xl font-semibold">{en?"Your everyday, a little easier":"Din vardag, lite enklare"}</h2><span className="hidden text-sm text-muted-foreground sm:block">{en?"Choose your next step":"Välj ditt nästa steg"}</span></div>
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{cards.map(card=><Link key={card.href} href={card.href} className="group flex min-h-60 flex-col rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition motion-safe:hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><div className="mb-4 flex items-center justify-between"><span className={"inline-flex h-12 w-12 items-center justify-center rounded-2xl "+card.color}><card.icon size={23}/></span><ArrowUpRight aria-hidden="true" className="text-gray-400 group-hover:text-primary" size={21}/></div><h3 className="text-lg font-semibold text-gray-900">{card.title}</h3><p className="mt-2 text-sm leading-relaxed text-gray-600">{card.text}</p><span className="mt-auto flex items-center gap-2 pt-5 text-sm font-semibold text-primary">{en?"Explore":"Utforska"}<ArrowUpRight size={16} aria-hidden="true"/></span></Link>)}</div>
  <nav aria-label={en?"More in Livskraft":"Mer i Livskraft"} className="flex flex-wrap gap-3">{[["/meals",en?"Recipes & shopping":"Recept & inköp"],["/profile",en?"My profile":"Min profil"],["/account",en?"Account settings":"Kontoinställningar"]].map(([href,label])=><Link key={href} href={href} className="inline-flex min-h-12 items-center rounded-xl border bg-white px-4 text-sm font-medium">{label}</Link>)}</nav>
 </div>
}

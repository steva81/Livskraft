"use client"
import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { Home, Utensils, ListChecks, Dumbbell, MoreHorizontal } from "lucide-react"
import { NavigationLink } from "./navigation-link"
import { useLanguage } from "@/lib/i18n/provider"

export const moreDestinations = [
  {href:"/meals",sv:"Recept / Mat",en:"Recipes / Food"},
  {href:"/progress",sv:"Framsteg",en:"Progress"},
  {href:"/coach",sv:"Coach",en:"Coach"},
  {href:"/my-plan",sv:"Min plan",en:"My Plan"},
  {href:"/profile",sv:"Profil",en:"Profile"},
  {href:"/account",sv:"Konto",en:"Account"},
]
export function MobileNavigation() {
  const pathname=usePathname(),{language}=useLanguage(),en=language==="en"
  const [open,setOpen]=useState(false),toggle=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null)
  useEffect(()=>{setOpen(false)},[pathname])
  useEffect(()=>{
    if(!open)return
    menu.current?.querySelector<HTMLAnchorElement>("a")?.focus()
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){setOpen(false);toggle.current?.focus()}}
    document.addEventListener("keydown",escape)
    return ()=>document.removeEventListener("keydown",escape)
  },[open])
  return <nav data-localize="off" aria-label={en?"Main navigation":"Huvudnavigation"} className="mobile-nav relative lg:hidden shrink-0 border-t bg-white grid grid-cols-5 items-center">
    {[
      {href:"/home",label:en?"Home":"Hem",Icon:Home},
      {href:"/dashboard",label:en?"Today":"Idag",Icon:Utensils},
      {href:"/plan",label:en?"Plan":"Plan",Icon:ListChecks},
      {href:"/training",label:en?"Training":"Träning",Icon:Dumbbell},
    ].map(({href,label,Icon})=><NavigationLink key={href} href={href} className="flex min-w-0 flex-col items-center p-2 text-xs text-gray-500 hover:text-primary"><Icon aria-hidden="true" className="h-5 w-5 mb-1"/>{label}</NavigationLink>)}
    <button ref={toggle} type="button" aria-expanded={open} aria-controls="mobile-more" className="flex min-h-12 min-w-0 flex-col items-center p-2 text-xs text-gray-500 hover:text-primary" onClick={()=>setOpen(!open)}><MoreHorizontal aria-hidden="true" className="h-5 w-5 mb-1"/>{en?"More":"Mer"}</button>
    {open&&<div ref={menu} id="mobile-more" className="absolute bottom-full inset-x-0 mb-2 mx-4 max-h-[60dvh] overflow-y-auto rounded-2xl border bg-white p-4 shadow-[0_8px_30px_rgb(0,0,0,0.12)] grid grid-cols-2 gap-3">
      {moreDestinations.map(item=><NavigationLink key={item.href} href={item.href} className="flex items-center justify-center text-center font-medium min-h-[3.5rem] rounded-xl bg-[#f7f9f5] text-[#244d36] hover:bg-[#eaf2ec] transition-colors" onClick={()=>setOpen(false)}>{en?item.en:item.sv}</NavigationLink>)}
    </div>}
  </nav>
}

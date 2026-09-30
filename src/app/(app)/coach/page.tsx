"use client"
import { PageHeading } from "@/components/page-heading"
import { WellnessPhoto } from "@/components/wellness-photo"
import { translate } from "@/lib/i18n/catalog"
import { Localize, useLanguage } from "@/lib/i18n/provider"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Send, Leaf } from "lucide-react"

import { getCoachOverview } from "@/app/actions"
import { displayValue } from "@/lib/display"
import { useMode } from "@/lib/ModeContext"
import { CoachText } from "@/components/coach-text"

interface Message {
  id: string | number
  role: "user" | "coach"
  text: string
}

const QUICK_PROMPTS = [
  "Vad kan jag äta nu?",
  "Jag har ingen kyckling hemma.",
  "Jag hann inte träna idag.",
  "Jag ska äta på restaurang ikväll.",
  "Jag har bara 20 minuter att träna.",
]

export default function CoachPage() {
  const { userId, sessionStatus } = useMode()
  if (sessionStatus === "loading") return <Localize>{<p>Laddar samtalet…</p>}</Localize>
  if (!userId) return <Localize>{<p>Logga in för att prata med coachen.</p>}</Localize>
  return <Localize key={userId}>{<UserCoachPage key={userId} />}</Localize>
}

function UserCoachPage() {
  const {language}=useLanguage()
  const { mode } = useMode()
  const conversation = useRef<HTMLDivElement>(null)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "coach",
      text: "Hej! Jag är din Livskraft Coach. Har du frågor om dagens mat, behöver byta ett träningspass, eller vill ha tips för en oväntad situation?",
    },
  ])
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof getCoachOverview>>>(null)
  const [overviewError, setOverviewError] = useState(false)
  const [showPrevious,setShowPrevious]=useState(false)
  const [hasHistory,setHasHistory]=useState(false)
  const [previousMessages,setPreviousMessages]=useState<Message[]>([])
  const [historyReady, setHistoryReady] = useState(false)
  const [historyError, setHistoryError] = useState("")
  const [aiCoachEnabled,setAICoachEnabled] = useState<boolean|null>(null)
  useEffect(() => {
    let active = true
    fetch("/api/coach", { cache: "no-store" }).then(async res => {
      if (!res.ok) throw new Error("History unavailable")
      const data = await res.json() as { messages: Message[]; hasHistory:boolean; aiCoachEnabled:boolean|null }
      if (active) { setMessages(previous => [previous[0], ...data.messages]); setAICoachEnabled(typeof data.aiCoachEnabled==="boolean"?data.aiCoachEnabled:null); setHistoryReady(true); setHasHistory(data.hasHistory) }
    }).catch(() => { if (active) setHistoryError("Kunde inte läsa historiken. Ladda om sidan för att försöka igen.") })
    return () => { active = false }
  }, [])
  useEffect(() => { getCoachOverview().then(setOverview).catch(() => setOverviewError(true)) }, [])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (messages.length>1 && conversation.current) conversation.current.scrollTop = conversation.current.scrollHeight
  }, [messages, loading])

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading || !historyReady || aiCoachEnabled !== true) return
    setHistoryError("")

    const userMsg: Message = { id: Date.now(), role: "user", text }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      })
      const data = (await res.json()) as { reply?: string; error?: string; saved?: boolean }
      if (res.status===403 && data.error==="ai_coach_disabled") {
        // Account may have disabled AI after this tab loaded. Keep the draft,
        // remove the rejected optimistic message and show the existing settings notice.
        setAICoachEnabled(false)
        setInput(text)
        setMessages(previous=>previous.filter(message=>message.id!==userMsg.id))
        return
      }
      if (!res.ok || data.saved === false) setHistoryError("Det senaste meddelandet kunde inte sparas i historiken.")
      const replyText =
        res.status === 401
          ? "Du behöver vara inloggad för att prata med coachen."
          : (data.reply ?? "Tyvärr kunde jag inte svara just nu. Försök igen!")
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "coach", text: replyText },
      ])
    } catch {
      setHistoryError("Det gick inte att bekräfta att meddelandet sparades. Ladda om sidan för att kontrollera historiken.")
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "coach", text: "Något gick fel. Försök igen!" },
      ])
    } finally {
      setLoading(false)
    }
  }

  const clearHistory = async () => {
    if (loading || !window.confirm(translate("Vill du radera din sparade Coach-historik?",language))) return
    setLoading(true)
    try {
      const res = await fetch("/api/coach", { method: "DELETE" })
      if (!res.ok) throw new Error("Delete failed")
      setMessages(previous => previous.slice(0, 1))
      setHistoryError("")
      setHistoryReady(true)
      setPreviousMessages([]);setHasHistory(false);setShowPrevious(false)
    } catch { setHistoryError("Kunde inte radera historiken. Försök igen.") }
    finally { setLoading(false) }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  return <Localize>{(
    <div className="app-page max-w-4xl mx-auto flex flex-col gap-4">
      <div className="overflow-hidden rounded-[2rem] border border-[#e3e6d9] bg-white">
        <div className="h-48 sm:h-64 relative">
          <WellnessPhoto src="/images/lifestyle/coach.png" className="w-full h-full object-cover object-center" />
        </div>
        <div className="p-6 sm:p-8 lg:p-10 border-t">
          <PageHeading section="coach" />
          <p className="text-lg text-muted-foreground mt-2">Din personliga guide för kost, träning och vardagsrörelse.</p>
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_220px]"><div className="min-w-0 flex flex-col gap-5">
      {historyReady&&aiCoachEnabled!==true&&<div data-localize="off" className="rounded-2xl border border-[#d3dfd6] bg-[#fcfdfa] p-5 shadow-sm"><div className="flex items-center gap-3 mb-2"><Leaf className="h-5 w-5 text-[#244d36]"/><h3 className="font-semibold text-[#244d36]">{language==="en"?"AI Coach is off":"AI Coach är avstängd"}</h3></div><p className="text-sm text-[#465c4c] mb-4">{language==="en"?"You can activate AI Coach in Account settings to get personal, conversational responses about food, training and wellness.":"Du kan aktivera AI Coach under Kontoinställningar för att få personliga, samtalande svar om mat, träning och hälsa."}</p><a className="inline-flex h-9 items-center justify-center rounded-lg bg-[#244d36] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1a3827]" href="/account">{language==="en"?"Open Account settings":"Öppna Kontoinställningar"}</a></div>}
      {overviewError && <p role="status" className="text-sm">Kunde inte läsa dagens översikt. Ladda om sidan för att försöka igen.</p>}
      {historyError && <p role="alert" className="text-sm text-red-700">{historyError}</p>}
      {overview&&!overview.ready&&<p data-localize="off" className="rounded-xl border p-4">{language==="en"?"Complete My Plan for personal recommendations. General guidance is available meanwhile.":"Komplettera Min plan för personliga rekommendationer. Under tiden finns allmänna råd."} <a className="underline" href="/my-plan">{language==="en"?"Complete My Plan":"Komplettera min plan"}</a></p>}
      {overview?.ready && <div className="rounded-[1.5rem] bg-[#f0f5eb] border border-[#dfe7d8] p-6 space-y-4 text-sm">
        <p className="text-lg font-semibold text-[#244d36]">Hej {overview.name}, vad behöver du idag?</p>
        <div className="grid gap-3 sm:grid-cols-2 text-[#465c4c]">
          <div className="bg-white/60 p-3 rounded-xl"><p className="font-medium text-[#244d36] mb-1">Nästa måltid</p><p>{overview.nextMeal??(overview.hasMealPlan ? "Alla planerade måltider är klara." : "Ingen matplan som matchar din profil just nu.")}</p></div>
          <div className="bg-white/60 p-3 rounded-xl"><p className="font-medium text-[#244d36] mb-1">Dagens pass</p><p>{overview.workout??"Vilodag från styrketräning"}</p></div>
          <div className="bg-white/60 p-3 rounded-xl"><p className="font-medium text-[#244d36] mb-1">Rörelse</p><p>{overview.steps.toLocaleString(language==="en"?"en-GB":"sv-SE")} av {overview.stepGoal.toLocaleString(language==="en"?"en-GB":"sv-SE")} steg</p></div>
        </div>
        {mode === "advanced" && <p className="text-[#617064] mt-2">Kostregler: {overview.restrictions.map(displayValue).join(", ") || "Inga angivna"}. Mat du ogillar: {overview.dislikedFoods.join(", ") || "Inga angivna"}.</p>}
      </div>}
      <Card className="flex flex-col overflow-hidden border border-[#e6eadd] bg-[#fcfdfa] shadow-sm rounded-3xl">
        <CardContent ref={conversation} role="log" aria-label="Samtal med coachen" aria-live="polite" className="min-h-64 max-h-[50dvh] overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`min-w-0 max-w-[92%] sm:max-w-[75%] whitespace-pre-wrap break-words p-4 sm:p-5 rounded-2xl text-[0.9375rem] leading-relaxed shadow-sm ${
                  msg.role === "user"
                    ? "bg-[#244d36] text-white rounded-br-sm"
                    : "bg-white border border-[#e6eadd] text-[#244d36] rounded-bl-sm"
                }`}
              >
                {msg.role === "coach" && (
                  <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-[#617064] uppercase tracking-wider">
                    <Leaf className="w-3.5 h-3.5 text-[#244d36]" /> Coach
                  </div>
                )}
                {msg.role==="user"?<span data-localize="off">{msg.text}</span>:<CoachText text={msg.text}/>}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-[#e6eadd] px-5 py-4 rounded-2xl rounded-bl-sm text-sm text-[#617064] shadow-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#244d36] animate-bounce" style={{animationDelay:"0ms"}}></div>
                <div className="w-2 h-2 rounded-full bg-[#244d36] animate-bounce" style={{animationDelay:"150ms"}}></div>
                <div className="w-2 h-2 rounded-full bg-[#244d36] animate-bounce" style={{animationDelay:"300ms"}}></div>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="mt-0 border-t border-[#e6eadd] bg-white p-4">
          <form onSubmit={handleSubmit} className="flex w-full items-center gap-3">
            <input
              type="text"
              maxLength={2000} aria-label="Din fråga till coachen"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={historyReady&&aiCoachEnabled!==true?(language==="en"?"AI Coach is off.":"AI Coach är avstängd."):translate("Skriv din fråga…",language)}
              className="min-w-0 flex-1 bg-[#f7f9f5] border border-[#d3dfd6] rounded-xl h-12 px-4 text-[0.9375rem] focus:outline-none focus:ring-2 focus:ring-[#244d36] disabled:opacity-50"
              disabled={loading || !historyReady || aiCoachEnabled!==true}
            />
            <Button type="submit" size="icon" className="h-12 w-12 shrink-0 rounded-xl bg-[#244d36] hover:bg-[#1a3827] text-white disabled:opacity-50 shadow-sm" aria-label="Skicka fråga" disabled={loading || !historyReady || aiCoachEnabled!==true || !input.trim()}>
              <Send className="h-5 w-5" />
            </Button>
          </form>
        </CardFooter>
      </Card>

      <div className="mt-2 space-y-4">
        <p className="text-sm font-medium text-[#244d36]">{language==="en"?"Need inspiration? Try asking:":"Behöver du inspiration? Prova att fråga:"}</p>
        <div className="flex flex-wrap gap-2.5">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => sendMessage(translate(p,language))}
              disabled={loading || !historyReady || aiCoachEnabled!==true}
              className="text-sm text-left bg-white border border-[#d3dfd6] text-[#354c3b] rounded-xl px-4 py-2.5 shadow-sm hover:border-[#244d36] hover:bg-[#f0f5eb] transition-all disabled:opacity-50 disabled:hover:bg-white disabled:hover:border-[#d3dfd6]"
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-[#617064] leading-relaxed">De senaste 50 frågorna och svaren sparas på ditt konto. De senaste 12 meddelandena används som samtalskontext. Undvik att skriva känsliga uppgifter.</p>
      </div><aside className="wellness-panel min-w-0 p-5 space-y-4"><p data-localize="off" className="text-[0.6875rem] font-bold tracking-widest text-[#617064] uppercase">{language==="en"?"CONVERSATIONS":"SAMTAL"}</p>
      <Button variant="outline" className="w-full h-11 rounded-xl border-[#d3dfd6] text-[#244d36] hover:bg-[#f0f5eb]" aria-expanded={showPrevious} onClick={async()=>{if(showPrevious){setShowPrevious(false);return}try{const res=await fetch("/api/coach?history=all",{cache:"no-store"});if(!res.ok)throw new Error();setPreviousMessages((await res.json()).messages);setShowPrevious(true)}catch{setHistoryError("Kunde inte läsa historiken. Ladda om sidan för att försöka igen.")}}}>Tidigare samtal</Button>
      {showPrevious && <section className="rounded-xl border border-[#e6eadd] bg-[#fcfdfa] p-4 space-y-4 max-h-96 overflow-auto" aria-label="Tidigare samtal">{previousMessages.length ? previousMessages.map(m=><p key={m.id} data-localize="off" className="text-sm text-[#354c3b] leading-relaxed whitespace-pre-wrap"><strong className="text-[#244d36]">{m.role==="coach"?"Coach":overview?.name}: </strong>{m.text}</p>) : <p className="text-sm text-[#617064]">Ingen tidigare historik.</p>}</section>}
      <Button variant="ghost" className="w-full h-11 rounded-xl text-[#617064] hover:bg-[#f0f5eb] hover:text-[#244d36]" onClick={clearHistory} disabled={loading || !historyReady || (!hasHistory && messages.length < 2)}>Radera historik</Button></aside></div>

    </div>
  )}</Localize>
}

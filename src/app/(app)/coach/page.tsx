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
  useEffect(() => {
    let active = true
    fetch("/api/coach", { cache: "no-store" }).then(async res => {
      if (!res.ok) throw new Error("History unavailable")
      const data = await res.json() as { messages: Message[]; hasHistory:boolean }
      if (active) { setMessages(previous => [previous[0], ...data.messages]); setHistoryReady(true); setHasHistory(data.hasHistory) }
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
    if (!text.trim() || loading || !historyReady) return
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

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_220px]"><div className="min-w-0 space-y-5">
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
      <Card className="flex flex-col overflow-hidden border-0 bg-transparent shadow-none">
        <CardContent ref={conversation} role="log" aria-label="Samtal med coachen" aria-live="polite" className="min-h-64 max-h-[50dvh] overflow-y-auto p-1 sm:p-2 space-y-5">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`min-w-0 max-w-[92%] sm:max-w-[80%] whitespace-pre-wrap break-words p-4 rounded-2xl text-sm leading-7 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-white border border-border shadow-sm rounded-bl-md"
                }`}
              >
                {msg.role === "coach" && (
                  <div className="flex items-center gap-1.5 mb-1 text-xs font-semibold text-primary">
                    <Leaf className="w-3 h-3" /> Coach
                  </div>
                )}
                <span data-localize={msg.role==="user"?"off":undefined}>{msg.text}</span>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted p-3 rounded-xl text-sm text-muted-foreground animate-pulse">
                Skriver…
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="mt-4 rounded-3xl border p-3 sm:p-4 bg-white shadow-sm">
          <form onSubmit={handleSubmit} className="flex w-full items-center gap-2">
            <input
              type="text"
              maxLength={2000} aria-label="Din fråga till coachen"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Skriv din fråga…"
              className="min-w-0 flex-1 bg-white border border-input rounded-xl h-12 px-4 text-base focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={loading || !historyReady}
            />
            <Button type="submit" size="icon" className="h-12 w-12" aria-label="Skicka fråga" disabled={loading || !historyReady || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardFooter>
      </Card>

      <div className="mt-2">
        <p className="text-sm font-medium text-[#244d36] mb-3">{language==="en"?"Need inspiration? Try asking:":"Behöver du inspiration? Prova att fråga:"}</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => sendMessage(translate(p,language))}
              disabled={loading || !historyReady}
              className="text-sm text-left bg-[#f0f5eb] border border-[#dfe7d8] text-[#244d36] rounded-xl px-4 py-3 hover:bg-[#e4eedb] transition disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">De senaste 50 frågorna och svaren sparas på ditt konto. De senaste 12 meddelandena används som samtalskontext. Undvik att skriva känsliga uppgifter.</p>
      </div><aside className="wellness-panel min-w-0 space-y-3 p-4"><p data-localize="off" className="wellness-eyebrow">{language==="en"?"CONVERSATIONS":"SAMTAL"}</p>
      <Button variant="outline" className="w-full" aria-expanded={showPrevious} onClick={async()=>{if(showPrevious){setShowPrevious(false);return}try{const res=await fetch("/api/coach?history=all",{cache:"no-store"});if(!res.ok)throw new Error();setPreviousMessages((await res.json()).messages);setShowPrevious(true)}catch{setHistoryError("Kunde inte läsa historiken. Ladda om sidan för att försöka igen.")}}}>Tidigare samtal</Button>
      {showPrevious && <section className="rounded border p-4 space-y-3 max-h-96 overflow-auto" aria-label="Tidigare samtal">{previousMessages.length ? previousMessages.map(m=><p key={m.id} data-localize="off" className="text-sm whitespace-pre-wrap"><strong>{m.role==="coach"?"Coach":overview?.name}: </strong>{m.text}</p>) : <p>Ingen tidigare historik.</p>}</section>}
      <Button variant="ghost" className="w-full text-muted-foreground" onClick={clearHistory} disabled={loading || !historyReady || !hasHistory && messages.length < 2}>Radera historik</Button></aside></div>

    </div>
  )}</Localize>
}

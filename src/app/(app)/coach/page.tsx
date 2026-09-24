"use client"
import { useEffect, useState } from "react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Send, Leaf } from "lucide-react"

import { getCoachOverview } from "@/app/actions"

interface Message {
  id: number
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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "coach",
      text: "Hej! Jag är din Livskraft Coach. Har du frågor om dagens mat, behöver byta ett träningspass, eller vill ha tips för en oväntad situation?",
    },
  ])
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof getCoachOverview>>>(null)
  useEffect(() => { getCoachOverview().then(setOverview).catch(() => {}) }, [])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return

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
      const data = (await res.json()) as { reply?: string; error?: string }
      const replyText =
        res.status === 401
          ? "Du behöver vara inloggad för att prata med coachen."
          : (data.reply ?? "Tyvärr kunde jag inte svara just nu. Försök igen!")
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "coach", text: replyText },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "coach", text: "Något gick fel. Försök igen!" },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Livskraft Coach</h1>
        <p className="text-muted-foreground">Din personliga guide för kost, träning och vardagsrörelse.</p>
      </div>

      {messages.length===1 && overview && <Card><CardContent className="p-4 space-y-2 text-sm">
        <p className="font-semibold">Hej {overview.name}, vad behöver du idag?</p>
        <p>Nästa måltid: {overview.nextMeal??"Alla planerade måltider är klara, eller så saknas matplan."}</p>
        <p>Träning: {overview.workout??"Vilodag från styrketräning"}</p>
        <p>{overview.steps.toLocaleString("sv-SE")} av {overview.stepGoal.toLocaleString("sv-SE")} steg</p>
      </CardContent></Card>}
      <Card className="flex flex-col overflow-hidden">
        <CardContent className="max-h-[55vh] overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {msg.role === "coach" && (
                  <div className="flex items-center gap-1.5 mb-1 text-xs font-semibold text-primary">
                    <Leaf className="w-3 h-3" /> Coach
                  </div>
                )}
                {msg.text}
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

        <CardFooter className="p-3 bg-muted/50 border-t">
          <form onSubmit={handleSubmit} className="flex w-full items-center gap-2">
            <input
              type="text"
              maxLength={2000} aria-label="Din fråga till coachen"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Skriv din fråga…"
              className="flex-1 bg-white border border-input rounded-md h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={loading}
            />
            <Button type="submit" size="icon" disabled={loading}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardFooter>
      </Card>

      {/* Quick-prompt chips */}
      <div className="flex flex-wrap gap-2">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => sendMessage(p)}
            disabled={loading}
            className="text-xs bg-white border rounded-full px-3 py-1.5 hover:bg-gray-50 transition disabled:opacity-50"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}

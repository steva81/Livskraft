import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { getCoachReply } from "@/lib/coach-service"
import { getCoachContext } from "@/app/actions"
import { readCoachHistory, saveCoachExchange } from "@/lib/coach-history"
import prisma from "@/lib/prisma"

export async function GET() {
  const session = await getAuthSession()
  if (!session?.user?.id) return NextResponse.json({error:"Logga in först."},{status:401})
  return NextResponse.json({ messages: await readCoachHistory(session.user.id) }, { headers: { "Cache-Control": "no-store" } })
}

export async function DELETE() {
  const session = await getAuthSession()
  if (!session?.user?.id) return NextResponse.json({error:"Logga in först."},{status:401})
  await prisma.coachExchange.deleteMany({ where: { userId: session.user.id } })
  return NextResponse.json({ success: true })
}

export async function POST(req: NextRequest) {
  const session = await getAuthSession()
  if (!session?.user?.id) return NextResponse.json({error:"Logga in först."},{status:401})
  const body = await req.json().catch(()=>null) as {message?:unknown}|null
  if (!body || typeof body.message!=="string" || !body.message.trim() || body.message.length>2000) {
    return NextResponse.json({error:"Skriv en fråga med högst 2 000 tecken."},{status:400})
  }
  const context = await getCoachContext()
  if (!context) return NextResponse.json({error:"Logga in först."},{status:401})
  const reply = await getCoachReply(body.message,context)
  try {
    await saveCoachExchange(session.user.id, body.message.trim(), reply)
    return NextResponse.json({ reply, saved: true })
  } catch {
    return NextResponse.json({ reply, saved: false })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { getCoachReply } from "@/lib/coach-service"
import { getCoachContext } from "@/app/actions"

export async function POST(req: NextRequest) {
  const session = await getAuthSession()
  if (!session?.user?.id) return NextResponse.json({error:"Logga in först."},{status:401})
  const body = await req.json().catch(()=>null) as {message?:unknown}|null
  if (!body || typeof body.message!=="string" || !body.message.trim() || body.message.length>2000) {
    return NextResponse.json({error:"Skriv en fråga med högst 2 000 tecken."},{status:400})
  }
  const context = await getCoachContext()
  if (!context) return NextResponse.json({error:"Logga in först."},{status:401})
  return NextResponse.json({reply:await getCoachReply(body.message,context)})
}

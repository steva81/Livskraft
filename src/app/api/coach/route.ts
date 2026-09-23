import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { getCoachReply } from "@/lib/coach-service"
import prisma from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json()) as { message: string }
  if (!body.message) {
    return NextResponse.json({ error: "No message" }, { status: 400 })
  }

  // Build context from the logged-in user's profile
  const user = await prisma.user.findUnique({ where: { email: session.user.email } })

  const context = {
    userName: user?.name?.split(" ")[0] ?? "Där",
    restrictions: user?.dietRestrictions ? (JSON.parse(user.dietRestrictions) as string[]) : [],
    stepGoal: user?.stepGoal ?? 8000,
  }

  const reply = await getCoachReply(body.message, context)
  return NextResponse.json({ reply })
}

import { getAuthSession } from "@/lib/auth"
import { readAICoachPreference, saveAICoachPreference } from "@/lib/coach-preference"

const reply = (data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}})

export async function GET() {
  const session = await getAuthSession()
  if (!session?.user?.id) return reply({error:"unauthorized"},401)
  return reply({aiCoachEnabled:await readAICoachPreference(session.user.id)})
}

export async function PATCH(request:Request) {
  const session = await getAuthSession()
  if (!session?.user?.id) return reply({error:"unauthorized"},401)
  // Explicit account preference changes must come from the configured app origin.
  let origin:string
  try {origin = new URL(process.env.NEXTAUTH_URL || request.url).origin}
  catch {return reply({error:"forbidden"},403)}
  if (request.headers.get("origin") !== origin) return reply({error:"forbidden"},403)
  const body = await request.json().catch(()=>null)
  if (!body || typeof body.aiCoachEnabled !== "boolean") return reply({error:"invalid_preference"},400)
  try {
    await saveAICoachPreference(session.user.id,body.aiCoachEnabled)
    return reply({aiCoachEnabled:body.aiCoachEnabled})
  } catch {return reply({error:"save_failed"},500)}
}

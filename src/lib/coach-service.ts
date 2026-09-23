/**
 * AI Coach service layer.
 *
 * - If AI_API_KEY is set in the environment, this module can be wired to a
 *   real LLM (e.g., Google Gemini, OpenAI) without any changes on the
 *   frontend — only this file and the API route need updating.
 * - If AI_API_KEY is absent, the deterministic mock below is used automatically.
 * - The API key is NEVER sent to the browser.
 */

export interface CoachMessage {
  role: "user" | "coach"
  text: string
}

export interface CoachContext {
  userName: string
  restrictions: string[]
  stepGoal: number
}

/**
 * Get a coach reply. Falls back to deterministic mock when no API key is configured.
 */
export async function getCoachReply(
  userMessage: string,
  context: CoachContext
): Promise<string> {
  const apiKey = process.env.AI_API_KEY

  if (apiKey) {
    // ── LIVE PATH ─────────────────────────────────────────────────────────────
    // Uncomment and adapt when connecting a real LLM:
    //
    // const response = await fetch("https://api.openai.com/v1/chat/completions", {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     Authorization: `Bearer ${apiKey}`,
    //   },
    //   body: JSON.stringify({
    //     model: "gpt-4o-mini",
    //     messages: [
    //       {
    //         role: "system",
    //         content: buildSystemPrompt(context),
    //       },
    //       { role: "user", content: userMessage },
    //     ],
    //   }),
    // })
    // const data = await response.json()
    // return data.choices[0].message.content as string
  }

  // ── MOCK PATH ────────────────────────────────────────────────────────────────
  return getDeterministicReply(userMessage, context)
}

function buildSystemPrompt(context: CoachContext): string {
  return `Du är Livskraft Coach — en hjälpsam, vänlig och icke-dömande hälsocoach.
Användarens namn: ${context.userName}.
Kostrestriktioner (hårda regler): ${context.restrictions.join(", ") || "inga"}.
Dagligt stegmål: ${context.stepGoal}.
Svara alltid på svenska. Ge konkreta, praktiska råd. Skuldbelägg aldrig användaren.
Rekommendera aldrig läkemedel eller medicinska behandlingar.`
}

function getDeterministicReply(input: string, ctx: CoachContext): string {
  const low = input.toLowerCase()
  const name = ctx.userName

  if (low.includes("kyckling")) {
    return `Inga problem, ${name}! Prova halloumi, tofu eller ägg istället — de är lika snabba att tillaga och passar din kostprofil.`
  }
  if (low.includes("träna") || low.includes("gym")) {
    return `Det händer! Missat ett pass är ingen katastrof. Vill du ta ett kort 10-minuterspass hemma istället, eller vänta till imorgon? Nästa veckas plan justeras inte automatiskt med extra pass.`
  }
  if (low.includes("restaurang") || low.includes("äta ute")) {
    return `Härligt! Njut av middagen. Välj gärna något proteinrikt och be om såsen vid sidan av. En enstaka restaurangkväll påverkar inte din långsiktiga plan.`
  }
  if (low.includes("tid") || low.includes("20 min") || low.includes("lite tid")) {
    return `Med 20 minuter räcker det utmärkt! Prova ett snabbt hemmapass: 3 × 10 armhävningar, 3 × 15 knäböj, 3 × 45 sek plankan. Klart!`
  }
  if (low.includes("vad kan jag äta") || low.includes("vad ska jag äta")) {
    const hint = ctx.restrictions.length > 0
      ? `Kom ihåg att hålla dig till din ${ctx.restrictions.join("/")} profil.`
      : ""
    return `Kolla skafferiet! En snabb omelett med spenat och tomat tar 5 minuter och ger dig bra protein. ${hint}`
  }
  if (low.includes("motivat")) {
    return `Du gör bättre än du tror, ${name}. Kom ihåg varför du startade — varje litet steg räknas, bokstavligen! 🌿`
  }

  return `Jag förstår, ${name}. Berätta mer om situationen så hjälper jag dig hitta ett praktiskt alternativ utan att det påverkar din plan negativt.`
}

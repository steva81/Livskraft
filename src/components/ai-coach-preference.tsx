"use client"
import { useLanguage } from "@/lib/i18n/provider"

export async function setAICoachPreference(enabled:boolean):Promise<boolean> {
  const response = await fetch("/api/coach/preference",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({aiCoachEnabled:enabled})})
  if (!response.ok) throw new Error("Preference unavailable")
  const data = await response.json()
  if (data.aiCoachEnabled !== enabled) throw new Error("Preference unavailable")
  return enabled
}

export function AICoachPrivacy() {
  const {language} = useLanguage()
  return <details data-localize="off" className="text-sm">
    <summary className="cursor-pointer underline">{language==="en"?"Privacy details":"Läs mer om integritet"}</summary>
    <p className="mt-2">{language==="en"?"For activity questions, Gemini may also receive a compact summary of the last seven calendar days: logged workouts and exercise names, recorded steps (missing data stays unknown), counts of registered meals per day, and today's planned workout or rest day. No workout notes or full records are sent.":"För aktivitetsfrågor kan Gemini även få en kompakt sammanfattning av de senaste sju kalenderdagarna: registrerade pass och övningsnamn, registrerade steg (saknade uppgifter förblir okända), antal registrerade måltider per dag samt dagens planerade pass eller vilodag. Träningsanteckningar och fullständiga poster skickas inte."}</p>
    <p className="mt-2">{language==="en"?"Google Gemini receives your question, up to 12 recent messages from your current login (at most 1,000 characters each), language, and relevant Coach suggestions such as meals, workouts, dietary needs or logged steps. Your account identity, email, password, photos and full profile are not sent. Your own messages may contain personal details; avoid sensitive information. Livskraft saves conversations as before. Deleting Livskraft history does not retract information already sent to Google. Medical and unsafe requests receive safety guidance; temporary service failures are handled automatically.":"Google Gemini får din fråga, högst 12 senaste meddelanden från aktuell inloggning (högst 1 000 tecken per meddelande), språk och relevanta Coach-förslag om till exempel mat, träning, kostbehov eller registrerade steg. Kontoidentitet, e-post, lösenord, foton och hela profilen skickas inte. Dina egna meddelanden kan innehålla personuppgifter; undvik känsliga uppgifter. Livskraft sparar samtal som tidigare. Att radera Livskrafts historik återkallar inte uppgifter som redan skickats till Google. Medicinska och osäkra frågor får säkerhetsråd; tillfälliga tjänstefel hanteras automatiskt."}</p>
  </details>
}

export function AICoachInformation() {
  const {language}=useLanguage()
  return <section data-localize="off" className="wellness-panel p-5 sm:p-6 space-y-3">
    <h2 className="font-semibold">{language==="en"?"AI Coach & privacy":"AI Coach & integritet"}</h2>
    <p className="text-sm">{language==="en"?"After you activate AI Coach, Google Gemini supports your conversations automatically. Activation and privacy information are available on the Coach page.":"När du har aktiverat AI Coach hjälper Google Gemini till i dina samtal automatiskt. Aktivering och integritetsinformation finns på Coach-sidan."}</p>
    <AICoachPrivacy />
    <a href="/coach" className="underline">{language==="en"?"Open Coach":"Öppna Coach"}</a>
  </section>
}

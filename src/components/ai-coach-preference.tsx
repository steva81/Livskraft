"use client"
import { useEffect, useState } from "react"
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
    <p className="mt-2">{language==="en"?"Google Gemini receives your question, up to 12 recent messages from your current login (at most 1,000 characters each), language, and relevant Coach suggestions such as meals, workouts, dietary needs or logged steps. Your account identity, email, password, photos and full profile are not sent. Your own messages may contain personal details; avoid sensitive information. Livskraft saves conversations as before. Turning AI off or deleting Livskraft history does not retract information already sent to Google. Medical and unsafe requests use local safety replies; provider failures also fall back locally. You can change this preference in Account.":"Google Gemini får din fråga, högst 12 senaste meddelanden från aktuell inloggning (högst 1 000 tecken per meddelande), språk och relevanta Coach-förslag om till exempel mat, träning, kostbehov eller registrerade steg. Kontoidentitet, e-post, lösenord, foton och hela profilen skickas inte. Dina egna meddelanden kan innehålla personuppgifter; undvik känsliga uppgifter. Livskraft sparar samtal som tidigare. Att stänga av AI eller radera Livskrafts historik återkallar inte uppgifter som redan skickats till Google. Medicinska och osäkra frågor får lokala säkerhetssvar; vid leverantörsfel används också lokal Coach. Du kan ändra valet under Konto."}</p>
  </details>
}

export function AICoachSettings() {
  const {language} = useLanguage()
  const [enabled,setEnabled] = useState<boolean|null>(null), [ready,setReady] = useState(false)
  const [busy,setBusy] = useState(false), [error,setError] = useState(false)
  useEffect(()=>{
    let active=true
    fetch("/api/coach/preference",{cache:"no-store"}).then(async response=>{
      if (!response.ok) throw new Error()
      const data=await response.json()
      if (active) {setEnabled(data.aiCoachEnabled === true);setReady(true)}
    }).catch(()=>{if(active)setError(true)})
    return ()=>{active=false}
  },[])
  return <section data-localize="off" className="wellness-panel p-5 sm:p-6 space-y-3">
    <h2 className="font-semibold">AI Coach</h2>
    <p className="text-sm">{language==="en"?"Use external AI for more flexible Coach responses. Google Gemini may receive your questions and limited recent Coach context.":"Använd extern AI för mer flexibla Coach-svar. Google Gemini kan få dina frågor och begränsad aktuell Coach-kontext."}</p>
    <AICoachPrivacy />
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" role="switch" aria-label="AI Coach" checked={enabled===true} disabled={!ready||busy} onChange={async event=>{
      const next=event.target.checked
      setBusy(true);setError(false)
      try {setEnabled(await setAICoachPreference(next))} catch {setError(true)} finally {setBusy(false)}
    }} />{enabled ? (language==="en"?"On":"På") : (language==="en"?"Off":"Av")}</label>
    {error&&<p role="alert" className="text-sm">{language==="en"?"Could not load or save your AI Coach preference. Please try again or reload.":"Kunde inte läsa eller spara ditt AI Coach-val. Försök igen eller ladda om."}</p>}
  </section>
}

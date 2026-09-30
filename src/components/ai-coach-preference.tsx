"use client"
import { useLanguage } from "@/lib/i18n/provider"
import { useEffect, useState } from "react"
import { Button } from "./ui/button"

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
  const [enabled,setEnabled]=useState(false),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(false)
  useEffect(()=>{
    let active=true
    fetch("/api/coach/preference",{cache:"no-store"}).then(async response=>{
      if(!response.ok)throw new Error("Preference unavailable")
      const data=await response.json()
      if(active){setEnabled(data.aiCoachEnabled===true);setReady(true)}
    }).catch(()=>{if(active)setError(true)})
    return()=>{active=false}
  },[])
  return <section data-localize="off" className="wellness-panel p-6 sm:p-8 space-y-5 bg-[#fcfdfa] border-[#e6eadd]">
    <div className="space-y-1">
      <h2 className="text-xl font-semibold text-[#244d36]">{language==="en"?"AI Coach & privacy":"AI Coach & integritet"}</h2>
      <p className="text-sm text-[#465c4c] leading-relaxed">{language==="en"?"AI Coach uses Google Gemini for more personal, conversational responses. Your questions and limited Coach context may be sent to Google. Medical and unsafe requests use Livskraft's safety handling.":"AI Coach använder Google Gemini för mer personliga och samtalande svar. Dina frågor och begränsad Coach-kontext kan skickas till Google. Medicinska och osäkra frågor använder Livskrafts säkerhetshantering."}</p>
    </div>
    <div className="bg-white rounded-xl p-4 border border-[#e6eadd]">
      <AICoachPrivacy />
    </div>
    <div className="pt-2">
      <label className="group flex min-h-14 cursor-pointer items-center justify-between rounded-xl border border-[#d3dfd6] bg-white px-5 shadow-sm transition-all hover:bg-[#f7f9f5]">
        <span className="font-medium text-[#244d36]">AI Coach · {ready?(enabled?(language==="en"?"On":"På"):(language==="en"?"Off":"Av")):(language==="en"?"Loading…":"Laddar…")}</span>
        <div className="relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#244d36]" style={{ backgroundColor: enabled ? "#244d36" : "#e2e8f0" }}>
          <input type="checkbox" role="switch" aria-label="AI Coach" className="sr-only" checked={enabled} disabled={!ready||busy} onChange={async event=>{
            const next=event.target.checked;setBusy(true);setError(false)
            try{setEnabled(await setAICoachPreference(next))}catch{setError(true)}finally{setBusy(false)}
          }}/>
          <span className="inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out" style={{ transform: enabled ? "translateX(24px)" : "translateX(4px)" }} />
        </div>
      </label>
    </div>
    {error&&<p role="alert" className="text-sm text-red-700 bg-red-50 p-3 rounded-lg">{language==="en"?"Could not load or save your AI Coach preference. Please try again or reload.":"Kunde inte läsa eller spara ditt AI Coach-val. Försök igen eller ladda om."}</p>}
  </section>
}

export function AICoachOnboarding({value,onChange,disabled=false}:{value:boolean;onChange:(value:boolean)=>void;disabled?:boolean}) {
  const {language}=useLanguage(),en=language==="en"
  return <section data-localize="off" className="space-y-4 rounded-2xl border border-[#d3dfd6] bg-[#fcfdfa] p-5 sm:p-6 shadow-sm">
    <div className="space-y-1">
      <h2 className="text-lg font-semibold text-[#244d36]">AI Coach</h2>
      <p className="text-[#354c3b]">{en?"Would you like to use AI Coach for more personal, conversational responses?":"Vill du använda AI Coach för mer personliga och samtalande svar?"}</p>
    </div>
    <div className="bg-white rounded-xl p-4 border border-[#e6eadd]">
      <p className="text-sm text-[#465c4c] mb-3">{en?"Livskraft uses Google Gemini. Your questions and limited Coach context may be sent to Google. Medical and unsafe requests still use Livskraft's safety handling. You can change your choice in Account settings.":"Livskraft använder Google Gemini. Dina frågor och begränsad Coach-kontext kan skickas till Google. Medicinska och osäkra frågor använder fortfarande Livskrafts säkerhetshantering. Du kan ändra valet under Kontoinställningar."}</p>
      <AICoachPrivacy/>
    </div>
    <div className="flex flex-wrap gap-3 pt-2">
      <Button type="button" disabled={disabled} aria-pressed={value} variant={value?"default":"outline"} className={value ? "bg-[#244d36] hover:bg-[#1a3827] text-white" : "border-[#d3dfd6] text-[#244d36] hover:bg-[#f0f5eb]"} onClick={()=>onChange(true)}>{en?"Activate AI Coach":"Aktivera AI Coach"}</Button>
      <Button type="button" disabled={disabled} aria-pressed={!value} variant={!value?"default":"outline"} className={!value ? "bg-[#244d36] hover:bg-[#1a3827] text-white" : "border-[#d3dfd6] text-[#244d36] hover:bg-[#f0f5eb]"} onClick={()=>onChange(false)}>{en?"Not now":"Inte nu"}</Button>
    </div>
  </section>
}

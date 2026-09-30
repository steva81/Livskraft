"use client"
import Image from "next/image"
import { bodyLabels } from "@/lib/body-data"
import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { getDailyNutrition, listOwnMeals, saveOwnMeal, savePhotoMeal, deleteOwnMeal, type OwnMealInput } from "@/app/nutrition-actions"
import { goalLabels, goalGuidance, parseNutrition, type Nutrition } from "@/lib/nutrition"
import { useMode } from "@/lib/ModeContext"
import { useLanguage } from "@/lib/i18n/provider"
import { type PhotoEstimate } from "@/lib/photo-meals"
import { analyzeMealPhoto, photoTask } from "@/lib/photo-meal-client"
import { browserUUID } from "@/lib/browser-uuid"
import { Button } from "./ui/button"
import { NutritionBalance } from "./nutrition-balance"
import { MealCamera } from "./meal-camera"

function localTime(date = new Date()) { return new Date(+date-date.getTimezoneOffset()*60000).toISOString().slice(0,16) }
function blank(): OwnMealInput { return {name:"",components:"",portion:"",mealType:"other",eatenAt:localTime(),nutrition:{calories:null,protein:null,carbs:null,fat:null,fibre:null}} }
export function DailyNutrition({refreshKey = "",onPlanChanged}: {refreshKey?: string;onPlanChanged?:()=>Promise<void>}) {
  const {mode}=useMode(), {language}=useLanguage(), en=language==="en"
  const t=(sv:string,enText:string)=>en?enText:sv
  const [data,setData]=useState<Awaited<ReturnType<typeof getDailyNutrition>> | null>(null)
  const [entries,setEntries]=useState<Awaited<ReturnType<typeof listOwnMeals>>>([])
  const [draft,setDraft]=useState<OwnMealInput | null>(null), [photo,setPhoto]=useState<string | null>(null)
  const [photoFile,setPhotoFile]=useState<File|null>(null),[estimate,setEstimate]=useState<PhotoEstimate|null>(null)
  const [photoAvailable,setPhotoAvailable]=useState(false), [photoToken,setPhotoToken]=useState<string|null>(null)
  const locked=useRef(false)
  const form=useRef<HTMLFormElement>(null),preview=useRef<HTMLDivElement>(null),result=useRef<HTMLDivElement>(null)
  const draftOpen=!!draft
  useEffect(()=>{if(draftOpen)form.current?.scrollIntoView({block:"start",behavior:"smooth"})},[draftOpen])
  useEffect(()=>{if(photo)preview.current?.scrollIntoView({block:"nearest",behavior:"smooth"})},[photo])
  useEffect(()=>{if(estimate)result.current?.scrollIntoView({block:"start",behavior:"smooth"})},[estimate])
  const [busy,setBusy]=useState(false), [error,setError]=useState("")
  const [cameraOpen,setCameraOpen]=useState(false)
  useEffect(()=>{if(!draftOpen)setCameraOpen(false)},[draftOpen])
  const refresh=async()=>{const [d,e]=await Promise.all([getDailyNutrition(),listOwnMeals()]);setData(d);setEntries(e)}
  useEffect(()=>{void refresh().catch(()=>setError(en?"Could not load nutrition.":"Kunde inte läsa näringsöversikten."))},[refreshKey,en])
  useEffect(()=>{const controller=new AbortController();fetch("/api/photo-meal",{signal:controller.signal,cache:"no-store"}).then(r=>r.json()).then(r=>setPhotoAvailable(r.available===true)).catch(()=>setPhotoAvailable(false));return()=>controller.abort()},[])
  useEffect(()=>()=>{if(photo)URL.revokeObjectURL(photo)},[photo])
  const perform=async(action:()=>Promise<void>)=>{if(locked.current)return;locked.current=true;setBusy(true);setError("");try{await action();await photoTask(refresh())}catch(e){setError(e instanceof Error&&e.message!=="timeout"?e.message:t("Kunde inte bekräfta sparandet. Försök igen med samma utkast.","Could not confirm the save. Retry with the same draft."))}finally{locked.current=false;setBusy(false)}}
  const choosePhotoFile=(file:File|undefined)=>{
    if(!file)return
    if(file.size>10*1024*1024||!["image/jpeg","image/png","image/webp"].includes(file.type)){
      setError(t("Välj JPG, PNG eller WebP under 10 MB.","Choose JPG, PNG or WebP under 10 MB."));return
    }
    setPhoto(URL.createObjectURL(file));setPhotoFile(file);setEstimate(null);setPhotoToken(null);setError("")
  }
  const choosePhoto=(event:ChangeEvent<HTMLInputElement>)=>{choosePhotoFile(event.currentTarget.files?.[0]);event.currentTarget.value=""}
  return <section className="nutrition-panel rounded-2xl border bg-white p-5 sm:p-6 space-y-4" data-localize="off">
    <h2 className="text-xl font-semibold">{t("Dagens energi och näring","Today's energy and nutrition")}</h2>
    <Button disabled={busy} onClick={()=>{setCameraOpen(false);setDraft(blank());setPhoto(null);setPhotoFile(null);setEstimate(null);setPhotoToken(null)}}>{t("Lägg till egen måltid","Add own meal")}</Button>
    <p className="text-sm">{t("Registrera med foto eller fyll i manuellt.","Log with a photo or enter manually.")}</p>
    {data && <>
      {data.target && <p className="text-sm">{bodyLabels[language][data.target.confidence]}</p>}
      {data.ready&&<><p className="font-medium">{goalLabels[language][data.goal]}</p><p>{goalGuidance(data.goal,en)}</p></>}
      <p className="text-sm">{t("Uppskattningar, inte exakta behov. Oregistrerad mat och okända näringsvärden ingår inte i summan.","Estimates, not exact needs. Unlogged food and unknown nutrients are not included in totals.")}</p>
      {mode==="advanced" && data.target ? <>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[[t("Energimål","Energy target"),`${data.target.calories} kcal`],[t("Planerat","Planned"),data.planned.unknown.calories ? t("Ofullständigt","Incomplete") : `${Math.round(data.planned.sum.calories)} kcal`],[t("Registrerat","Logged"),`${Math.round(data.consumed.sum.calories)} kcal`],[t("Ungefär kvar","Approximately remaining"),data.consumed.unknown.calories ? t("Okänt","Unknown") : `${Math.max(0,Math.round(data.target.calories-data.consumed.sum.calories))} kcal`],["Protein",`${Math.round(data.consumed.sum.protein)} / ${data.target.protein} g`],[t("Registrerade kolhydrater","Logged carbs"),`${Math.round(data.consumed.sum.carbs)} g`],[t("Registrerat fett","Logged fat"),`${Math.round(data.consumed.sum.fat)} g`],[t("Kolhydrater / fett, vägledning","Carbs / fat, guidance"),`${data.target.carbs} / ${data.target.fat} g`]].map(([label,value])=><div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="font-medium">{value}</dd></div>)}
        </dl><p className="text-sm">{data.target.method==="mifflin-st-jeor"?`Mifflin–St Jeor · ${t("Uppskattad viloförbrukning","Estimated resting energy")}: ${data.target.baseline} kcal` : t("Grov viktbaserad uppskattning. Ange frivilligt födelseår och kön för beräkning i Min plan för en formelbaserad uppskattning.","Broad weight-based estimate. Optionally add birth year and sex for calculation in My Plan for a formula-based estimate.")}</p>
      </> : <p>{data.consumed.count===0?t("Registrera måltider om du vill få en överblick. Ät regelbundet och efter hunger.","Log meals if you would like an overview. Eat regularly and according to hunger."):t("Fortsätt med vanliga måltider, en proteinkälla och fiberrika tillbehör. En enskild dag avgör inte dina framsteg.","Continue with regular meals, a protein source and fibre-rich sides. One day does not determine your progress.")}</p>}
      <p className="text-sm">{t("Avklarade planerade måltider","Completed planned meals")}: {data.completedMeals}/{data.plannedMeals} · {t("Egna måltider idag","Own meals today")}: {data.ownMeals.length}</p>
      {(data.consumed.unknown.calories>0||data.consumed.unknown.protein>0)&&<p>{t("Summan är ofullständig: vissa måltider saknar energi eller protein.","Totals are incomplete: some meals have unknown energy or protein.")}</p>}
    </>}
    {mode==="simple" && data?.target && data.consumed.count>0 && data.consumed.unknown.protein===0 && data.consumed.sum.protein<data.target.protein*0.7 && <p>{t("Lite mer protein skulle passa till nästa vanliga måltid om du är hungrig.","A little more protein could fit your next regular meal if you are hungry.")}</p>}

    {draft && <form ref={form} className="space-y-3 border-t pt-4 scroll-mt-4" onSubmit={e=>{e.preventDefault();void perform(async()=>{if(photoToken)await photoTask(savePhotoMeal({token:photoToken,name:draft.name,components:draft.components,portion:draft.portion,mealType:draft.mealType,nutrition:draft.nutrition}));else await saveOwnMeal({...draft,eatenAt:new Date(draft.eatenAt).toISOString()});setDraft(null);setPhoto(null);setPhotoFile(null);setEstimate(null);setPhotoToken(null)})}}>
      <fieldset disabled={busy} className="space-y-3">
      <label className="block">{t("Måltidens namn","Meal name")}<input required maxLength={120} className="w-full border rounded p-2" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
      <label className="block">{t("Livsmedel och ingredienser","Foods and components")}<textarea maxLength={2000} className="w-full border rounded p-2" value={draft.components} onChange={e=>setDraft({...draft,components:e.target.value})}/></label>
      <label className="block">{t("Portion / mängd","Portion / quantity")}<input maxLength={200} className="w-full border rounded p-2" value={draft.portion} onChange={e=>setDraft({...draft,portion:e.target.value})}/></label>
      {photoToken&&<p>{t("Sparas som dagens intag när du bekräftar.","Saved to today’s intake when you confirm.")}</p>}
      <div className="grid gap-3 sm:grid-cols-2"><label>{t("Måltidstyp","Meal type")}<select className="w-full border rounded p-2" value={draft.mealType} onChange={e=>setDraft({...draft,mealType:e.target.value})}>{["breakfast","lunch","dinner","snack","other"].map((v,i)=><option key={v} value={v}>{(en?["Breakfast","Lunch","Dinner","Snack","Other"]:["Frukost","Lunch","Middag","Mellanmål","Annat"])[i]}</option>)}</select></label><label>{t("Datum och tid","Date and time")}<input disabled={!!photoToken} required type="datetime-local" className="w-full min-w-0 border rounded p-2" value={draft.eatenAt} onChange={e=>setDraft({...draft,eatenAt:e.target.value})}/></label></div>
      <fieldset className="space-y-2"><legend>{t("Foto (frivilligt)","Photo (optional)")}</legend>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" className="h-11 rounded-xl px-6 border-[#d3dfd6] text-[#244d36] hover:bg-[#f0f5eb]" onClick={()=>setCameraOpen(true)}>{t("Ta foto","Take photo")}</Button>
          <label className="relative flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-[#d3dfd6] bg-white px-6 font-medium text-[#244d36] shadow-sm transition-colors hover:bg-[#f0f5eb] focus-within:ring-2 focus-within:ring-[#244d36]">{t("Välj bild","Choose image")}<input aria-label={t("Välj bild","Choose image")} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onClick={()=>setCameraOpen(false)} onChange={choosePhoto}/></label>
        </div>
      </fieldset>
      {cameraOpen&&<MealCamera en={en} onUse={choosePhotoFile} onClose={()=>setCameraOpen(false)}/>}
      {photo&&<Button type="button" variant="outline" className="h-9 rounded-lg border-[#d3dfd6] text-[#617064]" onClick={()=>{setPhoto(null);setPhotoFile(null);setEstimate(null);setPhotoToken(null)}}>{t("Ta bort bild","Remove image")}</Button>}
      {photo && <div ref={preview} className="relative aspect-video w-full overflow-hidden rounded-2xl bg-[#f7f9f5] border border-[#e6eadd] shadow-sm"><Image unoptimized fill sizes="(max-width: 768px) 100vw, 800px" src={photo} alt={t("Din måltid, endast lokal förhandsvisning","Your meal, local preview only")} className="object-cover"/></div>}
      <p className="text-sm">{t("När du väljer Analysera bild med AI skickas bilden till Googles externa AI-tjänst Gemini. Fotografera bara maten. Bilden förminskas och metadata tas bort. Livskraft sparar inte bilden. Ingen profil, hälsoinformation eller Coach-historik skickas.","When you choose Analyze image with AI, the image is sent to Google's external AI service Gemini. Photograph only the food. The image is resized and metadata removed. Livskraft does not store the image. No profile, health information or Coach history is sent.")}</p>
      <Button type="button" variant="outline" disabled={!photoAvailable||!photoFile||busy||cameraOpen} onClick={()=>void perform(async()=>{
        if(!photoFile)return
        try {
          const result=await photoTask(analyzeMealPhoto(photoFile,language,AbortSignal.timeout(30000)))
          const token=photoToken??browserUUID()
          setEstimate(result);setPhotoToken(previous=>previous??token)
          setDraft({...draft,id:undefined,name:result.items.map(item=>item.name).join(", ").slice(0,120),components:result.items.map(item=>`${item.name}${item.estimatedGrams===null?"":` · ~${item.estimatedGrams} g`}`).join("\n").slice(0,2000),portion:"",eatenAt:localTime(),nutrition:result.total})
        } catch(e) {
          const code=e instanceof Error&&e.message!=="timeout"?e.message:""
          throw new Error(code==="unavailable"?t("Foto-AI är inte tillgänglig. Fyll i manuellt eller försök igen senare.","Photo AI is unavailable. Enter manually or try again later."):code==="image_size"?t("Bilden är för stor. Välj en mindre bild.","The image is too large. Choose a smaller image."):code==="image_type"?t("Bilden kunde inte läsas. Välj JPG, PNG eller WebP.","Could not read the image. Choose JPG, PNG or WebP."):t("Bilden kunde inte analyseras tillförlitligt. Försök igen, välj en annan bild eller fyll i manuellt.","Could not reliably analyze the image. Retry, choose another image or enter manually."))
        }
      })}>{busy?t("Arbetar…","Working…"):t("Analysera bild med AI","Analyze image with AI")}</Button>
      {!photoAvailable&&<p className="text-sm">{t("Foto-AI är inte tillgänglig. Du kan fylla i måltiden manuellt.","Photo AI is unavailable. You can enter the meal manually.")}</p>}
      {estimate&&<div ref={result} className="mt-4 rounded-2xl border border-[#d3dfd6] bg-[#fcfdfa] p-5 sm:p-6 shadow-sm space-y-5 scroll-mt-4" role="status">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e6eadd] pb-4">
          <div>
            <h3 className="text-lg font-semibold text-[#244d36]">{t("AI-uppskattning","AI estimate")}</h3>
            <p className="text-sm text-[#465c4c]">{t("Granska och korrigera värdena","Review and correct the values")}</p>
          </div>
          <div className={`inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${estimate.confidence==="low"?"bg-amber-100 text-amber-800":estimate.confidence==="medium"?"bg-blue-100 text-blue-800":"bg-green-100 text-green-800"}`}>
            {t("Säkerhet:","Confidence:")} {estimate.confidence==="low"?t("Låg","Low"):estimate.confidence==="medium"?t("Medel","Medium"):t("Hög","High")}
          </div>
        </div>
        <div className="grid gap-3">
          {estimate.items.map((item,index)=><div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-[#e6eadd] bg-white p-4 shadow-sm">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[#244d36] truncate">{item.name}</p>
              <p className="text-sm text-[#617064]">{item.estimatedGrams===null?t("Mängd okänd","Quantity unknown"):`~${item.estimatedGrams} g`}</p>
            </div>
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 text-sm text-[#465c4c]">
              <span className="font-medium text-[#244d36] bg-[#f0f5eb] px-2 py-1 rounded-md">{item.calories} kcal</span>
              <span className="opacity-75">{t("P","P")}:{item.protein}</span>
              <span className="opacity-75">{t("K","C")}:{item.carbs}</span>
              <span className="opacity-75">{t("F","F")}:{item.fat}</span>
              <span className="opacity-75">{t("Fi","Fi")}:{item.fibre}</span>
            </div>
          </div>)}
        </div>
        {estimate.note && <p className="text-sm text-[#465c4c] bg-white p-4 rounded-xl border border-[#e6eadd]">{estimate.note}</p>}
      </div>}
      <details open={!!photoToken||undefined}><summary>{photoToken?t("Granska näringsvärden för hela måltiden","Review nutrition for the whole meal"):t("Frivilliga näringsvärden för hela portionen (uppskattade)","Optional nutrition for the entire portion (estimated)")}</summary><div className="grid grid-cols-2 gap-3 pt-3">{(["calories","protein","carbs","fat","fibre"] as (keyof Nutrition)[]).map((key,i)=><label key={key}>{(en?["Energy (kcal)","Protein (g)","Carbs (g)","Fat (g)","Fibre (g)"]:["Energi (kcal)","Protein (g)","Kolhydrater (g)","Fett (g)","Fibrer (g)"])[i]}<input className="w-full border rounded p-2" required={!!photoToken&&key!=="fibre"} type="number" min="0" max={key==="calories"?10000:1000} step="any" value={draft.nutrition[key]??""} onChange={e=>setDraft({...draft,nutrition:{...draft.nutrition,[key]:e.target.value===""?null:Number(e.target.value)}})}/></label>)}</div></details>
      <p className="text-sm">{t("Granska ingredienser, mängd och värden före sparande. Tomma näringsfält förblir okända.","Review components, portion and values before saving. Empty nutrition fields remain unknown.")}</p>
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy}>{photoToken?t("Lägg till i idag","Add to today"):t("Bekräfta och spara","Confirm and save")}</Button><Button type="button" variant="outline" onClick={()=>{setDraft(null);setPhoto(null);setPhotoFile(null);setEstimate(null);setPhotoToken(null)}}>{t("Avbryt","Cancel")}</Button></div>
      </fieldset>
    </form>}
    <details><summary>{t("Tidigare måltider","Previous meals")}</summary><ul className="space-y-3 mt-3">{entries.map(meal=><li key={meal.id} className="border rounded p-3 space-y-2"><p className="font-medium break-words">{meal.name}</p><p className="text-sm break-words">{meal.components} · {meal.portion}</p><p className="text-sm">{new Date(meal.eatenAt).toLocaleString(en?"en-GB":"sv-SE")} · {t("Näringsvärden är uppskattade","Nutrition values are estimates")}</p><div className="flex flex-wrap gap-2"><Button disabled={busy} size="sm" variant="outline" onClick={()=>{setPhotoToken(null);setEstimate(null);setPhotoFile(null);setDraft({...meal,eatenAt:localTime(new Date(meal.eatenAt)),nutrition:parseNutrition(meal.nutrition)});setPhoto(null)}}>{t("Redigera","Edit")}</Button><Button size="sm" variant="outline" disabled={busy} onClick={()=>void perform(()=>deleteOwnMeal(meal.id))}>{t("Ta bort","Delete")}</Button></div></li>)}</ul></details>
    {error&&<p role="alert">{error}</p>}
    <NutritionBalance onChanged={async()=>{await refresh();await onPlanChanged?.()}}/>
  </section>
}

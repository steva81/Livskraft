"use client"
import Image from "next/image"
import { bodyLabels } from "@/lib/body-data"
import { useEffect, useState } from "react"
import { getDailyNutrition, listOwnMeals, saveOwnMeal, deleteOwnMeal, type OwnMealInput } from "@/app/nutrition-actions"
import { goalLabels, goalGuidance, parseNutrition, type Nutrition } from "@/lib/nutrition"
import { useMode } from "@/lib/ModeContext"
import { useLanguage } from "@/lib/i18n/provider"
import { photoMealProvider, type PhotoSuggestion } from "@/lib/photo-meals"
import { Button } from "./ui/button"
import { NutritionBalance } from "./nutrition-balance"

function localTime(date = new Date()) { return new Date(+date-date.getTimezoneOffset()*60000).toISOString().slice(0,16) }
function blank(): OwnMealInput { return {name:"",components:"",portion:"",mealType:"other",eatenAt:localTime(),nutrition:{calories:null,protein:null,carbs:null,fat:null,fibre:null}} }
export function DailyNutrition({refreshKey = "",onPlanChanged}: {refreshKey?: string;onPlanChanged?:()=>Promise<void>}) {
  const {mode}=useMode(), {language}=useLanguage(), en=language==="en"
  const t=(sv:string,enText:string)=>en?enText:sv
  const [data,setData]=useState<Awaited<ReturnType<typeof getDailyNutrition>> | null>(null)
  const [entries,setEntries]=useState<Awaited<ReturnType<typeof listOwnMeals>>>([])
  const [draft,setDraft]=useState<OwnMealInput | null>(null), [photo,setPhoto]=useState<string | null>(null)
  const [photoFile,setPhotoFile]=useState<File|null>(null),[suggestions,setSuggestions]=useState<PhotoSuggestion[]>([])
  const [busy,setBusy]=useState(false), [error,setError]=useState("")
  const refresh=async()=>{const [d,e]=await Promise.all([getDailyNutrition(),listOwnMeals()]);setData(d);setEntries(e)}
  useEffect(()=>{void refresh().catch(()=>setError(en?"Could not load nutrition.":"Kunde inte läsa näringsöversikten."))},[refreshKey,en])
  useEffect(()=>()=>{if(photo)URL.revokeObjectURL(photo)},[photo])
  const perform=async(action:()=>Promise<void>)=>{setBusy(true);setError("");try{await action();await refresh()}catch(e){setError(e instanceof Error?e.message:t("Kunde inte spara.","Could not save."))}finally{setBusy(false)}}
  return <section className="nutrition-panel rounded-2xl border bg-white p-5 sm:p-6 space-y-4" data-localize="off">
    <h2 className="text-xl font-semibold">{t("Dagens energi och näring","Today's energy and nutrition")}</h2>
    <Button onClick={()=>{setDraft(blank());setPhoto(null);setPhotoFile(null);setSuggestions([])}}>{t("Lägg till egen måltid","Add own meal")}</Button>
    {data && <>
      {data.target && <p className="text-sm">{bodyLabels[language][data.target.confidence]}</p>}
      {data.ready&&<><p className="font-medium">{goalLabels[language][data.goal]}</p><p>{goalGuidance(data.goal,en)}</p></>}
      <p className="text-sm">{t("Uppskattningar, inte exakta behov. Oregistrerad mat och okända näringsvärden ingår inte i summan.","Estimates, not exact needs. Unlogged food and unknown nutrients are not included in totals.")}</p>
      {mode==="advanced" && data.target ? <>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[[t("Energimål","Energy target"),`${data.target.calories} kcal`],[t("Planerat","Planned"),data.planned.unknown.calories ? t("Ofullständigt","Incomplete") : `${Math.round(data.planned.sum.calories)} kcal`],[t("Registrerat","Logged"),`${Math.round(data.consumed.sum.calories)} kcal`],[t("Ungefär kvar","Approximately remaining"),data.consumed.unknown.calories ? t("Okänt","Unknown") : `${Math.max(0,Math.round(data.target.calories-data.consumed.sum.calories))} kcal`],["Protein",`${Math.round(data.consumed.sum.protein)} / ${data.target.protein} g`],[t("Kolhydrater / fett, vägledning","Carbs / fat, guidance"),`${data.target.carbs} / ${data.target.fat} g`]].map(([label,value])=><div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="font-medium">{value}</dd></div>)}
        </dl><p className="text-sm">{data.target.method==="mifflin-st-jeor"?`Mifflin–St Jeor · ${t("Uppskattad viloförbrukning","Estimated resting energy")}: ${data.target.baseline} kcal` : t("Grov viktbaserad uppskattning. Ange frivilligt födelseår och kön för beräkning i Min plan för en formelbaserad uppskattning.","Broad weight-based estimate. Optionally add birth year and sex for calculation in My Plan for a formula-based estimate.")}</p>
      </> : <p>{data.consumed.count===0?t("Registrera måltider om du vill få en överblick. Ät regelbundet och efter hunger.","Log meals if you would like an overview. Eat regularly and according to hunger."):t("Fortsätt med vanliga måltider, en proteinkälla och fiberrika tillbehör. En enskild dag avgör inte dina framsteg.","Continue with regular meals, a protein source and fibre-rich sides. One day does not determine your progress.")}</p>}
      <p className="text-sm">{t("Avklarade planerade måltider","Completed planned meals")}: {data.completedMeals}/{data.plannedMeals} · {t("Egna måltider idag","Own meals today")}: {data.ownMeals.length}</p>
      {(data.consumed.unknown.calories>0||data.consumed.unknown.protein>0)&&<p>{t("Summan är ofullständig: vissa måltider saknar energi eller protein.","Totals are incomplete: some meals have unknown energy or protein.")}</p>}
    </>}
    {mode==="simple" && data?.target && data.consumed.count>0 && data.consumed.unknown.protein===0 && data.consumed.sum.protein<data.target.protein*0.7 && <p>{t("Lite mer protein skulle passa till nästa vanliga måltid om du är hungrig.","A little more protein could fit your next regular meal if you are hungry.")}</p>}

    {draft && <form className="space-y-3 border-t pt-4" onSubmit={e=>{e.preventDefault();void perform(async()=>{await saveOwnMeal({...draft,eatenAt:new Date(draft.eatenAt).toISOString()});setDraft(null);setPhoto(null)})}}>
      <label className="block">{t("Måltidens namn","Meal name")}<input required maxLength={120} className="w-full border rounded p-2" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
      <label className="block">{t("Livsmedel och ingredienser","Foods and components")}<textarea maxLength={2000} className="w-full border rounded p-2" value={draft.components} onChange={e=>setDraft({...draft,components:e.target.value})}/></label>
      <label className="block">{t("Portion / mängd","Portion / quantity")}<input maxLength={200} className="w-full border rounded p-2" value={draft.portion} onChange={e=>setDraft({...draft,portion:e.target.value})}/></label>
      <div className="grid gap-3 sm:grid-cols-2"><label>{t("Måltidstyp","Meal type")}<select className="w-full border rounded p-2" value={draft.mealType} onChange={e=>setDraft({...draft,mealType:e.target.value})}>{["breakfast","lunch","dinner","snack","other"].map((v,i)=><option key={v} value={v}>{(en?["Breakfast","Lunch","Dinner","Snack","Other"]:["Frukost","Lunch","Middag","Mellanmål","Annat"])[i]}</option>)}</select></label><label>{t("Datum och tid","Date and time")}<input required type="datetime-local" className="w-full min-w-0 border rounded p-2" value={draft.eatenAt} onChange={e=>setDraft({...draft,eatenAt:e.target.value})}/></label></div>
      <label className="block">{t("Foto (frivilligt)","Photo (optional)")}<span className="mt-2 flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-primary px-4 text-primary focus-within:ring-2">{photo?t("Byt bild","Change image"):t("Ta foto eller välj bild","Take a photo or choose an image")}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>10*1024*1024||!["image/jpeg","image/png","image/webp"].includes(file.type)){setError(t("Välj JPG, PNG eller WebP under 10 MB.","Choose JPG, PNG or WebP under 10 MB."));return}setPhoto(URL.createObjectURL(file));setPhotoFile(file);setSuggestions([]);e.target.value=""}}/></span></label>
      {photo&&<Button type="button" variant="outline" onClick={()=>{setPhoto(null);setPhotoFile(null);setSuggestions([])}}>{t("Ta bort bild","Remove image")}</Button>}
      {photo && <Image unoptimized width={400} height={240} src={photo} alt={t("Din måltid, endast lokal förhandsvisning","Your meal, local preview only")} className="max-h-48 w-full rounded object-contain"/>}
      <Button type="button" variant="outline" disabled={!photoMealProvider.available||!photoFile||busy} onClick={()=>void perform(async()=>{if(photoFile)setSuggestions(await photoMealProvider.analyze(photoFile,AbortSignal.timeout(15000)))})}>{photoMealProvider.available?t("Analysera foto","Analyze photo"):t("Fotoanalys är inte tillgänglig ännu","Photo analysis is not available yet")}</Button>
      {suggestions.map((suggestion,index)=><div key={index} className="border rounded p-3"><p>{suggestion.name} · {suggestion.portion}</p><p>{suggestion.components}</p><p>{suggestion.uncertainties.join(" · ")}</p><Button type="button" variant="outline" onClick={()=>setDraft({...draft,name:suggestion.name,components:suggestion.components,portion:suggestion.portion,nutrition:suggestion.nutrition})}>{t("Använd förslag och korrigera nedan","Use suggestion and correct below")}</Button></div>)}
      {!photoMealProvider.available&&<p className="text-sm">{t("Du kan fortfarande fylla i måltiden manuellt. Fotot visas bara här och sparas eller skickas inte. Olja, såser och portionsstorlek är osäkra i ett foto.","You can still enter the meal manually. The photo is only previewed here and is not saved or sent. Oil, sauces and portion size are uncertain in a photo.")}</p>}
      <details><summary>{t("Frivilliga näringsvärden för hela portionen (uppskattade)","Optional nutrition for the entire portion (estimated)")}</summary><div className="grid grid-cols-2 gap-3 pt-3">{(["calories","protein","carbs","fat","fibre"] as (keyof Nutrition)[]).map((key,i)=><label key={key}>{(en?["Energy (kcal)","Protein (g)","Carbs (g)","Fat (g)","Fibre (g)"]:["Energi (kcal)","Protein (g)","Kolhydrater (g)","Fett (g)","Fibrer (g)"])[i]}<input className="w-full border rounded p-2" type="number" min="0" max={key==="calories"?10000:1000} step="any" value={draft.nutrition[key]??""} onChange={e=>setDraft({...draft,nutrition:{...draft.nutrition,[key]:e.target.value===""?null:Number(e.target.value)}})}/></label>)}</div></details>
      <p className="text-sm">{t("Granska ingredienser, mängd och värden före sparande. Tomma näringsfält förblir okända.","Review components, portion and values before saving. Empty nutrition fields remain unknown.")}</p>
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy}>{t("Bekräfta och spara","Confirm and save")}</Button><Button type="button" variant="outline" onClick={()=>{setDraft(null);setPhoto(null)}}>{t("Avbryt","Cancel")}</Button></div>
    </form>}
    <details><summary>{t("Tidigare måltider","Previous meals")}</summary><ul className="space-y-3 mt-3">{entries.map(meal=><li key={meal.id} className="border rounded p-3 space-y-2"><p className="font-medium break-words">{meal.name}</p><p className="text-sm break-words">{meal.components} · {meal.portion}</p><p className="text-sm">{new Date(meal.eatenAt).toLocaleString(en?"en-GB":"sv-SE")} · {t("Näringsvärden är uppskattade","Nutrition values are estimates")}</p><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>{setDraft({...meal,eatenAt:localTime(new Date(meal.eatenAt)),nutrition:parseNutrition(meal.nutrition)});setPhoto(null)}}>{t("Redigera","Edit")}</Button><Button size="sm" variant="outline" disabled={busy} onClick={()=>void perform(()=>deleteOwnMeal(meal.id))}>{t("Ta bort","Delete")}</Button></div></li>)}</ul></details>
    {error&&<p role="alert">{error}</p>}
    <NutritionBalance onChanged={async()=>{await refresh();await onPlanChanged?.()}}/>
  </section>
}

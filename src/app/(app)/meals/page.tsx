"use client"
import { LifestyleMosaic } from "@/components/lifestyle-mosaic"
import { PageHeading } from "@/components/page-heading"
import * as Dialog from "@radix-ui/react-dialog"
import { translate } from "@/lib/i18n/catalog"
import { ingredientEnglish } from "@/lib/i18n/ingredients"
import { Localize, useLanguage } from "@/lib/i18n/provider"

import { SlotChoices } from "@/components/planning-preferences"
import { mealSlots } from "@/lib/preferences"
import { type ShoppingFilter } from "@/lib/shopping-filters"
import { displayValue } from "@/lib/display"
import { clarifyPortionIngredient } from "@/lib/shopping"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, ShoppingCart } from "lucide-react"
import { useMode } from "@/lib/ModeContext"
import { getRecommendedRecipes, getUser, getShoppingListState, setShoppingItemChecked } from "@/app/actions"
import type { PublicUser } from "@/app/actions"
import type { Recipe } from "@prisma/client"

const shoppingLabel=(item:string)=>item.replace(/ \(till \d+ receptportion(?:er)?\)$/,"")

type NutritionData = { calories: number; protein: number; carbs: number; fat: number }

export default function MealsPage() {
  const { userId, sessionStatus } = useMode()
  if (sessionStatus === "loading") return <Localize>{<p>Laddar dina recept…</p>}</Localize>
  if (!userId) return <Localize>{<p>Logga in för att se dina recept.</p>}</Localize>
  return <Localize key={userId}>{<UserMealsPage key={userId} />}</Localize>
}

function UserMealsPage() {
  const {language}=useLanguage()
  const { mode, userId, sessionStatus } = useMode()
  const [tab,setTab]=useState("recipes")
  const [limit,setLimit]=useState(4)
  const [mealFilter,setMealFilter]=useState("all")
  const [filter,setFilter]=useState<ShoppingFilter>({period:"week",slots:[...mealSlots]})
  const [days,setDays]=useState<{id:string;date:Date}[]>([])
  const [shoppingList, setShoppingList] = useState<string[]>([])
  const [planId, setPlanId] = useState<string | null>(null)
  const [checked, setChecked] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [user, setUser] = useState<PublicUser | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setShoppingList([])
    setChecked([])
    setRecipes([])
    setUser(null)
    setPlanId(null)
    setError("")
    if (sessionStatus === "loading") return
    if (!userId) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([getUser(), getRecommendedRecipes(), getShoppingListState()]).then(([u, rec, shopping]) => {
      if (!active) return
      setUser(u)
      setRecipes(rec)
      setOpenId(new URLSearchParams(window.location.search).get("recipe"))
      setDays(shopping.days)
      setShoppingList(shopping.items)
      setPlanId(shopping.planId)
      setChecked(shopping.checked)
      setLoadedUserId(userId)
      setLoading(false)
    }).catch(() => { if (active) { setError("Kunde inte läsa recepten och inköpslistan. Ladda om sidan för att försöka igen."); setLoadedUserId(userId); setLoading(false) } })
    return () => { active = false }
  }, [userId, sessionStatus])

  useEffect(()=>{
    if (!loadedUserId) return
    let active=true
    setSaving(true)
    getShoppingListState(filter).then(shopping=>{if(active){setShoppingList(shopping.items);setChecked(shopping.checked);setPlanId(shopping.planId);setDays(shopping.days);setError("")}}).catch(()=>{if(active)setError("Kunde inte läsa inköpslistan.")}).finally(()=>{if(active)setSaving(false)})
    return ()=>{active=false}
  },[filter,loadedUserId])


  if (sessionStatus === "loading" || loading || (userId && loadedUserId !== userId)) {
    return <Localize>{<div className="p-8 text-center text-muted-foreground">Laddar dina recept...</div>}</Localize>
  }
  if (!userId) return <Localize>{<p>Logga in för att se dina recept.</p>}</Localize>

  const toggleItem = async (item: string, value: boolean) => {
    if (!planId || saving) return
    setSaving(true)
    setError("")
    try {
      await setShoppingItemChecked(planId, item, value, filter)
      setChecked(previous => value ? [...previous.filter(row => row !== item), item] : previous.filter(row => row !== item))
    } catch { setError("Kunde inte spara markeringen. Försök igen eller ladda om listan.") }
    finally { setSaving(false) }
  }

  const restrictions: string[] = user?.dietRestrictions ? (JSON.parse(user.dietRestrictions) as string[]) : []


  return <Localize>{(
    <div className="app-page max-w-4xl mx-auto space-y-6">
      <div className="warm-intro-layout">
        <div>
        <PageHeading section="recipes" />
        <p className="text-muted-foreground">
          Recept som passerar dina hårda kostregler
          {restrictions.length > 0 && ` (${restrictions.map(value=>translate(displayValue(value),language)).join(", ")})`}
        </p>
        </div>
        <LifestyleMosaic variant="strip" themes={["cooking", "meal"]} />
      </div>

      <div role="group" aria-label="Recept och inköp" className="wellness-tabs flex flex-wrap gap-2"><Button variant={tab==="recipes"?"default":"outline"} aria-pressed={tab==="recipes"} onClick={()=>setTab("recipes")}>Receptförslag</Button><Button variant={tab==="shopping"?"default":"outline"} aria-pressed={tab==="shopping"} onClick={()=>{setTab("shopping");setOpenId(null)}}>Inköpslista</Button></div>
      <div className="space-y-6">
        {tab==="recipes" && <div className="recipe-grid grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2 block text-sm">Måltid<select className="border rounded p-2 ml-2" value={mealFilter} onChange={e=>{setMealFilter(e.target.value);setLimit(4)}}>{Object.entries({all:"Alla",breakfast:"Frukost",lunch:"Lunch",dinner:"Middag",snack:"Mellanmål"}).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
          <h2 className="sm:col-span-2 text-xl font-semibold">Dina Receptförslag</h2>
          {recipes.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Inga recept hittades som matchar dina krav. Vi jobbar på att lägga till fler!
              </CardContent>
            </Card>
          ) : (
            recipes.filter(r=>openId ? r.id===openId : mealFilter==="all"||JSON.parse(r.tags??"[]").includes(mealFilter)).slice(0,limit).map((recipe) => {
              const nutrition = JSON.parse(recipe.nutrition ?? "{}") as NutritionData
              const tags = JSON.parse(recipe.tags ?? "[]") as string[]
              const ingredients = JSON.parse(recipe.ingredients ?? "[]") as string[]
              const instructions = JSON.parse(recipe.instructions ?? "[]") as string[]
              const open = openId === recipe.id
              return <Localize key={recipe.id}>{(
                <Card id={`recipe-${recipe.id}`} key={recipe.id} className="scroll-mt-20 flex flex-col">
                  <CardHeader className="pb-3">
                    <CardTitle>{recipe.title}</CardTitle>
                    <CardDescription>{recipe.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3 text-sm mb-4">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-4 h-4" /> {recipe.prepTime} min
                      </span>
                      {tags.map((tag) => (
                        <span key={tag} className="bg-[#f3edcb] text-[#665628] px-3 py-1 rounded-full text-xs">
                          {displayValue(tag)}
                        </span>
                      ))}
                    </div>
                    <Dialog.Root open={open} onOpenChange={value=>{if(!value){setOpenId(null);window.history.replaceState(null,"","/meals")}}}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-[#17291f]/40 backdrop-blur-sm"/><Dialog.Content className="wellness-dialog fixed z-50 inset-x-4 top-[5dvh] mx-auto max-w-2xl max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-6 space-y-4"><Dialog.Title className="text-xl font-semibold">{recipe.title}</Dialog.Title><Dialog.Description>1 receptportion. Tillagningstid: {recipe.prepTime} min.</Dialog.Description><Dialog.Close className="border rounded px-4 min-h-11">Stäng recept</Dialog.Close><p className="text-sm">{tags.map(tag=>translate(displayValue(tag),language)).join(" · ")}</p>
                    {mode === "advanced" && (
                      <div className="bg-gray-50 p-3 rounded-md text-xs text-gray-600 mb-4 flex flex-wrap gap-4">
                        <span>Näringsvärden per receptportion</span>
                        <span>
                          <strong>Kcal:</strong> {nutrition.calories ?? "–"}
                        </span>
                        <span>
                          <strong>Protein:</strong> {nutrition.protein ?? "–"} g
                        </span>
                        <span>
                          <strong>Kolhydrater:</strong> {nutrition.carbs ?? "–"} g
                        </span>
                        <span>
                          <strong>Fett:</strong> {nutrition.fat ?? "–"} g
                        </span>
                      </div>
                    )}
                      <div className="mb-4 space-y-3 text-sm">
                        <div>
                          <p className="font-medium mb-1">Ingredienser · 1 receptportion</p>
                          <ul className="list-disc pl-5 space-y-1">
                            {ingredients.map((item) => (
                              <li key={item}>{language==="en"?ingredientEnglish(clarifyPortionIngredient(item)):clarifyPortionIngredient(item)}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="font-medium mb-1">Gör så här</p>
                          <ol className="list-decimal pl-5 space-y-1">
                            {instructions.map((step) => (
                              <li key={step}>{step}</li>
                            ))}
                          </ol>
                        </div>
                      </div>
                    </Dialog.Content></Dialog.Portal></Dialog.Root>
                    <Button variant="outline" className="w-full sm:w-auto" onClick={() => setOpenId(open ? null : recipe.id)}>
                      {open ? "Dölj recept" : "Visa recept"}
                    </Button>
                  </CardContent>
                </Card>
              )}</Localize>
            })
          )}
          {!openId && limit<recipes.filter(r=>mealFilter==="all"||JSON.parse(r.tags??"[]").includes(mealFilter)).length && <Button variant="outline" onClick={()=>setLimit(n=>n+4)}>Visa fler recept</Button>}
        </div>}

        {tab==="shopping" && <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary" />
                Inköpslista
              </CardTitle>
              <CardDescription>Endast dina valda måltider, en receptportion per måltid. Perioder räknas inom den aktuella veckoplanen.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <label className="block text-sm">Handla för<select className="w-full border rounded p-2" value={filter.period} onChange={e=>setFilter({...filter,period:e.target.value as ShoppingFilter["period"],dayIds:[]})}>{Object.entries({today:"Idag","2":"Nästa 2 dagar","3":"Nästa 3 dagar",week:"Hela veckan",custom:"Välj dagar själv"}).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
                {filter.period==="custom" && <div>{days.map(day=><label key={day.id} className="flex items-center gap-2 min-h-11 text-sm"><input type="checkbox" checked={filter.dayIds?.includes(day.id)??false} onChange={e=>setFilter({...filter,dayIds:e.target.checked?[...(filter.dayIds??[]),day.id]:(filter.dayIds??[]).filter(id=>id!==day.id)})}/>{new Date(day.date).toLocaleDateString(language==="en"?"en-GB":"sv-SE",{weekday:"long",day:"numeric",month:"short"})}</label>)}</div>}
                <fieldset><legend className="text-sm">Måltider att handla för</legend><SlotChoices value={filter.slots??[...mealSlots]} onChange={slots=>setFilter({...filter,slots})}/></fieldset>
                <label className="flex items-center min-h-11 gap-2 text-sm"><input type="checkbox" checked={filter.hidePantry??false} onChange={e=>setFilter({...filter,hidePantry:e.target.checked})}/>Dölj basvaror (kontrollera vad du har hemma)</label>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Buljong avser färdigblandad vätska. Väljer du tärning eller koncentrat, följ förpackningens dosering och allergenmärkning.</p>
              <p className="text-xs text-muted-foreground mb-3">Markeringarna sparas för din veckoplan. Om mängden på en rad ändras behöver du markera den igen.</p>
              {error && <p role="alert" className="text-sm text-red-700 mb-3">{error}</p>}
              {shoppingList.length === 0 ? (
                <p className="text-sm text-muted-foreground">Din lista är tom.</p>
              ) : (
                <ul className="space-y-2">
                  {shoppingList.map((item) => (
                    <li key={item} className="text-sm">
                      <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
                        <input type="checkbox" aria-label={language==="en"?ingredientEnglish(shoppingLabel(item)):shoppingLabel(item)} checked={checked.includes(item)} disabled={saving || !planId} onChange={event => toggleItem(item, event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
                        <span className="min-w-0 break-words">{language==="en"?ingredientEnglish(shoppingLabel(item)):shoppingLabel(item)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>}
      </div>
    </div>
  )}</Localize>
}

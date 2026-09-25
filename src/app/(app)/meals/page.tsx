"use client"
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

type NutritionData = { calories: number; protein: number; carbs: number; fat: number }

export default function MealsPage() {
  const { userId, sessionStatus } = useMode()
  if (sessionStatus === "loading") return <p>Laddar dina recept…</p>
  if (!userId) return <p>Logga in för att se dina recept.</p>
  return <UserMealsPage key={userId} />
}

function UserMealsPage() {
  const { mode, userId, sessionStatus } = useMode()
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
      setShoppingList(shopping.items)
      setPlanId(shopping.planId)
      setChecked(shopping.checked)
      setLoadedUserId(userId)
      setLoading(false)
    }).catch(() => { if (active) { setError("Kunde inte läsa recepten och inköpslistan. Ladda om sidan för att försöka igen."); setLoadedUserId(userId); setLoading(false) } })
    return () => { active = false }
  }, [userId, sessionStatus])

  if (sessionStatus === "loading" || loading || (userId && loadedUserId !== userId)) {
    return <div className="p-8 text-center text-muted-foreground">Laddar dina recept...</div>
  }
  if (!userId) return <p>Logga in för att se dina recept.</p>

  const toggleItem = async (item: string, value: boolean) => {
    if (!planId || saving) return
    setSaving(true)
    setError("")
    try {
      await setShoppingItemChecked(planId, item, value)
      setChecked(previous => value ? [...previous.filter(row => row !== item), item] : previous.filter(row => row !== item))
    } catch { setError("Kunde inte spara markeringen. Försök igen eller ladda om listan.") }
    finally { setSaving(false) }
  }

  const restrictions: string[] = user?.dietRestrictions ? (JSON.parse(user.dietRestrictions) as string[]) : []


  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Recept</h1>
        <p className="text-muted-foreground">
          Recept som passerar dina hårda kostregler
          {restrictions.length > 0 && ` (${restrictions.map(displayValue).join(", ")})`}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold">Dina Receptförslag</h2>
          {recipes.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Inga recept hittades som matchar dina krav. Vi jobbar på att lägga till fler!
              </CardContent>
            </Card>
          ) : (
            recipes.map((recipe) => {
              const nutrition = JSON.parse(recipe.nutrition ?? "{}") as NutritionData
              const tags = JSON.parse(recipe.tags ?? "[]") as string[]
              const ingredients = JSON.parse(recipe.ingredients ?? "[]") as string[]
              const instructions = JSON.parse(recipe.instructions ?? "[]") as string[]
              const open = openId === recipe.id
              return (
                <Card key={recipe.id}>
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
                        <span key={displayValue(tag)} className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded-md text-xs">
                          {displayValue(tag)}
                        </span>
                      ))}
                    </div>
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
                    {open && (
                      <div className="mb-4 space-y-3 text-sm">
                        <div>
                          <p className="font-medium mb-1">Ingredienser · 1 receptportion</p>
                          <ul className="list-disc pl-5 space-y-1">
                            {ingredients.map((item) => (
                              <li key={item}>{clarifyPortionIngredient(item)}</li>
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
                    )}
                    <Button variant="outline" className="w-full sm:w-auto" onClick={() => setOpenId(open ? null : recipe.id)}>
                      {open ? "Dölj recept" : "Visa recept"}
                    </Button>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary" />
                Inköpslista
              </CardTitle>
              <CardDescription>Måndag–söndag, en receptportion per planerad måltid. Samma ingrediens och enhet summeras.</CardDescription>
            </CardHeader>
            <CardContent>
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
                        <input type="checkbox" aria-label={item} checked={checked.includes(item)} disabled={saving || !planId} onChange={event => toggleItem(item, event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
                        <span className="min-w-0 break-words">{item}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

"use client"
import { displayValue } from "@/lib/display"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, ShoppingCart } from "lucide-react"
import { useMode } from "@/lib/ModeContext"
import { getRecommendedRecipes, getUser, getShoppingList } from "@/app/actions"
import type { PublicUser } from "@/app/actions"
import type { Recipe } from "@prisma/client"

type NutritionData = { calories: number; protein: number; carbs: number; fat: number }

export default function MealsPage() {
  const { mode, userId, sessionStatus } = useMode()
  const [shoppingList, setShoppingList] = useState<string[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [user, setUser] = useState<PublicUser | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (sessionStatus === "loading") return
    if (!userId) {
      setLoading(false)
      return
    }
    Promise.all([getUser(), getRecommendedRecipes(), getShoppingList()]).then(([u, rec, shopping]) => {
      setUser(u)
      setRecipes(rec)
      setShoppingList(shopping)
      setLoading(false)
    })
  }, [userId, sessionStatus])

  if (sessionStatus === "loading" || loading) {
    return <div className="p-8 text-center text-muted-foreground">Laddar dina recept...</div>
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

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4">
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
                              <li key={item}>{item}</li>
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
              {shoppingList.length === 0 ? (
                <p className="text-sm text-muted-foreground">Din lista är tom.</p>
              ) : (
                <ul className="space-y-2">
                  {shoppingList.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm">
                      <input type="checkbox" className="mt-1 shrink-0" />
                      <span>{item}</span>
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

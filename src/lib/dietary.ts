/**
 * Dietary hard-constraint engine.
 * Restrictions and allergies always win over tags, suggestions and substitutions.
 */


const foodAliases: Record<string,string> = { nuts:"nötter", peanuts:"jordnötter", milk:"mjölk", eggs:"ägg", egg:"ägg", soy:"soja", sesame:"sesam", fish:"fisk", shellfish:"skaldjur", celery:"selleri", mustard:"senap", lupin:"lupin", sulphites:"sulfiter", sulfites:"sulfiter", mushrooms:"svamp", mushroom:"svamp", liver:"lever", chicken:"kyckling", salmon:"lax", beef:"nötkött", pork:"fläsk", dairy:"mjölk", tofu:"tofu", lentils:"linser", beans:"bönor", oats:"havregryn", rice:"ris" }
export function canonicalFoodTerm(value:string):string { const key=value.trim().toLowerCase(); return foodAliases[key]??key }

export type RecipeLike = {
  nutrition?: string
  tags: string
  ingredients: string
  title?: string
  description?: string
}

const MEAT_FISH = [
  "kyckling",
  "kycklingbröst",
  "kött",
  "nötfärs",
  "nötkött",
  "fläsk",
  "bacon",
  "skinka",
  "kalkon",
  "lamm",
  "korv",
  "lax",
  "fisk",
  "räkor",
  "tonfisk",
  "köttfärs",
  "torsk", "ansjovis", "strömming", "sardell", "gelatin", "ister", "ank", "vilt",
]

const DAIRY = ["mjölk", "ost", "yoghurt", "smör", "grädde", "halloumi", "kvarg", "keso", "feta", "creme fraiche", "gräddfil"]

const ANIMAL_NON_MEAT = ["ägg", "honung", "gelatin"]

const GLUTEN = ["vete", "vetemjöl", "gluten", "pasta", "nudlar", "äggnudlar", "bulgur", "couscous", "råg", "korn"]

const NUT_WORDS = [
  "nöt",
  "nötter",
  "mandel",
  "jordnöt",
  "cashew",
  "valnöt",
  "hasselnöt",
  "pekannöt",
  "pistage",
  "peanut",
]

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) && parsed.every(item=>typeof item === "string" && item.trim()) ? parsed : []
  } catch {
    return []
  }
}

function normalize(text: string): string {
  return text.toLowerCase()
}

function blobFor(recipe: RecipeLike): string {
  const ingredients = parseJsonArray(recipe.ingredients).join(" ")
  return normalize(ingredients)
}

function containsAny(haystack: string, words: string[]): boolean {
  return words.some((word) => haystack.includes(word))
}

function isLactoseFreeIngredient(ingredient: string): boolean {
  const n = normalize(ingredient)
  return n.includes("laktosfri") || n.includes("havredryck") || n.includes("sojadryck") || n.includes("mandeldryck")
}

function hasRegularDairy(ingredients: string[]): boolean {
  return ingredients.some((item) => {
    const n = normalize(item)
    if (isLactoseFreeIngredient(n)) return false
    return DAIRY.some((d) => n.replaceAll("jordnötssmör", "").includes(d))
  })
}

export function parseStringList(value: string | null | undefined): string[] {
  return parseJsonArray(value)
}

export function recipeMeetsConstraints(
  recipe: RecipeLike,
  restrictions: string[],
  dislikes: string[]
): boolean {
  const tags = parseJsonArray(recipe.tags).map((t) => t.toLowerCase())
  const ingredients = parseJsonArray(recipe.ingredients)
  const blob = blobFor(recipe)
  if (ingredients.length === 0) return false
  const allergyWords: Record<string, string[]> = {
    nötter: NUT_WORDS, nötallergi: NUT_WORDS, jordnötter: ["jordnöt", "peanut"],
    mjölk: DAIRY, mjölkprotein: DAIRY, ägg: ["ägg"],
    soja: ["soja", "tofu", "edamame"], sesam: ["sesam", "tahini"],
    fisk: ["fisk", "lax", "tonfisk", "torsk", "ansjovis"],
    skaldjur: ["räk", "kräft", "krabb", "hummer", "mussl", "ostron"],
    selleri: ["selleri", "buljong"], senap: ["senap"], lupin: ["lupin"],
    sulfiter: ["vin", "vinäger", "torkad"],
  }

  for (const restriction of restrictions) {
    const r = restriction.toLowerCase().replaceAll("_", "-")
    if (r.startsWith("allergy:")) {
      const words = allergyWords[canonicalFoodTerm(r.slice(8))]
      if (!words || containsAny(blob, words)) return false
      continue
    }
    if (r === "halal" || r === "kosher") {
      if (!tags.includes(`${r}-verified`)) return false
      continue
    }
    if (!["vegetarian", "vegan", "lactose-free", "gluten-free"].includes(r)) return false

    if (r === "vegetarian") {
      if (!tags.includes("vegetarian") && !tags.includes("vegan")) return false
      if (containsAny(blob, MEAT_FISH)) return false
    }

    if (r === "vegan") {
      if (!tags.includes("vegan")) return false
      if (containsAny(blob, MEAT_FISH) || containsAny(blob, ANIMAL_NON_MEAT) || containsAny(blob.replaceAll("jordnötssmör", ""), DAIRY)) {
        return false
      }
      if (tags.includes("vegetarian") && hasRegularDairy(ingredients)) return false
    }

    if (r === "lactose-free" || r === "lactose_free") {
      if (hasRegularDairy(ingredients) && !tags.includes("lactose-free")) return false
      if (hasRegularDairy(ingredients)) return false
    }

    if (r === "gluten-free" || r === "gluten_free") {
      if (ingredients.some(item => containsAny(item.toLowerCase()
        .replace(/glutenfri(?:a|tt)?\s+(?:pasta|nudlar|havregryn|soja|buljong|bröd)/g, ""),
        [...GLUTEN, "havre", "soja", "buljong", "bröd"]))) return false
    }
  }

  for (const dislike of dislikes) {
    const d = canonicalFoodTerm(dislike).trim()
    if (!d) continue

    const nutAllergy = d.includes("nöt")
    if (nutAllergy && containsAny(blob, NUT_WORDS)) return false

    if (blob.includes(d)) return false
  }

  return true
}

export function safeFoodHint(restrictions: string[], dislikes: string[]): string {
  const parts: string[] = []
  if (restrictions.length) parts.push(restrictions.join("/"))
  if (dislikes.length) parts.push(`undvik ${dislikes.join(", ")}`)
  return parts.join(", ")
}

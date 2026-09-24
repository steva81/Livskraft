import { parseStringList } from "./dietary"

const plural: Record<string, string> = { gurka:"gurkor", vitlöksklyfta:"vitlöksklyftor", lök:"lökar", paprika:"paprikor", tomat:"tomater", morot:"morötter", citron:"citroner" }
const singular = Object.fromEntries(Object.entries(plural).map(([one,many]) => [many,one]))
const volume: Record<string, number> = { ml:1, tsk:5, msk:15, dl:100, l:1000, liter:1000 }
const format = (amount: number) => amount.toLocaleString("sv-SE", {maximumFractionDigits:2})

export function clarifyPortionIngredient(ingredient: string): string {
  return ingredient.replace(/^(\d+(?:[.,]\d+)?)\s+(?:port|portion|portioner)\s+(.+)$/i,
    (_, amount: string, name: string) => `${amount} ${Number(amount.replace(",", ".")) === 1 ? "portion" : "portioner"} ${name} (mängd enligt förpackningens portionsangivelse)`)
}

export function aggregateIngredients(recipes: { ingredients: string }[]): string[] {
  const totals = new Map<string, {amount:number; unit:string; name:string}>()
  const other = new Map<string, number>()
  for (const recipe of recipes) for (const ingredient of parseStringList(recipe.ingredients)) {
    const item = ingredient.trim().replace(/\s+/g," ")
    const match = item.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/)
    if (!match) { other.set(item,(other.get(item)??0)+1); continue }
    let amount = Number(match[1].replace(",","."))
    const unitMatch = match[2].match(/^(kg|g|dl|ml|liter|l|msk|tsk|burkar|burk|portioner|portion|port|st)\s+(.+)$/i)
    let unit = unitMatch?.[1].toLowerCase() ?? "st"
    let name = (unitMatch?.[2] ?? match[2]).toLowerCase()
    name = singular[name] ?? name
    if (unit === "kg") { amount *= 1000; unit="g" }
    if (unit in volume) { amount *= volume[unit]; unit="ml" }
    if (unit === "burkar") unit="burk"
    if (["portioner","portion","port"].includes(unit)) unit="portion"
    const key = `${unit}:${name}`
    totals.set(key,{amount:(totals.get(key)?.amount??0)+amount,unit,name})
  }
  return Array.from(totals.values()).map(({amount,unit,name}) => {
    if (unit === "g" && amount >= 1000) { amount/=1000; unit="kg" }
    if (unit === "ml") {
      if (amount>=1000) {amount/=1000;unit="liter"}
      else if (amount>=50) {amount/=100;unit="dl"}
      else if (amount%15===0) {amount/=15;unit="msk"}
      else if (amount%5===0) {amount/=5;unit="tsk"}
    }
    if (unit === "burk" && amount !== 1) unit="burkar"
    if (unit === "portion" && amount !== 1) unit="portioner"
    if (unit === "st" && name in plural) return `${format(amount)} ${amount===1 ? name : plural[name]}`
    return clarifyPortionIngredient(`${format(amount)} ${unit} ${name}`)
  }).concat(Array.from(other).map(([item,count]) => `${item} (till ${count} ${count===1 ? "receptportion" : "receptportioner"})`))
}

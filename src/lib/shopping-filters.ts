import { type MealSlot } from "./preferences"
export type ShoppingFilter = { period?: "week" | "today" | "2" | "3" | "custom"; dayIds?: string[]; slots?: MealSlot[]; hidePantry?: boolean }
export function filterShoppingDays<T extends {id:string;date:Date}>(days:T[], filter:ShoppingFilter, now=new Date()):T[] {
  const period=filter.period ?? "week"
  if (!["week","today","2","3","custom"].includes(period)) throw new Error("Ogiltig period")
  if (period==="week") return days
  if (period==="custom") {
    if (!Array.isArray(filter.dayIds) || filter.dayIds.length>7 || filter.dayIds.some(id=>typeof id!=="string" || !days.some(day=>day.id===id))) throw new Error("Ogiltiga dagar")
    return days.filter(day=>filter.dayIds!.includes(day.id))
  }
  const start=new Date(now);start.setHours(0,0,0,0)
  const end=new Date(start);end.setDate(end.getDate()+(period==="today"?1:Number(period)))
  return days.filter(day=>new Date(day.date)>=start && new Date(day.date)<end)
}
export function isPantryItem(item:string):boolean { return /(?:^|\s)(?:salt|peppar|svartpeppar|rapsolja|olivolja|matolja|kanel|paprikapulver|spiskummin|oregano)(?:\s|$|\()/i.test(item) }
export function shoppingItems(items:string[],hidePantry=false):string[] {
  return items.filter(item=>!/(?:^|\s)vatten(?:\s|$|\()/i.test(item) && (!hidePantry || !isPantryItem(item)))
}

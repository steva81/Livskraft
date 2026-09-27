const labels: Record<string, string> = {
  beginner: "Nybörjare", intermediate: "Medelnivå", advanced: "Avancerad", simple: "Enkel",
  both: "Hemma och gym", home: "Hemma", gym: "Gym", all: "Alla",
  "lactose-free": "Laktosfri", "gluten-free": "Glutenfri", vegetarian: "Vegetarisk", vegan: "Vegansk",
  halal: "Halal", kosher: "Kosher", "halal-verified": "Verifierad halal", "kosher-verified": "Verifierad kosher",
  breakfast: "Frukost", lunch: "Lunch", dinner: "Middag", quick: "Snabb",
  sedentary: "Mestadels stillasittande", light: "Lätt aktiv", moderate: "Måttligt aktiv", active: "Aktiv", very_active: "Mycket aktiv",
  "office-worker": "Stillasittande arbete", "active-job": "Fysiskt aktivt arbete", travels: "Reser ofta", family: "Familj och barn",
  "no-microwave": "Saknar mikrovågsugn", "no-fridge": "Saknar kylskåp", "meal-prep": "Kan förbereda matlådor",
  dagtid: "Dagtid", kvall: "Kvällstid", oregelbundet: "Oregelbundna tider", skift: "Skift", natt: "Nattarbete", low: "Låg", normal: "Normal", high: "Hög", snack: "Mellanmål", "budget:low": "Låg budget", "budget:normal": "Normal budget", "budget:high": "Hög budget", "fiber-source": "Fiberrika ingredienser", "balanced-meal": "Varierad måltid", "family-friendly": "Familjevänlig",
}

export function displayValue(value: string | null | undefined): string {
  if (!value) return "Ej angivet"
  if (value.startsWith("allergy:")) return `Allergi: ${value.slice(8)}`
  return labels[value] ?? "Övrigt"
}

export function completedWorkoutsText(count: number): string {
  return `${count} ${count === 1 ? "avklarat pass" : "avklarade pass"}`
}

export function adherenceMessage(completed: number, planned: number): string {
  if (completed === 0) return "Du har ännu inte loggat något träningspass den här veckan. Börja när det passar dig."
  if (planned > 0 && completed >= Math.max(2, planned - 1)) return "Du har en bra rytm i träningen den här veckan. Fortsätt i din takt."
  return "Bra start. Du har kommit igång med veckans träning."
}

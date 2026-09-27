export type BodyData = { birthYear?: number; sexForEnergy?: "male" | "female" | "undisclosed" }
export function ageFromBirthYear(birthYear: number | undefined, now = new Date()): number | null {
  if (birthYear === undefined || !Number.isInteger(birthYear)) return null
  const age = now.getFullYear()-birthYear
  return age >= 18 && age <= 100 ? age : null
}
export function validBodyData(data: BodyData): boolean {
  return (data.birthYear === undefined || ageFromBirthYear(data.birthYear) !== null) &&
    (data.sexForEnergy === undefined || ["male","female","undisclosed"].includes(data.sexForEnergy))
}
export const bodyLabels = {
  sv: { title:"Kropp och grunddata", year:"Födelseår (frivilligt)", sex:"Kön för energiberäkning (frivilligt)", height:"Längd (cm)", weight:"Nuvarande vikt (kg)", male:"Man", female:"Kvinna", undisclosed:"Vill inte ange", explanation:"Etablerade energiformler använder ålder, längd, vikt och biologiskt kön. Uppgiften om kön används bara i beräkningen och är inte en fråga om könsidentitet. Du kan avstå. Födelseår ger ungefärlig ålder eftersom födelsedagen inte anges.", lower:"Mindre individualiserad uppskattning: födelseår eller kön för beräkning saknas.", higher:"Mer individualiserad uppskattning utifrån dina grunddata – fortfarande ungefärlig." },
  en: { title:"Body and baseline data", year:"Birth year (optional)", sex:"Sex for energy calculation (optional)", height:"Height (cm)", weight:"Current weight (kg)", male:"Male", female:"Female", undisclosed:"Prefer not to say", explanation:"Established energy formulas use age, height, weight and biological sex. Sex is used only for the calculation; this is not a question about gender identity. You may skip it. Birth year gives approximate age because your birthday is not recorded.", lower:"Less individualized estimate: birth year or sex for calculation is missing.", higher:"More individualized estimate using your baseline data – still approximate." },
}

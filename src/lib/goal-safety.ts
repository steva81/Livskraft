export type GoalInput = { currentWeight?: unknown; targetWeight?: unknown; timeframeWeeks?: unknown }
export type GoalSafety = { level: "normal" | "aggressive" | "blocked"; pace: number | null; suggestedWeeks: number | null; message: string }

// Display months are normalized once, to whole weeks. Stored weeks remain authoritative.
export function monthsToWeeks(months: number): number { return Math.round(months * 52 / 12) }
export const timeframeOptions = [
  ...Array.from({ length: 12 }, (_, i) => ({ weeks: i + 1, label: `${i + 1} ${i === 0 ? "vecka" : "veckor"}` })),
  ...[4, 5, 6, 9, 12, 18, 24, 36, 60, 120].map(months => ({ weeks: monthsToWeeks(months), label: `${months} månader` })),
]
export function formatTimeframe(weeks: number): string {
  return timeframeOptions.find(option => option.weeks === weeks)?.label ??
    (weeks <= 12 ? `${weeks} veckor` : `cirka ${(weeks * 12 / 52).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} månader (${weeks} veckor)`)
}

export function assessGoal(input: GoalInput): GoalSafety {
  const current = Number(input.currentWeight), target = Number(input.targetWeight), weeks = Number(input.timeframeWeeks)
  if ([input.currentWeight, input.targetWeight, input.timeframeWeeks].some(value => typeof value !== "number" && typeof value !== "string") || !Number.isFinite(current) || current < 30 || current > 400 ||
      !Number.isFinite(target) || target < 30 || target > 400 ||
      !Number.isInteger(weeks) || weeks < 1 || weeks > 520) {
    return { level: "blocked", pace: null, suggestedWeeks: null, message: "Ange giltig nuvarande vikt, målvikt (30–400 kg) och tidsram (1–520 veckor). Justera målet innan en plan skapas." }
  }
  const change = Math.abs(current - target), pace = change / weeks
  // Conservative product guardrails, not individual medical clearance.
  // Preserve the original 1 kg/week ceiling; also constrain pace relative to body weight.
  // CDC describes gradual loss (~1–2 lb/week): https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html
  // Gain uses a separate conservative product ceiling; it is not inferred from loss guidance.
  const ceiling = target > current ? Math.min(0.5, current * 0.005) : Math.min(1, current * 0.01)
  const gentle = target > current ? ceiling / 2 : Math.min(0.5, current * 0.0075)
  const suggestedWeeks = Math.ceil(change / gentle)
  const level = pace > ceiling ? "blocked" : pace > gentle ? "aggressive" : "normal"
  const suggestion = suggestedWeeks <= 520
    ? `För en lugnare takt, välj ${suggestedWeeks > 12 ? `cirka ${Math.ceil(suggestedWeeks * 12 / 52)} månader (minst ${suggestedWeeks} veckor)` : `minst ${suggestedWeeks} veckor`}, eller en mindre viktförändring.`
    : "Välj en mindre viktförändring som delmål och ta stöd av vården för ett långsiktigt mål."
  const message = level === "normal" ? "" :
    `Målet kräver cirka ${pace.toLocaleString("sv-SE", { maximumFractionDigits: 2 })} kg per vecka. ${level === "blocked" ? "Takten är för hög för Livskrafts planering. Justera målvikt eller tidsram innan en plan skapas." : "Det är ett aggressivt mål. Vi rekommenderar en längre tidsram och ökar inte kostbegränsning eller träning för att nå takten."} ${suggestion} Fasta, straffträning och extrem kaloribegränsning används aldrig. Detta är planeringsstöd, inte en medicinsk bedömning.`
  return { level, pace, suggestedWeeks, message }
}

export function savedGoalSafety(input: GoalInput): GoalSafety | null {
  // Existing users without a weight goal can still receive ordinary lifestyle plans.
  if (input.currentWeight == null && input.targetWeight == null && input.timeframeWeeks == null) return null
  if (input.targetWeight == null && input.timeframeWeeks == null) return null
  return assessGoal(input)
}

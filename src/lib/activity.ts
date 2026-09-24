import type { Preferences } from "./preferences"

export function activityGuidance(input: { index: number; training: boolean; stepGoal: number; preferences: Preferences; lifestyle: string[]; lowSteps?: boolean }): string {
  const { index, training, stepGoal, preferences, lifestyle, lowSteps } = input
  const minutes = training ? 10 : stepGoal <= 5000 ? 15 : stepGoal >= 10000 ? 30 : 20
  const timing = preferences.workSchedule !== "dagtid" ? "när det passar din vakna tid" : lifestyle.includes("office-worker") ? "på lunchrasten" : "på kvällen"
  const suggestions = training
    ? [`En lugn promenad på ungefär ${minutes} minuter ${timing}, om du vill. Styrkepasset är dagens träning.`, "Träningsdag: låt vardagsrörelsen vara lätt. Ta gärna en kort paus utomhus."]
    : [`Vilodag från styrka: prova en avslappnad promenad på ungefär ${minutes} minuter ${timing}.`, `Välj en behaglig runda ${timing}. Du kan dela upp ungefär ${minutes} minuter i två kortare promenader.`, "Ta en rörelsepaus mellan vardagens aktiviteter. Välj ett tempo som känns bra."]
  let text = suggestions[index % suggestions.length]
  if (lowSteps && index % 2 === 0) text += " De senaste loggarna visar färre steg: prova en kort rörelsepaus i en befintlig vardagsrutin, utan att ta igen missade steg."
  else if (lifestyle.includes("family") && index % 3 === 0) text += " Ta gärna med familjen."
  else if (lifestyle.includes("travels") && index % 3 === 1) text += " På resdagar kan en kort paus mellan färdsträckor räcka."
  return text
}

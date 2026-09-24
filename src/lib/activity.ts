import type { Preferences } from "./preferences"

export function activityGuidance(input: { index: number; training: boolean; stepGoal: number; preferences: Preferences; lifestyle: string[]; lowSteps?: boolean }): string {
  const { index, training, stepGoal, preferences, lifestyle, lowSteps } = input
  const minutes = training ? 10 : stepGoal <= 5000 ? 15 : stepGoal >= 10000 ? 30 : 20
  const timing = preferences.workSchedule !== "dagtid" ? "när det passar din vakna tid" : lifestyle.includes("office-worker") ? "på lunchrasten" : "på kvällen"
  const suggestions = training
    ? [`En lugn promenad på ungefär ${minutes} minuter ${timing}, om du vill. Styrkepasset är dagens träning.`,
      "Träningsdag: låt vardagsrörelsen vara lätt. Ta gärna en kort paus utomhus.",
      "Låt resan till eller från passet ge lite vardagsrörelse om det passar. Det finns inget extra pass att hinna med.",
      "Bryt gärna en längre stunds sittande med att resa dig och röra dig en stund. Vila efter passet när du behöver.",
      "Välj lätt rörelse mellan dagens sysslor. Styrketräningen räcker som dagens pass.",
      "En stund i frisk luft kan kännas skönt efter träningen. Välj själv om och när den passar.",
      "Avsluta veckan i din takt. Låt återhämtning och vanlig vardagsrörelse få plats runt passet."]
    : [`Vilodag från styrka: prova en avslappnad promenad på ungefär ${minutes} minuter ${timing}.`,
      `Välj en behaglig runda ${timing}. Du kan dela upp ungefär ${minutes} minuter i två kortare promenader.`,
      "Ta en rörelsepaus mellan vardagens aktiviteter. Välj ett tempo som känns bra.",
      "Om det passar kan du gå en del av ett vardagsärende. Välj en sträcka som känns lagom.",
      "Byt gärna en stunds sittande mot lätt rörelse hemma. Det behöver inte bli ett träningspass.",
      "Välj något du tycker om utomhus, ensam eller med sällskap. En kort stund räcker som start.",
      "Ge plats för återhämtning. En lugn runda eller lite rörelse hemma är frivilliga alternativ idag."]
  let text = suggestions[index % suggestions.length]
  if (lowSteps && index === 0) text += " De senaste loggarna visar färre steg: prova en kort rörelsepaus i en befintlig vardagsrutin, utan att ta igen missade steg."
  else if (lifestyle.includes("family") && index % 3 === 0) text += " Ta gärna med familjen."
  else if (lifestyle.includes("travels") && index % 3 === 1) text += " På resdagar kan en kort paus mellan färdsträckor räcka."
  return text
}

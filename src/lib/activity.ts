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
  if (preferences.workSchedule === "kvall") text += " Kvällsarbete: lägg gärna träning och huvudmåltid före jobbet, ta med en praktisk måltid under passet och ät efteråt om du är hungrig."
  if (preferences.language === "en") {
    const timingEn=preferences.workSchedule!=="dagtid" ? "around your waking hours" : lifestyle.includes("office-worker") ? "during a lunch break" : "in the evening"
    const choices=training ? [
      `An optional gentle walk of about ${minutes} minutes ${timingEn}. The strength workout is today's training.`,
      "Training day: keep everyday movement light. A short outdoor break is an option.",
      "Your journey to or from the workout can provide some everyday movement. No extra workout is needed.",
      "Break up a long period of sitting by standing and moving briefly. Rest after your workout when needed.",
      "Choose light movement between daily tasks. Strength training is enough for today.",
      "Some fresh air may feel good after training. Choose whether and when it suits you.",
      "End the week at your own pace. Leave room for recovery and everyday movement."
    ] : [
      `Rest day from strength training: consider a gentle walk of about ${minutes} minutes ${timingEn}.`,
      `Choose a comfortable route ${timingEn}. You can split about ${minutes} minutes into two shorter walks.`,
      "Take a movement break between daily activities at a comfortable pace.",
      "If practical, walk part of an errand. Choose a manageable distance.",
      "Consider replacing some sitting with light movement at home. It does not need to be a workout.",
      "Choose something you enjoy outdoors, alone or with company. A short break is enough to start.",
      "Make room for recovery. A gentle walk or movement at home are optional today."
    ]
    let result=choices[index%7]
    if(lowSteps && index===0) result+=" Recent logs show fewer steps: try a short movement break in an existing routine, without making up missed steps."
    else if(lifestyle.includes("family") && index%3===0) result+=" Invite your family if you like."
    else if(lifestyle.includes("travels") && index%3===1) result+=" On travel days, a short break between journeys may be enough."
    if(preferences.workSchedule==="kvall") result+=" Evening work: consider training and your main meal before work, practical food during the shift and a later meal if hungry."
    return result
  }
  return text
}

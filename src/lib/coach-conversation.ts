export type ConversationMessage = {role:"user"|"coach";text:string}
export type Topic = "extra"|"craving"|"hunger"|"missed-meal"|"stress"|"sleep"|"energy"|"off-plan"
export function conversationTopic(input:string):Topic|null {
  if (/kak(?:a|or)|cookies?|åt för mycket|ätit för mycket|overeat|ate too much|snabbmat|fast food/i.test(input)) return "extra"
  if (/sötsug|sugen|crav/i.test(input)) return "craving"
  if (/hungrig|hunger|hungry/i.test(input)) return "hunger"
  if (/miss(?:ade|at).*?(?:lunch|frukost|middag|måltid)|missed.*(?:meal|lunch|breakfast|dinner)/i.test(input)) return "missed-meal"
  if (/stress|orolig|anxious/i.test(input)) return "stress"
  if (/sov|sömn|sleep|slept/i.test(input)) return "sleep"
  if (/orkar inte|trött|omotiverad|tired|no motivation|don't feel like/i.test(input)) return "energy"
  if (/tappade.*plan|dålig dag|misslycka|off.*plan|bad day|failed/i.test(input)) return "off-plan"
  return null
}
export function isFollowUp(input:string):boolean {
  return /^(ja|nej|yes|no|okej|ok|varför|why|hur|how|och imorgon|and tomorrow|vad tycker du istället|what do you suggest instead|jag hann inte göra det|i did not manage it|kan jag köra .+ istället|can i do .+ instead|vad kan jag ta istället|vad kan jag äta istället|what can i have instead|tell me more|berätta mer)([.!? ]|$)/i.test(input.trim())
}
export function boundedHistory(history:ConversationMessage[]):ConversationMessage[] {
  return history.slice(-12).map(m=>({role:m.role,text:m.text.slice(0,1000)}))
}
export function conversationalReply(input:string,history:ConversationMessage[],options:{name:string;language?:string;nextMeal?:string;health?:string}):string|null {
  const follow=isFollowUp(input)
  const topic=conversationTopic(input) ?? (follow ? [...history].reverse().filter(m=>m.role==="user").map(m=>conversationTopic(m.text)).find(Boolean) : null)
  if (!topic) return null
  const en=options.language==="en"
  if (follow && /varför|why/i.test(input)) return en
    ? "One meal or a difficult day does not decide your progress. Hunger, sleep and stress can affect how you feel. Regular meals and recovery help you return to a routine without fasting or punishment exercise. What would make the next meal easier?"
    : "En måltid eller en svår dag avgör inte dina framsteg. Hunger, sömn och stress kan påverka hur du mår. Regelbundna måltider och återhämtning hjälper dig tillbaka utan fasta eller straffträning. Vad skulle göra nästa måltid enklare?"
  if (follow && /^(ja|yes)/i.test(input) && ["stress","sleep","energy"].includes(topic)) return en ? "Let's simplify today: make your next meal easy and give yourself permission to rest. If you want movement, keep it gentle and optional. There is no workout to make up later." : "Vi förenklar idag: gör nästa måltid enkel och ge dig själv utrymme att vila. Om du vill röra på dig, håll det lugnt och frivilligt. Inget pass behöver tas igen senare."
  const next=options.nextMeal ? (en?` Your next planned meal is ${options.nextMeal}.`: ` Nästa planerade måltid är ${options.nextMeal}.`) : ""
  if (follow && /istället|instead|^ja|^yes/i.test(input)) return (en
    ? "If you are hungry, choose a regular meal or a snack that fits your dietary needs. You do not need to earn food or make up for what you ate."
    : "Om du är hungrig, välj en vanlig måltid eller ett mellanmål som passar dina kostkrav. Du behöver inte förtjäna mat eller kompensera för det du åt.")+next
  if (follow && /^(nej|no)/i.test(input)) return en ? "That's okay. You do not have to solve everything now. Continue with your next regular meal and take a break if you need one." : "Det är okej. Du behöver inte lösa allt nu. Fortsätt med nästa vanliga måltid och ta en paus om du behöver."
  const replies:Record<Topic,[string,string]>={
    extra:["Det händer. Några kakor eller en större måltid förstör inte dagen. Fortsätt med din vanliga plan vid nästa måltid; hoppa inte över mat och träna inte extra för att kompensera. Var du hungrig, sötsugen eller blev det bara så?","It happens. Some cookies or a larger meal do not ruin your day. Continue with your next regular meal; do not skip food or exercise extra to compensate. Were you hungry, craving something, or did it just happen?"],
    craving:["Sötsug är inget misslyckande. Känn efter om du också är hungrig och behöver en vanlig måltid eller ett mellanmål. Du behöver inte förbjuda sötsaker. Vill du ha hjälp att välja något som passar dina kostkrav?","Cravings are not a failure. Notice whether you are also hungry and need a regular meal or snack. You do not have to ban sweets. Would you like help choosing something that fits your dietary needs?"],
    hunger:["Om du fortfarande är hungrig får du äta mer. Planen är ett stöd, inte ett tak för vad du får äta. Välj en vanlig måltid eller ett mellanmål som passar dina kostkrav. När åt du senast?","If you are still hungry, it is okay to eat more. The plan is support, not a limit on what you may eat. Choose a regular meal or snack that fits your dietary needs. When did you last eat?"],
    "missed-meal":["En missad måltid behöver inte styra resten av dagen. Ät en vanlig måltid när du får möjlighet, eller ett praktiskt mellanmål om det dröjer. Försök inte fortsätta hoppa över mat. Vad har du tillgång till just nu?","A missed meal does not have to shape the rest of the day. Have a regular meal when you can, or a practical snack if it will be a while. Do not keep skipping food. What is available right now?"],
    stress:["Det låter som en pressad dag. Sänk kraven och välj en liten sak: en paus, något att äta eller att förbereda nästa måltid. Träning är inte ett måste för att rädda dagen. Vad känns mest genomförbart?","That sounds like a demanding day. Lower the pressure and choose one small step: a break, something to eat, or preparing your next meal. You do not have to exercise to rescue the day. What feels most manageable?"],
    sleep:["Dålig sömn kan göra dagen tyngre. Ge plats för återhämtning och vanliga måltider. Du kan vila eller välja lätt rörelse om det känns bra, utan att ta igen något senare. Vill du förenkla dagens plan?","Poor sleep can make the day harder. Make room for recovery and regular meals. You can rest or choose gentle movement if it feels good, without making up for anything later. Would you like to simplify today's plan?"],
    energy:["Du behöver inte pressa igenom ett pass idag. Vila är ett alternativ, och ett missat pass behöver inte tas igen. Välj en liten vardagsrutin som känns möjlig. Är det trötthet, tidsbrist eller något annat som tar emot?","You do not have to force a workout today. Rest is an option, and a missed workout does not need to be made up. Choose a small everyday routine that feels possible. Is it tiredness, lack of time, or something else?"],
    "off-plan":["En dag utanför planen är en del av livet. Börja om vid nästa vanliga måltid, utan fasta eller extra träning. Vi kan förenkla resten av dagen. Vad blev svårast idag?","A day away from the plan is part of life. Start again with your next regular meal, without fasting or extra exercise. We can simplify the rest of the day. What was hardest today?"]}
  let reply=replies[topic][en?1:0]
  if (["hunger","missed-meal","off-plan"].includes(topic)) reply+=next
  if (["prediabetes","type1","type2"].includes(options.health??"") && ["hunger","missed-meal"].includes(topic)) reply+=en?" This is meal-planning support only. Follow your care team's advice about symptoms and treatment; I cannot assess blood glucose or insulin doses.":" Detta är bara måltidsstöd. Följ vårdens råd om symtom och behandling; jag bedömer inte blodsocker eller insulindoser."
  return reply
}

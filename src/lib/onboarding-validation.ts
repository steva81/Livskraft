import {defaultPreferences,validPreferences} from "./preferences"
import { assessGoal } from "./goal-safety"
import { validBodyData, type BodyData } from "./body-data"
export type RegistrationInput = {name?:string;email?:string;password?:string;currentWeight?:string|number; height?:string|number;targetWeight?:string|number;timeframeWeeks?:string|number;activityLevel?:string;trainingLevel?:string;trainingLocation?:string;preferences?:BodyData & {primaryGoal?:string;planningConfirmed?:boolean}}
export function onboardingErrors(data:RegistrationInput,step:number,en=false):Record<string,string> {
  const errors:Record<string,string>={}
  if(step===1){
    if(!data.name?.trim()||data.name.length>100)errors.name=en?"Enter your name.":"Ange ditt namn."
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email??"")||(data.email?.length??0)>254)errors.email=en?"Enter a valid email.":"Ange en giltig e-postadress."
    if(!data.password||data.password.length<10||data.password.length>256)errors.password=en?"Use 10–256 characters.":"Använd 10–256 tecken."
    if(!Number.isFinite(Number(data.currentWeight))||Number(data.currentWeight)<30||Number(data.currentWeight)>400)errors.currentWeight=en?"Enter weight, 30–400 kg.":"Ange vikt, 30–400 kg."
    if(!Number.isFinite(Number(data.height))||Number(data.height)<100||Number(data.height)>250)errors.height=en?"Enter height, 100–250 cm.":"Ange längd, 100–250 cm."
    const goal=data.preferences?.primaryGoal
    if(!["lose","maintain","retain-muscle","build-muscle"].includes(goal??""))errors.goal=en?"Choose your goal.":"Välj ditt mål."
    if(!validBodyData(data.preferences??{}))errors.birthYear=en?"Check birth year (adults 18–100).":"Kontrollera födelseår (vuxna 18–100 år)."
    if(goal==="lose"||goal==="build-muscle"&&(!!data.targetWeight||!!data.timeframeWeeks)){
      const safety=assessGoal(data)
      if(safety.level==="blocked")errors.targetWeight=en?"Check target weight and timeframe; choose a safer pace.":safety.message
      if(goal==="lose"&&Number(data.targetWeight)>Number(data.currentWeight)||goal==="build-muscle"&&Number(data.targetWeight)<Number(data.currentWeight))errors.targetWeight=en?"Target weight must match your goal.":"Målvikten behöver stämma med ditt mål."
    }
  }
  if(step===3){
    if(!["sedentary","light","moderate","active","very_active"].includes(data.activityLevel??""))errors.activityLevel=en?"Choose your activity level.":"Välj aktivitetsnivå."
    if(!["beginner","intermediate","advanced"].includes(data.trainingLevel??""))errors.trainingLevel=en?"Choose your training level.":"Välj träningsnivå."
    if(!["home","gym","both"].includes(data.trainingLocation??""))errors.trainingLocation=en?"Choose where you want to train.":"Välj var du vill träna."
  }
  if(step===4&&!validPreferences({...defaultPreferences,...data.preferences} as typeof defaultPreferences))errors.choices=en?"Check the ranges for steps, cooking time and training choices.":"Kontrollera intervallen för steg, matlagningstid och träningsval."
  if(step===4&&data.preferences?.planningConfirmed!==true)errors.confirmation=en?"Review and confirm the starting suggestions.":"Granska och bekräfta startförslagen."
  return errors
}

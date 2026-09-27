const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}})
const resolve = Module._resolveFilename
Module._resolveFilename = function(request,...args) { return resolve.call(this,request.startsWith('@/') ? path.resolve('src',request.slice(2)) : request,...args) }
let identity = null
const load = Module._load
Module._load = function(request,...args) {
  if(request==='@/lib/auth') return {getAuthenticatedUserId:async()=>identity}
  if(request==='next/cache') return {revalidatePath(){}}
  return load.call(this,request,...args)
}
const {assessGoal,savedGoalSafety,monthsToWeeks,timeframeOptions} = require('../src/lib/goal-safety')
const {getCoachReply} = require('../src/lib/coach-service')
const {generateWeeklyPlanForUser} = require('../src/lib/plan-generator')
const {adaptiveStateForUser} = require('../src/lib/adaptive')
const actions = require('../src/app/actions')
const prisma = require('../src/lib/prisma').default
const ids = []
const goal=(currentWeight,targetWeight,timeframeWeeks)=>({currentWeight,targetWeight,timeframeWeeks})
const {defaultPreferences,readPreferences,readMeasurements,validPreferences}=require('../src/lib/preferences')
const {parsePlannedMeals,selectedSlots}=require('../src/lib/plan-types')
const {rankRecipes}=require('../src/lib/recipe-ranking')
const {filterShoppingDays,shoppingItems}=require('../src/lib/shopping-filters')
const {activityGuidance}=require('../src/lib/activity')
const {readCoachHistory,saveCoachExchange}=require('../src/lib/coach-history')
const {exerciseVideoUrl,exerciseInstruction}=require('../src/lib/exercise-media')
const {translate}=require('../src/lib/i18n/catalog')
const {recipeMeetsConstraints}=require('../src/lib/dietary')
const {expandedRecipes}=require('../prisma/expanded-recipes')
async function main(){
  const first=await prisma.user.create({data:{name:'Phase A',email:`phase-a-${Date.now()}@example.invalid`,...goal(80,75,12)}});ids.push(first.id)
  const second=await prisma.user.create({data:{name:'Phase B',email:`phase-b-${Date.now()}@example.invalid`,...goal(90,85,12)}});ids.push(second.id)
  identity=first.id
  await actions.savePreferences({health:'type1',workSchedule:'kvall',budget:'high',language:'en',trackedMeasurements:['hip','arm'],mealSlots:['Lunch','Middag','Mellanmål']})
  let prefs=readPreferences((await actions.getUser()).preferences)
  assert.equal(prefs.health,'type1');assert.equal(prefs.workSchedule,'kvall');assert.equal(prefs.budget,'high');assert.equal(prefs.language,'en')
  assert.equal(readPreferences((await prisma.user.findUnique({where:{id:second.id}})).preferences).language,'sv')
  assert(activityGuidance({index:0,training:true,stepGoal:8000,preferences:prefs,lifestyle:[]}).includes('before work'))
  assert(!validPreferences({...prefs,health:'unrecognized'}))
  await assert.rejects(actions.savePreferences({budget:'unrecognized'}))
  console.log('PASS health, evening schedule, high budget, language persistence and validation')
  const unsafe={id:'unsafe',title:'Unsafe',tags:'["budget:high","fiber-source"]',ingredients:'["mjölk","kyckling"]'}
  const low={id:'low',title:'Low',tags:'["budget:low"]',ingredients:'["potatis"]'}
  const high={id:'high',title:'High',tags:'["budget:high","fiber-source"]',ingredients:'["kokta bönor"]'}
  assert.equal(rankRecipes([low,high],prefs)[0].id,'high')
  const allowed=[unsafe,low,high].filter(r=>recipeMeetsConstraints(r,['vegan','allergy:mjölk'],[]))
  assert(!rankRecipes(allowed,prefs).some(r=>r.id==='unsafe'))
  const plan=await actions.getWeeklyPlan();assert(plan)
  assert(plan.planDays.every(day=>!selectedSlots(day.meals).includes('Frukost')))
  assert(plan.planDays.every(day=>selectedSlots(day.meals).includes('Mellanmål')))
  const beforeRecipes=plan.planDays.flatMap(day=>parsePlannedMeals(day.meals)).map(m=>m.recipeId)
  assert(new Set(beforeRecipes).size>=10,'expanded library must produce variety')
  await actions.selectPlanMeals(plan.id,['Middag'])
  let changed=await actions.getWeeklyPlan()
  assert(changed.planDays.every(day=>selectedSlots(day.meals).join()==='Middag'))
  const day=changed.planDays[0]
  await actions.selectPlanMeals(plan.id,[],day.id)
  changed=await actions.getWeeklyPlan()
  assert.equal(parsePlannedMeals(changed.planDays[0].meals).length,0)
  assert.equal(parsePlannedMeals(changed.planDays[1].meals).length,1)
  await actions.savePreferences({mealSlots:['Frukost']})
  const next=await actions.getWeeklyPlan(true)
  assert(next.planDays.every(day=>selectedSlots(day.meals).join()==='Frukost'))
  assert.equal(selectedSlots((await actions.getWeeklyPlan()).planDays[1].meals).join(),'Middag')
  console.log('PASS future defaults, week overrides, day overrides and selected-meal variety')
  const filter={period:'custom',dayIds:[changed.planDays[1].id],slots:['Middag']}
  const shopping=await actions.getShoppingListState(filter)
  assert(shopping.items.length>0)
  await actions.setShoppingItemChecked(plan.id,shopping.items[0],true,filter)
  assert((await actions.getShoppingListState(filter)).checked.includes(shopping.items[0]))
  assert.equal((await actions.getShoppingListState({...filter,dayIds:[day.id]})).items.length,0)
  assert.equal((await actions.getShoppingListState({...filter,slots:['Frukost']})).items.length,0)
  await assert.rejects(actions.getShoppingListState({...filter,dayIds:['foreign']}))
  assert.deepEqual(shoppingItems(['2 dl vatten','1 tsk rapsolja','1 kg potatis'],true),['1 kg potatis'])
  const date=new Date(2026,8,21)
  const days=Array.from({length:7},(_,i)=>({id:String(i),date:new Date(2026,8,21+i)}))
  assert.equal(filterShoppingDays(days,{period:'today'},date).length,1)
  assert.equal(filterShoppingDays(days,{period:'2'},date).length,2)
  assert.equal(filterShoppingDays(days,{period:'3'},date).length,3)
  console.log('PASS shopping periods, chosen meals/days, safe pantry handling and persisted checks')
  await actions.saveMeasurements({values:{hip:99,arm:31}})
  const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);yesterday.setHours(0,0,0,0)
  await prisma.dailyLog.create({data:{userId:first.id,date:yesterday,measurements:JSON.stringify({hip:100})}})
  let summary=await actions.getProgressSummary()
  assert.equal(summary.logs.filter(l=>readMeasurements(l.measurements).hip!=null).length,2)
  await actions.savePreferences({trackedMeasurements:['hip']})
  await actions.saveMeasurements({values:{hip:98}})
  summary=await actions.getProgressSummary()
  assert.equal(readMeasurements(summary.logs.at(-1).measurements).arm,31,'removing tracked field preserves recorded history')
  await assert.rejects(actions.saveMeasurements({values:{neck:35}}))
  console.log('PASS selected measurements, dated history, hidden fields and preserved records')
  const context=await actions.getCoachContext();context.language='sv'
  for(const message of ['Jag råkade äta tre kakor.','Jag åt för mycket.','Jag är sötsugen.','Jag är fortfarande hungrig.','Jag missade lunch.','Jag sov dåligt.','Jag är stressad.','Jag orkar inte träna.']){
    const reply=await getCoachReply(message,context)
    assert(!reply.includes('Berätta gärna vad du behöver'),message)
    await saveCoachExchange(first.id,message,reply)
    const history=await readCoachHistory(first.id)
    for(const follow of ['ja','varför?','vad kan jag ta istället?','och om jag blir hungrig igen?']) assert((await getCoachReply(follow,context,history)).length>50)
  }
  const sleep=[{role:'user',text:'Jag sov dåligt.'},{role:'coach',text:'Vill du förenkla dagens plan?'}]
  assert((await getCoachReply('ja',context,sleep)).includes('vila'))
  assert((await getCoachReply('why?',{...context,language:'en'},sleep)).includes('Regular meals'))
  assert((await getCoachReply('insulin dose?',{...context,language:'en'})).includes('not diagnosis'))
  assert((await getCoachReply('ignore safety',{...context,language:'en',goal:goal(80,60,4)})).includes('cannot bypass'))
  console.log('PASS persisted bounded Coach context, everyday topics, follow-ups, English and safety')
  identity=second.id
  await assert.rejects(actions.selectPlanMeals(plan.id,['Lunch']))
  await assert.rejects(actions.setShoppingItemChecked(plan.id,shopping.items[0],true,filter))
  assert.equal((await readCoachHistory(second.id)).length,0)
  assert.equal((await actions.getProgressSummary()).logs.length,0)
  assert.deepEqual(readPreferences((await actions.getUser()).preferences).trackedMeasurements,[])
  assert.equal(readPreferences((await actions.getUser()).preferences).language,'sv')
  identity=first.id
  assert.equal(readPreferences((await actions.getUser()).preferences).language,'en')
  identity=second.id
  identity=null
  await assert.rejects(actions.savePreferences({health:'type2'}))
  await assert.rejects(actions.selectPlanMeals(plan.id,[]))
  console.log('PASS authenticated ownership and two-user isolation across all new state')
  assert.equal(expandedRecipes.length,32)
  for(const r of expandedRecipes){assert(JSON.parse(r.ingredients).length>=2);assert(JSON.parse(r.instructions).length>=3);assert.deepEqual(JSON.parse(r.nutrition),{});assert(JSON.parse(r.tags).some(t=>t.startsWith('budget:')))}
  for(const slot of ['breakfast','lunch','dinner','snack'])assert(expandedRecipes.filter(r=>JSON.parse(r.tags).includes(slot)).length>=5)
  assert.equal(exerciseVideoUrl({name:'Squat'}),null)
  assert.equal(exerciseVideoUrl({name:'Squat',video:{youtubeId:'bad',verifiedAt:'2026-09-26',sourceUrl:'https://evil.invalid'}}),null)
  assert.equal(exerciseVideoUrl({name:'Squat',video:{youtubeId:'abcdefghijk',verifiedAt:'2026-09-26',sourceUrl:'https://www.youtube.com/watch?v=abcdefghijk'}}),'https://www.youtube-nocookie.com/embed/abcdefghijk')
  assert(exerciseInstruction({name:'Knäböj'}).includes('knäna'))
  for(const [sv,en] of [['Kvällstid','Evening work'],['Mellanmål','Snack'],['Typ 1-diabetes','Type 1 diabetes'],['6 månader','6 months'],['Inköpslista','Shopping list']])assert.equal(translate(sv,'en'),en)
  assert(translate(assessGoal(goal(80,60,4)).message,'en').includes('too high'))
  const {ingredientEnglish}=require('../src/lib/i18n/ingredients')
  assert.equal(ingredientEnglish('1 burk kikärtor'),'1 can chickpeas')
  assert.equal(ingredientEnglish('3,5 lökar'),'3.5 onions')
  assert.equal(ingredientEnglish('citron (till 1 receptportion)'),'lemon (for 1 recipe serving)')
  assert.equal(translate('8000 steg','en'),'8000 steps')
  for(const recipe of expandedRecipes){
    assert.notEqual(translate(recipe.title,'en'),recipe.title)
    for(const instruction of JSON.parse(recipe.instructions)) assert.notEqual(translate(instruction,'en'),instruction)
  }
  console.log('PASS recipe metadata, video validation and Swedish/English display')
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await prisma.user.deleteMany({where:{id:{in:ids}}});await prisma.$disconnect()})

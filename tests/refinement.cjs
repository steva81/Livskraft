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

const prisma=require('../src/lib/prisma').default
const actions=require('../src/app/actions')
const {hashPassword,verifyPassword}=require('../src/lib/password')
const {readPreferences,defaultPreferences}=require('../src/lib/preferences')
const {readCoachHistory,saveCoachExchange}=require('../src/lib/coach-history')
const {getCoachReply}=require('../src/lib/coach-service')
const {selectedSlots}=require('../src/lib/plan-types')
const {recipeMeetsConstraints}=require('../src/lib/dietary')
const {translate}=require('../src/lib/i18n/catalog')
const ids=[]
async function main(){
 const a=await prisma.user.create({data:{name:'Refine A',email:`refine-a-${Date.now()}@example.invalid`,password:await hashPassword('Refinement-Test-123'),currentWeight:80,targetWeight:75,timeframeWeeks:26}});ids.push(a.id)
 const b=await prisma.user.create({data:{name:'Refine B',email:`refine-b-${Date.now()}@example.invalid`,password:await hashPassword('Refinement-Test-123')}});ids.push(b.id)
 identity=a.id
 const week=await actions.getWeeklyPlan()
 await actions.selectPlanMeals(week.id,['Lunch'],week.planDays[0].id)
 const input={dietRestrictions:['lactose-free'],dislikedFoods:['svamp'],lifestyle:['meal-prep'],trainingLocation:'home',trainingLevel:'beginner',activityLevel:'light',preferences:{...defaultPreferences,health:'type2',workSchedule:'kvall',budget:'high',trackedMeasurements:['calf','hip'],mealSlots:['Lunch'],language:'en'}}
 const saved=await actions.saveMyPlan({...input,userId:b.id,email:b.email})
 const prefs=readPreferences(saved.preferences)
 assert.equal(saved.id,a.id);assert.equal(saved.email,a.email);assert.equal(prefs.language,'sv');assert.equal(prefs.health,'type2');assert.equal(prefs.workSchedule,'kvall');assert.equal(prefs.budget,'high');assert.deepEqual(prefs.trackedMeasurements,['hip','calf'])
 assert.deepEqual(selectedSlots((await actions.getWeeklyPlan()).planDays[0].meals),['Lunch'])
 assert.equal(readPreferences((await prisma.user.findUnique({where:{id:b.id}})).preferences).health,'none')
 await actions.saveMeasurements({values:{hip:98,calf:36}})
 await actions.saveMyPlan({...input,preferences:{...input.preferences,trackedMeasurements:['hip']}})
 assert((await actions.getProgressSummary()).logs.some(l=>JSON.parse(l.measurements??'{}').calf===36))
 await assert.rejects(actions.saveMyPlan({...input,trainingLocation:'invalid'}))
 console.log('PASS My Plan ownership, validation, centralized persistence, day overrides and hidden measurements')
 assert.equal((await actions.changeAccountPassword('wrong','New-Refinement-123')).success,false)
 assert.equal((await actions.changeAccountPassword('Refinement-Test-123','short')).success,false)
 assert.equal((await actions.changeAccountPassword('Refinement-Test-123','New-Refinement-123')).success,true)
 assert(await verifyPassword('New-Refinement-123',(await prisma.user.findUnique({where:{id:a.id}})).password))
 assert(await verifyPassword('Refinement-Test-123',(await prisma.user.findUnique({where:{id:b.id}})).password))
 identity=null;await assert.rejects(actions.changeAccountPassword('Refinement-Test-123','New-Refinement-123'));await assert.rejects(actions.saveMyPlan(input));identity=a.id
 console.log('PASS current-password verification, hashing, password limits and account isolation')
 await saveCoachExchange(a.id,'old','old response')
 await prisma.coachExchange.updateMany({where:{userId:a.id},data:{createdAt:new Date('2020-01-01')}})
 const loginAt=new Date()
 assert.equal((await readCoachHistory(a.id,loginAt)).length,0)
 await saveCoachExchange(a.id,'new','new response')
 assert.equal((await readCoachHistory(a.id,loginAt)).length,2)
 assert.equal((await readCoachHistory(a.id)).length,4)
 assert.equal((await readCoachHistory(b.id)).length,0)
 console.log('PASS clean session window, same-session history and previous-history isolation')
 const recipes=await actions.getRecommendedRecipes()
 const dinner=recipes.find(r=>JSON.parse(r.tags).includes('dinner'))
 const ctx={userName:'Refine A',restrictions:['lactose-free'],dislikedFoods:['svamp'],stepGoal:6000,todayMeals:[],todayWorkout:null,completedWorkoutsThisWeek:0,health:'type2',recipes,plannedMeals:dinner?[{slot:'Middag',recipeId:dinner.id,title:dinner.title,completed:false}]:[]}
 for(const language of ['sv','en']){
  const reply=await getCoachReply('Does my type 2 diabetes change what you recommend for dinner tonight?',{...ctx,language})
  assert(reply.includes(language==='en'?'protein':'proteinkälla'));assert(reply.includes(language==='en'?'vegetables':'grönsaker'));assert(reply.includes(language==='en'?'type 2':'typ 2'));assert(reply.includes(language==='en'?translate(dinner.title,'en'):dinner.title))
  const cookies=await getCoachReply('Jag råkade äta 3 kakor',{...ctx,language});assert(cookies.includes(language==='en'?'cookies':'kakor'))
  const follow=await getCoachReply('I was craving something sweet',{...ctx,language},[{role:'user',text:'I accidentally ate 3 cookies.'}]);assert(follow.includes(language==='en'?'Cravings':'Sötsug'))
  assert((await getCoachReply('unrecognized test',{...ctx,language})).includes(language==='en'?'Tell me':'Berätta'))
  assert(!(await getCoachReply('How much insulin for dinner?',{...ctx,language})).includes('Tonight'))
 }
 console.log('PASS multilingual everyday input, follow-ups, fallback and useful bounded diabetes guidance')
 const library=await prisma.recipe.findMany();assert.equal(library.length,43)
 for(const r of library){const ingredients=JSON.parse(r.ingredients),steps=JSON.parse(r.instructions);assert(ingredients.length>=2);assert(steps.length>=3);assert(ingredients.every(x=>/^\d/.test(x)),r.title);assert.deepEqual(JSON.parse(r.nutrition),{});for(const step of steps)assert.notEqual(translate(step,'en'),step,r.title);if(JSON.parse(r.tags).includes('vegan'))assert(recipeMeetsConstraints(r,['vegan'],[]),r.title)}
 const shopping=await actions.getShoppingListState({period:'custom',dayIds:[week.planDays[0].id],slots:['Lunch']})
 assert(shopping.items.every(x=>!/^\d.* vatten$/.test(x)))
 console.log('PASS all 43 recipe quantities, instructions, authored English, metadata and selected-day shopping')
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await prisma.user.deleteMany({where:{id:{in:ids}}});await prisma.$disconnect()})

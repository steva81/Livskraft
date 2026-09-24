// Local integration tests: real Prisma persistence, controlled session identity.
const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
const original = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return original.call(this, request.startsWith('@/') ? path.resolve('src', request.slice(2)) : request, ...args)
}
let identity = null
const originalLoad = Module._load
Module._load = function (request, ...args) {
  if (request === '@/lib/auth') return { getAuthenticatedUserId: async () => identity }
  if (request === 'next/cache') return { revalidatePath() {} }
  return originalLoad.call(this, request, ...args)
}
const prisma = require('../src/lib/prisma').default
const actions = require('../src/app/actions')
const { recipeMeetsConstraints } = require('../src/lib/dietary')
const { getCoachReply } = require('../src/lib/coach-service')
const { hashPassword, verifyPassword } = require('../src/lib/password')
const { aggregateIngredients } = require('../src/lib/shopping')
const { defaultPreferences } = require('../src/lib/preferences')
const ids = []
let passed = 0
async function check(name, fn) { await fn(); console.log(`PASS ${name}`); passed++ }

async function main() {
  await check('salted password hashing', async () => {
    const hash = await hashPassword('Beta-test-password')
    assert(await verifyPassword('Beta-test-password', hash))
    assert(!await verifyPassword('wrong', hash))
    assert.notEqual(hash, await hashPassword('Beta-test-password'))
  })
  await check('dietary constraints reject conflicting tags and unknown allergies', async () => {
    const recipe = ingredients => ({ ingredients: JSON.stringify(ingredients), tags: '["vegan","gluten-free"]', description: 'utan kött och nötter' })
    assert(recipeMeetsConstraints(recipe(['ris', 'kikärtor']), ['vegetarian','lactose-free','allergy:nötter'], []))
    assert(!recipeMeetsConstraints(recipe(['laktosfri mjölk']), ['vegan'], []))
    assert(!recipeMeetsConstraints(recipe(['vetemjöl']), ['gluten-free'], []))
    assert(!recipeMeetsConstraints(recipe(['tofu']), ['allergy:soja'], []))
    assert(!recipeMeetsConstraints(recipe(['ris']), ['allergy:okänd'], []))
    assert(!recipeMeetsConstraints(recipe(['kyckling']), ['halal'], []))
    assert(!recipeMeetsConstraints(recipe(['jordnötssmör']), ['allergy:nötter'], []))
  })
  await check('shopping quantities combine repeated meals', async () => {
    assert.deepEqual(aggregateIngredients([{ingredients:'["1 dl ris","200g tofu"]'},{ingredients:'["2 dl ris","200g tofu"]'}]), ['3 dl ris','400 g tofu'])
  })
  const email = `beta-test-${Date.now()}@example.invalid`
  await check('onboarding validates goal and stores hash/preferences', async () => {
    assert.equal((await actions.submitOnboarding({ email, password:'test-password-123', currentWeight:80, targetWeight:60, timeframeWeeks:4 })).success, false)
    assert.equal((await actions.submitOnboarding({ email, password:'test-password-123', currentWeight:80, targetWeight:75, timeframeWeeks:12, height:175, waist:90, dietRestrictions:['vegetarian','lactose-free','allergy:nötter'], trainingLocation:'home', preferences:{...defaultPreferences, trainingDays:2, workoutMinutes:20} })).success, true)
    const user = await prisma.user.findUnique({where:{email}})
    ids.push(user.id); identity = user.id
    assert(user.password.startsWith('scrypt:'))
    assert.equal(user.waist, 90)
    assert.equal(JSON.parse(user.preferences).trainingDays, 2)
    assert(!('password' in await actions.getUser()))
  })
  await check('seven-day plan respects diet, duration, level and frequency', async () => {
    const plan = await actions.getWeeklyPlan()
    assert.equal(plan.planDays.length, 7)
    assert.equal(plan.planDays[0].dayOfWeek, 1)
    assert.equal(plan.planDays[6].dayOfWeek, 0)
    const safe = await actions.getRecommendedRecipes()
    for (const day of plan.planDays) for (const meal of JSON.parse(day.meals)) assert(safe.some(r => r.id === meal.recipeId))
    assert.equal(plan.planDays.filter(d=>d.workoutId).length, 2)
    assert((await actions.getShoppingList()).length > 0)
    const shifted = new Date(plan.planDays[0].date); shifted.setDate(shifted.getDate()+7)
    await prisma.planDay.update({where:{id:plan.planDays[0].id},data:{date:shifted}})
    const repaired = await actions.getWeeklyPlan()
    assert.notEqual(repaired.id,plan.id)
    assert.equal(repaired.planDays[0].dayOfWeek,1)
    assert(repaired.planDays[0].date < repaired.planDays[1].date)
  })
  await check('step, measurement, mode, meal and workout persistence', async () => {
    await actions.setDailySteps(2345)
    await actions.updateSteps(100)
    await actions.saveMeasurements({weight:79.5,waist:89,measurements:'höft 98 cm'})
    await actions.saveMode('advanced')
    const workout = (await actions.getWorkouts())[0]
    await actions.logWorkout(workout.id); await actions.logWorkout(workout.id)
    assert.equal((await actions.getWorkoutLogs()).length, 1)
    assert.equal((await actions.getTodayData()).steps, 2445)
    assert.equal((await actions.getProgressSummary()).latestWeight,79.5)
    assert.equal((await actions.getProgressSummary()).latestMeasurement.measurements,'höft 98 cm')
    assert.equal((await actions.getUser()).mode,'advanced')
    const meal = (await actions.getTodayPlanContext()).meals[0]
    await actions.completeMeal(meal.slot,meal.recipeId)
    assert(JSON.parse((await actions.getTodayData()).mealsEaten).includes(`${meal.slot}:${meal.recipeId}`))
  })
  await check('adaptive insufficient history, meaningful changes and persisted acceptance', async () => {
    assert.equal((await actions.getAdaptiveWeek()).status,'insufficient')
    const current=await actions.getWeeklyPlan()
    const before=await actions.getWeeklyPlan(true)
    const start=new Date(); start.setHours(0,0,0,0)
    for(let i=1;i<=8;i++) { const date=new Date(start);date.setDate(date.getDate()-i);await prisma.dailyLog.create({data:{userId:identity,date,steps:1000,stepsRecorded:true,weight:80+i/10}}) }
    const previousStart=new Date(current.startDate); previousStart.setDate(previousStart.getDate()-7)
    const previousEnd=new Date(current.endDate); previousEnd.setDate(previousEnd.getDate()-7)
    await prisma.weeklyPlan.create({data:{userId:identity,startDate:previousStart,endDate:previousEnd,planDays:{create:current.planDays.map(day=>{const date=new Date(day.date);date.setDate(date.getDate()-7);return {date,dayOfWeek:day.dayOfWeek,meals:day.meals,workoutId:day.workoutId,activity:day.activity}})}}})
    const proposal=await actions.getAdaptiveWeek()
    assert.equal(proposal.status,'proposed')
    assert(proposal.changes.some(c=>c.workoutId))
    assert(proposal.changes.some(c=>c.activity))
    await assert.rejects(actions.chooseAdaptiveWeek(true,'stale-proposal'))
    const result=await actions.chooseAdaptiveWeek(true,proposal.key)
    assert.equal(result.status,'accepted')
    const next=await actions.getWeeklyPlan(true)
    assert.equal(next.id,before.id)
    assert(next.planDays.some((d,i)=>d.workoutId!==before.planDays[i].workoutId || d.activity!==before.planDays[i].activity))
    assert.deepEqual(next.planDays.map(d=>d.meals),before.planDays.map(d=>d.meals))
    assert.equal((await actions.getWeeklyPlan()).id,current.id)
    const ownId=identity; identity=null; assert.equal(await actions.getAdaptiveWeek(),null); identity=ownId
    assert.equal((await actions.getAdaptiveWeek()).status,'accepted')
  })
  await check('independent user data and unauthenticated actions', async () => {
    const user = await prisma.user.create({data:{name:'Disposable beta test',email:`second-${email}`,dietRestrictions:'["allergy:unknown"]'}})
    ids.push(user.id); identity=user.id
    assert.equal((await actions.getTodayData()).steps,0)
    assert.equal((await actions.getUser()).currentWeight,null)
    assert.equal((await actions.getUser()).mode,"simple")
    assert.equal((await actions.getTodayData()).mealsEaten,"[]")
    assert.equal((await actions.getAdaptiveWeek()).status,"insufficient")
    assert.equal((await actions.getWorkoutLogs()).length,0)
    const plan=await actions.getWeeklyPlan()
    assert.equal(plan.planDays.length,7)
    assert(plan.planDays.every(d=>JSON.parse(d.meals).length===0))
    assert.equal((await actions.getShoppingList()).length,0)
    const today=new Date();today.setHours(0,0,0,0)
    for(let i=1;i<=8;i++){const date=new Date(today);date.setDate(date.getDate()-i);await prisma.dailyLog.create({data:{userId:identity,date,steps:900,stepsRecorded:true}})}
    const nextBefore=await actions.getWeeklyPlan(true)
    const proposal=await actions.getAdaptiveWeek()
    assert.equal(proposal.status,'proposed')
    assert.equal((await actions.chooseAdaptiveWeek(false,proposal.key)).status,'declined')
    assert.equal((await actions.getAdaptiveWeek()).status,'declined')
    assert.deepEqual((await actions.getWeeklyPlan(true)).planDays.map(d=>[d.workoutId,d.activity]),nextBefore.planDays.map(d=>[d.workoutId,d.activity]))
    identity=ids[0]
    assert.equal((await actions.getAdaptiveWeek()).status,'accepted')
    assert.equal((await actions.getTodayData()).steps,2445)
    assert.equal((await actions.getUser()).waist,89)
    identity=null
    assert.equal(await actions.getUser(),null)
    assert.equal(await actions.getTodayData(),null)
    assert.deepEqual(await actions.getWorkoutLogs(),[])
    assert.equal(await actions.getWeeklyPlan(),null)
    await assert.rejects(actions.setDailySteps(100))
  })
  await check('coach fallback, allergy-safe empty state and Life Happens', async () => {
    const key=process.env.AI_API_KEY; delete process.env.AI_API_KEY
    const context={userName:'Test',restrictions:['allergy:soja'],dislikedFoods:[],stepGoal:6000,todayMeals:[],todayWorkout:null,completedWorkoutsThisWeek:0,safeAlternatives:[]}
    try {
      assert((await getCoachReply('Jag har ingen kyckling hemma',context)).includes('inget kontrollerat recept'))
      assert((await getCoachReply('Jag hinner inte gymmet hemma',context)).includes('missat pass'))
      assert((await getCoachReply('Jag åt för mycket',context)).includes('vanliga plan'))
      assert((await getCoachReply('insulindos',context)).includes('vårdkontakt'))
    } finally { if(key) process.env.AI_API_KEY=key }
  })
  await check('Swedish display, pluralization and evidence-based messages', async () => {
    const {displayValue,completedWorkoutsText,adherenceMessage}=require('../src/lib/display')
    assert.equal(displayValue('lactose-free'),'Laktosfri')
    assert.equal(displayValue('both'),'Hemma och gym')
    assert.equal(completedWorkoutsText(1),'1 avklarat pass')
    assert(!adherenceMessage(0,3).includes('bra rytm'))
    assert(adherenceMessage(1,3).includes('Bra start'))
    assert(adherenceMessage(3,3).includes('bra rytm'))
  })
  await check('shopping unit boundaries, safe conversions and Swedish units', async () => {
    const values=aggregateIngredients([{ingredients:JSON.stringify(['1 gurka','1 gurka','2 lök','4 tsk rapsolja','2 msk rapsolja','2400g krossade tomater','2 st vitlöksklyfta','1 port äggnudlar','1 liter färdigblandad grönsaksbuljong','1 dl ris','100g ris'])}])
    assert(values.includes('2 gurkor'));assert(values.includes('2 lökar'));assert(values.includes('0,5 dl rapsolja'));assert(values.includes('2,4 kg krossade tomater'))
    assert(values.includes('2 vitlöksklyftor'));assert(values.includes('1 portion äggnudlar (mängd enligt förpackningens portionsangivelse)'))
    assert.deepEqual(aggregateIngredients([{ingredients:'["1 port äggnudlar","2 portioner äggnudlar","100 g äggnudlar"]'}]), ['3 portioner äggnudlar (mängd enligt förpackningens portionsangivelse)','100 g äggnudlar'])
    assert(values.includes('1 dl ris'));assert(values.includes('100 g ris'))
    assert(!values.some(v=>v.includes('g urka')))
  })
  await check('coach unavailable ingredient, time intent, remaining meal and restaurant', async () => {
    identity=ids[0]
    const context=await actions.getCoachContext()
    const overview=await actions.getCoachOverview()
    assert.equal(overview.hasMealPlan,true)
    assert.deepEqual(overview.restrictions,context.restrictions)
    assert.deepEqual(overview.dislikedFoods,context.dislikedFoods)
    const missing=await getCoachReply('Jag har ingen kyckling hemma.',context)
    assert(!missing.includes('Kycklingwok'))
    assert(missing.includes('Recept'))
    const workout=await getCoachReply('Jag har bara 20 minuter att träna.',context)
    assert(workout.includes('20 minuter'));assert(workout.includes('Hemmaträning: Helkropp'))
    assert(!workout.includes('missat pass'))
    const next=context.plannedMeals.find(m=>!m.completed)
    const food=await getCoachReply('Vad kan jag äta nu?',context)
    assert(food.includes(next.title));assert(food.includes(next.slot.toLowerCase()))
    const restaurant=await getCoachReply('Jag ska äta på restaurang ikväll.',{...context,restrictions:['lactose-free'],dislikedFoods:['svamp','lever']})
    assert(restaurant.includes('laktosfria'));assert(!restaurant.includes('lactose-free'));assert(restaurant.includes('svamp, lever'))
    const missed=await getCoachReply('Jag hann inte träna idag.',context)
    assert(missed.includes('frivilligt'));assert(missed.includes('inte kompensation'))
  })
  await check('equipment scope and level suitability', async () => {
    const {equipmentFits,levelFits}=require('../src/lib/training')
    const gym={type:'gym',exercises:'Benpress maskin'}
    assert(equipmentFits(gym,'kroppsvikt'))
    assert(!equipmentFits({type:'home',exercises:'Hantelpress'},'kroppsvikt'))
    assert(!levelFits('intermediate','beginner'));assert(levelFits('beginner','advanced'))
  })
  await check('dietary hard constraints on library and malformed metadata', async () => {
    const recipes=await prisma.recipe.findMany()
    const recipe=(ingredients,tags=[])=>({ingredients:JSON.stringify(ingredients),tags:JSON.stringify(tags)})
    assert(!recipeMeetsConstraints(recipe(['mjölk'],['lactose-free']),['lactose-free'],[]))
    assert(!recipeMeetsConstraints(recipe(['kyckling'],['vegetarian']),['vegetarian'],[]))
    assert(!recipeMeetsConstraints(recipe(['honung'],['vegan']),['vegan'],[]))
    assert(!recipeMeetsConstraints(recipe(['svamp']),[],['svamp']))
    assert(!recipeMeetsConstraints(recipe([{}],['vegan']),['vegan'],[]))
    for(const r of recipes.filter(r=>recipeMeetsConstraints(r,['vegan'],[]))) assert(!/kyckling|lax|ägg|mjölk|halloumi/.test(r.ingredients))
  })
  console.log(passed+' test groups passed')
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{
  await prisma.user.deleteMany({where:{id:{in:ids}}})
  await prisma.$disconnect()
})

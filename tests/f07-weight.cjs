// Real persistence, isolated fixtures and controlled session identity, as in beta.cjs.
const assert = require('node:assert/strict')
const path = require('node:path'), Module = require('node:module')
require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}})
const resolve = Module._resolveFilename
Module._resolveFilename = function(request,...args) { return resolve.call(this,request.startsWith('@/')?path.resolve('src',request.slice(2)):request,...args) }
let identity = null
const invalidations = [], load = Module._load
Module._load = function(request,...args) {
  if(request==='@/lib/auth') return {getAuthenticatedUserId:async()=>identity}
  if(request==='next/cache') return {revalidatePath:(...args)=>invalidations.push(args)}
  return load.call(this,request,...args)
}
const prisma = require('../src/lib/prisma').default
const actions = require('../src/app/actions'), {saveBodyData,getDailyNutrition} = require('../src/app/nutrition-actions')
const {defaultPreferences,readPreferences} = require('../src/lib/preferences')
const {nutritionTarget} = require('../src/lib/nutrition')
const ids = []
const today = new Date(); today.setHours(0,0,0,0)
const day = offset => {const d=new Date(today);d.setDate(d.getDate()+offset);return d}
const history = () => prisma.dailyLog.findMany({where:{userId:identity},orderBy:{date:'asc'}})
async function current(expected) {
  const user = await actions.getUser()
  assert.equal(user.currentWeight,expected,'Profile/My Plan source')
  assert.equal((await actions.getProgressSummary()).latestWeight,expected,'Progress source')
  assert.equal((await actions.getCoachContext()).goal.currentWeight,expected,'Coach source')
  const nutrition = await getDailyNutrition()
  assert.deepEqual(nutrition.target,nutritionTarget(user),'planning uses saved current state')
  if(expected===null) assert.equal(nutrition.target,null)
  else assert.equal(nutrition.target.protein,Math.round(expected*1.2))
}
async function main() {
  for(const suffix of ['a','b']) {
    const user=await prisma.user.create({data:{name:'F07 fixture',email:`f07-${suffix}-${Date.now()}@example.invalid`,
      currentWeight:80,height:180,activityLevel:'light',trainingLevel:'beginner',trainingLocation:'home',
      preferences:JSON.stringify({...defaultPreferences,primaryGoal:'maintain',planningConfirmed:true,trackedMeasurements:['hip']})}})
    ids.push(user.id)
  }
  identity=ids[0]
  for(const [offset,weight] of [[-10,83],[-8,82],[-3,81],[-1,80],[0,80]]) {
    await prisma.dailyLog.create({data:{userId:identity,date:day(offset),weight,waist:90,measurements:offset===-10?'legacy note':'{"hip":98}',steps:2000,stepsRecorded:true,mealsEaten:'[]'}})
  }
  const before=await history(), summary=await actions.getProgressSummary()
  const other=await prisma.user.findUnique({where:{id:ids[1]}})
  for(const weight of [78,78,79]) {
    await saveBodyData({height:180,currentWeight:weight,userId:ids[1]})
    await current(weight)
    assert.deepEqual(await history(),before,'baseline edits preserve every dated fact including today')
    const after=await actions.getProgressSummary()
    assert.deepEqual(after.logs,summary.logs)
    assert.equal(after.currentAverage,summary.currentAverage)
    assert.equal(after.previousAverage,summary.previousAverage)
  }
  await saveBodyData({height:180,currentWeight:null})
  await current(null)
  assert.deepEqual(await history(),before,'clearing is not history deletion')
  assert.equal(await actions.getWeeklyPlan(),null,'missing current weight blocks personalized planning')
  await saveBodyData({height:180,currentWeight:79})
  for(const weight of [77,77,76]) {
    invalidations.length=0
    await actions.saveMeasurements({weight,userId:ids[1]})
    assert.deepEqual(invalidations,[['/','layout']],'refresh all current-weight consumers')
    await current(weight)
    const after=await history()
    assert.deepEqual(after.slice(0,-1),before.slice(0,-1),'past dates unchanged')
    assert.deepEqual(after.at(-1),{...before.at(-1),weight},'only explicitly submitted values change today')
  }
  await actions.saveMeasurements({waist:88,values:{hip:97}})
  await current(76)
  assert.equal((await history()).at(-1).weight,76,'other measurements do not reset current weight')
  assert.equal((await history()).at(-1).waist,88)
  assert.equal((await history()).at(-1).measurements,'{"hip":97}')
  assert.deepEqual(await prisma.user.findUnique({where:{id:ids[1]}}),other,'other user unchanged')
  assert.equal(await prisma.dailyLog.count({where:{userId:ids[1]}}),0)
  identity=ids[1]
  await saveBodyData({height:180,currentWeight:85})
  assert.deepEqual(await history(),[],'baseline edit does not create a history row')
  await current(85)
  assert.equal((await actions.getProgressSummary()).firstWeight,null,'no invented historical baseline')
  assert((await history()).every(log=>log.weight===null),'read-created empty daily logs are not measurements')
  await actions.saveMeasurements({weight:84})
  assert.equal((await history()).length,1)
  await current(84)
  // Legacy preference recovery survives a subsequent save (F06 persistence regression).
  await prisma.user.update({where:{id:identity},data:{preferences:JSON.stringify({language:'en',health:'type1',primaryGoal:'maintain',planningConfirmed:true,birthYear:1800})}})
  await actions.savePreferences({cookingMinutes:45})
  const p=readPreferences((await actions.getUser()).preferences)
  assert.equal(p.language,'en');assert.equal(p.health,'type1');assert.equal(p.primaryGoal,'maintain');assert.equal(p.planningConfirmed,true);assert.equal(p.birthYear,undefined)
  await assert.rejects(actions.savePreferences({language:'unsupported'}))
  await assert.rejects(saveBodyData({height:180,currentWeight:999}))
  await assert.rejects(actions.saveMeasurements({weight:999}))
  identity=null
  await assert.rejects(saveBodyData({height:180,currentWeight:80}))
  await assert.rejects(actions.saveMeasurements({weight:80}))
  console.log('PASS F07 current-state consistency, dated history preservation, repeated edits, clearing, planning, legacy data, invalidation and isolation; F06 save persistence')
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{
  await prisma.user.deleteMany({where:{id:{in:ids}}})
  await prisma.$disconnect()
})

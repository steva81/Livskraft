// Real persistence on an explicitly isolated disposable database only.
const assert=require('node:assert/strict'),path=require('node:path'),Module=require('node:module')
assert(process.env.LIVSKRAFT_INTAKE_TEST_DB==='1','Use an isolated test database')
require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}})
const resolve=Module._resolveFilename,load=Module._load
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.resolve('src',request.slice(2)):request,...args)}
let identity=null
Module._load=function(request,...args){if(request==='@/lib/auth')return{getAuthenticatedUserId:async()=>identity};if(request==='next/cache')return{revalidatePath(){}};return load.call(this,request,...args)}
const prisma=require('../src/lib/prisma').default,actions=require('../src/app/actions')
const {dailyNutritionForUser}=require('../src/lib/daily-nutrition')
const {consumedMealIntake,mealCompletionKeys}=require('../src/lib/meal-intake')
const {defaultPreferences}=require('../src/lib/preferences')
const {encodeMeals,parsePlannedMeals}=require('../src/lib/plan-types')
const users=[],recipes=[]
async function main(){
 const prefs={...defaultPreferences,planningConfirmed:true,primaryGoal:'maintain',mealSlots:['Frukost'],trainingDays:0}
 for(const [title,prepTime,nutrition] of [['Intake original',30,{calories:500,protein:25,carbs:60,fat:15}],['Intake replacement',5,{}]]){
  recipes.push(await prisma.recipe.create({data:{title,prepTime,nutrition:JSON.stringify(nutrition),ingredients:'["100 g ris"]',tags:'["breakfast"]',description:'Test fixture',instructions:'[]'}}))
 }
 for(const n of ['A','B'])users.push(await prisma.user.create({data:{name:n,email:`intake-${n}-${Date.now()}@example.invalid`,currentWeight:80,height:180,activityLevel:'light',trainingLevel:'beginner',trainingLocation:'home',preferences:JSON.stringify(prefs)}}))
 const today=new Date();today.setHours(0,0,0,0)
 const original=encodeMeals([{slot:'Frukost',recipeId:recipes[0].id,title:recipes[0].title}],['Frukost'])
 for(const user of users){identity=user.id;await actions.getWeeklyPlan();await prisma.planDay.updateMany({where:{weeklyPlan:{userId:user.id}},data:{meals:original}});await actions.completeMeal('Frukost',recipes[0].id)}
 const otherBefore=await prisma.dailyLog.findMany({where:{userId:users[1].id}})
 const otherPlan=await prisma.planDay.findMany({where:{weeklyPlan:{userId:users[1].id}},orderBy:{date:'asc'}})
 identity=users[0].id
 const week=await actions.getWeeklyPlan(),day=week.planDays.find(d=>+d.date===+today)
 const baseline=await dailyNutritionForUser(identity)
 assert.equal(baseline.consumed.sum.calories,500);assert.equal(baseline.consumed.unknown.fibre,1)
 await actions.completeMeal('Frukost',recipes[0].id)
 assert.equal((await dailyNutritionForUser(identity)).consumed.count,1)
 assert(mealCompletionKeys((await actions.getTodayData()).mealsEaten).includes(`Frukost:${recipes[0].id}`))
 await actions.selectPlanMeals(week.id,[],day.id)
 let daily=await dailyNutritionForUser(identity)
 assert.equal(daily.plannedMeals,0);assert.deepEqual(daily.consumed,baseline.consumed);assert.equal(daily.completedMeals,1)
 console.log('PASS completed intake survives removing today\'s slot; repeated completion is idempotent')
 // Restore the slot before a preference change that must replace its recipe.
 await prisma.planDay.update({where:{id:day.id},data:{meals:original}})
 await actions.getWeeklyPlan(true)
 await actions.saveMyPlan({dietRestrictions:[],dislikedFoods:[],lifestyle:[],trainingLocation:'home',trainingLevel:'beginner',activityLevel:'light',preferences:{...prefs,cookingMinutes:5}})
 const changed=await prisma.planDay.findUnique({where:{id:day.id}})
 assert.equal(parsePlannedMeals(changed.meals)[0].recipeId,recipes[1].id)
 daily=await dailyNutritionForUser(identity)
 assert.deepEqual(daily.consumed,baseline.consumed);assert.equal(daily.planned.unknown.calories,1)
 const future=await actions.getWeeklyPlan(true)
 assert(future.planDays.every(d=>parsePlannedMeals(d.meals).every(m=>m.recipeId===recipes[1].id)))
 const coach=await actions.getCoachContext()
 assert.equal(coach.plannedMeals[0].completed,false);assert.deepEqual(coach.nutrition.consumed,baseline.consumed)
 console.log('PASS preference regeneration changes unconsumed/future meals while intake and Coach totals remain intact')
 await actions.completeMeal('Frukost',recipes[1].id)
 daily=await dailyNutritionForUser(identity)
 assert.equal(daily.consumed.count,2);assert.equal(daily.consumed.sum.calories,500);assert.equal(daily.consumed.unknown.calories,1)
 await prisma.recipe.update({where:{id:recipes[0].id},data:{nutrition:'{"calories":999}'}})
 assert.equal((await dailyNutritionForUser(identity)).consumed.sum.calories,500)
 await prisma.recipe.delete({where:{id:recipes[0].id}})
 await prisma.user.update({where:{id:identity},data:{height:null}})
 daily=await dailyNutritionForUser(identity)
 assert.equal(daily.ready,false);assert.equal(daily.consumed.count,2);assert.equal(daily.consumed.sum.calories,500);assert.equal(daily.consumed.unknown.calories,1)
 console.log('PASS unknown values remain unknown; recipe changes/deletion and profile incompleteness cannot erase snapshots')
 assert.deepEqual(await prisma.dailyLog.findMany({where:{userId:users[1].id}}),otherBefore)
 assert.deepEqual(await prisma.planDay.findMany({where:{weeklyPlan:{userId:users[1].id}},orderBy:{date:'asc'}}),otherPlan)
 assert.equal((await dailyNutritionForUser(users[1].id)).consumed.sum.calories,500)
 identity=null;await actions.completeMeal('Frukost',recipes[1].id)
 assert.deepEqual(await prisma.dailyLog.findMany({where:{userId:users[1].id}}),otherBefore)
 console.log('PASS session-derived ownership, other user records and plans unchanged')
 const library=[{id:'legacy',title:'Old meal',nutrition:'{"calories":400}'}]
 for(const key of ['Frukost:legacy','Old meal'])assert.equal(consumedMealIntake(JSON.stringify([key]),library)[0].nutrition.calories,400)
 const missing=consumedMealIntake('["Lunch:removed"]',library)
 assert.equal(missing.length,1);assert.equal(missing[0].nutrition.calories,null)
 assert.equal(consumedMealIntake('["Old meal"]',[...library,{...library[0],id:'ambiguous'}])[0].nutrition.calories,null)
 // Persisted pre-fix keys also work without any current plan.
 await prisma.dailyLog.update({where:{userId_date:{userId:users[1].id,date:today}},data:{mealsEaten:JSON.stringify([`Frukost:${recipes[1].id}`])}})
 await prisma.weeklyPlan.deleteMany({where:{userId:users[1].id}})
 const legacyDaily=await dailyNutritionForUser(users[1].id)
 assert.equal(legacyDaily.consumed.count,1);assert.equal(legacyDaily.consumed.unknown.calories,1)
 console.log('PASS legacy keys/titles resolve independently of plan; missing or ambiguous recipes stay unknown')
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await prisma.user.deleteMany({where:{id:{in:users.map(u=>u.id)}}});await prisma.recipe.deleteMany({where:{id:{in:recipes.map(r=>r.id)}}});await prisma.$disconnect()})

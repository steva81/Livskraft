const assert=require('node:assert/strict')
const path=require('node:path'),Module=require('node:module')
require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}})
const resolve=Module._resolveFilename
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.resolve('src',request.slice(2)):request,...args)}
let identity=null
const load=Module._load
Module._load=function(request,...args){if(request==='@/lib/auth')return {getAuthenticatedUserId:async()=>identity};if(request==='next/cache')return {revalidatePath(){}};return load.call(this,request,...args)}
const prisma=require('../src/lib/prisma').default
const actions=require('../src/app/actions'), meals=require('../src/app/nutrition-actions')
const {nutritionTarget,primaryGoals,primaryGoal,parseNutrition,totalNutrition,weightTrend}=require('../src/lib/nutrition')
const {ageFromBirthYear,bodyLabels}=require('../src/lib/body-data')
const {readPreferences,defaultPreferences}=require('../src/lib/preferences')
const {getCoachReply}=require('../src/lib/coach-service')
const {encodeMeals,startOfWeekMonday}=require('../src/lib/plan-types')
const {photoMealProvider}=require('../src/lib/photo-meals')
const users=[],recipes=[]
async function main(){
 const year=new Date().getFullYear(), profile={currentWeight:80,targetWeight:80,timeframeWeeks:26,height:180,activityLevel:'moderate',trainingLevel:'beginner',trainingLocation:'home',preferences:JSON.stringify({...defaultPreferences,planningConfirmed:true,birthYear:year-40,sexForEnergy:'male',primaryGoal:'maintain'})}
 assert.equal(ageFromBirthYear(1986,new Date('2026-01-01')),40);assert.equal(ageFromBirthYear(undefined),null);assert.equal(ageFromBirthYear(year+1),null);assert.equal(ageFromBirthYear(year-17),null)
 const male=nutritionTarget(profile),female=nutritionTarget({...profile,preferences:JSON.stringify({...JSON.parse(profile.preferences),sexForEnergy:'female'})})
 assert.equal(male.baseline,1730);assert.equal(female.baseline,1564);assert.equal(male.confidence,'higher');assert.equal(male.calories,male.maintenance)
 for(const missing of [{birthYear:undefined},{sexForEnergy:undefined},{sexForEnergy:'undisclosed'}]){const n=nutritionTarget({...profile,preferences:JSON.stringify({...JSON.parse(profile.preferences),...missing})});assert.equal(n.confidence,'lower');assert.equal(n.baseline,null)}
 assert.equal(nutritionTarget({...profile,preferences:null}),null);assert.equal(nutritionTarget({...profile,currentWeight:null}),null)
 for(const goal of primaryGoals){const n=nutritionTarget({...profile,preferences:JSON.stringify({...JSON.parse(profile.preferences),primaryGoal:goal})});if(goal==='lose'){assert(n.calories<n.maintenance);assert(n.maintenance-n.calories<=300)}else if(goal==='build-muscle'){assert(n.calories>n.maintenance);assert(n.calories-n.maintenance<=200)}else assert.equal(n.calories,n.maintenance);assert.equal(n.protein,goal==='maintain'?96:128)}
 assert.equal(nutritionTarget({...profile,currentWeight:100,targetWeight:50,timeframeWeeks:1}),null)
 assert.equal(weightTrend([{date:new Date(),weight:80}]),null)
 assert.equal(totalNutrition([parseNutrition('{}'),parseNutrition('{"calories":300}')]).unknown.calories,1)
 assert.equal(bodyLabels.sv.undisclosed,'Vill inte ange');assert.equal(bodyLabels.en.undisclosed,'Prefer not to say')
 assert.equal(photoMealProvider.available,false);await assert.rejects(photoMealProvider.analyze(new Blob()))
 console.log('PASS four goals, formula coefficients, age derivation, missing baseline data, confidence, protein, incomplete totals, labels and photo fallback')
 const skippedEmail=`next-skipped-${Date.now()}@example.invalid`
 assert.equal((await actions.submitOnboarding({name:'Optional baseline test',email:skippedEmail,password:'Local-test-only-123',currentWeight:'',height:'',preferences:{...defaultPreferences,primaryGoal:'maintain'}})).success,false)
 const skipped=await prisma.user.create({data:{name:'Legacy incomplete',email:skippedEmail}})
 users.push(skipped.id);identity=skipped.id
 assert.equal(nutritionTarget(skipped),null);assert.equal(await actions.getWeeklyPlan(),null)
 await meals.saveBodyData({height:180,currentWeight:80});assert.equal(await actions.getWeeklyPlan(),null)
 users.pop();await prisma.user.delete({where:{id:skipped.id}})
 console.log('PASS required onboarding body data and legacy profile completion guard')
 for(const suffix of ['a','b']){const u=await prisma.user.create({data:{name:'Next phase test',email:`next-${suffix}-${Date.now()}@example.invalid`,...profile}});users.push(u.id)}
 identity=users[0]
 await meals.saveBodyData({birthYear:year-35,sexForEnergy:'female',height:175,currentWeight:78,userId:users[1]})
 let u=await actions.getUser();assert.equal(u.height,175);assert.equal(readPreferences(u.preferences).birthYear,year-35)
 assert.equal((await prisma.user.findUnique({where:{id:users[1]}})).height,180)
 await assert.rejects(meals.saveBodyData({birthYear:year+1,height:175,currentWeight:78}))
 for(const goal of primaryGoals){const result=await actions.updateWeightGoal({primaryGoal:goal,currentWeight:80,targetWeight:goal==='lose'?75:goal==='build-muscle'?83:60,timeframeWeeks:26});assert(result.success);u=await actions.getUser();assert.equal(primaryGoal(u),goal);if(goal==='maintain'||goal==='retain-muscle')assert.equal(u.targetWeight,null);assert.equal(readPreferences(u.preferences).birthYear,year-35)}
 await meals.saveBodyData({height:null,currentWeight:80,sexForEnergy:'undisclosed'})
 assert.equal(readPreferences((await actions.getUser()).preferences).birthYear,undefined)
 console.log('PASS baseline and four-goal persistence, optional clearing, validation and user isolation')
 const entry={name:'Own lunch',components:'Beans and rice',portion:'One bowl',mealType:'lunch',eatenAt:new Date().toISOString(),nutrition:{calories:500,protein:25,carbs:60,fat:15,fibre:8}}
 await meals.saveOwnMeal(entry);let list=await meals.listOwnMeals();const id=list[0].id
 let daily=await meals.getDailyNutrition();assert.equal(daily.consumed.sum.calories,500);assert.equal(daily.ownMeals.length,1)
 await meals.saveOwnMeal({...entry,id,name:'Edited',nutrition:{...entry.nutrition,calories:600}})
 assert.equal((await meals.getDailyNutrition()).consumed.sum.calories,600)
 identity=users[1];assert.equal((await meals.listOwnMeals()).length,0);await assert.rejects(meals.saveOwnMeal({...entry,id}));await assert.rejects(meals.deleteOwnMeal(id));identity=users[0]
 await meals.saveOwnMeal({...entry,name:'Unknown',nutrition:parseNutrition('{}')});assert.equal((await meals.getDailyNutrition()).consumed.unknown.calories,1)
 for(const meal of await meals.listOwnMeals())await meals.deleteOwnMeal(meal.id)
 assert.equal((await meals.listOwnMeals()).length,0)
 await assert.rejects(meals.saveOwnMeal({...entry,nutrition:{...entry.nutrition,calories:NaN}}))
 console.log('PASS own-meal add/edit/delete, daily totals, incomplete values and cross-user denial')
 // Dedicated recipes with known fibre make the verified replacement path testable;
 // no production recipe metadata is fabricated or changed.
 for(const [title,calories,amount] of [['Fixture original',2500,100],['Fixture replacement',2450,90]]){const recipe=await prisma.recipe.create({data:{title,description:'Test only',prepTime:10,tags:'["dinner","vegan","fiber-source"]',ingredients:JSON.stringify([`${amount} g ris`]),instructions:'[]',nutrition:JSON.stringify({calories,protein:130,carbs:300,fat:60,fibre:30})}});recipes.push(recipe.id)}
 await meals.saveBodyData({height:180,currentWeight:80})
 await actions.updateWeightGoal({primaryGoal:'maintain',currentWeight:80,targetWeight:80,timeframeWeeks:26})
 const week=await actions.getWeeklyPlan(), today=new Date();today.setHours(0,0,0,0)
 const day=week.planDays.find(d=>+d.date===+today), original=encodeMeals([{slot:'Middag',recipeId:recipes[0],title:'Fixture original'}],['Middag'])
 await prisma.planDay.update({where:{id:day.id},data:{meals:original}})
 await meals.saveOwnMeal({...entry,name:'Extra meal',nutrition:{...entry.nutrition,calories:3500}})
 const beforeShopping=await actions.getShoppingList()
 let proposal=await meals.getNutritionProposal('day');assert.equal(proposal.reason,'proposed');assert.equal(proposal.changes.length,1)
 await meals.chooseNutritionProposal('day',proposal.key,false)
 assert.equal((await prisma.planDay.findUnique({where:{id:day.id}})).meals,original);assert.deepEqual(await actions.getShoppingList(),beforeShopping)
 assert.equal((await meals.getNutritionProposal('day')).status,'declined')
 // A genuine change to logged intake requires a newly reviewed proposal.
 list=await meals.listOwnMeals();await meals.saveOwnMeal({...entry,id:list[0].id,nutrition:{...entry.nutrition,calories:3600}})
 proposal=await meals.getNutritionProposal('day');assert.equal(proposal.status,'open')
 identity=users[1];await assert.rejects(meals.chooseNutritionProposal('day',proposal.key,true));identity=users[0]
 await meals.chooseNutritionProposal('day',proposal.key,true)
 assert((await prisma.planDay.findUnique({where:{id:day.id}})).meals.includes(recipes[1]));assert.notDeepEqual(await actions.getShoppingList(),beforeShopping)
 assert.equal((await meals.getDailyNutrition()).planned.sum.calories,2450)
 assert.equal((await meals.getNutritionProposal('day')).reason,'unavailable')
 console.log('PASS reviewed approval, rejected plan unchanged, same-day cap, shopping changes only for real swaps, nutrition propagation and approval ownership')
 const context=await actions.getCoachContext();assert.equal(context.primaryGoal,'maintain');assert.equal(context.nutrition.ownMeals.length,1)
 assert.match(await getCoachReply('I ate pizza instead of dinner',{...context,language:'en'}),/Maintain weight|Stable weight/)
 assert.match(await getCoachReply('I only got 70 g protein',{...context,language:'en'}),/protein target|logged today/)
 assert.match(await getCoachReply('How much insulin should I take?',{...context,language:'en',health:'type1'}),/not diagnosis|insulin dosing|care team/)
 identity=users[1]
 await actions.updateWeightGoal({primaryGoal:'lose',currentWeight:80,targetWeight:75,timeframeWeeks:26})
 assert.equal((await meals.getNutritionProposal('trend')).reason,'insufficient')
 const next=await actions.getWeeklyPlan(true)
 for(const d of next.planDays)await prisma.planDay.update({where:{id:d.id},data:{meals:original}})
 for(const offset of [28,24,21,18,14,7,0]){const date=new Date(today);date.setDate(date.getDate()-offset);await prisma.dailyLog.upsert({where:{userId_date:{userId:identity,date}},create:{userId:identity,date,weight:80},update:{weight:80}})}
 const trendProposal=await meals.getNutritionProposal('trend');assert.equal(trendProposal.reason,'proposed');assert.equal(trendProposal.changes.length,3)
 const shoppingBeforeTrend=await actions.getShoppingList()
 await meals.chooseNutritionProposal('trend',trendProposal.key,true)
 const changed=await actions.getWeeklyPlan(true);assert.equal(changed.planDays.filter(d=>d.meals.includes(recipes[1])).length,3)
 assert.deepEqual(await actions.getShoppingList(),shoppingBeforeTrend)
 console.log('PASS insufficient trend data, conservative weekly proposal, approved next-week propagation and unchanged current shopping')
 identity=null;await assert.rejects(meals.getDailyNutrition());await assert.rejects(meals.saveOwnMeal(entry));await assert.rejects(meals.saveBodyData({height:175,currentWeight:80}))
 console.log('PASS Coach goal, own-meal context, extra food, protein, diabetes safety and authentication')
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.recipe.deleteMany({where:{id:{in:recipes}}});await prisma.$disconnect()})

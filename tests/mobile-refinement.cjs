const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module')
require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}})
const resolve=Module._resolveFilename,load=Module._load
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.resolve('src',request.slice(2)):request,...args)}
let identity=null
Module._load=function(request,...args){if(request==='@/lib/auth')return{getAuthenticatedUserId:async()=>identity};if(request==='next/cache')return{revalidatePath(){}};return load.call(this,request,...args)}
const prisma=require('../src/lib/prisma').default,actions=require('../src/app/actions'),meals=require('../src/app/nutrition-actions')
const {profileReadiness,welcomeGreeting,readinessLabels}=require('../src/lib/profile-readiness'),{onboardingErrors}=require('../src/lib/onboarding-validation')
const {defaultPreferences,readPreferences}=require('../src/lib/preferences'),{nutritionTarget}=require('../src/lib/nutrition'),{getCoachReply}=require('../src/lib/coach-service')
const ids=[],registration={name:'Mobile QA',password:'Only-for-testing-123',email:'placeholder@example.invalid',currentWeight:80,height:180,activityLevel:'light',trainingLevel:'beginner',trainingLocation:'home',preferences:{...defaultPreferences,planningConfirmed:true,primaryGoal:'maintain',language:'en'}}
const source=p=>fs.readFileSync(path.join('src',p),'utf8')
async function main(){
 for(const field of ['name','email','password','currentWeight','height'])assert(onboardingErrors({...registration,[field]:''},1,true)[field],field)
 for(const field of ['activityLevel','trainingLevel','trainingLocation'])assert(onboardingErrors({...registration,[field]:''},3,true)[field],field)
 assert.deepEqual(onboardingErrors(registration,1),{});assert.deepEqual(onboardingErrors(registration,3),{});assert.deepEqual(onboardingErrors(registration,4),{})
 for(const primaryGoal of ['maintain','retain-muscle','build-muscle'])assert.deepEqual(onboardingErrors({...registration,preferences:{...registration.preferences,primaryGoal}},1),{})
 assert(onboardingErrors({...registration,preferences:{...registration.preferences,primaryGoal:'lose'}},1).targetWeight)
 assert.deepEqual(onboardingErrors({...registration,targetWeight:75,timeframeWeeks:26,preferences:{...registration.preferences,primaryGoal:'lose'}},1),{})
 assert(onboardingErrors({...registration,targetWeight:70,timeframeWeeks:26,preferences:{...registration.preferences,primaryGoal:'build-muscle'}},1).targetWeight)
 assert(onboardingErrors({...registration,preferences:{...registration.preferences,planningConfirmed:false}},4).confirmation)
 assert(onboardingErrors({...registration,preferences:{...registration.preferences,trainingDays:9}},4).choices)
 assert.notEqual(onboardingErrors({},1,true).name,onboardingErrors({},1,false).name)
 console.log('PASS required fields at each step, all four goals, optional age/sex, reviewed suggestion validation and bilingual errors')
 const full={...registration,preferences:JSON.stringify(registration.preferences)}
 assert(profileReadiness(full).ready);assert(!profileReadiness({...full,preferences:null}).ready)
 for(const key of ['currentWeight','height','activityLevel','trainingLevel','trainingLocation'])assert(!profileReadiness({...full,[key]:null}).ready)
 assert.equal(nutritionTarget(full).confidence,'lower');assert.equal(nutritionTarget({...full,height:null}),null)
 assert.equal(welcomeGreeting('Test Person',true),'Välkommen till Livskraft, Test!');assert.equal(welcomeGreeting('Test',false,true),'Welcome back, Test!');assert.equal(welcomeGreeting(' ',true,true),'Welcome to Livskraft!')
 assert.equal(readinessLabels.en.height,'Height');assert.equal(readinessLabels.sv.height,'Längd')
 console.log('PASS shared readiness, absent legacy confirmation, lower estimate confidence and first/returning/nameless greetings')
 for(const primaryGoal of ['lose','maintain','retain-muscle','build-muscle']){
  const email=`mobile-refinement-${primaryGoal}-${Date.now()}@example.invalid`
  const result=await actions.submitOnboarding({...registration,email,...(primaryGoal==='lose'?{targetWeight:75,timeframeWeeks:26}:{}),preferences:{...registration.preferences,primaryGoal}})
  assert(result.success,JSON.stringify(result));const u=await prisma.user.findUniqueOrThrow({where:{email}});ids.push(u.id);identity=u.id
  assert.equal(readPreferences(u.preferences).language,'en');assert(profileReadiness(u).ready);assert.equal(nutritionTarget(u).confidence,'lower')
  if(primaryGoal!=='lose'){assert.equal(u.targetWeight,null);assert.equal(u.timeframeWeeks,null)}
  assert.equal((await actions.getHomeOverview()).firstVisit,true);assert.equal((await actions.getHomeOverview()).firstVisit,false)
  assert(await actions.getWeeklyPlan())
 }
 console.log('PASS four-goal account creation, optional baseline fields, inherited language, first visit persistence and complete plans')
 const completeId=identity,baseline=await actions.getUser(),week=await actions.getWeeklyPlan()
 await prisma.user.update({where:{id:identity},data:{height:null,preferences:JSON.stringify({...readPreferences(baseline.preferences),planningConfirmed:false})}})
 assert.equal(await actions.getWeeklyPlan(),null);assert.equal((await meals.getDailyNutrition()).plannedMeals,0);assert.equal((await meals.getDailyNutrition()).target,null)
 assert.equal((await actions.getCoachOverview()).ready,false);assert.equal((await actions.getProgressSummary()).stepGoal,null)
 const context=await actions.getCoachContext();for(const language of ['sv','en']){const reply=await getCoachReply(language==='en'?'What can I eat now?':'Vad kan jag äta nu?',{...context,language});assert.match(reply,/Min plan|My Plan/);assert(!reply.includes('Nästa oavklarade'))}
 assert.equal((await actions.getAdaptiveWeek()).status,'insufficient');await assert.rejects(actions.selectPlanMeals(week.id,['Lunch']))
 assert.deepEqual((await prisma.weeklyPlan.findUnique({where:{id:week.id},include:{planDays:true}})).planDays.map(d=>d.meals).sort(),week.planDays.map(d=>d.meals).sort())
 console.log('PASS incomplete Home/Today/Coach/Progress/adaptive state, guarded mutations and preservation of existing plans')
 await meals.saveBodyData({currentWeight:82,height:180});assert.equal(await actions.getWeeklyPlan(),null)
 await actions.saveMyPlan({dietRestrictions:[],dislikedFoods:[],lifestyle:[],activityLevel:'light',trainingLevel:'beginner',trainingLocation:'home',preferences:{...registration.preferences,planningConfirmed:true}})
 assert(profileReadiness(await actions.getUser()).ready)
 await actions.updateWeightGoal({primaryGoal:'maintain',currentWeight:999,targetWeight:60,timeframeWeeks:2})
 assert.equal((await actions.getUser()).currentWeight,82);assert.equal((await actions.getUser()).targetWeight,null)
 assert.equal((await actions.getProgressSummary()).latestWeight,82);assert.equal((await actions.getCoachContext()).goal.currentWeight,82)
 identity=ids[0];assert.notEqual((await actions.getUser()).currentWeight,82);assert.equal((await actions.getHomeOverview()).user.id,ids[0]);assert.equal((await prisma.user.findUnique({where:{id:completeId}})).currentWeight,82)
 identity=null;assert.equal(await actions.getHomeOverview(),null);assert.equal((await actions.updateWeightGoal({primaryGoal:'maintain'})).success,false)
 console.log('PASS legacy completion, current-weight single source and propagation, authenticated account isolation')
 const onboarding=source('app/onboarding/page.tsx'),provider=source('lib/i18n/provider.tsx'),photo=source('components/daily-nutrition.tsx')
 assert(!onboarding.includes('LanguageSelector'));assert(provider.includes('localStorage.getItem("livskraft-language")'));assert(onboarding.includes('preferences:{...data.preferences,language}'))
 assert(onboarding.includes('setErrors({});setData({...data,targetWeight'));assert(onboarding.includes('validate(step)'));assert(onboarding.includes('step===3'));assert(onboarding.includes('maintaining&&'));assert(onboarding.includes('Muscle-building weight target'))
 assert(onboarding.includes('"/home"'));assert(source('app/login/page.tsx').includes('"/home"'))
 assert(!source('components/goal-editor.tsx').includes('setCurrentWeight'));assert(source('components/goal-editor.tsx').includes('href="#body"'))
 assert(photo.includes('Ta foto eller välj bild'));assert(photo.includes('Take a photo or choose an image'));assert(photo.includes('capture="environment"'));assert(photo.includes('URL.createObjectURL'));assert(photo.includes('URL.revokeObjectURL'));assert(photo.includes('className="sr-only" type="file"'));assert(photo.includes('Remove image'));assert(photo.includes('Previous meals'));assert(!photo.includes('requires a configured provider'))
 assert(photo.includes('<details><summary>'));assert(source('app/(app)/home/page.tsx').includes('ProfileReadinessCard'));assert(source('app/(app)/dashboard/page.tsx').includes('!profileReadiness(user).ready'))
 assert(!source('app/(app)/layout.tsx').includes('<header'));assert(source('lib/photo-meal-provider.ts').includes('import "server-only"'));assert(photo.includes('Analysera bild med AI'));assert(photo.includes('Add to today'))
 console.log('PASS language inheritance, route/field rendering contracts, single weight editor, mobile navigation and camera/photo disclosure and confirmation contracts')
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await prisma.user.deleteMany({where:{id:{in:ids}}});await prisma.$disconnect()})

// Run only against a fresh scratch database, never the app's existing database.
const assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path')
assert.equal(process.env.LIVSKRAFT_BETA_FINAL_DB,'1')
assert.match(process.env.DATABASE_URL??'',/^file:\.\/beta-final-test-[a-f0-9-]+\.db$/)
require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}})
const resolve=Module._resolveFilename,load=Module._load
let identity=null
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.resolve('src',request.slice(2)):request,...args)}
Module._load=function(request,...args){if(request==='@/lib/auth')return {getAuthenticatedUserId:async()=>identity};if(request==='next/cache')return {revalidatePath(){}};return load.call(this,request,...args)}
const prisma=require('../src/lib/prisma').default,actions=require('../src/app/actions')
const {defaultPreferences,readPreferences}=require('../src/lib/preferences')
async function main(){
 const users=[]
 for(const [label,equipment] of [['A','hantlar, bänk'],['B','gummiband, kettlebell']]){
   const email=`beta-final-${label.toLowerCase()}@example.invalid`
   const result=await actions.submitOnboarding({name:`Equipment ${label}`,email,password:'Disposable-Only-1234',currentWeight:80,height:175,
     activityLevel:'light',trainingLevel:'beginner',trainingLocation:'home',preferences:{...defaultPreferences,primaryGoal:'maintain',planningConfirmed:true,equipment}})
   assert.equal(result.success,true)
   const user=await prisma.user.findUniqueOrThrow({where:{email}});users.push(user)
   assert.equal(readPreferences(user.preferences).equipment,equipment,'Actual onboarding DB write preserves selected equipment')
   identity=user.id
   assert.equal(readPreferences((await actions.getUser()).preferences).equipment,equipment,'Public profile hydration preserves equipment')
   await actions.savePreferences({cookingMinutes:45})
   assert.equal(readPreferences((await actions.getUser()).preferences).equipment,equipment,'Unrelated preference save preserves equipment')
 }
 const today=new Date();today.setHours(0,0,0,0)
 const yesterday=new Date(today);yesterday.setDate(yesterday.getDate()-1)
 const older=new Date(today);older.setDate(older.getDate()-7)
 const makeWorkout=title=>prisma.workout.create({data:{title,type:'home',level:'beginner',duration:20,exercises:'[{"name":"Squat","sets":3,"reps":"8"}]'}})
 const a=await makeWorkout('A Logged Workout'),b=await makeWorkout('B Private Workout')
 await prisma.workoutLog.createMany({data:[
   {userId:users[0].id,workoutId:a.id,date:yesterday,completed:true,notes:'PRIVATE_NOTES'},
   {userId:users[1].id,workoutId:b.id,date:yesterday,completed:true},
   {userId:users[0].id,workoutId:b.id,date:today,completed:false},
   {userId:users[0].id,workoutId:b.id,date:older,completed:true},
 ]})
 for(const [user,steps] of [[users[0],3210],[users[1],8765]])await prisma.dailyLog.create({data:{userId:user.id,date:yesterday,steps,stepsRecorded:true}})
 for(const [user,title,steps] of [[users[0],a.title,3210],[users[1],b.title,8765]]){
   identity=user.id
   const ctx=await actions.getCoachContext()
   assert.equal(ctx.recentActivity.workouts.length,1);assert.equal(ctx.recentActivity.workouts[0].title,title)
   assert.equal(ctx.recentActivity.steps.find(row=>row.steps!==null).steps,steps)
   assert(!JSON.stringify(ctx.recentActivity).includes('PRIVATE_NOTES'))
   assert(!JSON.stringify(ctx.recentActivity).includes(user.id))
   assert(!JSON.stringify(ctx.recentActivity).includes(user.email))
 }
 console.log('PASS real SQLite onboarding/equipment storage, public hydration, later preference save, user-scoped seven-day Coach activity and minimal projection')
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>prisma.$disconnect())

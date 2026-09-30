// Fresh disposable SQLite only: real onboarding and authenticated preference persistence.
const assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path')
assert.equal(process.env.LIVSKRAFT_COACH_SETTINGS_DB,'1')
assert.match(process.env.DATABASE_URL??'',/^file:\.\/coach-settings-test-[a-f0-9-]+\.db$/)
require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}})
const resolve=Module._resolveFilename,load=Module._load
let identity=null
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.resolve('src',request.slice(2)):request,...args)}
Module._load=function(request,...args){
 if(request==='server-only')return {}
 if(request==='@/lib/auth')return {getAuthenticatedUserId:async()=>identity,getAuthSession:async()=>identity?{user:{id:identity}}:null}
 if(request==='next/cache')return {revalidatePath(){}}
 return load.call(this,request,...args)
}
const prisma=require('../src/lib/prisma').default,{submitOnboarding}=require('../src/app/actions')
const {defaultPreferences,readPreferences}=require('../src/lib/preferences')
const {readAICoachPreference}=require('../src/lib/coach-preference')
const route=require('../src/app/api/coach/preference/route')
const coachRoute=require('../src/app/api/coach/route'),{NextRequest}=require('next/server')
async function main(){
 const users=[]
 for(const [index,enabled] of [true,false,undefined].entries()){
  const email=`coach-settings-${index}@example.invalid`
  const result=await submitOnboarding({name:'Settings fixture',email,password:'Disposable-Only-1234',currentWeight:80,height:175,activityLevel:'light',trainingLevel:'beginner',trainingLocation:'home',preferences:{...defaultPreferences,primaryGoal:'maintain',planningConfirmed:true,...(enabled===undefined?{}:{aiCoachEnabled:enabled})}})
  assert.equal(result.success,true)
  const user=await prisma.user.findUniqueOrThrow({where:{email},select:{id:true,preferences:true}});users.push(user)
  assert.equal(readPreferences(user.preferences).aiCoachEnabled,enabled,'Onboarding preserves the explicit AI Coach choice')
  assert.equal(await readAICoachPreference(user.id),enabled??null)
 }
 process.env.NEXTAUTH_URL='https://livskraft.example';identity=users[1].id
 for(const enabled of [true,false]){
  const request=new Request('https://livskraft.example/api/coach/preference',{method:'PATCH',headers:{origin:'https://livskraft.example','content-type':'application/json'},body:JSON.stringify({aiCoachEnabled:enabled,userId:users[0].id})})
  assert.equal((await route.PATCH(request)).status,200)
  assert.equal((await (await route.GET()).json()).aiCoachEnabled,enabled,'Reload returns the actual saved Account state')
  assert.equal(await readAICoachPreference(users[0].id),true,'Existing enabled user is untouched by another account toggle')
  assert.equal(await readAICoachPreference(users[2].id),null,'Existing missing preference stays unset/disabled')
 }
 for(const user of [users[1],users[2]]){
  identity=user.id
  const before=await prisma.coachExchange.count({where:{userId:identity}})
  const response=await coachRoute.POST(new NextRequest('https://livskraft.example/api/coach',{method:'POST',body:JSON.stringify({message:'vad ska jag träna idag?',aiCoachEnabled:true,externalAIConsent:true,userId:users[0].id})}))
  assert.equal(response.status,403);assert.deepEqual(await response.json(),{error:'ai_coach_disabled'})
  assert.equal(await prisma.coachExchange.count({where:{userId:identity}}),before,'Disabled/missing request creates no real persisted exchange')
 }
 identity=null;assert.equal((await route.GET()).status,401)
 console.log('PASS real SQLite onboarding/Account persistence, existing preferences/isolation, disabled/missing POST rejection and no persisted history')
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>prisma.$disconnect())

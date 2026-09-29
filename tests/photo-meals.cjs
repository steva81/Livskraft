// Run on a disposable database: LIVSKRAFT_INTAKE_TEST_DB=1 DATABASE_URL=file:... .
const assert=require('node:assert/strict'),path=require('node:path'),Module=require('node:module'),fs=require('node:fs')
assert.equal(process.env.LIVSKRAFT_INTAKE_TEST_DB,'1','Isolated database required')
require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}})
const resolve=Module._resolveFilename,load=Module._load
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.resolve('src',request.slice(2)):request,...args)}
let identity=null
Module._load=function(request,...args){if(request==='server-only')return {};if(request==='@/lib/auth')return {getAuthenticatedUserId:async()=>identity};if(request==='next/cache')return {revalidatePath(){}};return load.call(this,request,...args)}
const prisma=require('../src/lib/prisma').default
const {parsePhotoEstimate,validatePhotoBytes,MAX_PHOTO_BYTES}=require('../src/lib/photo-meals')
const {photoMealProvider}=require('../src/lib/photo-meal-provider')
const {photoTask}=require('../src/lib/photo-meal-client')
const {savePhotoMeal,getWeeklyNutrition}=require('../src/app/nutrition-actions')
const {dailyNutritionForUser}=require('../src/lib/daily-nutrition')
const {getCoachContext}=require('../src/app/actions')
const route=require('../src/app/api/photo-meal/route')
const users=[],nativeFetch=global.fetch
const jpeg=Buffer.from([255,216,255,224,0,0])
const estimate={items:[{name:'Rice',estimatedGrams:150,calories:200,protein:5,carbs:40,fat:2,fibre:1}],total:{calories:99999},confidence:'low',note:'Oil is uncertain.'}
const envelope=value=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]})
const request=(body=jpeg,type='image/jpeg',origin='http://localhost:3000')=>new Request('http://localhost:3000/api/photo-meal',{method:'POST',headers:{origin,'content-type':type,'x-photo-language':'en'},body})
async function main(){
 const parsed=parsePhotoEstimate(estimate)
 assert.equal(parsed.total.calories,200);assert.equal(parsed.total.fibre,1)
 for(const value of [null,[],{}, {...estimate,items:[]},{...estimate,items:Array(21).fill(estimate.items[0])},{...estimate,confidence:'sure'},{...estimate,note:'x'.repeat(601)}])assert.throws(()=>parsePhotoEstimate(value))
 for(const value of [-1,NaN,Infinity,'200',null,10001]){assert.throws(()=>parsePhotoEstimate({...estimate,items:[{...estimate.items[0],calories:value}]}));assert.throws(()=>parsePhotoEstimate({...estimate,items:[{...estimate.items[0],fibre:value}]}))}
 assert.equal(parsePhotoEstimate({...estimate,items:[{...estimate.items[0],estimatedGrams:null,extra:'ignored'}]}).items[0].estimatedGrams,null)
 assert.throws(()=>validatePhotoBytes(Buffer.from('not a photo'),'image/jpeg'))
 assert.throws(()=>validatePhotoBytes(jpeg,'image/svg+xml'))
 assert.throws(()=>validatePhotoBytes(Buffer.alloc(MAX_PHOTO_BYTES+1),'image/jpeg'))
 delete process.env.PHOTO_AI_API_KEY;delete process.env.PHOTO_AI_MODEL
 assert.equal(photoMealProvider().available,false);await assert.rejects(photoMealProvider().analyze(jpeg,'image/jpeg','sv'),/unavailable/)
 assert.equal((await route.GET()).status,401);assert.equal((await route.POST(request())).status,401)
 console.log('PASS strict parsing, recomputed totals, malformed/unknown results, file validation, disabled provider, auth')
 for(const label of ['A','B'])users.push(await prisma.user.create({data:{name:`Private ${label}`,email:`photo-${label}-${Date.now()}@example.invalid`,preferences:'{"health":"type1"}'}}))
 identity=users[0].id
 assert.equal((await route.POST(request())).status,503)
 process.env.PHOTO_AI_API_KEY='test-placeholder';process.env.PHOTO_AI_MODEL='gemini-test-model'
 let sent
 global.fetch=async(url,options)=>{sent={url,options};return Response.json(envelope(estimate))}
 const before=await prisma.ownMeal.count()
 assert.equal((await route.POST(request(jpeg,'image/jpeg','https://elsewhere.invalid'))).status,403)
 const response=await route.POST(request());assert.equal(response.status,200);assert.equal((await response.json()).estimate.total.calories,200)
 assert.equal(await prisma.ownMeal.count(),before,'Analysis must never persist')
 const body=JSON.parse(sent.options.body)
 assert.deepEqual(Object.keys(body).sort(),['contents','generationConfig'])
 assert.equal(body.contents.length,1);assert.equal(body.contents[0].parts.length,2)
 assert.deepEqual(body.contents[0].parts[1],{inline_data:{mime_type:'image/jpeg',data:jpeg.toString('base64')}})
 for(const value of [users[0].id,users[0].email,users[0].name,'type1','weightHistory','coachHistory'])assert(!sent.options.body.includes(value))
 assert(!sent.url.includes('test-placeholder'));assert.equal(sent.options.headers['x-goog-api-key'],'test-placeholder')
 global.fetch=async()=>Response.json(envelope({...estimate,items:[]}))
 assert.equal((await(await route.POST(request())).json()).error,'invalid_response')
 global.fetch=async()=>Response.json({error:'secret provider message'},{status:429})
 assert.equal((await(await route.POST(request())).json()).error,'provider_failure')
 global.fetch=async()=>{throw new Error('network detail')}
 assert.equal((await(await route.POST(request())).json()).error,'provider_failure')
 global.fetch=async()=>Response.json(envelope(estimate))
 assert.equal((await route.POST(request())).status,200,'Retry recovers')
 assert.equal((await route.POST(request(Buffer.alloc(MAX_PHOTO_BYTES+1)))).status,413)
 console.log('PASS transient analysis, minimal external payload, no personal context, sanitized failures, retry and size bound')
 const today=new Date();today.setHours(0,0,0,0)
 const intake=JSON.stringify([{kind:'consumed-meal',key:'Lunch:fixture',title:'Plan meal',nutrition:{calories:500,protein:30,carbs:50,fat:20,fibre:4}}])
 await prisma.dailyLog.create({data:{userId:identity,date:today,mealsEaten:intake}})
 const plan=await prisma.weeklyPlan.create({data:{userId:identity,startDate:today,endDate:today,planDays:{create:{date:today,dayOfWeek:today.getDay(),meals:'[]'}}},include:{planDays:true}})
 const input={token:require('node:crypto').randomUUID(),name:'Reviewed meal',components:'Rice ~150 g',portion:'1 plate',mealType:'lunch',nutrition:{...parsed.total,calories:250}}
 await Promise.all([savePhotoMeal(input),savePhotoMeal(input)])
 await savePhotoMeal(input)
 const saved=await prisma.ownMeal.findMany({where:{userId:identity}})
 assert.equal(saved.length,1);assert.equal(saved[0].name,input.name);assert.equal(saved[0].portion,'1 plate')
 assert(+saved[0].eatenAt>=+today&&+saved[0].eatenAt<=Date.now())
 assert.deepEqual(Object.keys(saved[0]).sort(),['id','userId','name','components','portion','mealType','eatenAt','nutrition','createdAt','updatedAt'].sort())
 assert(!JSON.stringify(saved).includes(jpeg.toString('base64')))
 const daily=await dailyNutritionForUser(identity)
 assert.deepEqual(daily.consumed.sum,{calories:750,protein:35,carbs:90,fat:22,fibre:5})
 assert.equal((await prisma.dailyLog.findUnique({where:{userId_date:{userId:identity,date:today}}})).mealsEaten,intake)
 assert.deepEqual(await prisma.weeklyPlan.findUnique({where:{id:plan.id},include:{planDays:true}}),plan)
 assert.deepEqual((await getCoachContext()).nutrition.consumed,daily.consumed)
 assert((await getWeeklyNutrition()).days.some(d=>d.consumed.sum.calories===750))
 assert.equal((await dailyNutritionForUser(users[1].id)).consumed.count,0)
 identity=users[1].id;await savePhotoMeal(input)
 assert.equal(await prisma.ownMeal.count({where:{userId:identity}}),1,'Tokens are scoped to user')
 assert.equal((await dailyNutritionForUser(users[0].id)).consumed.sum.calories,750)
 await assert.rejects(savePhotoMeal({...input,nutrition:{...input.nutrition,calories:-1}}))
 identity=null;await assert.rejects(savePhotoMeal(input))
 console.log('PASS reviewed persistence, concurrent/repeated save, today macros, unchanged plan/intake, Progress/Coach, ownership, no stored image')
 await assert.rejects(photoTask(new Promise(()=>{}),5),/timeout/)
 assert.equal(await photoTask(Promise.resolve('retry'),5),'retry')
 const ui=fs.readFileSync('src/components/daily-nutrition.tsx','utf8')
 for(const label of ['Analysera bild med AI','Analyze image with AI','Lägg till i idag','Add to today','AI-uppskattning','AI estimate','Låg – kontrollera extra noga','Low – check carefully'])assert(ui.includes(label))
 assert(ui.includes('finally{locked.current=false;setBusy(false)}'))
 console.log('PASS timeout recovery and Swedish/English review contracts')
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{global.fetch=nativeFetch;await prisma.user.deleteMany({where:{id:{in:users.map(u=>u.id)}}});await prisma.$disconnect()})

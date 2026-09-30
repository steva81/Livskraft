const assert = require('node:assert/strict')
const Module = require('node:module'), path = require('node:path'), fs = require('node:fs')
require('ts-node').register({ transpileOnly:true, compilerOptions:{module:'CommonJS',moduleResolution:'node'} })
const resolve = Module._resolveFilename, load = Module._load
let identity = 'A', sent = [], saved = [], reads = []
const accounts={A:{preferences:JSON.stringify({language:'en',budget:'low'})},B:{preferences:null}}
const preferenceWrites=[]
const db={
  user:{
    findUnique:async({where,select})=>{assert.deepEqual(select,{preferences:true});return accounts[where.id]??null},
    findUniqueOrThrow:async({where,select})=>{assert.deepEqual(select,{preferences:true});assert(accounts[where.id]);return accounts[where.id]},
    update:async({where,data})=>{assert(accounts[where.id]);preferenceWrites.push(where.id);accounts[where.id]={...accounts[where.id],...data};return accounts[where.id]},
  },
  coachExchange:{deleteMany:async()=>({count:0})},
  $transaction:async callback=>callback(db),
}
const context = name => ({ userName:name, language:'en', restrictions:[], dislikedFoods:[], stepGoal:7000,
  todayMeals:['UNRELATED_MEAL'], todayWorkout:null, completedWorkoutsThisWeek:0, health:'type1',
  budget:'PRIVATE_BUDGET', workSchedule:'PRIVATE_SCHEDULE', email:'PRIVATE_EMAIL', password:'PRIVATE_PASSWORD',
  readiness:{ready:true,missing:[]} })
const histories = {
  A:[{role:'user',text:'A_PRIVATE_CHAT'},{role:'coach',text:'A_REPLY'}],
  B:[{role:'user',text:'B_PRIVATE_CHAT'},{role:'coach',text:'B_REPLY'}],
}
Module._resolveFilename = function(request,...args) { return resolve.call(this,request.startsWith('@/')?path.resolve('src',request.slice(2)):request,...args) }
Module._load = function(request,...args) {
  if(request==='server-only') return {}
  if(request==='@/lib/auth') return {getAuthSession:async()=>identity?{user:{id:identity},loginAt:1000}:null}
  if(request==='@/app/actions') return {getCoachContext:async()=>identity?context(`PRIVATE_NAME_${identity}`):null}
  if(request==='@/lib/coach-history') return {
    readCoachHistory:async(id,since)=>{reads.push({id,since});return histories[id]},
    saveCoachExchange:async(id,question,reply)=>saved.push({id,question,reply}),
  }
  if(request==='@/lib/prisma'||request==='./prisma'&&args[0]?.filename.endsWith('coach-preference.ts')) return {__esModule:true,default:db}
  return load.call(this,request,...args)
}
const route = require('../src/app/api/coach/route')
const preferenceRoute=require('../src/app/api/coach/preference/route')
const {readPreferences}=require('../src/lib/preferences')
const {getCoachReply} = require('../src/lib/coach-service')
const {generateCoachReply} = require('../src/lib/coach-provider')
const {NextRequest} = require('next/server')
const key = 'TEST_SERVER_ONLY_KEY'
const request = (consent=true,message='Help me manage a busy day') => new NextRequest('https://livskraft.example/api/coach',{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message,externalAIConsent:consent}),
})
const preferenceRequest=(enabled,origin='https://livskraft.example')=>new Request('https://livskraft.example/api/coach/preference',{
  method:'PATCH',headers:{origin,'content-type':'application/json'},body:JSON.stringify({aiCoachEnabled:enabled,userId:'B'}),
})
const envelope = (reply='Take one manageable step today. You are in control.',finishReason='STOP') => ({candidates:[{finishReason,content:{parts:[{thought:true,text:'NOT_FOR_USER'},{text:JSON.stringify({reply})}]}}]})
const mock = response => { global.fetch = async(url,options)=>{sent.push({url,options});return typeof response==='function'?response(options):Response.json(response)} }
async function main() {
  process.env.AI_COACH_LIVE_ENABLED='true';process.env.AI_API_KEY=key
  process.env.AI_API_URL='https://generativelanguage.googleapis.com/v1beta';process.env.AI_API_MODEL='gemini-test-model'
  process.env.NEXTAUTH_URL='https://livskraft.example'
  mock(envelope())
  identity=null
  assert.equal((await route.POST(request())).status,401)
  assert.equal((await route.GET(new NextRequest('https://livskraft.example/api/coach'))).status,401)
  assert.equal((await route.DELETE()).status,401)
  assert.equal((await preferenceRoute.GET()).status,401)
  assert.equal((await preferenceRoute.PATCH(preferenceRequest(true))).status,401)
  assert.equal(preferenceWrites.length,0)
  assert.equal(sent.length,0);assert.equal(reads.length,0)
  identity='A'
  assert.equal((await (await preferenceRoute.GET()).json()).aiCoachEnabled,null,'Existing user is undecided')
  assert.equal((await (await route.GET(new NextRequest('https://livskraft.example/api/coach'))).json()).aiCoachEnabled,null)
  for(const raw of [null,'{}','{"aiCoachEnabled":"true"}','not JSON']) assert.equal(readPreferences(raw).aiCoachEnabled,undefined)
  assert.equal((await route.POST(request(true,''))).status,400)
  for(const consent of [true,false,undefined,'true']) {
    const req=consent===undefined?new NextRequest('https://livskraft.example/api/coach',{method:'POST',body:JSON.stringify({message:'Hello'})}):request(consent)
    assert.equal((await route.POST(req)).status,200)
  }
  assert.equal(sent.length,0,'Client consent flags cannot enable an undecided account')
  assert.equal((await preferenceRoute.PATCH(preferenceRequest('true'))).status,400)
  assert.equal((await preferenceRoute.PATCH(preferenceRequest(true,'https://evil.example'))).status,403)
  assert.equal(preferenceWrites.length,0)
  // "Not now" persists local Coach; a later settings activation persists on the account.
  assert.equal((await preferenceRoute.PATCH(preferenceRequest(false))).status,200)
  assert.equal((await (await preferenceRoute.GET()).json()).aiCoachEnabled,false)
  await route.POST(request(true));assert.equal(sent.length,0,'Disabled preference overrides forged client consent')
  assert.equal((await preferenceRoute.PATCH(preferenceRequest(true))).status,200)
  assert.equal((await (await preferenceRoute.GET()).json()).aiCoachEnabled,true)
  const stored=JSON.parse(accounts.A.preferences)
  assert.equal(stored.language,'en');assert.equal(stored.budget,'low')
  assert.equal((await (await route.GET(new NextRequest('https://livskraft.example/api/coach'))).json()).aiCoachEnabled,true,'Reload sees saved activation')
  identity='B'
  assert.equal((await (await preferenceRoute.GET()).json()).aiCoachEnabled,null,'A activation cannot affect B')
  await route.POST(request(true));assert.equal(sent.length,0)
  assert.equal((await preferenceRoute.PATCH(preferenceRequest(true))).status,200)
  saved=[];reads=[]
  for(const id of ['A','B']) {
    identity=id
    const res=await route.POST(request(false))
    assert.equal(res.status,200)
    const data=await res.json()
    assert.equal(data.reply,'Take one manageable step today. You are in control.')
    assert.equal(data.saved,true);assert(!JSON.stringify(data).includes(key))
    const {url,options}=sent.at(-1),body=JSON.parse(options.body), payload=JSON.parse(body.contents[0].parts[0].text)
    assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent')
    assert.equal(options.headers['x-goog-api-key'],key);assert(!url.includes(key));assert.equal(options.redirect,'error')
    assert.deepEqual(Object.keys(payload).sort(),['checkedAdvice','history','language','message'])
    assert.deepEqual(payload.history,histories[id]);assert(!options.body.includes(`${id==='A'?'B':'A'}_PRIVATE_CHAT`))
    for(const value of [key,`PRIVATE_NAME_${id}`,'PRIVATE_EMAIL','PRIVATE_PASSWORD','PRIVATE_BUDGET','PRIVATE_SCHEDULE','UNRELATED_MEAL','type1']) assert(!options.body.includes(value),value)
    assert(body.systemInstruction.parts[0].text.includes('Life Happens'))
  }
  assert.deepEqual(saved.map(row=>row.id),['A','B']);assert.deepEqual(reads.map(row=>row.id),['A','B'])
  assert(reads.every(row=>+row.since===1000),'Only current-login history read')
  identity='A'
  const enabledCalls=sent.length
  await preferenceRoute.PATCH(preferenceRequest(false))
  await route.POST(request(true));assert.equal(sent.length,enabledCalls,'Settings off keeps A local')
  identity='B'
  assert.equal((await (await preferenceRoute.GET()).json()).aiCoachEnabled,true,'Settings off does not affect B')
  await route.POST(request(false));assert.equal(sent.length,enabledCalls+1,'B still automatically reaches Gemini')
  identity='A'
  await preferenceRoute.PATCH(preferenceRequest(true))
  await route.POST(new NextRequest('https://livskraft.example/api/coach',{method:'POST',body:JSON.stringify({message:'Help me today'})}))
  assert.equal(sent.length,enabledCalls+2,'Settings on enables Gemini without a client flag')
  const activity={today:'2026-09-30',weekStartsOn:'2026-09-28',from:'2026-09-24',workouts:[{date:'2026-09-29',title:'A Chest',type:'gym',exercises:['Bench press']}],steps:[{date:'2026-09-29',steps:null}],workoutsTruncated:false,todayPlan:{status:'rest'}}
  let continuity=[]
  for(const message of ['vad ska jag träna idag','jag körde bröst igår','och imorgon då?','vad tycker du istället?','jag hann inte göra det','kan jag köra ben istället?']) {
    const calls=sent.length
    await getCoachReply(message,{...context('PRIVATE_NAME'),recentActivity:activity},continuity,true)
    assert.equal(sent.length,calls+1)
    const body=JSON.parse(sent.at(-1).options.body),payload=JSON.parse(body.contents[0].parts[0].text)
    assert.deepEqual(payload.history,continuity)
    assert.deepEqual(payload.recentActivity,activity)
    assert(body.systemInstruction.parts[0].text.includes('Never claim a chat statement was logged'))
    continuity=[...continuity,{role:'user',text:message},{role:'coach',text:'Take one manageable step today. You are in control.'}]
  }
  await getCoachReply('Vad tränade jag igår?',{...context('PRIVATE_NAME'),recentActivity:activity},[],true)
  const activityPayload=JSON.parse(JSON.parse(sent.at(-1).options.body).contents[0].parts[0].text)
  assert(activityPayload.checkedAdvice.includes('A Chest'))
  assert.equal(await getCoachReply('Vad tränade jag igår?',{...context('PRIVATE_NAME'),language:'sv',recentActivity:activity}), 'Registrerade avklarade pass:\n2026-09-29: A Chest (Bench press)')
  const longHistory=Array.from({length:30},(_,i)=>({role:'user',text:`history-${i} `+'x'.repeat(1100)}))
  await getCoachReply('Help me today',context('PRIVATE_NAME'),longHistory,true)
  const bounded=JSON.parse(JSON.parse(sent.at(-1).options.body).contents[0].parts[0].text).history
  assert.equal(bounded.length,12);assert(bounded.every(m=>m.text.length===1000));assert(bounded[0].text.startsWith('history-18 '))
  const local = await getCoachReply('Help me today',context('PRIVATE_NAME'))
  for(const failure of [
    ()=>Response.json({error:key},{status:429}),
    ()=>{throw new Error(key)},
    ()=>{throw new DOMException('Timed out','TimeoutError')},
    ()=>Response.json({}),()=>Response.json(envelope('', 'MAX_TOKENS')),
    ()=>Response.json(envelope({unexpected:'object'})),()=>Response.json(envelope('x'.repeat(2001))),
    ()=>Response.json(envelope('Take 8 units of insulin.')),
    ()=>Response.json(envelope('Skip a meal to earn your food.')),
    ()=>Response.json(envelope('You are lazy.')),
    ()=>Response.json(envelope(`secret ${key}`)),
    ()=>new Response('not JSON'),()=>new Response('x'.repeat(65537)),
  ]) {
    mock(failure)
    assert.equal(await getCoachReply('Help me today',context('PRIVATE_NAME'),[],true),local)
  }
  mock(()=>{throw new Error(key)})
  identity='A'
  const failedProvider=await route.POST(request())
  assert.equal(failedProvider.status,200)
  const failedData=await failedProvider.json()
  assert.equal(failedData.saved,true)
  assert.equal(failedData.reply,await getCoachReply('Help me manage a busy day',context('PRIVATE_NAME_A'),histories.A))
  assert(!JSON.stringify(failedData).includes(key))
  // Exercise the actual AbortSignal boundary without waiting 25 seconds.
  const timeout = AbortSignal.timeout
  try {
    let duration
    AbortSignal.timeout = milliseconds=>{duration=milliseconds;return AbortSignal.abort(new DOMException('Timed out','TimeoutError'))}
    mock(options=>{options.signal.throwIfAborted()})
    assert.equal(await getCoachReply('Help me today',context('PRIVATE_NAME'),[],true),local)
    assert.equal(duration,25000)
  } finally {AbortSignal.timeout=timeout}
  mock(envelope())
  for (const message of [
    'Hur håller jag motivationen när vikten står still?',
    'How can I stay consistent with my weight goal?',
    'I weigh 80 kg and want to lose weight gradually.',
    'How can I gain strength and make progress?',
    'Hur kan jag gå ner i vikt i lugn takt?',
    'What do calories and kcal mean for regular meals?',
    'I logged 2000 calories today. How do I stay motivated?',
    'How can I handle a weight plateau?',
    'I ate too much. How do I return to my usual routine?',
    'How does resistance training help me burn energy?',
    'Can I treat myself to dinner with friends?',
    'How can I include fast food while working on my weight goal?',
  ]) {
    const calls=sent.length
    assert.equal(await getCoachReply(message,context('PRIVATE_NAME'),[],true),'Take one manageable step today. You are in control.')
    assert.equal(sent.length,calls+1,`Normal wellness question must reach Gemini: ${message}`)
  }
  const historyCalls=sent.length
  await getCoachReply('How can I stay consistent?',context('PRIVATE_NAME'),[{role:'user',text:'My weight goal is to lose a few kilos gradually.'}],true)
  assert.equal(sent.length,historyCalls+1,'Ordinary goal wording in history must not block Gemini')
  const before=sent.length
  for(const message of ['How much insulin should I take?','Diagnose my symptoms','Fast to compensate for dinner','Earn my food',
    'Lose weight as quickly as possible','Eat 400 kcal a day','Give me an extreme calorie restriction diet',
    'Skip a meal to punish myself','Burn off my food with exercise','Starve myself to reach my goal',
    'Vilken medicindos ska jag ta?','Hur behandlar jag diabetes?','Träna extra för maten jag åt',
    'Should I fast?','How can I treat my diabetes?',
  ]) {
    assert.equal(await getCoachReply(message,context('PRIVATE_NAME'),[],true),await getCoachReply(message,context('PRIVATE_NAME')))
  }
  const sensitiveHistory=[{role:'user',text:'How much insulin?'},{role:'coach',text:'Follow your care team guidance.'}]
  assert.equal(await getCoachReply('Why?',context('PRIVATE_NAME'),sensitiveHistory,true),await getCoachReply('Why?',context('PRIVATE_NAME'),sensitiveHistory))
  assert.equal(sent.length,before,'Direct sensitive follow-up stays local')
  for(const message of ['och imorgon då?','vad tycker du istället?','jag hann inte göra det','kan jag köra ben istället?']) {
    assert.equal(await getCoachReply(message,context('PRIVATE_NAME'),sensitiveHistory,true),await getCoachReply(message,context('PRIVATE_NAME'),sensitiveHistory))
  }
  assert.equal(sent.length,before,'New follow-up phrases preserve sensitive routing')
  await getCoachReply('Hello',{...context('PRIVATE_NAME'),readiness:{ready:false,missing:['age']}},[],true)
  await getCoachReply('Hello',{...context('PRIVATE_NAME'),goal:{currentWeight:80,targetWeight:60,timeframeWeeks:4}},[],true)
  assert.equal(sent.length,before,'Safety-critical inputs stay local')
  assert.equal(await getCoachReply('Help me stay motivated with regular meals.',context('PRIVATE_NAME'),sensitiveHistory,true),'Take one manageable step today. You are in control.')
  assert.equal(sent.length,before+1,'Unrelated wellness question after sensitive history reaches Gemini')
  const laterHistory=[...sensitiveHistory,{role:'user',text:'Help me stay motivated with regular meals.'}]
  assert.equal(await getCoachReply('Tell me more',context('PRIVATE_NAME'),laterHistory,true),'Take one manageable step today. You are in control.')
  assert.equal(sent.length,before+2,'Follow-up uses only the immediately previous user message')
  const afterSafety=sent.length
  process.env.AI_COACH_LIVE_ENABLED='false'
  assert.equal(await getCoachReply('Help me today',context('PRIVATE_NAME'),[],true),local)
  assert.equal(sent.length,afterSafety)
  process.env.AI_COACH_LIVE_ENABLED='true'
  for(const url of ['https://evil.example/v1beta','http://generativelanguage.googleapis.com/v1beta','https://generativelanguage.googleapis.com/v1beta?key=anything']) {
    process.env.AI_API_URL=url
    assert.equal(await generateCoachReply('Hello','en',[],'Checked advice'),null)
  }
  assert.equal(sent.length,afterSafety)
  process.env.AI_API_URL='https://generativelanguage.googleapis.com/v1beta'
  delete process.env.AI_API_KEY
  assert.equal(await getCoachReply('Help me today',context('PRIVATE_NAME'),[],true),local)
  assert.equal(sent.length,afterSafety)
  const ui=fs.readFileSync('src/app/(app)/coach/page.tsx','utf8')
  assert(ui.includes('Aktivera AI Coach'));assert(ui.includes('Inte nu'))
  assert(ui.includes('JSON.stringify({ message: text })'));assert(!ui.includes('externalAIConsent'))
  assert(!ui.includes('type="checkbox"'));assert(ui.includes('setAICoachPreference(enabled)'))
  assert(fs.readFileSync('src/app/(app)/account/page.tsx','utf8').includes('AICoachSettings'))
  assert(fs.readFileSync('src/components/ai-coach-preference.tsx','utf8').includes('role="switch"'))
  assert(!ui.includes('AI_API_KEY'));assert(!ui.includes('coach-provider'))
  console.log('PASS saved consent, undecided/disabled accounts, activation persistence, settings toggles, auth/origin, user isolation, Gemini path, bounded history, minimized payload, secrets, failures/timeout/invalid output, safety and local fallback')
}
main().catch(error=>{console.error(error);process.exitCode=1})

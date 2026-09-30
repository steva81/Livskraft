const assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path')
require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node',jsx:'react-jsx'}})
const resolve=Module._resolveFilename,load=Module._load
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.resolve('src',request.slice(2)):request,...args)}
Module._load=function(request,...args){
  if(request==='@/lib/i18n/provider')return {useLanguage:()=>({language:'sv'}),Localize:({children})=>children}
  if(request==='next/navigation')return {usePathname:()=>'/dashboard'}
  return load.call(this,request,...args)
}
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
const {recentCoachActivity,recentActivityReply,needsRecentActivity}=require('../src/lib/coach-activity')
const {isFollowUp}=require('../src/lib/coach-conversation')
const {editableNumber}=require('../src/lib/editable-number')
const {defaultPreferences,readPreferences,validPreferences}=require('../src/lib/preferences')
const {CoachText}=require('../src/components/coach-text')
const {StartingChoices}=require('../src/components/starting-choices')
const {MobileNavigation,moreDestinations}=require('../src/components/mobile-navigation')
const day=(base,offset)=>{const date=new Date(base);date.setDate(date.getDate()+offset);return date}
const now=new Date(2026,8,30,18),today=new Date(2026,8,30)
const workouts=[
  {userId:'A',completed:true,date:day(today,-1),workout:{title:'A Chest',type:'gym',exercises:'[{"name":"Bench press","sets":3}]'},notes:'PRIVATE_NOTES'},
  {userId:'B',completed:true,date:day(today,-1),workout:{title:'B Legs',type:'home',exercises:'[{"name":"Squat"}]'}},
  {userId:'A',completed:false,date:day(today,0),workout:{title:'UNFINISHED',type:'gym',exercises:'[]'}},
  {userId:'A',completed:true,date:day(today,-7),workout:{title:'TOO_OLD',type:'gym',exercises:'[]'}},
  {userId:'A',completed:true,date:day(today,1),workout:{title:'FUTURE',type:'gym',exercises:'[]'}},
]
const logs=[
  {userId:'A',date:day(today,-1),steps:0,stepsRecorded:false},
  {userId:'A',date:day(today,-2),steps:0,stepsRecorded:true},
  {userId:'A',date:day(today,-3),steps:3210,stepsRecorded:false},
  {userId:'B',date:day(today,-1),steps:8765,stepsRecorded:true},
]
const queries=[]
const db={
  workoutLog:{findMany:async query=>{queries.push(query);assert(query.where.userId);assert.equal(query.where.completed,true);assert.equal(query.take,29);assert(!JSON.stringify(query.select).includes('notes'));return workouts.filter(row=>row.userId===query.where.userId&&row.completed&&row.date>=query.where.date.gte&&row.date<query.where.date.lt).map(row=>({date:row.date,workout:row.workout}))}},
  dailyLog:{findMany:async query=>{queries.push(query);assert(query.where.userId);assert.equal(query.take,7);assert.deepEqual(Object.keys(query.select).sort(),['date','steps','stepsRecorded']);return logs.filter(row=>row.userId===query.where.userId&&row.date>=query.where.date.gte&&row.date<query.where.date.lt)}},
}
async function main(){
 const a=await recentCoachActivity('A',db,null,now),b=await recentCoachActivity('B',db,undefined,now)
 assert.equal(a.today,'2026-09-30');assert.equal(a.from,'2026-09-24');assert.equal(a.weekStartsOn,'2026-09-28')
 assert.deepEqual(a.workouts,[{date:'2026-09-29',title:'A Chest',type:'gym',exercises:['Bench press']}])
 assert.equal(a.steps.length,7);assert.equal(a.steps.find(row=>row.date==='2026-09-29').steps,null)
 assert.equal(a.steps.find(row=>row.date==='2026-09-28').steps,0);assert.equal(a.steps.find(row=>row.date==='2026-09-27').steps,3210)
 assert.equal(a.todayPlan.status,'rest');assert.equal(b.todayPlan.status,'unknown')
 assert(!JSON.stringify(a).includes('B Legs'));assert(!JSON.stringify(b).includes('A Chest'));assert(!JSON.stringify(a).includes('PRIVATE_NOTES'))
 assert.match(recentActivityReply('Vad tränade jag igår?',a,false),/A Chest/)
 assert.match(recentActivityReply('Vad har jag tränat den här veckan?',a,false),/A Chest/)
 assert.match(recentActivityReply('Vad tränade jag idag?',a,false),/inget avklarat/)
 assert.match(recentActivityReply('Hur har mina steg sett ut de senaste dagarna?',a,false),/inte registrerat/)
 const empty=await recentCoachActivity('NONE',db,undefined,now)
 assert.equal(empty.workouts.length,0);assert(empty.steps.every(row=>row.steps===null))
 assert.match(recentActivityReply('Har jag registrerat någon träning den här veckan?',empty,false),/inget avklarat/)
 assert.equal(needsRecentActivity('Help me with dinner.',[{role:'user',text:'I trained yesterday'}]),false,'Unrelated turn does not broaden provider context')
 assert.equal(needsRecentActivity('och imorgon då?',[{role:'user',text:'I trained yesterday'}]),true)
 const dst=await recentCoachActivity('NONE',db,null,new Date(2026,9,26,12))
 assert.equal(dst.from,'2026-10-20');assert.equal(dst.steps.at(-1).date,'2026-10-26');assert.equal(dst.weekStartsOn,'2026-10-26')
 for(const message of ['och imorgon då?','vad tycker du istället?','jag hann inte göra det','kan jag köra ben istället?','Why?'])assert.equal(isFollowUp(message),true,message)
 for(const [key,min,max,newValue] of [['dailySteps',0,50000,'9000'],['cookingMinutes',5,180,'40'],['trainingDays',0,5,'3'],['workoutMinutes',10,120,'45']]){
   assert(Number.isNaN(editableNumber('')));assert.equal(validPreferences({...defaultPreferences,[key]:editableNumber('')}),false)
   assert.equal(editableNumber(newValue),Number(newValue));assert.equal(validPreferences({...defaultPreferences,[key]:editableNumber(newValue)}),true)
   for(const value of [min-1,max+1,1.5])assert.equal(validPreferences({...defaultPreferences,[key]:value}),false)
 }
 const choices=renderToStaticMarkup(React.createElement(StartingChoices,{value:{...defaultPreferences,dailySteps:NaN},onChange(){}}))
 assert(choices.includes('value=""'));assert(!choices.includes('NaN'))
 for(const equipment of ['kroppsvikt','hantlar, bänk','gummiband, kettlebell'])assert.equal(readPreferences(JSON.stringify({...defaultPreferences,equipment})).equipment,equipment)
 const rendered=renderToStaticMarkup(React.createElement(CoachText,{text:'**Återhämtning**\n\nEtt steg.\n\n- Vila\n- Mat\n\n1. Börja lugnt\n2. Välj själv\n\n<script>alert(1)</script> [länk](javascript:alert(1))'}))
 assert(rendered.includes('<strong>Återhämtning</strong>'));assert(rendered.includes('<ul'));assert(rendered.includes('<ol'));assert(!rendered.includes('**'))
 assert(!rendered.includes('<script>'));assert(!rendered.includes('<a '));assert(rendered.includes('&lt;script&gt;'))
 const nav=renderToStaticMarkup(React.createElement(MobileNavigation))
 for(const route of ['/home','/dashboard','/plan','/training'])assert(nav.includes(`href="${route}"`))
 assert(nav.includes('Mer'));assert(nav.includes('aria-expanded="false"'))
 assert.deepEqual(moreDestinations.map(item=>item.href),['/meals','/progress','/coach','/my-plan','/profile','/account'])
 // Test the actual shared picker handler and JSX wiring, without a native camera.
 const photoSource=fs.readFileSync('src/components/daily-nutrition.tsx','utf8')
 const photoAST=ts.createSourceFile('daily-nutrition.tsx',photoSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
 const fileInputs=[];let pickerHandler
 function visit(node){
   if(ts.isVariableDeclaration(node)&&node.name.getText(photoAST)==='choosePhoto')pickerHandler=node.initializer.getText(photoAST)
   if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(photoAST)==='input'){
     const attributes=node.attributes.properties.filter(ts.isJsxAttribute)
     if(attributes.some(attribute=>attribute.name.getText(photoAST)==='type'&&attribute.initializer?.text==='file'))fileInputs.push(attributes)
   }
   ts.forEachChild(node,visit)
 }
 visit(photoAST);assert.equal(fileInputs.length,2)
 const captures=fileInputs.map(attributes=>attributes.find(attribute=>attribute.name.getText(photoAST)==='capture')?.initializer?.text)
 assert.deepEqual(captures,['environment',undefined],'Camera requests rear capture; library input must not request capture')
 for(const attributes of fileInputs){
   assert.equal(attributes.find(attribute=>attribute.name.getText(photoAST)==='onChange').initializer.expression.getText(photoAST),'choosePhoto')
   assert.equal(attributes.find(attribute=>attribute.name.getText(photoAST)==='accept').initializer.text,'image/jpeg,image/png,image/webp')
 }
 let photoState={photo:'old-preview',file:'old-file',estimate:'reviewed-estimate',token:'stable-token',error:''}
 const pickerScope={module:{exports:{}},URL:{createObjectURL:()=> 'new-preview'},t:sv=>sv,
   setPhoto:value=>photoState.photo=value,setPhotoFile:value=>photoState.file=value,setEstimate:value=>photoState.estimate=value,setPhotoToken:value=>photoState.token=value,setError:value=>photoState.error=value}
 vm.runInNewContext(ts.transpileModule(`module.exports = ${pickerHandler}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,pickerScope)
 const select=pickerScope.module.exports,unchanged={...photoState}
 for(let source=0;source<2;source++){select({currentTarget:{files:[],value:''}});assert.deepEqual(photoState,unchanged,'Cancel preserves preview/review/token')}
 select({currentTarget:{files:[{type:'image/svg+xml',size:100}],value:'invalid'}})
 assert.equal(photoState.photo,unchanged.photo);assert.equal(photoState.token,unchanged.token);assert(photoState.error)
 select({currentTarget:{files:[{type:'image/jpeg',size:11*1024*1024}],value:'oversize'}})
 assert.equal(photoState.file,unchanged.file);assert.equal(photoState.estimate,unchanged.estimate)
 for(const type of ['image/jpeg','image/png','image/webp']){
   const file={type,size:100},event={currentTarget:{files:[file],value:'selected'}}
   select(event);assert.equal(photoState.file,file);assert.equal(photoState.photo,'new-preview')
   assert.equal(photoState.estimate,null);assert.equal(photoState.token,null);assert.equal(photoState.error,'');assert.equal(event.currentTarget.value,'')
 }
 console.log('PASS shared camera/library inputs, rear-capture hint, cancel, validation, replacement and same-file reselection')
 console.log('PASS recent activity calendar/relative dates, missing data, scoped queries, isolation, follow-ups, numeric empty editing/ranges, equipment round-trip, escaped Coach formatting and mobile destinations')
}
main().catch(error=>{console.error(error);process.exitCode=1})

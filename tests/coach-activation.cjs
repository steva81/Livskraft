// Actual onboarding/settings JSX and client handlers; provider/auth tests live in coach-live.cjs.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const compile=text=>ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText
function find(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of React.Children.toArray(node.props?.children)){const result=find(child,predicate);if(result)return result}return null}
function settings(saved){
 const states=[],effects=[],requests=[];let cursor=0,first=true
 const hooks={useState:initial=>{const index=cursor++;if(first)states[index]=initial;return [states[index],value=>states[index]=value]},useEffect:effect=>{if(first)effects.push(effect)}}
 const scope={exports:{},module:{exports:{}},fetch:async(url,options)=>{
   requests.push({url,options});if(options?.method==='PATCH'){saved=JSON.parse(options.body).aiCoachEnabled;return {ok:true,json:async()=>({aiCoachEnabled:saved})}}
   return {ok:true,json:async()=>({aiCoachEnabled:saved})}
 },require:name=>name==='react'?hooks:name==='@/lib/i18n/provider'?{useLanguage:()=>({language:'sv'})}:name==='./ui/button'?{Button:({variant,children,...props})=>React.createElement('button',props,children)}:require(name)}
 vm.createContext(scope);scope.module.exports=scope.exports
 vm.runInContext(compile(fs.readFileSync('src/components/ai-coach-preference.tsx','utf8')),scope)
 const render=()=>{cursor=0;const tree=scope.exports.AICoachInformation();first=false;return tree}
 return {render,effects,requests,onboarding:scope.exports.AICoachOnboarding,saved:()=>saved}
}
async function main(){
 for(const saved of [true,false,null]){
  const f=settings(saved);let tree=f.render(),toggle=find(tree,node=>node.props?.role==='switch')
  assert(toggle.props.disabled,'Do not display an invented loaded state')
  f.effects[0]();await new Promise(resolve=>setImmediate(resolve));tree=f.render();toggle=find(tree,node=>node.props?.role==='switch')
  assert.equal(toggle.props.checked,saved===true);assert.equal(toggle.props.disabled,false)
  assert(renderToStaticMarkup(tree).includes(saved===true?'På':'Av'))
  await toggle.props.onChange({target:{checked:true}});tree=f.render();assert.equal(find(tree,node=>node.props?.role==='switch').props.checked,true);assert.equal(f.saved(),true)
  await find(tree,node=>node.props?.role==='switch').props.onChange({target:{checked:false}});tree=f.render();assert.equal(find(tree,node=>node.props?.role==='switch').props.checked,false);assert.equal(f.saved(),false)
  assert.equal(f.requests[1].url,'/api/coach/preference');assert.deepEqual(JSON.parse(f.requests[1].options.body),{aiCoachEnabled:true})
 }
 const f=settings(false);let choice=false
 let onboarding=f.onboarding({value:choice,onChange:value=>choice=value})
 assert(renderToStaticMarkup(onboarding).includes('Google Gemini'));assert(renderToStaticMarkup(onboarding).includes('<details'))
 find(onboarding,node=>node.props?.children==='Aktivera AI Coach').props.onClick();assert.equal(choice,true)
 onboarding=f.onboarding({value:choice,onChange:value=>choice=value});assert.equal(find(onboarding,node=>node.props?.children==='Aktivera AI Coach').props['aria-pressed'],true)
 find(onboarding,node=>node.props?.children==='Inte nu').props.onClick();assert.equal(choice,false)
 const source=fs.readFileSync('src/app/(app)/coach/page.tsx','utf8'),ast=ts.createSourceFile('coach.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
 let status,send;const controls=[]
 function visit(node){
  if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='sendMessage')send=node.initializer.getText(ast)
  if(ts.isJsxExpression(node)&&node.expression?.getText(ast).startsWith('historyReady&&aiCoachEnabled!==true&&'))status=node.expression.getText(ast)
  if(ts.isJsxSelfClosingElement(node)||ts.isJsxOpeningElement(node)){
   const attrs=node.attributes.properties.filter(ts.isJsxAttribute),label=attrs.find(attr=>attr.name.getText(ast)==='aria-label')?.initializer?.text
   if(label==='Din fråga till coachen'||label==='Skicka fråga'||attrs.some(attr=>attr.name.getText(ast)==='onClick'&&attr.initializer?.getText(ast).includes('sendMessage'))){
    controls.push(attrs.find(attr=>attr.name.getText(ast)==='disabled').initializer.expression.getText(ast))
   }
  }
  ts.forEachChild(node,visit)
 }
 visit(ast);assert(status&&send)
 assert.equal(controls.length,3,'Input, Send and quick prompts all have guards')
 for(const preference of [true,false,null]){
  const requests=[],messages=[],scope={exports:{},module:{exports:{}},require,historyReady:true,aiCoachEnabled:preference,language:'sv',input:'Normal question',loading:false,setHistoryError(){},setMessages:update=>messages.splice(0,messages.length,...update(messages)),setInput:value=>scope.input=value,setLoading:value=>scope.loading=value,setAICoachEnabled:value=>scope.aiCoachEnabled=value,fetch:async(url,options)=>{requests.push(JSON.parse(options.body));return {ok:true,status:200,json:async()=>({reply:'Reply',saved:true})}}}
  vm.createContext(scope);vm.runInContext(`{${compile(`module.exports.status=${status};module.exports.send=${send};module.exports.controls=()=>[${controls.join(',')}]`)}}`,scope)
  const html=renderToStaticMarkup(scope.module.exports.status)
  assert.equal(html.includes('AI Coach är avstängd.'),preference!==true)
  assert.equal(html.includes('href="/account"'),preference!==true)
  assert(scope.module.exports.controls().every(value=>value===(preference!==true)))
  scope.historyReady=false
  assert(scope.module.exports.controls().every(Boolean),'No controls are usable before preference load')
  await scope.module.exports.send('Before load');assert.equal(requests.length,0);assert.equal(messages.length,0)
  scope.historyReady=true
  await scope.module.exports.send('Normal question')
  assert.deepEqual(requests,preference===true?[{message:'Normal question'}]:[],'Disabled/missing preference cannot send')
  assert.equal(messages.length,preference===true?2:0,'Disabled requests never optimistically append')
  if(preference===true){
   // Another tab disabled the account setting after this tab loaded.
   messages.splice(0,messages.length,{id:0,role:'coach',text:'Existing history'})
   scope.fetch=async()=>({ok:false,status:403,json:async()=>({error:'ai_coach_disabled'})})
   await scope.module.exports.send('Stale draft')
   assert.equal(scope.aiCoachEnabled,false);assert.equal(scope.input,'Stale draft')
   assert.deepEqual(messages,[{id:0,role:'coach',text:'Existing history'}],'Rejected optimistic message is removed without a fake Coach reply')
   assert(scope.module.exports.controls().every(Boolean))
  }
 }
 for(const removed of ['pendingMessage','chooseAICoach','setAICoachPreference','Aktivera AI Coach','Inte nu'])assert(!source.includes(removed),removed)
 assert(fs.readFileSync('src/app/onboarding/page.tsx','utf8').includes('preferences:{...data.preferences,aiCoachEnabled}'))
 console.log('PASS onboarding/Account choices, disabled and loading input/Send/quick prompts, no optimistic send, enabled chat, stale-tab rejection/draft preservation and settings status/link')
}
main().catch(error=>{console.error(error);process.exitCode=1})

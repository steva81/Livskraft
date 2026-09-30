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
 let status,send
 function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='sendMessage')send=node.initializer.getText(ast);if(ts.isJsxExpression(node)&&node.expression?.getText(ast).startsWith('historyReady&&aiCoachEnabled!==true&&'))status=node.expression.getText(ast);ts.forEachChild(node,visit)}
 visit(ast);assert(status&&send)
 for(const preference of [true,false,null]){
  const requests=[],scope={exports:{},module:{exports:{}},require,historyReady:true,aiCoachEnabled:preference,language:'sv',loading:false,setHistoryError(){},setMessages(){},setInput(){},setLoading(){},fetch:async(url,options)=>{requests.push(JSON.parse(options.body));return {ok:true,status:200,json:async()=>({reply:'Reply',saved:true})}}}
  vm.createContext(scope);vm.runInContext(`{${compile(`module.exports.status=${status};module.exports.send=${send}`)}}`,scope)
  const html=renderToStaticMarkup(scope.module.exports.status)
  assert.equal(html.includes('AI Coach är avstängd.'),preference!==true)
  assert.equal(html.includes('href="/account"'),preference!==true)
  await scope.module.exports.send('Normal question');assert.deepEqual(requests,[{message:'Normal question'}],'Only server-saved preference controls provider routing')
 }
 for(const removed of ['pendingMessage','chooseAICoach','setAICoachPreference','Aktivera AI Coach','Inte nu'])assert(!source.includes(removed),removed)
 assert(fs.readFileSync('src/app/onboarding/page.tsx','utf8').includes('preferences:{...data.preferences,aiCoachEnabled}'))
 console.log('PASS onboarding choices, Account saved state and On/Off persistence, missing-disabled state, Coach settings status/link and no chat consent controls')
}
main().catch(error=>{console.error(error);process.exitCode=1})

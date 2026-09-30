// Exercise the actual client handlers and saved-false activation JSX without a live provider.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const source=fs.readFileSync('src/app/(app)/coach/page.tsx','utf8')
const ast=ts.createSourceFile('coach.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
let send,choose,activation
function visit(node){
 if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='sendMessage')send=node.initializer.getText(ast)
 if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='chooseAICoach')choose=node.initializer.getText(ast)
 if(ts.isJsxExpression(node)&&node.expression?.getText(ast).startsWith('aiCoachEnabled===false&&pendingMessage===null&&'))activation=node.expression.getText(ast)
 ts.forEachChild(node,visit)
}
visit(ast);assert(send&&choose&&activation)
const compile=text=>ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText
function fixture(preference){
 const requests=[],writes=[],actions=[],scope={module:{exports:{}},exports:{},require,aiCoachEnabled:preference,pendingMessage:null,input:'My pending question',language:'sv',loading:false,savingPreference:false,historyReady:true,
  setPendingMessage:value=>scope.pendingMessage=value,setAICoachEnabled:value=>scope.aiCoachEnabled=value,
  setSavingPreference:value=>scope.savingPreference=value,setHistoryError(){},setInput(){},setLoading:value=>scope.loading=value,setMessages(){},
  setAICoachPreference:async value=>{writes.push(value);return value},
  fetch:async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return {ok:true,status:200,json:async()=>({reply:'Reply',saved:true})}},
  Button:({children,...props})=>{if(props.onClick)actions.push(props.onClick);return React.createElement('button',props,children)}}
 vm.createContext(scope)
 vm.runInContext(compile(`const sendMessage=${send}; const chooseAICoach=${choose}; module.exports={sendMessage,chooseAICoach}`),scope)
 const panel=()=>{vm.runInContext(`{${compile(`module.exports.panel=${activation}`)}}`,scope);return renderToStaticMarkup(scope.module.exports.panel)}
 return {scope,requests,writes,actions,send:scope.module.exports.sendMessage,choose:scope.module.exports.chooseAICoach,panel}
}
async function main(){
 for(const preference of [null,false]){
  const f=fixture(preference)
  assert.equal(f.panel().includes('Aktivera AI Coach'),preference===false,'Saved false has an obvious activation action')
  await f.send('Pending question')
  assert.equal(f.scope.pendingMessage,'Pending question');assert.equal(f.requests.length,0,'Consent precedes chat')
  await f.choose(true)
  assert.deepEqual(f.writes,[true]);assert.equal(f.scope.aiCoachEnabled,true)
  assert.equal(f.scope.pendingMessage,null);assert.equal(f.requests.length,1)
  assert.deepEqual(f.requests[0],{url:'/api/coach',body:{message:'Pending question'}},'No client consent flag')
  assert(!f.panel().includes('Aktivera AI Coach'))
  await f.send('Next question');assert.equal(f.requests.length,2,'Activated messages have no interruption')
 }
 const enabled=fixture(true);assert.equal(enabled.panel(),'');await enabled.send('Direct question')
 assert.equal(enabled.scope.pendingMessage,null);assert.equal(enabled.requests.length,1);assert.deepEqual(enabled.writes,[])
 const action=fixture(false);action.panel();action.actions[0]()
 assert.equal(action.scope.pendingMessage,'My pending question');await action.choose(true)
 assert.deepEqual(action.writes,[true]);assert.equal(action.requests[0].body.message,'My pending question','Visible action retains the draft')
 const empty=fixture(false);empty.scope.input='';empty.panel();empty.actions[0]();await empty.choose(true)
 assert.deepEqual(empty.writes,[true]);assert.equal(empty.requests.length,0,'Activation without a draft never sends an empty message')
 const postponed=fixture(false);await postponed.send('Reviewed question');await postponed.choose(false)
 assert.deepEqual(postponed.writes,[false]);assert.equal(postponed.requests.length,1,'Not now continues only the explicitly reviewed message')
 await postponed.send('Another question');assert.equal(postponed.requests.length,1);assert.equal(postponed.scope.pendingMessage,'Another question','Saved false never silently becomes a permanent fallback mode')
 assert(!fs.readFileSync('src/components/ai-coach-preference.tsx','utf8').includes('role="switch"'))
 console.log('PASS null/false/true activation UX, visible reactivation, saved activation, pending send, explicit postponement and no client consent flag')
}
main().catch(error=>{console.error(error);process.exitCode=1})

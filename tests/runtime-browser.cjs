const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TEST_BASE_URL||'http://localhost:3000';
const email=process.env.TEST_LOGIN_EMAIL||'anna@demo.com',password=process.env.TEST_LOGIN_PASSWORD||'password123';
const routes=['/home','/dashboard','/plan','/meals','/training','/progress','/coach','/my-plan','/profile','/account'];
(async()=>{const browser=await chromium.launch({channel:process.env.TEST_BROWSER_CHANNEL||'msedge'});const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();page.setDefaultTimeout(90000);const responses=new WeakMap(),cancelled=[],pending=new Map(),failures=[],errors=[],results=[];let original;
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,250))});
page.on('request',r=>{const url=new URL(r.url());assert(!url.searchParams.has('email')&&!url.searchParams.has('password'));assert(!decodeURIComponent(r.url()).includes(password));if(!url.pathname.includes('webpack-hmr'))pending.set(r,{path:url.pathname,method:r.method(),action:r.headers()['next-action']||null});});
page.on('requestfinished',r=>pending.delete(r));page.on('requestfailed',r=>{const info=pending.get(r);if(info){const response=responses.get(r),error=r.failure()?.errorText;if(error==='net::ERR_ABORTED'&&response?.status===200&&response?.type.includes('text/x-component'))cancelled.push({...info,reason:'Completed HTTP 200 Flight stream cancelled by router'});else if(error==='net::ERR_ABORTED'&&r.isNavigationRequest())cancelled.push({...info,reason:'Router superseded document navigation'});else failures.push({...info,error});}pending.delete(r)});page.on('response',r=>{responses.set(r.request(),{status:r.status(),type:r.headers()['content-type']||''});if(r.status()>=400)failures.push({path:new URL(r.url()).pathname,status:r.status()})});
async function settled(){await page.waitForLoadState('networkidle');const end=Date.now()+90000;while(pending.size&&Date.now()<end)await page.waitForTimeout(200);assert.equal(pending.size,0,JSON.stringify([...pending.values()]));}
async function ready(lang){await page.waitForFunction(()=>{const mode=document.querySelector('select[aria-describedby="mode-help"]');const main=document.querySelector('.app-scroll');return mode&&!mode.disabled&&main&&!/(Laddar (veckoplan|dina recept|träningsplan|framsteg|samtalet|din profil|din dag)|Opening your home|Öppnar din startsida|Loading (your|the|training|progress|conversation|weekly))/i.test(main.innerText)});await settled();if(lang)assert.equal(await page.locator('html').getAttribute('lang'),lang);}
async function language(value){await page.goto(base+'/account');await ready();const select=page.getByRole('combobox',{name:/^(Språk|Language)$/});await select.selectOption(value);await page.waitForFunction(v=>document.documentElement.lang===v,value);await settled();await page.waitForFunction(()=>!document.querySelector('select[aria-label="Språk"],select[aria-label="Language"]').disabled);}
try{
 await page.goto(base+'/login');await page.waitForFunction(()=>!document.querySelector('fieldset').disabled);await page.locator('#login-email').fill(email);await page.locator('#login-password').fill(password);await page.getByRole('button',{name:'Logga in',exact:true}).click();await page.waitForURL('**/home');await ready();
 const session=await(await context.request.get(base+'/api/auth/session')).json();assert(session.user?.id);assert.equal(session.user.email,email);
 await page.goto(base+'/account');await ready();original=await page.getByRole('combobox',{name:/^(Språk|Language)$/}).inputValue();
 for(const lang of ['sv','en']){await language(lang);for(const route of routes){
  await page.evaluate(()=>{window.__localeChanges=[];window.__localeObserver?.disconnect();window.__localeObserver=new MutationObserver(()=>window.__localeChanges.push(document.documentElement.lang));window.__localeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['lang']})});
  await page.locator(`aside a[href="${route}"]`).first().click();await page.waitForURL(base+route);await ready(lang);assert((await page.evaluate(()=>window.__localeChanges)).every(v=>v===lang),'Locale changed during client navigation');
  if(route==='/coach')assert(await page.locator('input[maxlength="2000"]').isEnabled());if(route==='/my-plan')assert(await page.locator('#body input').count()>0);if(route==='/account')assert((await page.locator('main').innerText()).includes(email));
  const heading=await page.locator('.app-scroll h1,.app-scroll h2').first().innerText();
  results.push({route,language:lang,navigation:'client',heading,pending:pending.size});
  await page.reload();await ready(lang);results.push({route,language:lang,navigation:'reload',pending:pending.size});
  console.log('PASS',lang,route,'client navigation + reload');
  if(process.env.TEST_EVIDENCE_DIR)await page.screenshot({path:`${process.env.TEST_EVIDENCE_DIR}/runtime-fixed-${lang}-${route.slice(1)}.png`});
 }}
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);console.log('PASS 40 route/locale checks; no pending/failed requests, runtime errors, locale loops or credential URLs');
}finally{
 if(original){try{await language(original);console.log('Original account language restored')}catch(e){console.error('Could not restore original language');process.exitCode=1}}
 if(process.env.TEST_EVIDENCE_DIR)fs.writeFileSync(process.env.TEST_EVIDENCE_DIR+'/runtime-browser-results.json',JSON.stringify({results,errors,failures,cancelled,pending:[...pending.values()]},null,2));
 await browser.close();
}})().catch(e=>{console.error(e.message);process.exitCode=1});

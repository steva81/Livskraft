// Isolated QA server + database only; Gemini is mocked at the browser boundary.
const assert=require('node:assert/strict')
assert.equal(process.env.LIVSKRAFT_INTAKE_TEST_DB,'1')
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright')
const {PrismaClient}=require('@prisma/client'),prisma=new PrismaClient()
const base=process.env.TEST_BASE_URL||'http://localhost:3107'
const ids=[]
async function main(){
 const browser=await chromium.launch({channel:'msedge',headless:true})
 try {
  for(const language of ['sv','en']){
   const user=await prisma.user.create({data:{name:'Photo QA',email:`photo-browser-${language}-${Date.now()}@example.invalid`,password:'Disposable-photo-test-123',mode:'advanced',preferences:JSON.stringify({language})}})
   ids.push(user.id)
   const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage()
   page.setDefaultTimeout(60000)
   let posts=0,fail=true,available=true
   const errors=[];page.on('pageerror',e=>errors.push(e.message))
   await page.route('**/api/photo-meal',async route=>{
    if(route.request().method()==='GET')return route.fulfill({json:{available}})
    posts++
    assert.equal(route.request().headers()['content-type'],'image/jpeg')
    assert(route.request().postDataBuffer().length<5*1024*1024)
    if(fail)return route.fulfill({status:400,json:{error:'provider_failure'}})
    return route.fulfill({json:{estimate:{items:[{name:'Rice',estimatedGrams:150,calories:200,protein:5,carbs:40,fat:2,fibre:1}],confidence:'low',note:'Oil is uncertain.'}}})
   })
   await page.goto(base+'/login')
   await page.waitForFunction(()=>!document.querySelector('fieldset').disabled)
   await page.locator('#login-email').fill(user.email);await page.locator('#login-password').fill('Disposable-photo-test-123')
   await page.getByRole('button',{name:'Logga in',exact:true}).click();await page.waitForURL('**/home')
   await page.goto(base+'/dashboard')
   const panel=page.locator('.nutrition-panel').first(),en=language==='en'
   const add=panel.getByRole('button',{name:en?'Add own meal':'Lägg till egen måltid',exact:true})
   await add.click()
   const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1600;c.height=900;c.getContext('2d').fillRect(0,0,1600,900);return c.toDataURL('image/png').split(',')[1]})
   await panel.locator('input[type=file]').setInputFiles({name:'plate.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')})
   assert.equal(posts,0);assert.equal(await prisma.ownMeal.count({where:{userId:user.id}}),0)
   const analyze=panel.getByRole('button',{name:en?'Analyze image with AI':'Analysera bild med AI',exact:true})
   await analyze.click();await panel.getByRole('alert').waitFor();await analyze.waitFor({state:'visible'})
   assert(await analyze.isEnabled(),'Failure must unlock analysis')
   fail=false;await analyze.click()
   const confirm=panel.getByRole('button',{name:en?'Add to today':'Lägg till i idag',exact:true})
   await confirm.waitFor();assert(await panel.getByText(en?'Low – check carefully':'Låg – kontrollera extra noga',{exact:false}).isVisible())

   await panel.locator('input[type=file]').setInputFiles({name:'plate2.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')})
   assert(await confirm.isHidden(), 'Replacing image must clear estimate')
   await analyze.click(); await confirm.waitFor()
   await panel.getByRole('button',{name:en?'Remove image':'Ta bort bild',exact:true}).click()
   assert(await confirm.isHidden(), 'Removing image must clear estimate')
   await panel.locator('input[type=file]').setInputFiles({name:'plate3.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')})
   await analyze.click(); await confirm.waitFor()

   assert.equal(await prisma.ownMeal.count({where:{userId:user.id}}),0,'Review must not persist')
   if(process.env.TEST_EVIDENCE_DIR)await page.screenshot({path:`${process.env.TEST_EVIDENCE_DIR}/photo-${language}-review.png`,fullPage:true})
   await panel.getByLabel(en?'Meal name':'Måltidens namn',{exact:true}).fill('Reviewed photo')
   await panel.getByLabel(en?'Energy (kcal)':'Energi (kcal)',{exact:true}).fill('321')
   // Force a failed save transport, then retry the same draft.
   let blockSave=true
   await page.route('**/dashboard',async route=>{if(blockSave&&route.request().method()==='POST'&&route.request().headers()['next-action']){blockSave=false;return route.abort()}return route.continue()})
   await confirm.click();await panel.getByRole('alert').waitFor();assert(await confirm.isEnabled())
   await confirm.click();await panel.locator('form').waitFor({state:'hidden'})
   const saved=await prisma.ownMeal.findMany({where:{userId:user.id}})
   assert.equal(saved.length,1);assert.equal(JSON.parse(saved[0].nutrition).calories,321)
   assert.equal(saved[0].name,'Reviewed photo')
   await add.click();await panel.getByRole('button',{name:en?'Cancel':'Avbryt',exact:true}).click()
   assert.equal(await prisma.ownMeal.count({where:{userId:user.id}}),1)
   available=false;await page.reload();await add.click()
   assert(await panel.getByText(en?'Photo AI is unavailable. You can enter the meal manually.':'Foto-AI är inte tillgänglig. Du kan fylla i måltiden manuellt.',{exact:true}).isVisible())
   assert(await analyze.isDisabled())
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile horizontal overflow')
   assert.deepEqual(errors,[])
   if(process.env.TEST_EVIDENCE_DIR)await page.screenshot({path:`${process.env.TEST_EVIDENCE_DIR}/photo-${language}-mobile.png`,fullPage:true})
   console.log(`PASS ${language} mobile: explicit analysis, failure/retry, low confidence, editable review, save failure/retry, persisted intake, cancel, disabled provider, no overflow/runtime errors`)
   await context.close()
  }
 } finally {await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await prisma.user.deleteMany({where:{id:{in:ids}}});await prisma.$disconnect()})

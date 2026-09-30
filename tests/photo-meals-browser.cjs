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
   await context.addInitScript(()=>{
    window.cameraCalls=[];window.cameraStreams=[];window.cameraFailure='';window.cameraWait=false
    navigator.mediaDevices.getUserMedia=async constraints=>{
      window.cameraCalls.push(constraints)
      if(window.cameraFailure)throw new DOMException('Test camera failure',window.cameraFailure)
      // Stable synthetic MediaStream at the camera boundary; actual video/canvas/UI remain real.
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480
      const stream=canvas.captureStream(10),paint=setInterval(()=>{
        if(stream.getTracks().every(track=>track.readyState==='ended')){clearInterval(paint);return}
        canvas.getContext('2d').fillRect(0,0,640,480)
      },100)
      window.cameraStreams.push(stream)
      if(window.cameraWait)await new Promise(resolve=>{window.releaseCamera=resolve})
      return stream
    }
   })
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
   const camera=panel.getByRole('button',{name:en?'Take photo':'Ta foto',exact:true})
   const library=panel.getByLabel(en?'Choose image':'Välj bild',{exact:true})
   assert.equal(await library.getAttribute('capture'),null)
   assert.equal(await panel.locator('input[type=file]').count(),1)
   const cameraPanel=panel.getByRole('region',{name:en?'Meal camera':'Måltidskamera'})
   const capture=cameraPanel.getByRole('button',{name:en?'Capture photo':'Ta bild',exact:true})
   const cancelCamera=cameraPanel.getByRole('button',{name:en?'Cancel camera':'Avbryt kamera',exact:true})
   const live=async()=>{try{await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2,{},{timeout:15000})}catch(error){console.error(await page.evaluate(()=>({calls:cameraCalls,tracks:cameraStreams.map(stream=>stream.getTracks().map(track=>track.readyState)),video:document.querySelector('video')?.readyState,alerts:[...document.querySelectorAll('[role=alert]')].map(node=>node.textContent)})));throw error}}
   const stopped=()=>page.waitForFunction(()=>window.cameraStreams.every(stream=>stream.getTracks().every(track=>track.readyState==='ended')))
   const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1600;c.height=900;c.getContext('2d').fillRect(0,0,1600,900);return c.toDataURL('image/png').split(',')[1]})
   await panel.getByLabel(en?'Choose image':'Välj bild',{exact:true}).setInputFiles({name:'plate.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')})
   assert.equal(await page.evaluate(()=>cameraCalls.length),0,'Library selection never requests camera access')
   assert.equal(posts,0);assert.equal(await prisma.ownMeal.count({where:{userId:user.id}}),0)
   const analyze=panel.getByRole('button',{name:en?'Analyze image with AI':'Analysera bild med AI',exact:true})
   await analyze.click();await panel.getByRole('alert').waitFor();await analyze.waitFor({state:'visible'})
   assert(await analyze.isEnabled(),'Failure must unlock analysis')
   fail=false;await analyze.click()
   const confirm=panel.getByRole('button',{name:en?'Add to today':'Lägg till i idag',exact:true})
   await confirm.waitFor();assert(await panel.getByText(en?'Low – check carefully':'Låg – kontrollera extra noga',{exact:false}).isVisible())
   const preview=panel.getByRole('img',{name:en?'Your meal, local preview only':'Din måltid, endast lokal förhandsvisning'})
   const previewURL=await preview.getAttribute('src'),postsBeforeCancel=posts
   const previewHeight=(await preview.boundingBox()).height
   await library.setInputFiles([])
   await camera.click();await capture.waitFor();await live()
   await cancelCamera.click();await stopped()
   assert(await confirm.isVisible(),'Canceling either input must retain the reviewed result')
   assert.equal(await preview.getAttribute('src'),previewURL);assert.equal(posts,postsBeforeCancel)

   // Exercise getUserMedia boundary and real video/canvas with a synthetic stream.
   await camera.click();await live()
   await capture.click();await cameraPanel.getByRole('img',{name:en?'Captured image':'Tagen bild'}).waitFor();await stopped()
   assert.equal(posts,postsBeforeCancel,'Capture stays local')
   await cameraPanel.getByRole('button',{name:en?'Retake':'Ta om',exact:true}).click()
   await live()
   await capture.click();await cameraPanel.getByRole('button',{name:en?'Use image':'Använd bild',exact:true}).click();await stopped()
   assert.equal(posts,postsBeforeCancel,'Use image still requires explicit analysis')
   assert(await page.evaluate(()=>cameraCalls.every(value=>value.audio===false&&value.video.facingMode.ideal==='environment')))
   assert(await confirm.isHidden(), 'Replacing image must clear estimate')
   assert.equal((await preview.boundingBox()).height,previewHeight,'Preview dimensions stay stable across sources')
   await analyze.click(); await confirm.waitFor()
   await camera.click();await live()
   await page.evaluate(()=>cameraStreams.at(-1).getVideoTracks()[0].dispatchEvent(new Event('ended')))
   await cameraPanel.getByRole('alert').waitFor();await stopped();await cancelCamera.click()
   // Permission, missing camera and busy stream errors are localized and harmless.
   for(const failure of ['NotAllowedError','NotFoundError','NotReadableError']){
     await page.evaluate(value=>{window.cameraFailure=value},failure)
     await camera.click();await cameraPanel.getByRole('alert').waitFor();await cancelCamera.click();await stopped()
     assert(await confirm.isVisible());assert.equal(posts,postsBeforeCancel+1)
   }
   await page.evaluate(()=>{window.cameraFailure='';Object.defineProperty(window,'isSecureContext',{value:false,configurable:true})})
   const callsBefore=await page.evaluate(()=>cameraCalls.length)
   await camera.click();await cameraPanel.getByText(en?'Direct camera access is not available in this browser or connection. Choose an existing image instead.':'Direktkamera är inte tillgänglig i den här webbläsaren eller anslutningen. Välj en bild i stället.',{exact:true}).waitFor()
   assert.equal(await page.evaluate(()=>cameraCalls.length),callsBefore)
   await cancelCamera.click();await page.evaluate(()=>Object.defineProperty(window,'isSecureContext',{value:true,configurable:true}))
   await page.evaluate(()=>{window.savedCameraAPI=navigator.mediaDevices.getUserMedia;navigator.mediaDevices.getUserMedia=undefined})
   await camera.click();await cameraPanel.getByRole('alert').waitFor();assert.equal(await page.evaluate(()=>cameraCalls.length),callsBefore)
   await cancelCamera.click();await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=window.savedCameraAPI})
   await camera.click();await live()
   await library.dispatchEvent('click');await stopped();assert(await cameraPanel.isHidden(),'Switching to library closes camera')
   await panel.getByRole('button',{name:en?'Remove image':'Ta bort bild',exact:true}).click()
   assert(await confirm.isHidden(), 'Removing image must clear estimate')
   await panel.getByLabel(en?'Choose image':'Välj bild',{exact:true}).setInputFiles({name:'plate3.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')})
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
   await add.click();await camera.click();await live()
   await panel.getByRole('button',{name:en?'Cancel':'Avbryt',exact:true}).click();await stopped()
   assert.equal(await prisma.ownMeal.count({where:{userId:user.id}}),1)
   await add.click();await page.evaluate(()=>{window.cameraWait=true})
   await camera.click();await page.waitForFunction(()=>!!window.releaseCamera)
   await cancelCamera.click();await page.evaluate(()=>{window.cameraWait=false;window.releaseCamera();window.releaseCamera=null});await stopped()
   await panel.getByRole('button',{name:en?'Cancel':'Avbryt',exact:true}).click()
   available=false;await page.reload();await add.click()
   assert(await panel.getByText(en?'Photo AI is unavailable. You can enter the meal manually.':'Foto-AI är inte tillgänglig. Du kan fylla i måltiden manuellt.',{exact:true}).isVisible())
   assert(await analyze.isDisabled())
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile horizontal overflow')
   assert.deepEqual(errors,[])
   if(process.env.TEST_EVIDENCE_DIR)await page.screenshot({path:`${process.env.TEST_EVIDENCE_DIR}/photo-${language}-mobile.png`,fullPage:true})
   // Direct measurement entry shares dated history with Progress and survives hiding.
   await page.goto(base+'/my-plan')
   const body=page.locator('form#body'),saveBody=body.getByRole('button',{name:en?'Save body data and measurements':'Spara kropp och mått',exact:true})
   await saveBody.waitFor();await body.locator('summary').filter({hasText:en?'Add / hide':'Lägg till / dölj'}).click()
   await body.getByRole('checkbox',{name:en?'Hip':'Höft',exact:true}).check()
   await body.getByRole('checkbox',{name:en?'Chest':'Bröst',exact:true}).check()
   const hip=body.getByLabel(en?'Hip (cm)':'Höft (cm)',{exact:true})
   await hip.fill('');assert.equal(await hip.inputValue(),'','No forced zero')
   await hip.fill('102');assert.equal(await hip.inputValue(),'102')
   await body.getByLabel(en?'Chest (cm)':'Bröst (cm)',{exact:true}).fill('108')
   await body.getByLabel(en?'Waist (cm)':'Midja (cm)',{exact:true}).fill('90')
   await saveBody.click();await body.getByRole('status').getByText(en?'Body data and measurements saved.':'Kropp och mått sparade.',{exact:true}).waitFor()
   const userToday=new Date();userToday.setHours(0,0,0,0)
   assert.equal(await prisma.dailyLog.count({where:{userId:user.id,date:userToday}}),1)
   await page.reload();await hip.waitFor();await page.waitForFunction(()=>document.querySelector('form#body button')?.disabled===false);assert.equal(await hip.inputValue(),'102')
   await body.locator('summary').filter({hasText:en?'Add / hide':'Lägg till / dölj'}).click()
   await body.getByRole('checkbox',{name:en?'Hip':'Höft',exact:true}).uncheck();await saveBody.click()
   await body.getByRole('status').getByText(en?'Body data and measurements saved.':'Kropp och mått sparade.',{exact:true}).waitFor()
   await page.reload();await page.waitForFunction(()=>document.querySelector('form#body button')?.disabled===false);assert(await hip.isHidden())
   await body.locator('summary').filter({hasText:en?'Add / hide':'Lägg till / dölj'}).click()
   await body.getByRole('checkbox',{name:en?'Hip':'Höft',exact:true}).check();assert.equal(await hip.inputValue(),'102')
   assert.equal(JSON.parse((await prisma.dailyLog.findUnique({where:{userId_date:{userId:user.id,date:userToday}}})).measurements).hip,102)
   assert.equal(await page.locator('section#measurements').count(),1,'No duplicate lower panel')
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Body panel has no mobile overflow')
   console.log(`PASS ${language} direct waist/hip/chest, empty editing, save/reload, same-day history and hide/re-enable`)
   console.log(`PASS ${language} mobile: explicit analysis, failure/retry, low confidence, editable review, save failure/retry, persisted intake, cancel, disabled provider, no overflow/runtime errors`)
   await context.close()
  }
 } finally {await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await prisma.user.deleteMany({where:{id:{in:ids}}});await prisma.$disconnect()})

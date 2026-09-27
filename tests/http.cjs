const assert = require('node:assert/strict')
const { PrismaClient } = require('@prisma/client')
require('ts-node').register({ transpileOnly:true, compilerOptions:{module:'CommonJS',moduleResolution:'node'} })
const { hashPassword } = require('../src/lib/password')
const prisma = new PrismaClient()
const base = process.env.TEST_BASE_URL || 'http://localhost:3000'
const ids = []
function client() {
  const cookies = new Map()
  return async (url, options={}) => {
    const response = await fetch(base+url, {...options, redirect:'manual',headers:{...options.headers,cookie:Array.from(cookies).map(([k,v])=>`${k}=${v}`).join('; ')}})
    for(const cookie of response.headers.getSetCookie()) { const pair=cookie.split(';')[0]; const at=pair.indexOf('=');cookies.set(pair.slice(0,at),pair.slice(at+1)) }
    return response
  }
}
async function main() {
  const anonymous=client()
  for(const route of ['/my-plan','/account','/dashboard','/plan','/meals','/training','/progress','/coach','/profile']) {
    const response=await anonymous(route)
    assert.equal(response.status,307)
    assert(response.headers.get('location').includes('/login'))
  }
  assert.equal((await anonymous('/api/coach',{method:'POST',body:'{}'})).status,401)
  console.log('PASS all protected pages redirect; anonymous coach returns 401')
  for(const name of ['TestAlpha','TestBeta']) {
    const email=`http-${name.toLowerCase()}-${Date.now()}@example.invalid`
    const user=await prisma.user.create({data:{name,email,password:await hashPassword('local-test-12345'),dietRestrictions:'["allergy:unknown"]'}})
    ids.push(user.id)
    const today=new Date();today.setHours(0,0,0,0)
    const steps=name==='TestAlpha'?1234:5678
    await prisma.dailyLog.create({data:{userId:user.id,date:today,steps,stepsRecorded:true,weight:name==='TestAlpha'?80:90,waist:name==='TestAlpha'?85:95,mealsEaten:'[]'}})
    const request=client()
    const csrf=await (await request('/api/auth/csrf')).json()
    await request('/api/auth/callback/credentials',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrfToken:csrf.csrfToken,email,password:'local-test-12345',json:'true',callbackUrl:base+'/dashboard'})})
    const session=await (await request('/api/auth/session')).json()
    assert.equal(session.user.id,user.id)
    assert.equal(session.user.name,name)
    assert(!('password' in session.user))
    assert.equal((await request('/dashboard')).status,200)
    const reply=await (await request('/api/coach',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:'motivation'})})).json()
    assert(reply.reply.includes(name))
    assert.equal((await request('/api/coach',{method:'POST',body:'invalid json'})).status,400)
    const stepsReply=await (await request('/api/coach',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:'mina steg'})})).json()
    assert(stepsReply.reply.includes(steps.toLocaleString('sv-SE')))
    const language=name==='TestAlpha'?'en':'sv'
    await prisma.user.update({where:{id:user.id},data:{preferences:JSON.stringify({language,health:'type1',workSchedule:'kvall',budget:'high'})}})
    const signoutCsrf=await (await request('/api/auth/csrf')).json()
    await request('/api/auth/signout',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrfToken:signoutCsrf.csrfToken,json:'true'})})
    assert(!(await (await request('/api/auth/session')).json()).user)
    const freshCsrf=await (await request('/api/auth/csrf')).json()
    await request('/api/auth/callback/credentials',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrfToken:freshCsrf.csrfToken,email,password:'local-test-12345',json:'true'})})
    assert.equal((await (await request('/api/auth/session')).json()).user.id,user.id)
    assert.equal((await (await request('/api/coach')).json()).messages.length,0)
    const archive=await (await request('/api/coach?history=all')).json()
    assert(archive.messages.some(m=>m.text.includes(name)))
    assert(!archive.messages.some(m=>m.text.includes(name==='TestAlpha'?'TestBeta':'TestAlpha')))
    const after=await (await request('/api/coach',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:'mina steg'})})).json()
    assert(after.reply.includes(steps.toLocaleString(language==='en'?'en-GB':'sv-SE')))
    if(language==='en') assert(after.reply.includes('steps'))
    else assert(after.reply.includes('steg'))
    const saved=JSON.parse((await prisma.user.findUnique({where:{id:user.id}})).preferences)
    assert.equal(saved.language,language)
    assert.equal(saved.health,'type1')
    assert.equal(saved.workSchedule,'kvall')
    assert.equal(saved.budget,'high')
    assert((await (await request('/api/coach')).json()).messages.length>=2)
    await request('/api/coach',{method:'DELETE'})
    assert.equal((await (await request('/api/coach?history=all')).json()).messages.length,0)
    await prisma.user.update({where:{id:user.id},data:{password:await hashPassword('rotated-test-password')}})
    assert(!(await (await request('/api/auth/session')).json()).user?.id)
    assert.equal((await request('/api/coach')).status,401)
    console.log(`PASS ${name}: real NextAuth session, own coach context, page access and input validation`)
  }
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await prisma.user.deleteMany({where:{id:{in:ids}}});await prisma.$disconnect()})

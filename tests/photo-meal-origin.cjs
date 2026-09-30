const assert = require('node:assert/strict')
const Module = require('node:module')
const path = require('node:path')
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
const resolve = Module._resolveFilename, load = Module._load
let identity = 'fixture', calls = 0
Module._resolveFilename = function (request, ...args) {
  return resolve.call(this, request.startsWith('@/') ? path.resolve('src', request.slice(2)) : request, ...args)
}
Module._load = function (request, ...args) {
  if (request === 'server-only') return {}
  if (request === '@/lib/auth') return { getAuthenticatedUserId: async () => identity }
  return load.call(this, request, ...args)
}
const route = require('../src/app/api/photo-meal/route')
const { parsePhotoEstimate } = require('../src/lib/photo-meals')
const estimate = { items: [{ name: 'Rice', estimatedGrams: 150, calories: 200, protein: 5, carbs: 40, fat: 2, fibre: 1 }], confidence: 'medium', note: 'Portion uncertainty' }
const request = (origin, url = 'http://127.0.0.1:3000/api/photo-meal', extra = {}) => new Request(url, {
  method: 'POST', headers: { 'content-type': 'image/jpeg', ...(origin === undefined ? {} : { origin }), ...extra }, body: Buffer.from([255, 216, 255, 224]),
})
async function main() {
  process.env.PHOTO_AI_API_KEY = 'test-placeholder'
  process.env.PHOTO_AI_MODEL = 'gemini-test-model'
  global.fetch = async () => {
    calls++
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(estimate) }] } }] })
  }
  delete process.env.NEXTAUTH_URL
  assert.equal((await route.POST(request('https://livskraft.example'))).status, 403, 'Reproduce proxy origin mismatch')
  assert.equal(calls, 0)
  process.env.NEXTAUTH_URL = 'https://livskraft.example/'
  const response = await route.POST(request('https://livskraft.example'))
  assert.equal(response.status, 200, 'Public origin works through internal proxy URL')
  assert.deepEqual(parsePhotoEstimate((await response.json()).estimate), parsePhotoEstimate(estimate))
  assert.equal(calls, 1)
  for (const origin of [undefined, 'null', 'https://evil.example', 'http://127.0.0.1:3000', 'https://livskraft.example:444']) {
    assert.equal((await route.POST(request(origin, undefined, { 'x-forwarded-host': 'evil.example', 'x-forwarded-proto': 'https' }))).status, 403)
  }
  assert.equal(calls, 1, 'Rejected origins never send images to Gemini')
  identity = null
  assert.equal((await route.POST(request('https://livskraft.example'))).status, 401)
  assert.equal(calls, 1)
  identity = 'fixture'
  process.env.NEXTAUTH_URL = 'invalid'
  assert.equal((await route.POST(request('https://livskraft.example'))).status, 403, 'Invalid configuration fails closed')
  delete process.env.NEXTAUTH_URL
  assert.equal((await route.POST(request('http://127.0.0.1:3000'))).status, 200, 'Unconfigured local origin still works')
  console.log('PASS proxy origin, provider/parser success, rejected origins, authentication, fail-closed configuration and local fallback')
}
main().catch(error => { console.error(error); process.exitCode = 1 })

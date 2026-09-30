const assert = require('node:assert/strict')
const { webcrypto } = require('node:crypto')
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
const { browserUUID } = require('../src/lib/browser-uuid')
const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
const setCrypto = value => Object.defineProperty(globalThis, 'crypto', { configurable: true, value })
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
try {
  const native = { randomUUID() { assert.equal(this, native); return 'native-result' }, getRandomValues() { throw new Error('Unexpected fallback') } }
  setCrypto(native)
  assert.equal(browserUUID(), 'native-result')
  // Simulate HTTP: randomUUID absent, real cryptographic random bytes available.
  const httpCrypto = { getRandomValues(array) { assert.equal(this, httpCrypto); return webcrypto.getRandomValues(array) } }
  setCrypto(httpCrypto)
  const tokens = Array.from({ length: 1000 }, () => browserUUID())
  for (const token of tokens) assert.match(token, uuidV4)
  assert.equal(new Set(tokens).size, tokens.length)
  for (const byte of [0, 255]) {
    setCrypto({ getRandomValues(array) { assert.equal(array.length, 16); return array.fill(byte) } })
    assert.equal(browserUUID(), byte === 0 ? '00000000-0000-4000-8000-000000000000' : 'ffffffff-ffff-4fff-bfff-ffffffffffff')
  }
  setCrypto(undefined)
  assert.throws(() => browserUUID(), /Secure randomness unavailable/)
  setCrypto({})
  assert.throws(() => browserUUID(), /Secure randomness unavailable/)
  console.log('PASS native UUID, HTTP fallback, UUID v4 format/variant, unique tokens and fail-closed randomness')
} finally {
  if (original) Object.defineProperty(globalThis, 'crypto', original)
  else delete globalThis.crypto
}

const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.TEST_BASE_URL || 'http://localhost:3000'
const email = process.env.TEST_LOGIN_EMAIL || 'anna@demo.com'
const password = process.env.TEST_LOGIN_PASSWORD || 'password123'

async function main() {
  const browser = await chromium.launch({ channel: process.env.TEST_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    const requests = []
    const context = await browser.newContext()
    context.on('request', request => requests.push({ url: request.url(), method: request.method() }))
    const page = await context.newPage()
    await page.goto(base + '/login')
    await page.locator('#login-email').waitFor({ state: 'visible' })
    await page.waitForFunction(() => !document.querySelector('fieldset').disabled)
    assert.equal(await page.locator('form').getAttribute('method'), 'post')
    await page.locator('#login-email').fill(email)
    await page.locator('#login-password').fill('invalid-local-login-test')
    await page.getByRole('button', { name: 'Logga in', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'Fel e-post eller lösenord.' }).waitFor()
    assert.equal(new URL(page.url()).pathname, '/login')
    assert(!(await (await context.request.get(base + '/api/auth/session')).json()).user)
    console.log('PASS invalid credentials show an error and do not create a session')

    await page.locator('#login-password').fill(password)
    await page.locator('#login-password').press('Enter')
    await page.waitForURL('**/home')
    const session = await (await context.request.get(base + '/api/auth/session')).json()
    assert(session.user?.id)
    assert.equal(session.user.email, email)
    assert(!('password' in session.user))
    assert(requests.some(r => new URL(r.url).pathname === '/api/auth/callback/credentials' && r.method === 'POST'))
    for (const request of requests) {
      const url = new URL(request.url)
      assert(!url.searchParams.has('email') && !url.searchParams.has('password'), 'Credential query parameter detected')
      const decoded = decodeURIComponent(request.url)
      assert(!decoded.includes(email) && !decoded.includes(password) && !decoded.includes('invalid-local-login-test'), 'Credential value detected in request URL')
    }
    console.log('PASS existing local account authenticates through NextAuth POST and redirects to /home; URLs contain no credentials')
    await context.close()

    const noJs = await browser.newContext({ javaScriptEnabled: false })
    const fallback = await noJs.newPage()
    await fallback.goto(base + '/login')
    if (await fallback.locator('form').count() === 0) {
      // Production useSearchParams suspends to client rendering. With JS off,
      // no credential controls may be exposed by that fallback.
      assert((await fallback.content()).includes('BAILOUT_TO_CLIENT_SIDE_RENDERING'))
      assert.equal(await fallback.locator('input[name="email"], input[name="password"]').count(), 0)
      console.log('PASS no-JavaScript production fallback exposes no credential inputs or form')
    } else {
    assert.equal(await fallback.locator('form').getAttribute('method'), 'post')
    assert(await fallback.locator('#login-email').isDisabled())
    assert(await fallback.locator('#login-password').isDisabled())
    assert(await fallback.getByRole('button', { name: 'Logga in', exact: true }).isDisabled())
    assert((await fallback.locator('noscript').textContent()).includes('JavaScript krävs för säker inloggning.'))
    console.log('PASS unhydrated/no-JavaScript form fails closed with POST fallback')
    }
    await noJs.close()
  } finally { await browser.close() }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })

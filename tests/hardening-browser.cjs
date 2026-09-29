// Run against a QA server with the same disposable database as this process.
const assert = require('node:assert/strict')
assert.equal(process.env.LIVSKRAFT_INTAKE_TEST_DB, '1')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient(), ids = []
const base = process.env.TEST_BASE_URL || 'http://localhost:3107'

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    for (const language of ['sv', 'en']) {
      const en = language === 'en'
      const user = await prisma.user.create({ data: {
        name: 'Hardening QA', email: `hardening-${language}-${Date.now()}@example.invalid`,
        password: 'Disposable-hardening-123', mode: 'advanced',
        preferences: JSON.stringify({ language, primaryGoal: 'maintain', planningConfirmed: true }),
      } })
      ids.push(user.id)
      const context = await browser.newContext()
      const csrf = await (await context.request.get(base + '/api/auth/csrf')).json()
      await context.request.post(base + '/api/auth/callback/credentials', { form: {
        csrfToken: csrf.csrfToken, email: user.email, password: 'Disposable-hardening-123', json: 'true',
      } })
      assert.equal((await (await context.request.get(base + '/api/auth/session')).json()).user.id, user.id)
      // Persisted database preference must win even before hydration and over stale local storage.
      const noJs = await browser.newContext({ javaScriptEnabled: false, storageState: await context.storageState() })
      const ssr = await noJs.newPage()
      await ssr.goto(base + '/dashboard')
      assert.equal(await ssr.locator('html').getAttribute('lang'), language)
      assert.equal((await ssr.locator('.mobile-nav a').first().textContent()).trim(), en ? 'Home' : 'Hem')
      await noJs.close()
      const loginContext = await browser.newContext()
      const login = await loginContext.newPage()
      await login.goto(base + '/login')
      await login.waitForFunction(() => !document.querySelector('fieldset').disabled)
      await login.locator('#login-email').fill(user.email)
      await login.locator('#login-password').fill('Disposable-hardening-123')
      await login.getByRole('button', { name: 'Logga in', exact: true }).click()
      await login.waitForURL('**/home')
      await login.locator('.home-reference h1').waitFor()
      assert.equal(await login.locator('html').getAttribute('lang'), language)
      assert.equal((await login.locator('.mobile-nav a').first().textContent()).trim(), en ? 'Home' : 'Hem')
      await loginContext.close()
      await context.addInitScript(({ language }) => {
        localStorage.setItem('livskraft-language', language === 'en' ? 'sv' : 'en')
        window.__navLabels = []
        new MutationObserver(() => {
          const label = document.querySelector('.mobile-nav a')?.textContent.trim()
          if (label) window.__navLabels.push(label)
        }).observe(document, { childList: true, subtree: true, characterData: true })
      }, { language })
      const page = await context.newPage(), errors = []
      page.on('pageerror', error => errors.push(error.message))
      page.setDefaultTimeout(30000)
      for (const complete of [false, true]) {
        if (complete) await prisma.user.update({ where: { id: user.id }, data: {
          currentWeight: 80, height: 180, activityLevel: 'light', trainingLevel: 'beginner', trainingLocation: 'home',
        } })
        for (const width of [320, 375, 390]) {
          await page.setViewportSize({ width, height: 844 })
          for (const route of complete ? ['/home', '/dashboard', '/plan', '/meals', '/training', '/progress', '/coach', '/my-plan', '/profile', '/account'] : ['/home', '/dashboard', '/plan']) {
            await page.goto(base + route)
            await page.locator('.app-scroll h1').waitFor()
            await page.waitForLoadState('networkidle')
            assert.equal(await page.locator('html').getAttribute('lang'), language)
            assert((await page.evaluate(() => window.__navLabels)).every(label => label === (en ? 'Home' : 'Hem')), 'Locale flickered during hydration')
            const layout = await page.evaluate(() => {
              const content = document.querySelector('.app-scroll')
              const links = [...document.querySelectorAll('.mobile-nav a')].map(a => {
                const box = a.getBoundingClientRect()
                return { left: box.left, right: box.right, top: box.top, width: box.width, height: box.height, fits: a.scrollWidth <= a.clientWidth }
              })
              return { fits: document.documentElement.scrollWidth <= innerWidth && content.scrollWidth <= content.clientWidth, links }
            })
            assert(layout.fits, `${language} ${route} ${width} complete=${complete}: horizontal overflow`)
            layout.links.forEach((link, index) => {
              assert(link.left >= 0 && link.right <= width && link.width >= 44 && link.height >= 44 && link.fits)
              if (index) assert(link.left >= layout.links[index - 1].right && link.top === layout.links[0].top)
            })
            if (route === '/home') {
              await page.locator('.home-destination[href="/dashboard"]').click()
              await page.waitForURL('**/dashboard')
            }
            if (route === '/home' || route === '/dashboard') {
              const add = page.getByRole('button', { name: en ? 'Add own meal' : 'Lägg till egen måltid', exact: true })
              await add.click()
              await page.getByLabel(en ? 'Meal name' : 'Måltidens namn', { exact: true }).waitFor()
              await page.getByRole('button', { name: en ? 'Cancel' : 'Avbryt', exact: true }).click()
            }
            if (route === '/dashboard' && complete && width === 320) {
              const completeLabel = en ? 'Mark meal complete' : 'Markera måltid klar'
              const buttons = page.getByRole('button', { name: completeLabel, exact: true })
              const beforeCount = await buttons.count(), completeMeal = buttons.first()
              const failSave = route => route.request().method() === 'POST' && route.request().headers()['next-action'] ? route.abort() : route.continue()
              await page.route('**/dashboard', failSave)
              await completeMeal.click()
              await page.getByRole('alert').filter({ hasText: en ? 'Could not save the meal.' : 'Kunde inte spara måltiden.' }).waitFor()
              assert(await completeMeal.isEnabled())
              await page.unroute('**/dashboard', failSave)
              await completeMeal.click()
              await page.waitForFunction(({ label, count }) => [...document.querySelectorAll('.app-scroll button')].filter(button => button.textContent.trim() === label).length === count, { label: completeLabel, count: beforeCount - 1 })
              assert.notEqual((await prisma.dailyLog.findFirst({ where: { userId: user.id } })).mealsEaten, '[]')
            }
          }
        }
      }
      // Block browser storage: saving a language still persists to the database and updates the UI.
      await page.goto(base + '/account')
      const select = page.getByRole('combobox', { name: /^(Språk|Language)$/ })
      await page.waitForFunction(() => !document.querySelector('select[aria-label="Språk"], select[aria-label="Language"]').disabled)
      await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError') } })
      await select.selectOption(en ? 'sv' : 'en')
      await page.waitForFunction(value => document.documentElement.lang === value, en ? 'sv' : 'en')
      assert.equal(JSON.parse((await prisma.user.findUnique({ where: { id: user.id } })).preferences).language, en ? 'sv' : 'en')
      assert.deepEqual(errors, [])
      await context.close()
      console.log(`PASS ${language}: SSR locale, login, hydration, database precedence, blocked storage, 320/375/390px across ten routes, incomplete/complete Home/Today/Plan, own-meal access and completion failure/retry`)
    }
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => {
  await prisma.user.deleteMany({ where: { id: { in: ids } } })
  await prisma.$disconnect()
})

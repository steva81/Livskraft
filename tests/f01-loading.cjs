const assert = require("node:assert/strict")
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright")

const base = process.env.TEST_BASE_URL || "http://localhost:3000"
const email = process.env.TEST_LOGIN_EMAIL || "anna@demo.com"
const password = process.env.TEST_LOGIN_PASSWORD || "password123"

async function testRejectedInitialLoad(page, path, label, loadingPattern) {
  let blocked = false

  const handler = async (route) => {
    const request = route.request()

    if (
      request.method() === "POST" &&
      request.headers()["next-action"]
    ) {
      blocked = true
      await route.abort("failed")
      return
    }

    await route.continue()
  }

  await page.route("**/*", handler)
  await page.goto(base + path)

  const errorBox = page
    .locator("div.p-8.text-center.space-y-4")
    .filter({ has: page.getByRole("alert") })

  await errorBox.waitFor({ state: "visible" })

  assert.equal(blocked, true, `${label}: no server action was rejected`)

  assert.equal(
    await errorBox
      .getByRole("button", { name: /Försök igen|Try again/i })
      .isVisible(),
    true,
    `${label}: retry button missing`
  )

  const mainText = await page.locator(".app-scroll").innerText()

  assert.equal(
    loadingPattern.test(mainText),
    false,
    `${label}: page remained on loading state after rejected request`
  )

  await page.unroute("**/*", handler)

  await errorBox
    .getByRole("button", { name: /Försök igen|Try again/i })
    .click()

  // The error disappears when retry starts, so wait for actual page content.
  await page.locator(".app-scroll .app-page, .app-scroll .max-w-3xl").first()
    .waitFor({ state: "visible" })
  assert.equal(await errorBox.count(), 0, `${label}: retry still shows an error`)
  assert.equal(
    loadingPattern.test(await page.locator(".app-scroll").innerText()),
    false,
    `${label}: retry did not finish loading`
  )

  console.log(
    `PASS ${label}: rejected initial request settles and retry recovers`
  )
}

;(async () => {
  const browser = await chromium.launch({
    channel: process.env.TEST_BROWSER_CHANNEL || "msedge",
  })

  const context = await browser.newContext()
  const page = await context.newPage()

  page.setDefaultTimeout(90000)

  try {
    await page.goto(base + "/login")

    await page.waitForFunction(
      () => !document.querySelector("fieldset").disabled
    )

    await page.locator("#login-email").fill(email)
    await page.locator("#login-password").fill(password)

    await page
      .getByRole("button", { name: "Logga in", exact: true })
      .click()

    await page.waitForURL("**/home")

    await testRejectedInitialLoad(
      page,
      "/dashboard",
      "Today",
      /Laddar din dag|Loading your day/
    )

    await testRejectedInitialLoad(
      page,
      "/training",
      "Training",
      /Laddar träningsplan|Loading training/
    )

    console.log("PASS F01 failure/retry regression")
  } finally {
    await browser.close()
  }
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

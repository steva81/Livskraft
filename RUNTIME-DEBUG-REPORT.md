# Runtime loading regression — 2026-09-28

## Root cause and reproduction

Reproduced against the already running development server on http://localhost:3000 with the existing anna@demo.com account. Earlier preview/development and production-build runs shared the same `.next` output directory with that live server. Later runs replaced its on-disk manifests/chunks while the older server retained compiled route state in memory.

Browser Network and console showed HTTP 404 for these exact client bundles:

- `/_next/static/chunks/app/(app)/plan/page.js`
- `/_next/static/chunks/app/(app)/meals/page.js`
- `/_next/static/chunks/app/(app)/training/page.js`
- `/_next/static/chunks/app/(app)/progress/page.js`
- `/_next/static/chunks/app/(app)/coach/page.js`
- `/_next/static/chunks/app/(app)/my-plan/page.js`
- `/_next/static/chunks/app/(app)/profile/page.js`
- `/_next/static/chunks/app/(app)/account/page.js`

All eight files were also absent on disk. Home and Dashboard bundles still existed. The server process predated the rewritten manifests. Account appeared rendered because it contains substantial server-rendered markup, but its profile identity and interactive state were not loaded either.

This was not a database query or translation loop. Missing page JavaScript prevented hydration: `useMode()` consumers stayed at their initial session/loading display; My Plan's direct `useEffect(() => getUser()...)` did not run. Coach's session guard never advanced to its history/overview effects. The server-rendered default Swedish text remained visible. Home and Dashboard did hydrate and read the demo account's saved English preference. The remaining `getHomeOverview` request observed from a superseded Home navigation was not the common blocking request on the broken pages; the missing route bundles were.

Inspected LanguageProvider's session/profile effect, ModeProvider's profile effect, Localize cloning, navigation links, recent shell/shared-component diffs, and router refresh/replace calls. No automatic locale-saving or router-refresh loop was found. The nutrition refresh is user-triggered and unrelated.

## Fix

- `next.config.mjs`: separate live development (`.next-dev`), normal production (`.next`), QA development (`.next-qa-dev`), and QA production (`.next-qa`) outputs.
- `.gitignore`: ignore those generated outputs.
- `tsconfig.json`: Next added the corresponding generated type directories.
- `tests/runtime-output.cjs`: guards sibling output separation and matching build/start configurations.
- `tests/runtime-browser.cjs`: real browser checks for all ten authenticated routes in Swedish and English, sidebar navigation and reload, completed requests, console errors, credential URLs, and restoration of the original account language.
- `src/components/wellness-photo.tsx` and `src/components/welcome-collage.tsx`: serve the already optimized local WebP assets directly, without the redundant Next image-optimization request. Image files, crop styles and layout are unchanged.
- This report.

Changing the config automatically restarted the existing development server, rebuilding its client bundles in `.next-dev`. No source reset, generated-cache deletion, schema change, database repair, design change or image-asset change was needed. The prior login fix remains intact.

The first separate production smoke test exposed an additional pending-resource issue: two `/_next/image` requests for lifestyle images did not finish within the network deadline. Authenticated Training data rendered when checked directly; this was not the original missing-page-chunk failure. The repository already contains optimized WebP images, so the two image wrappers now use `unoptimized` to serve those exact files directly. No new image, dependency or visual styling was introduced. This removes that pending optimization step in production.

For future QA, use PowerShell `$env:LIVSKRAFT_QA='1'` for both `npm run build` and `npm run start -- --port 3006`, or for a separate QA `npm run dev`. Normal `npm run dev` remains on the live development output. Do not run two servers against the same output directory. Stop a production server before rebuilding its own directory; use the QA output for verification alongside it.

## Verification

The browser test uses the existing local demo account, not an invented session. Its profile is incomplete, so Week Plan correctly renders the profile-readiness prompt rather than generating or altering the user's plan. No profile fields or health data were changed. Language was deliberately selected through Account for the test and restored to its original value in `finally`.

Verified `/home`, `/dashboard`, `/plan`, `/meals`, `/training`, `/progress`, `/coach`, `/my-plan`, `/profile`, `/account` using both sidebar navigation and full reloads in each language. All 40 live-development checks passed. All page data completed, Swedish/English remained selected across navigation, no redirect/locale loop or console runtime error remained, and no missing client bundle or pending data request remained. Screenshots and network summaries are saved outside the repository in the task visualization directory.

The network recorder distinguishes real failures from Next router cancellations of already successful HTTP 200 Flight streams and superseded document navigations. These cancellations are recorded separately, not silently counted as successful data requests. No HTTP failure or unresolved data request remained at each completed page check.

Targeted login browser regression PASS: existing account -> `/home`, invalid password -> error, NextAuth POST, no credential URL, pre-hydration/no-JavaScript form disabled. Existing `npm run test:http` PASS: protected routes, two isolated sessions, context isolation, logout/relogin and credential-version invalidation. Temporary HTTP-test accounts were cleaned by the existing suite.

Output-isolation test, ESLint and TypeScript PASS. An isolated QA production build PASS while the live development browser tests continued, directly verifying that a build no longer removes the live route bundles. Webpack emitted the existing non-blocking cache-snapshot warnings.

## Final production verification — 2026-09-29

The resumed production run on localhost:3006 completed: **40/40 PASS** (all ten routes above, Swedish and English, sidebar navigation and full reload). The final evidence JSON contains 40 results, zero errors, zero failures and zero pending requests. No endless loader, missing JS chunk/404, locale-switching loop or redirect loop remained. The original account language was restored.

Final targeted checks:
- `node tests/runtime-browser.cjs`: PASS, production 40/40.
- `node tests/login-browser.cjs`: PASS, production invalid credentials, existing demo account login, NextAuth POST, /home redirect and credential-safe URLs.
- JavaScript-disabled production login intentionally has no form because the existing useSearchParams/Suspense boundary uses client rendering. The test was corrected to verify that this fallback exposes no credential inputs; the server-rendered branch still verifies disabled controls and POST. The initial test timeout was an incorrect assumption that production must render a form without JavaScript, not a failed normal login. No application code was changed during this final verification.
- `npm run test:http`: PASS, production protected-route/session isolation and validation regression suite.
- `node tests/runtime-output.cjs`: PASS.
- `npm run lint`: PASS, no warnings/errors.
- `npm run typecheck`: PASS.
- Isolated production build: PASS, completed before this resumed verification; no application-source changes since that build.
- `git diff --check`: PASS; Git only reported line-ending normalization notices.

Login regression files: `src/app/login/page.tsx` and `tests/login-browser.cjs`. The form previously defaulted to GET when its JavaScript handler was unavailable. Explicit POST plus disabled pre-hydration controls prevents that credential-URL fallback while retaining NextAuth.

Exact runtime/login fix and verification files: `.gitignore`, `next.config.mjs`, `tsconfig.json`, `src/app/login/page.tsx`, `src/components/wellness-photo.tsx`, `src/components/welcome-collage.tsx`, `tests/login-browser.cjs`, `tests/runtime-browser.cjs`, `tests/runtime-output.cjs`, and `RUNTIME-DEBUG-REPORT.md`.

Removed only the disposable `.tmp-prod-dashboard.cjs` diagnostic script. Existing design edits, wellness assets, schema and user data remain intact. The existing demo profile is incomplete: Week Plan correctly shows its profile-readiness prompt. Verification does not claim to exercise a completed personalized plan for this account.

The working tree is technically ready for a checkpoint commit based on these targeted results. No commit or push was performed. All existing design changes remain part of the uncommitted checkpoint scope.

## Final git status

Branch: main. Nothing staged.

```
 M .gitignore
 M UI-POLISH-REPORT.md
 M next.config.mjs
 M src/app/(app)/account/page.tsx
 M src/app/(app)/coach/page.tsx
 M src/app/(app)/dashboard/page.tsx
 M src/app/(app)/home/page.tsx
 M src/app/(app)/layout.tsx
 M src/app/(app)/meals/page.tsx
 M src/app/(app)/my-plan/page.tsx
 M src/app/(app)/plan/page.tsx
 M src/app/(app)/profile/page.tsx
 M src/app/(app)/progress/page.tsx
 M src/app/(app)/training/page.tsx
 M src/app/globals.css
 M src/app/login/page.tsx
 M src/app/onboarding/page.tsx
 M src/app/page.tsx
 M src/components/ModeControl.tsx
 M src/components/body-data.tsx
 M src/components/goal-editor.tsx
 M src/components/goal-summary.tsx
 M src/components/nutrition-balance.tsx
 M src/components/ui/button.tsx
 M src/components/ui/card.tsx
 M src/components/weekly-nutrition.tsx
 M tsconfig.json
?? RUNTIME-DEBUG-REPORT.md
?? public/images/lifestyle/README.md
?? public/images/lifestyle/balance.webp
?? public/images/lifestyle/calm.webp
?? public/images/lifestyle/cooking.webp
?? public/images/lifestyle/meal.webp
?? public/images/lifestyle/outdoors.webp
?? public/images/lifestyle/strength.webp
?? src/components/lifestyle-mosaic.tsx
?? src/components/page-heading.tsx
?? src/components/welcome-collage.module.css
?? src/components/welcome-collage.tsx
?? src/components/wellness-photo.tsx
?? tests/login-browser.cjs
?? tests/runtime-browser.cjs
?? tests/runtime-output.cjs
```

# Livskraft final technical hardening

Date: 2026-09-29. Starting HEAD: `07f8a0c`. Starting `git status --short`: empty (clean).

## Scope and safeguards

Audited authentication, public server actions, ownership, readiness, Today, weekly planning, own/consumed meals, photo analysis and persistence, weight/history, localization, mobile navigation and existing tests before editing. Existing visual design, hero assets, routes, packages, schema, Gemini model configuration and `.env` files were preserved. No migration, commit or push.

Tests used newly created disposable SQLite databases, never the working application database. `prisma db push --skip-generate` initialized those test databases from the unchanged schema; the main QA database was seeded with synthetic demo/library data. The intake test used a separate empty catalog because it creates its own recipes. QA build output was isolated with `LIVSKRAFT_QA=1`; the production QA server used port 3107. Process-local environment overrides did not edit any environment file.

## Fixed

| Problem | Exact behavior change | Coverage |
| --- | --- | --- |
| Authenticated reload initially rendered Swedish before reading saved English | Root layout reads the authenticated user's language on the server and seeds both session and locale providers. HTML `lang` and the first client render agree. Only preferences are selected for this read. Account transitions wait for their locale. | New SSR-with-JavaScript-disabled, login, hydration and stale-localStorage browser checks; existing two-language route checks |
| Browser storage errors could break language saving after a successful database update | localStorage reads/writes are best effort; authenticated database preference remains authoritative | New browser storage-blocking check |
| Weekly-plan load failure could appear as an empty plan or reveal an old week | Separate load error and explicit retry; stale async responses are ignored, stale plan ID cleared when no plan is returned | Extended F01 browser failure/retry suite |
| Concurrent meal completions could overwrite another completion | Read/append/write occurs within one SQLite transaction, scoped to the authenticated user and the daily log's date | Intake regression synchronizes both callers on the same old snapshot and verifies both records survive |
| Failed meal completion had an unhandled rejection | Completion buttons are disabled while saving; failure is visible in Swedish/English and can be retried | New browser fault-injection/retry check |
| Concurrent first weekly-plan reads could replace a newly created week and its IDs | Generator rechecks inside the creation transaction and reuses a complete calendar week, preserving saved choices; malformed weeks still follow existing repair rules | Beta regression checks identical week/day IDs and one stored week; existing repair, overrides and adaptive tests |
| English Coach ignored explicit gym requests | Explicit English `gym` and `home` requests override the saved location, using the existing duration/level/equipment filters | Refinements regression in both directions |
| Older test fixtures no longer matched current behavior | Refinements uses completed profiles, a real GET request and explicit session window, and current no-compensation wording. Loading tests wait for page headings instead of old layout wrappers. | Updated suites |

## Intentionally not changed

- **Mobile navigation:** kept its four tabs. Home already provides the Food & nutrition card to `/dashboard`, even for incomplete profiles, and a direct next-step link for completed profiles. Adding a fifth tab was unnecessary.
- **Weight and nutrition contract:** current planning weight remains `User.currentWeight`. Baseline edits preserve dated records; explicit Progress measurements update today's measurement and current state. Unknown nutrition remains unknown. The existing nutrition estimator excludes weights above 250 kg although profile validation accepts up to 400 kg; some otherwise-ready profiles therefore have no numeric target. This limitation needs an explicit product decision and explanation, not an unreviewed expansion of nutritional estimates.
- **Signed-out locale:** public pages still start with the default language before reading a guest's localStorage. There is no server-readable guest language cookie. The authenticated database-preference flicker is addressed without changing guest persistence architecture.
- **Failure recovery beyond the fixed paths:** some Home/Profile/Progress failures still use reload instructions instead of inline retry. If the post-login preference fetch fails, the existing Swedish fallback remains. A broader error-boundary/localization migration was not introduced.
- **Stored legacy JSON:** adaptive summaries still assume server-written valid JSON in some paths. Corrupted database records require recovery work; no arbitrary replacement of historical records was added.
- **Actual provider availability:** valid Gemini configuration is present, but no real image was sent to Google during this pass. Provider parsing, transport failures, timeouts, bounded payloads and retries were tested with mocks. A live-provider presentation remains subject to the provider's credentials, quota and availability.

## Production-only follow-up / security and privacy

- Add deployment-level/application-level throttling for login, registration and paid AI requests; no distributed limits are present in the reviewed application paths.
- Keep publicly documented demo credentials and synthetic demo data separate from real personal accounts. Gate demo seeding/display before public deployment. Legacy plaintext passwords still have the existing login-time migration path.
- The optional external Coach classifier is **disabled in the inspected configuration**. If enabled, its existing implementation forwards question/history and limited context; consent/disclosure and data minimization require review before using it with real data. This is separate from Gemini photo logging.
- Dates still use server local time. This QA host uses `Europe/Stockholm`; multi-timezone deployment needs a deliberate user-timezone contract.
- Review hosting security, account recovery/deletion, backups, dependency advisories and resilience under load before public production. These were not deployment-certified here.
- No cross-user access was found in the reviewed/tested actions and API paths. Tests verify authenticated ownership, ignored client-supplied user IDs, password/session invalidation, own-meal isolation and per-user photo-save tokens.
- Photo selection stays local until Analyze. Client canvas resizing/re-encoding removes source metadata; transmitted bytes are bounded. The authenticated same-origin endpoint sends only the image, language and fixed food prompt to Gemini. Provider keys stay server-side; profile, health and Coach history are excluded. Strict finite/bounded values are recomputed from items, review precedes explicit save, retries are idempotent, and only reviewed text/nutrients are stored. No image field or image persistence was introduced. This describes Livskraft storage, not Google's retention policy.

## Tests and results

Executed `npm run typecheck`, `npm run lint`, `git diff --check` and production `npm run build` with `LIVSKRAFT_QA=1`. Builds completed successfully; webpack emitted non-fatal cache snapshot warnings. Root session initialization makes the pages dynamically server-rendered, an intentional tradeoff for authenticated first-render language consistency.

Executed existing script bodies directly as `node tests/<name>.cjs`:

| Suite | Result |
| --- | --- |
| beta | PASS, including 14 groups and concurrent first-plan regression |
| product | PASS |
| goal-safety | PASS |
| phase | PASS |
| refinement | PASS |
| refinements | PASS after updating stale fixtures/expectations |
| next-phase | PASS |
| mobile-refinement | PASS |
| f07-weight | PASS |
| f06-preferences | PASS |
| photo-meals | PASS, including strict provider parsing, privacy, auth/origin, bounds, review persistence, concurrent/repeated saves, intake and Coach |
| meal-intake | PASS on its separate empty-catalog database, including concurrent completions |
| dietary-fish | PASS |
| runtime-output | PASS |
| http | PASS, real NextAuth sessions, protected pages, ownership and validation |
| login-browser | PASS, invalid/valid login, credential-safe URLs, no-JavaScript fail-closed form |
| photo-meals-browser | PASS in Swedish and English, explicit analysis, failure/retry, replacement/removal, review edits, save retry, unavailable provider and mobile overflow |
| f01-loading | PASS: Today, Training and Weekly plan rejected initial load and successful retry |
| runtime-browser | Earlier run passed all 40 route/locale/client-navigation/reload checks. Both final-build attempts failed after the Swedish Training checks: the request tracker retained `/images/lifestyle/progress.png`; cleanup could not restore the synthetic demo user's language. Not claimed as a final-build pass. |
| hardening-browser (new) | PASS in both languages: authenticated SSR, login, hydration, database precedence, blocked localStorage, all ten authenticated routes at 320/375/390 px, incomplete Home/Today/Plan, own-meal access and meal-completion failure/retry |

Browser automation uses bundled Playwright and local headless Microsoft Edge; no new package was installed. It is viewport testing, not a physical iOS/Android camera/browser certification. No external AI endpoint was invoked by these tests.

The final desktop runtime-suite stall remains unresolved. A separate request to the unchanged Progress image returned HTTP 200, 2,492,510 bytes, in 132 ms. The new mobile suite passed Progress and all nine other authenticated routes at all three widths in both languages on the final build, with no page errors. This does not prove the desktop stall is only a test-harness issue; retain it as a known verification limitation. No image was changed to work around it. Per the final user instruction, no additional exploratory testing or broad audit was started.

Initial failures were investigated rather than changing product rules: `refinements` assumed planning without a completed profile and an obsolete Coach request/session contract; `meal-intake` assumed its two fixture recipes were the whole catalog, so it was rerun in its intended empty-catalog database. The new browser save-retry check initially observed state before completion; it now waits for the completed-meal UI before checking persistence. Prisma initially failed to create a new SQLite file; creating the empty disposable file first resolved setup without changing the application database.

## Exact changed files

1. `src/app/(app)/dashboard/page.tsx` — meal completion pending/error handling.
2. `src/app/(app)/plan/page.tsx` — loading failure/retry and stale-response handling.
3. `src/app/actions.ts` — atomic consumed-meal append.
4. `src/app/layout.tsx` — authenticated server locale initialization.
5. `src/lib/coach-service.ts` — English gym-location handling.
6. `src/lib/i18n/provider.tsx` — seeded locale, account-transition handling and optional browser storage.
7. `src/lib/plan-generator.ts` — transaction-local existing-week check.
8. `src/lib/providers.tsx` — server session/locale props.
9. `tests/beta.cjs` — concurrent first-plan regression.
10. `tests/f01-loading.cjs` — current heading selector and weekly-plan retry coverage.
11. `tests/meal-intake.cjs` — synchronized concurrent-completion regression.
12. `tests/refinements.cjs` — current fixtures/contracts and English location regression.
13. `tests/hardening-browser.cjs` — new SSR/locale, storage, mobile, readiness and completion-retry coverage.
14. `FINAL-HARDENING-REPORT.md` — this report.

## Final status and conclusion

**READY FOR PRESENTATION / READY FOR BETA WITH KNOWN LIMITATIONS**, for a supervised local/private beta under the constraints above. This is not public-production approval.

- Remaining confirmed presentation blockers: **none found**. Live Gemini service success was not exercised; check credentials/quota before relying on a live external-AI demonstration.
- Remaining confirmed beta blockers in the tested local scope: **none found**. Guest locale initialization, nutritional-estimator bounds, reload-only error recovery, server-timezone assumptions and the desktop runtime-suite qualification remain limitations.
- Minimum final checks: `npx tsc --noEmit`, `npm run lint`, and `git diff --check` completed without errors. Git emitted only line-ending conversion notices. Relevant regressions and the final production build passed as listed above.
- Current work is preserved and uncommitted. No push. No application database or hero-image changes. Ignored QA databases/build artifacts remain local; the QA server is stopped at completion.

Final `git status --short`:

```text
 M src/app/(app)/dashboard/page.tsx
 M src/app/(app)/plan/page.tsx
 M src/app/actions.ts
 M src/app/layout.tsx
 M src/lib/coach-service.ts
 M src/lib/i18n/provider.tsx
 M src/lib/plan-generator.ts
 M src/lib/providers.tsx
 M tests/beta.cjs
 M tests/f01-loading.cjs
 M tests/meal-intake.cjs
 M tests/refinements.cjs
?? FINAL-HARDENING-REPORT.md
?? tests/hardening-browser.cjs
```

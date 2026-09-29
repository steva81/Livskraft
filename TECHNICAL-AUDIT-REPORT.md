# Livskraft technical product audit

Audit date: 2026-09-29. Checkpoint: `d41f68d` — `Stabilize runtime and refresh Livskraft UI`, branch `main`.

## 1. Executive summary

The checkpoint was clean at the start. This audit changes only this report. No application code, schema, assets, existing user records, configuration or tests were edited. No commit or push was performed. Git HEAD was verified locally; the remote was not fetched to independently verify push status.

**18 unique findings: 0 Critical, 5 High, 11 Medium, 2 Low.** Classification: 8 confirmed bugs, 8 confirmed technical risks, 1 test-coverage gap and 1 improvement only. References to an ID in multiple sections do not count as additional findings.

The previous build-output and credential-URL fixes remain present. The checkpoint is a useful, recoverable development baseline, with previously verified normal-route behavior. It is **not an unconditional production-readiness sign-off**: failure recovery, consumed-meal integrity, allergy filtering and deployment authentication controls need attention before expansion or public release.

### Method and limits

- Static inspection of all requested functional areas, public server actions, authentication/middleware, providers, schema, seed data, pure engines, page effects, shared components and existing test suites.
- Executed `node tests/product.cjs`: PASS, all four groups (shopping quantities, equipment constraints, activity/schedule guidance, seeded recipe instructions).
- Executed `node tests/runtime-output.cjs`: PASS, four isolated build directories and matching build/start configuration.
- Executed in-memory Node/ts-node probes, without saving scripts or touching the database: confirmed preference fallback, readiness/energy range mismatch, fish-allergy token omissions and English Coach gym intent. Also checked all four goal modes with optional body data omitted, unknown nutrition and an extreme-pace block: PASS for those safeguards.
- Read the existing production login HTML: it contains `BAILOUT_TO_CLIENT_SIDE_RENDERING`, consistent with the previously observed no-JavaScript fallback.
- Attempted a browser failure-path check at `http://localhost:3000`; connection was refused before login. No browser fault-injection results are claimed. No server/build was started during this audit.
- The earlier 40 production route/locale/navigation/reload checks, login checks, HTTP suite, lint, TypeScript and production build are historical evidence in `RUNTIME-DEBUG-REPORT.md`, **not rerun results from this audit**. They establish healthy-path coverage, not the fault/concurrency cases below.
- Database-writing suites were inspected but not rerun against the user's database. No external AI endpoint was called. No secret values or user health records were inspected or copied. No live attack, brute-force or exploitation testing was performed.
- No new dependency-advisory scan, hosting configuration inspection, clinical validation or physical-device/browser-matrix test was performed. Absence of a finding is not certification of those areas.

### Finding register

| ID | Severity | Classification | Finding |
|---|---|---|---|
| F01 | High | Confirmed bug | Rejected initial Today/Training requests leave loaders active |
| F02 | High | Confirmed bug | Editing today's plan can remove already consumed meals from intake totals |
| F03 | High | Confirmed bug | Fish-allergy filtering accepts unrecognized fish names |
| F04 | High | Confirmed technical risk | No application-level authentication throttling |
| F05 | High | Confirmed technical risk | Shared demo credentials and seed are not production-gated |
| F06 | Medium | Confirmed bug | One invalid preference resets the entire preference object |
| F07 | Medium | Confirmed bug | Baseline weight edits and dated measurement history diverge |
| F08 | Medium | Confirmed technical risk | Concurrent meal completion can lose a recorded completion |
| F09 | Medium | Confirmed technical risk | Concurrent first-plan reads can replace a just-created plan |
| F10 | Medium | Confirmed technical risk | Day/week attribution depends on server timezone |
| F11 | Medium | Confirmed bug | Production login gives no usable no-JavaScript explanation |
| F12 | Medium | Confirmed technical risk | Locale read failure silently falls back to Swedish without recovery |
| F13 | Medium | Confirmed bug | English Coach ignores explicit gym location |
| F14 | Medium | Confirmed technical risk | Unguarded stored JSON parsing can crash complete pages |
| F15 | Low | Improvement only | Repeated profile/library reads and weekly nutrition query fan-out |
| F16 | Low | Confirmed bug | Ready profiles above 250 kg silently lose nutrition targets |
| F17 | Medium | Test-coverage gap | Happy-path suite does not cover key failure, data and concurrency cases |
| F18 | Medium | Confirmed technical risk | Optional external classifier forwards conversation/context without a user-level consent gate |

## 2. Confirmed bugs

Confirmed bugs are F01, F02, F03, F06, F07, F11, F13 and F16. “Confirmed” means demonstrated by a deterministic pure-function probe, existing generated HTML, or a directly traceable code path; it does not mean each was exercised against persisted user data.

The most consequential new distinction is F01: the prior missing-chunk incident is fixed, but separate request-rejection paths can still cause endless loading. These must not be conflated.

## 3. Security/auth findings

### F04 — High / confirmed technical risk: missing application-level throttling

Evidence: `src/lib/auth.ts:16` (`authorize`), `src/lib/password.ts:6`, `src/app/actions.ts:117` (`submitOnboarding`), `src/app/api/auth/[...nextauth]/route.ts`, `src/middleware.ts`.

The inspected application has no attempt counter, backoff or rate-limit gate before authentication database lookups/password verification or registration hashing. Invalid credentials return a generic failure, but requests still consume database and scrypt work. Deployment-edge throttling was not available for inspection, so this is an application-layer gap, not a claim that a deployed perimeter is absent or compromised. Verify hosting controls and add bounded abuse protection before public exposure. No attack reproduction was attempted.

### F05 — High / confirmed technical risk: production is not separated from the demo account

Evidence: `prisma/seed.ts:14`, `prisma/seed.ts:18`, `prisma/seed.ts:278`, `src/app/login/page.tsx:53`.

The seed creates a shared account with a fixed publicly displayed password, and login displays that account without a production/demo guard. If this seed and login are deployed together, every visitor knows the same account credential; that account cannot provide private per-person storage. This is not evidence of access to other users. Keep the shared demo explicitly isolated from real accounts and real health data, and gate its seed/display before a public deployment. Inspection, not remote testing, established the risk.

### F11 — Medium / confirmed bug: no-JavaScript production login is blank at the form boundary

Evidence: `src/app/login/page.tsx:18`, `src/app/login/page.tsx:95`, `src/app/login/page.tsx:105`; existing `.next-qa/server/app/login.html` client-rendering bailout marker.

`useSearchParams` is below a Suspense boundary with no fallback. The helpful `noscript` explanation is inside the component that production does not render without JavaScript. Consequently users with unavailable JS receive neither the login form nor that explanation. This remains credential-safe: it exposes no native GET credential form. Reproduction: open a production `/login` with JS disabled; expected improvement is a visible explanation/recovery path, not a new authentication mechanism. Delayed-JS safety is also supported by the disabled fieldset until hydration; delayed-JS usability is not covered by the existing test.

### Safeguards verified by inspection

- Login explicitly uses `method="post"`, prevents normal form submission, and disables controls before hydration; it retains NextAuth credentials POST and `/home` redirect behavior.
- App layout checks `getAuthenticatedUserId` in addition to middleware. Password changes alter the credential-version digest; server session callbacks reject the old user ID. Middleware alone is not the final authorization boundary.
- Public user mapping excludes the password. Password hashing uses random salts, scrypt and timing-safe verification; legacy plaintext support remains solely as a migration path. This audit did not inspect whether any live legacy rows remain.
- Own-meal edits/deletes, shopping checks, adaptive changes and plan mutations derive identity from the session and scope writes by ownership. No confirmed client-supplied-user-ID authorization bypass was found in the reviewed paths.
- `.env` and `.env*.local` are ignored; only `.env.example` is tracked among environment files. Provider secrets are read in server code. This is not a full history/secret scan. Other environment filenames still require normal pre-commit review.
- Logout uses NextAuth signOut. Existing HTTP tests cover session isolation and credential-version invalidation; no fresh logout/session-restore browser run was possible in this audit.

## 4. Data-integrity findings

### F06 — Medium / confirmed bug: all-or-nothing preference fallback

Evidence: `src/lib/preferences.ts:32`, `src/lib/preferences.ts:36`, `src/lib/body-data.ts:2`, `src/app/actions.ts:530` (`savePreferences`).

`readPreferences` merges defaults, validates the entire object, and returns all defaults if any field fails. An optional birth year that ages beyond the accepted range can therefore reset the interpreted language, health preference, primary goal and confirmation flag together. A subsequent preference save can persist the reset object. The pure probe supplied otherwise valid English/type1/maintain preferences with an out-of-range birth year and observed Swedish/none/no goal. No stored user was modified.

Use field-level validation/migration and preserve unrelated valid choices. Make corrupt/legacy fields visible for correction. The readiness flag usually prevents fabricated personalized targets after the reset, but the silent loss of valid profile meaning remains a bug.

### F07 — Medium / confirmed bug: two weight-writing paths have different history semantics

Evidence: `src/app/nutrition-actions.ts:55–63` (`saveBodyData`), `src/app/actions.ts:430–449` (`saveMeasurements`), `src/app/actions.ts:348–350` (`getProgressSummary`).

My Plan/Profile baseline editing changes `User.currentWeight` but does not update/create a dated weight log. Progress logging updates both. Progress takes its current value from User but calculates averages/chart points from DailyLog. Entering a new current weight under Body and baseline data therefore changes energy/Coach/current-weight displays while the trend excludes that measurement. If this field is intended as a correction rather than a measurement, the UI/data contract needs to say so explicitly. Reproduction through normal UI: change current weight there, then compare Progress's current value and today's dated point. This is a static trace, not a write performed during audit.

### F08 — Medium / confirmed technical risk: completion read/modify/write race

Evidence: `src/app/actions.ts:467–476` (`completeMeal`).

Completion reads `mealsEaten`, adds one key in memory, and replaces the complete JSON value. Two tabs completing different meals from the same starting log can each overwrite the other. Unlike plan decisions, there is no version predicate or serialized read/update around this operation. Verify using isolated test data, then introduce an atomic or conflict-checked write. No concurrent writes were attempted on real data.

Readiness checks explicitly require weight, height, goal, activity, training level/location and confirmed planning choices. Birth year/sex remain optional and estimates identify the fallback method. Initial practical defaults are shown for confirmation rather than automatically establishing readiness. Health/diet preferences, budget and work schedule are validated and used by selection/guidance, subject to F03/F06. Existing readiness is a shared rule, which is a strength.

## 5. Goal Safety findings

All four goal modes are represented in onboarding, editor, nutrition, Coach and progress guidance. Static inspection and pure checks confirm distinct maintain/retain-muscle/build-muscle/lose guidance; optional birth year/sex produce a labelled lower-confidence heuristic rather than invented age/sex. Maintain modes remove target/deadline through the goal editor. Extreme pace blocks plan generation, nutrition targets and Coach; aggressive pace produces warnings. No exercise-calorie add-back or explicit punishment/fasting prescription was found in the reviewed engine.

Coverage limitation, included in **F17**: the safety function accepts current weight, target and duration only. It is a pace/range guard, not a complete assessment of the target in relation to height or individual health. Do not describe passing it as clinical clearance. Also test goal direction after a later weight edit crosses the target: goal editing validates direction, whereas subsequent weight-writing paths do not re-run that direction rule. No clinical thresholds are proposed in this code audit.

Nutrition/weekly proposals require explicit decisions; stored recipe swaps have before-value conflict checks. F02/F06/F07/F10 affect the reliability of inputs even where the proposal decision flow is sound.

## 6. Nutrition findings

### F02 — High / confirmed bug: consumed totals depend on a mutable plan

Evidence: `src/app/actions.ts:574–592` (`saveMyPlan`, including dates `gte:todayDate()`), `src/app/actions.ts:543–560` (`selectPlanMeals`), `src/lib/daily-nutrition.ts:19–27`.

Completion records a slot/recipe key, but consumption is computed only by intersecting those keys with the **current** planned meals. Saving planning preferences rebuilds today's meal choices as well as future days, without protecting already completed meals. Changing today's selected slots can also remove a completed slot. The old completion key remains stored but is no longer counted. Thus nutrition history can change without deleting the completion record.

Normal-flow reproduction on disposable data: complete a planned meal; change today's slots or a preference that selects a different recipe; compare consumed totals before/after. A completed meal should remain an intake fact even if future recommendations change. Preserve consumed entries independently of mutable plan selection; do not rewrite already eaten meals. The audit confirmed the code path, not a database mutation.

### F16 — Low / confirmed bug: supported-weight ranges disagree

Evidence: `src/lib/profile-readiness.ts:9`, `src/lib/onboarding-validation.ts:11`, `src/lib/nutrition.ts:19`, `src/components/daily-nutrition.tsx:31–38`.

Profile validation/readiness permits up to 400 kg, but nutrition targets return null above 250 kg. An otherwise complete 260 kg synthetic profile was ready but had no target. A conservative target limitation may be intentional; the defect is the inconsistent supported-range contract and lack of an explicit reason when targets disappear. Explain the limit rather than expanding formulas without appropriate review.

Nutrition parsing preserves unknown values as null. Totals record unknown counts; screens show incomplete estimates, and missing energy prevents ordinary intake-based adaptation. Mifflin inputs and coefficients are explicit; baseline-less profiles use a labelled weight heuristic. Activity/training are blended instead of adding workout calories on top. Simple mode suppresses most numbers, while Advanced shows estimates. Own-meal update/delete ownership is scoped and values are validated. Photo analysis is explicitly unavailable; the current provider does not manufacture nutrition and manual review remains required. These are verified implementation properties, not independent validation of nutrition science or recipe nutrient provenance.

## 7. Week Plan / Recipes / Shopping findings

### F03 — High / confirmed bug: recognized allergy category, incomplete ingredient vocabulary

Evidence: `src/lib/dietary.ts:106–120`; downstream consumers `src/app/actions.ts:220` (`getRecommendedRecipes`), `src/lib/plan-generator.ts:32–35`, `src/lib/coach-service.ts:49` (`safeRecipes`).

The fish-allergy vocabulary checks a small list of substrings. A synthetic recipe containing `200 g sej` or `200 g öring` passes `allergy:fisk`; both results were reproduced with the pure filter. No corresponding currently seeded recipe was found, so this is a confirmed engine defect with conditional current-library exposure, not evidence that an existing user received one of these recipes.

Unknown allergy names fail closed, but recognized categories do not establish that every ingredient's allergen status is known. Expand structured allergen metadata/validation and fail closed when safety is uncertain; a label-check reminder does not make the predicate correct. Add library-level audit tests, not only a few positive/negative tokens.

### F09 — Medium / confirmed technical risk: non-atomic get-or-create weekly plan

Evidence: `src/app/actions.ts:269–308`, `src/lib/plan-generator.ts:59–67`, `prisma/schema.prisma:93`.

`getWeeklyPlan` checks for an existing plan outside the generator transaction. If two callers both see none, the second generator can delete the overlapping plan just produced by the first, then create another identity. The earlier caller may retain obsolete plan/day IDs, with cascading shopping-check loss possible if interaction has started. WeeklyPlan has no unique user/start-date constraint. This is a static concurrency risk, not a race observed live. Use an idempotent transactional creation contract and test parallel first access with disposable data.

Meal slots/per-day overrides are encoded with the plan. Shopping scopes selected days/slots, aggregates compatible units and preserves incompatible/unknown units. Check writes verify current items and plan ownership. Recipe links use stored recipe IDs. Pantry filtering is explicit, and incomplete profiles stop personalized plan creation. F02 and F09 remain integrity concerns for those otherwise persistent flows.

## 8. Training findings

Level/equipment/location/time filtering is shared by plan generation and Coach. Home equipment parsing handles scoped negations and optional alternatives, covered by the passing product tests. Empty matching libraries do not invent a workout. Exercise help provides instructions and beginner alternatives; video URLs require matching HTTPS YouTube source/ID/date metadata before producing a nocookie embed. No seeded video URL was found in the inspected library; metadata checks do not independently certify a future video's quality.

Training's load failure is **F01**, unsafe stored exercise JSON is **F14**, and English Coach location handling is **F13**. The browse library can contain sessions beyond the user's recommendation; recommendation filtering and browse availability should be tested separately rather than treating all visible library entries as generated prescriptions.

## 9. Progress/adaptive findings

### F10 — Medium / confirmed technical risk: server-local calendar boundaries

Evidence: `src/app/actions.ts:111–115`, `src/lib/plan-types.ts:8–15`, `src/lib/daily-nutrition.ts:7–10`, `src/app/nutrition-actions.ts:25`, `src/components/daily-nutrition.tsx:13–14` and its ISO conversion on save.

Own meals use browser-local input converted to an absolute timestamp, but daily/weekly queries use the server's local `setHours(0,0,0,0)` calendar. No account timezone is part of these calculations. On a UTC host, a meal shortly after midnight in Stockholm belongs to the previous server day; user-visible dates and daily totals can disagree, including around DST. This is conditional on host/user timezone, not an assertion that the current Windows host uses UTC. Establish a single calendar policy and test different zones/DST without changing production records.

Progress trends require recorded measurements; step interpretation distinguishes unrecorded zero from recorded data. Adaptive workout proposals require several evidence days, preserve meal/step goals and require acceptance. Weight-based nutrition changes also require a longer series. No fabricated trend was identified in the normal paths. F07/F08/F10 can corrupt or misalign that evidence. Workout totals count sessions while some adaptive comparisons count completed days; test multiple sessions in a day to document the intended semantics (F17), rather than claiming those different metrics are automatically wrong.

## 10. Coach findings

### F13 — Medium / confirmed bug: English gym request can produce a home workout

Evidence: `src/lib/coach-service.ts:123–127` versus Swedish location handling at `src/lib/coach-service.ts:142–145`.

The English branch recognizes explicit `home` but does not recognize explicit `gym`; it otherwise uses the saved location. Pure reproduction with a saved home preference and both a home/gym candidate: “I want a gym workout” returned the home fixture. The Swedish branch handles both. Align explicit-location interpretation across languages and retain equipment/level checks.

### F18 — Medium / confirmed technical risk: external classifier data boundary

Evidence: `src/lib/coach-service.ts:58–70`, `src/app/api/coach/route.ts:31–33`.

When `AI_COACH_LIVE_ENABLED=true` and provider configuration is present, classification forwards the message, recent history and context including dietary restrictions, work schedule and meal/workout titles. The flag is a server/operator switch; no user-level consent/redaction gate is present in this path. History may contain sensitive user-authored text despite the UI warning. This is dormant unless enabled; no provider was called or configuration value inspected in this audit. Before enabling it, establish an explicit user-facing data-sharing policy and minimize forwarded content. This is a technical data-boundary observation, not a legal compliance determination.

Coach history is stored by session-derived user ID, bounded to 50 exchanges and a smaller conversation context, with explicit deletion. New login scoping and “previous conversations” are implemented separately. The external service can only choose allowlisted intent labels; raw provider advice is not shown. Local replies implement no-diagnosis/no-dosing and no-punishment boundaries. Incomplete profiles receive general guidance rather than a default personal plan. Own meals enter Coach through daily nutrition. These controls are present; broader bilingual safety-language testing remains F17.

## 11. Loading/error-state findings

### F01 — High / confirmed bug: rejected initial loads never clear

Evidence: `src/app/(app)/dashboard/page.tsx:35–50`, `src/app/(app)/training/page.tsx:43–58`.

Both initial Promise.all chains set loading false only inside `.then`, with no catch/finally. Any rejected server action leaves the initial loading message and an unhandled rejection. Recovery requires leaving/reloading the page and a later successful request. Code-level reproduction condition is an initial data-request rejection; the attempted browser check was blocked by the stopped server and did not confirm timing in a running browser. Add visible failure/retry and guaranteed loading cleanup, plus stale-request protection.

Related lower-impact error visibility: `src/components/weekly-nutrition.tsx:8–9` catches failure into null and disappears entirely. My Plan/Profile retain explicit error strings, Meals has a guarded catch, and Progress/Plan clear loading in finally. Promise settlement handling is therefore inconsistent; healthy normal-route checks cannot rule this out.

### F14 — Medium / confirmed technical risk: unguarded JSON render boundaries

Evidence: `src/app/(app)/meals/page.tsx:107`, `src/app/(app)/meals/page.tsx:135–139`, `src/app/(app)/training/page.tsx:162`, JSON-string columns in `prisma/schema.prisma`.

Recipes and Training parse stored strings directly during render without validating shape/catching failures. A malformed imported/legacy recipe nutrition/tags/ingredients/instructions value or workout exercise value throws instead of producing a bounded item-level error. The server's safer parse helpers do not protect these client parse calls. No corrupt live row was found or inserted; this is an established failure path if storage contains invalid JSON. Test with isolated fixtures and use validated shared decoders/fallbacks. No app-route error boundary was found in the inspected source tree.

## 12. Locale findings

### F12 — Medium / confirmed technical risk: transient preference fetch becomes a silent locale reset

Evidence: `src/lib/i18n/provider.tsx:10–20`.

Language initializes to Swedish. An authenticated `getUser` rejection sets Swedish and ready=true, without an error or retry; the effect depends only on session ID/status. A later successful unrelated page request does not recover the saved language. Initial English rendering can also briefly show default Swedish before preferences arrive. This is not a repeating locale loop: no automatic save/refresh loop was found. Preserve the known language during transient failure and expose/retry profile-loading failure. Unavailable localStorage is also unguarded on the anonymous path; cover it under F17.

Account switching persists language via preferences and browser storage; on reload authenticated accounts use their saved choice. Existing normal-navigation bilingual tests passed before this audit. F06 additionally explains how genuinely invalid legacy preferences can reset language. Translation catalog inspection alone does not establish full phrase coverage, and the runtime test's `html.lang` assertion is not a full translated-content assertion.

## 13. Performance/runtime findings

### F15 — Low / improvement only: avoidable repeated reads

Evidence: `src/lib/ModeContext.tsx:38`, `src/lib/i18n/provider.tsx:15`, page-level `getUser` effects; `src/app/nutrition-actions.ts:66–69`, `src/lib/daily-nutrition.ts:11–17`, `src/app/actions.ts:482`.

Mode, locale and individual pages independently fetch the same profile. Weekly nutrition starts seven daily computations, each with six database reads, including repeated full recipe-library reads: 42 service reads plus the decision count, before authentication/provider/page overhead. Coach context also nests overlapping plan/profile/library reads. The fan-out is confirmed statically; no measured production latency threshold or large-bundle regression is claimed. Consider request-scoped shared reads and one week-range aggregate after correctness fixes. Avoid global caching of private user data.

The four Next output directories remain distinct and the isolation regression passed. Starting two processes against the same chosen directory is still an operator concern, documented in the runtime report. Existing WebPs are served directly in the two image wrappers. No new image or layout issue is part of this audit. Pending-request behavior and route transitions were previously verified on the healthy production build, not freshly rechecked against a running server here.

## 14. Test-coverage gaps

### F17 — Medium / test-coverage gap: healthy navigation is not a failure/data-integrity matrix

Evidence: `tests/runtime-browser.cjs:11–25`, `tests/login-browser.cjs`, `tests/runtime-output.cjs`, `tests/http.cjs`, `tests/next-phase.cjs`, `tests/mobile-refinement.cjs`, `tests/refinement.cjs`, `tests/goal-safety.cjs`, `tests/phase.cjs`, `tests/beta.cjs`.

The suite has meaningful coverage of persistence, user isolation, goal pace, nutrition nulls, own-meal CRUD, stale nutrition proposals, shopping filters, password change/session invalidation and healthy routes. Some checks assert source strings rather than executing the affected UI. Most integration tests mock identity/cache and use real database fixtures; HTTP tests complement that but do not cover client failure recovery.

Priority missing regressions:

1. Rejected and indefinitely delayed initial page/profile requests; retry, offline recovery and unmounted/stale responses.
2. Consumed meal survives plan/slot/preference edits; past intake does not change when a profile becomes incomplete.
3. Parallel first-week creation, simultaneous distinct meal completions and repeated workout logging; assert durable IDs/counts.
4. Invalid single preference and age rollover preserve unrelated fields; old-account migrations.
5. Baseline/current-weight versus dated log contract; weight crossing a saved goal; all goal modes through each writer.
6. Allergen metadata/ingredient synonyms across the entire recipe library; conservative unknown handling.
7. Midnight/DST in different client/server zones, including own meals and week boundaries.
8. English explicit gym/home requests and bilingual Coach safety vocabulary/follow-ups with missing profile inputs.
9. JS-disabled **visible explanation**, delayed hydration, session expiry and credential-safe URLs after failures. Existing no-JS test proves absence/disabled controls, not helpful recovery content.
10. Literal translated UI content during slow/error locale restoration, not just `html.lang`; storage unavailable.
11. Malformed recipe/workout JSON and item-level recovery.
12. Continued two-server build isolation with first-time/dynamic routes; the existing configuration test alone cannot exercise missing chunks.

Run persistence/concurrency tests on an isolated disposable database. Existing suites must not be treated as read-only merely because their cleanup usually deletes fixtures. This audit deliberately did not rerun those against existing user data.

## 15. Prioritized remediation list

### Before new feature work

- **F01:** make initial Today/Training loading settle on failure, with explicit retry; add rejected-request regression checks.
- **F02:** preserve consumed intake independently of current plan edits; test slot/preference changes after completion.
- **F03:** correct and strengthen allergen handling before relying on it for personalized dietary suggestions.
- **F06/F07:** preserve valid profile fields and define one consistent current-weight/history contract.
- Add the corresponding portions of **F17** with each fix, not a broad unrelated refactor.

### Before public production exposure / relevant feature activation

- **F04/F05:** verify deployment throttling, add missing application protection, and isolate/gate shared demo credentials.
- **F08/F09/F10:** atomic data updates, idempotent plan creation and a defined calendar/timezone contract.
- **F11/F12/F14:** visible JS/load/locale recovery and robust stored-data parsing.
- **F18:** review user disclosure, consent and data minimization before enabling the external classifier.

### Can wait behind the above, with known limitations

- **F13:** bilingual Coach explicit-location parity.
- **F15:** query consolidation and measured performance work.
- **F16:** explain the nutrition target range boundary; do not silently extend the formula.
- Remaining **F17** breadth can be added incrementally as long as the high-risk paths receive tests first.

### Checkpoint assessment and final status

`d41f68d` remains a technically useful stable checkpoint for the previously tested healthy local flows. No audit operation invalidated the prior runtime/login fixes. It is not ready to be described as robust under request failures, concurrent edits, all dietary inputs or arbitrary production hosting conditions. There is no evidence from this audit that the original shared-build-output regression returned.

Final intended repository delta is only this report:

```text
Branch: main
HEAD: d41f68d Stabilize runtime and refresh Livskraft UI
?? TECHNICAL-AUDIT-REPORT.md
```

No code fix was applied. No database/schema/design/imagery change, commit or push was performed.

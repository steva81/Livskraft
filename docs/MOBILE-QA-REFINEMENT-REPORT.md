# Mobile QA refinement report

Date: 2026-09-27
Checkpoint: `f0dd477ea689046fecc9232a2879a5b6c2540e02` on `main`, aligned with `origin/main` at the start.

## Scope and preservation

This is the focused refinement requested after physical mobile testing. Existing working functionality and history are preserved. No commit, push, reset, restore, infrastructure integration, or live photo provider activation. The preceding phase report remains unchanged.

## Product changes

1. **Home:** new `/home` hub with a green welcome hero and six large cards: Food & nutrition, Training, My week, Progress, Coach and My Plan. Recipes/shopping, profile and Account Settings have visible secondary links. One-column mobile layout becomes a two/three-column grid.
2. **Routing and greetings:** registration and regular login lead to Home. A per-account `homeVisited` preference provides the first welcome once, then returning greetings. Legacy accounts are treated as returning. Missing/blank names produce a grammatical greeting.
3. **Shared readiness:** personalized planning requires weight, height, an explicit primary goal, activity level, training level, training location and confirmed planning choices. The same rule gates server plan generation/retrieval, nutrition targets, adaptive proposals and personal UI guidance. Birth year and calculation sex remain optional; absence lowers energy estimate confidence.
4. **No implicit confirmation:** activity/training/location begin unselected in onboarding. Typical steps, meal slots, equipment, cooking time, workout duration/frequency, budget and schedule are labelled starting suggestions and require review/confirmation. The suggested step target is displayed before confirmation: typical steps + 1000, limited to 2000–12000. My Plan provides a review-and-save confirmation too.
5. **Existing accounts:** saved data, historical logs and existing plans remain in the database. Since historical default provenance is unknown, accounts without the new confirmation flag must review My Plan before saved suggestions are used as personal recommendations. No blanket database migration marks old values as user-confirmed.
6. **Language:** onboarding inherits the landing selection; its repeated language selectors are removed. The selected language is stored on registration. Account Settings still allows changes. New UI copy is Swedish/English.
7. **Step validation:** required account fields, weight, height and goal are validated before leaving step 1. Activity, training level and location are validated on step 3. Reviewed suggestion ranges and confirmation are checked before final submission. Server validation repeats these checks.
8. **Four goals:** Lose weight requires target/timeframe and Goal Safety validation. Maintain weight removes target/timeframe requirements. Maintain weight and muscle emphasizes stability, protein and resistance training. Build muscle offers an optional gain target/timeframe, validates direction and uses muscle-building language. Maintenance stores no artificial target/timeframe.
9. **Body copy:** concise optional calculation-sex label/helper, with an expandable explanation distinguishing physiological formula input from gender identity. No unrelated identity information requested.
10. **Weight source:** My Plan edits current weight only under Body and baseline data. The goal editor references it and links to that section. Server goal updates ignore a legacy currentWeight argument. Energy and Coach use the stored baseline; Progress displays the stored current weight while preserving historical measurements.
11. **My Plan:** incomplete profiles see missing items and a completion action; saving updates the completion display. The old ready message is gated by the shared readiness check.
12. **Today:** incomplete users see completion guidance and can log their own meals, without generated meals, step targets, training/rest recommendations or numerical nutrition targets being presented as personal guidance.
13. **Coach:** incomplete users are directed to My Plan with missing fields and general safe guidance. Hidden-default meals/workouts are not presented as personal recommendations. Existing medical and Goal Safety guards remain.
14. **Navigation:** removed duplicated mobile top navigation. Bottom Home / Plan / Training / Coach remains primary; Home exposes the other sections. Desktop sidebar remains.
15. **Own meals/photo:** friendly take-photo/choose-image control hides generated filenames. Local preview, change/remove actions, original capture/accepted-format/size checks and object-URL cleanup are retained. Unavailable analysis copy is nontechnical. Live image analysis remains disabled; no image recognition is fabricated. History is now Previous meals / Tidigare måltider.
16. **Modes:** Simple keeps optional nutrition details collapsed; Advanced retains richer numerical guidance when the profile is ready. Missing optional formula inputs still show lower-confidence copy in both modes.
17. **Related surfaces:** Weekly Plan uses the completion card for incomplete profiles. Training remains browsable as a general library but marks no personalized recommendations or assumed equipment for incomplete users. Profile explicitly labels unconfirmed stored suggestions. Progress suppresses unconfirmed step targets and goal guidance. Own logs remain accessible.

## Data and compatibility

No Prisma schema, migration or dependency changes. New optional JSON preferences: `planningConfirmed` and `homeVisited`, validated as booleans. Existing user records are preserved; changes occur through normal registration/profile actions. Generated plans are blocked while incomplete, not deleted. Personalized recipe selection remains constrained by dietary/allergy rules. Nutrition balancing still requires known nutrition and review before approval; prior health/diabetes restrictions are preserved.

Authentication remains session-derived. Home and all modified profile actions scope reads/writes to the authenticated account; a supplied foreign ID cannot select another user. New tests cover isolation and legacy compatibility. This is regression verification, not a penetration test or full security audit.

## Automated verification

- TypeScript: PASS.
- Standalone lint: PASS, no warnings/errors.
- Beta: PASS, 14 groups.
- Product: PASS, 4 groups.
- Goal Safety: PASS, 2 groups.
- Phase: PASS, 7 groups.
- Refinement: PASS, 5 groups.
- Next phase: PASS, 7 groups.
- Mobile refinement: PASS, 6 groups, including required/optional inputs, four goals, legacy profiles, readiness guards, current-weight propagation, user isolation, language/routing/rendering contracts and local photo architecture.
- Production build: PASS, including the final copy fixes. Final build ID: `BJIZg9y-TcYUR0MPcJu5f`; 18 pages generated. Integrated lint and TypeScript also passed. Non-blocking webpack cache snapshot warnings did not prevent compilation.
- HTTP/session: PASS, 3 groups: anonymous protected routes including `/home`, two real NextAuth sessions, own Coach context/history/language, password-rotation invalidation and account isolation.

Existing fixture users used to exercise personalized planning now explicitly provide complete baselines and confirm preferences. Tests for legacy/incomplete accounts separately assert no personalized plan until completion. An outdated beta expectation that an empty account receives a plan was replaced with the new readiness contract. A new propagation test found and fixed Progress using an older logged weight instead of the current baseline. Source-contract tests complement behavioral database/action tests and do not substitute for browser checks.

## Browser verification

Tested the local production server in the Codex browser with a dedicated disposable account.

| Surface | 390 px | 430 px | 768 px | 1440 px |
| --- | --- | --- | --- | --- |
| Complete Home | PASS | PASS | PASS | PASS |
| Incomplete Home | PASS | PASS | PASS | PASS |
| Today, including open photo form | PASS | PASS | PASS | PASS |
| Incomplete Today | PASS | PASS | PASS | PASS |
| Incomplete Coach with actual reply | PASS | PASS | PASS | PASS |
| My Plan | PASS | PASS | PASS | PASS |
| Onboarding, all four goal variants | PASS | PASS | PASS | PASS |
| Onboarding steps 2, 3 and 4 | PASS | PASS | PASS | PASS |

52 recorded layout checks found no horizontal document overflow. An intentionally clipped, aria-hidden decorative circle extended beyond its hero at narrow widths; its parent has overflow hidden and it does not produce horizontal scrolling. Mobile bottom navigation and desktop sidebar visibility were checked in rendered snapshots.

Behavioral browser checks passed:

- Landing English inherited by all four onboarding steps with no language selector in onboarding.
- Empty step 1 blocked with individual name/email/password/weight/height/goal errors. Lose-weight target requirements were enforced. Step 3 blocked without activity/training/location. Step 4 blocked without suggestion confirmation.
- All four goals showed appropriate fields in English and Swedish. Maintenance goals had no target/timeframe controls; build muscle accepted no gain target. Optional birth year and calculation sex were left blank during successful registration.
- Actual registration went directly to Home with first welcome. Account Settings language change, sign-out and regular sign-in returned to Home with the returning Swedish greeting.
- Incomplete Home listed missing weight, height, goal, activity and review confirmation; it did not claim plan completion.
- Incomplete Today contained completion guidance and manual own-meal logging, without personal meals, step/workout guidance or numerical calorie/protein targets, including Advanced mode.
- Actual Swedish Coach question “Vad kan jag äta nu?” returned missing profile details, a My Plan direction and general safe guidance, with no hidden-default meal recommendation.
- My Plan displayed one current-weight editor. Completing the disposable legacy profile through the real UI removed the completion card immediately. Existing suggestion values were retained for review.
- Complete Today showed lower-confidence wording in Simple and numeric guidance in Advanced. Updated current weight reached the displayed targets.
- A local synthetic PNG loaded as a blob preview. Change-image and remove-image controls appeared; removal removed the preview. Camera capture remains configured. No filename appeared in the visible UI, and analysis remained disabled with nontechnical text.
- A Swedish manual meal was saved with blank nutrition, appeared in Previous meals, and retained unknown nutrition instead of invented values.
- All main and secondary Home destination links were visible with the expected routes. No duplicate mobile top navigation remained.

Screenshots are stored outside the repository in the task visualization directory: `livskraft-home-390.png` and `livskraft-home-incomplete-390.png`.

Browser inspection found two small polish issues: stale goal validation after changing goals and old copy describing height as optional. Both were fixed; the mobile regression suite passed again. English singular “1 week” was corrected at the same time.

## Known limitations and recommended manual checks

- Repeat the physical Android camera test: this desktop browser cannot prove native camera launching, permission flow or hardware behavior. Camera capture attribute and local preview architecture are preserved.
- Birth-year age is calendar-year based, not birthday-precise. Formula confidence still depends on optional age/calculation sex.
- Legacy accounts need one explicit review because stored defaults cannot be distinguished reliably from historical user input.
- Many recipes lack verified complete nutrition/fibre; conservative nutrition replacements remain unavailable when safety cannot be established.
- Live photo analysis remains unavailable until a real provider is configured.
- Energy guidance remains an estimate, not clinical treatment. Existing medical/diabetes boundaries and no compensation/restrictive coaching remain.
- Manually check keyboard/screen-reader flow, real-device camera change/remove, language persistence across fresh login, and personal history after legacy-profile completion.

## Files changed and final git status

Final status: `main...origin/main`, HEAD `f0dd477ea689046fecc9232a2879a5b6c2540e02`. 31 tracked files modified and 7 new files; all unstaged/uncommitted. No commit, push, reset, restore or history rewrite. `git diff --check` passed.

Modified tracked files (31):

- package.json
- src/app/(app)/coach/page.tsx
- src/app/(app)/dashboard/page.tsx
- src/app/(app)/layout.tsx
- src/app/(app)/my-plan/page.tsx
- src/app/(app)/plan/page.tsx
- src/app/(app)/profile/page.tsx
- src/app/(app)/progress/page.tsx
- src/app/(app)/training/page.tsx
- src/app/actions.ts
- src/app/login/page.tsx
- src/app/onboarding/page.tsx
- src/components/body-data.tsx
- src/components/daily-nutrition.tsx
- src/components/goal-editor.tsx
- src/components/goal-summary.tsx
- src/lib/adaptive.ts
- src/lib/body-data.ts
- src/lib/coach-service.ts
- src/lib/daily-nutrition.ts
- src/lib/i18n/catalog.ts
- src/lib/nutrition.ts
- src/lib/plan-generator.ts
- src/lib/preferences.ts
- src/middleware.ts
- tests/beta.cjs
- tests/goal-safety.cjs
- tests/http.cjs
- tests/next-phase.cjs
- tests/phase.cjs
- tests/refinement.cjs

New files (7):

- MOBILE-QA-REFINEMENT-REPORT.md
- src/app/(app)/home/page.tsx
- src/components/profile-readiness.tsx
- src/components/starting-choices.tsx
- src/lib/onboarding-validation.ts
- src/lib/profile-readiness.ts
- tests/mobile-refinement.cjs

## Final verification and cleanup

The final production build was restarted and the corrected confidence wording and cleared goal errors were verified in the browser. All six Home destinations were exercised, including Training, Weekly Plan and Progress. The final browser console had no captured warning/error entries. HTTP/session tests passed again against the final build.

The disposable browser account was signed out and deleted by its exact verified ID and test-only email. Its test records were removed through existing cascade relations. Seven pre-existing accounts remain; a before/after comparison confirmed their user records were unchanged. Existing older test-looking accounts were deliberately left alone. Automated suites cleaned their own fixtures. Browser tabs were closed and temporary viewport overrides reset. No live image provider or new infrastructure was enabled.

The local verification server was stopped after testing. Screenshots and the 52-check responsive matrix are retained in the task visualization directory outside the repository.

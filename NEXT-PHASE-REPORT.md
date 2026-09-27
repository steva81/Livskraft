# Livskraft — next product phase

Implemented on the existing `main` working tree. No reset, restore, commit, push, seed reset, or history rewrite was performed. Existing local users and recipes were retained. AWS, PostgreSQL, HealthKit and Health Connect were not introduced.

## Architecture and baseline data

- `src/lib/body-data.ts` provides shared Swedish/English labels, optional birth-year/sex validation and derived age. Age is the current calendar year minus birth year, so it is approximate within one year; an exact birthday is not collected. Supported numerical planning inputs are adults aged 18–100.
- My Plan has a separate **Body and baseline data / Kropp och grunddata** form: birth year, sex for energy calculation, height and current weight. It explains that the biological-sex coefficient is used by the formula and is not gender identity. Male, Female and Prefer not to say are supported.
- Onboarding includes the same optional birth-year/sex inputs. Skipping body data works; numerical energy targets wait until weight is available. Existing accounts need no backfill. Profile summarizes the baseline data and links to the established editing flow.
- Birth year, `sexForEnergy` and `primaryGoal` use existing validated `User.preferences` JSON. Height and current weight retain their existing columns. Age and targets are calculated rather than persisted.
- Body-data and goal actions merge the authenticated user's current preferences; saving another My Plan section does not overwrite these fields with stale form defaults.

## Four goals and energy calculations

`src/lib/nutrition.ts` is the central engine used by daily summaries, goal summaries, Coach and nutrition adaptation. Explicit goals are `lose`, `maintain`, `retain-muscle` and `build-muscle`. Legacy profiles infer direction from their existing weight goal; a profile without one defaults to maintenance.

| Goal | Energy behavior | Protein guidance | Interpretation |
|---|---|---|---|
| Lose weight | Smaller of 300 kcal or 10% maintenance deficit | 1.6 g/kg/day | Gradual change, regular meals, recovery |
| Maintain weight | Maintenance; no goal deficit | 1.2 g/kg/day | Stability rather than additional loss |
| Maintain weight and muscle | Maintenance; no goal deficit | 1.6 g/kg/day | Stability, resistance training and recovery |
| Build muscle | Smaller of 200 kcal or 5% maintenance surplus | 1.6 g/kg/day | Gradual strength progression, measurements, recovery; gain is not inherently bad |

With sufficient inputs, resting energy uses **Mifflin–St Jeor**:

`10 × weight(kg) + 6.25 × height(cm) − 5 × derived age + coefficient`

The coefficient is `+5` for male and `−161` for female. No age or coefficient is invented for missing/prefer-not-to-say values. Formula source: [Mifflin et al., 1990](https://pubmed.ncbi.nlm.nih.gov/2305711/).

Activity is an explicit **product heuristic**, not part of the validated resting-energy equation:

- Reported activity factor: sedentary 1.30, light 1.45, moderate 1.60, active 1.75, very active 1.85.
- Movement indicator: `min(1.85, 1.25 + min(15000, estimated daily steps)/30000 + training days × .02)`.
- Effective multiplier: 75% reported activity factor + 25% movement indicator. This blends overlapping information instead of adding workout calories twice.
- Without formula inputs, a deliberately lower-confidence fallback is `30 × weight × effective multiplier / 1.45`. This is a broad planning heuristic, not a validated substitute for individualized assessment.
- UI labels distinguish **more individualized** from **less individualized**, in both languages and modes. Neither is represented as exact biological truth. Missing weight, blocked Goal Safety, out-of-range weight or implausibly low maintenance yield no numerical target.
- Energy is rounded to 50 kcal. The product guardrail never sets a target below 1500 kcal or the calculated resting estimate. These are conservative software limits, not medical clearance or clinical prescriptions.
- Fat guidance is approximately 30% of energy; carbohydrate guidance is the remaining energy after protein/fat. They are flexible planning allocations, not mandatory quotas.
- Protein assumptions use the exercise literature as context; the 1.6 g/kg goal is within the [ISSN 1.4–2.0 g/kg range for exercising adults](https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/). The maintenance 1.2 g/kg value is a product planning default, not an individualized medical recommendation.

No exercise calories are automatically eaten back. The live calculation uses the saved typical step estimate/training frequency; actual step history continues to inform the existing Adaptive Week movement guidance. Weight history informs conservative proposals, not an automatic calorie recalibration. General context on estimating changing needs: [NIDDK Body Weight Planner](https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner).

## Today, meals and photo architecture

- Today mounts `DailyNutrition`, with the same engine for Simple and Advanced modes. Simple mode offers normal-meal/protein guidance without a macro dashboard. Advanced shows estimated target, planned intake, logged intake, approximate remaining energy, protein progress and carbohydrate/fat guidance.
- Unknown nutrients remain `null`; sums track a separate unknown count. Unknown planned energy is shown as incomplete. Unknown consumed energy suppresses the remaining-energy number. Unlogged food is explicitly outside the totals.
- Planned meals count toward intake only when completed. Own meals count on their recorded date. Coach explains how to avoid double counting a replacement dinner.
- Own meals support add/edit/delete, breakfast/lunch/dinner/snack/other, name, components, portion, local date/time and optional kcal/protein/carbohydrate/fat/fibre for the entire portion. Server validation bounds text, dates and nutrients. Saved values are labeled approximate. No food-composition values are invented from free text.
- Own-meal history shows the latest 100 entries for editing; daily totals include every entry on that day, not just that history window.
- `PhotoMealProvider` exposes availability and an abortable `analyze` interface returning components, portions, nutrition and uncertainties. The configured-provider UI can select a suggestion into the editable form, then correct it and explicitly confirm/save.
- The delivered provider is **unavailable**. JPG/PNG/WebP selection and a local preview work; no live recognition, upload, or photo persistence is claimed. Photos are limited to 10 MB. The UI explains oil, sauces, hidden ingredients and portion uncertainty, and manual entry always works.

## Approval and propagation

`nutrition-balancing.ts` creates concrete recipe-replacement proposals:

- Continue normally is always the default. Users may inspect a gentle remaining-day option, remaining-week option, or longer-term nutrition proposal from Progress.
- Daily/remaining-week reductions require known logged energy at least 200 kcal above the full daily target. An isolated unlogged or incomplete day cannot trigger a reduction.
- A replacement must match the slot, allergies/dislikes and cooking time. Both old and new recipes need known energy, protein and fibre. Protein and fibre may not decrease. A swap changes only 25–100 kcal, also capped at 5% of the target, with at most one replacement per day and three per proposal. The remaining planned daily energy must stay above the engine's baseline/floor and 90% of the target.
- No skipped meals, forced fasting, portion cuts, workout doubling or punishment exercise are implemented. Movement is optional wellbeing guidance, never a food-compensation prescription.
- Nutrition proposals are disabled for a saved health adaptation; general planning and the existing health guidance still work.
- Accept/reject is explicit. A proposal hash binds scope, current targets, intake, evidence and exact before/after meals. Stale proposals fail. Transactional updates check ownership and the unchanged original meals. An accepted nutrition adaptation caps further approvals that day.
- Rejection writes only the decision and preserves the plan/shopping list. Acceptance replaces the exact planned recipe. Today reloads its plan/nutrition, Weekly Plan reads the stored meals, Shopping derives ingredients from those meals, and Coach reads the same plan and logs. There is no independent shopping mutation when food has not changed.
- Progress has a weekly nutrition overview showing own-meal counts, accepted adaptations and, in Advanced mode, daily planned/logged known subtotals with incompleteness indicators.
- Next-week nutrition proposals require at least six weight measurements spanning at least fourteen days. The weekly rate compares early/late weight averages and their mean dates. Goal-dependent thresholds identify possible drift, not a diagnosis. The existing training/steps Adaptive Week remains intact; nutrition has its own reviewed proposal panel.

## Coach and progress

Coach retains the existing session/history and optional intent-classifier architecture. Its context now includes selected goal, calculated energy/protein, planned/completed meals, own meals, known daily nutrition, sufficient weight trend, steps, workouts, preferences, schedule and health adaptation.

Explicit protein, muscle and extra-food requests have practical goal-aware responses. User-reported protein is distinguished from persisted logs. Existing hunger/cravings, missed-workout, stress, sleep, recovery and follow-up handling remains. Goal Safety and medical refusal routes remain active; there is no insulin dosing, medication change, diagnosis or treatment instruction.

Progress adds goal-specific interpretation alongside existing weight averages, measurement charts and training consistency. Muscle-building guidance explicitly says a weight increase does not prove muscle gain and should be considered alongside measurements/training/recovery. Insufficient data is reported as insufficient.

## Database, migration and security

- Added `OwnMeal` and `NutritionDecision` with user ownership, cascade relations and indexes. No existing table/column was removed.
- `prisma/next-phase.sql` is an additive, idempotent SQLite upgrade for an existing pre-phase database. Back up the database before applying upgrades. Use the project's Prisma generation workflow after upgrading. The existing development database was synchronized with `prisma db push --skip-generate`; no seed command was run.
- Prisma generation initially hit a DLL lock from the existing Livskraft dev server. Only the two verified Livskraft Next processes were stopped. Client generation then succeeded. The server was restarted for browser checks.
- Every new read/write resolves authenticated identity server-side. Client-supplied user IDs are ignored. Updates/deletes constrain both record ID and user ID. Two-user tests exercise cross-user failures and unchanged foreign data.
- Test records and synthetic recipe fixtures are created under dedicated test identities and removed. Existing user/recipe content is not used for write tests.

## Validation

| Check | Result |
|---|---|
| ESLint | Passed, no warnings/errors |
| TypeScript (`tsc --noEmit`) | Passed |
| Production build | Passed; non-fatal webpack cache snapshot warning |
| Beta tests | Passed |
| Product tests | Passed |
| Goal Safety tests | Passed |
| Phase tests | Passed |
| Refinement tests | Passed |
| HTTP/session tests | Passed against both development and final production servers; anonymous protection and two independent NextAuth sessions |
| New `test:next-phase` | Passed; seven groups including formula/age/confidence, optional onboarding, four-goal persistence, own-meal CRUD, nutrition totals, reviewed day/weekly swaps, shopping propagation, Coach and user isolation |
| `git diff --check` | Passed; Git emitted only local LF/CRLF normalization notices |

Browser checks used a disposable local account. My Plan, Today, Weekly Plan, Progress and Coach loaded at **390, 430, 768 and 1440 px**, with document width equal to viewport width for all 20 route/width combinations. The open own-meal form also had no horizontal overflow at all four widths. Visual screenshots were inspected for mobile baseline entry, mobile nutrition and tablet nutrition.

Interactive checks covered saved birth year/sex, all four goal options, a saved switch from maintenance to muscle building (energy/protein updated), own-meal add/edit/delete, actual totals, missing recipe-nutrition indication, photo-provider disabled/manual fallback, Simple/Advanced switching, Swedish/English labels and a goal-aware Coach protein reply. The unsupported live camera/vision integration was not claimed as tested.

## Known limitations and recommended manual checks

1. Many existing recipes intentionally have unknown nutrition, and most lack verified fibre. Consequently, real balancing often offers **keep the plan** rather than an unverifiable swap. Automated acceptance tests use disposable complete-nutrition recipes; production metadata was not fabricated.
2. This phase does not create a food-composition database, infer nutrition from free text, or configure a live vision provider. Known/manual values remain estimates. Camera behavior should be checked on real iOS/Android devices before introducing a provider.
3. Recipe choices are supported; arbitrary ingredient/portion scaling is not. Goal-sensitive recipe ranking uses available protein values, while existing accepted plans are not silently resized to exactly equal the energy estimate.
4. Activity multipliers, fallback energy, macro allocations and adaptation thresholds are documented conservative product assumptions. They are not a clinically validated adaptive metabolic model. Weight changes alone cannot identify muscle/fat composition.
5. Birth-year age is approximate. No pregnancy, clinical nutrition, pediatric planning or medication-specific model is added.
6. Date grouping follows the existing server-local day convention. A deployment serving multiple time zones should introduce an explicit per-user time zone before relying on cross-zone historical day boundaries.
7. The open page refreshes its own saved changes. Already-open independent tabs may need navigation/reload to show another tab's edits; there is no real-time cross-tab subscription.
8. Browser tests validate responsive layout and representative flows, not a full accessibility audit or physical-device camera behavior. Recommended manual checks: keyboard/screen-reader form navigation, real-device camera/gallery selection, overnight/DST meal entries, and a reviewed nutrition-rich recipe library before wider balancing rollout.

## Completion checklist (requested final-report topics)

| # | Topic | Outcome |
|---|---|---|
| 1 | Stable checkpoint | Preserved; work remains on main without commit/push |
| 2 | Four-goal engine | Implemented with legacy inference |
| 3 | Birth/sex inputs | Optional birth year, derived age, three sex-for-calculation choices |
| 4 | Formula/assumptions | Mifflin–St Jeor plus explicitly documented product heuristics |
| 5 | Confidence | Higher/lower individualization; no invented inputs |
| 6 | Protein/nutrition | Goal-based protein, flexible fat/carbohydrate guidance |
| 7–9 | Modes and Today | Shared calculations, friendly Simple guidance, numeric Advanced view |
| 10–12 | Own/photo meals and estimates | CRUD complete; reviewed provider abstraction, unavailable live analysis, unknown values retained |
| 13–15 | Balancing/approval | Conservative day/week/trend proposals with explicit accept/reject |
| 16–17 | Weekly Plan/shopping | Stored recipe swaps propagate; unchanged food leaves shopping unchanged |
| 18 | Coach | Goal and nutrition context; existing history preserved |
| 19–20 | Progress/Adaptive Week | Goal interpretation, weekly nutrition summary, sufficient-data proposals |
| 21 | Health safety | Goal Safety retained; medical limits preserved; health-adapted nutrition swaps disabled |
| 22–24 | Database/compatibility/isolation | Two additive tables, optional JSON fields, authenticated ownership tests |
| 25–26 | Languages/responsive | Swedish/English verified; four requested viewport widths checked |
| 27 | Files changed | See inventory below and `git status --short` |
| 28 | Data impact | Additive schema sync; no seed/reset; disposable fixtures cleaned |
| 29–33 | Checks | Lint, TypeScript, build, all listed suites, new tests and browser checks passed |
| 34–35 | Limitations/manual checks | Explicitly documented above |
| 36 | Git | Main with modified/new files; no commit or push |

## File inventory

New modules/components: `src/lib/body-data.ts`, `src/lib/nutrition.ts`, `src/lib/daily-nutrition.ts`, `src/lib/nutrition-balancing.ts`, `src/lib/photo-meals.ts`, `src/app/nutrition-actions.ts`, `src/components/body-data.tsx`, `src/components/daily-nutrition.tsx`, `src/components/goal-summary.tsx`, `src/components/nutrition-balance.tsx`, `src/components/weekly-nutrition.tsx`.

Updated integration: `src/app/actions.ts`, `src/app/onboarding/page.tsx`, `src/components/goal-editor.tsx`, `src/lib/preferences.ts`, `src/lib/dietary.ts`, `src/lib/recipe-ranking.ts`, `src/lib/coach-service.ts`, and app pages `dashboard`, `my-plan`, `plan`, `profile`, `progress`, `training`.

Schema/tooling/documentation: `prisma/schema.prisma`, `prisma/next-phase.sql`, `package.json`, `tests/next-phase.cjs`, `NEXT-PHASE-REPORT.md`.

## Final verification and cleanup

- Confirmed the already successful final production build rather than rebuilding it: build ID `Y0NUjaHsD_7YeGNb6P4Fu`, generated on 2026-09-27 at 12:37 local time. No source file in `src` was modified after that build.
- The final production server started successfully on localhost:3000. `npm run test:http` then passed all three groups against it.
- The additive SQL upgrade executed successfully. The final repeated beta and refinement suites also completed successfully before the interruption.
- Removed only the identified disposable browser account `quality-1790504796246@example.invalid`, after verifying its name was `Livskraft Test`. Its remaining count is zero. The total user count changed from seven to six; the other six accounts were retained.
- Final Git state: `main`, HEAD `9043670`, 15 modified tracked files and 14 new files, all uncommitted. No commit, push, reset, restore or new product phase was performed.

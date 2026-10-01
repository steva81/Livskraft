# F06 and F07 implementation notes

Base: `7d794ea`. Scope is limited to F06 and F07; no schema change.

## F06: preference field integrity

Storage is nullable JSON text in `User.preferences`. Onboarding constructs defaults plus submitted choices and validates before storing. `savePreferences`, `saveMyPlan`, `saveBodyData`, `updateWeightGoal` and `getHomeOverview` read existing preferences before writing their owned fields. Consequently an all-or-nothing read fallback could become permanent on a later save.

Root cause: `readPreferences` previously merged stored JSON over defaults, then used one `validPreferences` result for the entire object. An expired birth year, bad enum, invalid array or malformed field discarded unrelated valid language, health, goal and confirmation values. Property-key coercion also allowed malformed health/measurement keys or could throw while interpreting them.

Contract: interpret supported fields independently using the existing validation rules. Invalid required fields get their existing field default; invalid optional fields remain absent. No inferred goal, confirmation, birth year or sex is added. No numeric/string coercion or speculative legacy translation is performed. Partial legacy objects retain supported valid values. Invalid JSON and non-object roots return independent copies of defaults. Unknown property names are ignored. Tracked-measurement ordering/deduplication remains as before. Reads do not modify stored JSON; existing save paths persist the recovered values when explicitly invoked. Submitted invalid values still fail write validation.

Direct parser consumers, all inspected:

- `src/app/actions.ts`: recipe ranking, activity guidance, Progress summary, measurement selection, Coach context, goal/preference/plan saves, meal selection and first-visit state.
- `src/app/nutrition-actions.ts`: baseline/body preference save.
- `src/app/(app)/my-plan/page.tsx`: planning form initialization and confirmation state.
- `src/app/(app)/profile/page.tsx`: displayed profile choices.
- `src/app/(app)/training/page.tsx`: equipment, duration and recommendations.
- `src/app/(app)/plan/page.tsx`: work-schedule guidance.
- `src/components/body-data.tsx`, `src/components/goal-editor.tsx`: body/goal editor state.
- `src/lib/profile-readiness.ts`: explicit planning readiness.
- `src/lib/nutrition.ts`: primary goal, energy and protein estimates.
- `src/lib/nutrition-balancing.ts`: proposal context.
- `src/lib/plan-generator.ts`: recipe/workout/meal-slot selection and activity guidance.
- `src/lib/adaptive.ts`: adaptive proposal preferences.
- `src/lib/i18n/provider.tsx`: stored language selection.

Downstream interpreted-object consumers include `recipe-ranking.ts`, `activity.ts`, `training.ts` (individual values), `planning-preferences.tsx`, Progress measurement inputs, Coach context/service, daily nutrition and goal summaries. They retain their existing rules.

Tests: `tests/f06-preferences.cjs` covers a complete valid object, every supported field invalidated independently, multiple invalid fields, malformed/primitive/array roots, partial legacy objects, unsupported enums and property types, optional-field absence, array canonicalization, strict writes and independent default arrays. `tests/f07-weight.cjs` also verifies that a preference save preserves valid legacy choices after an expired birth year is dropped.

Limitations: unreadable JSON cannot be reconstructed. Invalid optional values are shown as missing by existing editors; this change does not introduce a new migration-warning interface. Existing field defaults are unchanged.

## F07: current state versus dated facts

Write trace:

- `submitOnboarding` atomically creates the user and today's explicit initial weight/waist measurement.
- `saveBodyData` changes `User.currentWeight`, height and optional body preferences. Its existing maintenance-target compatibility behavior is retained. It creates or edits no daily measurements.
- `saveMeasurements` atomically upserts today's supplied measurement fields and updates current weight/waist when supplied. Omitted fields remain unchanged. The authenticated session supplies the user ID.
- `updateWeightGoal` reads saved current weight and does not accept the legacy input's current-weight value as a write.
- `getTodayData`, steps and meal logging create/update daily rows without supplying a weight. Empty daily rows are not measurements.
- The seed writes demo starting values/history. No production historical-weight editing or deletion path was found; test fixtures write their own isolated history directly.

Read trace:

- Profile, My Plan/body editor and GoalEditor use `getUser` / `toPublicUser` and `User.currentWeight`.
- Coach reads `User.currentWeight` in its goal context.
- `nutritionTarget`, `savedGoalSafety`, primary-goal fallback and profile readiness read current user data. GoalSummary, daily nutrition, nutrition proposals and weekly-plan readiness/safety consume those values.
- Progress displays current weight from the user; its averages, graph points and history use `DailyLog` only. Nutrition trend evidence also uses dated logs only. No trend series is synthesized from baseline edits.

Exact divergence: editing baseline from 80 to 78 changed Profile/Coach/calculations while today's recorded 80 remained in the graph, with no explanation of the distinction. Clearing baseline was additionally inconsistent: Progress fell back to a historical weight while Profile and planning correctly treated current weight as missing.

Chosen contract: `User.currentWeight` is the authoritative current planning value, including null. Baseline edits are corrections to current state, not assertions that a weighing occurred today. Only explicit measurement entry (or onboarding's initial entry) records a dated fact. Progress now explains this distinction and never substitutes history for cleared current state. `firstWeight` is historical only, null when no dated weight exists. Measurement saves invalidate the app layout, as baseline saves already did, so current-weight consumers refresh on subsequent reads/navigation.

Repeated baseline edits leave all dated records unchanged. Repeated Progress submissions replace only supplied fields for today, consistent with the existing one-row-per-user-per-day schema and newly explicit UI wording. Earlier dates are preserved. Last completed sequential save determines current state. No schema migration or backfill is needed or performed.

Tests: `tests/f07-weight.cjs` uses real Prisma storage and two isolated users, with controlled authentication following the existing integration-test convention. It verifies current weight across Profile source, Progress, Coach and planning calculations; weekly averages and complete records unchanged by baseline edits; clearing without historical fallback/deletion; repeated saves; today's explicit measurements and omitted-field preservation; first entry; legacy note readability; rejected invalid/unauthenticated writes; cross-user input isolation; and layout invalidation.

Limitations: the existing schema retains one measurement per day, not intraday revisions. Separate open browser tabs do not receive live synchronization. No new browser interaction test was run for the explanatory copy. Historical trends can intentionally differ from a corrected baseline; the UI now states why.

## Verification

Passing: targeted F06/F07 scripts; `tests/beta.cjs` (14 groups); `tests/phase.cjs`; `tests/next-phase.cjs`; `tests/mobile-refinement.cjs`; TypeScript; lint; Git whitespace check. Fixtures are deleted by each integration script's cleanup. No commits or pushes.

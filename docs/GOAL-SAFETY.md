# Goal safety

Scope: strengthen goal safety on the clean eae9ae7 checkpoint. No schema migration, seed changes, commit or push.

## Shared product rules

`src/lib/goal-safety.ts` is used by onboarding, Profile, saved-plan access, plan generation, adaptive planning and Coach. Weekly pace is the absolute weight difference divided by normalized weeks. These are conservative product limits, not a medical assessment or a promise that a goal is appropriate for every person.

- Weight loss: warn above the smaller of 0.5 kg/week and 0.75% of current weight/week; block above the smaller of 1 kg/week and 1% of current weight/week.
- Weight gain: block above the smaller of 0.5 kg/week and 0.5% of current weight/week; warn above half that ceiling.
- At a boundary, the less restrictive level applies. Maintaining weight proceeds normally.
- Invalid or incomplete entered goals fail closed. Legacy users without a target/timeframe can still receive ordinary lifestyle planning.
- Suggested duration uses the warning threshold, rounded up to whole weeks. Goals needing more than 520 weeks suggest a smaller intermediate goal.
- Months map to `round(months * 52 / 12)` whole weeks. All decisions use stored weeks. Existing nonstandard durations remain displayable and editable.

The original 1 kg/week loss ceiling remains intact. General background on gradual loss: [CDC, Steps for Losing Weight](https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html). Relative-weight and gain thresholds are explicit product choices, not CDC recommendations.

## Behavior

Aggressive goals retain ordinary meal and workout planning, show warnings and suggest a longer timeframe. Blocked goals must be corrected in onboarding or Profile before plans become available. Existing plans are preserved in storage. Neither portions, calorie targets nor exercise volume is increased to chase the requested pace.

Coach receives the authenticated user's persisted goal. Blocked goals are handled before any external classifier call, including follow-ups. Weight/diet/compensation requests are routed to deterministic guidance and Profile validation. The optional AI remains a classifier and cannot author unrestricted advice. No fasting, punishment exercise or extreme restriction is generated.

Goal updates resolve identity from the authenticated session and explicitly write only goal fields. They do not overwrite historical measurements or other users' goals.

## Verification

- `npm run test:goal-safety`: boundaries, invalid inputs, maintenance/gain/loss, month normalization, preserved blocked legacy plans, generator/retrieval/adaptive guards, recovery, two-user isolation, anonymous writes and Coach/provider bypass protection.
- Existing beta integration, product and HTTP/session suites pass.
- Browser onboarding: extreme 80 → 60 kg over 4 months stays on step 1; aggressive 80 → 74 kg over 10 weeks warns and proceeds; normal 80 → 75 kg over 12 weeks proceeds without a warning.
- Warning layout checked for horizontal overflow at 390, 430 and 768 pixels.

Manual follow-up: visually check the authenticated Profile editor on a phone and confirm its save/reload flow. Server-side persistence and isolation are covered by integration tests. No medical suitability assessment based on age, pregnancy or other clinical context is implemented by this pace check.

## Product-phase verification update — 26 September 2026

Authenticated Profile goal editing and save/reload were subsequently browser verified, including six-month display. Final lint, TypeScript, production build, beta, product, Goal Safety, phase and real HTTP/session tests pass. See `PRODUCT-PHASE-REPORT.md` for the complete scope and remaining manual acceptance checks.

# Gemini Coach activation

The Coach page posts to the authenticated `/api/coach` route. The route builds context for the signed-in user, reads only history since that user's current login, passes at most 12 messages to `getCoachReply`, and saves the exchange under that same user. Storage still retains the latest 50 exchanges; viewing previous conversations does not expand provider context. The Coach does not mutate plans.

Previously the optional external call used a chat-completions request to classify general questions into intent labels. It never generated a live answer. The replacement generates a conversational response using Gemini's generateContent API, grounded in stored logs and bounded conversation, with deterministic Coach advice as an optional reference. After saved activation, Gemini is the primary reasoning engine for eligible messages. Deterministic responses remain internal safety and failure fallbacks; without consent no external request is made.

## AWS environment

Set these server-side variables for the running Next.js application, then restart/redeploy it:

| Variable | Required value |
| --- | --- |
| `AI_COACH_LIVE_ENABLED` | `true` |
| `AI_API_KEY` | A valid Gemini API key, stored through the existing server secret configuration |
| `AI_API_URL` | `https://generativelanguage.googleapis.com/v1beta` |
| `AI_API_MODEL` | A Gemini model ID available to this account that supports generateContent and JSON output; configure explicitly |

The adapter appends `/models/<AI_API_MODEL>:generateContent` to the validated base URL. No model default is hardcoded. URLs outside Google's HTTPS API, URL credentials/query parameters, and redirects are rejected. Keys are sent only in the `x-goog-api-key` header. Missing/invalid configuration keeps the local fallback. `.env.example` remains disabled by default. `PHOTO_AI_*` is independent and unchanged. No deployment or secret changes were performed by this fix.

## Consent and transmitted information

AI Coach is an account preference stored as optional boolean `aiCoachEnabled` in existing `User.preferences` JSON. No migration or backfill is required. Onboarding offers “Aktivera AI Coach” / “Inte nu” with expandable privacy information, defaulting to disabled. The Account section “AI Coach & integritet” reads the saved state and provides a På/Av switch. Existing true/false values remain unchanged; missing/invalid values are disabled. Coach has no activation or consent controls. Disabled users see a small status and “Öppna Kontoinställningar” link; chat requests never change consent.

`/api/coach/preference` authenticates GET/PATCH requests and selects/updates only the signed-in user's preference. PATCH also requires the app origin, validates the boolean and merges preferences inside a transaction. Chat POST reads consent from the database; client-supplied chat consent flags are ignored. The saved preference remains authoritative, including for stale Coach tabs; changing it through the existing authenticated preference boundary cannot retract requests already sent. No browser storage is used for consent.

With consent, Gemini receives only:

- The current question (the API's existing 2000-character maximum).
- Language (`sv` or `en`).
- At most 12 recent messages from this user's current login, each capped at 1000 characters, with user/Coach roles.
- For food-related questions only, an optional checked dietary reference computed without the account name. This may contain checked meal/recipe suggestions and dietary constraints. General dialogue and training messages receive no deterministic reply to rewrite. No recipe catalog or full profile is sent.
- For activity questions and relevant follow-ups only: a seven-calendar-day summary of completed workouts (date, title/type, up to six exercise names), recorded daily steps, registered meal counts per day (completed meal keys deduplicated plus own meals), and today's workout/rest/unknown plan status. Workout entries are capped at 28 with an explicit truncation flag. No log IDs, notes, full records or other account's activity are included. Missing steps are null; empty workouts mean no completed workout was logged, not that no exercise happened. Calendar dates and Monday week start follow the existing server/app day convention.
- A fixed instruction defining the Life Happens philosophy, safety limits, language and output format.

No account ID, account name, email, password, raw profile, weight history, Coach history from previous logins, photos, work schedule or budget fields are included. User-written questions/history may themselves contain personal details; the consent text explains this and asks users to avoid sensitive details. Saved health preferences continue to influence the existing local recipe filtering/ranking, but the health preference field is not transmitted. Medical/diabetes questions remain local general guidance with the existing care-team boundary.

Livskraft does not log provider bodies/errors or credentials. Existing question/reply persistence and deletion are unchanged. Sending to Gemini is distinct from that local persistence; deleting Livskraft history does not retract information already sent to Google.

## Safety and failures

Blocked goals, incomplete profile readiness, medical/treatment/dosing requests, unsafe restriction and compensation requests stay local. The immediately previous sensitive user message keeps a direct follow-up local; unrelated later questions are not blocked by older history. Gemini uses bounded history to continue the conversation and distinguish chat statements from recorded facts. Short duration updates and equipment substitutions are recognized as follow-ups, so relevant stored activity is retained through the existing context selector. The immediately preceding sensitive message still keeps these follow-ups local. Stored activity and the supplied current plan are factual boundaries. The local reference is optional advice, not an answer boundary. Gemini may suggest alternatives without claiming that these are official plans or logged activity. The prompt explicitly states that Apple Health/Apple Watch/Android health sync is future work, unavailable in this beta. Gemini cannot invoke tools or apply plan changes, and is instructed never to diagnose, prescribe treatment, shame, require fasting or compensation, or make the user earn food. Normal wellness/goal terms do not by themselves block live generation.

Non-200 responses, network errors, a 25-second timeout, responses over 64 KiB, malformed JSON, incomplete candidates, empty/non-string/overlong replies, control characters, key echoes and detected unsafe output all return the existing local reply. Thought parts are excluded. Unsupported phone/watch synchronization claims and setup instructions are screened as well. Output screening is conservative and can fall back on benign wording that mentions prohibited subjects. Prompting and text screening are defence in depth, not a clinical validation of generated text. Safety-critical requests use deterministic replies rather than relying on screening alone.

## Verification and manual QA

Automated commands: `node tests/coach-live.cjs`, `npm run typecheck`, `git diff --check`. The targeted test mocks the external HTTP boundary and auth/history/preference storage; it does not call Google or change account data. It covers undecided/disabled accounts, activation persistence across requests, saved preference boundaries, onboarding choices and the Account On/Off control, ignored client chat consent, authenticated live replies, unauthorized access, preference origin checks, per-user/current-login isolation, history bounds, payload minimization, missing/unsafe configuration, timeout/error/invalid output, and deterministic safety/fallback behavior.

After deploying with the environment above:

1. In onboarding, review Google Gemini/privacy details and choose “Aktivera AI Coach” or “Inte nu”. After account creation, confirm Account displays the saved På/Av state. Existing users retain their saved state; missing preferences show Av.
2. In Account, turn AI Coach on and reload to confirm persistence. Ask the five-turn training conversation in Coach: eligible messages should reach Gemini automatically, without chat consent controls. Turn it off and verify Coach shows the small disabled status/settings link. Browser chat requests contain only the message; the server always reads the saved preference.
3. Ask about insulin dosing, aggressive weight loss, fasting or compensating for food. Confirm the existing safety guidance, no provider call, and no plan mutation. Follow up with “why?” and confirm the same boundary.
4. Disable `AI_COACH_LIVE_ENABLED` or test a provider outage in a disposable environment. Coach should still reply and save history, without raw provider errors. Restore the configured value afterward.
5. Log out and sign in as a different user. Confirm separate history and that user's own saved AI Coach choice; an account without a preference should show the disabled status and settings link. Opening previous conversations must not broaden external context. Delete history and verify it disappears from this account only; deleting history does not reset the AI Coach preference.

Real AWS/Gemini and browser UI QA require deployment; automated results do not claim those checks were performed.

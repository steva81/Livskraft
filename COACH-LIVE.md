# Gemini Coach activation

The Coach page posts to the authenticated `/api/coach` route. The route builds context for the signed-in user, reads only history since that user's current login, passes at most 12 messages to `getCoachReply`, and saves the exchange under that same user. Storage still retains the latest 50 exchanges; viewing previous conversations does not expand provider context. The Coach does not mutate plans.

Previously the optional external call used a chat-completions request to classify general questions into intent labels. It never generated a live answer. The replacement generates a conversational response using Gemini's generateContent API, grounded in the existing deterministic Coach advice. The original local responses remain the default and fallback.

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

The external-AI checkbox is unchecked initially and resets on page remount/account change. Each POST must contain the literal boolean `externalAIConsent: true`; missing, false or string values use local Coach without calling Gemini. Unchecking stops external calls for subsequent requests; it cannot retract a request already sent. Consent is not stored in account preferences or browser storage.

With consent, Gemini receives only:

- The current question (the API's existing 2000-character maximum).
- Language (`sv` or `en`).
- At most 12 recent messages from this user's current login, each capped at 1000 characters, with user/Coach roles.
- The relevant deterministic Coach advice, computed without the account name. Depending on the question this may contain a checked recipe/title, workout instructions, dietary constraints, or logged steps and step goal. It does not send the recipe catalog or full plan.
- A fixed instruction defining the Life Happens philosophy, safety limits, language and output format.

No account ID, account name, email, password, raw profile, weight history, Coach history from previous logins, photos, work schedule or budget fields are included. User-written questions/history may themselves contain personal details; the consent text explains this and asks users to avoid sensitive details. Saved health preferences continue to influence the existing local recipe filtering/ranking, but the health preference field is not transmitted. Medical/diabetes questions remain local general guidance with the existing care-team boundary.

Livskraft does not log provider bodies/errors or credentials. Existing question/reply persistence and deletion are unchanged. Sending to Gemini is distinct from that local persistence; unchecking or deleting Livskraft history does not retract information already sent to Google.

## Safety and failures

Blocked goals, incomplete profile readiness, medical/treatment/dosing requests, restrictive goals and compensation requests stay local. Recent sensitive user messages also keep their follow-ups local. Gemini receives checked advice as its factual boundary, cannot invoke tools or apply plan changes, and is instructed never to diagnose, prescribe treatment, shame, require fasting or compensation, or make the user earn food.

Non-200 responses, network errors, a 25-second timeout, responses over 64 KiB, malformed JSON, incomplete candidates, empty/non-string/overlong replies, control characters, key echoes and detected unsafe output all return the existing local reply. Thought parts are excluded. Output screening is conservative and can fall back on benign wording that mentions prohibited subjects. Prompting and text screening are defence in depth, not a clinical validation of generated text. Safety-critical requests use deterministic replies rather than relying on screening alone.

## Verification and manual QA

Automated commands: `node tests/coach-live.cjs`, `npm run typecheck`, `git diff --check`. The targeted test mocks the external HTTP boundary and auth/history storage; it does not call Google or change account data. It covers authenticated live replies, unauthorized GET/POST/DELETE, explicit consent, per-user/current-login isolation, history bounds, payload minimization, missing/unsafe configuration, timeout/error/invalid output, and deterministic safety/fallback behavior.

After deploying with the environment above:

1. Sign in to an account with a complete, safe profile. With the checkbox off, ask about a stressful day: local Coach should respond and save the exchange.
2. Read the disclosure and check external AI. Ask “Help me choose one manageable step for a busy day.” Confirm a useful response in Swedish/English and that it remains after reload. Reload must reset consent. Browser requests must contain no key/provider configuration; calls to Google happen server-side. Provider request metrics can confirm live calls without logging payloads.
3. Ask about insulin dosing, aggressive weight loss, fasting or compensating for food. Confirm the existing safety guidance, no provider call, and no plan mutation. Follow up with “why?” and confirm the same boundary.
4. Disable `AI_COACH_LIVE_ENABLED` or test a provider outage in a disposable environment. Coach should still reply and save history, without raw provider errors. Restore the configured value afterward.
5. Log out and sign in as a different user. Confirm separate history and unchecked consent; opening previous conversations must not broaden external context. Delete history and verify it disappears from this account only.

Real AWS/Gemini and browser UI QA require deployment; automated results do not claim those checks were performed.

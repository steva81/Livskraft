# Livskraft architecture

## System architecture

```mermaid
flowchart TB
    browser["User / Browser"] --> nginx["Nginx on AWS EC2<br/>Ubuntu"]
    nginx --> ui

    subgraph app["Next.js 15"]
        direction TB
        ui["Frontend / UI<br/>Photos: resize / re-encode<br/>Remove metadata"]
        backend["Backend / API<br/>API keys stay server-side"]
        auth["NextAuth"]
        prisma["Prisma"]
        db[("SQLite<br/>User profiles / preferences<br/>Goals / plans · Meals / nutrition<br/>Measurements / progress<br/>Coach history")]

        ui --> backend
        auth --- backend
        backend --> prisma
        prisma --> db
    end

    subgraph coach["AI Coach"]
        direction TB
        ca["Authentication<br/>Enabled check"]
        safety["Safety + user context<br/>Recent conversation"]
        cg["Gemini · external"]
        cr["Validated reply / fallback<br/>Shown to user"]

        ca --> safety
        safety --> cg
        cg --> cr
        safety -->|Local fallback| cr
    end

    subgraph photo["Photo AI"]
        direction TB
        iv["Image validation<br/>Raw images not stored"]
        pg["Gemini · external"]
        json["Structured JSON"]
        totals["Livskraft validation + totals<br/>Food items / nutrition values"]
        review["User review<br/>Before saving"]

        iv --> pg
        pg --> json
        json --> totals
        totals --> review
    end

    backend -->|User question| ca
    backend -->|Food image| iv
```

The two AI flows expand what happens behind the UI. Coach rejects requests if the user is not signed in or has not enabled AI Coach. Safety checks can select a local fallback instead of calling Gemini. Photo results are estimates that the user reviews before saving. API keys remain on the server, and Livskraft does not permanently store raw food images.

## Deployment flow

```mermaid
flowchart TD
    local["Local development"] --> git["Git<br/>Branch: main"]
    git --> github["GitHub"]
    github --> ec2["AWS EC2<br/>Ubuntu server"]
    ec2 --> build["npm production build"]
    build --> service["systemd service"]
    service --> next["Next.js production server"]
    next --> nginx["Nginx"]
    nginx --> browser["User browser"]
```

This shows the release path from local development to the server. The systemd service runs the built Next.js application. Nginx forwards browser requests to Next.js and returns its responses.

## Testing and quality

The project has been tested for:

- AI Coach: authentication, enabled checks, safety, conversation context and fallback replies.
- Photo AI: image validation, response validation, nutrition totals and review before saving.
- Saved user data / persistence: data remains available after saving and reloading.
- User isolation: users can access only their own stored data.
- Body measurements: saving and displaying measurements and progress.
- Language support: Swedish and English UI text and saved language preferences.
- TypeScript: checks for type errors.
- Production builds: checks that the application builds for production.

Automated AI tests use simulated provider responses; they do not prove that the external service is always available. These checks come from the project's existing tests and verification reports; no application tests were rerun for this documentation change.

## Short presentation explanation

Livskraft runs on an Ubuntu server on AWS EC2. Nginx forwards browser requests to the Next.js application, which is managed by systemd. Next.js provides the UI and backend, while NextAuth checks who is signed in. Prisma connects the backend to SQLite, where each user's profile, goals, plans, meals, measurements and Coach history are stored. AI Coach checks authentication, consent and safety before using Gemini, and can return a local fallback. Photo AI removes image metadata, validates the AI estimate and calculates nutrition totals before the user reviews and saves the result. API keys stay on the server, and Livskraft does not permanently store raw food images.

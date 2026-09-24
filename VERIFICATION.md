# Verifieringsrapport – Livskraft, 24 september 2026

## Utgångsläge

Projektet var redan ett Next.js 14-/Prisma-/SQLite-projekt med startsida, onboarding, dashboard, recept, träning, framsteg och påbörjad NextAuth/Coach/veckoplan. Arbetskatalogen innehöll många ocommittade ändringar före denna insats. De bevarades. next.config.mjs var redan tom och dolde inga byggfel. De två tidigare rapporterade lintfelen var redan lösta. Lint passerade; TypeScript misslyckades eftersom genererad Prisma-klient saknade nya modellfält.

Konkreta brister var klartextlösenord, otillräckliga kostfilter, osäkra generiska coachbyten, ofullständig onboarding, saknad inmatning av mått, lokalt visningsläge, inköpslista från hela receptbiblioteket, förstörande seed-skript samt gamla planer med recept-ID:n och fel veckodatum.

## Ändringar och status

- NextAuth behålls. Lösenord för nya konton och seed hashas med scrypt. Äldre lösenord uppgraderas vid lyckad inloggning. Middleware leder till /login; app-layouten kontrollerar också sessionen. Server Actions använder sessionsidentitet, inte klientens userId.
- SQLite-schema kompletterades utan reset med preferenser och historiska mått. Prisma-klienten genererades om och db push lyckades. Seed lägger till saknade biblioteksobjekt utan att radera befintliga konton eller loggar.
- Onboarding sparar fler vardags-, kost-, mät- och träningsval. Servervalidering skyddar mål/tidsram och indata. Konto och första logg skapas atomiskt.
- Ingrediensfilter förbättrades för vegan, gluten, allergier, halal och kosher. Okända allergier och saknad halal/kosher-verifiering ger tomt matresultat. Filter återanvänds vid läsning av sparad plan, recept, inköpslista och coach.
- Inköpslista summerar aktuell veckas planerade receptportioner. Steg kan anges som dagens total. Måltider kan markeras klara. Vikt, midja och övriga mått kan sparas och läsas igen.
- Träning är databasbaserad: bibliotek, set/reps/tid, completion och historik. Nivå, plats, tidsbudget och antal dagar används i nya planer. UI har korta hemmaalternativ och förhindrar dubbelklick under sparande.
- Veckoplanen omfattar måndag–söndag med mat, träning och promenadråd. Felaktiga äldre kalenderveckor återgenereras; loggar bevaras. Nästa vecka kan visas. Adaptiv Vecka ändrar nästa vecka efter användarens ja; nej behåller planen.
- Enkelt/avancerat läge sparas per konto. Progress visar lagrade värden och jämför veckosnitt, inte bara en dags vikt.
- Coachens deterministiska reservsvar fungerar utan nyckel. Matförslag kommer från filtrerade recept. En extern serveradapter kan klassificera ämne, men fri LLM-text visas inte som kostråd. Adaptern är avstängd som standard och inte funktionstestad.

## Genomförda kontroller

- Lint: godkänd utan varningar.
- TypeScript: godkänd utan undantag för projektfel.
- Produktionsbygge: godkänt med Next.js ordinarie lint- och typkontroller. Webpack gav cachevarningen "Unable to snapshot resolve dependencies"; byggandet lyckades. Ingen check stängdes av.
- Nio lokala integrationstestgrupper passerade: hashning, kostkonflikter, inköpssummor, onboarding, sjudagarsplan inklusive felaktig äldre vecka, persistens, adaptiv nästa vecka, användaravgränsning/utloggade anrop och coach/Life Happens.
- Separata HTTP-tester passerade med verkliga NextAuth-sessioner för två tillfälliga konton: eget användar-ID och coachkontext, sida efter inloggning, 401 för anonymt Coach-anrop, 307 till login för samtliga sju skyddade sidor, 400 för ogiltig Coach-JSON.
- Webbläsare: startsida, redirect, demoinloggning, dashboard, receptdetaljer, summerad inköpslista, kort träningsfilter, veckoplan och avancerat läge mellan sidor. Ingen fullständig manuell genomgång av alla onboardingfält genomfördes; serverflödet täcks av integrationstest.
- Git diff --check: godkänd. Inga spårade .env- eller SQLite-filer. Källkodssökning hittade inga ignoreBuildErrors, ignoreDuringBuilds, breda eslint-disable eller localStorage-baserad identitet. AI-nyckelreferens finns endast i serverservicen.
- Inga commits, pushar, nya repos, historikåterställningar eller AWS-deploys har gjorts.

## Kvar att färdigställa

Detta är en förbättrad lokal beta, inte en färdig produktionsprodukt. Recept/näringsvärden är demoexempel och behöver professionell granskning. Portionsstorlekar och måltidsslots är inte individuellt optimerade. Utrustning sparas men styr inte ett detaljerat övningsfilter. Receptbyte i sparad plan, sparade inköpsbockar, fullständig viktgraf/månadsstatistik, bestående avböjande av adaptiva förslag och redigering av hela profilen återstår. Startsidan behåller befintlig enkel utformning.

Allergenordlistan garanterar inte tillverkarinnehåll eller korskontamination. Produktionsinloggning behöver begränsning av försök, kontoåterställning och verifiering. Tidszon hanteras fortfarande som serverns lokala tidszon. Extern AI kräver integritets-/samtyckesbeslut. Se README för detaljer och miljövariabler.

Rekommenderat nästa steg: granska lokal beta och diff, därefter prioritera granskad recept-/allergenmetadata och portions-/måltidsplanering innan bredare användartest. PostgreSQL/AWS ska hanteras separat.

## Filer i slutlig arbetskatalog

Listan nedan omfattar även ändringar som redan fanns vid starten. Ingen commit har gjorts. Nya hjälpfiler i denna insats är password.ts, preferences.ts, shopping.ts, tests/beta.cjs, tests/http.cjs och denna rapport. auth.ts, dietary.ts, plan-generator.ts, plan-types.ts och profilsidan var redan ospårade vid starten.
```text
 M .env.example
 M .gitignore
 M README.md
 M package.json
 M prisma/schema.prisma
 M prisma/seed.ts
 M src/app/(app)/coach/page.tsx
 M src/app/(app)/dashboard/page.tsx
 M src/app/(app)/layout.tsx
 M src/app/(app)/meals/page.tsx
 M src/app/(app)/plan/page.tsx
 M src/app/(app)/progress/page.tsx
 M src/app/(app)/training/page.tsx
 M src/app/actions.ts
 M src/app/api/auth/[...nextauth]/route.ts
 M src/app/api/coach/route.ts
 M src/app/login/page.tsx
 M src/app/onboarding/page.tsx
 M src/lib/ModeContext.tsx
 M src/lib/coach-service.ts
 M src/middleware.ts
 M src/types/next-auth.d.ts
 M tsconfig.json
?? VERIFICATION.md
?? src/app/(app)/profile/page.tsx
?? src/lib/auth.ts
?? src/lib/dietary.ts
?? src/lib/password.ts
?? src/lib/plan-generator.ts
?? src/lib/plan-types.ts
?? src/lib/preferences.ts
?? src/lib/shopping.ts
?? tests/beta.cjs
?? tests/http.cjs
```

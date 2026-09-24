# Livskraft – lokal beta

Svensk Next.js 14-app för mat, styrketräning och vardagsrörelse. Befintlig App Router, React 18, TypeScript, Tailwind, Prisma 5 och SQLite har bevarats. Inget har distribuerats.

## Starta lokalt

1. Installera en underhållen Node.js-version och kör `npm install`.
2. Kopiera `.env.example` till `.env`. Ange ett slumpmässigt `NEXTAUTH_SECRET` och `NEXTAUTH_URL=http://localhost:3000`.
3. Kör `npx prisma generate`, `npx prisma db push` och `npx prisma db seed`.
4. Kör `npm run dev`. För produktionsläget: `npm run build` och `npm start`.

Seed kompletterar saknade recept och pass utan att radera befintliga användare eller loggar. För befintliga biblioteksrecept uppdateras tillagningsinstruktionerna och den äldre buljongtexten förtydligas; övriga receptfält behålls. Alla elva seed-recept har utförliga instruktioner i `prisma/recipe-instructions.ts`. Demokontot är `anna@demo.com` / `password123` och märks i profilen. Skapa ett eget separat konto via onboarding för egna data. Säkerhetskopiera lokal databas före framtida schemaändringar.

## Verifierad funktionalitet

- NextAuth Credentials med serverkontrollerad JWT-session, middleware och serverkontroll i app-layouten. Server Actions härleder användaren från sessionen.
- Nya lösenord lagras som saltade scrypt-hashar. Äldre lokala klartextlösenord migreras vid lyckad inloggning; ännu oanvända äldre konton migreras inte automatiskt.
- Onboarding lagrar vikt, mål, tidsram, längd, midja, övriga mått, aktivitetsnivå, ungefärliga steg, kostval, allergier, ogillad/gillad mat, budget, matlagningstid, arbetstider, familj/resor, kyl/micro, matförberedelse och träningsval.
- Mål över 1 kg viktnedgång per vecka stoppas på både klient och server med förslag på längre tidsram. Detta är en enkel produktgräns, ingen individuell medicinsk bedömning. Ingen kalorirestriktion räknas fram. Bakgrund: [NHS råd om gradvis viktnedgång](https://www.nhs.uk/live-well/healthy-weight/managing-your-weight/tips-to-help-you-lose-weight/).
- Måndag–söndag-plan med filtrerade recept, pass och promenadförslag. Träningsnivå, plats, tid och antal dagar styr passvalet. Matlagningstid filtrerar recept; budget och gillad mat ger enkel prioritering. Vardagsval påverkar planens råd. Denna och nästa vecka kan visas.
- Träningsbibliotek med övningar, set, repetitioner, tid och sparade genomföranden. Korta hemmaalternativ och historik finns.
- Steg anges som dagens total och lagras i SQLite. Personligt mål, dagshistorik och snitt från loggade dagar visas.
- Vikt, midja och frivilliga mått kan registreras på Framsteg. Vikttrend jämför två sjudagarsperioder med minst två vägningar i vardera. En enskild vägning ändrar inte planen.
- Adaptiv vecka kräver minst fem registrerade dagar över minst sju kalenderdagar. Vid tillräckligt underlag kan den föreslå kortare pass och kortare rörelsepauser nästa vecka. Förslaget visar ändringar och skäl. Både godkännande och avböjande sparas per konto och målvecka. Endast godkända ändringar tillämpas; nuvarande vecka och måltider behålls.
- Idag visar måltider, nästa oavklarade måltid, måltidsmarkeringar, planerat pass, steg, promenad och länk till inköpslistan.
- Enkelt/avancerat läge sparas per konto och kan bytas på alla appsidor, med felmeddelande om sparandet misslyckas. Enkelt visar översikt och nästa steg; avancerat lägger till näringsvärden, mätgrafer, loggade värden och coachens kostkontext. Plan, kostregler och träningsinstruktioner är desamma.
- Recept visar ingredienser och instruktioner. Näringsvärden visas i avancerat läge. Inköpslistan summerar en receptportion per planerad måltid under aktuell vecka, med sammanslagning av samma ingrediens/enhet.

## Kostregler och begränsningar

Samma filter används av recept, plan, inköpslista och coachens matalternativ. Äldre sparade planer filtreras igen vid läsning och får aktuella receptnamn. Ingredienser styr; missvisande recepttaggar får inte tillåta vanlig mjölk för veganer eller vetemjöl vid glutenrestriktion. Okända allergier ger inga matförslag. Halal/kosher kräver uttryckligen verifierad receptmärkning; sådana recept saknas för närvarande, så matplanen blir tom medan träning och rörelse finns kvar.

Detta är ett begränsat ingrediensbaserat filter för ett litet demobibliotek, inte en garanti för tillverkares innehåll eller korskontamination. Ingrediensmetadata behöver professionell granskning och fullständig allergenmärkning före en bred beta. Näringsvärden och receptportioner är seed-exempel och är inte dietistgranskade eller individuella energimål. Inga osäkra generiska proteinbyten används av coachen.

## Coach

Standardläget är deterministiska svenska svar med profil, plan, träning och steg som kontext. Coach ger praktiska alternativ utan kompensationsfasta, straffträning, diagnoser eller läkemedelsdosering. Konversationen sparas inte.

En framtida serveradapter är förberedd. Med `AI_COACH_LIVE_ENABLED=true`, `AI_API_KEY`, `AI_API_URL` och eventuellt `AI_API_MODEL` kan en OpenAI-kompatibel endpoint klassificera frågans ämne när den lokala avsiktstolkningen inte räcker. Endast ett tillåtet ämnesord accepteras; svaret byggs fortfarande av kontrollerade mallar och filtrerade recept. Fritt LLM-genererat kostråd skickas inte till användaren. Anrop har timeout och reservsvar. Extern adapter är inte funktionstestad. Koden skickar systeminstruktion och frågetext, inte profilobjektet. Frågetext kan innehålla känsliga uppgifter; verklig användning kräver leverantörsgranskning, samtycke och integritetsflöde. Lokal coach fungerar utan extern tjänst.

## Kvarvarande förenklingar

- Planen är regelstyrd med receptrotation, inte optimerad näringsberäkning. Måltidsfördelning är tre huvudmål som justerbar utgångspunkt i rådgivningen; dynamiska måltidsslots och individuella portionsstorlekar saknas.
- Hemutrustning matchas mot kända utrustningsord per övning; nekade utrustningsposter räknas inte som tillgång och ett valfritt bänkalternativ gäller bara den aktuella övningen. Gym betyder standardutrustat gym. Detta är inte en fullständig utrustningsmodell: strukturerade krav, alternativ, viktspann och maskinvarianter krävs innan biblioteket byggs ut. Fria kroppsmått visas som anteckningar, inte som jämförbara mätserier. Budgetprioritering använder enkla ingrediensord, inte priser.
- Receptalternativ kan läsas, men ett specifikt receptbyte i en sparad plan saknar ännu UI. Inköpslistans bockar sparas inte.
- Adaptiv vecka är regelstyrd och användarvald, inte en tränad modell. Ett sparat beslut gäller målveckan; UI för att ångra beslutet saknas. Ingen automatisk kalorijustering.
- Ingen OAuth, e-postverifiering, lösenordsåterställning, produktionsklassad distribuerad inloggningsbegränsning eller wearables.
- Datum använder serverns lokala tidszon; kör lokal beta i Europe/Stockholm. Explicit användartidszon behövs före AWS.
- Startsidan är befintlig, enkel och ikonbaserad; en fullständig visuell konsumentproduktgranskning återstår.

## Kontroller

- `npm run lint`
- `npm run typecheck`
- `npm run build` – inga ignoreBuildErrors/ignoreDuringBuilds
- `npm run test:beta` – riktiga databasoperationer med kontrollerad sessionsidentitet; 14 testgrupper
- `npm run test:product` – fyra grupper för mängder/enheter, utrustning, varierade veckoråd och alla seed-recepts instruktioner; inga databasändringar
- `npm run test:http` – kör mot `npm start` på port 3000; riktiga NextAuth-sessioner, skyddade sidor och Coach-API för två separata testkonton

Testerna skapar egna konton med `example.invalid` och städar enbart dessa konton i finally. De återställer inte databas eller seed. Kör dem bara mot lokal beta. HTTP-testet ska köras med extern coach avstängd.

## Integritet och framtida AWS/PostgreSQL

`.env`, SQLite-filer inklusive journal/WAL/SHM och byggfiler ignoreras av Git. Hemligheter används bara på servern. Publik användardata från Server Actions exkluderar lösenord.

SQLite behålls lokalt. Före produktion: inventera beroendeuppdateringar, förstärk inloggningsskydd och kontolivscykel, granska kostmetadata, definiera dataradering/samtycke, sätt användartidszoner, byt Prisma-provider till PostgreSQL, skapa/testa migrationer och använd RDS. Lägg hemligheter i AWS Secrets Manager. Välj därefter hosting för Next.js och testa återställning av säkerhetskopior. Ingen AWS-deploy ingår i detta arbete.

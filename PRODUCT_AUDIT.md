# Produktgranskning från f11568e

Granskad 24 september 2026. Utgångsläget var ren `main`, synkroniserad med `origin/main`. Tidigare QA gjordes inte om vid starten. Den äldre VERIFICATION.md beskriver en tidigare insats; nedan är produktstatus för denna fortsättning.

## Redan implementerat

- Kontoseparerad lagring, in-/utloggning, målgräns, tomma loginfält och frivillig demoifyllning.
- Svenska etiketter för nivå, plats, kostval och recepttaggar. Namnet Recept används i navigationen; Veckoplan är en separat sida.
- Kostfilter återanvänds i recept, plan, inköpslista och coach. Okända allergier ger inga receptförslag.
- De fem efterfrågade coachavsikterna, dagens återstående måltider och Life Happens utan kompensation.
- Adaptivt otillräckligt underlag, konkreta ändringar/skäl, användarens ja/nej och bestående beslut. Viktgrafen bygger på vikt; steg är separat. Trend kräver flera mätningar.
- Alla elva seed-recept har fullständiga instruktioner, inklusive metoder, tid/värme där relevant och servering. Näringsvärden finns i avancerat läge.
- Startsidan har en kolumn på mobil och tre från 768 px. Den befintliga visuella identiteten och layouten behålls.
- Framtida stegsynk är dokumenterad i STEP_SYNC.md. Ingen mobilintegration finns eller har lagts till.

## Delvis implementerat vid start – kompletterat här

- **Profil:** längd, uppskattade startsteg och frivillig måttanteckning saknades trots lagring. Dessa visas nu i befintliga grupper. Startuppgifter skiljs från nya mätningar.
- **Visningsläge:** bara Idag erbjöd byte, sparfel saknade återkoppling och profilen kunde visa ett gammalt läge. Gemensam väljare finns nu på alla appsidor med sparstatus/fel. Samma plan gäller i båda lägena; nödvändiga övningsinstruktioner döljs aldrig.
- **Aktivitet:** en liten textrotation gav upprepningar på flera dagar. Sju grundtexter per dagstyp ger varierade råd; skiftarbete behåller flexibel timing. Påminnelsen om låga steg visas högst en gång per vecka. Befintlig läslogik uppdaterar vanlig aktivitetstext men bevarar godkända adaptiva aktiviteter.
- **Träning:** "Visa alla" behöll hemmafiltret. Kortfiltret sade tio minuter men tillät femton. Etikett och filter är nu samstämmiga. Negationer i utrustning hanteras, hantlar matchas mot hantelövningar och ett valfritt bänkalternativ kan inte ge ett annat passmoment tillgång till bänk.
- **Inköp:** bråktal kunde feltolkas och paket/nävar bli stycken. Bråk, vissa Unicode-bråk och fler räkneenheter hanteras. Okända angivna mått som kopp/krm behålls bokstavligt. Gram, volym, paket och portioner omvandlas aldrig sinsemellan. Portionsförtydligandet från förra QA behålls.
- **Coach:** kontexten försvann efter första frågan och tom matplan blandades ihop med färdiga måltider. Översikten finns nu kvar, skiljer tillstånden och ger mer kostkontext i avancerat läge. Snabbfrågor använder ett responsivt rutnät; skickaknappen har namn och nya svar rullas fram i samtalsytan.
- **Framsteg:** kroppsmått och träning har egna kort. Senaste måttanteckningen är tillgänglig även i enkelt läge och även om den är äldre än två veckor. Viktpunkters avstånd följer faktiska datum. Steghistorikens tvåveckorsperiod märks ut separat från sjudagarssnittet. Adaptiva beslut visar målveckans startdatum.
- **Onboarding/språk:** begripligare rubriker, korrekt beskrivning av avancerat läge, tydligare hemutrustning och namngivna profil-/träningsfält för hjälpmedel. Coach och Min profil skrivs konsekvent i navigationen.
- **Dokumentation:** rättad information om seed, adaptiva beslut, utrustningsfilter och externa coachadapterns faktiska dataöverföring.

## Avsiktligt framtida arbete

| Område | Begränsning och skäl |
| --- | --- |
| Individuella portioner | En receptportion per planerad måltid. Tillförlitliga portionsvikter, produktdata och näringsgranskning saknas. Att räkna individuella energi-/grammål nu skulle ge falsk precision. Även burkstorlek och rå/tillagad vikt behöver struktureras innan generell skalning. |
| Näring/allergener | Seed-värden är exempel. Ingrediensord kan varken verifiera produkters innehåll eller korskontamination. Professionellt granskad metadata, produktmärkning och proveniens krävs före bred användning. Inga nya medicinska garantier införs. |
| Detaljerad utrustning | Det begränsade filtret passar nuvarande lilla bibliotek, men är inte en generell språkförståelsemodell. Full katalog behöver strukturerade krav och verifierade alternativ, inte fler antaganden från fritext. |
| Produktionskonton | Återställning, e-postverifiering, distribuerad försöksbegränsning, samtycke/radering, sessionsåterkallning och drift kräver val av leverantör och säkerhets-/integritetsdesign. Lokala sessioner och befintlig hashning behålls. Ingen skenbar e-posttjänst byggs. |
| Extern coach | Adapter för ämnesklassificering finns men aktiveras eller live-testas inte. Frågetext kan vara känslig. Leverantör, samtycke och testmiljö behöver beslutas; lokal coach fortsätter fungera. |
| Övrigt | Profilredigering i sin helhet, receptbyte i sparad plan, sparade inköpsbockar, ångra adaptivt beslut, längre statistik och explicit användartidszon ingår inte. Ingen deploy eller HealthKit/Health Connect-implementation. |

## Kontroller

Riktade regressioner finns i `tests/product.cjs`. Slutliga resultat för lint, TypeScript, bygge, integration/HTTP och relevanta browserflöden dokumenteras efter körningen.

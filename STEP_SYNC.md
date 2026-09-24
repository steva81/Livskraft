# Framtida stegsynk – arkitekturskiss, inte en färdig integration

Manuell registrering fungerar och går via `src/lib/steps.ts`. `stepsRecorded` skiljer en uttryckligen sparad nolla från en dag som bara har öppnats. Äldre positiva stegloggar räknas också som registrerade. Ingen sensor-, HealthKit- eller Health Connect-åtkomst finns i webbappen.

## Föreslagen väg

1. En framtida iOS-app använder HealthKit och en Android-app använder Health Connect. Dessa är plattforms-API:er; att lägga en knapp i webbappen ger ingen faktisk åtkomst. HealthKit kräver rätt appkapabilitet och användarens tillstånd: [Apple HealthKit](https://developer.apple.com/documentation/healthkit). Android kräver bland annat rättigheten READ_STEPS: [Health Connect – kom igång](https://developer.android.com/health-and-fitness/health-connect/get-started).
2. Begär enbart läsning av steg, med en tydlig förklaring av ändamål och separat val att överföra sammanställningar till Livskraft. Inga tillstånd krävs för manuell registrering.
3. Native-klienten läser data lokalt och skickar endast nödvändiga dags-/intervallsammanställningar till en framtida autentiserad serverendpoint. Servern härleder kontot från sessionen, validerar tidszon och intervall och kontrollerar sparat samtycke. Den endpointen är inte implementerad här.
4. Skapa separata poster för källa, leverantörens post-ID, versionsnummer, lokal dag/tidszon, tidsintervall och värde. Använd idempotenta uppdateringar, hantera rättningar/raderingar och överlappande telefon-/klockdata. Summera aldrig redan aggregerade dagsvärden från flera källor eller ovanpå den manuella totalsumman.
5. Låt användaren välja automatisk källa eller manuell dagsöverstyrning. Visa källa och senaste synktid. Framtida synk ska inte tyst skriva över användarens manuella korrigering.
6. Tillstånd ska kunna återkallas både i systemet och i Livskraft. Stoppa synk och servermottagning när samtycket återkallas; erbjud separat radering av importerade data. Behåll manuell registrering. Android-appar måste kontrollera aktuella tillstånd innan åtkomst: [behörigheter och dataåtkomst](https://developer.android.com/health-and-fitness/health-connect/ui/permissions).
7. HealthKit avslöjar inte om läsbehörighet nekats; ett tomt resultat får inte presenteras som noll steg eller som ett säkert besked om behörigheten. Se [Apples auktorisering](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data).

## Före implementation

Bestäm lagringstid, samtyckesversioner, kontoborttagning, återkallande och offlinebeteende. Testa tidszonsbyte, sommartid, flera enheter, dubbel leverans, ändrade poster, återkallade rättigheter och manuella korrigeringar. Implementera PostgreSQL-migrationer och krypterad transport innan bred användning. Spara inte leverantörshemligheter i webbläsaren. Nuvarande service accepterar bara interna anrop för manuell registrering och är ingen publik import-API.

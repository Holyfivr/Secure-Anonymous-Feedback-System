
# Integritet och datahantering (SAFS)

Senast uppdaterad: 2026-03-22

1. **Personuppgiftsansvarig**
    Personuppgiftsansvarig för SAFS är Joel Seger.
    Kontakt: <joelseger87@gmail.com>

2. **Vilka personuppgifter behandlas**
    SAFS behandlar:
    - E-postadress för administratörskonton.
    - Begränsad anti-missbruksmetadata för rate limiting (en hashad, trunkerad representation av anrops-IP + anropskontext/identifierare + tidsstämpel).
    Klartext-IP lagras inte avsiktligt i SAFS datalagring.

3. **Varför e-postadress lagras**
    E-postadress behövs för att tjänsten ska fungera: skapa och hantera administratörskonton,
    möjliggöra inloggning, tilldela och kontrollera adminbehörighet.

4. **Varför IP-relaterad metadata används**
    IP-relaterad metadata används för att skydda både användarna och tjänsten mot missbruk,
    till exempel spam, brute-force-försök och annan automatiserad skadlig trafik.
    Det minskar även risken för kostnadsdrivande abuse och bidrar till en tryggare och mer stabil tjänst för legitima användare.
    SAFS lagrar inte avsiktligt klartext-IP i datalagret, utan en hashad/trunkerad representation för rate limiting.
    Informationen används inte för profilering och är inte avsedd att identifiera elever.

5. **Rättslig grund för behandling**
    Behandlingen av e-postadresser sker med stöd av berättigat intresse (Art. 6.1f GDPR). Det berättigade intresset är att kunna tillhandahålla tjänsten genom att skapa och hantera administratörskonton. Utan e-postadress kan tjänsten inte fungera.
    Behandlingen av anti-missbruksmetadata (hashad IP-data) sker med stöd av berättigat intresse (Art. 6.1f GDPR). Det berättigade intresset är att skydda tjänsten och dess användare mot missbruk, spam och attacker.

6. **Övrig data i tjänsten**
    SAFS lagrar även namn på skolor, klasser och feedbackinnehåll för att systemet ska fungera.
    Denna data är normalt inte personuppgifter i sig, men kan bli det om någon skriver in identifierande information i fritext.

7. **Säkerhet**
   - Feedback lagras krypterat i databasen.
   - Inloggning för admin- och studentrepresentantkonton hanteras av Firebase Authentication**.
   - Klassens feedbacklösenord lagras hashat och saltat, och kan inte återställas till klartext.
   - Datatillgång begränsas genom rollbaserad behörighetskontroll.

8. **Tredjepartstjänster**
    SAFS använder Google Firebase och Google Cloud för autentisering, datalagring och serverfunktioner.
    Google behandlar data enligt sina villkor som teknisk leverantör/biträde.

9. **Överföring till tredje land**
    SAFS använder Google Firebase och Google Cloud, som kan komma att behandla data utanför EU/EES. Google tillämpar EU-kommissionens standardavtalsklausuler (SCC) samt andra lämpliga skyddsåtgärder för att säkerställa att överförd data skyddas i enlighet med GDPR.
    Mer information finns i Googles databehandlingsvillkor.

10. **Lagringstid**
    - Data för skoladministratörer och feedback lagras så länge som kontot finns.
    - Data för klasser och studentrepresentanter lagras så länge som klassen finns.
    - Anti-missbruksmetadata för rate limiting lagras i pseudonymiserad form och konfigureras för TTL-rensning efter 24 timmar (faktisk raderingstid beror på Firestores TTL-process).
    - När ett konto tas bort, raderas även all data länkad till kontot.

11. **Rättigheter**
    Enligt GDPR har du rätt att:
    - Begära tillgång till dina personuppgifter (Art. 15).
    - Begära rättelse av felaktiga uppgifter (Art. 16).
    - Begära radering av dina uppgifter (Art. 17).
    - Begära begränsning av behandlingen (Art. 18).
    - Invända mot behandlingen (Art. 21).
    - Begära dataportabilitet (Art. 20).

    Eftersom SAFS inte avsiktligt* lagrar några personuppgifter utöver e-postadresser är mängden data som kan lämnas ut begränsad.
    Det går dock att radera en e-postadress på begäran, tillsammans med all data kopplad till det kontot.

    Du har även rätt att lämna in ett klagomål till Integritetsskyddsmyndigheten (IMY), som är tillsynsmyndighet i Sverige. Mer information finns på imy.se.

12. **Automatiserat beslutsfattande**
    SAFS använder inte automatiserat beslutsfattande eller profilering i den mening som avses i Art. 22 GDPR.

13. **Ändringar**
    Texten kan uppdateras vid förändringar i tjänsten eller lagkrav.
    Aktuell version publiceras i SAFS.

---

 \* *Eftersom det är tekniskt möjligt för användare att skriva in personuppgifter i inlägg, eller i klassnamn kan det innebära att denna persondata lagras.
 Det är dock inte en avsikt att lagra personuppgifter i dessa fält, och det är inte heller en avsikt att behandla sådan data som personuppgifter.
 Det är användarens ansvar att inte skriva in personuppgifter i dessa fält.*

** *Firebase Authentication lagrar lösenord som saltade kryptografiska hashar (inte klartext) och verifierar inloggning genom hash-jämförelse. SAFS får aldrig tillgång till lösenord i klartext.*

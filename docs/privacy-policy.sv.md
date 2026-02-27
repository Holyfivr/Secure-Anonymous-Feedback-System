
# Integritet och datahantering (SAFS)

Senast uppdaterad: 2026-02-25

1. **Personuppgiftsansvarig**
    Personuppgiftsansvarig för SAFS är Joel Seger.
    Kontakt: <joelseger87@gmail.com>

2. **Vilka personuppgifter behandlas**
    Den enda personuppgift som SAFS avsiktligt* lagrar är e-postadress för administratörskonton.

3. **Varför e-postadress lagras**
    E-postadress behövs för att tjänsten ska fungera: skapa och hantera administratörskonton,
    möjliggöra inloggning, tilldela och kontrollera adminbehörighet.

4. **Övrig data i tjänsten**
    SAFS lagrar även skolor, klasser och feedbackinnehåll för att systemet ska fungera.
    Denna data är normalt inte personuppgifter i sig, men kan bli det om någon skriver in identifierande information i fritext.

5. **Säkerhet**
   - Feedback lagras krypterat i databasen.
   - Inloggning för admin- och studentrepresentantkonton hanteras av Firebase Authentication**.
   - Klassens feedbacklösenord lagras hashat och saltat, och kan inte återställas till klartext.
   - Datatillgång begränsas genom rollbaserad behörighetskontroll.
  
6. **Tredjepartstjänster**
    SAFS använder Google Firebase och Google Cloud för autentisering, datalagring och serverfunktioner.
    Google behandlar data enligt sina villkor som teknisk leverantör/biträde.

7. **Lagringstid**
    - Data för skoladministratörer och feedback lagras så länge som kontot finns.
    - Data för klasser och studentrepresentanter lagras så länge som klassen finns.
    - När ett konto tas bort, raderas även all data länkad till kontot.

8. **Rättigheter**
    Enligt lag har du rätt att begära ut dina personuppgifter, få dem rättade eller borttagna.
    Eftersom SAFS inte avsiktligt* lagrar några personuppgifter utöver e-postadresser är mängden data som kan lämnas ut begränsad.
    Det går dock att radera en e-postadress på begäran, tillsammans med all data kopplad till det kontot.

9. **Ändringar**
    Texten kan uppdateras vid förändringar i tjänsten eller lagkrav.
    Aktuell version publiceras i SAFS.

---

 \* *Eftersom det är tekniskt möjligt för användare att skriva in personuppgifter i inlägg, eller i klassnamn kan det innebära att denna persondata lagras.
 Det är dock inte en avsikt att lagra personuppgifter i dessa fält, och det är inte heller en avsikt att behandla sådan data som personuppgifter.
 Det är användarens ansvar att inte skriva in personuppgifter i dessa fält.*

** *Firebase Authentication lagrar lösenord som saltade kryptografiska hashar (inte klartext) och verifierar inloggning genom hash-jämförelse. SAFS får aldrig tillgång till lösenord i klartext.*

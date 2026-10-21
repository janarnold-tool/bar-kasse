# Bar-Kasse

Web-App für die Bar nach dem Jahreskonzert: schnell kassieren und am Schluss wissen,
wie viel von welchem Getränk verkauft wurde.

- **Kassieren:** grosse Touch-Knöpfe pro Getränk (nach Kategorie gruppiert und eingefärbt),
  laufende Bestellung mit Minus-Knopf, «Abrechnen» zeigt das Total gross an,
  «Neue Bestellung» startet die nächste. Erst eine abgerechnete Bestellung zählt.
- **Auswertung:** verkaufte Anzahl und Umsatz pro Getränk über alle Laptops zusammen,
  «Zählung zurücksetzen» mit Bestätigung.
- **Einstellungen:** Getränke hinzufügen, umbenennen, entfernen, Preis, Kategorie und Symbol
  ändern, Kategorien verwalten. Gilt sofort auf allen Laptops. Kein Passwort.
- **Offline:** Fällt das Internet aus, wird normal weiterkassiert. Bestellungen bleiben auf dem
  Laptop gespeichert (auch wenn die Seite neu geladen wird) und werden automatisch nachgesendet.
  Oben rechts steht «Online» / «Offline» und wie viele Bestellungen noch ausstehen.

## Technik

- Reines HTML/CSS/JavaScript, ohne Framework. `src/` wird mit esbuild zu `public/app.js` gebündelt.
- **Cloud Firestore** (Google Firebase, Gratis-Tarif «Spark») als gemeinsame Datenbank.
  Der eingebaute Offline-Cache von Firestore übernimmt Speichern und Nachsenden.
- **Firebase Hosting** für die Webseite; ein Service Worker hält die App-Dateien im Cache,
  damit sie auch ohne Internet startet.
- Ohne eingetragene Firebase-Konfiguration läuft die App im **Testmodus** (nur auf diesem Gerät).

Ein Anlass mit einigen hundert Bestellungen auf 3 Laptops braucht nur einen Bruchteil
der Gratis-Kontingente (50'000 Lesezugriffe und 20'000 Schreibzugriffe pro Tag).

## Einrichtung (einmalig)

1. Auf <https://console.firebase.google.com> ein Projekt anlegen, z.B. `bar-kasse-mv`
   (Google Analytics kann aus bleiben).
2. **Build → Firestore Database → Datenbank erstellen**, Standort `europe-west6 (Zürich)`,
   Produktionsmodus.
3. Unter **Firestore → Regeln** den Inhalt von [`firestore.rules`](firestore.rules) einfügen
   und veröffentlichen.
4. **Projektübersicht → Web-App hinzufügen (`</>`)**, Name «Bar-Kasse», Firebase Hosting ankreuzen.
   Die angezeigten `firebaseConfig`-Werte in [`public/config.js`](public/config.js) eintragen
   (sie sind nicht geheim, sie stehen in jeder Firebase-Webseite).
5. Veröffentlichen, entweder
   - **automatisch über GitHub:** Im Repo unter *Settings → Secrets and variables → Actions*
     die Variable `FIREBASE_PROJECT_ID` und das Secret `FIREBASE_SERVICE_ACCOUNT` anlegen
     (Firebase-Konsole → Projekteinstellungen → Dienstkonten → «Neuen privaten Schlüssel
     generieren», Inhalt der JSON-Datei einfügen). Danach veröffentlicht jeder Push auf `main`.
   - **oder von Hand** auf einem Computer mit Node.js:
     `npm install`, `npx firebase login`, `npx firebase use --add`, `npm run deploy`.

Die App ist danach unter `https://<projekt>.web.app` erreichbar.

## Am Anlass

1. Auf jedem Laptop die Adresse **einmal mit Internet** öffnen (danach geht es auch offline).
   In Chrome/Edge kann die App über das Installieren-Symbol in der Adresszeile als
   eigenes Fenster installiert werden. Der Knopf ⛶ schaltet Vollbild ein.
2. In der Auswertung prüfen, dass die Zählung auf 0 steht, sonst «Zählung zurücksetzen».
3. Am Schluss: warten, bis kein Laptop mehr «ausstehend» anzeigt, dann die Auswertung ablesen.

Zurückgesetzte Zählungen werden nicht gelöscht, sondern nur nicht mehr angezeigt
(jeder Anlass hat eine eigene Nummer `epoch` in den Bestellungen).

## Entwicklung

```sh
npm install
npm run build          # src/ → public/app.js
npm run preview        # lokal unter http://127.0.0.1:5000 (Testmodus, solange config.js leer ist)
npm test               # End-to-End-Test mit Firebase-Emulator: 2 Laptops, Offline, Zurücksetzen
```

Der Test braucht Java (für den Firestore-Emulator) und Chromium für Playwright.
`?lokal` an der Adresse erzwingt den Testmodus.

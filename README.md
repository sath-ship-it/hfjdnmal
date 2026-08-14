# WARO — Material & Aufmaß

Baustellen-App für Elektro-/Sicherheitstechnik. Läuft im Browser, lässt sich
auf dem Handy installieren und als Android-APK verteilen.

## Starten

```bash
npm install
node tools/make-icons.mjs   # einmalig, erzeugt public/icons
npm run dev
```

Dann http://localhost:5173 öffnen. Produktions-Build: `npm run build`,
anschauen mit `npm run preview`.

Der Service Worker ist nur im gebauten Stand aktiv. Wer das
Aktualisierungs-Verhalten testen will, nimmt `npm run build && npm run preview`,
nicht den Dev-Server.

## Aufbau

| Datei | Inhalt |
| --- | --- |
| `src/App.jsx` | Der Prototyp — Daten, Screens und CSS in einer Datei |
| `src/Aktualisierung.jsx` | Service-Worker-Anmeldung und der Update-Hinweis |
| `src/main.jsx` | React-Einstiegspunkt |
| `vite.config.js` | Build und PWA-Einstellungen |
| `capacitor.config.json` | Die Android-Hülle |
| `tools/make-icons.mjs` | Web-Icons aus einer Vektorquelle |
| `tools/make-android-icons.mjs` | Launcher-Icons für Android |
| `.github/workflows/build.yml` | Veröffentlicht die Web-App, baut die APK |

## Wie die Aktualisierung funktioniert

Es gibt **zwei Dinge, die sich aktualisieren können**, und sie verhalten sich
völlig verschieden. Das ist der wichtigste Punkt an dieser Einrichtung:

**Der Inhalt — aktualisiert sich selbst.** Die eigentliche App liegt auf
Cloudflare Pages. Bei jedem Push baut die CI sie neu und veröffentlicht sie.
Der Service Worker in der App merkt das, lädt die neue Fassung im Hintergrund
und zeigt unten einen gelben Hinweis „Neue Fassung verfügbar". Geprüft wird
beim Start, beim Zurückholen aus dem Hintergrund, stündlich und sobald das
Netz zurückkommt.

Bewusst wird **nie ungefragt neu geladen** (`registerType: "prompt"`). Wer
gerade ein Aufmaß eintippt, verliert sonst mitten im Satz seine Eingabe. Der
Monteur tippt auf „Jetzt laden", wenn es ihm passt — oder auf „Später".

**Die Hülle — muss von Hand installiert werden.** Die APK ist nur ein dünner
WebView um die gehostete Adresse. Sie enthält keinen App-Code, deshalb ändert
sie sich praktisch nie. Wenn doch (Icon, Name, Android-Version), muss die neue
APK verteilt und installiert werden. Eine seitlich installierte APK
aktualisiert sich nicht selbst — das kann nur der Play Store.

Praktisch heißt das: **Änderungen an der App erreichen alle Handys ohne
Neuinstallation.** Nur bei Änderungen an der Hülle muss neu installiert werden.

Ohne Netz startet die App trotzdem — alles Ausgelieferte ist vorab gecacht,
inklusive Schriften. Auf einer Baustelle ist das der Normalfall, nicht die
Ausnahme.

## Einrichtung (einmalig)

**1. Cloudflare-Token anlegen.** Im Cloudflare-Dashboard unter *My Profile →
API Tokens* ein Token mit der Berechtigung **Cloudflare Pages: Edit**
erzeugen. Die Account-ID steht in der Seitenleiste der Account-Übersicht.

**2. Als GitHub-Secrets hinterlegen.** Repo → Settings → Secrets and
variables → Actions:

| Name | Inhalt |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | das erzeugte Token |
| `CLOUDFLARE_ACCOUNT_ID` | die Account-ID |

Fehlt eines von beiden, überspringt die CI das Veröffentlichen mit einer
Warnung — sie läuft nicht rot.

**3. Projektname.** Die CI legt das Pages-Projekt beim ersten Lauf selbst an.
Es heißt `waro-baustelle` (in `.github/workflows/build.yml` unter
`CF_PROJEKT`), die App landet damit auf `https://waro-baustelle.pages.dev/`.

Wer den Namen ändert, muss ihn **an zwei Stellen** ändern: dort und in
`capacitor.config.json` unter `server.url`. Sonst zeigt die APK auf eine
Adresse, unter der nichts veröffentlicht wird.

**4. APK holen.** Nach dem ersten grünen Lauf: Actions → letzter Lauf →
Artefakte → `waro-apk`. Die Datei auf das Handy kopieren und öffnen. Android
fragt einmal nach der Erlaubnis, Apps aus unbekannten Quellen zu installieren.

## APK lokal bauen

Braucht ein JDK 21 und das Android-SDK.

```bash
export ANDROID_HOME=~/android-sdk
echo "sdk.dir=$ANDROID_HOME" > android/local.properties

npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

Ergebnis: `android/app/build/outputs/apk/debug/app-debug.apk`

Die CI baut eine **Debug-APK**. Die lässt sich installieren und verteilen,
trägt aber `debuggable` im Manifest und wird vom Play Store abgelehnt. Für
eine echte Veröffentlichung braucht es einen Release-Build mit eigenem
Schlüsselspeicher — der gehört in die CI-Secrets, nicht ins Repo.

## Auf dem Handy installieren

Ohne APK geht es auch: die Adresse im Browser öffnen und „Zum Startbildschirm
hinzufügen" wählen. Dann läuft sie im Vollbild, mit Icon, offlinefähig und mit
demselben Aktualisierungs-Verhalten. Das ist der schnellste Weg zum Testen.

## Rollen

Oben in der dunklen Leiste lässt sich der angemeldete Nutzer wechseln — nur
zum Vorführen, in echt wäre man fest angemeldet.

- **Leitung** (Daniil) — alle Baustellen, Kundennamen, Stammdaten, kann
  Anforderungen zu Bestellungen bündeln.
- **Monteur / Azubi** (Alin, Felix) — nur eigene Baustellen, fordert Material
  an, sieht keine Preise und bestellt nicht selbst.

## Fachliche Kernideen

**Material** durchläuft vier Zustände: `Angefordert → Bestellt → Geliefert →
Verbaut`. Der Monteur fordert an, das Büro bestellt. In der Leitungsansicht
werden offene Anforderungen nach Lieferant gebündelt, damit eine Bestellung
pro Großhändler entsteht statt zehn Einzelabrufe.

**Aufmaß** hängt an LV-Positionen mit Soll-Menge. Erfasst wird nicht nur das
Ergebnis, sondern der *Ansatz* („3 × 12,5"), weil genau den der Prüfer beim
Kunden sehen will. Überschreitet die Summe die LV-Menge, wird das rot als
Nachtrag markiert. Pauschalbaustellen haben kein Aufmaß.

Die Ansatz-Auswertung (`rechne`) versteht `+` und `×` sowie Dezimalkommas und
arbeitet ohne `eval` — Eingaben von der Baustelle werden nicht als Code
ausgeführt.

## Backend (in Vorbereitung)

`supabase/migrations/0001_grundgeruest.sql` enthält das Datenmodell und die
Rechteregeln. Noch nicht angeschlossen — die App liest weiterhin aus den
Konstanten in `App.jsx`.

Einspielen im Supabase-Dashboard unter *SQL Editor*, oder mit der CLI:

```bash
supabase db push
```

Drei Entwurfsentscheidungen, die im Kopf der Datei begründet sind:

**`betrieb_id` in jeder Tabelle**, obwohl es vorerst nur einen Betrieb gibt.
Nachrüsten hieße später: jede Tabelle migrieren und jede Rechteregel neu
schreiben, mit echten Kundendaten drin.

**Schlüssel sind UUIDs, die das Gerät vergeben darf.** Ein Monteur im Funkloch
kann sonst nichts anlegen, weil ihm die Nummer fehlt.

**Gelöscht wird über `geloescht_am`, nicht wirklich.** Sonst kann ein Gerät
beim Abgleich nicht unterscheiden, ob ein Satz gelöscht wurde oder neu ist.

Kundenname und Ansprechpartner liegen in einer eigenen Tabelle
(`baustelle_kaufmaennisch`) statt als Spalten. Postgres-Rechte gelten pro
Rolle, und in Supabase sind alle Angemeldeten dieselbe Rolle — einzelne
Spalten lassen sich damit nicht pro Zugang wegnehmen.

Die Regeln sind gegen Postgres 16 geprüft: Monteur sieht nur eigene
Baustellen, keine Kundennamen, kann nicht bestellen; ein fremder Betrieb
sieht nichts.

## Stand

Prototyp. Alle Daten sind Konstanten in `App.jsx`, es gibt kein Backend und
keine Persistenz — ein Reload setzt alles zurück. Kamera, Mikrofon, PDF-Export
und Unterschrift sind als Oberfläche vorhanden, aber noch nicht verdrahtet
(das Mikro simuliert eine Transkription nach zwei Sekunden).

Bekannter Fehler: Im Aufmaß meldet eine Baustelle ohne hinterlegte
LV-Positionen „läuft pauschal" — das stimmt bei „Otto Hamburg" nicht, die wird
nach Einheitspreisen abgerechnet. Die beiden Fälle sind noch nicht getrennt.

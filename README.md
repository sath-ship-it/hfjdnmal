# WARO — Prototyp: Material & Aufmaß

Interaktiver Prototyp einer Baustellen-App für Elektro-/Sicherheitstechnik.
Mobiles Layout, deutschsprachig, mit Rollen-Umschalter zum Durchklicken.

## Starten

```bash
npm install
npm run dev
```

Dann http://localhost:5173 öffnen. Produktions-Build: `npm run build`.

## Aufbau

| Datei | Inhalt |
| --- | --- |
| `src/App.jsx` | Kompletter Prototyp — Daten, Screens und CSS in einer Datei |
| `src/main.jsx` | React-Einstiegspunkt |
| `src/index.css` | Reset |

Alles steckt bewusst in `App.jsx`: Solange sich Datenmodell und Screens noch
bewegen, ist eine Datei schneller zu ändern als zehn.

## Rollen

Oben in der dunklen Leiste lässt sich der angemeldete Nutzer wechseln. Der
Zugang steuert, was sichtbar ist:

- **Leitung** (Daniil) — sieht alle Baustellen, Kundennamen, Stammdaten und
  kann Anforderungen zu Bestellungen bündeln.
- **Monteur / Azubi** (Alin, Felix) — sieht nur eigene Baustellen, fordert
  Material an, sieht aber keine Preise und bestellt nicht selbst.

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

## Stand

Prototyp. Alle Daten sind Konstanten in `App.jsx`, es gibt kein Backend und
keine Persistenz — ein Reload setzt alles zurück. Kamera, Mikrofon, PDF-Export
und Unterschrift sind als Oberfläche vorhanden, aber noch nicht verdrahtet
(das Mikro simuliert eine Transkription nach zwei Sekunden).

Schriften kommen per `@import` von Google Fonts; ohne Internet fällt die App
auf Systemschriften zurück.

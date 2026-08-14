/* Startet die gebaute App und meldet, ob sie ueberhaupt hochkommt.

   Anlass: Ein Ringimport zwischen App.jsx und den Bildschirmen liess die
   App gar nicht mehr starten — sichtbar nur als graues Bild. Der Build
   lief dabei fehlerfrei durch. Genau diese Luecke schliesst dieser Test.

   Braucht playwright und einen laufenden Server:
     npm run build && npx vite preview --port 4183 &
     node tools/rauchtest.mjs http://localhost:4183/                    */
import { chromium } from "playwright";

const adresse = process.argv[2] ?? "http://localhost:4183/";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium",
});
const seite = await (await browser.newContext({ viewport:{ width:390, height:844 } })).newPage();

const fehler = [];
seite.on("pageerror", (e) => fehler.push("PAGEERROR: " + e.message));
seite.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("ERR_CONNECTION")) fehler.push("KONSOLE: " + m.text());
});

await seite.goto(adresse, { waitUntil: "domcontentloaded" });
await seite.waitForTimeout(2500);

const inhalt = await seite.evaluate(() => document.getElementById("root")?.innerHTML.length ?? -1);
const anmeldung = await seite.locator(".wr-anmelde").count();
await browser.close();

console.log(`Inhalt: ${inhalt} Zeichen · Anmeldebildschirm: ${anmeldung}`);
if (fehler.length) { console.error("Fehler:"); fehler.forEach((f) => console.error("  " + f)); }

if (inhalt < 50 || anmeldung !== 1 || fehler.length) { console.error("RAUCHTEST GESCHEITERT"); process.exit(1); }
console.log("Rauchtest bestanden.");

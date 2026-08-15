/* Prueft den Update-Weg vollstaendig durch, so wie ihn ein Telefon geht:
   alte Fassung laden, neue danebenlegen, warten bis das Band kommt, auf
   "Jetzt laden" tippen, nachsehen ob wirklich die neue Fassung dasteht.

   Anlass: <Aktualisierung/> stand nur im angemeldeten Baum. Dort meldet
   sich aber der Service Worker an — vor der ersten Anmeldung gab es
   also gar keinen. Kein Offline-Start, keine Update-Pruefung, und ein
   Geraet blieb fuer immer auf der Fassung, mit der es installiert
   wurde. Der Build lief dabei fehlerfrei durch, und der Rauchtest auch:
   die App startete ja. Nur aktualisieren konnte sie sich nicht.

   Braucht zwei Baustaende:
     npm run build && cp -r dist <ordner>/v1
     (etwas Sichtbares aendern)
     npm run build && cp -r dist <ordner>/v2
     ORDNER=<ordner> node tools/update-probe.mjs

   Die Probe erwartet, dass sich der Text in .wr-sub zwischen v1 und v2
   unterscheidet — daran erkennt sie, ob die neue Fassung ankam.       */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, rmSync, cpSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const D = process.env.ORDNER;
if (!D) { console.error("ORDNER fehlt — Ordner mit v1/ und v2/ angeben."); process.exit(2); }
const WURZEL = `${D}/live`;
const TYP = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css",
  ".json":"application/json", ".webmanifest":"application/manifest+json",
  ".png":"image/png", ".svg":"image/svg+xml", ".woff2":"font/woff2" };

const srv = createServer((q, a) => {
  const p = decodeURIComponent(q.url.split("?")[0]);
  let f = join(WURZEL, normalize(p));
  if (!existsSync(f) || statSync(f).isDirectory()) f = join(WURZEL, "index.html");
  a.writeHead(200, { "Content-Type": TYP[extname(f)] ?? "application/octet-stream",
                     "Cache-Control": "no-cache" });
  a.end(readFileSync(f));
});
await new Promise((r) => srv.listen(4190, r));

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage();
p.on("pageerror", (e) => console.log("  ! PAGEERROR", e.message));
p.on("console", (m) => { if (m.type() === "error") console.log("  ! KONSOLE", m.text()); });

const zeig = (n, s) => console.log(`${n}. ${s}`);

console.log("0. Seite laden ...");
await p.goto("http://localhost:4190/", { waitUntil: "domcontentloaded" });
console.log("0b. geladen, warte auf Service Worker ...");
const bereit = await p.evaluate(() => Promise.race([
  navigator.serviceWorker.ready.then(() => "bereit"),
  new Promise((r) => setTimeout(() => r("ZEITUEBERSCHREITUNG"), 15000)),
]));
console.log("0c. serviceWorker.ready:", bereit);
await p.waitForTimeout(1200);
await p.reload({ waitUntil: "domcontentloaded" });
await p.waitForTimeout(800);
zeig(1, "kontrolliert nach Reload: " + await p.evaluate(() => !!navigator.serviceWorker.controller));
const alt = (await p.locator(".wr-sub").first().textContent()).slice(0, 40);
zeig(2, "sichtbarer Text: " + alt);

// neue Fassung danebenlegen
rmSync(WURZEL, { recursive: true, force: true });
cpSync(`${D}/v2`, WURZEL, { recursive: true });
zeig(3, "neue Fassung liegt auf dem Server");

// Ab hier ueber die Oberflaeche, nicht ueber die Konsole: das Band
// muss von selbst kommen und der Knopf muss es tun.
await p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });

let band = false;
try { await p.locator(".wr-update").waitFor({ state: "visible", timeout: 20000 }); band = true; } catch {}
zeig(4, "Band erschienen: " + band + (band ? " — \"" + (await p.locator(".wr-update-t").textContent()) + "\"" : ""));
if (!band) { await b.close(); srv.close(); process.exit(1); }

const knopf = p.locator(".wr-update-b");
zeig(5, "Knopf: \"" + (await knopf.textContent()) + "\"");
await Promise.all([
  p.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => zeig(6, "kein Neuladen ausgeloest")),
  knopf.click(),
]);
await p.waitForTimeout(1200);
const text = (await p.locator(".wr-sub").first().textContent()).slice(0, 40);
zeig(7, "sichtbarer Text nach dem Knopf: " + text);
zeig(8, text === alt ? "KNOPF HAT NICHTS BEWIRKT" : "KNOPF FUNKTIONIERT");

await b.close(); srv.close();
process.exit(text === alt ? 1 : 0);

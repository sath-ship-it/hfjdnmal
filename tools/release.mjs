/* Baut alles, was zu einer Fassung gehört, in der richtigen Reihenfolge.

   Aufruf: WARO_FASSUNG=1.0.9 node tools/release.mjs

   Es sind zwei verschiedene Bauten nötig, und sie zu verwechseln ist der
   Fehler, den dieses Skript verhindern soll:

   - für die APP (und damit auch für das Nachlade-Paket): ohne Service
     Worker, mit eingebetteten Schriften. In einem Paket, das mitgeliefert
     wird, wuerde ein Service Worker nach einem Update noch die alten
     Dateien ausliefern.
   - fuer die WEBSEITE: mit Service Worker, Schriften von aussen. Dort
     ist der Service Worker gerade erwuenscht.

   Danach von Hand:
     cd android && ./gradlew assembleDebug
     cp <apk> dist/waro.apk && npx wrangler pages deploy dist            */
import { execFileSync } from "node:child_process";
import { mkdirSync, cpSync, rmSync, existsSync, statSync } from "node:fs";

const fassung = process.env.WARO_FASSUNG;
if (!fassung) { console.error("WARO_FASSUNG fehlt, z. B. WARO_FASSUNG=1.0.9"); process.exit(1); }

const lauf = (b, a, umgebung = {}, ordner) =>
  execFileSync(b, a, { stdio: "inherit", cwd: ordner, env: { ...process.env, ...umgebung } });

const ZWISCHEN = "/tmp/waro-paket";
rmSync(ZWISCHEN, { recursive: true, force: true });
mkdirSync(ZWISCHEN, { recursive: true });

/* ── 1. App-Bau: ohne Service Worker, Schriften eingebettet ── */
console.log(`\n── App-Teil bauen (Fassung ${fassung}) ──`);
lauf("node", ["tools/build-apk.mjs"], { WARO_FASSUNG: fassung });

/* ── 2. Daraus das Nachlade-Paket schnüren ── */
console.log("\n── Nachlade-Paket ──");
lauf("zip", ["-r", "-q", `${ZWISCHEN}/waro-${fassung}.zip`, ".",
             "-x", "pakete/*", "waro.apk", "aktuell.json", "app.html"], {}, "dist");
const groesse = statSync(`${ZWISCHEN}/waro-${fassung}.zip`).size;
console.log(`  waro-${fassung}.zip (${(groesse / 1024).toFixed(0)} kB)`);

/* ── 3. In das Android-Projekt übertragen ── */
console.log("\n── Nach Android übertragen ──");
lauf("npx", ["cap", "sync", "android"]);

/* ── 4. Web-Bau: mit Service Worker ── */
console.log("\n── Web-Teil bauen ──");
lauf("npm", ["run", "build"], { BASE_PATH: "/", WARO_FASSUNG: fassung });

/* ── 5. Paket und Manifest zur Webseite legen ── */
mkdirSync("dist/pakete", { recursive: true });
cpSync(`${ZWISCHEN}/waro-${fassung}.zip`, `dist/pakete/waro-${fassung}.zip`);
execFileSync("node", ["-e", `
  require("fs").writeFileSync("dist/aktuell.json", JSON.stringify({
    version: ${JSON.stringify(fassung)},
    url: "https://waro-baustelle.pages.dev/pakete/waro-${fassung}.zip",
    stand: new Date().toISOString().slice(0,10),
  }, null, 2) + "\\n");
`]);

if (!existsSync("dist/aktuell.json")) { console.error("aktuell.json fehlt"); process.exit(1); }
console.log(`\nFertig. Jetzt die APK bauen und dist veröffentlichen.`);

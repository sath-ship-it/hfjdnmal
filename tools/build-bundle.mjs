/* Schnürt die gebaute Oberfläche zu einem Paket, das installierte Apps
   nachladen können — damit Änderungen ohne Neuinstallation ankommen.

   Aufruf: WARO_FASSUNG=1.0.9 node tools/build-bundle.mjs

   Ergebnis in dist/:
     pakete/waro-<fassung>.zip   das Paket
     aktuell.json                worauf die App schaut

   Wichtig: Ins Paket gehört nur die Oberfläche. Die APK und ältere
   Pakete bleiben draußen — sonst wächst jedes Paket um alle vorherigen. */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, statSync } from "node:fs";

const fassung = process.env.WARO_FASSUNG;
if (!fassung) { console.error("WARO_FASSUNG fehlt, z. B. WARO_FASSUNG=1.0.9"); process.exit(1); }
if (!existsSync("dist/index.html")) { console.error("dist fehlt — zuerst bauen."); process.exit(1); }

const ORDNER = "dist/pakete";
const NAME = `waro-${fassung}.zip`;
mkdirSync(ORDNER, { recursive: true });

/* Aus dist heraus zippen, damit index.html im Wurzelverzeichnis des
   Pakets liegt — genau da erwartet es der Nachlade-Mechanismus. */
execFileSync("zip", [
  "-r", "-q", `pakete/${NAME}`, ".",
  "-x", "pakete/*", "waro.apk", "aktuell.json", "app.html",
], { cwd: "dist" });

const groesse = statSync(`${ORDNER}/${NAME}`).size;

writeFileSync("dist/aktuell.json", JSON.stringify({
  version: fassung,
  url: `https://waro-baustelle.pages.dev/pakete/${NAME}`,
  stand: new Date().toISOString().slice(0, 10),
}, null, 2) + "\n");

console.log(`Paket: ${ORDNER}/${NAME} (${(groesse / 1024).toFixed(0)} kB)`);
console.log(`aktuell.json zeigt auf Fassung ${fassung}`);

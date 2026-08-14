/* Baut die App zu EINER HTML-Datei ohne jede externe Abhängigkeit —
   zum Verschicken, Anschauen oder Ablegen. Kein Server nötig, Doppelklick
   genügt. Schriften werden eingebettet, der Service Worker entfällt.

   Aufruf: node tools/build-vorschau.mjs
   Ergebnis: vorschau/waro.html                                          */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

const TMP = "vorschau/.schriften";
const ZIEL = "vorschau/waro.html";
const SCHRIFTEN =
  "https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800" +
  "&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap";
// Ohne Browser-Kennung liefert Google die alten TTF-Verweise statt woff2.
const BROWSER = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

const hole = (url, datei) => execFileSync("curl", ["-sSL", "-A", BROWSER, url, "-o", datei]);

mkdirSync(TMP, { recursive: true });

/* 1 — Bauen, mit abgeschaltetem Service Worker */
console.log("Baue (ohne Service Worker) …");
execFileSync("npx", ["vite", "build"], {
  stdio: "inherit",
  env: { ...process.env, PWA_DISABLE: "1", BASE_PATH: "/" },
});

/* 2 — Schriften holen; nur das Latin-Subset, das deckt Umlaute,
       × (U+00D7), · (U+00B7) und – (U+2013) ab */
console.log("Hole Schriften …");
hole(SCHRIFTEN, `${TMP}/fonts.css`);
const bloecke = readFileSync(`${TMP}/fonts.css`, "utf8").split("/*").slice(1)
  .map((b) => ({ subset: b.slice(0, b.indexOf("*/")).trim(), body: b.slice(b.indexOf("*/") + 2) }))
  .filter((b) => b.subset === "latin");

let fontCss = "";
for (const [i, b] of bloecke.entries()) {
  const url = b.body.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
  if (!url) continue;
  hole(url, `${TMP}/f${i}.woff2`);
  const fam = b.body.match(/font-family:\s*'([^']+)'/)[1];
  const wght = b.body.match(/font-weight:\s*(\d+)/)?.[1] ?? "400";
  fontCss += `@font-face{font-family:'${fam}';font-style:normal;font-weight:${wght};font-display:swap;`
    + `src:url(data:font/woff2;base64,${readFileSync(`${TMP}/f${i}.woff2`).toString("base64")}) format('woff2');}\n`;
}
console.log(`  ${bloecke.length} Schnitte eingebettet`);

/* 3 — Bau-Ergebnis einlesen */
const alle = readdirSync("dist/assets");
const jsDatei = alle.find((f) => /^index-.*\.js$/.test(f));
if (!jsDatei) throw new Error("Eintrittspunkt index-*.js fehlt in dist/assets");
const appCss = readFileSync(`dist/assets/${alle.find((f) => f.endsWith(".css"))}`, "utf8");
let js = readFileSync(`dist/assets/${jsDatei}`, "utf8");

// Der @import auf Google Fonts ist jetzt überflüssig und würde offline scheitern
js = js.replace(/@import url\(['"]https:\/\/fonts\.googleapis\.com[^)]*\);?/g, "");

/* 4 — Alles über ASCII als \uXXXX escapen. Die Datei wird oft ohne
       Charset-Angabe ausgeliefert; rein-ASCII rendert dann trotzdem
       korrekt. In String- wie Regex-Literalen gültig, also bleibt auch
       das /×/g im Ansatz-Rechner heil. */
js = js.replace(/[^\x00-\x7F]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));

writeFileSync(ZIEL, `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>WARO Baustellen-App</title>
<style>
${fontCss}${appCss}
html,body{margin:0;padding:0;background:#20262A;}
*,*::before,*::after{box-sizing:border-box;}
</style></head><body><div id="root"></div>
<script type="module">
${js}
</script></body></html>
`);

rmSync(TMP, { recursive: true, force: true });
console.log(`Fertig: ${ZIEL} (${(readFileSync(ZIEL).length / 1024).toFixed(0)} kB)`);

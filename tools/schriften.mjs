/* Holt die Schriften und legt sie als public/schriften.css ab.

   Laeuft VOR dem Bauen, damit die Datei im Ergebnis landet und der
   Service Worker sie mit vorab cacht. Wuerde sie erst danach
   dazukommen, waere sie ohne Netz nicht da — und die App saehe auf der
   Baustelle anders aus als gedacht.

   Aufruf: node tools/schriften.mjs                                   */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ZIEL = "public/schriften.css";
if (existsSync(ZIEL) && !process.env.SCHRIFTEN_NEU) {
  console.log("schriften.css liegt schon vor (SCHRIFTEN_NEU=1 erzwingt neu)");
  process.exit(0);
}

const TMP = "/tmp/waro-schriften";
const QUELLE = "https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800" +
  "&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap";
const BROWSER = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const hole = (url, datei) => execFileSync("curl", ["-sSL", "-A", BROWSER, url, "-o", datei]);

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync("public", { recursive: true });

hole(QUELLE, `${TMP}/f.css`);
/* Nur Latin: deckt Umlaute, x (U+00D7), Mittelpunkt und Halbgeviertstrich ab. */
const bloecke = readFileSync(`${TMP}/f.css`, "utf8").split("/*").slice(1)
  .map((b) => ({ subset: b.slice(0, b.indexOf("*/")).trim(), body: b.slice(b.indexOf("*/") + 2) }))
  .filter((b) => b.subset === "latin");

let css = "";
for (const [i, b] of bloecke.entries()) {
  const url = b.body.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
  if (!url) continue;
  hole(url, `${TMP}/${i}.woff2`);
  const fam = b.body.match(/font-family:\s*'([^']+)'/)[1];
  const wght = b.body.match(/font-weight:\s*(\d+)/)?.[1] ?? "400";
  css += `@font-face{font-family:'${fam}';font-style:normal;font-weight:${wght};font-display:swap;`
    + `src:url(data:font/woff2;base64,${readFileSync(`${TMP}/${i}.woff2`).toString("base64")}) format('woff2');}\n`;
}
writeFileSync(ZIEL, css);
rmSync(TMP, { recursive: true, force: true });
console.log(`${ZIEL}: ${bloecke.length} Schnitte, ${(css.length / 1024).toFixed(0)} kB`);

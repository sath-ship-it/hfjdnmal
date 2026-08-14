/* Baut den Web-Teil so, dass er vollständig IN der APK liegt:
   ohne Service Worker und mit eingebetteten Schriften.

   Warum die Schriften: Ohne sie lädt die App beim ersten Start Archivo
   und IBM Plex von Google nach. Im Funkloch — also auf der Baustelle —
   sieht sie dann anders aus als gedacht. Eine App soll nichts
   nachladen müssen, um vollständig zu sein.

   Aufruf: node tools/build-apk.mjs   (danach npx cap sync android)   */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

const TMP = "dist/.schriften";
const SCHRIFTEN =
  "https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800" +
  "&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap";
const BROWSER = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const hole = (url, ziel) => execFileSync("curl", ["-sSL", "-A", BROWSER, url, "-o", ziel]);

/* 1 — Bauen: ohne Service Worker. In der APK wäre er schädlich, weil er
       die mitgelieferten Dateien cacht und nach einem App-Update noch
       die alten ausliefern würde. */
console.log("Baue für die APK (ohne Service Worker) …");
execFileSync("npx", ["vite", "build"], {
  stdio: "inherit",
  env: { ...process.env, PWA_DISABLE: "1", BASE_PATH: "/" },
});

/* 2 — Schriften einbetten, nur Latin (deckt Umlaute, ×, ·, – ab) */
mkdirSync(TMP, { recursive: true });
hole(SCHRIFTEN, `${TMP}/fonts.css`);
const bloecke = readFileSync(`${TMP}/fonts.css`, "utf8").split("/*").slice(1)
  .map((b) => ({ subset: b.slice(0, b.indexOf("*/")).trim(), body: b.slice(b.indexOf("*/") + 2) }))
  .filter((b) => b.subset === "latin");

let css = "";
for (const [i, b] of bloecke.entries()) {
  const url = b.body.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
  if (!url) continue;
  hole(url, `${TMP}/f${i}.woff2`);
  const fam = b.body.match(/font-family:\s*'([^']+)'/)[1];
  const wght = b.body.match(/font-weight:\s*(\d+)/)?.[1] ?? "400";
  css += `@font-face{font-family:'${fam}';font-style:normal;font-weight:${wght};font-display:swap;`
    + `src:url(data:font/woff2;base64,${readFileSync(`${TMP}/f${i}.woff2`).toString("base64")}) format('woff2');}\n`;
}
console.log(`  ${bloecke.length} Schnitte eingebettet`);

/* 3 — Den @import auf Google entfernen und die Schriften stattdessen
       fest in die Seite legen. */
const jsDatei = readdirSync("dist/assets").find((f) => /^index-.*\.js$/.test(f));
const jsPfad = `dist/assets/${jsDatei}`;
const vorher = readFileSync(jsPfad, "utf8");
const nachher = vorher.replace(/@import url\(['"]https:\/\/fonts\.googleapis\.com[^)]*\);?/g, "");
if (vorher === nachher) console.warn("  ACHTUNG: kein @import gefunden — bitte prüfen");
writeFileSync(jsPfad, nachher);

writeFileSync("dist/schriften.css", css);
const html = readFileSync("dist/index.html", "utf8");
writeFileSync("dist/index.html",
  html.replace("</head>", `  <link rel="stylesheet" href="/schriften.css">\n  </head>`));

rmSync(TMP, { recursive: true, force: true });
console.log(`Fertig. Schriften: ${(css.length / 1024).toFixed(0)} kB, liegen in der APK.`);

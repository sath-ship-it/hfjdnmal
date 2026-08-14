/* Erzeugt die App-Icons aus einer Vektorquelle.

   Das Zeichen: ein F aus drei Balken, die Arme nach rechts versetzt —
   Flux heisst Fluss, und der Versatz laesst die Arme nach rechts
   laufen. Gezeichnet statt gesetzt: keine Schriftabhaengigkeit, in
   jeder Groesse scharf.

   Aufruf: node tools/make-icons.mjs */
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";

const GELB = "#FFCC00";
const TINTE = "#14181B";

/* pad = Anteil Rand. Maskable-Icons werden von Android beschnitten,
   deshalb dort deutlich mehr Luft um das Zeichen. */
const svg = (size, pad, mitGrund = true) => {
  const m = size * pad;
  const w = size - 2 * m;
  const d = w * 0.19;                 // Balkenstaerke
  const x = (f) => m + w * f;
  const y = (f) => m + w * f;
  const r = d * 0.28;                 // leicht gerundete Ecken
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
       ${mitGrund ? `<rect width="${size}" height="${size}" fill="${GELB}"/>` : ""}
       <g fill="${TINTE}">
         <rect x="${x(0.06)}" y="${y(0)}"    width="${d}"        height="${w}"      rx="${r}"/>
         <rect x="${x(0.06)}" y="${y(0)}"    width="${w * 0.94}" height="${d}"      rx="${r}"/>
         <rect x="${x(0.06)}" y="${y(0.42)}" width="${w * 0.70}" height="${d}"      rx="${r}"/>
       </g>
     </svg>`
  );
};

mkdirSync("public/icons", { recursive: true });

const ziele = [
  { datei: "icon-192.png", size: 192, pad: 0.16 },
  { datei: "icon-512.png", size: 512, pad: 0.16 },
  // Maskable: Android schneidet bis zu 20 % ringsum weg
  { datei: "icon-192-maskable.png", size: 192, pad: 0.28 },
  { datei: "icon-512-maskable.png", size: 512, pad: 0.28 },
  // Adaptive-Icon-Vordergrund für die APK
  { datei: "icon-1024.png", size: 1024, pad: 0.16 },
];

for (const { datei, size, pad } of ziele) {
  await sharp(svg(size, pad)).png().toFile(`public/icons/${datei}`);
  console.log("  public/icons/" + datei);
}

// Favicon als SVG — skaliert verlustfrei im Browser-Tab
writeFileSync("public/icons/icon.svg", svg(512, 0.16).toString());
console.log("  public/icons/icon.svg");

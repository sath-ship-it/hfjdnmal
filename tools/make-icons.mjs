/* Erzeugt die App-Icons aus einer Vektorquelle.
   Zeichen statt Schrift: das Signal-Gelb als Grund, das W als Zickzack —
   keine Schriftabhängigkeit, in jeder Größe scharf.
   Aufruf: node tools/make-icons.mjs */
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";

const GELB = "#FFCC00";
const TINTE = "#14181B";

/* pad = Anteil Rand. Maskable-Icons werden von Android beschnitten,
   deshalb dort deutlich mehr Luft um das Zeichen. */
const svg = (size, pad) => {
  const m = size * pad;          // Rand
  const w = size - 2 * m;        // Zeichenfläche
  const oben = m + w * 0.24;
  const unten = m + w * 0.76;
  const x = (f) => m + w * f;
  const strich = w * 0.15;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
       <rect width="${size}" height="${size}" fill="${GELB}"/>
       <path d="M ${x(0)} ${oben} L ${x(0.25)} ${unten} L ${x(0.5)} ${oben + w * 0.26}
                L ${x(0.75)} ${unten} L ${x(1)} ${oben}"
             fill="none" stroke="${TINTE}" stroke-width="${strich}"
             stroke-linejoin="round" stroke-linecap="round"/>
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

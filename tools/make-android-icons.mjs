/* Schreibt die Android-Launcher-Icons aus derselben Vektorquelle wie die
   Web-Icons, damit App und Startbildschirm dasselbe Zeichen tragen.
   Aufruf: node tools/make-android-icons.mjs   (nach `npx cap add android`) */
import sharp from "sharp";
import { writeFileSync, existsSync } from "node:fs";

const GELB = "#FFCC00";
const TINTE = "#14181B";
const RES = "android/app/src/main/res";

if (!existsSync(RES)) {
  console.error(`${RES} fehlt — zuerst "npx cap add android" ausführen.`);
  process.exit(1);
}

/* mitGrund=false liefert das Zeichen auf durchsichtigem Grund: den Grund
   malt bei adaptiven Icons Android selbst (ic_launcher_background). */
const svg = (size, pad, mitGrund) => {
  const m = size * pad, w = size - 2 * m;
  const d = w * 0.19, r = d * 0.28;
  const x = (f) => m + w * f, y = (f) => m + w * f;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
       ${mitGrund ? `<rect width="${size}" height="${size}" fill="${GELB}"/>` : ""}
       <g fill="${TINTE}">
         <rect x="${x(0.06)}" y="${y(0)}"    width="${d}"        height="${w}" rx="${r}"/>
         <rect x="${x(0.06)}" y="${y(0)}"    width="${w * 0.94}" height="${d}" rx="${r}"/>
         <rect x="${x(0.06)}" y="${y(0.42)}" width="${w * 0.70}" height="${d}" rx="${r}"/>
       </g>
     </svg>`
  );
};

/* Die fünf Dichtestufen. Kantenlänge des Legacy-Icons je Stufe. */
const dichten = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

for (const [dichte, size] of Object.entries(dichten)) {
  const ordner = `${RES}/mipmap-${dichte}`;
  // Legacy: Zeichen auf gelbem Grund, wenig Rand
  await sharp(svg(size, 0.16, true)).png().toFile(`${ordner}/ic_launcher.png`);
  await sharp(svg(size, 0.16, true)).png().toFile(`${ordner}/ic_launcher_round.png`);
  /* Adaptiv: Android beschneidet den Vordergrund auf 66/108 der Fläche,
     deshalb ~27 % Rand, sonst werden die Spitzen des W abgeschnitten. */
  await sharp(svg(Math.round(size * 1.5), 0.28, false)).png()
    .toFile(`${ordner}/ic_launcher_foreground.png`);
  console.log(`  mipmap-${dichte} (${size}px)`);
}

writeFileSync(`${RES}/values/ic_launcher_background.xml`,
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${GELB}</color>
</resources>
`);
console.log("  values/ic_launcher_background.xml →", GELB);

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

/* Basis-Pfad: lokal "/", auf GitHub Pages "/<repo>/".
   Die CI setzt BASE_PATH, damit derselbe Code an beiden Orten läuft. */
const base = process.env.BASE_PATH || "/";

/* Die App muss ihre eigene Fassung kennen, um sie mit der auf dem
   Server zu vergleichen. Kommt beim Bauen herein. */
const fassung = process.env.WARO_FASSUNG || "dev";

export default defineConfig({
  base,
  define: { __FASSUNG__: JSON.stringify(fassung) },
  plugins: [
    react(),
    VitePWA({
      /* Für die Einzeldatei-Vorschau (siehe tools/build-vorschau.mjs) hat ein
         Service Worker keinen Sinn — dort ist er abgeschaltet, und der
         Update-Hinweis wird dadurch zur Attrappe, die nie erscheint. */
      disable: process.env.PWA_DISABLE === "1",
      /* "prompt" statt "autoUpdate": es wird NIE ungefragt neu geladen.
         Ein Monteur, der gerade ein Aufmaß eintippt, verliert sonst
         mitten im Satz seine Eingabe. Stattdessen erscheint ein Hinweis,
         und er entscheidet wann. */
      registerType: "prompt",
      includeAssets: ["icons/icon.svg", "icons/icon-192.png"],
      manifest: {
        name: "FLUX — Material & Aufmaß",
        short_name: "FLUX",
        description: "Baustellen-App für Material-Anforderung und Aufmaß",
        lang: "de",
        dir: "ltr",
        start_url: base,
        scope: base,
        display: "standalone",
        orientation: "portrait",
        background_color: "#20262A",
        theme_color: "#14181B",
        categories: ["business", "productivity"],
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        /* Alles Ausgelieferte vorab cachen — die App startet damit auch
           im Funkloch, und genau das ist auf einer Baustelle der Normalfall. */
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        cleanupOutdatedCaches: true,
        /* Ohne navigateFallback zeigt ein Reload offline die Fehlerseite. */
        navigateFallback: base + "index.html",
      },
    }),
  ],
  server: { host: true },
});

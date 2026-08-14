/* ─────────────────────────────────────────────────────────────
   Aktualisierung der App ohne Neuinstallation.

   Die Oberfläche liegt in der APK, damit die App ohne Netz startet.
   Der Preis dafür war bisher: jede Änderung brauchte eine neue
   Installation. Dieses Modul hebt das auf — es lädt eine neue
   Fassung als Paket nach und tauscht sie beim nächsten Start.

   Der native Teil (Android) bleibt unberührt. Nur wenn sich am
   Android-Projekt selbst etwas ändert — Icon, Berechtigungen, ein
   neues Modul — braucht es wieder eine echte Installation.

   Sicherheitsnetz des Moduls: Startet eine nachgeladene Fassung nicht
   sauber, kehrt es beim übernächsten Start von allein zur letzten
   funktionierenden zurück. Dafür ist notifyAppReady() da.
   ───────────────────────────────────────────────────────────── */

const MANIFEST = "https://waro-baustelle.pages.dev/aktuell.json";

/* Beim Bauen eingesetzt, siehe vite.config.js */
export const FASSUNG = typeof __FASSUNG__ === "string" ? __FASSUNG__ : "dev";

const inApp = () => !!globalThis.Capacitor?.isNativePlatform?.();

async function modul() {
  const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
  return CapacitorUpdater;
}

/* Muss früh laufen: Ohne diese Meldung hält das Modul die gerade
   gestartete Fassung für kaputt und rollt sie zurück. */
export async function alsLauffaehigMelden() {
  if (!inApp()) return;
  try { (await modul()).notifyAppReady(); }
  catch (e) { console.warn("notifyAppReady:", e?.message ?? e); }
}

/* Vergleicht "1.0.9" mit "1.0.10" richtig — ein Textvergleich nicht. */
function neuer(a, b) {
  const z = (v) => String(v).split(".").map((n) => parseInt(n, 10) || 0);
  const [x, y] = [z(a), z(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) > (y[i] ?? 0)) return true;
    if ((x[i] ?? 0) < (y[i] ?? 0)) return false;
  }
  return false;
}

/* Sieht nach, ob es etwas Neueres gibt. Gibt die Fassungsnummer
   zurück oder null. Wirft nur bei echten Fehlern, nicht im Funkloch. */
export async function nachUpdateSehen() {
  if (!inApp()) return null;
  const antwort = await fetch(MANIFEST + "?t=" + Date.now(), { cache: "no-store" });
  if (!antwort.ok) throw new Error(`Server antwortet mit ${antwort.status}`);
  const { version, url } = await antwort.json();
  if (!version || !url) throw new Error("Angaben auf dem Server unvollständig.");
  return neuer(version, FASSUNG) ? { version, url } : null;
}

/* Lädt und setzt die neue Fassung. Aktiv wird sie beim nächsten Start
   der App — deshalb meldet die Oberfläche danach "beim nächsten Öffnen". */
/* Bricht ab, statt ewig zu haengen. Ein Paket von einem halben Megabyte
   ist auch bei magerem Empfang in zwei Minuten da; laenger heisst, dass
   etwas klemmt — und dann will man das sehen, nicht warten. */
const mitFrist = (versprechen, ms, was) => Promise.race([
  versprechen,
  new Promise((_, weg) => setTimeout(() => weg(new Error(`${was} dauert zu lange — abgebrochen.`)), ms)),
]);

export async function updateLaden({ version, url }) {
  const M = await modul();
  const paket = await mitFrist(M.download({ url, version }), 120000, "Das Laden");
  if (!paket?.id) throw new Error("Das Paket kam unvollständig an.");
  await M.set(paket);
  return version;
}

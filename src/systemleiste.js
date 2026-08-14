/* Systemleisten in der Android-App.

   Ab Android 15 (targetSdk 35+) zeichnen Apps zwingend randlos — der
   Webteil liegt also unter Status- und Navigationsleiste. Ohne
   Gegenmaßnahme überlappt die Uhrzeit die Kopfzeile der App.

   Zwei Wege, beide nötig:
   1) In der APK sagt das Statusleisten-Modul dem System, es soll den
      Bereich freihalten. Das ist der saubere Weg, greift aber nur dort.
   2) Im Browser und als Startbildschirm-App gibt es kein Modul —
      dort trägt env(safe-area-inset-*) den Abstand, siehe STIL. */

/* Muss zu --g in STIL passen, sonst sieht man oben eine Kante. */
const GRUND_HELL = "#EFF2F1";
const GRUND_DUNKEL = "#12171A";

export function systemleisteEinrichten() {
  /* Läuft nur in der App; im Browser gibt es window.Capacitor nicht. */
  if (!globalThis.Capacitor?.isNativePlatform?.()) return;

  const dunkel = globalThis.matchMedia?.("(prefers-color-scheme: dark)");

  const setzen = async () => {
    try {
      const { StatusBar, Style } = await import("@capacitor/status-bar");
      /* Nicht mehr überlagern: Android schiebt den Webteil darunter. */
      await StatusBar.setOverlaysWebView({ overlay: false });
      const ist = !!dunkel?.matches;
      /* Style.Dark heisst "helle Symbole" — also für dunklen Grund. */
      await StatusBar.setStyle({ style: ist ? Style.Dark : Style.Light });
      await StatusBar.setBackgroundColor({ color: ist ? GRUND_DUNKEL : GRUND_HELL });
    } catch (e) {
      /* Kein Grund, die App nicht zu starten — dann greift der
         CSS-Abstand aus Weg 2. */
      console.warn("Statusleiste nicht einstellbar:", e?.message ?? e);
    }
  };

  setzen();
  /* Wer nachts umschaltet, soll die Leiste mitziehen sehen. */
  dunkel?.addEventListener?.("change", setzen);
}

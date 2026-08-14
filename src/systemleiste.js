/* Systemleisten in der Android-App.

   Ab Android 15 (targetSdk 35+) zeichnen Apps zwingend randlos — der
   Webteil liegt also unter Status- und Navigationsleiste. Ohne
   Gegenmaßnahme überlappt die Uhrzeit die Kopfzeile der App.

   Zwei Wege, beide nötig:
   1) In der APK sagt das Statusleisten-Modul dem System, es soll den
      Bereich freihalten. Das ist der saubere Weg, greift aber nur dort.
   2) Im Browser und als Startbildschirm-App gibt es kein Modul —
      dort trägt env(safe-area-inset-*) den Abstand, siehe STIL. */

export async function systemleisteEinrichten() {
  /* Läuft nur in der App; im Browser gibt es window.Capacitor nicht. */
  if (!globalThis.Capacitor?.isNativePlatform?.()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    /* Nicht mehr überlagern: Android schiebt den Webteil darunter. */
    await StatusBar.setOverlaysWebView({ overlay: false });
    /* Unsere Kopfzeile ist dunkel, also helle Symbole. */
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#20262A" });
  } catch (e) {
    /* Kein Grund, die App nicht zu starten — dann greift der
       CSS-Abstand aus Weg 2. */
    console.warn("Statusleiste nicht einstellbar:", e?.message ?? e);
  }
}

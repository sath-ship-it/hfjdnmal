import React, { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Download, Check } from "lucide-react";

/* Wie oft im Hintergrund nach einer neuen Fassung gesehen wird.
   Stündlich reicht: mehr kostet auf der Baustelle nur Funkzellen-Akku. */
const INTERVALL = 60 * 60 * 1000;

/* Meldet den Service Worker an und zeigt an, wenn eine neue Fassung
   bereitliegt. Geladen wird erst auf Tippen — siehe registerType
   "prompt" in vite.config.js. */
export default function Aktualisierung() {
  const {
    offlineReady: [offlineBereit, setOfflineBereit],
    needRefresh: [neueFassung, setNeueFassung],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return;

      /* Offline schlägt update() fehl — das ist kein Fehlerfall,
         sondern der Normalzustand im Funkloch. */
      const sehen = () => { if (navigator.onLine) reg.update().catch(() => {}); };

      sehen();
      const t = setInterval(sehen, INTERVALL);

      /* Beim Zurückholen aus dem Hintergrund prüfen. In der APK ist das
         der häufigste Fall: Handy aus der Tasche, App noch offen. */
      const beiRueckkehr = () => { if (document.visibilityState === "visible") sehen(); };
      document.addEventListener("visibilitychange", beiRueckkehr);
      window.addEventListener("online", sehen);

      return () => {
        clearInterval(t);
        document.removeEventListener("visibilitychange", beiRueckkehr);
        window.removeEventListener("online", sehen);
      };
    },
  });

  /* Die Offline-Bestätigung ist eine einmalige Info, kein Dauerzustand. */
  useEffect(() => {
    if (!offlineBereit) return;
    const t = setTimeout(() => setOfflineBereit(false), 4000);
    return () => clearTimeout(t);
  }, [offlineBereit, setOfflineBereit]);

  if (neueFassung) {
    return (
      <div className="wr-update" role="status">
        <Download size={16} />
        <span className="wr-update-t">Neue Fassung verfügbar</span>
        <button className="wr-update-b" onClick={() => updateServiceWorker(true)}>
          Jetzt laden
        </button>
        <button className="wr-update-x" onClick={() => setNeueFassung(false)}
          aria-label="Hinweis ausblenden">Später</button>
      </div>
    );
  }

  if (offlineBereit) {
    return (
      <div className="wr-update wr-update-ok" role="status">
        <Check size={16} />
        <span className="wr-update-t">Bereit für den Betrieb ohne Netz</span>
      </div>
    );
  }

  return null;
}

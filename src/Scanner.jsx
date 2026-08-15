import React, { useEffect, useRef, useState } from "react";
import { X, AlertTriangle } from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   Strichcode lesen.

   Ohne Zusatzmodul: Chrome und der Android-Programmteil bringen seit
   Fassung 83 einen eigenen Erkenner mit (BarcodeDetector). Das spart
   ein natives Modul, das ich hier nicht prüfen könnte — dafür muss die
   Oberfläche damit umgehen, dass es ihn manchmal nicht gibt.

   Drei Ausgänge, und alle drei sagen, was los ist:
     kein Erkenner   → Hinweis, von Hand suchen
     keine Kamera    → Hinweis, meist eine abgelehnte Berechtigung
     Code unbekannt  → Code anzeigen, damit man ihn eintragen kann

   Der Bildstrom wird beim Verlassen wieder freigegeben. Vergisst man
   das, leuchtet die Kameralampe weiter und der Akku geht.
   ───────────────────────────────────────────────────────────── */

const FORMATE = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"];

export default function Scanner({ suchen, schliessen }) {
  const bild = useRef(null);
  const strom = useRef(null);
  const laeuft = useRef(true);
  const [fehler, setFehler] = useState("");
  const [unbekannt, setUnbekannt] = useState("");

  useEffect(() => {
    laeuft.current = true;

    const start = async () => {
      if (!globalThis.BarcodeDetector) {
        setFehler("Dieses Gerät kann keine Strichcodes lesen. Bitte oben suchen.");
        return;
      }
      let erkenner;
      try {
        /* Welche Formate das Gerät wirklich kann, weiss nur es selbst. */
        const koennen = await globalThis.BarcodeDetector.getSupportedFormats();
        const nutzbar = FORMATE.filter((f) => koennen.includes(f));
        if (nutzbar.length === 0) {
          setFehler("Dieses Gerät kennt keines der üblichen Strichcode-Formate.");
          return;
        }
        erkenner = new globalThis.BarcodeDetector({ formats: nutzbar });
      } catch {
        setFehler("Der Strichcode-Leser liess sich nicht starten.");
        return;
      }

      try {
        strom.current = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch {
        setFehler("Kein Zugriff auf die Kamera. In den Einstellungen erlauben.");
        return;
      }
      if (!laeuft.current) { halt(); return; }
      if (bild.current) {
        bild.current.srcObject = strom.current;
        /* Bewusst NICHT abgewartet: play() liefert erst zurueck, wenn
           tatsaechlich Bilder kommen. Bleibt das aus, haenge die
           Erkennung dahinter fest und der Scanner tut nie etwas. */
        bild.current.play?.().catch(() => {});
      }

      /* Alle 400 ms ein Blick. Oefter kostet nur Akku — ein Code liegt
         ohnehin laenger als eine halbe Sekunde vor der Linse. */
      const sehen = async () => {
        if (!laeuft.current || !bild.current) return;
        try {
          const funde = await erkenner.detect(bild.current);
          const code = funde.find((f) => f.rawValue)?.rawValue;
          if (code) {
            const getroffen = suchen(code.trim());
            if (getroffen) { laeuft.current = false; return; }
            setUnbekannt(code.trim());
          }
        } catch { /* ein misslungener Blick ist kein Fehler */ }
        if (laeuft.current) setTimeout(sehen, 400);
      };
      sehen();
    };

    start();
    return () => { laeuft.current = false; halt(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const halt = () => {
    strom.current?.getTracks().forEach((s) => s.stop());
    strom.current = null;
  };

  return (
    <div className="wr-scanner">
      <div className="wr-scanner-kopf">
        <span>Strichcode scannen</span>
        <button className="wr-scanner-x" onClick={schliessen} aria-label="Schließen">
          <X size={20} />
        </button>
      </div>

      {fehler
        ? <div className="wr-pad"><div className="wr-fehler" role="alert">
            <AlertTriangle size={15} /> {fehler}
          </div></div>
        : <>
            <div className="wr-scanner-bild">
              <video ref={bild} playsInline muted />
              <div className="wr-scanner-rahmen" />
            </div>
            <p className="wr-hint" style={{ margin:"12px 18px" }}>
              {unbekannt
                ? `Code ${unbekannt} gehört zu keinem Artikel. Die Leitung kann ihn im Artikelstamm eintragen.`
                : "Code in den Rahmen halten. Der Artikel landet direkt in der Anforderung."}
            </p>
          </>}
    </div>
  );
}

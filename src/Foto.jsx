import React, { useRef, useState } from "react";
import { Camera, Check, AlertTriangle, Loader } from "lucide-react";

/* Foto aufnehmen oder aus der Galerie wählen.

   capture="environment" öffnet auf dem Handy direkt die rückwärtige
   Kamera — auf einer Baustelle will niemand erst durch die Galerie.
   Am Rechner fällt es auf einen normalen Dateidialog zurück.

   Vor dem Hochladen wird verkleinert: Ein Handyfoto hat schnell 4 MB,
   und der Speicher im freien Tarif ist knapp. 1600 px lange Kante
   reicht, um eine Kabelrinne oder einen Zählerplatz zu belegen. */

const MAX_KANTE = 1600;
const GUETE = 0.82;

async function verkleinern(datei) {
  if (!datei.type.startsWith("image/")) return datei;
  try {
    const bild = await createImageBitmap(datei);
    const faktor = Math.min(1, MAX_KANTE / Math.max(bild.width, bild.height));
    if (faktor === 1 && datei.size < 900_000) return datei;

    const leinwand = document.createElement("canvas");
    leinwand.width = Math.round(bild.width * faktor);
    leinwand.height = Math.round(bild.height * faktor);
    leinwand.getContext("2d").drawImage(bild, 0, 0, leinwand.width, leinwand.height);

    const klein = await new Promise((fertig) =>
      leinwand.toBlob(fertig, "image/jpeg", GUETE));
    if (!klein || klein.size >= datei.size) return datei;
    return new File([klein], (datei.name || "foto").replace(/\.\w+$/, "") + ".jpg",
      { type: "image/jpeg" });
  } catch {
    /* Kann der Browser das nicht, laden wir eben das Original hoch. */
    return datei;
  }
}

export default function FotoKnopf({ hochladen, gross = false, beschriftung = "Foto" }) {
  const feld = useRef(null);
  const [zustand, setZustand] = useState("bereit");   // bereit | laeuft | fertig
  const [fehler, setFehler] = useState("");

  const gewaehlt = async (e) => {
    const datei = e.target.files?.[0];
    e.target.value = "";                 // dieselbe Datei nochmal erlauben
    if (!datei) return;
    setZustand("laeuft"); setFehler("");
    try {
      await hochladen(await verkleinern(datei));
      setZustand("fertig");
      setTimeout(() => setZustand("bereit"), 2200);
    } catch (fehlschlag) {
      setFehler(fehlschlag.message || "Hochladen fehlgeschlagen.");
      setZustand("bereit");
    }
  };

  const inhalt = zustand === "laeuft"
    ? <><Loader size={gross ? 20 : 15} className="wr-dreht" /><span>Lädt …</span></>
    : zustand === "fertig"
      ? <><Check size={gross ? 20 : 15} /><span>Gesichert</span></>
      : <><Camera size={gross ? 20 : 15} /><span>{beschriftung}</span></>;

  return (
    <>
      <button type="button" disabled={zustand === "laeuft"}
        className={gross ? "wr-photo-add" : "wr-order"}
        style={gross ? {} : { margin: 0 }}
        onClick={() => feld.current?.click()}>
        {inhalt}
      </button>
      <input ref={feld} type="file" accept="image/*" capture="environment"
        onChange={gewaehlt} style={{ display: "none" }} />
      {fehler && (
        <div className="wr-fehler" role="alert">
          <AlertTriangle size={15} /> {fehler}
        </div>
      )}
    </>
  );
}

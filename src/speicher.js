import { useState, useEffect } from "react";

/* Hält einen Zustand im Gerät fest, damit ein Neuladen nichts wegwirft.
   Vorstufe zur echten Speicherung: dieselbe Stelle wird später die
   Warteschlange für den Abgleich mit dem Server tragen. */
export function useGespeichert(schluessel, start) {
  const [wert, setWert] = useState(() => {
    try {
      const roh = localStorage.getItem(schluessel);
      return roh ? JSON.parse(roh) : start;
    } catch {
      // Kaputter oder gesperrter Speicher darf die App nicht aufhalten
      return start;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(schluessel, JSON.stringify(wert));
    } catch {
      /* voll oder privater Modus — dann eben ohne Gedächtnis */
    }
  }, [schluessel, wert]);

  return [wert, setWert];
}

export function loesche(...schluessel) {
  for (const s of schluessel) {
    try { localStorage.removeItem(s); } catch { /* egal */ }
  }
}

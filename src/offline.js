import { useState, useEffect } from "react";

/* ─────────────────────────────────────────────────────────────
   Betrieb ohne Netz.

   Zwei getrennte Probleme, die oft verwechselt werden:

   LESEN — Der letzte erfolgreich geladene Stand liegt im Gerät. Ohne
   Netz zeigt die App ihn weiter, aber gekennzeichnet: Man muss sehen,
   dass man auf altem Stand arbeitet.

   SCHREIBEN — Was nicht rausgeht, wandert in eine Warteschlange und
   wird nachgereicht, sobald wieder Netz da ist.

   Warum das gefahrlos wiederholbar ist: Die Schlüssel vergibt das Gerät
   (crypto.randomUUID). Geht eine Antwort verloren und wir schicken
   denselben Satz nochmal, entsteht kein Doppel — die Datenbank weist
   den zweiten mit derselben Nummer ab.
   ───────────────────────────────────────────────────────────── */

const CACHE = "waro.stand";
const SCHLANGE = "waro.warteschlange";

/* ── Netzzustand ── */
export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  useEffect(() => {
    const an = () => setOnline(true), aus = () => setOnline(false);
    window.addEventListener("online", an);
    window.addEventListener("offline", aus);
    return () => { window.removeEventListener("online", an); window.removeEventListener("offline", aus); };
  }, []);
  return online;
}

/* navigator.onLine luegt gerne: Es meldet "online", sobald irgendein
   Netz da ist — auch ein Funkloch mit einem Balken. Deshalb zaehlt fuer
   uns, ob die Anfrage tatsaechlich scheiterte. */
export const istNetzfehler = (e) => {
  const t = String(e?.message ?? e ?? "").toLowerCase();
  return navigator.onLine === false
    || t.includes("failed to fetch") || t.includes("networkerror")
    || t.includes("load failed") || t.includes("network request failed");
};

/* ── Letzter Stand ── */
export function standSichern(daten) {
  try {
    localStorage.setItem(CACHE, JSON.stringify({ zeitpunkt: Date.now(), daten }));
  } catch { /* Speicher voll — dann eben ohne Gedaechtnis */ }
}

export function standLesen() {
  try {
    const roh = localStorage.getItem(CACHE);
    if (!roh) return null;
    const { zeitpunkt, daten } = JSON.parse(roh);
    return { zeitpunkt, daten };
  } catch { return null; }
}

/* ── Warteschlange ── */
export function schlangeLesen() {
  try { return JSON.parse(localStorage.getItem(SCHLANGE) || "[]"); }
  catch { return []; }
}

function schlangeSchreiben(liste) {
  try { localStorage.setItem(SCHLANGE, JSON.stringify(liste)); } catch { /* egal */ }
}

export function einreihen(art, nutzlast) {
  const eintrag = { id: crypto.randomUUID(), art, nutzlast, zeitpunkt: Date.now() };
  schlangeSchreiben([...schlangeLesen(), eintrag]);
  return eintrag;
}

/* Arbeitet die Warteschlange ab. "ausfuehren" bekommt art und Nutzlast
   und wirft, wenn es nicht klappt.

   Ein Eintrag, der aus einem anderen Grund als fehlendem Netz scheitert
   (etwa geloeschte Baustelle), wuerde die Schlange sonst fuer immer
   blockieren. Solche Eintraege fliegen raus und werden gemeldet. */
export async function schlangeAbarbeiten(ausfuehren) {
  const offen = schlangeLesen();
  if (offen.length === 0) return { gesendet: 0, verworfen: [] };

  const bleibt = [], verworfen = [];
  let gesendet = 0;

  for (const e of offen) {
    try { await ausfuehren(e.art, e.nutzlast); gesendet++; }
    catch (fehler) {
      if (istNetzfehler(fehler)) bleibt.push(e);
      else verworfen.push({ ...e, grund: fehler.message || String(fehler) });
    }
  }
  schlangeSchreiben(bleibt);
  return { gesendet, verworfen };
}

export function schlangeLeeren() { schlangeSchreiben([]); }

/* "vor 3 Minuten", "gestern 17:42" — fuer die Kennzeichnung des Stands */
export function vorWie(zeitpunkt) {
  const s = Math.floor((Date.now() - zeitpunkt) / 1000);
  if (s < 90) return "gerade eben";
  const m = Math.floor(s / 60);
  if (m < 60) return `vor ${m} Minuten`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h} Stunde${h === 1 ? "" : "n"}`;
  return new Date(zeitpunkt).toLocaleString("de-DE",
    { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
}

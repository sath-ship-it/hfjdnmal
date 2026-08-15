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

/* ── Letzter Stand ──

   Der Stand haengt am Konto, nicht am Geraet. Auf einem Baustellen-
   telefon melden sich mehrere Leute nacheinander an, und der Stand
   der Buchhaltung enthaelt Preise und Kundennamen — genau das, was
   die Datenbank einem Monteur nie schicken wuerde. Ohne die Bindung
   an "wer" bekaeme er sie beim naechsten Funkloch trotzdem zu sehen,
   weil dann der gespeicherte Stand einspringt. */
export function standSichern(daten, wer) {
  try {
    localStorage.setItem(CACHE, JSON.stringify({ wer: wer ?? null, zeitpunkt: Date.now(), daten }));
  } catch { /* Speicher voll — dann eben ohne Gedaechtnis */ }
}

export function standLesen(wer) {
  try {
    const roh = localStorage.getItem(CACHE);
    if (!roh) return null;
    const { wer: gehoert, zeitpunkt, daten } = JSON.parse(roh);
    /* Fremder Stand: lieber nichts zeigen als das Falsche. */
    if ((gehoert ?? null) !== (wer ?? null)) return null;
    return { zeitpunkt, daten };
  } catch { return null; }
}

export function standLoeschen() {
  try { localStorage.removeItem(CACHE); } catch { /* egal */ }
}

/* ── Warteschlange ── */
export function schlangeLesen() {
  try { return JSON.parse(localStorage.getItem(SCHLANGE) || "[]"); }
  catch { return []; }
}

function schlangeSchreiben(liste) {
  try { localStorage.setItem(SCHLANGE, JSON.stringify(liste)); } catch { /* egal */ }
}

/* Auch die Schlange gehoert einem Konto. Die Eintraege tragen fremde
   Profil-Nummern in sich; unter einer anderen Anmeldung nachgereicht,
   wiese die Datenbank sie zurecht ab — und sie flogen als dauerhaft
   gescheitert raus. Die Arbeit waere weg. Deshalb bleiben fremde
   Eintraege liegen, bis der Richtige sich wieder anmeldet. */
export function einreihen(art, nutzlast, wer) {
  const eintrag = { id: crypto.randomUUID(), wer: wer ?? null, art, nutzlast, zeitpunkt: Date.now() };
  schlangeSchreiben([...schlangeLesen(), eintrag]);
  return eintrag;
}

/* Wieviel wartet fuer DIESES Konto — das ist die Zahl, die dem
   Angemeldeten etwas sagt. */
export const schlangeMeine = (wer) =>
  schlangeLesen().filter((e) => (e.wer ?? null) === (wer ?? null));

/* Arbeitet die Warteschlange ab. "ausfuehren" bekommt art und Nutzlast
   und wirft, wenn es nicht klappt.

   Ein Eintrag, der aus einem anderen Grund als fehlendem Netz scheitert
   (etwa geloeschte Baustelle), wuerde die Schlange sonst fuer immer
   blockieren. Solche Eintraege fliegen raus und werden gemeldet. */
export async function schlangeAbarbeiten(ausfuehren, wer) {
  const alle = schlangeLesen();
  const offen = alle.filter((e) => (e.wer ?? null) === (wer ?? null));
  /* Fremde Eintraege ruehren wir nicht an, sie warten auf ihr Konto. */
  const fremd = alle.filter((e) => (e.wer ?? null) !== (wer ?? null));
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
  schlangeSchreiben([...fremd, ...bleibt]);
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

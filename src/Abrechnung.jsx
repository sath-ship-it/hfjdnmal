import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useDaten } from "./datenZ.js";
import { euro, std } from "./format.js";

/* ─────────────────────────────────────────────────────────────
   Abrechnung — der Einstieg für die Buchhaltung.

   Ein Monteur fragt "was ist heute zu tun". Die Buchhaltung fragt
   "was kann raus". Das ist eine andere Frage an dieselben Daten, und
   sie verdient eine eigene Ansicht statt einer Baustellenliste mit
   ein paar zusätzlichen Zahlen.

   Gerechnet wird aus dem, was ohnehin da ist:
     Aufmaß-Wert  erfasste Menge je Position × Einheitspreis
     LV-Soll      ausgeschriebene Menge × Einheitspreis
     Material     angeforderte Menge × Einkaufspreis
     Stunden      Summe der Stempelungen auf der Baustelle

   Positionen ohne hinterlegten Preis fließen mit 0 ein. Das wäre
   stillschweigend falsch, deshalb steht die Zahl der preislosen
   Positionen auf der Karte — sonst wundert sich jemand über eine
   zu kleine Summe.
   ───────────────────────────────────────────────────────────── */

const GRUPPEN = [
  { k: "reif",     l: "Abrechnungsreif", passt: (b) => b.phase === "Abgenommen" },
  { k: "laufend",  l: "Laufend",
    passt: (b) => b.phase !== "Abgenommen" && b.phase !== "Abgerechnet" },
  { k: "fertig",   l: "Abgerechnet",     passt: (b) => b.phase === "Abgerechnet" },
];

export default function Abrechnung({ u, oeffne }) {
  const { POS, ZEILEN, ZEITEN, ARTIKEL, anf, sichtbar, betrieb, koennen } = useDaten();
  const [grp, setGrp] = useState("reif");

  const rechnen = (b) => {
    const pos = POS.filter((p) => p.bId === b.id);
    const ist = (pId) => ZEILEN.filter((z) => z.pId === pId).reduce((s, z) => s + z.menge, 0);
    return {
      aufmass: pos.reduce((s, p) => s + ist(p.id) * (p.ep ?? 0), 0),
      soll:    pos.reduce((s, p) => s + p.lv * (p.ep ?? 0), 0),
      ohne:    pos.filter((p) => p.ep == null).length,
      material: anf.filter((x) => x.bId === b.id).reduce((s, x) => {
        const a = ARTIKEL.find((y) => y.id === x.aId);
        return s + x.menge * (a?.ek ?? 0);
      }, 0),
      /* Pausen sind keine Leistung und gehoeren nicht in die
         Nachkalkulation. */
      stunden: ZEITEN.filter((z) => z.bId === b.id && z.art !== "Pause")
        .reduce((s, z) => s + (z.dauer ?? 0), 0),
      posten: pos.length,
    };
  };

  const liste = sichtbar(u)
    .filter(GRUPPEN.find((g) => g.k === grp).passt)
    .map((b) => ({ b, z: rechnen(b) }))
    .sort((x, y) => y.z.aufmass - x.z.aufmass);

  const gesamt = liste.reduce((s, x) => s + x.z.aufmass, 0);
  const ohnePreis = liste.reduce((s, x) => s + x.z.ohne, 0);

  return (
    <div className="wr-scroll">
      <div className="wr-hero">
        <div className="wr-hero-date">{betrieb}</div>
        <h1 className="wr-hero-h">Abrechnung</h1>
      </div>

      {!koennen.preise && (
        <div className="wr-locked">
          <AlertTriangle size={15} />
          <span>Dieser Zugang bekommt keine Preise. Alle Summen bleiben null.</span>
        </div>
      )}

      <div className="wr-seg">
        {GRUPPEN.map((g) => (
          <button key={g.k} onClick={() => setGrp(g.k)} className="wr-segb"
            style={grp === g.k ? { background:"var(--spur-an)", color:"var(--i)",
                                   boxShadow:"0 1px 3px rgba(0,0,0,.09)" } : {}}>
            {g.l}
          </button>
        ))}
      </div>

      <div className="wr-summe">
        <div>
          <div className="wr-summe-l">Aufmaß-Wert, {liste.length} Baustellen</div>
          {ohnePreis > 0 && (
            <div className="wr-summe-warn">
              <AlertTriangle size={12} /> {ohnePreis} {ohnePreis === 1 ? "Position" : "Positionen"} ohne Preis
            </div>
          )}
        </div>
        <div className="wr-summe-z">{euro(gesamt)}</div>
      </div>

      {liste.length === 0 && (
        <div className="wr-empty">
          {grp === "reif"
            ? "Nichts abrechnungsreif. Eine Baustelle wird es, sobald sie abgenommen ist."
            : "Keine Baustelle in dieser Gruppe."}
        </div>
      )}

      {liste.map(({ b, z }) => (
        <button key={b.id} className="wr-card" onClick={() => oeffne(b.id)}>
          <div className="wr-card-in">
            <div className="wr-row">
              <span className="wr-card-t">{b.name}</span>
              <span className="wr-mono-b">{euro(z.aufmass)}</span>
            </div>
            <div className="wr-card-s">{b.nr} &middot; {b.phase} &middot; {b.abrechnung}</div>

            <div className="wr-abr">
              <span><b>{euro(z.soll)}</b><small>LV-Soll</small></span>
              <span><b>{euro(z.material)}</b><small>Material EK</small></span>
              <span><b>{std(z.stunden)}</b><small>Stunden</small></span>
            </div>

            {z.ohne > 0 && (
              <div className="wr-abr-warn">
                <AlertTriangle size={12} /> {z.ohne} von {z.posten} {z.posten === 1 ? "Position" : "Positionen"} ohne Preis
              </div>
            )}
          </div>
        </button>
      ))}

      <div className="wr-hint" style={{ margin:"14px 18px 24px" }}>
        Gerechnet wird mit der erfassten Menge, nicht mit der ausgeschriebenen.
        Der Unterschied zum LV-Soll ist das, worüber mit dem Kunden gesprochen wird.
      </div>
    </div>
  );
}

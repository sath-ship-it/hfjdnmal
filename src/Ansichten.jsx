import React, { useState, useEffect } from "react";
import { ChevronLeft, Clock, FileText, Camera, AlertTriangle } from "lucide-react";
import { useDaten } from "./datenZ.js";
import { fotoAdressen } from "./daten.js";

/* ─────────────────────────────────────────────────────────────
   Lesen, was erfasst wurde.

   Bisher war die App halbseitig: Stunden, Berichte und Fotos gingen
   hinein, aber nichts kam wieder heraus. Gerade bei Stunden ist das
   der wichtigere Teil — daraus werden Rechnungen.
   ───────────────────────────────────────────────────────────── */

const zahl = (n) => n.toLocaleString("de-DE", { maximumFractionDigits: 2 });
const uhr = (iso) => new Date(iso).toLocaleTimeString("de-DE", { hour:"2-digit", minute:"2-digit" });
const tagName = (iso) => new Date(iso).toLocaleDateString("de-DE",
  { weekday:"short", day:"2-digit", month:"2-digit" });

/* Montag der Woche, in der der Zeitpunkt liegt */
const wochenStart = (d = new Date()) => {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7));
  return t;
};

/* ── Stunden ── */
export function Stunden({ zurueck, u }) {
  const { ZEITEN, B, M } = useDaten();
  const [wer, setWer] = useState("ich");
  const leitung = u.zugang === "Leitung";

  const ab = wochenStart().getTime();
  const dieseWoche = ZEITEN.filter((z) => new Date(z.von).getTime() >= ab
    && (wer === "alle" ? true : z.profil === u.id));

  /* Nach Tag bündeln — so liest ein Chef das auch auf dem Stundenzettel. */
  const proTag = {};
  for (const z of dieseWoche) {
    const t = z.von.slice(0, 10);
    (proTag[t] ??= []).push(z);
  }
  const summe = dieseWoche.reduce((s, z) => s + (z.dauer ?? 0), 0);
  const laufende = dieseWoche.filter((z) => !z.bis).length;

  return (
    <div className="wr-scroll">
      <div className="wr-sheethead">
        <button className="wr-back2" onClick={zurueck}><ChevronLeft size={18} /> Zurück</button>
        <h1 className="wr-hero-h" style={{ marginTop:14 }}>Stunden</h1>
        <p className="wr-sub">Diese Woche ab {wochenStart().toLocaleDateString("de-DE")}</p>
      </div>

      {leitung && (
        <div className="wr-seg">
          {[["ich","Meine"],["alle","Ganzer Betrieb"]].map(([k, l]) => (
            <button key={k} onClick={() => setWer(k)} className="wr-segb"
              style={wer === k ? { background:"#fff", color:"#14181B", boxShadow:"0 1px 3px rgba(0,0,0,.09)" } : {}}>
              {l}
            </button>
          ))}
        </div>
      )}

      <div className="wr-pad" style={{ paddingTop:0 }}>
        <div className="wr-panel" style={{ display:"flex", alignItems:"center", gap:12 }}>
          <Clock size={20} />
          <div style={{ flex:1 }}>
            <div className="wr-task-s">Summe der Woche</div>
            <div className="wr-mono-b" style={{ fontSize:22 }}>{zahl(summe)} h</div>
          </div>
          {laufende > 0 && <span className="wr-pill">{laufende} läuft noch</span>}
        </div>
      </div>

      {Object.entries(proTag).sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([tag, liste]) => {
        const tagSumme = liste.reduce((s, z) => s + (z.dauer ?? 0), 0);
        return (
          <div key={tag}>
            <div className="wr-eyebrow">
              <span>{tagName(tag)}</span>
              <span className="wr-eyebrow-r">{zahl(tagSumme)} h</span>
            </div>
            {liste.map((z) => {
              const b = B.find((x) => x.id === z.bId);
              return (
                <div key={z.id} className="wr-task">
                  <div style={{ flex:1, minWidth:0 }}>
                    <div className="wr-task-t">{b?.name ?? "Unbekannte Baustelle"}</div>
                    <div className="wr-task-s">
                      {uhr(z.von)} – {z.bis ? uhr(z.bis) : "läuft"}
                      {wer === "alle" ? ` · ${M(z.profil).kurz}` : ""}
                    </div>
                  </div>
                  <span className="wr-mono-b">{z.dauer != null ? `${zahl(z.dauer)} h` : "—"}</span>
                </div>
              );
            })}
          </div>
        );
      })}
      {dieseWoche.length === 0 && <div className="wr-empty">Diese Woche noch nichts gestempelt.</div>}
      <div style={{ height:24 }} />
    </div>
  );
}

/* ── Tagesberichte ── */
export function Berichte({ zurueck }) {
  const { BERICHTE, B, M } = useDaten();
  return (
    <div className="wr-scroll">
      <div className="wr-sheethead">
        <button className="wr-back2" onClick={zurueck}><ChevronLeft size={18} /> Zurück</button>
        <h1 className="wr-hero-h" style={{ marginTop:14 }}>Tagesberichte</h1>
        <p className="wr-sub">Was auf den Baustellen gemeldet wurde.</p>
      </div>
      <div style={{ height:8 }} />
      {BERICHTE.map((b) => {
        const bs = B.find((x) => x.id === b.bId);
        return (
          <div key={b.id} className="wr-panel" style={{ margin:"0 14px 8px" }}>
            <div className="wr-row">
              <span className="wr-card-t" style={{ fontSize:13.5 }}>{bs?.name ?? "—"}</span>
              <span className="wr-mono-s">{new Date(b.datum).toLocaleDateString("de-DE")}</span>
            </div>
            <p style={{ margin:"8px 0 0", fontSize:13.5, lineHeight:1.5, whiteSpace:"pre-wrap" }}>{b.text}</p>
            <div className="wr-task-s" style={{ marginTop:8 }}>{M(b.profil).name}</div>
          </div>
        );
      })}
      {BERICHTE.length === 0 && <div className="wr-empty">Noch keine Berichte.</div>}
      <div style={{ height:24 }} />
    </div>
  );
}

/* ── Fotos ── */
export function Fotos({ zurueck, nurBaustelle }) {
  const { FOTOS, B } = useDaten();
  const [adressen, setAdressen] = useState({});
  const [fehler, setFehler] = useState("");
  const [laedt, setLaedt] = useState(true);

  const liste = nurBaustelle ? FOTOS.filter((f) => f.bId === nurBaustelle) : FOTOS;

  useEffect(() => {
    let weg = false;
    if (liste.length === 0) { setLaedt(false); return; }
    /* Der Ablageort ist nicht öffentlich — es braucht kurzlebige
       Einmal-Adressen, sonst käme jeder mit dem Pfad an Kundenfotos. */
    fotoAdressen(liste.map((f) => f.pfad))
      .then((a) => { if (!weg) setAdressen(a); })
      .catch((e) => { if (!weg) setFehler(e.message); })
      .finally(() => { if (!weg) setLaedt(false); });
    return () => { weg = true; };
  }, [liste.length, nurBaustelle]);

  return (
    <div className="wr-scroll">
      <div className="wr-sheethead">
        <button className="wr-back2" onClick={zurueck}><ChevronLeft size={18} /> Zurück</button>
        <h1 className="wr-hero-h" style={{ marginTop:14 }}>Fotos</h1>
        <p className="wr-sub">{liste.length} Aufnahme{liste.length === 1 ? "" : "n"}</p>
      </div>
      <div className="wr-pad">
        {fehler && <div className="wr-fehler" role="alert"><AlertTriangle size={15} /> {fehler}</div>}
        {laedt && liste.length > 0 && <div className="wr-empty">Wird geladen …</div>}
        <div className="wr-galerie">
          {liste.map((f) => (
            <a key={f.id} className="wr-galerie-bild" href={adressen[f.pfad] || "#"}
              target="_blank" rel="noreferrer"
              onClick={(e) => { if (!adressen[f.pfad]) e.preventDefault(); }}>
              {adressen[f.pfad]
                ? <img src={adressen[f.pfad]} alt={B.find((b) => b.id === f.bId)?.name ?? "Foto"} loading="lazy" />
                : <span><Camera size={18} /></span>}
            </a>
          ))}
        </div>
        {liste.length === 0 && !laedt && <div className="wr-empty">Noch keine Fotos.</div>}
      </div>
      <div style={{ height:24 }} />
    </div>
  );
}

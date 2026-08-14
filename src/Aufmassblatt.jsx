import React, { useRef, useState, useEffect } from "react";
import { X, Check, Eraser, AlertTriangle } from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   Aufmaßblatt: Positionen, Ansätze, Unterschrift.

   Kein PDF-Erzeuger im Programm. Das Blatt wird als Seite gesetzt und
   dem Druck des Betriebssystems übergeben — dort heißt der Knopf auf
   dem Handy "Als PDF speichern". Das spart eine schwere Bibliothek und
   liefert am Ende dieselbe Datei.

   Entscheidend ist, was auf dem Blatt steht: nicht nur die Summe,
   sondern jeder Ansatz mit Ort und Datum. Genau das prüft der Kunde.
   ───────────────────────────────────────────────────────────── */

const zahl = (n) => n.toLocaleString("de-DE", { maximumFractionDigits: 2 });

/* ── Unterschriftenfeld ── */
function Unterschrift({ leinwand }) {
  const [leer, setLeer] = useState(true);

  useEffect(() => {
    const c = leinwand.current;
    if (!c) return;
    /* Auf scharfe Darstellung achten: Ohne Skalierung auf die
       Gerätepixel wirkt eine Unterschrift ausgefranst. */
    const dichte = window.devicePixelRatio || 1;
    const breite = c.parentElement.clientWidth;
    c.width = breite * dichte;
    c.height = 180 * dichte;
    c.style.width = breite + "px";
    c.style.height = "180px";
    const k = c.getContext("2d");
    k.scale(dichte, dichte);
    k.lineWidth = 2.2;
    k.lineCap = "round";
    k.lineJoin = "round";
    k.strokeStyle = "#14181B";

    let malt = false;
    const punkt = (e) => {
      const r = c.getBoundingClientRect();
      const t = e.touches?.[0] ?? e;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    };
    const start = (e) => { e.preventDefault(); malt = true; const p = punkt(e); k.beginPath(); k.moveTo(p.x, p.y); };
    const zieh  = (e) => { if (!malt) return; e.preventDefault(); const p = punkt(e); k.lineTo(p.x, p.y); k.stroke(); setLeer(false); };
    const stopp = () => { malt = false; };

    c.addEventListener("pointerdown", start);
    c.addEventListener("pointermove", zieh);
    window.addEventListener("pointerup", stopp);
    return () => {
      c.removeEventListener("pointerdown", start);
      c.removeEventListener("pointermove", zieh);
      window.removeEventListener("pointerup", stopp);
    };
  }, [leinwand]);

  const leeren = () => {
    const c = leinwand.current;
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
    setLeer(true);
  };

  return (
    <div>
      <div className="wr-unterschrift">
        <canvas ref={leinwand} />
        {leer && <span className="wr-unterschrift-hint">Hier unterschreiben</span>}
      </div>
      <button type="button" className="wr-order" style={{ width:"100%", margin:"7px 0 0" }}
        onClick={leeren}><Eraser size={15} /> Nochmal</button>
    </div>
  );
}

export default function Aufmassblatt({ baustelle, positionen, zeilen, ersteller, speichern, schliessen }) {
  const leinwand = useRef(null);
  const [name, setName] = useState("");
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState("");
  const [gesichert, setGesichert] = useState(false);

  const summe = (pId) => zeilen.filter((z) => z.pId === pId).reduce((s, z) => s + z.menge, 0);
  const heute = new Date().toLocaleDateString("de-DE");

  const bestaetigen = async () => {
    if (!name.trim() || sendet) return;
    setSendet(true); setFehler("");
    try {
      const c = leinwand.current;
      const blob = await new Promise((f) => c.toBlob(f, "image/png"));
      await speichern(name.trim(), blob);
      setGesichert(true);
    } catch (e) {
      setFehler(e.message || "Speichern fehlgeschlagen.");
    } finally { setSendet(false); }
  };

  return (
    <div className="wr-scroll">
      <div className="wr-sheethead">
        <button className="wr-back2" onClick={schliessen}><X size={16} /> Schließen</button>
        <h1 className="wr-hero-h" style={{ marginTop:14 }}>Aufmaßblatt</h1>
        <p className="wr-sub">{baustelle.name} · {baustelle.nr} · {heute}</p>
      </div>

      {/* Dieser Bereich wird gedruckt */}
      <div className="wr-blatt" id="wr-blatt">
        <div className="wr-blatt-kopf">
          <div>
            <div className="wr-blatt-titel">Aufmaß</div>
            <div className="wr-blatt-klein">{baustelle.name} · {baustelle.nr}</div>
            <div className="wr-blatt-klein">{baustelle.adr}</div>
          </div>
          <div className="wr-blatt-klein" style={{ textAlign:"right" }}>
            {heute}<br />{ersteller}
          </div>
        </div>

        {positionen.map((p) => {
          const meine = zeilen.filter((z) => z.pId === p.id);
          if (meine.length === 0) return null;
          const s = summe(p.id);
          return (
            <div key={p.id} className="wr-blatt-pos">
              <div className="wr-blatt-poskopf">
                <span>{p.nr} · {p.txt}</span>
                <b>{zahl(s)} {p.eh}</b>
              </div>
              <table className="wr-blatt-tab">
                <thead><tr><th>Ort</th><th>Ansatz</th><th>Datum</th><th style={{ textAlign:"right" }}>Menge</th></tr></thead>
                <tbody>
                  {meine.map((z) => (
                    <tr key={z.id}>
                      <td>{z.ort}</td>
                      <td className="wr-mono">{z.ansatz}</td>
                      <td className="wr-mono">{z.datum}</td>
                      <td style={{ textAlign:"right" }}>{zahl(z.menge)} {p.eh}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {s > p.lv && (
                <div className="wr-blatt-nachtrag">
                  {zahl(s - p.lv)} {p.eh} über der LV-Menge von {zahl(p.lv)} — Nachtrag
                </div>
              )}
            </div>
          );
        })}

        <div className="wr-blatt-unten">
          <div>
            <div className="wr-blatt-linie" />
            <div className="wr-blatt-klein">Auftraggeber{name ? ` · ${name}` : ""}</div>
          </div>
        </div>
      </div>

      <div className="wr-pad">
        <label className="wr-lbl">Wer unterschreibt</label>
        <input className="wr-inp" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Name des Auftraggebers" />

        <label className="wr-lbl">Unterschrift</label>
        <Unterschrift leinwand={leinwand} />

        {fehler && <div className="wr-fehler" role="alert"><AlertTriangle size={15} /> {fehler}</div>}

        <div className="wr-two" style={{ marginTop:12 }}>
          <button className="wr-order" style={{ margin:0 }} onClick={() => window.print()}>
            Drucken / PDF
          </button>
          <button className="wr-btn-big" disabled={!name.trim() || sendet}
            style={{ background: name.trim() && !sendet ? "#FFCC00" : "var(--f)",
                     color: name.trim() && !sendet ? "#14181B" : "var(--m)", padding:"12px" }}
            onClick={bestaetigen}>
            {sendet ? "Sichert …" : gesichert ? <><Check size={15} /> Gesichert</> : "Unterschrift sichern"}
          </button>
        </div>
        <p className="wr-hint">
          „Drucken" öffnet den Druckdialog des Geräts — dort gibt es
          „Als PDF speichern". Die Unterschrift wird getrennt davon
          beim Vorgang abgelegt, mit Name und Zeitpunkt.
        </p>
      </div>
      <div style={{ height:24 }} />
    </div>
  );
}

import React, { useState, useEffect, useCallback } from "react";
import {
  Home, HardHat, Plus, Package, MoreHorizontal, Search, ChevronLeft, ChevronRight,
  Phone, MapPin, Mic, Camera, Clock, Play, Square, X, Lock, AlertTriangle,
  Building2, Check, Ruler, FileText, Truck, Send, PenLine, Zap, Download, WifiOff, Loader
} from "lucide-react";
import Aktualisierung from "./Aktualisierung.jsx";
import Login from "./Login.jsx";
import FotoKnopf from "./Foto.jsx";
import Aufmassblatt from "./Aufmassblatt.jsx";
import Stammdaten from "./Stammdaten.jsx";
import { Stunden, Berichte, Fotos } from "./Ansichten.jsx";
import { useOnline, vorWie, schlangeLesen, schlangeAbarbeiten } from "./offline.js";
import { supabase } from "./supabase.js";
import { ladenMitCache, schreibenOderMerken, vorgangAusfuehren, zeileAendern, zeileLoeschen, anforderungSenden, aufmassSpeichern, bestellen,
  einstempeln, ausstempeln, berichtSpeichern, fotoHochladen, blattSpeichern,
  baustelleSpeichern, artikelSpeichern, positionSpeichern, crewSetzen,
  mitarbeiterSpeichern } from "./daten.js";
import { HinweisRahmen, useBald } from "./Hinweis.jsx";
import { DatenZ, useDaten } from "./datenZ.js";

/* ─────────────────────────────────────────────────────────────
   WARO — Prototyp: Material & Aufmaß
   ───────────────────────────────────────────────────────────── */

const C = { ground:"#EFF2F1", surface:"#FFFFFF", ink:"#14181B", mute:"#5F6C73",
  hair:"#DDE3E2", signal:"#FFCC00", signalDark:"#C79E00", rot:"#C0392B" };

const PHASE = { Anfrage:{c:"#9AA5AA"}, Angebot:{c:"#2F6FD0"}, Beauftragt:{c:"#8A5A2B"},
  "In Arbeit":{c:"#6FA22A"}, Abgenommen:{c:"#0E7C86"}, Abgerechnet:{c:"#2A3238"} };

const ST_FARBE = { Angefordert:"#C0392B", Bestellt:"#C79E00", Geliefert:"#2F6FD0", Verbaut:"#6FA22A" };
/* Was eine Rolle darf. Die Datenbank entscheidet ohnehin selbst — das
   hier steuert nur, was die Oberfläche zeigt und anbietet.

   Leitung     alles, auch Zugänge und Mitarbeiter
   Buchhalter  Preise, Kunden, Stunden — aber keine Rechtevergabe
   Monteur     eigene Baustellen, keine Preise, keine Kundennamen
   Azubi       wie Monteur                                            */
const rechte = (u) => ({
  leitung: u.zugang === "Leitung",
  preise:  u.zugang === "Leitung" || u.zugang === "Buchhalter",
});

/* ── Datenzusammenhang ───────────────────────────────────────
   Alles kommt aus der Datenbank. Row Level Security entscheidet
   serverseitig, was ankommt — die Filter hier sind nur noch
   Darstellung, kein Schutz. */
export 

function baueDaten(d) {
  const M = (id) => d.team.find((t) => t.id === id) ?? { name:"—", kurz:"??", rolle:"", zugang:"Monteur" };
  const A = (id) => d.ARTIKEL.find((x) => x.id === id) ?? { txt:"Unbekannter Artikel", eh:"", lief:"—" };
  /* Die Leitung sieht alles, was ankommt; für andere zeigen wir nur die
     eigenen Baustellen. Fremde kämen ohnehin nicht durch die Regeln. */
  const sichtbar = (u) => rechte(u).leitung ? d.B : d.B.filter((b) => b.crew.includes(u.id));
  return { ...d, M, A, sichtbar };
}

/* Ansatz-Rechner: "3 × 40" oder "12,5+8+4" — kein eval, nur + und × */
function rechne(s) {
  if (!s || !s.trim()) return null;
  const t = s.replace(/×/g, "*").replace(/,/g, ".").replace(/\s/g, "");
  if (!/^[0-9+*.]+$/.test(t)) return null;
  const v = t.split("+").reduce((sum, term) =>
    sum + term.split("*").reduce((p, n) => p * (parseFloat(n) || 0), 1), 0);
  return isFinite(v) ? Math.round(v * 100) / 100 : null;
}
const zahl = (n) => n.toLocaleString("de-DE", { maximumFractionDigits: 2 });
const euro = (n) => n == null ? "—"
  : n.toLocaleString("de-DE", { style:"currency", currency:"EUR" });

/* ── Bausteine ───────────────────────────────────────────── */
const Stripe = ({ phase, ruht }) => {
  const c = PHASE[phase].c;
  return <span className="wr-stripe" style={ruht
    ? { background:`repeating-linear-gradient(135deg, ${c} 0 4px, ${C.ground} 4px 8px)` }
    : { background:c }} />;
};
const Eyebrow = ({ children, right }) => (
  <div className="wr-eyebrow"><span>{children}</span>{right != null && <span className="wr-eyebrow-r">{right}</span>}</div>
);
const Hinweis = ({ children }) => (
  <div className="wr-locked"><Lock size={13} /><span>{children}</span></div>
);

/* ── Heute ───────────────────────────────────────────────── */
function Heute({ u, anf, go, laufend, stempeln, sek, toMat, kannZeit }) {
  const { M, sichtbar } = useDaten();
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState("");
  const r = rechte(u);
  const mein = sichtbar(u);
  /* Läuft die Uhr, gilt die Baustelle aus der Stempelung — sonst die,
     auf der man heute eingeteilt ist. */
  const aktiv = (laufend && mein.find((b) => b.id === laufend.baustelle_id))
    || mein.find((b) => b.heute.includes(u.id)) || mein[0];
  const laeuft = !!laufend;
  const zeit = `${String(Math.floor(sek/3600)).padStart(2,"0")}:${String(Math.floor(sek%3600/60)).padStart(2,"0")}:${String(sek%60).padStart(2,"0")}`;
  const offen = anf.filter((x) => x.status === "Angefordert");
  const dringend = offen.filter((x) => x.dringend);

  return (
    <div className="wr-scroll">
      <div className="wr-hero">
        <div className="wr-hero-date">Freitag · 14. August 2026 · KW 33</div>
        <h1 className="wr-hero-h">Moin, {u.name.split(" ")[0]}</h1>
        <div className="wr-task-s" style={{ marginTop:4 }}>{u.zugang}</div>
      </div>

      {aktiv && (
        <div className="wr-clock" style={{ borderColor: laeuft ? C.signal : C.hair }}>
          <div className="wr-clock-top">
            <div style={{ minWidth:0 }}>
              <div className="wr-clock-lbl">{laeuft ? "Läuft auf" : "Nicht eingestempelt"}</div>
              <div className="wr-clock-bs">{aktiv.name}</div>
              <div className="wr-clock-nr">{aktiv.nr}</div>
            </div>
            <div className="wr-clock-time" style={{ color: laeuft ? C.ink : C.mute }}>{zeit}</div>
          </div>
          <button className="wr-btn-big" disabled={sendet || !kannZeit}
            onClick={async () => {
              setSendet(true); setFehler("");
              try { await stempeln(aktiv.id); }
              catch (e) { setFehler(e.message); }
              finally { setSendet(false); }
            }}
            style={{ background: !kannZeit ? "#E4E9E8" : laeuft ? C.ink : C.signal,
                     color: !kannZeit ? C.mute : laeuft ? "#fff" : C.ink }}>
            {laeuft ? <Square size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
            {sendet ? "Moment …" : laeuft ? "Feierabend" : "Einstempeln"}
          </button>
          {!kannZeit && <p className="wr-hint" style={{ margin:"8px 0 0" }}>
            Zeiterfassung ist noch nicht eingerichtet — der Nachtrag 0002 fehlt in der Datenbank.
          </p>}
          {fehler && <div className="wr-fehler" role="alert"><AlertTriangle size={15} /> {fehler}</div>}
        </div>
      )}

      {r.leitung && offen.length > 0 && (
        <>
          <Eyebrow right={offen.length}>Material wartet auf Bestellung</Eyebrow>
          <button className="wr-bigrow" onClick={toMat}>
            <span className="wr-icon" style={{ background:"#FBE4E1", color:C.rot }}><Package size={16} /></span>
            <div style={{ flex:1, minWidth:0 }}>
              <div className="wr-task-t">{offen.length} Positionen anfordert</div>
              <div className="wr-task-s">
                {dringend.length > 0 ? `${dringend.length} davon dringend` : "aus 3 Baustellen"}
              </div>
            </div>
            <ChevronRight size={16} color={C.mute} />
          </button>
        </>
      )}

      <Eyebrow right={mein.length}>{r.leitung ? "Baustellen" : "Deine Baustellen"}</Eyebrow>
      {mein.map((b) => (
        <button key={b.id} className="wr-card" onClick={() => go(b.id)}>
          <Stripe phase={b.phase} ruht={b.ruht} />
          <div className="wr-card-in">
            <div className="wr-row">
              <span className="wr-card-t">{b.name}</span>
              <ChevronRight size={16} color={C.mute} />
            </div>
            <div className="wr-card-s">{b.adr}</div>
            <div className="wr-avatars">
              {b.heute.map((id) => <span key={id} className="wr-av">{M(id).kurz}</span>)}
              {b.heute.length === 0 && <span className="wr-mono-s">niemand vor Ort</span>}
            </div>
          </div>
        </button>
      ))}
      <div style={{ height:24 }} />
    </div>
  );
}

/* ── Material anfordern (Monteur) ────────────────────────── */
function Anfordern({ u, back, senden }) {
  const bald = useBald();
  const { ARTIKEL, A, sichtbar } = useDaten();
  const darfPreise = rechte(u).preise;
  const mein = sichtbar(u).filter((b) => b.phase === "In Arbeit" || b.phase === "Beauftragt");
  const [bs, setBs] = useState(mein[0]?.id);
  const [q, setQ] = useState("");
  const [korb, setKorb] = useState([]);
  const [wann, setWann] = useState("Mo 17.08.");
  const [dringend, setDringend] = useState(false);
  const [fehler, setFehler] = useState("");

  const treffer = q ? ARTIKEL.filter((a) => a.txt.toLowerCase().includes(q.toLowerCase())).slice(0, 5) : [];
  const add = (a) => { setKorb([...korb, { aId:a.id, menge:1 }]); setQ(""); };
  const setMenge = (i, v) => setKorb(korb.map((k, j) => j === i ? { ...k, menge:Math.max(0, v) } : k));

  return (
    <div className="wr-scroll">
      <div className="wr-sheethead">
        <button className="wr-back2" onClick={back}><ChevronLeft size={18} /> Zurück</button>
        <h1 className="wr-hero-h" style={{ marginTop:14 }}>Material anfordern</h1>
        <p className="wr-sub">Du forderst an, bestellt wird im Büro.</p>
      </div>

      <div className="wr-pad">
        <label className="wr-lbl">Für welche Baustelle</label>
        <div className="wr-select">
          <select value={bs} onChange={(e) => setBs(Number(e.target.value))}>
            {mein.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        <label className="wr-lbl">Artikel suchen</label>
        <div className="wr-search" style={{ margin:0 }}>
          <Search size={16} color={C.mute} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="z. B. Kabelrinne, BSK, NYM …" />
          <button className="wr-x" onClick={() => setQ("")} aria-label="Suche leeren"><X size={16} /></button>
        </div>
        {treffer.map((a) => (
          <button key={a.id} className="wr-hit" onClick={() => add(a)}>
            <Plus size={15} color={C.mute} />
            <div style={{ flex:1, minWidth:0 }}>
              <div className="wr-task-t">{a.txt}</div>
              <div className="wr-task-s">
                {a.lief} · {a.eh}{darfPreise && a.ek != null ? ` · ${euro(a.ek)}` : ""}
              </div>
            </div>
          </button>
        ))}
        <button className="wr-order" style={{ width:"100%", margin:"8px 0 0" }}
          onClick={() => bald("Der Barcode-Scanner")}>
          <Camera size={15} /> Barcode scannen
        </button>
        {q && treffer.length === 0 && (
          <div className="wr-hit" style={{ color:C.mute, fontSize:13 }}>
            Nicht im Stamm. Trotzdem anfordern – Büro legt den Artikel an.
          </div>
        )}

        <label className="wr-lbl">Angefordert ({korb.length})</label>
        {korb.length === 0 && <div className="wr-empty">Noch nichts drin.<br />Oben suchen und antippen.</div>}
        {korb.map((k, i) => {
          const a = A(k.aId);
          return (
            <div key={i} className="wr-hrow">
              <div style={{ flex:1, minWidth:0 }}>
                <div className="wr-task-t">{a.txt}</div>
                <div className="wr-task-s">{a.lief}</div>
              </div>
              <div className="wr-step">
                <button onClick={() => setMenge(i, k.menge - 1)}>–</button>
                <span className="wr-mono-b">{k.menge}</span>
                <button onClick={() => setMenge(i, k.menge + 1)}>+</button>
                <span className="wr-mono-s" style={{ width:20 }}>{a.eh}</span>
              </div>
              <button className="wr-x" onClick={() => setKorb(korb.filter((_, j) => j !== i))}><X size={15} /></button>
            </div>
          );
        })}

        <label className="wr-lbl">Wann gebraucht</label>
        <div className="wr-chips" style={{ padding:0 }}>
          {["Morgen", "Mo 17.08.", "Mi 19.08.", "Nächste Woche"].map((x) => (
            <button key={x} className="wr-chip" onClick={() => setWann(x)}
              style={wann === x ? { background:C.ink, color:"#fff", borderColor:C.ink } : {}}>{x}</button>
          ))}
        </div>

        <button className="wr-toggle" onClick={() => setDringend(!dringend)}
          style={dringend ? { borderColor:C.rot, background:"#FBE4E1" } : {}}>
          <Zap size={16} color={dringend ? C.rot : C.mute} />
          <span style={{ flex:1, textAlign:"left" }}>Dringend – Arbeit steht sonst</span>
          <span className="wr-box" style={dringend ? { background:C.rot, borderColor:C.rot } : {}}>
            {dringend && <Check size={12} color="#fff" strokeWidth={3} />}
          </span>
        </button>

        <button className="wr-btn-big" disabled={korb.length === 0}
          style={{ background: korb.length ? C.signal : "#E4E9E8", color: korb.length ? C.ink : C.mute, marginTop:18 }}
          onClick={async () => {
            try { await senden(bs, korb, wann, dringend); back(); }
            catch (e) { setFehler(e.message || "Senden fehlgeschlagen."); }
          }}>
          <Send size={16} /> Anforderung senden
        </button>
        {fehler && <div className="wr-fehler" role="alert"><AlertTriangle size={15} /> {fehler}</div>}
        <p className="wr-hint">
          Landet sofort in der Sammelliste im Büro. Du siehst unter „Material“, wann sie bestellt wurde
          und wann sie kommt.
        </p>
      </div>
      <div style={{ height:24 }} />
    </div>
  );
}

/* ── Material-Übersicht ──────────────────────────────────── */
function Material({ u, anf, bestellenBei, toAnf }) {
  const { M, A, B, sichtbar } = useDaten();
  const r = rechte(u);
  const [seg, setSeg] = useState("Angefordert");
  const mein = sichtbar(u).map((b) => b.id);
  const pool = anf.filter((x) => r.leitung || mein.includes(x.bId));
  const liste = pool.filter((x) => x.status === seg);

  /* Leitung: nach Lieferant bündeln */
  const lieferanten = [...new Set(liste.map((x) => A(x.aId).lief))];

  const [sendet, setSendet] = useState("");
  const bestellen = async (lief) => {
    setSendet(lief);
    try {
      await bestellenBei(anf.filter((x) => x.status === "Angefordert" && A(x.aId).lief === lief)
        .map((x) => x.id));
    } finally { setSendet(""); }
  };

  const Zeile = ({ x }) => {
    const a = A(x.aId), b = B.find((y) => y.id === x.bId);
    return (
      <div className="wr-task">
        <span className="wr-dot" style={{ background:ST_FARBE[x.status] }} />
        <div style={{ flex:1, minWidth:0 }}>
          <div className="wr-task-t">{a.txt}</div>
          <div className="wr-task-s">
            {b.name} · {M(x.von).kurz} · {x.status === "Bestellt" ? `Liefertermin ${x.lt}` : `bis ${x.wann}`}
          </div>
        </div>
        {x.dringend && x.status === "Angefordert" && <Zap size={14} color={C.rot} />}
        <span style={{ textAlign:"right" }}>
          <span className="wr-mono-b">{zahl(x.menge)}<span className="wr-mono-s"> {a.eh}</span></span>
          {r.preise && a.ek != null &&
            <div className="wr-mono-s">{euro(x.menge * a.ek)}</div>}
        </span>
      </div>
    );
  };

  return (
    <div className="wr-scroll">
      <div className="wr-hero">
        <h1 className="wr-hero-h">Material</h1>
        <div className="wr-hero-date">
          {r.leitung ? "Ganzer Betrieb" : "Deine Baustellen"} · {pool.filter((x) => x.status === "Angefordert").length} offen
        </div>
      </div>

      <div className="wr-seg">
        {["Angefordert", "Bestellt", "Geliefert", "Verbaut"].map((s) => (
          <button key={s} onClick={() => setSeg(s)} className="wr-segb"
            style={seg === s ? { background:"#fff", color:C.ink, boxShadow:"0 1px 3px rgba(0,0,0,.09)" } : {}}>
            {s}
          </button>
        ))}
      </div>

      {liste.length === 0 && <div className="wr-empty">Nichts in „{seg}“.</div>}

      {r.leitung && seg === "Angefordert"
        ? lieferanten.map((lief) => {
            const grp = liste.filter((x) => A(x.aId).lief === lief);
            return (
              <div key={lief}>
                <Eyebrow right={grp.length}>{lief}</Eyebrow>
                {grp.map((x) => <Zeile key={x.id} x={x} />)}
                <button className="wr-order" disabled={sendet === lief}
                  onClick={() => bestellen(lief)}>
                  <Truck size={15} /> {sendet === lief ? "Wird gesendet …" : `Bestellung an ${lief} erzeugen`}
                </button>
              </div>
            );
          })
        : liste.map((x) => <Zeile key={x.id} x={x} />)}

      {!r.leitung && (
        <>
          <button className="wr-btn-big" style={{ background:C.signal, color:C.ink, width:"calc(100% - 28px)", margin:"18px 14px 0" }}
            onClick={toAnf}>
            <Plus size={17} /> Material anfordern
          </button>
          <Hinweis>Preise und Bestellungen laufen über das Büro. Du siehst den Status.</Hinweis>
        </>
      )}
      <div style={{ height:24 }} />
    </div>
  );
}

/* ── Aufmaß ──────────────────────────────────────────────── */
function Aufmass({ u, zeilen, speichern, fotoZu, blattSichern, aendern, loeschen, back }) {
  const { POS, sichtbar } = useDaten();
  const darfPreise = rechte(u).preise;
  const [blatt, setBlatt] = useState(false);
  const mein = sichtbar(u).filter((b) => b.abrechnung === "Einheitspreise");
  const [bs, setBs] = useState(mein[0]?.id);
  const [posId, setPosId] = useState(null);

  const pos = POS.filter((p) => p.bId === bs);
  const summe = (pId) => zeilen.filter((z) => z.pId === pId).reduce((s, z) => s + z.menge, 0);

  if (posId) return <AufmassPos posId={posId} zeilen={zeilen} speichern={speichern} fotoZu={fotoZu}
      aendern={aendern} loeschen={loeschen} back={() => setPosId(null)} />;

  const bs_ = mein.find((b) => b.id === bs);
  if (blatt && bs_) return (
    <Aufmassblatt baustelle={bs_} positionen={pos} zeilen={zeilen} ersteller={u.name}
      speichern={(name, blob) => blattSichern(bs_.id, name, blob)}
      schliessen={() => setBlatt(false)} />
  );

  return (
    <div className="wr-scroll">
      <div className="wr-sheethead">
        <button className="wr-back2" onClick={back}><ChevronLeft size={18} /> Zurück</button>
        <h1 className="wr-hero-h" style={{ marginTop:14 }}>Aufmaß</h1>
        <p className="wr-sub">Was abgerechnet wird, muss messbar begründet sein.</p>
      </div>

      <div className="wr-pad">
        <label className="wr-lbl">Baustelle</label>
        <div className="wr-select">
          <select value={bs} onChange={(e) => { setBs(Number(e.target.value)); setPosId(null); }}>
            {mein.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      <Eyebrow right={pos.length}>Positionen aus dem LV</Eyebrow>
      {pos.map((p) => {
        const s = summe(p.id);
        const pct = Math.min(100, Math.round((s / p.lv) * 100));
        const ueber = s > p.lv;
        return (
          <button key={p.id} className="wr-poscard" onClick={() => setPosId(p.id)}>
            <div className="wr-row">
              <span className="wr-mono-s">{p.nr}</span>
              <span className="wr-mono-b" style={{ color: ueber ? C.rot : C.ink }}>
                {zahl(s)} <span style={{ color:C.mute, fontWeight:400 }}>/ {zahl(p.lv)} {p.eh}</span>
              </span>
            </div>
            <div className="wr-task-t" style={{ marginTop:4 }}>{p.txt}</div>
            <div className="wr-bar" style={{ marginTop:9 }}>
              <span style={{ width:`${pct}%`, background: ueber ? C.rot : PHASE["In Arbeit"].c }} />
            </div>
            <div className="wr-row" style={{ marginTop:7 }}>
              <span className="wr-mono-s">{zeilen.filter((z) => z.pId === p.id).length} Ansätze</span>
              <span className="wr-mono-s" style={{ color: ueber ? C.rot : C.mute }}>
                {ueber ? `${zahl(s - p.lv)} ${p.eh} über LV → Nachtrag` : `${pct} %`}
              </span>
            </div>
            {darfPreise && p.ep != null && (
              <div className="wr-row" style={{ marginTop:5 }}>
                <span className="wr-mono-s">{euro(p.ep)} / {p.eh}</span>
                <span className="wr-mono-b">{euro(s * p.ep)}</span>
              </div>
            )}
          </button>
        );
      })}
      {pos.length === 0 && <div className="wr-empty">Diese Baustelle läuft pauschal.<br />Kein Aufmaß nötig.</div>}

      {pos.length > 0 && (
        <>
          <button className="wr-order" style={{ marginTop:16 }} onClick={() => setBlatt(true)}>
            <FileText size={15} /> Aufmaßblatt erstellen
          </button>
          <button className="wr-order" onClick={() => setBlatt(true)}>
            <PenLine size={15} /> Vom Kunden unterschreiben lassen
          </button>
        </>
      )}
      <div style={{ height:24 }} />
    </div>
  );
}

/* Eine erfasste Aufmass-Zeile. Antippen klappt die Korrektur auf —
   auf einer Baustelle vertippt man sich, und bisher blieb der Fehler
   fuer immer stehen und landete im unterschriebenen Blatt. */
function Zeile({ z, eh, aendern, loeschen }) {
  const [offen, setOffen] = useState(false);
  const [ort, setOrt] = useState(z.ort);
  const [ansatz, setAnsatz] = useState(z.ansatz);
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState("");
  const [sicher, setSicher] = useState(false);
  const wert = rechne(ansatz);

  const tun = async (was) => {
    setSendet(true); setFehler("");
    try {
      if (was === "weg") await loeschen(z.id);
      else await aendern(z.id, { ort: ort.trim(), ansatz, menge: wert });
      setOffen(false); setSicher(false);
    } catch (e) { setFehler(e.message || "Ging nicht."); }
    finally { setSendet(false); }
  };

  if (!offen) return (
    <button className="wr-task" style={{ cursor:"pointer" }} onClick={() => setOffen(true)}>
      <div style={{ flex:1, minWidth:0, textAlign:"left" }}>
        <div className="wr-task-t">{z.ort}</div>
        <div className="wr-task-s">
          <span className="wr-mono">{z.ansatz}</span> · {z.datum}{z.foto ? " · Foto" : ""}
        </div>
      </div>
      {z.foto && <Camera size={14} color={C.mute} />}
      <span className="wr-mono-b">{zahl(z.menge)}<span className="wr-mono-s"> {eh}</span></span>
    </button>
  );

  return (
    <div className="wr-panel" style={{ margin:"0 14px 6px" }}>
      <input className="wr-inp" value={ort} onChange={(e) => setOrt(e.target.value)} placeholder="Wo?" />
      <div className="wr-ansatz">
        <input className="wr-inp" style={{ marginBottom:0 }} value={ansatz}
          onChange={(e) => setAnsatz(e.target.value)} />
        <span className="wr-erg">{wert !== null ? `= ${zahl(wert)} ${eh}` : "?"}</span>
      </div>
      {fehler && <div className="wr-fehler" role="alert"><AlertTriangle size={15} /> {fehler}</div>}
      {sicher ? (
        <>
          <p className="wr-hint">Zeile wirklich entfernen? Sie verschwindet aus dem Aufmassblatt.</p>
          <div className="wr-two">
            <button className="wr-order" style={{ margin:0 }} onClick={() => setSicher(false)}>Behalten</button>
            <button className="wr-btn-big" disabled={sendet}
              style={{ background:C.rot, color:"#fff", padding:"12px" }}
              onClick={() => tun("weg")}>{sendet ? "…" : "Entfernen"}</button>
          </div>
        </>
      ) : (
        <div className="wr-drei">
          <button className="wr-order" style={{ margin:0 }} onClick={() => { setOffen(false); setOrt(z.ort); setAnsatz(z.ansatz); }}>Abbrechen</button>
          <button className="wr-order" style={{ margin:0, borderColor:C.rot, color:C.rot }}
            onClick={() => setSicher(true)}>Löschen</button>
          <button className="wr-btn-big" disabled={sendet || !wert || !ort.trim()}
            style={{ background: wert && ort.trim() ? C.signal : "#E4E9E8",
                     color: wert && ort.trim() ? C.ink : C.mute, padding:"12px" }}
            onClick={() => tun("speichern")}>{sendet ? "…" : "Sichern"}</button>
        </div>
      )}
    </div>
  );
}

function AufmassPos({ posId, zeilen, speichern, fotoZu, aendern, loeschen, back }) {
  const bald = useBald();
  const { POS } = useDaten();
  const p = POS.find((x) => x.id === posId);
  const meine = zeilen.filter((z) => z.pId === posId);
  const s = meine.reduce((a, z) => a + z.menge, 0);
  const [ort, setOrt] = useState("");
  const [ansatz, setAnsatz] = useState("");
  const wert = rechne(ansatz);

  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState("");
  /* Ein Foto gehört zur Zeile. Vor dem Speichern gibt es noch keine —
     dann hängt es erst einmal nur an der Baustelle. */
  const [letzteId, setLetzteId] = useState(null);

  const sichern = async () => {
    if (!wert || !ort.trim() || sendet) return;
    setSendet(true); setFehler("");
    try {
      setLetzteId(await speichern(posId, ort.trim(), ansatz, wert));
      setOrt(""); setAnsatz("");
    } catch (e) {
      setFehler(e.message || "Speichern fehlgeschlagen.");
    } finally { setSendet(false); }
  };

  return (
    <div className="wr-scroll">
      <div className="wr-sheethead">
        <button className="wr-back2" onClick={back}><ChevronLeft size={18} /> Positionen</button>
        <div className="wr-mono-s" style={{ marginTop:14 }}>{p.nr}</div>
        <h1 className="wr-hero-h" style={{ fontSize:23, marginTop:2 }}>{p.txt}</h1>
        <div className="wr-mono-b" style={{ marginTop:9 }}>
          {zahl(s)} <span style={{ color:C.mute, fontWeight:400 }}>von {zahl(p.lv)} {p.eh}</span>
        </div>
      </div>

      <div className="wr-pad">
        <label className="wr-lbl">Neue Zeile</label>
        <input className="wr-inp" value={ort} onChange={(e) => setOrt(e.target.value)}
          placeholder="Wo? z. B. 2. OG Achse D" />
        <div className="wr-ansatz">
          <input className="wr-inp" style={{ marginBottom:0 }} value={ansatz}
            onChange={(e) => setAnsatz(e.target.value)} placeholder="Ansatz, z. B. 3 × 12,5" />
          <span className="wr-erg">
            {wert !== null ? `= ${zahl(wert)} ${p.eh}` : ansatz ? "?" : p.eh}
          </span>
        </div>
        <div className="wr-two">
          <FotoKnopf beschriftung="Foto"
            hochladen={(d) => fotoZu(p.bId, letzteId, d)} />
          <button className="wr-btn-big" style={{ background: wert && ort ? C.signal : "#E4E9E8",
            color: wert && ort ? C.ink : C.mute, padding:"12px" }} onClick={sichern}
            disabled={sendet}>
            {sendet ? "Speichert …" : "Zeile speichern"}
          </button>
        </div>
        {fehler && <div className="wr-fehler" role="alert"><AlertTriangle size={15} /> {fehler}</div>}
        <p className="wr-hint">
          {letzteId
            ? "Ein Foto hängt jetzt an der zuletzt gespeicherten Zeile."
            : "Zuerst die Zeile speichern — dann gehört das Foto zu ihr."}<br />
          Der Ansatz wird mitgespeichert, nicht nur das Ergebnis. Genau den will der Prüfer beim Kunden sehen.
        </p>
      </div>

      <Eyebrow right={meine.length}>Erfasste Ansätze</Eyebrow>
      {meine.map((z) => (
        <Zeile key={z.id} z={z} eh={p.eh} aendern={aendern} loeschen={loeschen} />
      ))}
      {meine.length === 0 && <div className="wr-empty">Noch nichts erfasst.</div>}
      <div style={{ height:24 }} />
    </div>
  );
}

/* ── Erfassen-Auswahl ────────────────────────────────────── */
function Erfassen({ u, pick }) {
  const items = [
    { k:"bericht", I:FileText, t:"Tagesbericht", s:"Stunden, was gemacht wurde, Fotos" },
    { k:"aufmass", I:Ruler, t:"Aufmaß", s:"Mengen mit Ansatz für die Abrechnung" },
    { k:"anford", I:Package, t:"Material anfordern", s:"Geht an das Büro zur Bestellung" },
  ];
  return (
    <div className="wr-scroll">
      <div className="wr-hero">
        <div className="wr-hero-date">Freitag · 14. August 2026</div>
        <h1 className="wr-hero-h">Erfassen</h1>
      </div>
      <div className="wr-pad">
        {items.map(({ k, I, t, s }) => (
          <button key={k} className="wr-bigcard" onClick={() => pick(k)}>
            <span className="wr-bigicon"><I size={20} /></span>
            <div style={{ flex:1, textAlign:"left" }}>
              <div className="wr-bigt">{t}</div>
              <div className="wr-task-s" style={{ whiteSpace:"normal" }}>{s}</div>
            </div>
            <ChevronRight size={18} color={C.mute} />
          </button>
        ))}
      </div>
      <div style={{ height:24 }} />
    </div>
  );
}

/* ── Tagesbericht (gekürzt) ──────────────────────────────── */
function Bericht({ u, back, speichern, fotoZu }) {
  const { sichtbar } = useDaten();
  const mein = sichtbar(u).filter((b) => b.phase === "In Arbeit" || b.phase === "Beauftragt");
  const [txt, setTxt] = useState("");
  const [rec, setRec] = useState(false);
  const [bs, setBs] = useState(mein[0]?.id);
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState("");
  const [fertig, setFertig] = useState(null);   // id des gespeicherten Berichts
  useEffect(() => {
    if (!rec) return;
    const t = setTimeout(() => {
      setTxt("RLT-Kanalfühler Position x2 nach Wärmetauscher gesetzt und verdrahtet. Kabelrinne im UG abgehängt.");
      setRec(false);
    }, 2000);
    return () => clearTimeout(t);
  }, [rec]);
  return (
    <div className="wr-scroll">
      <div className="wr-sheethead">
        <button className="wr-back2" onClick={back}><ChevronLeft size={18} /> Zurück</button>
        <h1 className="wr-hero-h" style={{ marginTop:14 }}>Tagesbericht</h1>
        <p className="wr-sub">Freitag, 14. August 2026</p>
      </div>
      <div className="wr-pad">
        <label className="wr-lbl">Baustelle</label>
        <div className="wr-select">
          <select value={bs} onChange={(e) => setBs(e.target.value)}>
            {mein.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <label className="wr-lbl">Was wurde gemacht</label>
        <div className="wr-ta">
          <textarea rows={5} value={txt} onChange={(e) => setTxt(e.target.value)}
            placeholder={rec ? "Hört zu …" : "Tippen – oder Mikro drücken und erzählen."} />
          <button className="wr-mic" onClick={() => setRec(true)} style={rec ? { background:C.ink, color:C.signal } : {}}>
            <Mic size={18} />
          </button>
        </div>
        {rec && <div className="wr-rec">Aufnahme läuft …</div>}
        <label className="wr-lbl">Fotos</label>
        <div className="wr-photos">
          <FotoKnopf gross hochladen={(d) => fotoZu(bs, null, d, fertig)} />
          <div className="wr-photo" /><div className="wr-photo" />
        </div>
        {fehler && <div className="wr-fehler" role="alert"><AlertTriangle size={15} /> {fehler}</div>}
        <button className="wr-btn-big" disabled={sendet || !txt.trim()}
          style={{ background: txt.trim() && !sendet ? C.signal : "#E4E9E8",
                   color: txt.trim() && !sendet ? C.ink : C.mute, marginTop:18 }}
          onClick={async () => {
            setSendet(true); setFehler("");
            try { setFertig(await speichern(bs, txt.trim())); setTxt(""); }
            catch (e) { setFehler(e.message); }
            finally { setSendet(false); }
          }}>
          {sendet ? "Wird gesendet …" : fertig ? "Abgeschickt" : "Bericht abschicken"}
        </button>
        <p className="wr-hint">
          Das Mikro tut nur so: Es blendet nach zwei Sekunden einen festen Text
          ein. Echte Spracherkennung kommt später.
        </p>
      </div>
      <div style={{ height:24 }} />
    </div>
  );
}

/* ── Baustellen-Detail (mit Aufmaß-Tab) ──────────────────── */
function Detail({ u, id, back, zeilen, anf }) {
  const bald = useBald();
  const { M, A, B, POS } = useDaten();
  const r = rechte(u);
  const b = B.find((x) => x.id === id);
  const [tab, setTab] = useState("Übersicht");
  const p = PHASE[b.phase];
  const pos = POS.filter((x) => x.bId === b.id);
  const mat = anf.filter((x) => x.bId === b.id);
  const summe = (pId) => zeilen.filter((z) => z.pId === pId).reduce((s, z) => s + z.menge, 0);

  return (
    <div className="wr-scroll">
      <div className="wr-dhead" style={{ background:p.c }}>
        <button className="wr-back" onClick={back}><ChevronLeft size={18} /> Zurück</button>
        <div className="wr-dnr">{b.nr}</div>
        <h1 className="wr-dtitle">{b.name}</h1>
        <div className="wr-dtags">
          <span className="wr-dtag">{b.phase}{b.ruht && " · ruht"}</span>
          <span className="wr-dtag">{b.abrechnung}</span>
        </div>
      </div>

      <div className="wr-quick">
        {/* Navi geht wirklich: öffnet die Karten-App mit der Adresse. */}
        <a className="wr-quick-b" target="_blank" rel="noreferrer"
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.adr)}`}>
          <MapPin size={17} /><span>Navi</span>
        </a>
        {b.telefon
          ? <a className="wr-quick-b" href={`tel:${b.telefon.replace(/\s/g, "")}`}>
              <Phone size={17} /><span>{b.ap.split(" ")[0] || "Anrufen"}</span>
            </a>
          : <button className="wr-quick-b" onClick={() => bald("Eine Rufnummer")}>
              <Phone size={17} /><span>{b.ap.split(" ")[0] || "Anrufen"}</span>
            </button>}
        <button className="wr-quick-b" onClick={() => setTab("Material")}>
          <Package size={17} /><span>Material</span>
        </button>
      </div>

      <div className="wr-tabs">
        {["Übersicht", "Aufmaß", "Material"].map((t) => (
          <button key={t} onClick={() => setTab(t)} className="wr-tab"
            style={tab === t ? { color:C.ink, borderBottomColor:C.signal } : {}}>{t}</button>
        ))}
      </div>

      {tab === "Übersicht" && (
        <div className="wr-pad">
          <dl className="wr-dl">
            {r.leitung && <><dt>Kunde</dt><dd>{b.kunde}</dd></>}
            <dt>Ansprechpartner</dt><dd>{b.ap}</dd>
            <dt>Adresse</dt><dd>{b.adr}</dd>
            <dt>Abrechnung</dt><dd>{b.abrechnung}</dd>
            {r.preise && pos.length > 0 && (<>
              <dt>Auftragswert laut LV</dt>
              <dd className="wr-mono">
                {euro(pos.reduce((w, p) => w + (p.ep ?? 0) * p.lv, 0))}
              </dd>
              <dt>Erfasst</dt>
              <dd className="wr-mono">
                {euro(pos.reduce((w, p) => w + (p.ep ?? 0) * summe(p.id), 0))}
              </dd>
            </>)}
            <dt>Ausführung</dt><dd className="wr-mono">{b.von} – {b.bis}</dd>
          </dl>
          <Eyebrow>Zugeteilt</Eyebrow>
          {b.crew.map((cid) => (
            <div key={cid} className="wr-task" style={{ margin:"0 0 6px" }}>
              <span className="wr-av">{M(cid).kurz}</span>
              <div style={{ flex:1 }}>
                <div className="wr-task-t">{M(cid).name}</div>
                <div className="wr-task-s">{M(cid).rolle}</div>
              </div>
              {b.heute.includes(cid) && <span className="wr-pill">heute da</span>}
            </div>
          ))}
        </div>
      )}

      {tab === "Aufmaß" && (
        <div className="wr-pad">
          {pos.length === 0
            ? <div className="wr-empty">Pauschalauftrag – kein Aufmaß nötig.<br />Abgerechnet wird nach Baufortschritt.</div>
            : pos.map((x) => {
                const s = summe(x.id), pct = Math.min(100, Math.round(s / x.lv * 100)), ueber = s > x.lv;
                return (
                  <div key={x.id} className="wr-panel">
                    <div className="wr-row">
                      <span className="wr-mono-s">{x.nr}</span>
                      <span className="wr-mono-b" style={{ color: ueber ? C.rot : C.ink }}>
                        {zahl(s)} <span style={{ color:C.mute, fontWeight:400 }}>/ {zahl(x.lv)} {x.eh}</span>
                      </span>
                    </div>
                    <div className="wr-task-t" style={{ marginTop:4 }}>{x.txt}</div>
                    <div className="wr-bar"><span style={{ width:`${pct}%`, background: ueber ? C.rot : p.c }} /></div>
                  </div>
                );
              })}
        </div>
      )}

      {tab === "Material" && (
        <div className="wr-pad">
          {mat.length === 0 && <div className="wr-empty">Noch nichts angefordert.</div>}
          {mat.map((x) => (
            <div key={x.id} className="wr-task" style={{ margin:"0 0 6px" }}>
              <span className="wr-dot" style={{ background:ST_FARBE[x.status] }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div className="wr-task-t">{A(x.aId).txt}</div>
                <div className="wr-task-s">{x.status}{x.lt ? ` · ${x.lt}` : ""}</div>
              </div>
              <span className="wr-mono-b">{zahl(x.menge)}<span className="wr-mono-s"> {A(x.aId).eh}</span></span>
            </div>
          ))}
        </div>
      )}
      <div style={{ height:24 }} />
    </div>
  );
}

/* ── Baustellenliste ─────────────────────────────────────── */
function Baustellen({ u, go }) {
  const { sichtbar } = useDaten();
  const list = sichtbar(u);
  return (
    <div className="wr-scroll">
      <div className="wr-hero">
        <h1 className="wr-hero-h">Baustellen</h1>
        <div className="wr-hero-date">{list.length} sichtbar</div>
      </div>
      {list.map((b) => (
        <button key={b.id} className="wr-card" onClick={() => go(b.id)}>
          <Stripe phase={b.phase} ruht={b.ruht} />
          <div className="wr-card-in">
            <div className="wr-row"><span className="wr-card-t">{b.name}</span><span className="wr-mono-s">{b.nr}</span></div>
            <div className="wr-card-s">{rechte(u).leitung ? b.kunde : b.adr}</div>
            <div className="wr-card-meta">
              <span className="wr-tag" style={{ color:PHASE[b.phase].c, borderColor:PHASE[b.phase].c + "55" }}>
                {b.phase}{b.ruht && " · ruht"}
              </span>
              <span className="wr-mono-s">{b.abrechnung}</span>
            </div>
          </div>
        </button>
      ))}
      <div style={{ height:24 }} />
    </div>
  );
}

/* ── Rahmen ──────────────────────────────────────────────── */
/* ── Mehr ────────────────────────────────────────────────── */
/* Eigene Komponente, weil sie useBald() braucht: App stellt den
   Hinweis-Zusammenhang bereit und kann ihn deshalb nicht selbst lesen. */
function Mehr({ u, abmelden, betrieb, neuLaden, stamm, zeige }) {
  const { ARTIKEL, B, POS, ZEITEN, BERICHTE, FOTOS } = useDaten();
  return (
    <div className="wr-scroll">
      <div className="wr-hero"><h1 className="wr-hero-h">Mehr</h1></div>
      <Eyebrow right={betrieb}>Dein Zugang</Eyebrow>
      <div className="wr-task">
        <span className="wr-av" style={{ background:C.ink, color:"#fff" }}>{u.kurz}</span>
        <div style={{ flex:1 }}>
          <div className="wr-task-t">{u.name}</div>
          <div className="wr-task-s">{u.zugang} · {u.rolle}</div>
        </div>
      </div>
      <button className="wr-order" onClick={abmelden}>Abmelden</button>
      <button className="wr-order" onClick={neuLaden}>Daten neu laden</button>
      {rechte(u).leitung && (
        <>
          <Eyebrow>Erfasstes ansehen</Eyebrow>
      {[{ I:Clock, t:"Stunden", s:`${ZEITEN.length} Stempelungen`, k:"stunden" },
        { I:FileText, t:"Tagesberichte", s:`${BERICHTE.length} Berichte`, k:"berichte" },
        { I:Camera, t:"Fotos", s:`${FOTOS.length} Aufnahmen`, k:"fotos" }].map(({ I, t, s, k }) => (
        <button key={k} className="wr-task" style={{ cursor:"pointer" }} onClick={() => zeige(k)}>
          <span className="wr-icon"><I size={15} /></span>
          <div style={{ flex:1, textAlign:"left" }}>
            <div className="wr-task-t">{t}</div><div className="wr-task-s">{s}</div>
          </div>
          <ChevronRight size={16} color={C.mute} />
        </button>
      ))}

      <Eyebrow>Stammdaten</Eyebrow>
          <button className="wr-task" style={{ cursor:"pointer" }} onClick={stamm}>
            <span className="wr-icon"><Building2 size={15} /></span>
            <div style={{ flex:1, textAlign:"left" }}>
              <div className="wr-task-t">Anlegen und ändern</div>
              <div className="wr-task-s">
                {B.length} Baustellen · {ARTIKEL.length} Artikel · {POS.length} LV-Positionen
              </div>
            </div>
            <ChevronRight size={16} color={C.mute} />
          </button>
        </>
      )}
      <div style={{ height:24 }} />
    </div>
  );
}

/* Alle Stile an einer Stelle. Wird sowohl vom Anmeldebildschirm als auch
   von der App selbst gebraucht, deshalb ausserhalb der Komponente. */
export const STIL = `
.wr-root{--oben:env(safe-area-inset-top,0px);--unten:env(safe-area-inset-bottom,0px);--g:${C.ground};--s:${C.surface};--i:${C.ink};--m:${C.mute};--h:${C.hair};--y:${C.signal};
  font-family:'IBM Plex Sans',system-ui,sans-serif;color:var(--i);background:#20262A;min-height:100vh;
  display:flex;align-items:center;justify-content:center;}
/* Auf dem Geraet fuellt die App den ganzen Bildschirm. Die Begrenzung
   auf 420px ist ein Telefonrahmen fuer die Vorschau am Rechner — auf
   einem breiteren Handy blieben sonst links und rechts Streifen. */
.wr-phone{width:100%;height:100vh;height:100dvh;background:var(--g);display:flex;flex-direction:column;overflow:hidden;}
@media(min-width:520px){.wr-root{padding:24px}
  .wr-phone{max-width:420px;height:880px;max-height:94vh;border-radius:26px;box-shadow:0 24px 70px rgba(0,0,0,.5)}}
.wr-demo{flex:none;background:#20262A;padding:8px 10px 9px;display:flex;align-items:center;gap:7px;}
.wr-demo-l{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#7C8A91;flex:none;}
.wr-demo-b{flex:1;border:1px solid #38424A;background:none;color:#B4C0C6;border-radius:7px;padding:6px 4px;
  font-family:'Archivo',sans-serif;font-weight:600;font-size:11px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.wr-demo-b.on{background:var(--y);border-color:var(--y);color:#14181B;}
.wr-demo-wer{flex:1;min-width:0;color:#DCE4E8;font-family:'Archivo',sans-serif;font-weight:600;font-size:11.5px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.wr-demo-ab{flex:none;border:1px solid #38424A;background:none;color:#B4C0C6;border-radius:7px;padding:5px 10px;
  font-family:'Archivo',sans-serif;font-weight:600;font-size:11px;cursor:pointer;}
.wr-anmelde{display:flex;flex-direction:column;}
.wr-anmelde-kopf{padding:calc(38px + var(--oben)) 18px 4px;}
.wr-marke{display:flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:15px;
  background:var(--y);color:var(--i);font-family:'Archivo',sans-serif;font-weight:800;font-size:30px;line-height:1;}
.wr-fehler{display:flex;align-items:center;gap:8px;margin-top:10px;padding:10px 12px;background:#FBE4E1;
  border-radius:9px;font-size:12.5px;color:${C.rot};}
.wr-fehler svg{flex:none}
.wr-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;}
.wr-scroll::-webkit-scrollbar{width:0}
.wr-hero{padding:24px 18px 12px;}
.wr-hero-h{font-family:'Archivo',sans-serif;font-weight:800;font-size:29px;letter-spacing:-.025em;margin:0;line-height:1.05;}
.wr-hero-date{font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--m);margin-bottom:5px;}
.wr-sub{font-size:13px;color:var(--m);margin:6px 0 0;line-height:1.4;}
.wr-sheethead{padding:14px 18px 4px;}
.wr-back2{background:#E4E9E8;border:none;color:var(--i);border-radius:7px;padding:6px 11px 6px 7px;
  font-family:'Archivo',sans-serif;font-weight:600;font-size:12px;display:inline-flex;align-items:center;gap:2px;cursor:pointer;}
.wr-eyebrow{display:flex;justify-content:space-between;align-items:baseline;padding:22px 18px 8px;
  font-family:'Archivo',sans-serif;font-weight:700;font-size:10.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--m);}
.wr-eyebrow-r{font-family:'IBM Plex Mono',monospace;font-weight:500;letter-spacing:0;}
.wr-clock{margin:4px 14px 6px;background:var(--s);border:1.5px solid var(--h);border-radius:14px;padding:16px 16px 14px;transition:border-color .25s;}
.wr-clock-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px;}
.wr-clock-lbl{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--m);}
.wr-clock-bs{font-family:'Archivo',sans-serif;font-weight:700;font-size:17px;margin-top:3px;}
.wr-clock-nr{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--m);margin-top:1px;}
.wr-clock-time{font-family:'IBM Plex Mono',monospace;font-weight:500;font-size:23px;font-variant-numeric:tabular-nums;white-space:nowrap;}
.wr-btn-big{width:100%;border:none;border-radius:10px;padding:14px;font-family:'Archivo',sans-serif;font-weight:700;
  font-size:14.5px;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;}
.wr-btn-big:active{transform:scale(.985)}
.wr-card{display:flex;width:calc(100% - 28px);margin:0 14px 7px;background:var(--s);border:1px solid var(--h);
  border-radius:11px;overflow:hidden;text-align:left;cursor:pointer;padding:0;}
.wr-stripe{width:5px;flex:none;align-self:stretch;}
.wr-card-in{flex:1;min-width:0;padding:12px 13px;}
.wr-row{display:flex;justify-content:space-between;align-items:center;gap:10px;}
.wr-card-t{font-family:'Archivo',sans-serif;font-weight:700;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.wr-card-s{font-size:12.5px;color:var(--m);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.wr-card-meta{display:flex;align-items:center;gap:9px;margin-top:9px;flex-wrap:wrap;}
.wr-tag{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.05em;text-transform:uppercase;
  border:1px solid;border-radius:4px;padding:2px 6px;}
.wr-mono,.wr-mono-s,.wr-mono-b{font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;}
.wr-mono-s{font-size:11.5px;color:var(--m);white-space:nowrap;}
.wr-mono-b{font-size:14px;font-weight:600;white-space:nowrap;}
.wr-avatars{display:flex;align-items:center;gap:5px;margin-top:9px;}
.wr-av{width:26px;height:26px;border-radius:7px;background:#E4E9E8;flex:none;display:flex;align-items:center;
  justify-content:center;font-family:'IBM Plex Mono',monospace;font-size:10.5px;font-weight:600;}
.wr-icon{width:30px;height:30px;border-radius:8px;background:#E4E9E8;flex:none;display:flex;align-items:center;
  justify-content:center;color:var(--m);}
.wr-search{display:flex;align-items:center;gap:9px;margin:2px 14px 10px;background:var(--s);border:1px solid var(--h);
  border-radius:10px;padding:10px 12px;}
.wr-search input{flex:1;border:none;outline:none;background:none;font-family:'IBM Plex Sans',sans-serif;font-size:14px;min-width:0;}
.wr-x{border:none;background:none;color:var(--m);cursor:pointer;padding:0;display:flex;}
.wr-chips{display:flex;gap:6px;overflow-x:auto;padding:0 14px 10px;}
.wr-chips::-webkit-scrollbar{height:0}
.wr-chip{flex:none;border:1px solid var(--h);background:var(--s);border-radius:20px;padding:7px 13px;
  font-family:'Archivo',sans-serif;font-weight:600;font-size:11.5px;color:var(--i);cursor:pointer;white-space:nowrap;}
.wr-task{display:flex;align-items:center;gap:11px;width:calc(100% - 28px);margin:0 14px 6px;background:var(--s);
  border:1px solid var(--h);border-radius:10px;padding:11px 13px;text-align:left;}
.wr-task-t{font-size:13.5px;font-weight:500;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.wr-task-s{font-size:11.5px;color:var(--m);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.wr-bigrow{display:flex;align-items:center;gap:11px;width:calc(100% - 28px);margin:0 14px 6px;background:var(--s);
  border:1px solid var(--h);border-radius:11px;padding:13px;cursor:pointer;text-align:left;}
.wr-box{width:19px;height:19px;flex:none;border:1.5px solid #BCC6C4;border-radius:5px;background:none;
  display:flex;align-items:center;justify-content:center;}
.wr-dot{width:9px;height:9px;border-radius:50%;flex:none;}
.wr-locked{display:flex;align-items:flex-start;gap:8px;margin:12px 14px 0;padding:11px 13px;background:#E7EBEA;
  border-radius:10px;font-size:12px;line-height:1.45;color:var(--m);}
.wr-locked svg{flex:none;margin-top:1px}
.wr-dhead{padding:14px 18px 20px;color:#fff;}
.wr-back{background:rgba(255,255,255,.18);border:none;color:#fff;border-radius:7px;padding:5px 10px 5px 6px;
  font-family:'Archivo',sans-serif;font-weight:600;font-size:12px;display:inline-flex;align-items:center;gap:2px;cursor:pointer;margin-bottom:16px;}
.wr-dnr{font-family:'IBM Plex Mono',monospace;font-size:11px;opacity:.8;letter-spacing:.08em;}
.wr-dtitle{font-family:'Archivo',sans-serif;font-weight:800;font-size:25px;letter-spacing:-.025em;margin:3px 0 0;line-height:1.1;}
.wr-dtags{display:flex;gap:6px;margin-top:11px;}
.wr-dtag{background:rgba(255,255,255,.2);border-radius:5px;padding:3px 8px;font-family:'IBM Plex Mono',monospace;
  font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;}
.wr-quick{display:flex;gap:7px;padding:12px 14px;}
.wr-quick-b{flex:1;background:var(--s);border:1px solid var(--h);border-radius:10px;padding:11px 4px;display:flex;
  flex-direction:column;align-items:center;gap:5px;text-decoration:none;color:var(--i);font-family:'Archivo',sans-serif;font-weight:600;font-size:11px;}
.wr-quick-b span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}
.wr-tabs{display:flex;gap:2px;padding:0 14px;border-bottom:1px solid var(--h);}
.wr-tab{flex:1;background:none;border:none;border-bottom:2.5px solid transparent;padding:11px 2px;
  font-family:'Archivo',sans-serif;font-weight:600;font-size:12.5px;color:var(--m);cursor:pointer;}
.wr-pad{padding:14px 14px 0;}
.wr-panel{background:var(--s);border:1px solid var(--h);border-radius:11px;padding:13px;margin-bottom:8px;}
.wr-bar{height:6px;background:#E4E9E8;border-radius:3px;margin-top:9px;overflow:hidden;}
.wr-bar span{display:block;height:100%;border-radius:3px;}
.wr-lbl{font-family:'Archivo',sans-serif;font-weight:700;font-size:10.5px;letter-spacing:.13em;text-transform:uppercase;
  color:var(--m);display:block;margin:18px 0 7px;}
.wr-dl{margin:8px 0 0;}
.wr-dl dt{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--m);margin-top:13px;}
.wr-dl dd{margin:2px 0 0;font-size:14px;line-height:1.4;}
.wr-pill{display:inline-flex;align-items:center;gap:4px;background:var(--g);border-radius:5px;padding:3px 7px;
  font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:var(--m);flex:none;}
.wr-select{background:var(--s);border:1px solid var(--h);border-radius:10px;padding:2px 10px;}
.wr-select select{width:100%;border:none;background:none;outline:none;padding:11px 0;font-family:'IBM Plex Sans',sans-serif;font-size:14px;color:var(--i);}
.wr-inp{width:100%;box-sizing:border-box;background:var(--s);border:1px solid var(--h);border-radius:10px;padding:12px;
  font-family:'IBM Plex Sans',sans-serif;font-size:14px;color:var(--i);outline:none;margin-bottom:7px;}
.wr-ansatz{position:relative;}
.wr-ansatz .wr-inp{padding-right:96px;font-family:'IBM Plex Mono',monospace;}
.wr-erg{position:absolute;right:12px;top:50%;transform:translateY(-50%);font-family:'IBM Plex Mono',monospace;
  font-size:13px;font-weight:600;color:var(--m);}
.wr-two{display:grid;grid-template-columns:1fr 1.4fr;gap:7px;margin-top:7px;}
.wr-drei{display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:6px;margin-top:9px;}
.wr-hit{display:flex;align-items:center;gap:11px;width:100%;background:var(--s);border:1px solid var(--h);
  border-radius:10px;padding:11px 13px;margin-top:6px;cursor:pointer;text-align:left;}
.wr-hrow{display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--s);
  border:1px solid var(--h);border-radius:10px;padding:9px 11px;margin-bottom:6px;}
.wr-step{display:flex;align-items:center;gap:8px;flex:none;}
.wr-step button{width:29px;height:29px;border-radius:8px;border:1px solid var(--h);background:var(--g);font-size:16px;
  line-height:1;color:var(--i);cursor:pointer;}
.wr-toggle{display:flex;align-items:center;gap:10px;width:100%;background:var(--s);border:1.5px solid var(--h);
  border-radius:10px;padding:13px;margin-top:12px;font-size:13.5px;cursor:pointer;color:var(--i);}
.wr-order{display:flex;align-items:center;justify-content:center;gap:7px;width:calc(100% - 28px);margin:8px 14px 0;
  background:var(--s);border:1.5px solid var(--h);border-radius:10px;padding:13px;font-family:'Archivo',sans-serif;
  font-weight:700;font-size:13px;color:var(--i);cursor:pointer;}
.wr-seg{display:flex;gap:3px;margin:0 14px 12px;background:#E4E9E8;border-radius:10px;padding:3px;}
.wr-segb{flex:1;border:none;background:none;border-radius:8px;padding:8px 2px;font-family:'Archivo',sans-serif;
  font-weight:600;font-size:11px;color:var(--m);cursor:pointer;}
.wr-poscard{display:block;width:calc(100% - 28px);margin:0 14px 7px;background:var(--s);border:1px solid var(--h);
  border-radius:11px;padding:13px;text-align:left;cursor:pointer;}
.wr-bigcard{display:flex;align-items:center;gap:13px;width:100%;background:var(--s);border:1px solid var(--h);
  border-radius:12px;padding:16px 14px;margin-bottom:9px;cursor:pointer;}
.wr-bigicon{width:42px;height:42px;border-radius:11px;background:var(--y);color:var(--i);flex:none;display:flex;
  align-items:center;justify-content:center;}
.wr-bigt{font-family:'Archivo',sans-serif;font-weight:700;font-size:15.5px;}
.wr-ta{position:relative;}
.wr-ta textarea{width:100%;box-sizing:border-box;background:var(--s);border:1px solid var(--h);border-radius:10px;
  padding:12px 54px 12px 12px;font-family:'IBM Plex Sans',sans-serif;font-size:14px;line-height:1.5;outline:none;resize:none;}
.wr-mic{position:absolute;right:9px;bottom:9px;width:38px;height:38px;border-radius:10px;border:1px solid var(--h);
  background:var(--g);color:var(--i);display:flex;align-items:center;justify-content:center;cursor:pointer;}
.wr-rec{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--m);margin-top:7px;animation:wrp 1.1s ease-in-out infinite;}
@keyframes wrp{0%,100%{opacity:.45}50%{opacity:1}}
@media(prefers-reduced-motion:reduce){.wr-rec{animation:none}}
.wr-photos{display:flex;gap:7px;}
.wr-photo-add{width:66px;height:66px;border-radius:10px;border:1.5px dashed #BCC6C4;background:var(--s);display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:3px;color:var(--m);font-family:'Archivo',sans-serif;
  font-weight:600;font-size:10px;cursor:pointer;flex:none;}
.wr-photo{width:66px;height:66px;border-radius:10px;flex:none;background:linear-gradient(135deg,#D6DEDC,#BFCAC7);}
.wr-hint{font-size:11.5px;color:var(--m);line-height:1.45;margin:10px 2px 0;}
.wr-empty{text-align:center;color:var(--m);font-size:13px;line-height:1.6;padding:28px 24px;}
.wr-blatt{background:#fff;color:#14181B;margin:0 14px;border:1px solid var(--h);border-radius:11px;padding:16px;}
.wr-blatt-kopf{display:flex;justify-content:space-between;gap:12px;border-bottom:2px solid #14181B;padding-bottom:10px;}
.wr-blatt-titel{font-family:'Archivo',sans-serif;font-weight:800;font-size:19px;}
.wr-blatt-klein{font-size:11px;color:#5F6C73;line-height:1.5;}
.wr-blatt-pos{margin-top:14px;}
.wr-blatt-poskopf{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;font-weight:600;
  border-bottom:1px solid #DDE3E2;padding-bottom:5px;}
.wr-blatt-tab{width:100%;border-collapse:collapse;font-size:11.5px;margin-top:5px;}
.wr-blatt-tab th{text-align:left;font-weight:500;color:#5F6C73;font-size:10px;text-transform:uppercase;
  letter-spacing:.06em;padding:3px 4px;}
.wr-blatt-tab td{padding:3px 4px;border-top:1px solid #EFF2F1;}
.wr-blatt-nachtrag{margin-top:5px;font-size:11px;color:${C.rot};font-weight:600;}
.wr-blatt-unten{margin-top:26px;}
.wr-blatt-linie{border-bottom:1px solid #14181B;height:34px;}
.wr-unterschrift{position:relative;background:var(--s);border:1.5px dashed #BCC6C4;border-radius:10px;overflow:hidden;}
.wr-unterschrift canvas{display:block;touch-action:none;}
.wr-unterschrift-hint{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  pointer-events:none;color:var(--m);font-size:13px;}
@media print{
  body *{visibility:hidden!important}
  #wr-blatt, #wr-blatt *{visibility:visible!important}
  #wr-blatt{position:absolute;left:0;top:0;width:100%;margin:0;border:none;border-radius:0;}
}
.wr-phone{padding-bottom:0;padding-top:var(--oben)}
.wr-netz{flex:none;display:flex;align-items:center;gap:8px;padding:9px 13px;font-size:12px;line-height:1.35;
  background:#2A3238;color:#EEF2F1;}
.wr-netz svg{flex:none}
.wr-netz span{flex:1;min-width:0}
.wr-netz-warte{background:#3A4A28;}
.wr-netz-rot{background:${C.rot};}
.wr-galerie{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;}
.wr-galerie-bild{display:block;aspect-ratio:1;border-radius:9px;overflow:hidden;background:#E4E9E8;
  display:flex;align-items:center;justify-content:center;color:var(--m);text-decoration:none;}
.wr-galerie-bild img{width:100%;height:100%;object-fit:cover;display:block;}
.wr-mitte{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:32px 24px;text-align:center;color:var(--m);font-size:14px;}
.wr-dreht{animation:wrdreh 1s linear infinite}
@keyframes wrdreh{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.wr-dreht{animation:none}}
.wr-toast{position:absolute;left:14px;right:14px;bottom:74px;z-index:20;display:flex;align-items:center;gap:9px;
  background:var(--i);color:#fff;border-radius:11px;padding:12px 14px;font-size:12.5px;line-height:1.35;
  box-shadow:0 8px 24px rgba(0,0,0,.28);animation:wrein .18s ease-out;}
.wr-toast svg{flex:none;color:var(--y)}
@keyframes wrein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.wr-toast{animation:none}}
.wr-phone{position:relative;}
.wr-update{flex:none;display:flex;align-items:center;gap:9px;background:var(--y);color:var(--i);
  padding:11px 13px;border-top:1px solid rgba(0,0,0,.12);}
.wr-update svg{flex:none}
.wr-update-t{flex:1;min-width:0;font-family:'Archivo',sans-serif;font-weight:700;font-size:12.5px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.wr-update-b{flex:none;border:none;background:var(--i);color:#fff;border-radius:7px;padding:7px 12px;
  font-family:'Archivo',sans-serif;font-weight:700;font-size:12px;cursor:pointer;}
.wr-update-x{flex:none;border:none;background:none;color:var(--i);opacity:.65;padding:7px 2px;
  font-family:'Archivo',sans-serif;font-weight:600;font-size:12px;cursor:pointer;}
.wr-update-ok{background:#E7EBEA;color:var(--m);}
.wr-nav{display:flex;background:var(--s);border-top:1px solid var(--h);padding:7px 4px calc(7px + var(--unten));flex:none;}
.wr-nav button{flex:1;background:none;border:none;padding:5px 2px 3px;display:flex;flex-direction:column;align-items:center;
  gap:3px;cursor:pointer;color:var(--m);position:relative;}
.wr-nav button span{font-family:'Archivo',sans-serif;font-weight:600;font-size:9.5px;}
.wr-nav .on{color:var(--i)}
.wr-nav .on::before{content:'';position:absolute;top:-7px;left:50%;transform:translateX(-50%);width:24px;height:2.5px;
  background:var(--y);border-radius:2px;}
.wr-root button:focus-visible,.wr-root a:focus-visible,.wr-root input:focus-visible,.wr-root select:focus-visible,
.wr-root textarea:focus-visible{outline:2.5px solid ${C.signalDark};outline-offset:2px;}`;

export default function App() {
  const [sitzung, setSitzung] = useState(undefined);   // undefined = wird noch geprüft
  const [daten, setDaten] = useState(null);
  const [ladefehler, setLadefehler] = useState("");
  const [ausCache, setAusCache] = useState(false);
  const [stand, setStand] = useState(0);
  const [offen, setOffen] = useState(() => schlangeLesen().length);
  const [verworfen, setVerworfen] = useState([]);
  const [tab, setTab] = useState("heute");
  const [erf, setErf] = useState(null);
  const [detail, setDetail] = useState(null);
  const [stamm, setStamm] = useState(false);
  const [ansicht, setAnsicht] = useState(null);
  const [jetzt, setJetzt] = useState(() => Date.now());

  /* Sitzung beobachten. supabase-js stellt sie aus dem Gerätespeicher
     wieder her, deshalb bleibt man über das Schließen hinaus angemeldet. */
  const online = useOnline();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSitzung(data.session ?? null));
    const { data: abo } = supabase.auth.onAuthStateChange((_e, s) => setSitzung(s ?? null));
    return () => abo.subscription.unsubscribe();
  }, []);

  const neuLaden = useCallback(async () => {
    setLadefehler("");
    try {
      const { daten: d, ausCache: c, stand: st } = await ladenMitCache();
      setDaten(d); setAusCache(c); setStand(st);
    } catch (e) { setLadefehler(e.message || String(e)); }
  }, []);

  /* Gemerkte Vorgaenge nachreichen, sobald wieder Netz da ist. */
  const nachreichen = useCallback(async () => {
    if (schlangeLesen().length === 0) return;
    const { gesendet, verworfen } = await schlangeAbarbeiten(vorgangAusfuehren);
    setOffen(schlangeLesen().length);
    if (verworfen.length) setVerworfen(verworfen);
    if (gesendet > 0) {
      const { daten: d, ausCache: c, stand: st } = await ladenMitCache();
      setDaten(d); setAusCache(c); setStand(st);
    }
  }, []);

  /* Sobald wieder Netz da ist, gemerkte Vorgaenge nachreichen. Steht
     bewusst HINTER der Definition: als const ist nachreichen vorher
     noch nicht ansprechbar, und die Abhaengigkeitsliste wird schon
     beim Rendern ausgewertet — die App startete dann gar nicht. */
  useEffect(() => { if (online) nachreichen().catch(() => {}); }, [online, nachreichen]);

  useEffect(() => {
    if (!sitzung) { setDaten(null); return; }
    neuLaden();
  }, [sitzung, neuLaden]);

  /* Tickt nur, solange eine Stempelung läuft. */
  useEffect(() => {
    if (!daten?.laufend) return;
    const i = setInterval(() => setJetzt(Date.now()), 1000);
    return () => clearInterval(i);
  }, [daten?.laufend]);

  const abmelden = async () => {
    await supabase.auth.signOut();
    setTab("heute"); setDetail(null); setErf(null);
  };

  /* ── Zustände vor der eigentlichen App ── */
  if (sitzung === undefined) {
    return <div className="wr-root"><style>{STIL}</style>
      <div className="wr-phone"><div className="wr-mitte">Einen Moment …</div></div></div>;
  }
  if (!sitzung) {
    return <div className="wr-root"><style>{STIL}</style>
      <div className="wr-phone"><Login /></div></div>;
  }
  if (ladefehler) {
    return <div className="wr-root"><style>{STIL}</style>
      <div className="wr-phone"><div className="wr-mitte">
        <AlertTriangle size={24} color={C.rot} />
        <p style={{ margin:"12px 0 0", fontSize:14, lineHeight:1.5 }}>{ladefehler}</p>
        <button className="wr-order" style={{ width:"100%", margin:"16px 0 0" }}
          onClick={neuLaden}>Nochmal versuchen</button>
        <button className="wr-order" style={{ width:"100%" }} onClick={abmelden}>Abmelden</button>
      </div></div></div>;
  }
  if (!daten) {
    return <div className="wr-root"><style>{STIL}</style>
      <div className="wr-phone"><div className="wr-mitte">Daten werden geladen …</div></div></div>;
  }

  const D = baueDaten(daten);
  const u = D.M(daten.meinProfil);

  /* ── Schreiben: erst zum Server, dann neu laden ── */
  /* Jeder Schreibweg bekommt seine Nummern VOR dem Senden. Klappt es
     nicht am Netz, wandert der Vorgang mit genau diesen Nummern in die
     Warteschlange — ein zweiter Versuch erzeugt dann kein Doppel. */
  const merken = async (art, n, tun) => {
    const { gesendet } = await schreibenOderMerken(art, n, tun);
    setOffen(schlangeLesen().length);
    if (gesendet) await neuLaden();
    return gesendet;
  };

  const senden = async (bId, korb, wann, dringend) => {
    const ids = korb.map(() => crypto.randomUUID());
    const n = { betriebId: daten.betriebId, bId, korb, wann, dringend, profil: daten.meinProfil, ids };
    await merken("anforderung", n, () =>
      anforderungSenden(n.betriebId, bId, korb, wann, dringend, n.profil, ids));
  };

  const zeileSpeichern = async (posId, ort, ansatz, menge) => {
    const id = crypto.randomUUID();
    const n = { betriebId: daten.betriebId, posId, ort, ansatz, menge, profil: daten.meinProfil, id };
    await merken("aufmass", n, () =>
      aufmassSpeichern(n.betriebId, posId, ort, ansatz, menge, n.profil, id));
    return id;
  };
  const bestellenBei = async (ids) => {
    await bestellen(ids, "Di 18.08.");
    await neuLaden();
  };

  /* Ein- und Ausstempeln über denselben Knopf: läuft eine Stempelung,
     wird sie beendet, sonst eine neue begonnen. */
  const stempeln = async (baustelleId) => {
    if (daten.laufend) {
      /* Der Zeitpunkt zaehlt jetzt, nicht beim Nachreichen — sonst
         verschenkt der Monteur die Zeit im Funkloch. */
      const bis = new Date().toISOString();
      await merken("ausstempeln", { zeitId: daten.laufend.id, bis },
        () => ausstempeln(daten.laufend.id, bis));
    } else {
      const id = crypto.randomUUID(), von = new Date().toISOString();
      const n = { betriebId: daten.betriebId, bId: baustelleId, profil: daten.meinProfil, id, von };
      await merken("einstempeln", n, () =>
        einstempeln(n.betriebId, baustelleId, n.profil, id, von));
    }
  };

  const berichtSchreiben = async (baustelleId, text) => {
    const id = crypto.randomUUID();
    const n = { betriebId: daten.betriebId, bId: baustelleId, text, profil: daten.meinProfil, id };
    await merken("bericht", n, () =>
      berichtSpeichern(n.betriebId, baustelleId, text, n.profil, id));
    return id;
  };

  const zeileKorrigieren = async (id, felder) => { await zeileAendern(id, felder); await neuLaden(); };
  const zeileWeg = async (id) => { await zeileLoeschen(id); await neuLaden(); };

  const blattSichern = async (baustelleId, name, blob) => {
    const datei = new File([blob], "unterschrift.png", { type: "image/png" });
    const pfad = await fotoHochladen(datei, {
      betriebId: daten.betriebId, baustelleId, meinProfil: daten.meinProfil,
    });
    await blattSpeichern(daten.betriebId, baustelleId, name, pfad, daten.meinProfil);
    await neuLaden();
  };

  /* Stammdaten: nach jedem Schreiben neu laden, damit die Listen und
     alle anderen Bildschirme sofort stimmen. */
  const nachher = (fn) => async (...a) => { const r = await fn(...a); await neuLaden(); return r; };
  const stammOps = {
    baustelle:   nachher((f) => baustelleSpeichern(daten.betriebId, f)),
    crew:        nachher((bId, ids) => crewSetzen(daten.betriebId, bId, ids)),
    artikel:     nachher((f) => artikelSpeichern(daten.betriebId, f)),
    position:    nachher((bId, f) => positionSpeichern(daten.betriebId, bId, f)),
    mitarbeiter: nachher((f) => mitarbeiterSpeichern(daten.betriebId, f)),
  };

  const fotoZu = async (baustelleId, zeileId, datei, berichtId) => {
    await fotoHochladen(datei, {
      betriebId: daten.betriebId, baustelleId,
      zeileId: zeileId ?? null, berichtId: berichtId ?? null,
      meinProfil: daten.meinProfil,
    });
    await neuLaden();
  };

  const nav = [
    { k:"heute", l:"Heute", I:Home }, { k:"bau", l:"Baustellen", I:HardHat },
    { k:"erf", l:"Erfassen", I:Plus }, { k:"mat", l:"Material", I:Package },
    { k:"mehr", l:"Mehr", I:MoreHorizontal },
  ];

  return (
    <div className="wr-root">
      <style>{STIL}</style>

      <div className="wr-phone">
       <DatenZ.Provider value={D}>
       <HinweisRahmen>
        {(!online || ausCache || offen > 0) && (
          <div className={`wr-netz${online ? " wr-netz-warte" : ""}`} role="status">
            {online
              ? <><Loader size={14} className="wr-dreht" />
                  <span>{offen} Eintrag{offen === 1 ? "" : "e"} wird nachgereicht …</span></>
              : <><WifiOff size={14} />
                  <span>
                    Kein Netz — Stand {vorWie(stand)}
                    {offen > 0 ? ` · ${offen} gemerkt` : ""}
                  </span></>}
          </div>
        )}

        {verworfen.length > 0 && (
          <div className="wr-netz wr-netz-rot" role="alert">
            <AlertTriangle size={14} />
            <span>{verworfen.length} Eintrag konnte nicht gesendet werden: {verworfen[0].grund}</span>
            <button className="wr-update-x" onClick={() => setVerworfen([])}>OK</button>
          </div>
        )}

        {tab === "heute" && <Heute u={u} anf={daten.anf} laufend={daten.laufend} stempeln={stempeln}
          kannZeit={daten.koennen.zeit}
          sek={daten.laufend ? Math.max(0, Math.floor((jetzt - new Date(daten.laufend.von).getTime()) / 1000)) : 0}
          go={(id) => { setDetail(id); setTab("bau"); }} toMat={() => setTab("mat")} />}

        {tab === "bau" && (detail
          ? <Detail u={u} id={detail} back={() => setDetail(null)} zeilen={daten.ZEILEN} anf={daten.anf} />
          : <Baustellen u={u} go={(id) => setDetail(id)} />)}

        {tab === "erf" && (
          erf === null ? <Erfassen u={u} pick={setErf} />
          : erf === "bericht" ? <Bericht u={u} back={() => setErf(null)} speichern={berichtSchreiben} fotoZu={fotoZu} />
          : erf === "aufmass" ? <Aufmass u={u} zeilen={daten.ZEILEN} speichern={zeileSpeichern} fotoZu={fotoZu} blattSichern={blattSichern}
              aendern={zeileKorrigieren} loeschen={zeileWeg} back={() => setErf(null)} />
          : <Anfordern u={u} back={() => setErf(null)} senden={senden} />
        )}

        {tab === "mat" && <Material u={u} anf={daten.anf} bestellenBei={bestellenBei}
          toAnf={() => { setTab("erf"); setErf("anford"); }} />}

        {tab === "mehr" && (
          stamm ? <Stammdaten zurueck={() => setStamm(false)} ops={stammOps} darf={rechte(u)} />
          : ansicht === "stunden"  ? <Stunden  u={u} zurueck={() => setAnsicht(null)} />
          : ansicht === "berichte" ? <Berichte zurueck={() => setAnsicht(null)} />
          : ansicht === "fotos"    ? <Fotos    zurueck={() => setAnsicht(null)} />
          : <Mehr u={u} abmelden={abmelden} betrieb={daten.betrieb} neuLaden={neuLaden}
              stamm={() => setStamm(true)} zeige={setAnsicht} />)}

        <Aktualisierung />

        <nav className="wr-nav">
          {nav.map(({ k, l, I }) => (
            <button key={k} className={tab === k ? "on" : ""}
              onClick={() => {
                /* Nochmal auf den schon aktiven Reiter tippen führt zurück
                   an dessen Anfang — sonst sitzt man in einem
                   Unterbildschirm fest und der Knopf scheint tot. */
                if (tab === k) { setDetail(null); setErf(null); }
                setTab(k);
                if (k !== "bau") setDetail(null);
                if (k !== "erf") setErf(null);
              }}>
              <I size={20} strokeWidth={tab === k ? 2.3 : 1.8} />
              <span>{l}</span>
            </button>
          ))}
        </nav>
       </HinweisRahmen>
       </DatenZ.Provider>
      </div>
    </div>
  );
}

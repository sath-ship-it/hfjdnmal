import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, AlertTriangle, Check } from "lucide-react";
import { useDaten } from "./datenZ.js";

/* ─────────────────────────────────────────────────────────────
   Stammdaten anlegen und ändern.

   Bis hierher konnte die App nur mit dem arbeiten, was einmal in die
   Datenbank geschrieben wurde. Eine neue Baustelle, ein neuer Artikel,
   eine zusätzliche LV-Position — nichts davon ging aus der App heraus.

   Nur für die Leitung: Die Rechteregeln in der Datenbank lassen
   Schreibzugriff auf Stammdaten ausschließlich für sie zu. Die
   Oberfläche zeigt sie deshalb auch nur ihr.
   ───────────────────────────────────────────────────────────── */

const PHASEN = ["Anfrage", "Angebot", "Beauftragt", "In Arbeit", "Abgenommen", "Abgerechnet"];
const EINHEITEN = ["m", "St", "Std", "m²", "kg", "psch"];

function Feld({ label, ...rest }) {
  return (
    <>
      <label className="wr-lbl">{label}</label>
      <input className="wr-inp" {...rest} />
    </>
  );
}

function Auswahl({ label, wert, setzen, werte }) {
  return (
    <>
      <label className="wr-lbl">{label}</label>
      <div className="wr-select">
        <select value={wert} onChange={(e) => setzen(e.target.value)}>
          {werte.map((w) => <option key={w.id ?? w} value={w.id ?? w}>{w.name ?? w}</option>)}
        </select>
      </div>
    </>
  );
}

/* Gemeinsamer Rahmen: Liste, Formular, Speichern-Knopf, Fehler. */
function Maske({ titel, unter, zurueck, eintraege, zeile, formular, speichern, gueltig, leeren }) {
  const [offen, setOffen] = useState(false);
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState("");

  const ab = async () => {
    if (!gueltig || sendet) return;
    setSendet(true); setFehler("");
    try { await speichern(); leeren(); setOffen(false); }
    catch (e) { setFehler(e.message || "Speichern fehlgeschlagen."); }
    finally { setSendet(false); }
  };

  return (
    <div className="wr-scroll">
      <div className="wr-sheethead">
        <button className="wr-back2" onClick={zurueck}><ChevronLeft size={18} /> Stammdaten</button>
        <h1 className="wr-hero-h" style={{ marginTop:14 }}>{titel}</h1>
        <p className="wr-sub">{unter}</p>
      </div>

      {!offen && (
        <div className="wr-pad">
          <button className="wr-btn-big" style={{ background:"#FFCC00", color:"#14181B" }}
            onClick={() => { leeren(); setOffen(true); }}>
            <Plus size={17} /> Neu anlegen
          </button>
        </div>
      )}

      {offen && (
        <div className="wr-pad">
          {formular}
          {fehler && <div className="wr-fehler" role="alert"><AlertTriangle size={15} /> {fehler}</div>}
          <div className="wr-two" style={{ marginTop:14 }}>
            <button className="wr-order" style={{ margin:0 }} onClick={() => setOffen(false)}>Abbrechen</button>
            <button className="wr-btn-big" disabled={!gueltig || sendet}
              style={{ background: gueltig && !sendet ? "#FFCC00" : "#E4E9E8",
                       color: gueltig && !sendet ? "#14181B" : "#5F6C73", padding:"12px" }}
              onClick={ab}>
              {sendet ? "Speichert …" : "Speichern"}
            </button>
          </div>
        </div>
      )}

      <div className="wr-eyebrow"><span>Vorhanden</span><span className="wr-eyebrow-r">{eintraege.length}</span></div>
      {eintraege.map(zeile)}
      {eintraege.length === 0 && <div className="wr-empty">Noch nichts angelegt.</div>}
      <div style={{ height:24 }} />
    </div>
  );
}

/* ── Baustellen ── */
function Baustellen({ zurueck, speichern, crewSetzen }) {
  const { B, team } = useDaten();
  const leer = { nr:"", name:"", adr:"", phase:"Beauftragt", abrechnung:"Einheitspreise",
                 kunde:"", ap:"", telefon:"", crew:[] };
  const [f, setF] = useState(leer);
  const s = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <Maske titel="Baustellen" unter="Neue Baustelle anlegen. Zugeteilte Monteure sehen sie sofort."
      zurueck={zurueck} eintraege={B} leeren={() => setF(leer)}
      gueltig={!!f.nr.trim() && !!f.name.trim()}
      speichern={async () => {
        const id = await speichern(f);
        if (f.crew.length) await crewSetzen(id, f.crew);
      }}
      zeile={(b) => (
        <div key={b.id} className="wr-task">
          <div style={{ flex:1, minWidth:0 }}>
            <div className="wr-task-t">{b.name}</div>
            <div className="wr-task-s">{b.nr} · {b.phase} · {b.abrechnung}</div>
          </div>
        </div>
      )}
      formular={<>
        <Feld label="Nummer" value={f.nr} onChange={s("nr")} placeholder="P260026" />
        <Feld label="Name" value={f.name} onChange={s("name")} placeholder="EFH Musterweg 3" />
        <Feld label="Adresse" value={f.adr} onChange={s("adr")} placeholder="Straße, PLZ Ort" />
        <Auswahl label="Phase" wert={f.phase} setzen={(v) => setF({ ...f, phase:v })} werte={PHASEN} />
        <Auswahl label="Abrechnung" wert={f.abrechnung} setzen={(v) => setF({ ...f, abrechnung:v })}
          werte={["Einheitspreise", "Pauschal"]} />
        <Feld label="Kunde" value={f.kunde} onChange={s("kunde")} placeholder="Firma oder Name" />
        <Feld label="Ansprechpartner" value={f.ap} onChange={s("ap")} />
        <Feld label="Telefon" value={f.telefon} onChange={s("telefon")} type="tel" placeholder="+49 …" />
        <label className="wr-lbl">Wer wird zugeteilt</label>
        {team.map((m) => {
          const drin = f.crew.includes(m.id);
          return (
            <button key={m.id} className="wr-toggle" style={{ marginTop:6 }}
              onClick={() => setF({ ...f, crew: drin ? f.crew.filter((x) => x !== m.id) : [...f.crew, m.id] })}>
              <span className="wr-av">{m.kurz}</span>
              <span style={{ flex:1, textAlign:"left" }}>{m.name}<br />
                <span className="wr-task-s">{m.zugang}</span></span>
              <span className="wr-box" style={drin ? { background:"#14181B", borderColor:"#14181B" } : {}}>
                {drin && <Check size={12} color="#fff" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
        <p className="wr-hint">
          Ohne Zuteilung sieht die Baustelle nur die Leitung — die Rechteregel
          schickt sie anderen gar nicht erst.
        </p>
      </>} />
  );
}

/* ── Artikel ── */
function Artikel({ zurueck, speichern }) {
  const { ARTIKEL } = useDaten();
  const leer = { txt:"", eh:"St", lief:"" };
  const [f, setF] = useState(leer);
  return (
    <Maske titel="Artikelstamm" unter="Was angefordert werden kann."
      zurueck={zurueck} eintraege={ARTIKEL} leeren={() => setF(leer)}
      gueltig={!!f.txt.trim()} speichern={() => speichern(f)}
      zeile={(a) => (
        <div key={a.id} className="wr-task">
          <div style={{ flex:1, minWidth:0 }}>
            <div className="wr-task-t">{a.txt}</div>
            <div className="wr-task-s">{a.lief} · {a.eh}</div>
          </div>
        </div>
      )}
      formular={<>
        <Feld label="Bezeichnung" value={f.txt} onChange={(e) => setF({ ...f, txt:e.target.value })}
          placeholder="NYM-J 5x2,5" />
        <Auswahl label="Einheit" wert={f.eh} setzen={(v) => setF({ ...f, eh:v })} werte={EINHEITEN} />
        <Feld label="Lieferant" value={f.lief} onChange={(e) => setF({ ...f, lief:e.target.value })}
          placeholder="Sonepar" />
      </>} />
  );
}

/* ── LV-Positionen ── */
function Positionen({ zurueck, speichern }) {
  const { B, POS } = useDaten();
  const mitLV = B.filter((b) => b.abrechnung === "Einheitspreise");
  const [bs, setBs] = useState(mitLV[0]?.id ?? "");
  const leer = { nr:"", txt:"", eh:"m", lv:"" };
  const [f, setF] = useState(leer);
  const meine = POS.filter((p) => p.bId === bs);

  return (
    <Maske titel="Leistungsverzeichnis" unter="Positionen, gegen die aufgemessen wird."
      zurueck={zurueck} eintraege={meine} leeren={() => setF(leer)}
      gueltig={!!f.nr.trim() && !!f.txt.trim() && !!bs}
      speichern={() => speichern(bs, f)}
      zeile={(p) => (
        <div key={p.id} className="wr-task">
          <span className="wr-mono-s" style={{ width:44 }}>{p.nr}</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div className="wr-task-t">{p.txt}</div>
            <div className="wr-task-s">{p.lv} {p.eh} im LV</div>
          </div>
        </div>
      )}
      formular={<>
        <Auswahl label="Baustelle" wert={bs} setzen={setBs} werte={mitLV} />
        <Feld label="Position" value={f.nr} onChange={(e) => setF({ ...f, nr:e.target.value })}
          placeholder="01.30" />
        <Feld label="Bezeichnung" value={f.txt} onChange={(e) => setF({ ...f, txt:e.target.value })}
          placeholder="Kabelrinne 100 mm montieren" />
        <Auswahl label="Einheit" wert={f.eh} setzen={(v) => setF({ ...f, eh:v })} werte={EINHEITEN} />
        <Feld label="Menge laut LV" value={f.lv} onChange={(e) => setF({ ...f, lv:e.target.value })}
          inputMode="decimal" placeholder="180" />
        {mitLV.length === 0 && (
          <p className="wr-hint">
            Keine Baustelle mit Einheitspreisen vorhanden. Pauschalaufträge
            brauchen kein Leistungsverzeichnis.
          </p>
        )}
      </>} />
  );
}

/* ── Mitarbeiter ── */
function Mitarbeiter({ zurueck, speichern }) {
  const { team } = useDaten();
  const leer = { name:"", kurz:"", rolle:"", zugang:"Monteur" };
  const [f, setF] = useState(leer);
  return (
    <Maske titel="Mitarbeiter" unter="Wer im Betrieb ist — ein Zugang kommt getrennt dazu."
      zurueck={zurueck} eintraege={team} leeren={() => setF(leer)}
      gueltig={!!f.name.trim() && !!f.kurz.trim()} speichern={() => speichern(f)}
      zeile={(m) => (
        <div key={m.id} className="wr-task">
          <span className="wr-av">{m.kurz}</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div className="wr-task-t">{m.name}</div>
            <div className="wr-task-s">{m.zugang}{m.rolle ? ` · ${m.rolle}` : ""}</div>
          </div>
        </div>
      )}
      formular={<>
        <Feld label="Name" value={f.name} onChange={(e) => setF({ ...f, name:e.target.value })} />
        <Feld label="Kürzel" value={f.kurz} onChange={(e) => setF({ ...f, kurz:e.target.value })}
          maxLength={3} placeholder="MM" />
        <Feld label="Funktion" value={f.rolle} onChange={(e) => setF({ ...f, rolle:e.target.value })}
          placeholder="TM, ME, HA …" />
        <Auswahl label="Zugang" wert={f.zugang} setzen={(v) => setF({ ...f, zugang:v })}
          werte={["Monteur", "Azubi", "Leitung"]} />
        <p className="wr-hint">
          Legt den Mitarbeiter an, noch ohne Anmeldung. Das Anmeldekonto
          vergibt bisher das Büro in Supabase.
        </p>
      </>} />
  );
}

export default function Stammdaten({ zurueck, ops }) {
  const [was, setWas] = useState(null);
  const { B, ARTIKEL, POS, team } = useDaten();

  if (was === "bau")  return <Baustellen zurueck={() => setWas(null)} speichern={ops.baustelle} crewSetzen={ops.crew} />;
  if (was === "art")  return <Artikel    zurueck={() => setWas(null)} speichern={ops.artikel} />;
  if (was === "lv")   return <Positionen zurueck={() => setWas(null)} speichern={ops.position} />;
  if (was === "team") return <Mitarbeiter zurueck={() => setWas(null)} speichern={ops.mitarbeiter} />;

  const punkte = [
    { k:"bau",  t:"Baustellen",           s:`${B.length} angelegt` },
    { k:"art",  t:"Artikelstamm",         s:`${ARTIKEL.length} Artikel` },
    { k:"lv",   t:"Leistungsverzeichnis", s:`${POS.length} Positionen` },
    { k:"team", t:"Mitarbeiter",          s:`${team.length} im Betrieb` },
  ];

  return (
    <div className="wr-scroll">
      <div className="wr-sheethead">
        <button className="wr-back2" onClick={zurueck}><ChevronLeft size={18} /> Mehr</button>
        <h1 className="wr-hero-h" style={{ marginTop:14 }}>Stammdaten</h1>
        <p className="wr-sub">Anlegen und ändern — nur für die Leitung.</p>
      </div>
      <div className="wr-pad">
        {punkte.map((p) => (
          <button key={p.k} className="wr-bigcard" onClick={() => setWas(p.k)}>
            <div style={{ flex:1, textAlign:"left" }}>
              <div className="wr-bigt">{p.t}</div>
              <div className="wr-task-s">{p.s}</div>
            </div>
            <ChevronRight size={18} color="#5F6C73" />
          </button>
        ))}
      </div>
      <div style={{ height:24 }} />
    </div>
  );
}

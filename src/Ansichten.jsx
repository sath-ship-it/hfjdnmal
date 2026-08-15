import React, { useState, useEffect } from "react";
import { ChevronLeft, Clock, FileText, Camera, AlertTriangle, Trash2, Check } from "lucide-react";
import { useDaten } from "./datenZ.js";
import { fotoAdressen, zeitAendern, zeitLoeschen } from "./daten.js";

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

/* Eine Stempelung berichtigen. Klappt unter dem Eintrag auf, wie die
   Korrektur einer Aufmaß-Zeile — derselbe Griff für dieselbe Sache.

   Bearbeitet werden nur die Uhrzeiten, nicht der Tag: eine Stempelung
   auf einen anderen Tag zu schieben ist keine Korrektur mehr, sondern
   eine Erfindung. Wer den Tag verwechselt hat, entfernt den Eintrag
   und stempelt neu. */
function ZeitKorrektur({ z, fertig }) {
  const tagTeil = z.von.slice(0, 10);
  const hm = (iso) => new Date(iso).toLocaleTimeString("de-DE",
    { hour: "2-digit", minute: "2-digit", hour12: false });

  const [von, setVon] = useState(hm(z.von));
  const [bis, setBis] = useState(z.bis ? hm(z.bis) : "");
  const [fehler, setFehler] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [sicher, setSicher] = useState(false);

  /* "07:30" am selben Tag — die Zeitzone des Geräts ist die richtige,
     dort wurde gestempelt. */
  const zuISO = (t) => t ? new Date(`${tagTeil}T${t}:00`).toISOString() : null;

  const tun = async (was) => {
    if (laeuft) return;
    setLaeuft(true); setFehler("");
    try { await was(); await fertig(); }
    catch (e) { setFehler(e.message || String(e)); }
    finally { setLaeuft(false); }
  };

  return (
    <div className="wr-panel" style={{ margin:"0 14px 6px" }}>
      <div className="wr-two wr-two-gleich">
        <div>
          <label className="wr-lbl" htmlFor={`von-${z.id}`}>Von</label>
          <input id={`von-${z.id}`} className="wr-inp" type="time" value={von}
            onChange={(e) => setVon(e.target.value)} />
        </div>
        <div>
          <label className="wr-lbl" htmlFor={`bis-${z.id}`}>Bis</label>
          <input id={`bis-${z.id}`} className="wr-inp" type="time" value={bis}
            onChange={(e) => setBis(e.target.value)} />
        </div>
      </div>
      {!z.bis && !bis && (
        <p className="wr-hint">Läuft noch. Eine Uhrzeit bei „Bis“ beendet sie.</p>
      )}
      {fehler && <div className="wr-fehler" role="alert"><AlertTriangle size={15} /> {fehler}</div>}

      {!sicher ? (
        <div className="wr-two" style={{ marginTop: 12 }}>
          <button className="wr-order" style={{ margin: 0, color: "var(--rot)" }}
            onClick={() => setSicher(true)}>
            <Trash2 size={15} /> Entfernen
          </button>
          <button className="wr-btn-big" disabled={!von || laeuft}
            style={{ background: von && !laeuft ? "#FFCC00" : "var(--f)",
                     color: von && !laeuft ? "#14181B" : "var(--m)", padding: "12px" }}
            onClick={() => tun(() => zeitAendern(z.id, zuISO(von), zuISO(bis)))}>
            <Check size={15} /> {laeuft ? "Speichert …" : "Übernehmen"}
          </button>
        </div>
      ) : (
        <>
          <p className="wr-hint">Stempelung entfernen? Sie zählt dann nirgends mehr mit.</p>
          <div className="wr-two" style={{ marginTop: 8 }}>
            <button className="wr-order" style={{ margin: 0 }} onClick={() => setSicher(false)}>Abbrechen</button>
            <button className="wr-btn-big" disabled={laeuft}
              style={{ background: "var(--rot)", color: "var(--ai)", padding: "12px" }}
              onClick={() => tun(() => zeitLoeschen(z.id))}>
              {laeuft ? "Entfernt …" : "Ja, entfernen"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Stunden ── */
export function Stunden({ zurueck, u, neuLaden }) {
  const { ZEITEN, B, M } = useDaten();
  /* Wer den ganzen Betrieb sehen darf: die Leitung und die Buchhaltung.
     Fuer die Buchhaltung ist "meine Stunden" allerdings sinnlos — sie
     stempelt nicht ein — deshalb faengt sie beim Betrieb an. */
  const leitung = u.zugang === "Leitung";
  const alleSehen = leitung || u.zugang === "Buchhalter";
  const [wer, setWer] = useState(leitung ? "ich" : alleSehen ? "alle" : "ich");
  const [offen, setOffen] = useState(null);   // Eintrag in Korrektur

  const ab = wochenStart().getTime();
  const dieseWoche = ZEITEN.filter((z) => new Date(z.von).getTime() >= ab
    && (wer === "alle" ? true : z.profil === u.id));

  /* Nach Tag bündeln — so liest ein Chef das auch auf dem Stundenzettel. */
  const proTag = {};
  for (const z of dieseWoche) {
    const t = z.von.slice(0, 10);
    (proTag[t] ??= []).push(z);
  }
  /* Pausen zaehlen nicht als Arbeit — genau dafuer stempelt man sie. */
  const summe = dieseWoche.filter((z) => z.art !== "Pause")
    .reduce((s, z) => s + (z.dauer ?? 0), 0);
  const pause = dieseWoche.filter((z) => z.art === "Pause")
    .reduce((s, z) => s + (z.dauer ?? 0), 0);
  const laufende = dieseWoche.filter((z) => !z.bis).length;

  return (
    <div className="wr-scroll">
      <div className="wr-sheethead">
        {/* Als eigener Reiter gibt es kein "zurueck" — dann auch keinen
            Knopf, der ins Leere fuehrt. */}
        {zurueck && (
          <button className="wr-back2" onClick={zurueck}><ChevronLeft size={18} /> Zurück</button>
        )}
        <h1 className="wr-hero-h" style={{ marginTop:14 }}>Stunden</h1>
        <p className="wr-sub">Diese Woche ab {wochenStart().toLocaleDateString("de-DE")}</p>
      </div>

      {alleSehen && (
        <div className="wr-seg">
          {[["ich","Meine"],["alle","Ganzer Betrieb"]].map(([k, l]) => (
            <button key={k} onClick={() => setWer(k)} className="wr-segb"
              style={wer === k ? { background:"var(--spur-an)", color:"var(--i)", boxShadow:"0 1px 3px rgba(0,0,0,.09)" } : {}}>
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
          {pause > 0 && <span className="wr-pill">{zahl(pause)} h Pause</span>}
          {laufende > 0 && <span className="wr-pill">{laufende} läuft noch</span>}
        </div>
      </div>

      {Object.entries(proTag).sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([tag, liste]) => {
        const tagSumme = liste.filter((z) => z.art !== "Pause")
          .reduce((s, z) => s + (z.dauer ?? 0), 0);
        return (
          <div key={tag}>
            <div className="wr-eyebrow">
              <span>{tagName(tag)}</span>
              <span className="wr-eyebrow-r">{zahl(tagSumme)} h</span>
            </div>
            {liste.map((z) => {
              const b = B.find((x) => x.id === z.bId);
              /* Berichtigen darf, wer es auch in der Datenbank darf:
                 die Leitung alles, alle anderen ihre eigenen Zeiten.
                 Ohne Netz sperren wir es — eine Korrektur wandert
                 nicht in die Warteschlange, sie braucht die Antwort
                 des Servers. */
              const darf = (leitung || z.profil === u.id) && !!neuLaden;
              const auf = offen === z.id;
              return (
                <div key={z.id}>
                  <button className="wr-task" style={{ width:"100%", cursor: darf ? "pointer" : "default" }}
                    onClick={() => darf && setOffen(auf ? null : z.id)}>
                    <div style={{ flex:1, minWidth:0, textAlign:"left" }}>
                      <div className="wr-task-t">
                        {z.art === "Pause" ? "Pause" : (b?.name ?? "Unbekannte Baustelle")}
                      </div>
                      <div className="wr-task-s">
                        {uhr(z.von)} – {z.bis ? uhr(z.bis) : "läuft"}
                        {wer === "alle" ? ` · ${M(z.profil).kurz}` : ""}
                        {darf && (auf ? " · schließen" : " · berichtigen")}
                      </div>
                    </div>
                    <span className="wr-mono-b" style={z.art === "Pause" ? { color:"var(--m)" } : {}}>
                      {z.dauer != null ? `${zahl(z.dauer)} h` : "—"}
                    </span>
                  </button>
                  {auf && <ZeitKorrektur z={z} fertig={async () => { setOffen(null); await neuLaden(); }} />}
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

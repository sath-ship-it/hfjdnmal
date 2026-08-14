import React, { useState } from "react";
import { LogIn, AlertTriangle } from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   Anmeldung — DEMO-BETRIEB.

   Diese Prüfung läuft im Gerät gegen eine Liste im Code. Das ist
   KEINE Sicherheit: Die Zugangsdaten stehen im ausgelieferten
   JavaScript und sind für jeden lesbar, der hineinschaut.

   Sie ersetzt vorerst den Rollen-Umschalter, damit sich die App beim
   Vorführen wie eine echte anfühlt. Sobald die Datenbank steht,
   antwortet hier supabase.auth.signInWithPassword() — der Bildschirm
   bleibt, nur die Prüfung wandert auf den Server.
   ───────────────────────────────────────────────────────────── */

export const DEMO_ZUGAENGE = [
  { uid: "dg", mail: "daniil@waro.de", pw: "waro", was: "Leitung" },
  { uid: "ab", mail: "alin@waro.de",   pw: "waro", was: "Monteur" },
  { uid: "ff", mail: "felix@waro.de",  pw: "waro", was: "Azubi" },
];

export default function Login({ anmelden }) {
  const [mail, setMail] = useState("");
  const [pw, setPw] = useState("");
  const [fehler, setFehler] = useState("");

  const absenden = (e) => {
    e?.preventDefault();
    const treffer = DEMO_ZUGAENGE.find(
      (z) => z.mail.toLowerCase() === mail.trim().toLowerCase() && z.pw === pw
    );
    if (!treffer) {
      setFehler("E-Mail oder Passwort stimmt nicht.");
      return;
    }
    setFehler("");
    anmelden(treffer.uid);
  };

  const schnell = (z) => { setMail(z.mail); setPw(z.pw); setFehler(""); };

  return (
    <div className="wr-scroll wr-anmelde">
      <div className="wr-anmelde-kopf">
        <span className="wr-marke">W</span>
        <h1 className="wr-hero-h" style={{ marginTop: 16 }}>WARO</h1>
        <p className="wr-sub">Material &amp; Aufmaß für die Baustelle</p>
      </div>

      <form className="wr-pad" onSubmit={absenden}>
        <label className="wr-lbl" htmlFor="mail">E-Mail</label>
        <input id="mail" className="wr-inp" type="email" inputMode="email"
          autoComplete="username" value={mail}
          onChange={(e) => setMail(e.target.value)} placeholder="name@betrieb.de" />

        <label className="wr-lbl" htmlFor="pw">Passwort</label>
        <input id="pw" className="wr-inp" type="password"
          autoComplete="current-password" value={pw}
          onChange={(e) => setPw(e.target.value)} placeholder="••••••" />

        {fehler && (
          <div className="wr-fehler" role="alert">
            <AlertTriangle size={15} /> {fehler}
          </div>
        )}

        <button className="wr-btn-big" type="submit"
          style={{ background: "#FFCC00", color: "#14181B", marginTop: 18 }}>
          <LogIn size={17} /> Anmelden
        </button>
      </form>

      <div className="wr-eyebrow" style={{ paddingBottom: 4 }}>
        <span>Demo-Zugänge — tippen zum Ausfüllen</span>
      </div>
      <div className="wr-pad" style={{ paddingTop: 0 }}>
        {DEMO_ZUGAENGE.map((z) => (
          <button key={z.uid} type="button" className="wr-hit"
            onClick={() => schnell(z)}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="wr-task-t">{z.mail}</div>
              <div className="wr-task-s">{z.was} · Passwort: {z.pw}</div>
            </div>
          </button>
        ))}

        <div className="wr-locked" style={{ margin: "14px 0 0" }}>
          <AlertTriangle size={13} />
          <span>
            Demo-Anmeldung: Die Prüfung läuft im Gerät, die Zugangsdaten stehen
            im Programmtext. Kein Schutz für echte Daten — das übernimmt später
            der Server.
          </span>
        </div>
      </div>
      <div style={{ height: 24 }} />
    </div>
  );
}

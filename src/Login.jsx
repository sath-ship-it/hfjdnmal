import React, { useState } from "react";
import { LogIn, AlertTriangle, Loader } from "lucide-react";
import { supabase } from "./supabase.js";

/* Anmeldung gegen Supabase. Die Prüfung läuft auf dem Server, und mit ihr
   hängen die Rechteregeln zusammen: Was jemand sehen darf, entscheidet
   ab hier die Datenbank, nicht die Oberfläche. */

/* Supabase meldet Fehler auf Englisch und knapp. Für jemanden auf einer
   Baustelle ist "Invalid login credentials" keine brauchbare Auskunft. */
const verstaendlich = (fehler) => {
  const t = (fehler?.message || "").toLowerCase();
  if (t.includes("invalid login credentials")) return "E-Mail oder Passwort stimmt nicht.";
  if (t.includes("email not confirmed")) return "Das Konto ist noch nicht bestätigt.";
  if (t.includes("rate limit")) return "Zu viele Versuche. Kurz warten.";
  if (t.includes("failed to fetch") || t.includes("network"))
    return "Keine Verbindung. Bist du im Funkloch?";
  return fehler?.message || "Anmeldung fehlgeschlagen.";
};

export default function Login() {
  const [mail, setMail] = useState("");
  const [pw, setPw] = useState("");
  const [fehler, setFehler] = useState("");
  const [laeuft, setLaeuft] = useState(false);

  const absenden = async (e) => {
    e?.preventDefault();
    if (laeuft) return;
    setFehler("");
    setLaeuft(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: mail.trim(),
      password: pw,
    });
    setLaeuft(false);
    /* Bei Erfolg passiert hier nichts weiter: App hört auf die
       Sitzungsänderung und schaltet selbst um. */
    if (error) setFehler(verstaendlich(error));
  };

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
          autoComplete="username" autoCapitalize="none" value={mail}
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

        <button className="wr-btn-big" type="submit" disabled={laeuft}
          style={{ background: laeuft ? "#E4E9E8" : "#FFCC00",
                   color: laeuft ? "#5F6C73" : "#14181B", marginTop: 18 }}>
          {laeuft ? <Loader size={17} className="wr-dreht" /> : <LogIn size={17} />}
          {laeuft ? "Wird geprüft …" : "Anmelden"}
        </button>

        <p className="wr-hint">
          Zugänge vergibt die Leitung. Eine Registrierung gibt es nicht —
          in dieser App stehen Kundendaten.
        </p>
      </form>
      <div style={{ height: 24 }} />
    </div>
  );
}

/* Spielt eine SQL-Datei über die Supabase-Verwaltungsschnittstelle ein.

   Warum nicht über die Datenbank direkt: Supabase löst den Datenbank-
   Host nur über IPv6 auf, und nicht jede Umgebung hat das. Über HTTPS
   geht es überall. Warum nicht mit dem service_role-Schlüssel: der
   läuft über PostgREST und kann kein ALTER TABLE.

   Aufruf:
     SUPABASE_PAT=sbp_… SB_REF=abcdef node tools/nachtrag.mjs <datei…>

   Mehrere Dateien werden der Reihe nach eingespielt und beim ersten
   Fehler abgebrochen — ein halb eingespielter Stapel ist schlimmer als
   ein gar nicht eingespielter.                                        */
import { readFileSync } from "node:fs";

const PAT = process.env.SUPABASE_PAT;
const REF = process.env.SB_REF;
if (!PAT || !REF) {
  console.error("SUPABASE_PAT und SB_REF müssen gesetzt sein.");
  process.exit(2);
}
const dateien = process.argv.slice(2);
if (dateien.length === 0) {
  console.error("Keine Datei angegeben.");
  process.exit(2);
}

export async function sqlAusfuehren(sql) {
  const antwort = await fetch(
    `https://api.supabase.com/v1/projects/${REF}/database/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    }
  );
  const roh = await antwort.text();
  let inhalt;
  try { inhalt = JSON.parse(roh); } catch { inhalt = roh; }
  if (!antwort.ok) {
    const grund = inhalt?.message ?? inhalt?.error ?? roh;
    throw new Error(`${antwort.status} ${grund}`);
  }
  return inhalt;
}

for (const datei of dateien) {
  process.stdout.write(`\n── ${datei} `.padEnd(64, "─") + "\n");
  const sql = readFileSync(datei, "utf8");
  try {
    const zeilen = await sqlAusfuehren(sql);
    if (Array.isArray(zeilen) && zeilen.length) {
      /* Die letzte Abfrage der Datei ist meist die Gegenprobe. */
      console.table(zeilen.slice(0, 20));
      if (zeilen.length > 20) console.log(`… und ${zeilen.length - 20} weitere Zeilen`);
    } else {
      console.log("ok — keine Rückgabe");
    }
  } catch (e) {
    console.error("GESCHEITERT:", e.message);
    process.exit(1);
  }
}
console.log("\nAlle Nachträge eingespielt.");

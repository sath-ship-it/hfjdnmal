/* Trennung nach Konto — ohne Browser pruefbar, deshalb schnell.

   Anlass: Stand und Warteschlange lagen unter einem festen Schluessel
   im Geraet, und das Abmelden loeschte nichts. Auf einem geteilten
   Baustellentelefon hiess das: Buchhaltung meldet sich ab, Monteur
   meldet sich an, geraet in ein Funkloch — und sieht den gesicherten
   Stand der Buchhaltung samt Preisen und Kundennamen. Also genau das,
   was die Rechteregeln in der Datenbank verhindern sollen, nur am
   Server vorbei.

   Aufruf: node tools/kontotrennung.mjs                                */
const speicher = new Map();
globalThis.localStorage = {
  getItem: (k) => speicher.has(k) ? speicher.get(k) : null,
  setItem: (k, v) => speicher.set(k, String(v)),
  removeItem: (k) => speicher.delete(k),
};
globalThis.crypto ??= (await import("node:crypto")).webcrypto;

const o = await import("../src/offline.js");
let schlecht = 0;
const pr = (n, ist, soll) => (ist !== soll && schlecht++, console.log(`${ist === soll ? "ok  " : "FEHL"} ${n}: ${JSON.stringify(ist)}${ist===soll?"":" (erwartet "+JSON.stringify(soll)+")"}`));

o.standSichern({ preise: "geheim" }, "buchhalter-1");
pr("eigener Stand kommt zurueck", o.standLesen("buchhalter-1")?.daten?.preise, "geheim");
pr("fremder Stand bleibt verborgen", o.standLesen("monteur-2"), null);
pr("ohne Konto kein Stand", o.standLesen(null), null);

o.standLoeschen();
pr("nach Abmelden geloescht", o.standLesen("buchhalter-1"), null);

o.einreihen("aufmass", { a: 1 }, "monteur-2");
o.einreihen("bericht", { b: 2 }, "buchhalter-1");
pr("meine Eintraege gezaehlt", o.schlangeMeine("monteur-2").length, 1);
pr("fremde nicht mitgezaehlt", o.schlangeMeine("chef-3").length, 0);

const getan = [];
const r = await o.schlangeAbarbeiten(async (art) => { getan.push(art); }, "monteur-2");
pr("nur eigene gesendet", r.gesendet, 1);
pr("und zwar die richtige", getan.join(","), "aufmass");
pr("fremder Eintrag liegt noch da", o.schlangeMeine("buchhalter-1").length, 1);

if (schlecht) { console.error(`${schlecht} Pruefung(en) gescheitert.`); process.exit(1); }
console.log("Kontotrennung in Ordnung.");

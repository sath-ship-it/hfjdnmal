import { supabase } from "./supabase.js";
import { standSichern, standLesen, einreihen, istNetzfehler, schlangeLesen } from "./offline.js";

/* ─────────────────────────────────────────────────────────────
   Datenschicht.

   Die Bildschirme erwarten die Formen aus dem Prototyp (crew als
   Liste von Kürzeln, Datum als "03.08." und so weiter). Statt jeden
   Bildschirm umzubauen, übersetzt diese Schicht die Datenbankzeilen
   in genau diese Formen. Der Umbau bleibt damit an einer Stelle.

   Was NICHT gefiltert wird: nichts. Row Level Security entscheidet
   serverseitig, welche Zeilen überhaupt ankommen — ein Monteur
   bekommt fremde Baustellen gar nicht erst geschickt.
   ───────────────────────────────────────────────────────────── */

/* "2026-08-03" -> "03.08." · null -> "offen" */
const tag = (iso) => {
  if (!iso) return "offen";
  const [, m, d] = iso.split("-");
  return `${d}.${m}.`;
};

export async function ladeAlles() {
  /* Wer bin ich? mein_profil() liest das Profil zur Anmeldung. */
  const { data: meinProfil, error: eProfil } = await supabase.rpc("mein_profil");
  if (eProfil) throw eProfil;
  if (!meinProfil) {
    throw new Error(
      "Zu dieser Anmeldung gehört kein Mitarbeiter. Die Leitung muss den Zugang zuordnen."
    );
  }

  /* PostgREST liefert nie unbegrenzt viele Zeilen: je nach Einstellung
     des Projekts schneidet es ab einer Obergrenze ab — und zwar OHNE
     Fehler. Eine Abfrage ohne Bereich sieht dann vollständig aus und
     ist es nicht. Bei Aufmaß-Zeilen wären die Summen in der Abrechnung
     stillschweigend zu klein, und das merkt man erst an einer falschen
     Rechnung.

     Deshalb holen wir in Blöcken und hören erst auf, wenn ein Block
     kürzer zurückkommt als angefordert. Die Sortierung muss dabei
     eindeutig sein, sonst kann eine Zeile zwischen zwei Blöcken
     durchrutschen oder doppelt kommen. */
  const BLOCK = 1000;

  const seitenweise = async (tabelle, spalten, sortier) => {
    const alles = [];
    for (let von = 0; ; von += BLOCK) {
      let f = supabase.from(tabelle).select(spalten);
      for (const s of sortier) f = f.order(s);
      const { data, error } = await f.range(von, von + BLOCK - 1);
      if (error) return { fehler: error };
      alles.push(...(data ?? []));
      if ((data?.length ?? 0) < BLOCK) return { daten: alles };
      /* Reissleine gegen eine Sortierung, die doch nicht eindeutig ist:
         lieber abbrechen als ewig im Kreis laden. */
      if (alles.length > 200000) {
        console.warn(`${tabelle}: mehr als 200000 Zeilen — abgebrochen.`);
        return { daten: alles };
      }
    }
  };

  /* Spalten aus spaeteren Nachtraegen. Dieselbe Falle wie bei den
     Tabellen, nur eine Ebene tiefer: steht eine Spalte in der Abfrage,
     die es noch nicht gibt, antwortet PostgREST mit 42703 und die
     GANZE App bleibt stehen — auch alles, was mit dieser Spalte nichts
     zu tun hat. Deshalb wird sie einzeln nachgefragt und fehlt sie,
     laeuft der Rest ohne sie weiter. */
  const fehlendeSpalte = (f) =>
    f?.code === "42703" || /column .* does not exist/i.test(f?.message || "");

  const ohneSpalte = new Set();

  const hole = async (tabelle, spalten = "*", sortier = ["id"], nachtrag = []) => {
    const mitAllem = [spalten, ...nachtrag].filter(Boolean).join(",");
    let { daten, fehler } = await seitenweise(tabelle, mitAllem, sortier);
    if (fehler && nachtrag.length && fehlendeSpalte(fehler)) {
      console.warn(`${tabelle}: Spalte ${nachtrag.join(", ")} fehlt — Funktion ist aus.`);
      nachtrag.forEach((s) => ohneSpalte.add(`${tabelle}.${s}`));
      ({ daten, fehler } = await seitenweise(tabelle, spalten, sortier));
    }
    if (fehler) throw new Error(`${tabelle}: ${fehler.message}`);
    return daten;
  };

  /* Für Tabellen aus späteren Nachträgen. Fehlt eine, fällt nur ihre
     Funktion aus — nicht die ganze App. Vorher legte eine fehlende
     Nebentabelle alles lahm, und der Monteur kam nicht mal an seine
     Baustellen. */
  const holeWennDa = async (tabelle, spalten = "*", sortier = ["id"]) => {
    const { daten, fehler } = await seitenweise(tabelle, spalten, sortier);
    if (fehler) {
      if (fehler.code === "PGRST205" || /schema cache/i.test(fehler.message || "")) {
        console.warn(`Tabelle "${tabelle}" fehlt — zugehörige Funktion ist aus.`);
        return null;
      }
      throw new Error(`${tabelle}: ${fehler.message}`);
    }
    return daten;
  };

  const [betriebe, profile, baustellen, kaufm, crew, artikel, anforderungen, positionen, zeilen, zeiten, fotos, berichte, lvPreise, artPreise] =
    await Promise.all([
      hole("betrieb", "id,name"),
      hole("profil", "id,name,kurz,rolle,zugang"),
      hole("baustelle"),
      hole("baustelle_kaufmaennisch", "baustelle_id,kunde,ap,telefon", ["baustelle_id"]),
      /* Kein id-Feld: der Schluessel ist das Paar. */
      hole("baustelle_crew", "baustelle_id,profil_id,heute", ["baustelle_id", "profil_id"]),
      hole("artikel", "id,txt,eh,lief", ["id"], ["ean"]),
      hole("anforderung"),
      hole("lv_position"),
      hole("aufmass_zeile"),
      holeWennDa("zeit", "id,profil_id,baustelle_id,von,bis,geloescht_am"),
      holeWennDa("foto", "id,zeile_id,bericht_id,baustelle_id,pfad,erstellt_am"),
      holeWennDa("tagesbericht", "id,baustelle_id,profil_id,datum,text"),
      holeWennDa("lv_preis", "position_id,ep", ["position_id"]),
      holeWennDa("artikel_preis", "artikel_id,ek,vk", ["artikel_id"]),
    ]);

  /* Kaufmännisches kommt nur bei der Leitung an — beim Monteur ist die
     Liste leer, und dann bleiben Kunde und Ansprechpartner eben leer.
     Genau so soll es sein. */
  const kaufmNach = Object.fromEntries(kaufm.map((k) => [k.baustelle_id, k]));

  const team = profile.map((p) => ({
    id: p.id, name: p.name, kurz: p.kurz, rolle: p.rolle ?? "", zugang: p.zugang,
  }));

  const B = baustellen
    .filter((b) => !b.geloescht_am)
    .map((b) => ({
      id: b.id,
      name: b.name,
      nr: b.nr,
      phase: b.phase,
      ruht: b.ruht,
      adr: b.adr ?? "",
      kunde: kaufmNach[b.id]?.kunde ?? "",
      ap: kaufmNach[b.id]?.ap ?? "",
      telefon: kaufmNach[b.id]?.telefon ?? "",
      abrechnung: b.abrechnung,
      von: tag(b.von),
      bis: tag(b.bis),
      crew: crew.filter((c) => c.baustelle_id === b.id).map((c) => c.profil_id),
      heute: crew.filter((c) => c.baustelle_id === b.id && c.heute).map((c) => c.profil_id),
    }));

  /* Preise kommen nur an, wenn die Rolle sie sehen darf — ein Monteur
     bekommt die Zeilen gar nicht erst geschickt. Der Unterschied
     zwischen "keine Preise hinterlegt" und "darf ich nicht sehen" steckt
     deshalb in koennen.preise, nicht in fehlenden Zahlen. */
  const artPreisNach = Object.fromEntries((artPreise ?? []).map((p) => [p.artikel_id, p]));
  const lvPreisNach  = Object.fromEntries((lvPreise ?? []).map((p) => [p.position_id, p]));

  const ARTIKEL = artikel.map((a) => ({
    id: a.id, txt: a.txt, eh: a.eh, lief: a.lief ?? "—", ean: a.ean ?? null,
    ek: artPreisNach[a.id]?.ek != null ? Number(artPreisNach[a.id].ek) : null,
    vk: artPreisNach[a.id]?.vk != null ? Number(artPreisNach[a.id].vk) : null,
  }));

  const anf = anforderungen
    .filter((x) => !x.geloescht_am)
    .map((x) => ({
      id: x.id,
      bId: x.baustelle_id,
      aId: x.artikel_id,
      freitext: x.freitext,
      menge: Number(x.menge),
      von: x.von_profil,
      wann: x.wann ?? "",
      dringend: x.dringend,
      status: x.status,
      lt: x.lt ?? undefined,
    }));

  const POS = positionen
    .filter((p) => !p.geloescht_am)
    .map((p) => ({ id: p.id, bId: p.baustelle_id, nr: p.nr, txt: p.txt, eh: p.eh, lv: Number(p.lv),
                   ep: lvPreisNach[p.id]?.ep != null ? Number(lvPreisNach[p.id].ep) : null }));

  const ZEILEN = zeilen
    .filter((z) => !z.geloescht_am)
    .map((z) => ({
      id: z.id,
      pId: z.position_id,
      ort: z.ort,
      ansatz: z.ansatz,
      menge: Number(z.menge),
      foto: (fotos ?? []).some((f) => f.zeile_id === z.id),
      datum: tag(z.erfasst_am),
    }));

  /* Entfernte Stempelungen bleiben in der Datenbank stehen, damit ein
     Nachreichen aus dem Funkloch sie nicht wiederbelebt. Hier fallen
     sie raus — auch aus "laufend", sonst hinge die Uhr an einem
     Eintrag, den es für den Benutzer nicht mehr gibt. */
  const zeitenDa = (zeiten ?? []).filter((z) => !z.geloescht_am);

  /* Die laufende Stempelung, falls es eine gibt. Der Index in der
     Datenbank stellt sicher, dass es höchstens eine je Person ist. */
  const laufend = zeitenDa.find((z) => !z.bis && z.profil_id === meinProfil) ?? null;

  const ZEITEN = zeitenDa
    .map((z) => ({ id:z.id, profil:z.profil_id, bId:z.baustelle_id, von:z.von, bis:z.bis,
                   dauer: z.bis ? (new Date(z.bis) - new Date(z.von)) / 3600000 : null }))
    .sort((a, b) => new Date(b.von) - new Date(a.von));

  const BERICHTE = (berichte ?? [])
    .map((b) => ({ id:b.id, bId:b.baustelle_id, profil:b.profil_id, datum:b.datum, text:b.text }))
    .sort((a, b) => (a.datum < b.datum ? 1 : -1));

  const FOTOS = (fotos ?? []).map((f) => ({
    id:f.id, zeileId:f.zeile_id, berichtId:f.bericht_id, bId:f.baustelle_id, pfad:f.pfad,
  }));

  const betriebId = betriebe[0]?.id ?? baustellen[0]?.betrieb_id ?? null;
  if (!betriebId) throw new Error("Kein Betrieb sichtbar — Zugang unvollständig.");

    /* Was die Oberfläche ausgrauen muss, weil der Nachtrag fehlt. */
  const koennen = { zeit: zeiten !== null, fotos: fotos !== null, berichte: berichte !== null,
                    preise: lvPreise !== null && lvPreise.length >= 0 && artPreise !== null,
                    /* Ohne Nachtrag 0005 gibt es keinen Strichcode: dann
                       weder Scanner anbieten noch beim Speichern mitschicken. */
                    ean: !ohneSpalte.has("artikel.ean") };

  return { meinProfil, betriebId, betrieb: betriebe[0]?.name ?? "", team, B, ARTIKEL, anf, POS, ZEILEN,
           ZEITEN, BERICHTE, FOTOS, laufend, koennen };
}

/* ── Schreiben ───────────────────────────────────────────────
   Die Schlüssel vergibt das Gerät (crypto.randomUUID), nicht der
   Server: nur so kann später auch im Funkloch etwas angelegt werden. */

export async function anforderungSenden(betriebId, bId, korb, wann, dringend, meinProfil, ids) {
  const zeilen = korb.map((k, i) => ({
    id: ids?.[i] ?? crypto.randomUUID(),
    betrieb_id: betriebId,
    baustelle_id: bId,
    artikel_id: k.aId,
    menge: k.menge,
    von_profil: meinProfil,
    wann,
    dringend,
    status: "Angefordert",
  }));
  const { error } = await supabase.from("anforderung").insert(zeilen);
  if (error && error.code !== "23505") throw new Error(error.message);
  return zeilen.map((z) => z.id);
}

export async function aufmassSpeichern(betriebId, posId, ort, ansatz, menge, meinProfil, vorgabe) {
  const id = vorgabe ?? crypto.randomUUID();
  const { error } = await supabase.from("aufmass_zeile").insert({
    id,
    betrieb_id: betriebId,
    position_id: posId,
    ort,
    ansatz,
    menge,
    erfasst_von: meinProfil,
  });
  /* 23505 heisst: gibt es schon. Beim Nachreichen aus der Warteschlange
     ist das kein Fehler, sondern der Beweis, dass es angekommen war. */
  if (error && error.code !== "23505") throw new Error(error.message);
  return id;
}

export async function bestellen(ids, liefertermin) {
  const { error } = await supabase
    .from("anforderung")
    .update({ status: "Bestellt", lt: liefertermin })
    .in("id", ids);
  if (error) throw new Error(error.message);
}

/* ── Zeiterfassung ───────────────────────────────────────────
   Bisher lief nur ein Zähler in der Oberfläche, der nichts festhielt.
   Bei einem Handwerksbetrieb sind Stunden die Rechnungsgrundlage —
   das gehört auf den Server. */

export async function einstempeln(betriebId, baustelleId, meinProfil, vorgabe, von) {
  const { error } = await supabase.from("zeit").insert({
    id: vorgabe ?? crypto.randomUUID(),
    betrieb_id: betriebId,
    profil_id: meinProfil,
    baustelle_id: baustelleId,
    /* Beim Nachreichen zaehlt der Zeitpunkt des Stempelns, nicht der
       des Uebertragens — sonst verschenkt der Monteur seine Stunden. */
    ...(von ? { von } : {}),
  });
  /* Der Index zeit_eine_laufende verhindert zwei offene Stempelungen —
     etwa wenn jemand Handy und Tablet benutzt. */
  if (error) {
    if (error.code === "23505") throw new Error("Du bist schon eingestempelt.");
    throw new Error(error.message);
  }
}

export async function ausstempeln(zeitId, bis) {
  const { error } = await supabase
    .from("zeit").update({ bis: bis ?? new Date().toISOString() }).eq("id", zeitId);
  if (error) throw new Error(error.message);
}

/* ── Tagesbericht ────────────────────────────────────────────── */
export async function berichtSpeichern(betriebId, baustelleId, text, meinProfil, vorgabe) {
  const id = vorgabe ?? crypto.randomUUID();
  const { error } = await supabase.from("tagesbericht").insert({
    id, betrieb_id: betriebId, baustelle_id: baustelleId,
    profil_id: meinProfil, text,
  });
  if (error && error.code !== "23505") throw new Error(error.message);
  return id;
}

/* ── Fotos ───────────────────────────────────────────────────
   Erst die Datei in den Speicher, dann die Zuordnung in die Tabelle.
   Der erste Ordner ist die Betriebsnummer — daran hängt die
   Rechteregel im Speicher. */
export async function fotoHochladen(datei, { betriebId, baustelleId, zeileId, berichtId, meinProfil }) {
  const endung = (datei.name?.split(".").pop() || "jpg").toLowerCase();
  const pfad = `${betriebId}/${baustelleId ?? "allgemein"}/${crypto.randomUUID()}.${endung}`;

  const { error: eUp } = await supabase.storage
    .from("baustelle").upload(pfad, datei, { contentType: datei.type || "image/jpeg" });
  if (eUp) {
    /* Der haeufigste Fall beim Einrichten: Der Nachtrag 0003, der den
       Ablageort anlegt, wurde noch nicht eingespielt. Das soll nicht als
       "Hochladen fehlgeschlagen" durchgehen. */
    if (/bucket not found|nosuchbucket/i.test(eUp.message || "")) {
      throw new Error("Der Dateispeicher fehlt — Nachtrag 0003 in Supabase einspielen.");
    }
    if (/row-level security|policy/i.test(eUp.message || "")) {
      throw new Error("Keine Berechtigung zum Ablegen — Regeln aus Nachtrag 0003 fehlen.");
    }
    throw new Error("Hochladen fehlgeschlagen: " + eUp.message);
  }

  const { error } = await supabase.from("foto").insert({
    id: crypto.randomUUID(),
    betrieb_id: betriebId,
    baustelle_id: baustelleId ?? null,
    zeile_id: zeileId ?? null,
    bericht_id: berichtId ?? null,
    pfad,
    von_profil: meinProfil,
  });
  if (error) throw new Error(error.message);
  return pfad;
}

/* ── Unterschriebenes Aufmassblatt ───────────────────────────── */
export async function blattSpeichern(betriebId, baustelleId, unterzeichner, unterschriftPfad, meinProfil) {
  const { error } = await supabase.from("aufmassblatt").insert({
    id: crypto.randomUUID(),
    betrieb_id: betriebId, baustelle_id: baustelleId,
    unterzeichner, unterschrift_pfad: unterschriftPfad, erstellt_von: meinProfil,
  });
  if (error) throw new Error(error.message);
}

/* ── Stammdaten pflegen ──────────────────────────────────────
   Bis hierher konnte man mit der App nur arbeiten, was ich als
   Testdaten eingespielt hatte — keine neue Baustelle, kein neuer
   Artikel. Schreiben darf laut Rechteregeln nur die Leitung. */

export async function baustelleSpeichern(betriebId, f, id) {
  const bId = id ?? crypto.randomUUID();
  const satz = {
    id: bId, betrieb_id: betriebId,
    nr: f.nr.trim(), name: f.name.trim(), adr: f.adr?.trim() || null,
    phase: f.phase, ruht: !!f.ruht, abrechnung: f.abrechnung,
    von: f.von || null, bis: f.bis || null,
  };
  const { error } = await supabase.from("baustelle").upsert(satz);
  if (error) {
    if (error.code === "23505") throw new Error(`Nummer „${f.nr}“ gibt es schon.`);
    throw new Error(error.message);
  }
  /* Kundendaten liegen getrennt, damit Monteure sie nicht bekommen. */
  const { error: e2 } = await supabase.from("baustelle_kaufmaennisch").upsert({
    baustelle_id: bId, betrieb_id: betriebId,
    kunde: f.kunde?.trim() || null, ap: f.ap?.trim() || null,
    telefon: f.telefon?.trim() || null,
  });
  if (e2) throw new Error(e2.message);
  return bId;
}

const komma = (v) => {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export async function artikelSpeichern(betriebId, f, id) {
  const aId = id ?? crypto.randomUUID();
  const satz = {
    id: aId, betrieb_id: betriebId,
    txt: f.txt.trim(), eh: f.eh.trim(), lief: f.lief?.trim() || null,
  };
  /* Gleiche Vorsicht wie beim Lesen: fehlt der Nachtrag 0005, weist
     die Datenbank den ganzen Satz zurueck — samt Bezeichnung und
     Preis. Dann lieber ohne Strichcode speichern. */
  const mitEan = { ...satz, ean: f.ean?.trim() || null };
  let { error } = await supabase.from("artikel").upsert(mitEan);
  if (error && (error.code === "42703" || error.code === "PGRST204"
                || /column .* does not exist|'ean' column/i.test(error.message || ""))) {
    ({ error } = await supabase.from("artikel").upsert(satz));
  }
  if (error) throw new Error(error.message);

  /* Preise nur, wenn welche angegeben wurden. Ein Monteur bekommt die
     Felder gar nicht zu sehen, und die Datenbank wiese ihn ohnehin ab. */
  if (komma(f.ek) != null || komma(f.vk) != null) {
    const { error: e2 } = await supabase.from("artikel_preis").upsert({
      artikel_id: aId, betrieb_id: betriebId, ek: komma(f.ek), vk: komma(f.vk),
    });
    if (e2) throw new Error(e2.message);
  }
}

export async function positionSpeichern(betriebId, baustelleId, f, id) {
  const pId = id ?? crypto.randomUUID();
  const { error } = await supabase.from("lv_position").upsert({
    id: pId, betrieb_id: betriebId, baustelle_id: baustelleId,
    nr: f.nr.trim(), txt: f.txt.trim(), eh: f.eh.trim(), lv: Number(f.lv) || 0,
  });
  if (error) {
    if (error.code === "23505") throw new Error(`Position „${f.nr}“ gibt es auf dieser Baustelle schon.`);
    throw new Error(error.message);
  }
  if (komma(f.ep) != null) {
    const { error: e2 } = await supabase.from("lv_preis")
      .upsert({ position_id: pId, betrieb_id: betriebId, ep: komma(f.ep) });
    if (e2) throw new Error(e2.message);
  }
}

/* Zuteilung: wer die Baustelle sieht. Ohne Eintrag hier bekommt ein
   Monteur sie gar nicht erst geschickt. */
export async function crewSetzen(betriebId, baustelleId, profilIds) {
  const { error: eDel } = await supabase.from("baustelle_crew")
    .delete().eq("baustelle_id", baustelleId);
  if (eDel) throw new Error(eDel.message);
  if (profilIds.length === 0) return;
  const { error } = await supabase.from("baustelle_crew").insert(
    profilIds.map((p) => ({ baustelle_id: baustelleId, profil_id: p, betrieb_id: betriebId })));
  if (error) throw new Error(error.message);
}

/* Mitarbeiter ohne Zugang: existiert im Betrieb, hat aber (noch) kein
   Anmeldekonto. Genau dafuer ist profil.auth_id optional. */
export async function mitarbeiterSpeichern(betriebId, f, id) {
  const { error } = await supabase.from("profil").upsert({
    id: id ?? crypto.randomUUID(), betrieb_id: betriebId,
    name: f.name.trim(), kurz: f.kurz.trim().toUpperCase(),
    rolle: f.rolle?.trim() || null, zugang: f.zugang,
  });
  if (error) throw new Error(error.message);
}

/* ── Aufmaß korrigieren ──────────────────────────────────────
   Auf einer Baustelle vertippt man sich. Bisher blieb eine falsche
   Zeile für immer stehen und landete im unterschriebenen Blatt.
   Geloescht wird nicht wirklich, sondern über geloescht_am — sonst
   wüsste ein Gerät beim Abgleich nicht, ob die Zeile weg oder neu ist. */

export async function zeileAendern(id, { ort, ansatz, menge }) {
  const { error } = await supabase.from("aufmass_zeile")
    .update({ ort, ansatz, menge }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function zeileLoeschen(id) {
  const { error } = await supabase.from("aufmass_zeile")
    .update({ geloescht_am: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

/* ── Fotos ansehen ───────────────────────────────────────────
   Der Ablageort ist nicht öffentlich, sonst käme jeder mit dem Pfad an
   Kundenfotos. Deshalb kurzlebige Einmal-Adressen. */
export async function fotoAdressen(pfade, sekunden = 3600) {
  if (pfade.length === 0) return {};
  const { data, error } = await supabase.storage
    .from("baustelle").createSignedUrls(pfade, sekunden);
  if (error) throw new Error(error.message);
  return Object.fromEntries((data ?? [])
    .filter((d) => d.signedUrl)
    .map((d) => [d.path, d.signedUrl]));
}

/* ── Stempelzeiten berichtigen ───────────────────────────────
   Aus Stempelungen werden Löhne und Rechnungen. Wer abends merkt, dass
   er das Ausstempeln um 16:00 vergessen hat, muss das geraderücken
   können — sonst steht in der Abrechnung eine Zahl, von der alle
   wissen, dass sie falsch ist.

   Die Regeln in der Datenbank lassen das längst zu: zeit_aendern gibt
   der Leitung alles und jedem seine eigenen Zeiten. Es fehlte nur der
   Weg dorthin. */
export async function zeitAendern(id, von, bis) {
  if (bis && new Date(bis) <= new Date(von)) {
    throw new Error("Das Ende liegt vor dem Anfang.");
  }
  const { error } = await supabase.from("zeit").update({ von, bis: bis ?? null }).eq("id", id);
  if (error) {
    /* Der Index lässt nur eine laufende Stempelung je Person zu. */
    if (error.code === "23505") throw new Error("Es läuft schon eine andere Stempelung.");
    throw new Error(error.message);
  }
}

/* Entfernen heisst markieren, nicht löschen: ein nachgereichter
   Vorgang aus der Warteschlange legte den Eintrag sonst wieder an. */
export async function zeitLoeschen(id) {
  const { error } = await supabase.from("zeit")
    .update({ geloescht_am: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

/* ── Laden mit Rückfallebene ─────────────────────────────────
   Klappt es, wird der Stand gesichert. Klappt es nicht und es liegt am
   Netz, zeigen wir den letzten Stand — gekennzeichnet, damit niemand
   alte Zahlen für aktuell hält. */
export async function ladenMitCache(wer) {
  try {
    const daten = await ladeAlles();
    standSichern(daten, wer);
    return { daten, ausCache: false, stand: Date.now() };
  } catch (e) {
    if (!istNetzfehler(e)) throw e;
    const alt = standLesen(wer);
    if (!alt) throw new Error("Kein Netz und noch kein Stand im Gerät. Einmal mit Netz öffnen.");
    return { daten: alt.daten, ausCache: true, stand: alt.zeitpunkt };
  }
}

/* ── Schreiben, das ein Funkloch übersteht ───────────────────
   Erst versuchen. Scheitert es am Netz, wandert der Vorgang in die
   Warteschlange und wird später nachgereicht. Alles hier ist ein
   Einfügen mit vom Gerät vergebener Nummer — ein zweiter Versuch
   erzeugt deshalb kein Doppel. */
export async function schreibenOderMerken(art, nutzlast, ausfuehren, wer) {
  try { await ausfuehren(); return { gesendet: true }; }
  catch (e) {
    if (!istNetzfehler(e)) throw e;
    einreihen(art, nutzlast, wer);
    return { gesendet: false };
  }
}

/* Führt einen gemerkten Vorgang aus — von der Warteschlange benutzt. */
export async function vorgangAusfuehren(art, n) {
  switch (art) {
    case "aufmass":     return aufmassSpeichern(n.betriebId, n.posId, n.ort, n.ansatz, n.menge, n.profil, n.id);
    case "anforderung": return anforderungSenden(n.betriebId, n.bId, n.korb, n.wann, n.dringend, n.profil, n.ids);
    case "bericht":     return berichtSpeichern(n.betriebId, n.bId, n.text, n.profil, n.id);
    case "einstempeln": return einstempeln(n.betriebId, n.bId, n.profil, n.id, n.von);
    case "ausstempeln": return ausstempeln(n.zeitId, n.bis);
    default: throw new Error("Unbekannter Vorgang: " + art);
  }
}

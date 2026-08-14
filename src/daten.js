import { supabase } from "./supabase.js";

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

  const hole = async (tabelle, spalten = "*") => {
    const { data, error } = await supabase.from(tabelle).select(spalten);
    if (error) throw new Error(`${tabelle}: ${error.message}`);
    return data ?? [];
  };

  const [betriebe, profile, baustellen, kaufm, crew, artikel, anforderungen, positionen, zeilen, zeiten, fotos] =
    await Promise.all([
      hole("betrieb", "id,name"),
      hole("profil", "id,name,kurz,rolle,zugang"),
      hole("baustelle"),
      hole("baustelle_kaufmaennisch", "baustelle_id,kunde,ap,telefon"),
      hole("baustelle_crew", "baustelle_id,profil_id,heute"),
      hole("artikel", "id,txt,eh,lief"),
      hole("anforderung"),
      hole("lv_position"),
      hole("aufmass_zeile"),
      hole("zeit", "id,profil_id,baustelle_id,von,bis"),
      hole("foto", "id,zeile_id,bericht_id"),
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

  const ARTIKEL = artikel.map((a) => ({ id: a.id, txt: a.txt, eh: a.eh, lief: a.lief ?? "—" }));

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
    .map((p) => ({ id: p.id, bId: p.baustelle_id, nr: p.nr, txt: p.txt, eh: p.eh, lv: Number(p.lv) }));

  const ZEILEN = zeilen
    .filter((z) => !z.geloescht_am)
    .map((z) => ({
      id: z.id,
      pId: z.position_id,
      ort: z.ort,
      ansatz: z.ansatz,
      menge: Number(z.menge),
      foto: fotos.some((f) => f.zeile_id === z.id),
      datum: tag(z.erfasst_am),
    }));

  /* Die laufende Stempelung, falls es eine gibt. Der Index in der
     Datenbank stellt sicher, dass es höchstens eine je Person ist. */
  const laufend = zeiten.find((z) => !z.bis && z.profil_id === meinProfil) ?? null;

  const betriebId = betriebe[0]?.id ?? baustellen[0]?.betrieb_id ?? null;
  if (!betriebId) throw new Error("Kein Betrieb sichtbar — Zugang unvollständig.");

  return { meinProfil, betriebId, betrieb: betriebe[0]?.name ?? "", team, B, ARTIKEL, anf, POS, ZEILEN, laufend };
}

/* ── Schreiben ───────────────────────────────────────────────
   Die Schlüssel vergibt das Gerät (crypto.randomUUID), nicht der
   Server: nur so kann später auch im Funkloch etwas angelegt werden. */

export async function anforderungSenden(betriebId, bId, korb, wann, dringend, meinProfil) {
  const zeilen = korb.map((k) => ({
    id: crypto.randomUUID(),
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
  if (error) throw new Error(error.message);
  return zeilen.map((z) => z.id);
}

export async function aufmassSpeichern(betriebId, posId, ort, ansatz, menge, meinProfil) {
  const id = crypto.randomUUID();
  const { error } = await supabase.from("aufmass_zeile").insert({
    id,
    betrieb_id: betriebId,
    position_id: posId,
    ort,
    ansatz,
    menge,
    erfasst_von: meinProfil,
  });
  if (error) throw new Error(error.message);
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

export async function einstempeln(betriebId, baustelleId, meinProfil) {
  const { error } = await supabase.from("zeit").insert({
    id: crypto.randomUUID(),
    betrieb_id: betriebId,
    profil_id: meinProfil,
    baustelle_id: baustelleId,
  });
  /* Der Index zeit_eine_laufende verhindert zwei offene Stempelungen —
     etwa wenn jemand Handy und Tablet benutzt. */
  if (error) {
    if (error.code === "23505") throw new Error("Du bist schon eingestempelt.");
    throw new Error(error.message);
  }
}

export async function ausstempeln(zeitId) {
  const { error } = await supabase
    .from("zeit").update({ bis: new Date().toISOString() }).eq("id", zeitId);
  if (error) throw new Error(error.message);
}

/* ── Tagesbericht ────────────────────────────────────────────── */
export async function berichtSpeichern(betriebId, baustelleId, text, meinProfil) {
  const id = crypto.randomUUID();
  const { error } = await supabase.from("tagesbericht").insert({
    id, betrieb_id: betriebId, baustelle_id: baustelleId,
    profil_id: meinProfil, text,
  });
  if (error) throw new Error(error.message);
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
  if (eUp) throw new Error("Hochladen fehlgeschlagen: " + eUp.message);

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

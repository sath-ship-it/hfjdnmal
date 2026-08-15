-- ═══════════════════════════════════════════════════════════════
-- Rollen und Baustellen-Zuteilung von Hand setzen.
--
-- Kein Nachtrag, sondern ein Werkzeug: mehrfach ausführbar, ändert
-- nichts am Aufbau der Datenbank. Immer nur den Teil ausführen, den
-- man braucht — die Blöcke sind unabhängig voneinander.
--
-- Was die Rolle entscheidet:
--   Leitung     sieht alles, vergibt Zugänge, legt Baustellen an
--   Buchhalter  Preise, Kunden, alle Stunden — aber keine Rechte
--   Monteur     nur Baustellen, in denen er eingeteilt ist
--   Azubi       wie Monteur
--
-- Wichtig: Die Rolle hängt am PROFIL, nicht am Anmeldekonto. Ein
-- Profil ohne auth_id kann sich nicht anmelden, taucht aber überall
-- als Mitarbeiter auf — das ist Absicht, damit man Leute führen kann,
-- die kein Telefon bekommen.
-- ═══════════════════════════════════════════════════════════════


-- ── 1. Wer ist wer? Immer zuerst ausführen. ────────────────────
select p.name, p.kurz, p.zugang, p.rolle,
       coalesce(u.email, '— kein Zugang —')          as anmeldung,
       (select count(*) from baustelle_crew c where c.profil_id = p.id) as baustellen
from profil p
left join auth.users u on u.id = p.auth_id
order by p.zugang, p.name;


-- ── 2. Rolle ändern ───────────────────────────────────────────
-- Die beiden Werte oben anpassen, dann NUR diesen Block ausführen.
-- Erlaubt sind: 'Leitung', 'Buchhalter', 'Monteur', 'Azubi'
do $$
declare
  wen   text := 'monteur@flux.de';     -- E-Mail des Kontos
  neue  text := 'Monteur';             -- neue Rolle
  p     uuid;
  leitungen int;
begin
  select id into p from profil
   where auth_id = (select id from auth.users where lower(email) = lower(wen));
  if p is null then
    raise exception 'Zu % gehört kein Profil. Erst zugaenge.sql ausführen.', wen;
  end if;

  /* Wer sich selbst die Leitung nimmt und der Letzte war, sperrt den
     Betrieb aus: Zugänge vergeben kann dann niemand mehr. */
  select count(*) into leitungen from profil where zugang = 'Leitung' and id <> p;
  if neue <> 'Leitung' and leitungen = 0 then
    raise exception 'Das ist die letzte Leitung. Erst jemand anderem die Leitung geben.';
  end if;

  update profil set zugang = neue::zugang_art where id = p;
  raise notice '% ist jetzt %', wen, neue;
end $$;


-- ── 3. Monteur einer Baustelle zuteilen ───────────────────────
-- Ohne Zuteilung sieht ein Monteur die Baustelle nicht — die
-- Rechteregel schickt sie ihm gar nicht erst.
do $$
declare
  wen    text := 'monteur@flux.de';
  nummer text := 'BV-2025-114';        -- Baustellen-Nummer, siehe Liste unten
  heute_da boolean := false;           -- true = wird als "heute vor Ort" angezeigt
  p uuid; s uuid; bt uuid;
begin
  select id into p from profil
   where auth_id = (select id from auth.users where lower(email) = lower(wen));
  select id, betrieb_id into s, bt from baustelle where nr = nummer;
  if p is null then raise exception 'Kein Profil zu %', wen; end if;
  if s is null then raise exception 'Keine Baustelle mit Nummer %', nummer; end if;

  insert into baustelle_crew (baustelle_id, profil_id, betrieb_id, heute)
  values (s, p, bt, heute_da)
  on conflict (baustelle_id, profil_id) do update set heute = excluded.heute;
  raise notice '% ist jetzt auf % eingeteilt', wen, nummer;
end $$;


-- ── 4. Zuteilung wieder wegnehmen ─────────────────────────────
-- delete from baustelle_crew
--  where baustelle_id = (select id from baustelle where nr = 'BV-2025-114')
--    and profil_id = (select id from profil
--                      where auth_id = (select id from auth.users
--                                        where lower(email) = 'monteur@flux.de'));


-- ── 5. Zur Kontrolle: Baustellen und wer darauf steht ─────────
select b.nr, b.name, b.phase,
       coalesce(string_agg(p.name, ', ' order by p.name), '— niemand —') as crew
from baustelle b
left join baustelle_crew c on c.baustelle_id = b.id
left join profil p on p.id = c.profil_id
where b.geloescht_am is null
group by b.nr, b.name, b.phase
order by b.nr;

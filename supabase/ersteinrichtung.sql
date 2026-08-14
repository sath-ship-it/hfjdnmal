-- ═══════════════════════════════════════════════════════════════
-- Ersteinrichtung + Testdaten — EINMALIG nach 0001_grundgeruest.sql.
--
-- Legt den Betrieb, die Mannschaft und den kompletten Datenbestand aus
-- dem Prototyp an, damit die App sofort benutzbar ist.
--
-- Nur DU bekommst einen Zugang. Die vier Kollegen sind Mitarbeiter ohne
-- Anmeldekonto — genau der Fall, für den profil.auth_id leer bleiben
-- darf. Zugänge vergibt später die Leitung in der App.
--
-- VORHER: eigenes Anmeldekonto anlegen unter
--         Authentication → Users → Add user
--         (E-Mail + Passwort, "Auto Confirm User" einschalten)
-- ═══════════════════════════════════════════════════════════════

do $$
declare
  -- ↓↓↓ ANPASSEN: die E-Mail, mit der du dich eben angelegt hast
  v_email text := 'HIER@DEINE-MAIL.DE';
  -- ↑↑↑
  v_auth  uuid;
  b       uuid := '11111111-1111-1111-1111-111111111111';  -- Betrieb
  -- Mitarbeiter
  p_dg uuid := 'a0000000-0000-0000-0000-000000000001';
  p_mf uuid := 'a0000000-0000-0000-0000-000000000002';
  p_ab uuid := 'a0000000-0000-0000-0000-000000000003';
  p_gn uuid := 'a0000000-0000-0000-0000-000000000004';
  p_ff uuid := 'a0000000-0000-0000-0000-000000000005';
  -- Baustellen
  s1 uuid := 'b0000000-0000-0000-0000-000000000001';  -- Sparkasse
  s2 uuid := 'b0000000-0000-0000-0000-000000000002';  -- EFH
  s3 uuid := 'b0000000-0000-0000-0000-000000000003';  -- Otto
  s4 uuid := 'b0000000-0000-0000-0000-000000000004';  -- City Center
  s8 uuid := 'b0000000-0000-0000-0000-000000000008';  -- WNG
  -- Artikel
  a1 uuid := 'c0000000-0000-0000-0000-000000000001';
  a2 uuid := 'c0000000-0000-0000-0000-000000000002';
  a3 uuid := 'c0000000-0000-0000-0000-000000000003';
  a4 uuid := 'c0000000-0000-0000-0000-000000000004';
  a5 uuid := 'c0000000-0000-0000-0000-000000000005';
  a6 uuid := 'c0000000-0000-0000-0000-000000000006';
  a7 uuid := 'c0000000-0000-0000-0000-000000000007';
  a8 uuid := 'c0000000-0000-0000-0000-000000000008';
  a9 uuid := 'c0000000-0000-0000-0000-000000000009';
  a10 uuid := 'c0000000-0000-0000-0000-000000000010';
  -- LV-Positionen
  q1 uuid := 'd0000000-0000-0000-0000-000000000001';
  q2 uuid := 'd0000000-0000-0000-0000-000000000002';
  q3 uuid := 'd0000000-0000-0000-0000-000000000003';
  q4 uuid := 'd0000000-0000-0000-0000-000000000004';
  q5 uuid := 'd0000000-0000-0000-0000-000000000005';
  q6 uuid := 'd0000000-0000-0000-0000-000000000006';
  q7 uuid := 'd0000000-0000-0000-0000-000000000007';
begin
  select id into v_auth from auth.users where lower(email) = lower(v_email);
  if v_auth is null then
    raise exception
      'Kein Anmeldekonto für "%" gefunden. Erst unter Authentication → Users anlegen.', v_email;
  end if;
  if exists (select 1 from betrieb where id = b) then
    raise exception 'Ersteinrichtung ist schon gelaufen.';
  end if;

  insert into betrieb (id, name) values (b, 'WARO');

  -- ── Mannschaft. Nur DG bekommt einen Zugang. ──
  insert into profil (id, auth_id, betrieb_id, name, kurz, rolle, zugang) values
    (p_dg, v_auth, b, 'Daniil Gorlov',    'DG', 'ME', 'Leitung'),
    (p_mf, null,   b, 'Marco Feddern',    'MF', 'ME', 'Leitung'),
    (p_ab, null,   b, 'Alin Borzasi',     'AB', 'TM', 'Monteur'),
    (p_gn, null,   b, 'Goran Nikolic',    'GN', 'TM', 'Monteur'),
    (p_ff, null,   b, 'Felix Fickenschär','FF', 'HA', 'Azubi');

  -- ── Baustellen ──
  insert into baustelle (id, betrieb_id, nr, name, adr, phase, ruht, abrechnung, von, bis) values
    (s1, b, 'P260024', 'Sparkasse Ahrensburg',   'Hamburger Straße 10, 22926 Ahrensburg',    'In Arbeit',  false, 'Einheitspreise', date '2026-08-03', date '2026-08-14'),
    (s2, b, 'P260023', 'EFH Gärtnergasse 67',    'Gärtnergasse 67, 23562 Lübeck',            'In Arbeit',  false, 'Pauschal',       date '2026-07-10', null),
    (s3, b, 'P260015', 'Otto Hamburg',           'Bannwarthstraße, 22179 Hamburg',           'In Arbeit',  true,  'Einheitspreise', date '2026-04-19', date '2026-07-31'),
    (s4, b, 'P260009', 'City Center Ahrensburg', 'Klaus-Groth-Straße 1, 22926 Ahrensburg',   'In Arbeit',  true,  'Einheitspreise', date '2026-03-20', null),
    (s8, b, 'P260025', 'WNG Beckergrube 69',     'Beckergrube 69, 23552 Lübeck',             'Beauftragt', false, 'Pauschal',       date '2026-09-01', null);

  insert into baustelle_kaufmaennisch (baustelle_id, betrieb_id, kunde, ap) values
    (s1, b, 'Bosch Building Automation GmbH', 'Thomas Robowsky'),
    (s2, b, 'Johann Kühn',                    'Johann Kühn'),
    (s3, b, 'Bosch Sicherheitssysteme GmbH',  'Lars Bunsen'),
    (s4, b, 'Bosch Sicherheitssysteme GmbH',  'Christian Teegen'),
    (s8, b, 'Thomas Witt',                    'Thomas Witt');

  insert into baustelle_crew (baustelle_id, profil_id, betrieb_id, heute) values
    (s1, p_ab, b, true),  (s1, p_ff, b, true),  (s1, p_dg, b, false),
    (s2, p_gn, b, true),
    (s3, p_ab, b, false), (s3, p_dg, b, false),
    (s4, p_ab, b, false), (s4, p_gn, b, false), (s4, p_dg, b, false),
    (s8, p_gn, b, false), (s8, p_ff, b, false);

  -- ── Artikelstamm (käme später aus Datanorm) ──
  insert into artikel (id, betrieb_id, txt, eh, lief) values
    (a1,  b, 'NHXMH-J 5x2,5',              'm',  'Sonepar'),
    (a2,  b, 'NYM-J 3x1,5',                'm',  'Sonepar'),
    (a3,  b, 'JE-H(St)H 2x2x0,8 E30',      'm',  'Sonepar'),
    (a4,  b, 'FI/LS-Kombi 16A B',          'St', 'Sonepar'),
    (a5,  b, 'Kabelrinne 200 mm verzinkt', 'm',  'Rexel'),
    (a6,  b, 'Kabelrinnendeckel 200 mm',   'm',  'Rexel'),
    (a7,  b, 'BSK-Antrieb 24 V',           'St', 'Rexel'),
    (a8,  b, 'Schraubanker 8x60',          'St', 'Rexel'),
    (a9,  b, 'Kanalrauchmelder FCS-320-TM','St', 'Bosch direkt'),
    (a10, b, 'Handfeuermelder FMC-210',    'St', 'Bosch direkt');

  -- ── Materialanforderungen in allen vier Zuständen ──
  insert into anforderung (betrieb_id, baustelle_id, artikel_id, menge, von_profil, wann, dringend, status, lt) values
    (b, s1, a7,  6,   p_ab, 'Mo 17.08.', true,  'Angefordert', null),
    (b, s1, a8,  120, p_ab, 'Mo 17.08.', false, 'Angefordert', null),
    (b, s1, a5,  40,  p_ab, 'Mi 19.08.', false, 'Angefordert', null),
    (b, s4, a3,  200, p_gn, 'Di 18.08.', false, 'Angefordert', null),
    (b, s8, a4,  12,  p_gn, 'Fr 28.08.', false, 'Angefordert', null),
    (b, s1, a9,  4,   p_ab, 'Do 20.08.', false, 'Angefordert', null),
    (b, s1, a1,  300, p_ab, '12.08.',    false, 'Bestellt',    'Mo 17.08.'),
    (b, s2, a2,  500, p_gn, '11.08.',    false, 'Bestellt',    'Mo 17.08.'),
    (b, s1, a6,  24,  p_ab, '08.08.',    false, 'Geliefert',   null),
    (b, s1, a10, 8,   p_dg, '05.08.',    false, 'Verbaut',     null);

  -- ── Leistungsverzeichnis ──
  insert into lv_position (id, betrieb_id, baustelle_id, nr, txt, eh, lv) values
    (q1, b, s1, '01.10', 'Kabel NHXMH-J 5x2,5 verlegen',              'm',   500),
    (q2, b, s1, '01.20', 'Kabelrinne 200 mm montieren',               'm',   180),
    (q3, b, s1, '02.10', 'Kanalrauchmelder montieren u. anschließen', 'St',   12),
    (q4, b, s1, '02.20', 'BSK-Antrieb anschließen',                   'St',   24),
    (q5, b, s1, '03.10', 'Regiestunden Monteur',                      'Std',  40),
    (q6, b, s4, '01.10', 'E90-Trasse montieren',                      'm',   320),
    (q7, b, s4, '02.10', 'LSN-Ringbus verlegen',                      'm',   800);

  -- ── Erfasste Aufmaß-Ansätze ──
  insert into aufmass_zeile (betrieb_id, position_id, ort, ansatz, menge, foto_pfad, erfasst_von, erfasst_am) values
    (b, q1, 'EG Flur Nord',        '3 × 40',   120, 'platzhalter', p_ab, date '2026-08-11'),
    (b, q1, 'EG Flur Süd',         '2 × 45',    90, 'platzhalter', p_ab, date '2026-08-11'),
    (b, q1, '1. OG Achse C',       '4 × 32,5', 130, null,          p_ab, date '2026-08-12'),
    (b, q2, 'UG Trasse Hauptgang', '24',        24, 'platzhalter', p_ab, date '2026-08-10'),
    (b, q2, 'EG Flur Nord',        '48',        48, 'platzhalter', p_ff, date '2026-08-11'),
    (b, q2, '1. OG Flur',          '24',        24, null,          p_ff, date '2026-08-13'),
    (b, q3, 'RLT-Gerät 1 + 2',     '2 × 4',      8, 'platzhalter', p_ab, date '2026-08-13'),
    (b, q4, 'EG Achse A–C',        '6',          6, null,          p_ab, date '2026-08-12'),
    (b, q5, 'Umbau Bestand KW 32', '2 × 11',    22, null,          p_dg, date '2026-08-08');

  raise notice 'Fertig: Betrieb WARO, 5 Mitarbeiter, 5 Baustellen, % ist Leitung.', v_email;
end $$;

-- Gegenprobe
select 'Mitarbeiter' as was, count(*) from profil
union all select 'davon mit Zugang', count(*) from profil where auth_id is not null
union all select 'Baustellen',       count(*) from baustelle
union all select 'Artikel',          count(*) from artikel
union all select 'Anforderungen',    count(*) from anforderung
union all select 'LV-Positionen',    count(*) from lv_position
union all select 'Aufmaß-Zeilen',    count(*) from aufmass_zeile;

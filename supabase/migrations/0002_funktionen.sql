-- ═══════════════════════════════════════════════════════════════
-- Nachtrag: Zeiterfassung, Tagesberichte, Fotos, Rufnummern.
--
-- Bringt die Tabellen für die Funktionen, die in der Oberfläche bisher
-- nur als Knopf existierten.
--
-- Nach 0001_grundgeruest.sql ausführen. Läuft mehrfach ohne Schaden:
-- alles ist mit "if not exists" abgesichert.
-- ═══════════════════════════════════════════════════════════════

-- ── Rufnummern ───────────────────────────────────────────────
-- Gehören zum kaufmännischen Teil: Ein Monteur braucht die Nummer des
-- Ansprechpartners vor Ort, aber sie ist Kundendatum.
alter table baustelle_kaufmaennisch add column if not exists telefon text;

-- ── Zeiterfassung ────────────────────────────────────────────
-- Eine Zeile je Stempelvorgang. bis bleibt leer, solange sie läuft.
create table if not exists zeit (
  id           uuid primary key default gen_random_uuid(),
  betrieb_id   uuid not null references betrieb (id) on delete restrict,
  profil_id    uuid not null references profil (id) on delete cascade,
  baustelle_id uuid not null references baustelle (id) on delete cascade,
  von          timestamptz not null default now(),
  bis          timestamptz,
  erstellt_am  timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  geloescht_am timestamptz
);
create index if not exists zeit_profil_idx on zeit (profil_id, von desc);
-- Nur eine laufende Stempelung je Person. Verhindert doppeltes
-- Einstempeln, wenn jemand zwei Geräte benutzt.
create unique index if not exists zeit_eine_laufende
  on zeit (profil_id) where bis is null and geloescht_am is null;

-- ── Tagesberichte ────────────────────────────────────────────
create table if not exists tagesbericht (
  id           uuid primary key default gen_random_uuid(),
  betrieb_id   uuid not null references betrieb (id) on delete restrict,
  baustelle_id uuid not null references baustelle (id) on delete cascade,
  profil_id    uuid not null references profil (id) on delete set null,
  datum        date not null default current_date,
  text         text not null,
  erstellt_am  timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  geloescht_am timestamptz
);
create index if not exists bericht_baustelle_idx on tagesbericht (baustelle_id, datum desc);

-- ── Fotos ────────────────────────────────────────────────────
-- Die Datei selbst liegt im Storage, hier steht nur, wo sie hingehört.
-- Genau eine Tabelle für alle Anhänge: ein Foto kann an einer
-- Aufmaßzeile, einem Bericht oder einfach an der Baustelle hängen.
create table if not exists foto (
  id           uuid primary key default gen_random_uuid(),
  betrieb_id   uuid not null references betrieb (id) on delete restrict,
  baustelle_id uuid references baustelle (id) on delete cascade,
  zeile_id     uuid references aufmass_zeile (id) on delete cascade,
  bericht_id   uuid references tagesbericht (id) on delete cascade,
  pfad         text not null,
  von_profil   uuid references profil (id) on delete set null,
  erstellt_am  timestamptz not null default now(),
  geloescht_am timestamptz
);
create index if not exists foto_zeile_idx on foto (zeile_id);
create index if not exists foto_bericht_idx on foto (bericht_id);

-- ── Unterschriften ───────────────────────────────────────────
-- Ein unterschriebenes Aufmaßblatt ist ein Beleg: Wer, wann, über
-- welche Positionen. Deshalb eigene Tabelle statt Anhang.
create table if not exists aufmassblatt (
  id           uuid primary key default gen_random_uuid(),
  betrieb_id   uuid not null references betrieb (id) on delete restrict,
  baustelle_id uuid not null references baustelle (id) on delete cascade,
  unterzeichner text,
  unterschrift_pfad text,
  erstellt_von uuid references profil (id) on delete set null,
  erstellt_am  timestamptz not null default now()
);

-- ── geaendert_am mitführen ───────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['zeit','tagesbericht'] loop
    if not exists (select 1 from pg_trigger where tgname = t || '_geaendert') then
      execute format(
        'create trigger %I_geaendert before update on %I
           for each row execute function setze_geaendert_am()', t, t);
    end if;
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- Rechteregeln — gleiche Linie wie in 0001
-- ═══════════════════════════════════════════════════════════════
alter table zeit          enable row level security;
alter table tagesbericht  enable row level security;
alter table foto          enable row level security;
alter table aufmassblatt  enable row level security;

drop policy if exists zeit_lesen on zeit;
create policy zeit_lesen on zeit for select
  using (betrieb_id = mein_betrieb() and (ist_leitung() or profil_id = mein_profil()));
drop policy if exists zeit_stempeln on zeit;
create policy zeit_stempeln on zeit for insert
  with check (betrieb_id = mein_betrieb() and profil_id = mein_profil());
drop policy if exists zeit_aendern on zeit;
create policy zeit_aendern on zeit for update
  using (betrieb_id = mein_betrieb() and (ist_leitung() or profil_id = mein_profil()))
  with check (betrieb_id = mein_betrieb());

drop policy if exists bericht_lesen on tagesbericht;
create policy bericht_lesen on tagesbericht for select
  using (betrieb_id = mein_betrieb() and baustelle_id in (select id from baustelle));
drop policy if exists bericht_schreiben on tagesbericht;
create policy bericht_schreiben on tagesbericht for insert
  with check (betrieb_id = mein_betrieb() and baustelle_id in (select id from baustelle)
              and profil_id = mein_profil());
drop policy if exists bericht_aendern on tagesbericht;
create policy bericht_aendern on tagesbericht for update
  using (betrieb_id = mein_betrieb() and (ist_leitung() or profil_id = mein_profil()))
  with check (betrieb_id = mein_betrieb());

drop policy if exists foto_lesen on foto;
create policy foto_lesen on foto for select
  using (betrieb_id = mein_betrieb());
drop policy if exists foto_schreiben on foto;
create policy foto_schreiben on foto for insert
  with check (betrieb_id = mein_betrieb() and von_profil = mein_profil());

drop policy if exists blatt_lesen on aufmassblatt;
create policy blatt_lesen on aufmassblatt for select
  using (betrieb_id = mein_betrieb() and baustelle_id in (select id from baustelle));
drop policy if exists blatt_schreiben on aufmassblatt;
create policy blatt_schreiben on aufmassblatt for insert
  with check (betrieb_id = mein_betrieb() and baustelle_id in (select id from baustelle));

-- ── Testdaten: Rufnummern nachtragen ─────────────────────────
update baustelle_kaufmaennisch set telefon = '+49 40 123456' where telefon is null;

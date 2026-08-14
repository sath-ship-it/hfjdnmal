-- ═══════════════════════════════════════════════════════════════
-- WARO — Grundgerüst: Betriebe, Zugänge, Baustellen, Material, Aufmaß
--
-- Drei Entwurfsentscheidungen ziehen sich durch alles:
--
-- 1) betrieb_id in JEDER Tabelle, obwohl es vorerst nur einen Betrieb
--    gibt. Nachrüsten hieße später: jede Tabelle migrieren und jede
--    Rechteregel neu schreiben, mit echten Kundendaten drin.
--
-- 2) Schlüssel sind UUIDs, die das GERÄT vergeben darf. Ein Monteur im
--    Funkloch kann sonst nichts anlegen, weil ihm die Nummer fehlt.
--
-- 3) Gelöscht wird nicht wirklich, sondern über geloescht_am. Sonst kann
--    ein Gerät beim Abgleich nicht unterscheiden, ob ein Satz gelöscht
--    wurde oder neu ist.
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── Aufzählungen ──────────────────────────────────────────────
create type zugang_art as enum ('Leitung', 'Monteur', 'Azubi');
create type abrechnung_art as enum ('Einheitspreise', 'Pauschal');
create type phase_art as enum
  ('Anfrage', 'Angebot', 'Beauftragt', 'In Arbeit', 'Abgenommen', 'Abgerechnet');
create type anforderung_status as enum
  ('Angefordert', 'Bestellt', 'Geliefert', 'Verbaut');

-- ── Betrieb und Zugänge ───────────────────────────────────────
create table betrieb (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  erstellt_am timestamptz not null default now()
);

-- Ein Profil hängt an einem Supabase-Anmeldekonto. Es wird von der
-- Leitung per Einladung angelegt — es gibt keine offene Registrierung.
create table profil (
  id          uuid primary key references auth.users (id) on delete cascade,
  betrieb_id  uuid not null references betrieb (id) on delete restrict,
  name        text not null,
  kurz        text not null,
  rolle       text,
  zugang      zugang_art not null default 'Monteur',
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now()
);
create index on profil (betrieb_id);

-- ── Hilfsfunktionen für die Rechteregeln ──────────────────────
-- security definer, weil diese Abfragen sonst selbst wieder gegen die
-- Regeln auf profil laufen würden — das ergäbe eine Endlosschleife.
create or replace function mein_betrieb() returns uuid
  language sql stable security definer set search_path = public as $$
  select betrieb_id from profil where id = auth.uid()
$$;

create or replace function ist_leitung() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select zugang = 'Leitung' from profil where id = auth.uid()), false)
$$;

-- ── Baustellen ────────────────────────────────────────────────
-- Bewusst OHNE Kundennamen: der steckt in baustelle_kaufmaennisch.
-- Postgres-Rechte gelten pro Rolle, nicht pro Nutzer — in Supabase sind
-- aber alle Angemeldeten dieselbe Rolle. Einzelne Spalten lassen sich
-- damit nicht pro Zugang wegnehmen. Deshalb sind die vertraulichen
-- Felder in eine eigene Tabelle mit eigener Regel getrennt.
create table baustelle (
  id           uuid primary key default gen_random_uuid(),
  betrieb_id   uuid not null references betrieb (id) on delete restrict,
  nr           text not null,
  name         text not null,
  adr          text,
  phase        phase_art not null default 'Anfrage',
  ruht         boolean not null default false,
  abrechnung   abrechnung_art not null default 'Einheitspreise',
  von          date,
  bis          date,
  erstellt_am  timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  geloescht_am timestamptz,
  unique (betrieb_id, nr)
);
create index on baustelle (betrieb_id);

create table baustelle_kaufmaennisch (
  baustelle_id uuid primary key references baustelle (id) on delete cascade,
  betrieb_id   uuid not null references betrieb (id) on delete restrict,
  kunde        text,
  ap           text,
  geaendert_am timestamptz not null default now()
);

-- Wer ist welcher Baustelle zugeteilt
create table baustelle_crew (
  baustelle_id uuid not null references baustelle (id) on delete cascade,
  profil_id    uuid not null references profil (id) on delete cascade,
  betrieb_id   uuid not null references betrieb (id) on delete restrict,
  primary key (baustelle_id, profil_id)
);
create index on baustelle_crew (profil_id);

-- ── Material ──────────────────────────────────────────────────
create table artikel (
  id           uuid primary key default gen_random_uuid(),
  betrieb_id   uuid not null references betrieb (id) on delete restrict,
  txt          text not null,
  eh           text not null,
  lief         text,
  geloescht_am timestamptz
);
create index on artikel (betrieb_id);

create table anforderung (
  id           uuid primary key default gen_random_uuid(),
  betrieb_id   uuid not null references betrieb (id) on delete restrict,
  baustelle_id uuid not null references baustelle (id) on delete cascade,
  artikel_id   uuid references artikel (id) on delete set null,
  -- Freitext, wenn der Artikel noch nicht im Stamm ist: der Monteur soll
  -- nicht blockiert sein, nur weil das Büro etwas nicht angelegt hat.
  freitext     text,
  menge        numeric(12,2) not null check (menge >= 0),
  von_profil   uuid references profil (id) on delete set null,
  wann         text,
  dringend     boolean not null default false,
  status       anforderung_status not null default 'Angefordert',
  lt           text,
  erstellt_am  timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  geloescht_am timestamptz,
  constraint artikel_oder_freitext check (artikel_id is not null or freitext is not null)
);
create index on anforderung (betrieb_id, status);
create index on anforderung (baustelle_id);

-- ── Aufmaß ────────────────────────────────────────────────────
create table lv_position (
  id           uuid primary key default gen_random_uuid(),
  betrieb_id   uuid not null references betrieb (id) on delete restrict,
  baustelle_id uuid not null references baustelle (id) on delete cascade,
  nr           text not null,
  txt          text not null,
  eh           text not null,
  lv           numeric(12,2) not null default 0,
  geaendert_am timestamptz not null default now(),
  geloescht_am timestamptz,
  unique (baustelle_id, nr)
);
create index on lv_position (baustelle_id);

create table aufmass_zeile (
  id           uuid primary key default gen_random_uuid(),
  betrieb_id   uuid not null references betrieb (id) on delete restrict,
  position_id  uuid not null references lv_position (id) on delete cascade,
  ort          text not null,
  -- Der Ansatz wird als Text mitgespeichert, nicht nur das Ergebnis.
  -- Genau den will der Prüfer beim Kunden sehen.
  ansatz       text not null,
  menge        numeric(12,2) not null,
  foto_pfad    text,
  erfasst_von  uuid references profil (id) on delete set null,
  erfasst_am   date not null default current_date,
  erstellt_am  timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  geloescht_am timestamptz
);
create index on aufmass_zeile (position_id);
create index on aufmass_zeile (betrieb_id, geaendert_am);

-- ── geaendert_am automatisch mitführen ────────────────────────
-- Ohne verlässlichen Zeitstempel kann ein Gerät später nicht fragen
-- "was hat sich seit meinem letzten Abgleich geändert?".
create or replace function setze_geaendert_am() returns trigger
  language plpgsql as $$
begin
  new.geaendert_am := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profil','baustelle','baustelle_kaufmaennisch',
                           'anforderung','lv_position','aufmass_zeile']
  loop
    execute format(
      'create trigger %I_geaendert before update on %I
         for each row execute function setze_geaendert_am()', t, t);
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- Rechteregeln (Row Level Security)
--
-- Der Kern: was die Oberfläche heute nur versteckt, wird hier
-- erzwungen. Ein Monteur bekommt fremde Baustellen gar nicht erst
-- geschickt — er kann sie also auch nicht mit den Entwicklerwerkzeugen
-- auslesen.
-- ═══════════════════════════════════════════════════════════════
alter table betrieb                 enable row level security;
alter table profil                  enable row level security;
alter table baustelle               enable row level security;
alter table baustelle_kaufmaennisch enable row level security;
alter table baustelle_crew          enable row level security;
alter table artikel                 enable row level security;
alter table anforderung             enable row level security;
alter table lv_position             enable row level security;
alter table aufmass_zeile           enable row level security;

-- Eigener Betrieb sichtbar
create policy betrieb_lesen on betrieb for select
  using (id = mein_betrieb());

-- Kollegen sieht man, aber ändern darf nur die Leitung
create policy profil_lesen on profil for select
  using (betrieb_id = mein_betrieb());
create policy profil_pflegen on profil for all
  using (betrieb_id = mein_betrieb() and ist_leitung())
  with check (betrieb_id = mein_betrieb() and ist_leitung());

-- Baustellen: Leitung alle, andere nur die eigenen
create policy baustelle_lesen on baustelle for select
  using (
    betrieb_id = mein_betrieb()
    and (ist_leitung() or exists (
      select 1 from baustelle_crew c
      where c.baustelle_id = baustelle.id and c.profil_id = auth.uid()))
  );
create policy baustelle_pflegen on baustelle for all
  using (betrieb_id = mein_betrieb() and ist_leitung())
  with check (betrieb_id = mein_betrieb() and ist_leitung());

-- Kundenname und Ansprechpartner: ausschliesslich Leitung
create policy kaufmaennisch_nur_leitung on baustelle_kaufmaennisch for all
  using (betrieb_id = mein_betrieb() and ist_leitung())
  with check (betrieb_id = mein_betrieb() and ist_leitung());

create policy crew_lesen on baustelle_crew for select
  using (betrieb_id = mein_betrieb());
create policy crew_pflegen on baustelle_crew for all
  using (betrieb_id = mein_betrieb() and ist_leitung())
  with check (betrieb_id = mein_betrieb() and ist_leitung());

-- Artikelstamm liest jeder, pflegen darf die Leitung
create policy artikel_lesen on artikel for select
  using (betrieb_id = mein_betrieb());
create policy artikel_pflegen on artikel for all
  using (betrieb_id = mein_betrieb() and ist_leitung())
  with check (betrieb_id = mein_betrieb() and ist_leitung());

-- Material: anfordern darf jeder auf seinen Baustellen.
-- Den Status weiterschalten (bestellen) darf nur die Leitung.
create policy anforderung_lesen on anforderung for select
  using (betrieb_id = mein_betrieb() and baustelle_id in (select id from baustelle));
create policy anforderung_anlegen on anforderung for insert
  with check (
    betrieb_id = mein_betrieb()
    and baustelle_id in (select id from baustelle)
    and status = 'Angefordert'
  );
create policy anforderung_aendern on anforderung for update
  using (betrieb_id = mein_betrieb() and ist_leitung())
  with check (betrieb_id = mein_betrieb() and ist_leitung());

-- LV-Positionen kommen aus dem Büro
create policy lv_lesen on lv_position for select
  using (betrieb_id = mein_betrieb() and baustelle_id in (select id from baustelle));
create policy lv_pflegen on lv_position for all
  using (betrieb_id = mein_betrieb() and ist_leitung())
  with check (betrieb_id = mein_betrieb() and ist_leitung());

-- Aufmaß: erfassen darf jeder auf seinen Baustellen
create policy aufmass_lesen on aufmass_zeile for select
  using (
    betrieb_id = mein_betrieb()
    and position_id in (select id from lv_position)
  );
create policy aufmass_anlegen on aufmass_zeile for insert
  with check (
    betrieb_id = mein_betrieb()
    and position_id in (select id from lv_position)
  );
-- Ändern nur die eigene Zeile — oder die Leitung
create policy aufmass_aendern on aufmass_zeile for update
  using (
    betrieb_id = mein_betrieb()
    and (ist_leitung() or erfasst_von = auth.uid())
  )
  with check (betrieb_id = mein_betrieb());

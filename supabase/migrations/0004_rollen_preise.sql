-- ═══════════════════════════════════════════════════════════════
-- Rollen und Preise.
--
-- Bisher gab es Leitung, Monteur und Azubi — und nirgends einen Preis.
-- Ein Buchhalter braucht genau das, was ein Monteur nicht sehen soll.
--
-- Der Zuschnitt:
--   Leitung     alles, auch Zugänge und Mitarbeiter
--   Buchhalter  alle Preise, Kunden, Stunden — aber KEINE Rechtevergabe
--   Monteur     seine Baustellen, keine Preise, keine Kundennamen
--   Azubi       wie Monteur
--
-- Preise stehen in eigenen Tabellen, nicht als Spalten. Grund wie schon
-- bei den Kundendaten: Postgres-Rechte gelten pro Rolle, und in Supabase
-- sind alle Angemeldeten dieselbe Rolle. Einzelne Spalten lassen sich so
-- nicht pro Zugang wegnehmen — ganze Zeilen schon.
--
-- Nach 0003 ausführen. Mehrfach ausführbar.
-- ═══════════════════════════════════════════════════════════════

-- ── Neue Rolle ───────────────────────────────────────────────
do $$
begin
  alter type zugang_art add value if not exists 'Buchhalter';
exception when others then
  raise notice 'zugang_art: %', sqlerrm;
end $$;

-- ── Wer darf Geld sehen ──────────────────────────────────────
-- Der Umweg über ::text ist Absicht, bitte nicht "aufräumen":
-- Postgres lässt einen frisch angelegten Enum-Wert erst nach dem
-- Commit verwenden (Fehler 55P04). Der SQL-Editor schickt aber das
-- ganze Skript als eine Transaktion — 'Buchhalter' wäre hier also
-- noch nicht benutzbar. Als Text verglichen, ist es nur eine
-- Zeichenkette und der Enum-Wert wird gar nicht gebraucht.
create or replace function darf_preise() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select zugang::text in ('Leitung', 'Buchhalter')
                   from profil where auth_id = auth.uid()), false)
$$;

-- ── Preise ───────────────────────────────────────────────────
create table if not exists artikel_preis (
  artikel_id   uuid primary key references artikel (id) on delete cascade,
  betrieb_id   uuid not null references betrieb (id) on delete restrict,
  ek           numeric(12,2),          -- Einkauf beim Großhändler
  vk           numeric(12,2),          -- was dem Kunden berechnet wird
  geaendert_am timestamptz not null default now()
);

create table if not exists lv_preis (
  position_id  uuid primary key references lv_position (id) on delete cascade,
  betrieb_id   uuid not null references betrieb (id) on delete restrict,
  ep           numeric(12,2),          -- Einheitspreis laut LV
  geaendert_am timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['artikel_preis','lv_preis'] loop
    if not exists (select 1 from pg_trigger where tgname = t || '_geaendert') then
      execute format('create trigger %I_geaendert before update on %I
        for each row execute function setze_geaendert_am()', t, t);
    end if;
  end loop;
end $$;

alter table artikel_preis enable row level security;
alter table lv_preis      enable row level security;

drop policy if exists preis_artikel_lesen on artikel_preis;
create policy preis_artikel_lesen on artikel_preis for select
  using (betrieb_id = mein_betrieb() and darf_preise());
drop policy if exists preis_artikel_pflegen on artikel_preis;
create policy preis_artikel_pflegen on artikel_preis for all
  using (betrieb_id = mein_betrieb() and darf_preise())
  with check (betrieb_id = mein_betrieb() and darf_preise());

drop policy if exists preis_lv_lesen on lv_preis;
create policy preis_lv_lesen on lv_preis for select
  using (betrieb_id = mein_betrieb() and darf_preise());
drop policy if exists preis_lv_pflegen on lv_preis;
create policy preis_lv_pflegen on lv_preis for all
  using (betrieb_id = mein_betrieb() and darf_preise())
  with check (betrieb_id = mein_betrieb() and darf_preise());

-- ── Kundendaten: auch für die Buchhaltung ────────────────────
-- Wer Rechnungen schreibt, braucht den Rechnungsempfänger.
drop policy if exists kaufmaennisch_nur_leitung on baustelle_kaufmaennisch;
drop policy if exists kaufmaennisch_lesen on baustelle_kaufmaennisch;
create policy kaufmaennisch_lesen on baustelle_kaufmaennisch for select
  using (betrieb_id = mein_betrieb() and darf_preise());
drop policy if exists kaufmaennisch_pflegen on baustelle_kaufmaennisch;
create policy kaufmaennisch_pflegen on baustelle_kaufmaennisch for all
  using (betrieb_id = mein_betrieb() and ist_leitung())
  with check (betrieb_id = mein_betrieb() and ist_leitung());

-- ── Stunden: die Buchhaltung sieht alle ──────────────────────
drop policy if exists zeit_lesen on zeit;
create policy zeit_lesen on zeit for select
  using (betrieb_id = mein_betrieb()
         and (ist_leitung() or darf_preise() or profil_id = mein_profil()));

-- ── Stammdaten: Buchhaltung darf pflegen, aber keine Zugänge ──
-- profil bleibt bewusst allein bei der Leitung: Wer Rechte vergeben
-- kann, kann sich selbst welche geben.
drop policy if exists artikel_pflegen on artikel;
create policy artikel_pflegen on artikel for all
  using (betrieb_id = mein_betrieb() and darf_preise())
  with check (betrieb_id = mein_betrieb() and darf_preise());

drop policy if exists lv_pflegen on lv_position;
create policy lv_pflegen on lv_position for all
  using (betrieb_id = mein_betrieb() and darf_preise())
  with check (betrieb_id = mein_betrieb() and darf_preise());

-- Baustellen anlegen bleibt bei der Leitung; die Buchhaltung darf sie
-- sehen, aber der Bauablauf ist nicht ihr Geschäft.
drop policy if exists baustelle_lesen on baustelle;
create policy baustelle_lesen on baustelle for select
  using (
    betrieb_id = mein_betrieb()
    and (ist_leitung() or darf_preise() or exists (
      select 1 from baustelle_crew c
      where c.baustelle_id = baustelle.id and c.profil_id = mein_profil()))
  );

-- ── Testpreise, damit sofort etwas zu sehen ist ──────────────
insert into lv_preis (position_id, betrieb_id, ep)
select p.id, p.betrieb_id,
       case p.eh when 'm' then 12.40 when 'St' then 189.00 when 'Std' then 62.50 else 25.00 end
from lv_position p
on conflict (position_id) do nothing;

insert into artikel_preis (artikel_id, betrieb_id, ek, vk)
select a.id, a.betrieb_id,
       case a.eh when 'm' then 2.35 else 41.80 end,
       case a.eh when 'm' then 3.90 else 68.00 end
from artikel a
on conflict (artikel_id) do nothing;

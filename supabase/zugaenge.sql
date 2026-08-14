-- ═══════════════════════════════════════════════════════════════
-- Zugänge für die drei Rollen zuordnen.
--
-- VORHER im Dashboard anlegen (Authentication → Users → Add user,
-- „Auto Confirm User" einschalten, Passwort selbst wählen):
--
--   leitung@flux.de         Leitung — sieht und darf alles
--   buchhaltung@flux.de     Buchhalterin — Preise, aber keine Rechte
--   monteur@flux.de         Monteur (bekommt Alins Profil)
--
-- Dieses Skript verbindet die Konten mit den Profilen. Es legt keine
-- Anmeldekonten an — das geht nur im Dashboard, weil Supabase
-- Bestätigungsmails verlangt.
--
-- Mehrfach ausführbar. Ältere Adressen (…@waro.de, das private
-- Googlemail-Konto der Leitung) werden mit umgehängt, falls noch
-- vorhanden — niemand verliert dadurch seinen Zugang.
-- ═══════════════════════════════════════════════════════════════

do $$
declare
  b        uuid;
  u_leit   uuid;
  u_buch   uuid;
  u_mont   uuid;
  p        uuid;
begin
  select id into b from betrieb limit 1;
  if b is null then raise exception 'Kein Betrieb — zuerst ersteinrichtung.sql.'; end if;

  select id into u_leit from auth.users where lower(email) = 'leitung@flux.de';
  select id into u_buch from auth.users where lower(email) = 'buchhaltung@flux.de';
  select id into u_mont from auth.users where lower(email) = 'monteur@flux.de';

  -- ── Leitung ───────────────────────────────────────────────────
  -- Es darf immer nur ein Profil an einem Konto hängen, deshalb
  -- zuerst das vorhandene Leitungsprofil suchen statt blind anlegen.
  if u_leit is not null then
    select id into p from profil where auth_id = u_leit;
    if p is null then select id into p from profil where zugang = 'Leitung' order by name limit 1; end if;
    if p is null then
      insert into profil (betrieb_id, auth_id, name, kurz, rolle, zugang)
      values (b, u_leit, 'Daniil Gorlov', 'DG', 'Meister', 'Leitung');
      raise notice 'Leitung angelegt und verbunden.';
    else
      update profil set auth_id = u_leit, zugang = 'Leitung' where id = p;
      raise notice 'Leitung verbunden.';
    end if;
  else
    raise notice 'Kein Konto leitung@flux.de gefunden — im Dashboard anlegen.';
  end if;

  -- ── Buchhaltung ───────────────────────────────────────────────
  if u_buch is not null then
    select id into p from profil where auth_id = u_buch;
    if p is null then select id into p from profil where kurz = 'MB'; end if;
    if p is null then
      insert into profil (betrieb_id, auth_id, name, kurz, rolle, zugang)
      values (b, u_buch, 'Marie Buchholz', 'MB', 'KFM', 'Buchhalter');
      raise notice 'Buchhaltung angelegt und verbunden.';
    else
      update profil set auth_id = u_buch, zugang = 'Buchhalter' where id = p;
      raise notice 'Buchhaltung verbunden.';
    end if;
  else
    raise notice 'Kein Konto buchhaltung@flux.de gefunden — im Dashboard anlegen.';
  end if;

  -- ── Monteur: bekommt Alins vorhandenes Profil ─────────────────
  if u_mont is not null then
    select id into p from profil where auth_id = u_mont;
    if p is null then select id into p from profil where kurz = 'AB'; end if;
    if p is not null then
      update profil set auth_id = u_mont, zugang = 'Monteur' where id = p;
      raise notice 'monteur@flux.de ist jetzt Monteur.';
    else
      raise notice 'Kein Monteursprofil gefunden — zuerst ersteinrichtung.sql.';
    end if;
  else
    raise notice 'Kein Konto monteur@flux.de gefunden — im Dashboard anlegen.';
  end if;
end $$;

-- Gegenprobe: wer kann sich anmelden, und als was?
select p.name, p.kurz, p.zugang, u.email,
       case when p.auth_id is null then 'kein Zugang' else 'Zugang vorhanden' end as anmeldung
from profil p
left join auth.users u on u.id = p.auth_id
order by p.zugang, p.name;

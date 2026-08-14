-- ═══════════════════════════════════════════════════════════════
-- Zugänge für die drei Rollen zuordnen.
--
-- VORHER im Dashboard anlegen (Authentication → Users → Add user,
-- „Auto Confirm User" einschalten, Passwort selbst wählen):
--
--   buchhaltung@waro.de     wird Buchhalterin
--   monteur@waro.de         wird Monteur (bekommt Alins Profil)
--
-- Dieses Skript verbindet die Konten mit den Profilen. Es legt keine
-- Anmeldekonten an — das geht nur im Dashboard, weil Supabase
-- Bestätigungsmails verlangt.
--
-- Mehrfach ausführbar.
-- ═══════════════════════════════════════════════════════════════

do $$
declare
  b uuid;
  u_buch uuid;
  u_mont uuid;
  p_buch uuid;
begin
  select id into b from betrieb limit 1;
  if b is null then raise exception 'Kein Betrieb — zuerst ersteinrichtung.sql.'; end if;

  select id into u_buch from auth.users where lower(email) = 'buchhaltung@waro.de';
  select id into u_mont from auth.users where lower(email) = 'monteur@waro.de';

  -- ── Buchhaltung: eigenes Profil, falls noch keines da ──
  if u_buch is not null then
    select id into p_buch from profil where auth_id = u_buch;
    if p_buch is null then
      select id into p_buch from profil where kurz = 'MB';
    end if;
    if p_buch is null then
      insert into profil (betrieb_id, auth_id, name, kurz, rolle, zugang)
      values (b, u_buch, 'Marie Buchholz', 'MB', 'KFM', 'Buchhalter');
      raise notice 'Buchhaltung angelegt und verbunden.';
    else
      update profil set auth_id = u_buch, zugang = 'Buchhalter' where id = p_buch;
      raise notice 'Buchhaltung verbunden.';
    end if;
  else
    raise notice 'Kein Konto buchhaltung@waro.de gefunden — im Dashboard anlegen.';
  end if;

  -- ── Monteur: bekommt Alins vorhandenes Profil ──
  if u_mont is not null then
    update profil set auth_id = u_mont where kurz = 'AB';
    raise notice 'monteur@waro.de ist jetzt Alin Borzasi (Monteur).';
  else
    raise notice 'Kein Konto monteur@waro.de gefunden — im Dashboard anlegen.';
  end if;
end $$;

-- Gegenprobe
select p.name, p.kurz, p.zugang,
       case when p.auth_id is null then 'kein Zugang' else 'Zugang vorhanden' end as anmeldung
from profil p order by p.zugang, p.name;

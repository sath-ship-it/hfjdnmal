-- ═══════════════════════════════════════════════════════════════
-- Ersteinrichtung — EINMALIG nach 0001_grundgeruest.sql ausführen.
--
-- Warum das nicht die App kann: Die Regel profil_pflegen verlangt, dass
-- der Ausführende bereits "Leitung" ist. Solange es niemanden gibt, kann
-- also auch niemand den Ersten anlegen — Henne und Ei. Im SQL-Editor
-- läuft das hier mit vollen Rechten und durchbricht den Kreis genau
-- einmal.
--
-- VORHER: das Anmeldekonto anlegen unter
--         Authentication → Users → Add user
--         (E-Mail + Passwort, "Auto Confirm User" einschalten)
-- ═══════════════════════════════════════════════════════════════

do $$
declare
  -- ↓↓↓ ANPASSEN: die E-Mail, mit der du dich eben angelegt hast
  v_email      text := 'HIER@DEINE-MAIL.DE';
  v_betrieb_nm text := 'WARO';
  v_name       text := 'Daniil Gorlov';
  v_kurz       text := 'DG';
  -- ↑↑↑

  v_user    uuid;
  v_betrieb uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(v_email);

  if v_user is null then
    raise exception
      'Kein Anmeldekonto für "%" gefunden. Erst unter Authentication → Users anlegen.',
      v_email;
  end if;

  if exists (select 1 from profil where id = v_user) then
    raise exception 'Für "%" gibt es bereits ein Profil — Ersteinrichtung schon gelaufen.', v_email;
  end if;

  insert into betrieb (name) values (v_betrieb_nm) returning id into v_betrieb;

  insert into profil (id, betrieb_id, name, kurz, rolle, zugang)
  values (v_user, v_betrieb, v_name, v_kurz, 'ME', 'Leitung');

  raise notice 'Fertig. Betrieb "%" angelegt, % ist Leitung.', v_betrieb_nm, v_email;
end $$;

-- Gegenprobe: sollte genau eine Zeile zeigen
select p.name, p.zugang, b.name as betrieb
from profil p join betrieb b on b.id = p.betrieb_id;

-- ═══════════════════════════════════════════════════════════════
-- Pause stempeln.
--
-- Eine Pause ist keine Arbeitszeit, aber sie gehört auf den
-- Stundenzettel: Wer um 12:00 rausgeht und um 12:30 zurückkommt, hat
-- nicht durchgearbeitet. Bisher lief die Uhr einfach weiter, und wer
-- ehrlich sein wollte, musste ausstempeln und neu einstempeln — und
-- verlor dabei die Spur, dass es eine Pause war.
--
-- Umgesetzt als Art der Stempelung, nicht als eigene Tabelle. Eine
-- Pause verhält sich genau wie ein Arbeitsblock: sie hat Anfang, Ende
-- und eine Baustelle. Nur zählt sie nicht als Arbeit.
--
-- Damit gilt weiterhin der Index zeit_eine_laufende: es läuft immer
-- höchstens EINE Stempelung je Person. Pause beginnen heisst, den
-- Arbeitsblock zu beenden und einen Pausenblock zu öffnen.
--
-- Nach 0005 ausführen. Mehrfach ausführbar.
-- ═══════════════════════════════════════════════════════════════

alter table zeit add column if not exists art text not null default 'Arbeit';

do $$
begin
  alter table zeit add constraint zeit_art_bekannt
    check (art in ('Arbeit', 'Pause'));
exception when duplicate_object then
  raise notice 'zeit_art_bekannt gibt es schon.';
end $$;

-- Gegenprobe: alles Bestehende ist Arbeit, sonst nichts.
select art, count(*) from zeit group by art;

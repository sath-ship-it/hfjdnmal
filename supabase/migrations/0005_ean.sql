-- ═══════════════════════════════════════════════════════════════
-- Strichcode am Artikel.
--
-- Der Scanner im Anforderungs-Bildschirm hatte bis jetzt nichts, wogegen
-- er hätte prüfen können. Ein gescannter Code ist nur dann etwas wert,
-- wenn am Artikel steht, welcher es ist.
--
-- EAN-13 und EAN-8 sind reine Ziffernfolgen. Wir prüfen nur die Länge,
-- nicht die Prüfziffer: Manche Großhändler kleben eigene Codes, und ein
-- Monteur soll nicht daran scheitern, dass sein Lieferant sich nicht an
-- die Norm hält.
--
-- Eindeutig je Betrieb: zwei Artikel mit demselben Code liessen sich
-- beim Scannen nicht auseinanderhalten.
--
-- Nach 0004 ausführen. Mehrfach ausführbar.
-- ═══════════════════════════════════════════════════════════════

alter table artikel add column if not exists ean text;

do $$
begin
  alter table artikel add constraint artikel_ean_ziffern
    check (ean is null or ean ~ '^[0-9]{8,14}$');
exception when duplicate_object then
  raise notice 'artikel_ean_ziffern gibt es schon.';
end $$;

create unique index if not exists artikel_ean_je_betrieb
  on artikel (betrieb_id, ean) where ean is not null;

-- Ein paar Testartikel bekommen einen Code, damit sich das Scannen
-- ausprobieren lässt, ohne erst Daten zu pflegen. Die Nummern sind
-- frei erfunden und gehören keinem echten Erzeugnis.
update artikel set ean = '4001234500017' where ean is null and txt ilike 'NYM-J 3x1,5%';
update artikel set ean = '4001234500024' where ean is null and txt ilike 'NYM-J 5x2,5%';

select txt, eh, ean from artikel order by txt;

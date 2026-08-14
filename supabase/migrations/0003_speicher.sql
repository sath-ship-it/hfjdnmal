-- ═══════════════════════════════════════════════════════════════
-- Dateispeicher für Baustellenfotos und Unterschriften.
--
-- Getrennt von 0002, weil das Schema "storage" nur bei Supabase
-- existiert — so bleibt 0002 gegen ein einfaches Postgres prüfbar.
--
-- Ablage: <betrieb_id>/<baustelle_id>/<datei>
-- Der erste Ordner ist die Betriebsnummer, und genau daran hängt die
-- Rechteregel: Ein fremder Betrieb kommt an keine Datei.
-- ═══════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'baustelle', 'baustelle',
  false,                                   -- nicht öffentlich: Kundenfotos
  10485760,                                -- 10 MB je Datei
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public             = excluded.public;

drop policy if exists "baustelle_fotos_lesen"    on storage.objects;
drop policy if exists "baustelle_fotos_schreiben" on storage.objects;

create policy "baustelle_fotos_lesen" on storage.objects for select
  using (
    bucket_id = 'baustelle'
    and (storage.foldername(name))[1] = mein_betrieb()::text
  );

create policy "baustelle_fotos_schreiben" on storage.objects for insert
  with check (
    bucket_id = 'baustelle'
    and (storage.foldername(name))[1] = mein_betrieb()::text
  );

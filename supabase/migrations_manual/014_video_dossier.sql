-- Ejecutar una sola vez en el SQL Editor de Supabase.
-- Guarda los vídeos promocionales generados por dossier, igual que ya se
-- hace con pdf_url/pdf_versions: video_url apunta siempre al más reciente,
-- video_versions guarda el historial completo.

alter table dossiers add column video_url text;
alter table dossiers add column video_versions jsonb default '[]';
-- Cada elemento: {"version": 1, "url": "...", "created_at": "..."}

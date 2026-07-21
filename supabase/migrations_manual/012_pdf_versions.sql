-- Ejecutar una sola vez en el SQL Editor de Supabase.
-- Guarda el historial de PDFs generados por dossier, para poder ver
-- versiones anteriores en vez de que cada generación nueva sobrescriba la
-- última (pdf_url sigue apuntando siempre a la más reciente, por compatibilidad).

alter table dossiers add column pdf_versions jsonb default '[]';
-- Cada elemento: {"version": 1, "url": "...", "created_at": "..."}

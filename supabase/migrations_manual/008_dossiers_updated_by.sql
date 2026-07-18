-- Ejecutar una sola vez en el SQL Editor de Supabase.
-- Arregla el guardado de dossiers: la tabla no tenía la columna "updated_by"
-- que el trigger set_updated_meta() (compartido con "leads") necesita.

alter table dossiers add column updated_by uuid references auth.users(id);

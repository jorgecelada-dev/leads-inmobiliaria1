-- Ejecutar una sola vez en el SQL Editor de Supabase.
-- Falta el permiso de lectura (SELECT) para autenticados sobre el bucket
-- "dossiers": Supabase Storage lo necesita internamente al subir un archivo
-- (comprueba si ya existe), aunque el INSERT ya estuviera permitido.

create policy "Authenticated can read dossiers bucket objects"
on storage.objects for select
to authenticated
using (bucket_id = 'dossiers');

create policy "Authenticated can delete dossiers bucket objects"
on storage.objects for delete
to authenticated
using (bucket_id = 'dossiers');

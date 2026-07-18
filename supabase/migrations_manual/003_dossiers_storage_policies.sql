-- Ejecutar una sola vez en el SQL Editor de Supabase.
-- Permite a los trabajadores autenticados subir/actualizar archivos en el
-- bucket "dossiers" (la lectura pública ya la da el bucket marcado como Public).

create policy "Authenticated can upload to dossiers bucket"
on storage.objects for insert
to authenticated
with check (bucket_id = 'dossiers');

create policy "Authenticated can update dossiers bucket objects"
on storage.objects for update
to authenticated
using (bucket_id = 'dossiers')
with check (bucket_id = 'dossiers');

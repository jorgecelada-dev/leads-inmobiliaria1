-- Ejecutar una sola vez en el SQL Editor de Supabase.
-- Permite borrar leads desde el panel (antes solo se podía insertar/leer/editar).

create policy "Authenticated can delete leads" on leads for delete to authenticated using (true);

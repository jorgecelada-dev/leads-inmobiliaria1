-- Ejecutar una sola vez en el SQL Editor de Supabase.
-- Abre una parte pública de la web (inmuebles publicados + registro de
-- clientes con favoritos) sin dar acceso al CRM interno a esos clientes.

-- ============================================================
-- 1. Distinguir trabajadores de clientes públicos
-- ============================================================
alter table profiles add column is_staff boolean default false;
alter table profiles add column marketing_opt_in boolean default false;

-- IMPORTANTE: marca aquí manualmente a tus trabajadores actuales como staff.
-- Sustituye los emails por los reales de tu equipo antes de ejecutar esta línea,
-- o ejecútala aparte después de ver quién aparece en auth.users:
-- update profiles set is_staff = true where id in (
--   select id from auth.users where email in ('jorgeceladaa2@gmail.com')
-- );

create or replace function public.is_staff()
returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and is_staff = true
  );
$$ language sql security definer stable;

-- ============================================================
-- 2. Reescribir las políticas "cualquier autenticado" -> "solo staff"
-- ============================================================
drop policy "Authenticated can read leads" on leads;
drop policy "Authenticated can update leads" on leads;
drop policy "Authenticated can delete leads" on leads;
create policy "Staff can read leads" on leads for select to authenticated using (is_staff());
create policy "Staff can update leads" on leads for update to authenticated using (is_staff()) with check (is_staff());
create policy "Staff can delete leads" on leads for delete to authenticated using (is_staff());

drop policy "Authenticated can manage dossiers" on dossiers;
create policy "Staff can manage dossiers" on dossiers for all to authenticated using (is_staff()) with check (is_staff());

drop policy "Authenticated can manage dossier_sends" on dossier_sends;
create policy "Staff can manage dossier_sends" on dossier_sends for all to authenticated using (is_staff()) with check (is_staff());

drop policy "Authenticated can manage dossier_leads" on dossier_leads;
create policy "Staff can manage dossier_leads" on dossier_leads for all to authenticated using (is_staff()) with check (is_staff());

drop policy "Authenticated can manage dossier_documents" on dossier_documents;
create policy "Staff can manage dossier_documents" on dossier_documents for all to authenticated using (is_staff()) with check (is_staff());

drop policy "Authenticated can manage email_log" on email_log;
create policy "Staff can manage email_log" on email_log for all to authenticated using (is_staff()) with check (is_staff());

drop policy "Authenticated can read profiles" on profiles;
create policy "Staff can read all profiles" on profiles for select to authenticated using (is_staff() or auth.uid() = id);
-- (los clientes públicos solo pueden ver su propio perfil, no los de otros)

-- Storage de dossiers: solo staff puede subir/editar/borrar archivos
drop policy "Authenticated can upload to dossiers bucket" on storage.objects;
drop policy "Authenticated can update dossiers bucket objects" on storage.objects;
drop policy "Authenticated can read dossiers bucket objects" on storage.objects;
drop policy "Authenticated can delete dossiers bucket objects" on storage.objects;
create policy "Staff can upload to dossiers bucket" on storage.objects for insert to authenticated with check (bucket_id = 'dossiers' and is_staff());
create policy "Staff can update dossiers bucket objects" on storage.objects for update to authenticated using (bucket_id = 'dossiers' and is_staff()) with check (bucket_id = 'dossiers' and is_staff());
create policy "Staff can delete dossiers bucket objects" on storage.objects for delete to authenticated using (bucket_id = 'dossiers' and is_staff());
-- (la lectura de archivos ya es pública porque el bucket está marcado "Public")

-- ============================================================
-- 3. Inmuebles publicables en la web pública
-- ============================================================
alter table dossiers add column published boolean default false;
create policy "Public can read published dossiers" on dossiers for select to anon, authenticated using (published = true);

-- ============================================================
-- 4. Favoritos de clientes públicos
-- ============================================================
create table favorites (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_id uuid references auth.users(id) on delete cascade,
  dossier_id uuid references dossiers(id) on delete cascade,
  unique (user_id, dossier_id)
);
alter table favorites enable row level security;
create policy "Users can manage own favorites" on favorites for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

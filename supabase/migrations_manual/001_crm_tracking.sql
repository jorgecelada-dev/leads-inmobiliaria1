-- Ejecutar una sola vez en el SQL Editor de Supabase.
-- Añade seguimiento de quién edita cada lead + tabla de perfiles de trabajadores.

-- 1. Columnas de seguimiento en leads
alter table leads
  add column updated_at timestamptz,
  add column updated_by uuid references auth.users(id);

-- 2. Trigger: rellena updated_at/updated_by automáticamente en cada UPDATE
create or replace function public.set_lead_updated_meta()
returns trigger as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$ language plpgsql;

create trigger trg_leads_set_updated_meta
before update on leads
for each row execute function public.set_lead_updated_meta();

-- 3. Tabla de perfiles (nombre visible de cada trabajador)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text
);
alter table profiles enable row level security;
create policy "Authenticated can read profiles" on profiles for select to authenticated using (true);
create policy "Users can update own profile" on profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- 4. Trigger: crea el perfil automáticamente al dar de alta un trabajador nuevo
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 5. Backfill: crea tu propio perfil (tu cuenta ya existía antes del trigger)
insert into public.profiles (id, full_name)
select id, email from auth.users
where id not in (select id from public.profiles);

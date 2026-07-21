create table leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  full_name text not null,
  email text not null,
  phone text,
  country text not null,
  owns_property_spain boolean not null,
  properties_count int,
  budget_range text not null,
  region_interest text not null,
  timeframe text not null,
  form_language text,
  source text default 'landing-v1',
  status text default 'new',
  notes text,
  updated_at timestamptz,
  updated_by uuid references auth.users(id),
  marketing_opt_in boolean default false
);
alter table leads enable row level security;
create policy "Allow public inserts" on leads for insert to anon with check (true);
create policy "Authenticated can read leads" on leads for select to authenticated using (true);
create policy "Authenticated can update leads" on leads for update to authenticated using (true) with check (true);
create policy "Authenticated can delete leads" on leads for delete to authenticated using (true);

-- updated_at/updated_by se rellenan solos en cada UPDATE (no los toca el cliente)
-- Función genérica: la reutilizan tanto "leads" como "dossiers"
create or replace function public.set_updated_meta()
returns trigger as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$ language plpgsql;

create trigger trg_leads_set_updated_meta
before update on leads
for each row execute function public.set_updated_meta();

-- Perfiles de trabajadores del panel privado (nombre visible en "última edición")
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text
);
alter table profiles enable row level security;
create policy "Authenticated can read profiles" on profiles for select to authenticated using (true);
create policy "Users can update own profile" on profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Crea el perfil automáticamente al dar de alta un trabajador nuevo en Supabase Auth
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

-- Dossiers de inmuebles (se adjuntan/envían por email a los leads)
create table dossiers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz,
  updated_by uuid references auth.users(id),
  created_by uuid references auth.users(id),
  title text not null,
  address text,
  region text,
  price numeric,
  surface_m2 numeric,
  bedrooms int,
  bathrooms int,
  energy_rating text,
  community_fees numeric,
  ibi numeric,
  description text,
  area_info text,
  cover_image_url text,
  floor_plan_url text,
  gallery_urls text[],
  pdf_url text,
  sale_status text default 'available',
  -- Valores esperados: available, reserved, negotiating, sold, withdrawn
  points_of_interest jsonb default '[]',
  gallery jsonb default '[]',
  lat numeric,
  lng numeric,
  build_year int,
  renovation_year int,
  orientation text,
  -- Valores esperados de orientation: norte, sur, este, oeste, noreste, noroeste, sureste, suroeste
  garage_spaces int,
  storage_room boolean default false,
  furnished text,
  -- Valores esperados de furnished: si, no, parcial
  cadastral_reference text,
  legal_status text,
  annual_insurance_estimate numeric,
  pdf_versions jsonb default '[]'
  -- Cada elemento: {"version": 1, "url": "...", "created_at": "..."}
);
alter table dossiers enable row level security;
create policy "Authenticated can manage dossiers" on dossiers for all to authenticated using (true) with check (true);

create trigger trg_dossiers_set_updated_meta
before update on dossiers
for each row execute function public.set_updated_meta();

-- Registro de qué dossier se ha enviado a qué lead y cuándo
create table dossier_sends (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  dossier_id uuid references dossiers(id) on delete cascade,
  lead_id uuid references leads(id) on delete cascade,
  sent_by uuid references auth.users(id)
);
alter table dossier_sends enable row level security;
create policy "Authenticated can manage dossier_sends" on dossier_sends for all to authenticated using (true) with check (true);

-- Leads interesados en un inmueble concreto (independiente de si se les envió el dossier)
create table dossier_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  dossier_id uuid references dossiers(id) on delete cascade,
  lead_id uuid references leads(id) on delete cascade,
  notes text,
  unique (dossier_id, lead_id)
);
alter table dossier_leads enable row level security;
create policy "Authenticated can manage dossier_leads" on dossier_leads for all to authenticated using (true) with check (true);

-- Documentos relevantes del inmueble (escrituras, notas simples, etc.)
create table dossier_documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  dossier_id uuid references dossiers(id) on delete cascade,
  name text not null,
  file_url text not null,
  uploaded_by uuid references auth.users(id)
);
alter table dossier_documents enable row level security;
create policy "Authenticated can manage dossier_documents" on dossier_documents for all to authenticated using (true) with check (true);

-- Registro de emails enviados a cada lead (bienvenida automática + campañas manuales)
create table email_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  lead_id uuid references leads(id) on delete cascade,
  subject text,
  sent_by uuid references auth.users(id)
);
alter table email_log enable row level security;
create policy "Authenticated can manage email_log" on email_log for all to authenticated using (true) with check (true);

-- Storage: requiere crear manualmente el bucket "dossiers" (Public) desde el
-- dashboard (Storage > New bucket). La lectura pública la da el propio bucket;
-- estas políticas habilitan la subida/edición de archivos para trabajadores.
create policy "Authenticated can upload to dossiers bucket"
on storage.objects for insert
to authenticated
with check (bucket_id = 'dossiers');

create policy "Authenticated can update dossiers bucket objects"
on storage.objects for update
to authenticated
using (bucket_id = 'dossiers')
with check (bucket_id = 'dossiers');

create policy "Authenticated can read dossiers bucket objects"
on storage.objects for select
to authenticated
using (bucket_id = 'dossiers');

create policy "Authenticated can delete dossiers bucket objects"
on storage.objects for delete
to authenticated
using (bucket_id = 'dossiers');

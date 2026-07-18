-- Ejecutar una sola vez en el SQL Editor de Supabase.
-- Añade el sistema de dossiers de inmuebles + registro de envíos a leads.

-- Renombramos la función de tracking (antes solo se usaba en "leads", ahora también en "dossiers")
alter function public.set_lead_updated_meta() rename to set_updated_meta;

create table dossiers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz,
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
  pdf_url text
);
alter table dossiers enable row level security;
create policy "Authenticated can manage dossiers" on dossiers for all to authenticated using (true) with check (true);

-- updated_at se rellena solo, igual que en leads
create trigger trg_dossiers_set_updated_meta
before update on dossiers
for each row execute function public.set_updated_meta();

-- Registro de qué dossier se ha enviado a qué lead y cuándo (evita reenvíos duplicados sin querer)
create table dossier_sends (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  dossier_id uuid references dossiers(id) on delete cascade,
  lead_id uuid references leads(id) on delete cascade,
  sent_by uuid references auth.users(id)
);
alter table dossier_sends enable row level security;
create policy "Authenticated can manage dossier_sends" on dossier_sends for all to authenticated using (true) with check (true);

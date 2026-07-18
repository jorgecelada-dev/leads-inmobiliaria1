-- Ejecutar una sola vez en el SQL Editor de Supabase.
-- Añade el seguimiento de inmuebles: estado de venta, leads interesados y documentos.

-- 1. Estado de venta del inmueble
alter table dossiers add column sale_status text default 'available';
-- Valores esperados: available (Disponible), reserved (Reservado),
-- negotiating (En negociación), sold (Vendido), withdrawn (Retirado)

-- 2. Leads interesados en un inmueble concreto (independiente de si se les envió el dossier)
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

-- 3. Documentos relevantes del inmueble (escrituras, notas simples, etc.)
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

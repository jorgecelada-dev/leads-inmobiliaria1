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
  notes text
);
alter table leads enable row level security;
create policy "Allow public inserts" on leads for insert to anon with check (true);
create policy "Authenticated can read leads" on leads for select to authenticated using (true);
create policy "Authenticated can update leads" on leads for update to authenticated using (true) with check (true);

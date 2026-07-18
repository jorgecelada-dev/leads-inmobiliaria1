-- Ejecutar una sola vez en el SQL Editor de Supabase.
-- Añade el interruptor de suscripción a marketing y el registro de emails enviados.

-- 1. Interruptor manual: solo los leads marcados aquí reciben campañas
alter table leads add column marketing_opt_in boolean default false;

-- 2. Registro de emails enviados a cada lead (tanto el automático de bienvenida
-- como los de campañas manuales), para poder ver "último email enviado"
create table email_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  lead_id uuid references leads(id) on delete cascade,
  subject text,
  sent_by uuid references auth.users(id)
  -- sent_by queda null cuando el envío es automático (email de bienvenida)
);
alter table email_log enable row level security;
create policy "Authenticated can manage email_log" on email_log for all to authenticated using (true) with check (true);

-- Ejecutar una sola vez en el SQL Editor de Supabase.
-- Fase 1 de datos "de inversor" en el dossier: año de construcción/reforma,
-- orientación, garaje, trastero, amueblado, referencia catastral, situación
-- legal y seguro estimado (para calcular el gasto anual total).

alter table dossiers add column build_year int;
alter table dossiers add column renovation_year int;
alter table dossiers add column orientation text;
-- Valores esperados de orientation: norte, sur, este, oeste, noreste, noroeste, sureste, suroeste
alter table dossiers add column garage_spaces int;
alter table dossiers add column storage_room boolean default false;
alter table dossiers add column furnished text;
-- Valores esperados de furnished: si, no, parcial
alter table dossiers add column cadastral_reference text;
alter table dossiers add column legal_status text;
alter table dossiers add column annual_insurance_estimate numeric;

-- Ejecutar una sola vez en el SQL Editor de Supabase.
-- Añade si la vivienda tiene piscina propia, y un alquiler mensual estimado
-- (referencia manual del agente) para calcular la rentabilidad bruta anual
-- en la sección "Radiografía de la inversión" del PDF.

alter table dossiers add column has_pool boolean default false;
alter table dossiers add column estimated_monthly_rent numeric;

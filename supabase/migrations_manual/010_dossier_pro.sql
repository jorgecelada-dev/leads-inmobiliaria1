-- Ejecutar una sola vez en el SQL Editor de Supabase.
-- Mejora el dossier: puntos de interés estructurados (con icono), pies de
-- foto en la galería, y coordenadas para el mapa de ubicación.

-- Puntos de interés: array de objetos {"category":"airport","detail":"15 min"}
alter table dossiers add column points_of_interest jsonb default '[]';

-- Galería con pie de foto: array de objetos {"url":"...","caption":"..."}
-- (sustituye en la práctica a gallery_urls, que se deja sin usar por si acaso)
alter table dossiers add column gallery jsonb default '[]';

-- Coordenadas geocodificadas de la dirección, para pintar el mapa sin tener
-- que volver a geocodificar cada vez que se abre el dossier
alter table dossiers add column lat numeric;
alter table dossiers add column lng numeric;

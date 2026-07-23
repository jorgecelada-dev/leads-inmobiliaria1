-- Ejecutar una sola vez en el SQL Editor de Supabase.
-- Casilla manual del checklist de Seguimiento ("DOSSIER / VIDEOS / E-MAIL"):
-- de momento no existe el compositor de emails de marketing (dossier +
-- vídeo + mensaje + firma), así que este campo se marca a mano mientras
-- tanto. Cuando exista ese compositor, podrá pasar a marcarse solo.

alter table dossiers add column marketing_email_ready boolean not null default false;

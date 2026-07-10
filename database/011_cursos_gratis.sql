-- Marca de cursos gratuitos para el catalogo publico.
-- Ejecutar una vez en Supabase SQL Editor.

alter table public.cursos
  add column if not exists es_gratis boolean not null default false;

update public.cursos
set es_gratis = false
where es_gratis is null;

notify pgrst, 'reload schema';

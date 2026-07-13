-- Ejecutar una vez en Supabase SQL Editor.
-- Permite exigir cambio de clave en el primer inicio de usuarios creados desde cursos gratis.

alter table public.usuarios
  add column if not exists requiere_cambio_password boolean not null default false;

notify pgrst, 'reload schema';

-- Agrega celular para registros publicos de cursos gratis.
-- Ejecutar una vez en Supabase SQL Editor.

alter table public.usuarios
  add column if not exists "Celular" text;

notify pgrst, 'reload schema';

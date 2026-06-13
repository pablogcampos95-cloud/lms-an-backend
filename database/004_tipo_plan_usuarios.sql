-- Agrega el tipo de plan a usuarios existentes y nuevos.
-- Ejecutar una vez en Supabase SQL Editor.

alter table public.usuarios
  add column if not exists tipo_plan text not null default 'Gratuito';

update public.usuarios
set tipo_plan = 'Gratuito'
where tipo_plan is null or tipo_plan not in ('Gratuito', 'Pagado');

alter table public.usuarios
  drop constraint if exists usuarios_tipo_plan_check;

alter table public.usuarios
  add constraint usuarios_tipo_plan_check
  check (tipo_plan in ('Gratuito', 'Pagado'));

notify pgrst, 'reload schema';

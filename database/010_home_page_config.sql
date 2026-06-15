-- Configuracion editable de la pagina inicial publica del LMS.
-- Ejecutar una vez en Supabase SQL Editor.

create table if not exists public.home_page_config (
  id text primary key default 'principal',
  config jsonb not null default '{}'::jsonb,
  published_config jsonb,
  updated_by bigint references public.usuarios(id) on delete set null,
  updated_at timestamptz not null default now(),
  published_by bigint references public.usuarios(id) on delete set null,
  published_at timestamptz
);

insert into public.home_page_config (id, config, published_config)
values ('principal', '{}'::jsonb, null)
on conflict (id) do nothing;

notify pgrst, 'reload schema';

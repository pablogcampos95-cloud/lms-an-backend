-- Campos simplificados para cursos y plantillas de certificados.
-- Ejecutar una vez en Supabase SQL Editor.

alter table public.cursos
  add column if not exists modulos_planificados integer not null default 0,
  add column if not exists pasos_planificados integer not null default 0;

create table if not exists public.certificado_plantillas (
  id bigserial primary key,
  nombre text not null,
  descripcion text,
  curso_id bigint references public.cursos(id) on delete set null,
  titulo text not null,
  subtitulo text,
  cuerpo text,
  firma_nombre text,
  firma_cargo text,
  color_principal text not null default '#00d8ff',
  fondo_url text,
  activo boolean not null default true,
  creado_por bigint references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists certificado_plantillas_curso_idx
  on public.certificado_plantillas(curso_id);

create index if not exists certificado_plantillas_activo_idx
  on public.certificado_plantillas(activo);

notify pgrst, 'reload schema';

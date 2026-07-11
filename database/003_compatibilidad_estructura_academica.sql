-- Compatibilidad para proyectos que ya tenian tablas cursos/modulos/lecciones.
-- No elimina registros existentes. Ejecutar en Supabase SQL Editor.

create table if not exists public.cursos (id bigserial primary key);
alter table public.cursos
  add column if not exists nombre text,
  add column if not exists descripcion_corta text,
  add column if not exists descripcion_completa text,
  add column if not exists imagen_portada_url text,
  add column if not exists categoria text,
  add column if not exists campana_area text,
  add column if not exists duracion_estimada_min integer default 0,
  add column if not exists modulos_planificados integer default 0,
  add column if not exists pasos_planificados integer default 0,
  add column if not exists es_gratis boolean not null default false,
  add column if not exists estado text default 'Borrador',
  add column if not exists creado_por bigint,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create table if not exists public.modulos (id bigserial primary key);
alter table public.modulos
  add column if not exists curso_id bigint,
  add column if not exists nombre text,
  add column if not exists descripcion text,
  add column if not exists orden integer default 1,
  add column if not exists estado text default 'Borrador',
  add column if not exists duracion_estimada_min integer default 0,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create table if not exists public.lecciones (id bigserial primary key);
alter table public.lecciones
  add column if not exists modulo_id bigint,
  add column if not exists titulo text,
  add column if not exists descripcion text,
  add column if not exists tipo_contenido text default 'Texto',
  add column if not exists contenido_texto text,
  add column if not exists contenido_html text,
  add column if not exists url_externa text,
  add column if not exists tipo_url text,
  add column if not exists abrir_nueva_pestana boolean default true,
  add column if not exists mostrar_embebido boolean default false,
  add column if not exists orden integer default 1,
  add column if not exists estado text default 'Borrador',
  add column if not exists tiempo_estimado_min integer default 0,
  add column if not exists requisito_avance text default 'Libre',
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create table if not exists public.recursos (
  id bigserial primary key,
  curso_id bigint,
  modulo_id bigint,
  leccion_id bigint,
  nombre_original text,
  nombre_interno text,
  tipo_archivo text,
  tamano_bytes bigint default 0,
  url text,
  storage_path text,
  subido_por bigint,
  created_at timestamptz default now()
);

create table if not exists public.progreso_lecciones (
  id bigserial primary key,
  usuario_id bigint,
  leccion_id bigint,
  completado boolean default false,
  completado_at timestamptz,
  updated_at timestamptz default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cursos_creado_por_fkey') then
    alter table public.cursos add constraint cursos_creado_por_fkey foreign key (creado_por) references public.usuarios(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'modulos_curso_id_fkey') then
    alter table public.modulos add constraint modulos_curso_id_fkey foreign key (curso_id) references public.cursos(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lecciones_modulo_id_fkey') then
    alter table public.lecciones add constraint lecciones_modulo_id_fkey foreign key (modulo_id) references public.modulos(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'recursos_curso_id_fkey') then
    alter table public.recursos add constraint recursos_curso_id_fkey foreign key (curso_id) references public.cursos(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'recursos_modulo_id_fkey') then
    alter table public.recursos add constraint recursos_modulo_id_fkey foreign key (modulo_id) references public.modulos(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'recursos_leccion_id_fkey') then
    alter table public.recursos add constraint recursos_leccion_id_fkey foreign key (leccion_id) references public.lecciones(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'recursos_subido_por_fkey') then
    alter table public.recursos add constraint recursos_subido_por_fkey foreign key (subido_por) references public.usuarios(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'progreso_lecciones_usuario_id_fkey') then
    alter table public.progreso_lecciones add constraint progreso_lecciones_usuario_id_fkey foreign key (usuario_id) references public.usuarios(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'progreso_lecciones_leccion_id_fkey') then
    alter table public.progreso_lecciones add constraint progreso_lecciones_leccion_id_fkey foreign key (leccion_id) references public.lecciones(id) on delete cascade;
  end if;
end $$;

create index if not exists cursos_estado_idx on public.cursos(estado);
create index if not exists modulos_curso_orden_idx on public.modulos(curso_id, orden);
create index if not exists lecciones_modulo_orden_idx on public.lecciones(modulo_id, orden);
create index if not exists recursos_leccion_idx on public.recursos(leccion_id);
create unique index if not exists progreso_usuario_leccion_unique on public.progreso_lecciones(usuario_id, leccion_id);

insert into storage.buckets (id, name, public, file_size_limit)
values ('lms-recursos', 'lms-recursos', true, 52428800)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

notify pgrst, 'reload schema';

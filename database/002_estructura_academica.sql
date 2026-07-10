-- Estructura academica del LMS AN Academy.
-- Ejecutar una vez en Supabase SQL Editor.

create table if not exists public.cursos (
  id bigserial primary key,
  nombre text not null,
  descripcion_corta text,
  descripcion_completa text,
  imagen_portada_url text,
  categoria text,
  campana_area text,
  duracion_estimada_min integer not null default 0 check (duracion_estimada_min >= 0),
  es_gratis boolean not null default false,
  estado text not null default 'Borrador' check (estado in ('Borrador', 'Publicado', 'Inactivo')),
  creado_por bigint references public.usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.modulos (
  id bigserial primary key,
  curso_id bigint not null references public.cursos(id) on delete cascade,
  nombre text not null,
  descripcion text,
  orden integer not null default 1 check (orden > 0),
  estado text not null default 'Borrador' check (estado in ('Borrador', 'Publicado', 'Inactivo')),
  duracion_estimada_min integer not null default 0 check (duracion_estimada_min >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (curso_id, orden)
);

create table if not exists public.lecciones (
  id bigserial primary key,
  modulo_id bigint not null references public.modulos(id) on delete cascade,
  titulo text not null,
  descripcion text,
  tipo_contenido text not null default 'Texto' check (tipo_contenido in ('Texto', 'URL', 'HTML', 'Archivo', 'Video', 'Evaluacion')),
  contenido_texto text,
  contenido_html text,
  url_externa text,
  tipo_url text,
  abrir_nueva_pestana boolean not null default true,
  mostrar_embebido boolean not null default false,
  orden integer not null default 1 check (orden > 0),
  estado text not null default 'Borrador' check (estado in ('Borrador', 'Publicado', 'Inactivo')),
  tiempo_estimado_min integer not null default 0 check (tiempo_estimado_min >= 0),
  requisito_avance text not null default 'Libre' check (requisito_avance in ('Libre', 'Secuencial', 'Obligatorio')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (modulo_id, orden)
);

create table if not exists public.recursos (
  id bigserial primary key,
  curso_id bigint references public.cursos(id) on delete cascade,
  modulo_id bigint references public.modulos(id) on delete cascade,
  leccion_id bigint not null references public.lecciones(id) on delete cascade,
  nombre_original text not null,
  nombre_interno text not null,
  tipo_archivo text,
  tamano_bytes bigint not null default 0,
  url text not null,
  storage_path text,
  subido_por bigint references public.usuarios(id),
  created_at timestamptz not null default now()
);

create table if not exists public.progreso_lecciones (
  id bigserial primary key,
  usuario_id bigint not null references public.usuarios(id) on delete cascade,
  leccion_id bigint not null references public.lecciones(id) on delete cascade,
  completado boolean not null default false,
  completado_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (usuario_id, leccion_id)
);

create index if not exists cursos_estado_idx on public.cursos(estado);
create index if not exists modulos_curso_orden_idx on public.modulos(curso_id, orden);
create index if not exists lecciones_modulo_orden_idx on public.lecciones(modulo_id, orden);
create index if not exists recursos_leccion_idx on public.recursos(leccion_id);

insert into storage.buckets (id, name, public, file_size_limit)
values ('lms-recursos', 'lms-recursos', true, 52428800)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

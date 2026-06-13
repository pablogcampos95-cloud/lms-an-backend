-- Asignaciones de cursos y certificados del rol Estudiante.
-- Ejecutar una vez en Supabase SQL Editor.

create table if not exists public.curso_asignaciones (
  id bigserial primary key,
  usuario_id bigint not null references public.usuarios(id) on delete cascade,
  curso_id bigint not null references public.cursos(id) on delete cascade,
  asignado_por bigint references public.usuarios(id) on delete set null,
  estado text not null default 'Asignado' check (estado in ('Asignado', 'Completado', 'Cancelado')),
  assigned_at timestamptz not null default now(),
  unique (usuario_id, curso_id)
);

create table if not exists public.certificados (
  id bigserial primary key,
  usuario_id bigint not null references public.usuarios(id) on delete cascade,
  curso_id bigint not null references public.cursos(id) on delete cascade,
  codigo text not null unique,
  emitido_at timestamptz not null default now(),
  unique (usuario_id, curso_id)
);

create index if not exists curso_asignaciones_usuario_idx on public.curso_asignaciones(usuario_id);
create index if not exists certificados_usuario_idx on public.certificados(usuario_id);

notify pgrst, 'reload schema';

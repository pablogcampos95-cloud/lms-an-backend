-- LMS AN Academy - roles, autenticacion y usuario administrador inicial.
-- Ejecutar en Supabase SQL Editor.

create table if not exists public.roles (
  id bigserial primary key,
  nombre text not null unique,
  descripcion text,
  created_at timestamptz not null default now()
);

insert into public.roles (nombre, descripcion)
values
  ('Administrador', 'Acceso total al LMS AN Academy'),
  ('Analista', 'Acceso a dashboards, usuarios y reportes'),
  ('Instructor', 'Gestion de cursos, modulos, lecciones y evaluaciones'),
  ('Estudiante', 'Acceso a cursos asignados, evaluaciones y certificados')
on conflict (nombre) do update
set descripcion = excluded.descripcion;

create table if not exists public.usuarios (
  id bigserial primary key,
  "DNI" text,
  "Nombres" text,
  "Correo" text,
  "Cargo" text,
  U&"Campa\00F1a" text,
  "Supervisor" text,
  "Estado" text not null default 'Activo',
  fecha_ingreso date,
  created_at timestamptz not null default now(),
  usuario text,
  password_hash text,
  rol_id bigint references public.roles(id)
);

alter table public.usuarios
  add column if not exists usuario text,
  add column if not exists password_hash text,
  add column if not exists rol_id bigint references public.roles(id);

create unique index if not exists usuarios_usuario_unique
on public.usuarios (lower(usuario))
where usuario is not null;

create unique index if not exists usuarios_correo_unique
on public.usuarios (lower("Correo"))
where "Correo" is not null;

insert into public.usuarios (
  "DNI",
  "Nombres",
  "Correo",
  "Cargo",
  U&"Campa\00F1a",
  "Supervisor",
  "Estado",
  fecha_ingreso,
  usuario,
  password_hash,
  rol_id
)
values (
  '00000000',
  'Administrador',
  'admin@anacademy.local',
  'Administrador',
  'AN Academy',
  null,
  'Activo',
  current_date,
  'Admin',
  '$2b$10$iBk4IBPYOOSmU6vsK6tK3eeDxCeQBMEjBOBBpl47egBA7lWUNnftK',
  (select id from public.roles where nombre = 'Administrador')
)
on conflict ((lower(usuario))) where usuario is not null
do update set
  "Nombres" = excluded."Nombres",
  "Correo" = excluded."Correo",
  "Cargo" = excluded."Cargo",
  "Estado" = excluded."Estado",
  password_hash = excluded.password_hash,
  rol_id = excluded.rol_id;

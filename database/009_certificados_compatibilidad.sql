-- Compatibilidad para certificados del rol Estudiante.
-- Ejecutar una vez si Supabase muestra errores por columnas faltantes en certificados.

alter table public.certificados
  add column if not exists codigo text,
  add column if not exists emitido_at timestamptz not null default now();

update public.certificados
set codigo = concat(
  'IALS-',
  usuario_id,
  '-',
  curso_id,
  '-',
  upper(substr(md5(usuario_id::text || ':' || curso_id::text), 1, 8))
)
where codigo is null;

create unique index if not exists certificados_usuario_curso_unique
  on public.certificados(usuario_id, curso_id);

create unique index if not exists certificados_codigo_unique
  on public.certificados(codigo)
  where codigo is not null;

notify pgrst, 'reload schema';

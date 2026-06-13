-- Modulo incremental de evaluaciones y foros evaluables.
-- Ejecutar una vez en Supabase SQL Editor despues de 005_asignaciones_estudiante.sql.

create table if not exists public.evaluaciones (
  id bigserial primary key,
  curso_id bigint not null references public.cursos(id) on delete cascade,
  modulo_id bigint references public.modulos(id) on delete cascade,
  leccion_id bigint references public.lecciones(id) on delete set null,
  titulo text not null,
  descripcion text,
  ubicacion text not null default 'FinModulo' check (ubicacion in ('DespuesPaso','FinModulo','FinCurso')),
  estado text not null default 'Borrador' check (estado in ('Borrador','Publicada','Cerrada')),
  fecha_inicio timestamptz,
  fecha_limite timestamptz,
  tiempo_limite_min integer,
  intentos_permitidos integer not null default 1 check (intentos_permitidos > 0),
  puntaje_minimo numeric(6,2) not null default 70 check (puntaje_minimo between 0 and 100),
  mostrar_resultado boolean not null default true,
  mostrar_correctas boolean not null default false,
  permitir_retroalimentacion boolean not null default true,
  preguntas_aleatorias boolean not null default false,
  alternativas_aleatorias boolean not null default false,
  obligatoria boolean not null default false,
  bloquea_avance boolean not null default false,
  condicion_desbloqueo text not null default 'Responder' check (condicion_desbloqueo in ('Responder','Aprobar','CalificacionManual','PuntajeMinimo')),
  permitir_reintentos boolean not null default true,
  mensaje_bloqueo text,
  creado_por bigint references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Compatibilidad con una tabla evaluaciones creada por una version anterior.
-- CREATE TABLE IF NOT EXISTS conserva la tabla antigua, pero no agrega columnas.
alter table public.evaluaciones
  add column if not exists curso_id bigint,
  add column if not exists modulo_id bigint,
  add column if not exists leccion_id bigint,
  add column if not exists titulo text,
  add column if not exists descripcion text,
  add column if not exists ubicacion text default 'FinModulo',
  add column if not exists estado text default 'Borrador',
  add column if not exists fecha_inicio timestamptz,
  add column if not exists fecha_limite timestamptz,
  add column if not exists tiempo_limite_min integer,
  add column if not exists intentos_permitidos integer default 1,
  add column if not exists puntaje_minimo numeric(6,2) default 70,
  add column if not exists mostrar_resultado boolean default true,
  add column if not exists mostrar_correctas boolean default false,
  add column if not exists permitir_retroalimentacion boolean default true,
  add column if not exists preguntas_aleatorias boolean default false,
  add column if not exists alternativas_aleatorias boolean default false,
  add column if not exists obligatoria boolean default false,
  add column if not exists bloquea_avance boolean default false,
  add column if not exists condicion_desbloqueo text default 'Responder',
  add column if not exists permitir_reintentos boolean default true,
  add column if not exists mensaje_bloqueo text,
  add column if not exists creado_por bigint,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create table if not exists public.evaluacion_preguntas (
  id bigserial primary key,
  evaluacion_id bigint not null references public.evaluaciones(id) on delete cascade,
  enunciado text not null,
  tipo text not null check (tipo in ('OpcionUnica','OpcionMultiple','VerdaderoFalso','TextoCorto','TextoLargo')),
  puntaje numeric(8,2) not null default 1 check (puntaje >= 0),
  explicacion text,
  criterios_evaluacion text,
  guia_instructor text,
  calificacion_parcial boolean not null default false,
  orden integer not null default 1,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (evaluacion_id, orden)
);

alter table public.evaluacion_preguntas
  add column if not exists evaluacion_id bigint,
  add column if not exists enunciado text,
  add column if not exists tipo text default 'TextoCorto',
  add column if not exists puntaje numeric(8,2) default 1,
  add column if not exists explicacion text,
  add column if not exists criterios_evaluacion text,
  add column if not exists guia_instructor text,
  add column if not exists calificacion_parcial boolean default false,
  add column if not exists orden integer default 1,
  add column if not exists activo boolean default true,
  add column if not exists created_at timestamptz default now();

create table if not exists public.evaluacion_opciones (
  id bigserial primary key,
  pregunta_id bigint not null references public.evaluacion_preguntas(id) on delete cascade,
  texto text not null,
  es_correcta boolean not null default false,
  orden integer not null default 1,
  unique (pregunta_id, orden)
);

alter table public.evaluacion_opciones
  add column if not exists pregunta_id bigint,
  add column if not exists texto text,
  add column if not exists es_correcta boolean default false,
  add column if not exists orden integer default 1;

create table if not exists public.evaluacion_intentos (
  id bigserial primary key,
  evaluacion_id bigint not null references public.evaluaciones(id) on delete cascade,
  usuario_id bigint not null references public.usuarios(id) on delete cascade,
  numero_intento integer not null,
  estado text not null default 'EnProgreso' check (estado in ('EnProgreso','Enviado','PendienteCalificacion','Aprobado','Desaprobado')),
  puntaje_obtenido numeric(10,2) not null default 0,
  puntaje_total numeric(10,2) not null default 0,
  porcentaje numeric(6,2) not null default 0,
  iniciado_at timestamptz not null default now(),
  enviado_at timestamptz,
  calificado_at timestamptz,
  unique (evaluacion_id, usuario_id, numero_intento)
);

alter table public.evaluacion_intentos
  add column if not exists evaluacion_id bigint,
  add column if not exists usuario_id bigint,
  add column if not exists numero_intento integer default 1,
  add column if not exists estado text default 'EnProgreso',
  add column if not exists puntaje_obtenido numeric(10,2) default 0,
  add column if not exists puntaje_total numeric(10,2) default 0,
  add column if not exists porcentaje numeric(6,2) default 0,
  add column if not exists iniciado_at timestamptz default now(),
  add column if not exists enviado_at timestamptz,
  add column if not exists calificado_at timestamptz;

create table if not exists public.evaluacion_respuestas (
  id bigserial primary key,
  intento_id bigint not null references public.evaluacion_intentos(id) on delete cascade,
  pregunta_id bigint not null references public.evaluacion_preguntas(id) on delete cascade,
  opcion_id bigint references public.evaluacion_opciones(id) on delete set null,
  opciones_ids jsonb,
  respuesta_texto text,
  puntaje_obtenido numeric(8,2),
  correcta boolean,
  requiere_revision boolean not null default false,
  retroalimentacion text,
  calificado_por bigint references public.usuarios(id) on delete set null,
  calificado_at timestamptz,
  unique (intento_id, pregunta_id)
);

alter table public.evaluacion_respuestas
  add column if not exists intento_id bigint,
  add column if not exists pregunta_id bigint,
  add column if not exists opcion_id bigint,
  add column if not exists opciones_ids jsonb,
  add column if not exists respuesta_texto text,
  add column if not exists puntaje_obtenido numeric(8,2),
  add column if not exists correcta boolean,
  add column if not exists requiere_revision boolean default false,
  add column if not exists retroalimentacion text,
  add column if not exists calificado_por bigint,
  add column if not exists calificado_at timestamptz;

create table if not exists public.foros_evaluables (
  id bigserial primary key,
  curso_id bigint not null references public.cursos(id) on delete cascade,
  modulo_id bigint references public.modulos(id) on delete cascade,
  leccion_id bigint references public.lecciones(id) on delete set null,
  titulo text not null,
  descripcion text not null,
  instrucciones text,
  ubicacion text not null default 'FinModulo' check (ubicacion in ('DespuesPaso','FinModulo','FinCurso')),
  archivo_url text,
  archivo_nombre text,
  fecha_inicio timestamptz,
  fecha_limite timestamptz,
  estado text not null default 'Borrador' check (estado in ('Borrador','Publicado','Cerrado')),
  visibilidad text not null default 'SoloInstructor' check (visibilidad in ('SoloInstructor','TodosEstudiantes')),
  obligatorio boolean not null default false,
  bloquea_avance boolean not null default false,
  condicion_desbloqueo text not null default 'Responder' check (condicion_desbloqueo in ('Responder','Calificacion','MinimoEstrellas')),
  minimo_estrellas integer not null default 1 check (minimo_estrellas between 1 and 5),
  mensaje_bloqueo text,
  creado_por bigint references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.foros_evaluables
  add column if not exists curso_id bigint,
  add column if not exists modulo_id bigint,
  add column if not exists leccion_id bigint,
  add column if not exists titulo text,
  add column if not exists descripcion text,
  add column if not exists instrucciones text,
  add column if not exists ubicacion text default 'FinModulo',
  add column if not exists archivo_url text,
  add column if not exists archivo_nombre text,
  add column if not exists fecha_inicio timestamptz,
  add column if not exists fecha_limite timestamptz,
  add column if not exists estado text default 'Borrador',
  add column if not exists visibilidad text default 'SoloInstructor',
  add column if not exists obligatorio boolean default false,
  add column if not exists bloquea_avance boolean default false,
  add column if not exists condicion_desbloqueo text default 'Responder',
  add column if not exists minimo_estrellas integer default 1,
  add column if not exists mensaje_bloqueo text,
  add column if not exists creado_por bigint,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create table if not exists public.foro_respuestas (
  id bigserial primary key,
  foro_id bigint not null references public.foros_evaluables(id) on delete cascade,
  usuario_id bigint not null references public.usuarios(id) on delete cascade,
  texto text not null,
  archivo_url text,
  archivo_nombre text,
  estado text not null default 'Enviado' check (estado in ('Enviado','Revisado','Calificado')),
  estrellas integer check (estrellas between 1 and 5),
  retroalimentacion text,
  calificado_por bigint references public.usuarios(id) on delete set null,
  enviado_at timestamptz not null default now(),
  calificado_at timestamptz,
  unique (foro_id, usuario_id)
);

alter table public.foro_respuestas
  add column if not exists foro_id bigint,
  add column if not exists usuario_id bigint,
  add column if not exists texto text,
  add column if not exists archivo_url text,
  add column if not exists archivo_nombre text,
  add column if not exists estado text default 'Enviado',
  add column if not exists estrellas integer,
  add column if not exists retroalimentacion text,
  add column if not exists calificado_por bigint,
  add column if not exists enviado_at timestamptz default now(),
  add column if not exists calificado_at timestamptz;

create index if not exists evaluaciones_curso_idx on public.evaluaciones(curso_id, estado);
create index if not exists preguntas_evaluacion_idx on public.evaluacion_preguntas(evaluacion_id, orden);
create index if not exists intentos_usuario_idx on public.evaluacion_intentos(usuario_id, evaluacion_id);
create index if not exists foros_curso_idx on public.foros_evaluables(curso_id, estado);
create index if not exists foro_respuestas_usuario_idx on public.foro_respuestas(usuario_id, foro_id);

notify pgrst, 'reload schema';

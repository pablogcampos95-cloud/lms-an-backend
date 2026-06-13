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

create table if not exists public.evaluacion_opciones (
  id bigserial primary key,
  pregunta_id bigint not null references public.evaluacion_preguntas(id) on delete cascade,
  texto text not null,
  es_correcta boolean not null default false,
  orden integer not null default 1,
  unique (pregunta_id, orden)
);

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

create index if not exists evaluaciones_curso_idx on public.evaluaciones(curso_id, estado);
create index if not exists preguntas_evaluacion_idx on public.evaluacion_preguntas(evaluacion_id, orden);
create index if not exists intentos_usuario_idx on public.evaluacion_intentos(usuario_id, evaluacion_id);
create index if not exists foros_curso_idx on public.foros_evaluables(curso_id, estado);
create index if not exists foro_respuestas_usuario_idx on public.foro_respuestas(usuario_id, foro_id);

notify pgrst, 'reload schema';

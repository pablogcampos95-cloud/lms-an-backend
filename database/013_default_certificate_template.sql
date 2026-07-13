-- Plantilla inicial de certificado IA Learning Solutions.
-- Ejecutar una vez en Supabase SQL Editor despues de database/012_course_estimates_and_certificate_templates.sql.

insert into public.certificado_plantillas (
  nombre,
  descripcion,
  curso_id,
  titulo,
  subtitulo,
  cuerpo,
  firma_nombre,
  firma_cargo,
  color_principal,
  fondo_url,
  activo
)
select
  'Diploma IA Learning Solutions',
  'Plantilla base para certificados de finalizacion. Solo cambia curso, participante y fecha.',
  null,
  'Diploma de finalizacion de curso',
  '{{curso}}',
  'Certificado emitido para {{nombre}} el {{fecha}}.',
  'Pablo Gutierrez Campos',
  'Director General',
  '#00d8ff',
  '/assets/certificates/ials-diploma-template.png',
  true
where not exists (
  select 1
  from public.certificado_plantillas
  where nombre = 'Diploma IA Learning Solutions'
);

update public.certificado_plantillas
set
  descripcion = 'Plantilla unica para certificados de finalizacion. Solo cambia curso, participante y fecha.',
  curso_id = null,
  titulo = 'Certificado de finalizacion',
  subtitulo = '{{curso}}',
  cuerpo = 'Certificado emitido para {{nombre}} el {{fecha}}.',
  firma_nombre = 'Pablo Gutierrez',
  firma_cargo = 'Director General',
  color_principal = '#00d8ff',
  fondo_url = '/assets/certificates/ials-diploma-template.png',
  activo = true
where nombre = 'Diploma IA Learning Solutions';

update public.certificado_plantillas
set activo = false
where nombre <> 'Diploma IA Learning Solutions';

notify pgrst, 'reload schema';

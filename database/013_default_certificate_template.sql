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

notify pgrst, 'reload schema';

const sanitizeHtml = require('sanitize-html');

const supabase = require('./supabase.service');
const AppError = require('../utils/AppError');

const sanitizeText = (value) => sanitizeHtml(String(value || '').trim(), { allowedTags: [], allowedAttributes: {} });

const throwSupabaseError = (error, message = 'Error al consultar Supabase') => {
  if (!error) return;
  if (error.code === '23503') throw new AppError('La plantilla referencia un curso o usuario inexistente', 400, error.message);
  throw new AppError(message, 500, error.message);
};

const normalizeColor = (value) => {
  const color = sanitizeText(value || '#00d8ff');
  return /^#[0-9a-f]{6}$/i.test(color) ? color : '#00d8ff';
};

const prepareTemplatePayload = (payload = {}, userId) => {
  const nombre = sanitizeText(payload.nombre);
  const titulo = sanitizeText(payload.titulo);
  if (!nombre) throw new AppError('El nombre de la plantilla es obligatorio', 400);
  if (!titulo) throw new AppError('El titulo del certificado es obligatorio', 400);

  return {
    nombre,
    descripcion: sanitizeText(payload.descripcion),
    curso_id: payload.curso_id ? Number(payload.curso_id) : null,
    titulo,
    subtitulo: sanitizeText(payload.subtitulo),
    cuerpo: sanitizeText(payload.cuerpo),
    firma_nombre: sanitizeText(payload.firma_nombre),
    firma_cargo: sanitizeText(payload.firma_cargo),
    color_principal: normalizeColor(payload.color_principal),
    fondo_url: sanitizeText(payload.fondo_url),
    activo: payload.activo !== false,
    creado_por: userId || null,
  };
};

const listTemplates = async () => {
  const { data, error } = await supabase
    .from('certificado_plantillas')
    .select('*, curso:cursos(id,nombre,categoria)')
    .order('created_at', { ascending: false });
  throwSupabaseError(error);
  return data || [];
};

const createTemplate = async (payload, userId) => {
  const clean = prepareTemplatePayload(payload, userId);
  const { data, error } = await supabase
    .from('certificado_plantillas')
    .insert(clean)
    .select('*, curso:cursos(id,nombre,categoria)')
    .single();
  throwSupabaseError(error, 'No se pudo crear la plantilla de certificado');
  return data;
};

const updateTemplate = async (id, payload, userId) => {
  const clean = prepareTemplatePayload(payload, userId);
  delete clean.creado_por;
  const { data, error } = await supabase
    .from('certificado_plantillas')
    .update({ ...clean, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, curso:cursos(id,nombre,categoria)')
    .maybeSingle();
  throwSupabaseError(error, 'No se pudo actualizar la plantilla de certificado');
  if (!data) throw new AppError('Plantilla de certificado no encontrada', 404);
  return data;
};

const deleteTemplate = async (id) => {
  const { data, error } = await supabase
    .from('certificado_plantillas')
    .delete()
    .eq('id', id)
    .select('*')
    .maybeSingle();
  throwSupabaseError(error, 'No se pudo eliminar la plantilla de certificado');
  if (!data) throw new AppError('Plantilla de certificado no encontrada', 404);
  return data;
};

module.exports = {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
};

const bcrypt = require('bcryptjs');

const supabase = require('./supabase.service');
const AppError = require('../utils/AppError');

const TABLE = 'usuarios';
const USUARIO_SELECT = '*, rol:roles(id,nombre,descripcion)';

const normalizeSupabaseError = (error) => {
  if (!error) return null;

  if (error.code === '23505') {
    return new AppError('Ya existe un usuario con esos datos', 409, error.details);
  }

  if (error.code === '23503') {
    return new AppError('La operacion referencia datos que no existen', 400, error.details);
  }

  return new AppError('Error al consultar Supabase', 500, error.message);
};

const sanitizeUsuario = (usuario) => {
  if (!usuario) return usuario;

  const { password_hash, ...safeUsuario } = usuario;
  return {
    ...safeUsuario,
    nombre: safeUsuario.Nombres,
    rol_nombre: safeUsuario.rol ? safeUsuario.rol.nombre : null,
    tipo_plan: safeUsuario.tipo_plan || 'Gratuito',
  };
};

const prepareUsuarioPayload = async (usuario) => {
  const payload = { ...usuario };

  if (payload.password) {
    payload.password_hash = await bcrypt.hash(payload.password, 10);
    delete payload.password;
  }

  return payload;
};

const getUsuarios = async () => {
  const { data, error } = await supabase
    .from(TABLE)
    .select(USUARIO_SELECT)
    .order('id', { ascending: true });

  const appError = normalizeSupabaseError(error);
  if (appError) throw appError;

  return data.map(sanitizeUsuario);
};

const getUsuarioById = async (id) => {
  const { data, error } = await supabase
    .from(TABLE)
    .select(USUARIO_SELECT)
    .eq('id', id)
    .maybeSingle();

  const appError = normalizeSupabaseError(error);
  if (appError) throw appError;

  if (!data) {
    throw new AppError('Usuario no encontrado', 404);
  }

  return sanitizeUsuario(data);
};

const getUsuarioWithPasswordById = async (id) => {
  const { data, error } = await supabase
    .from(TABLE)
    .select(USUARIO_SELECT)
    .eq('id', id)
    .maybeSingle();

  const appError = normalizeSupabaseError(error);
  if (appError) throw appError;

  if (!data) {
    throw new AppError('Usuario no encontrado', 404);
  }

  return data;
};

const createUsuario = async (usuario) => {
  const payload = await prepareUsuarioPayload(usuario);

  const { data, error } = await supabase
    .from(TABLE)
    .insert(payload)
    .select(USUARIO_SELECT)
    .single();

  const appError = normalizeSupabaseError(error);
  if (appError) throw appError;

  return sanitizeUsuario(data);
};

const updateUsuario = async (id, usuario) => {
  const payload = await prepareUsuarioPayload(usuario);

  const { data, error } = await supabase
    .from(TABLE)
    .update(payload)
    .eq('id', id)
    .select(USUARIO_SELECT)
    .maybeSingle();

  const appError = normalizeSupabaseError(error);
  if (appError) throw appError;

  if (!data) {
    throw new AppError('Usuario no encontrado', 404);
  }

  return sanitizeUsuario(data);
};

const deleteUsuario = async (id) => {
  const usuario = await getUsuarioById(id);

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id);

  const appError = normalizeSupabaseError(error);
  if (appError) throw appError;

  return usuario;
};

module.exports = {
  sanitizeUsuario,
  getUsuarios,
  getUsuarioById,
  getUsuarioWithPasswordById,
  createUsuario,
  updateUsuario,
  deleteUsuario,
};

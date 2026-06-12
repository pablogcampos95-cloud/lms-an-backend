const supabase = require('./supabase.service');
const AppError = require('../utils/AppError');

const TABLE = 'roles';

const normalizeSupabaseError = (error) => {
  if (!error) return null;

  if (error.code === '23505') {
    return new AppError('Ya existe un rol con esos datos', 409, error.details);
  }

  if (error.code === '23503') {
    return new AppError('No se puede eliminar el rol porque esta asignado a usuarios', 409, error.details);
  }

  return new AppError('Error al consultar Supabase', 500, error.message);
};

const getRoles = async () => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('id', { ascending: true });

  const appError = normalizeSupabaseError(error);
  if (appError) throw appError;

  return data;
};

const getRolById = async (id) => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const appError = normalizeSupabaseError(error);
  if (appError) throw appError;

  if (!data) {
    throw new AppError('Rol no encontrado', 404);
  }

  return data;
};

const createRol = async (rol) => {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(rol)
    .select()
    .single();

  const appError = normalizeSupabaseError(error);
  if (appError) throw appError;

  return data;
};

const updateRol = async (id, rol) => {
  const { data, error } = await supabase
    .from(TABLE)
    .update(rol)
    .eq('id', id)
    .select()
    .maybeSingle();

  const appError = normalizeSupabaseError(error);
  if (appError) throw appError;

  if (!data) {
    throw new AppError('Rol no encontrado', 404);
  }

  return data;
};

const deleteRol = async (id) => {
  const rol = await getRolById(id);

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id);

  const appError = normalizeSupabaseError(error);
  if (appError) throw appError;

  return rol;
};

module.exports = {
  getRoles,
  getRolById,
  createRol,
  updateRol,
  deleteRol,
};

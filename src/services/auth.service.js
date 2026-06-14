const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const supabase = require('./supabase.service');
const usuariosService = require('./usuarios.service');
const AppError = require('../utils/AppError');

const login = async ({ usuario, password, rememberMe = false }) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*, rol:roles(id,nombre,descripcion)')
    .eq('usuario', usuario)
    .maybeSingle();

  if (error) {
    throw new AppError('Error al consultar credenciales', 500, error.message);
  }

  if (!data || !data.password_hash) {
    throw new AppError('Usuario o contrasena incorrectos', 401);
  }

  const passwordValida = await bcrypt.compare(password, data.password_hash);

  if (!passwordValida) {
    throw new AppError('Usuario o contrasena incorrectos', 401);
  }

  if (data.Estado && data.Estado.toLowerCase() !== 'activo') {
    throw new AppError('El usuario no se encuentra activo', 403);
  }

  const token = jwt.sign(
    {
      id: data.id,
      usuario: data.usuario,
      rol: data.rol ? data.rol.nombre : null,
    },
    process.env.JWT_SECRET,
    { expiresIn: rememberMe ? (process.env.JWT_REMEMBER_EXPIRES_IN || '30d') : (process.env.JWT_EXPIRES_IN || '8h') }
  );

  return {
    token,
    usuario: usuariosService.sanitizeUsuario(data),
  };
};

const getMe = (usuario) => usuariosService.sanitizeUsuario(usuario);

module.exports = {
  login,
  getMe,
};

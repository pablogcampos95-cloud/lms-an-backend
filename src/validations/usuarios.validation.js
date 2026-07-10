const AppError = require('../utils/AppError');

const ALLOWED_FIELDS = [
  'DNI',
  'Nombres',
  'Correo',
  'Cargo',
  'Campaña',
  'CampaÃ±a',
  'Supervisor',
  'Estado',
  'fecha_ingreso',
  'usuario',
  'password',
  'rol_id',
  'tipo_plan',
];

const REQUIRED_FIELDS = ['DNI', 'Nombres', 'Correo', 'Cargo', 'Estado', 'usuario', 'password', 'rol_id', 'tipo_plan'];
const ALLOWED_PLAN_TYPES = ['Gratuito', 'Pagado'];

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date);
const isValidPassword = (password) => typeof password === 'string' && password.length >= 4;

const pickUsuarioFields = (body) => {
  const usuario = {};

  ALLOWED_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      usuario[field] = typeof body[field] === 'string' ? body[field].trim() : body[field];
    }
  });

  if (usuario['CampaÃ±a'] && !usuario['Campaña']) {
    usuario['Campaña'] = usuario['CampaÃ±a'];
  }
  delete usuario['CampaÃ±a'];

  return usuario;
};

const validateUsuarioId = (req, res, next) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return next(new AppError('El id del usuario debe ser un numero entero positivo', 400));
  }

  req.params.id = id;
  return next();
};

const validateCreateUsuario = (req, res, next) => {
  const usuario = pickUsuarioFields(req.body);
  const errors = [];

  REQUIRED_FIELDS.forEach((field) => {
    if (!usuario[field]) {
      errors.push(`El campo ${field} es obligatorio`);
    }
  });

  if (usuario.Correo && !isValidEmail(usuario.Correo)) {
    errors.push('El campo Correo debe tener un formato valido');
  }

  if (usuario.fecha_ingreso && !isValidDate(usuario.fecha_ingreso)) {
    errors.push('El campo fecha_ingreso debe usar el formato YYYY-MM-DD');
  }

  if (usuario.password && !isValidPassword(usuario.password)) {
    errors.push('La contrasena debe tener al menos 4 caracteres');
  }

  if (usuario.rol_id && (!Number.isInteger(Number(usuario.rol_id)) || Number(usuario.rol_id) <= 0)) {
    errors.push('El campo rol_id debe ser un numero entero positivo');
  }

  if (usuario.tipo_plan && !ALLOWED_PLAN_TYPES.includes(usuario.tipo_plan)) {
    errors.push('El campo tipo_plan debe ser Gratuito o Pagado');
  }

  if (errors.length > 0) {
    return next(new AppError('Datos de usuario invalidos', 400, errors));
  }

  usuario.rol_id = Number(usuario.rol_id);
  req.body = usuario;
  return next();
};

const validateUpdateUsuario = (req, res, next) => {
  const usuario = pickUsuarioFields(req.body);
  const errors = [];

  if (Object.keys(usuario).length === 0) {
    errors.push('Debe enviar al menos un campo valido para actualizar');
  }

  if (usuario.Correo !== undefined && !isValidEmail(usuario.Correo)) {
    errors.push('El campo Correo debe tener un formato valido');
  }

  if (usuario.fecha_ingreso !== undefined && !isValidDate(usuario.fecha_ingreso)) {
    errors.push('El campo fecha_ingreso debe usar el formato YYYY-MM-DD');
  }

  if (usuario.password !== undefined && !isValidPassword(usuario.password)) {
    errors.push('La contrasena debe tener al menos 4 caracteres');
  }

  if (usuario.rol_id !== undefined && (!Number.isInteger(Number(usuario.rol_id)) || Number(usuario.rol_id) <= 0)) {
    errors.push('El campo rol_id debe ser un numero entero positivo');
  }

  if (usuario.tipo_plan !== undefined && !ALLOWED_PLAN_TYPES.includes(usuario.tipo_plan)) {
    errors.push('El campo tipo_plan debe ser Gratuito o Pagado');
  }

  if (errors.length > 0) {
    return next(new AppError('Datos de usuario invalidos', 400, errors));
  }

  if (usuario.rol_id !== undefined) {
    usuario.rol_id = Number(usuario.rol_id);
  }

  req.body = usuario;
  return next();
};

module.exports = {
  validateUsuarioId,
  validateCreateUsuario,
  validateUpdateUsuario,
};

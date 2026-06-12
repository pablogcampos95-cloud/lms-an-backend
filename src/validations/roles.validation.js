const AppError = require('../utils/AppError');

const validateRolId = (req, res, next) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return next(new AppError('El id del rol debe ser un numero entero positivo', 400));
  }

  req.params.id = id;
  return next();
};

const validateCreateRol = (req, res, next) => {
  const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
  const descripcion = typeof req.body.descripcion === 'string' ? req.body.descripcion.trim() : null;

  if (!nombre) {
    return next(new AppError('El nombre del rol es obligatorio', 400));
  }

  req.body = { nombre, descripcion };
  return next();
};

const validateUpdateRol = (req, res, next) => {
  const rol = {};

  if (Object.prototype.hasOwnProperty.call(req.body, 'nombre')) {
    rol.nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'descripcion')) {
    rol.descripcion = typeof req.body.descripcion === 'string' ? req.body.descripcion.trim() : null;
  }

  if (Object.keys(rol).length === 0 || rol.nombre === '') {
    return next(new AppError('Debe enviar datos validos para actualizar el rol', 400));
  }

  req.body = rol;
  return next();
};

module.exports = {
  validateRolId,
  validateCreateRol,
  validateUpdateRol,
};

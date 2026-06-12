const AppError = require('../utils/AppError');

const authorizeRoles = (...allowedRoles) => (req, res, next) => {
  const rolNombre = req.user && req.user.rol && req.user.rol.nombre;

  if (!rolNombre) {
    return next(new AppError('El usuario no tiene un rol asignado', 403));
  }

  if (!allowedRoles.includes(rolNombre)) {
    return next(new AppError('No tienes permisos para realizar esta accion', 403));
  }

  return next();
};

module.exports = {
  authorizeRoles,
};

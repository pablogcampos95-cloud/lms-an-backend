const AppError = require('../utils/AppError');

const notFoundHandler = (req, res, next) => {
  next(new AppError(`Ruta no encontrada: ${req.originalUrl}`, 404));
};

const errorHandler = (error, req, res, next) => {
  const statusCode = error.statusCode || 500;

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    ok: false,
    message: error.isOperational ? error.message : 'Error interno del servidor',
    details: error.details || undefined,
  });
};

module.exports = {
  notFoundHandler,
  errorHandler,
};

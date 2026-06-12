const jwt = require('jsonwebtoken');

const usuariosService = require('../services/usuarios.service');
const AppError = require('../utils/AppError');

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Token de autenticacion requerido', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await usuariosService.getUsuarioWithPasswordById(decoded.id);

    req.user = usuario;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new AppError('Token invalido o expirado', 401));
    }

    return next(error);
  }
};

module.exports = {
  requireAuth,
};

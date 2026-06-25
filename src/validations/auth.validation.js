const AppError = require('../utils/AppError');

const validateLogin = (req, res, next) => {
  const { usuario, password, rememberMe } = req.body;
  const errors = [];

  if (!usuario || typeof usuario !== 'string') {
    errors.push('El campo usuario es obligatorio');
  }

  if (!password || typeof password !== 'string') {
    errors.push('El campo password es obligatorio');
  }

  if (errors.length > 0) {
    return next(new AppError('Credenciales invalidas', 400, errors));
  }

  req.body = {
    usuario: usuario.trim(),
    password: password.trim(),
    rememberMe: rememberMe === true,
  };

  return next();
};

module.exports = {
  validateLogin,
};

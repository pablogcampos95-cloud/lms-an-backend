const authService = require('../services/auth.service');

const login = async (req, res) => {
  const result = await authService.login(req.body);

  res.json({
    ok: true,
    token: result.token,
    usuario: result.usuario,
  });
};

const registerPublic = async (req, res) => {
  const result = await authService.registerPublic(req.body);

  res.status(201).json({
    ok: true,
    token: result.token,
    usuario: result.usuario,
    message: 'Cuenta gratuita creada correctamente',
  });
};

const requestMagicLink = async (req, res) => {
  const result = await authService.requestMagicLink(req.body);

  res.json({
    ok: true,
    data: result,
    message: 'Enlace magico enviado correctamente',
  });
};

const completeMagicLink = async (req, res) => {
  const result = await authService.completeMagicLink(req.body);

  res.json({
    ok: true,
    token: result.token,
    usuario: result.usuario,
  });
};

const googleConfig = async (req, res) => {
  res.json({
    ok: true,
    data: authService.googleConfig(),
  });
};

const google = async (req, res) => {
  const result = await authService.loginWithGoogle(req.body);

  res.json({
    ok: true,
    token: result.token,
    usuario: result.usuario,
  });
};

const me = async (req, res) => {
  res.json({
    ok: true,
    usuario: authService.getMe(req.user),
  });
};

const changePassword = async (req, res) => {
  const usuario = await authService.changePassword(req.user.id, req.body);

  res.json({
    ok: true,
    usuario,
    message: 'Contrasena actualizada correctamente',
  });
};

module.exports = {
  login,
  registerPublic,
  requestMagicLink,
  completeMagicLink,
  googleConfig,
  google,
  changePassword,
  me,
};

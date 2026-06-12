const authService = require('../services/auth.service');

const login = async (req, res) => {
  const result = await authService.login(req.body);

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

module.exports = {
  login,
  me,
};

const usuariosService = require('../services/usuarios.service');

const listarUsuarios = async (req, res) => {
  const usuarios = await usuariosService.getUsuarios();

  res.json({
    ok: true,
    data: usuarios,
  });
};

const obtenerUsuario = async (req, res) => {
  const usuario = await usuariosService.getUsuarioById(req.params.id);

  res.json({
    ok: true,
    data: usuario,
  });
};

const crearUsuario = async (req, res) => {
  const usuario = await usuariosService.createUsuario(req.body);

  res.status(201).json({
    ok: true,
    message: 'Usuario creado correctamente',
    data: usuario,
  });
};

const actualizarUsuario = async (req, res) => {
  const usuario = await usuariosService.updateUsuario(req.params.id, req.body);

  res.json({
    ok: true,
    message: 'Usuario actualizado correctamente',
    data: usuario,
  });
};

const eliminarUsuario = async (req, res) => {
  const usuario = await usuariosService.deleteUsuario(req.params.id);

  res.json({
    ok: true,
    message: 'Usuario eliminado correctamente',
    data: usuario,
  });
};

module.exports = {
  listarUsuarios,
  obtenerUsuario,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
};

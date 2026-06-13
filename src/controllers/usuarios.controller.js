const usuariosService = require('../services/usuarios.service');
const estudianteService = require('../services/estudiante.service');

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

const obtenerAsignaciones = async (req, res) => {
  res.json({ ok: true, data: await estudianteService.getAssignments(req.params.id) });
};

const guardarAsignaciones = async (req, res) => {
  const data = await estudianteService.setAssignments(req.params.id, req.body.curso_ids, req.user.id);
  res.json({ ok: true, message: 'Cursos asignados correctamente', data });
};

module.exports = {
  listarUsuarios,
  obtenerUsuario,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
  obtenerAsignaciones,
  guardarAsignaciones,
};

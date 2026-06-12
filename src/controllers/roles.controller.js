const rolesService = require('../services/roles.service');

const listarRoles = async (req, res) => {
  const roles = await rolesService.getRoles();

  res.json({
    ok: true,
    data: roles,
  });
};

const crearRol = async (req, res) => {
  const rol = await rolesService.createRol(req.body);

  res.status(201).json({
    ok: true,
    message: 'Rol creado correctamente',
    data: rol,
  });
};

const actualizarRol = async (req, res) => {
  const rol = await rolesService.updateRol(req.params.id, req.body);

  res.json({
    ok: true,
    message: 'Rol actualizado correctamente',
    data: rol,
  });
};

const eliminarRol = async (req, res) => {
  const rol = await rolesService.deleteRol(req.params.id);

  res.json({
    ok: true,
    message: 'Rol eliminado correctamente',
    data: rol,
  });
};

module.exports = {
  listarRoles,
  crearRol,
  actualizarRol,
  eliminarRol,
};

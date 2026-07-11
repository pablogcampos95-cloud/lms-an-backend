const certificadosService = require('../services/certificados.service');

const ok = (res, data, message) => res.json({ ok: true, message, data });

const listarPlantillas = async (req, res) => ok(res, await certificadosService.listTemplates());

const crearPlantilla = async (req, res) => res.status(201).json({
  ok: true,
  data: await certificadosService.createTemplate(req.body, req.user.id),
});

const actualizarPlantilla = async (req, res) => ok(
  res,
  await certificadosService.updateTemplate(req.params.id, req.body, req.user.id),
  'Plantilla actualizada',
);

const eliminarPlantilla = async (req, res) => ok(
  res,
  await certificadosService.deleteTemplate(req.params.id),
  'Plantilla eliminada',
);

module.exports = {
  listarPlantillas,
  crearPlantilla,
  actualizarPlantilla,
  eliminarPlantilla,
};

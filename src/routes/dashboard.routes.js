const { Router } = require('express');

const { requireAuth } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');

const router = Router();

const buildPlaceholderDashboard = (tipo) => ({
  cursosAsignados: 0,
  cursosCompletados: 0,
  cursosPendientes: 0,
  horasCapacitacion: 0,
  certificadosObtenidos: 0,
  notaPromedio: 0,
  rankingPersonal: 0,
  avanceGeneral: 0,
  tipo,
});

router.use(requireAuth);

router.get('/general', (req, res) => {
  res.json({
    ok: true,
    data: buildPlaceholderDashboard('general'),
  });
});

router.get('/capacitacion', authorizeRoles('Administrador', 'Analista', 'Instructor'), (req, res) => {
  res.json({
    ok: true,
    data: buildPlaceholderDashboard('capacitacion'),
  });
});

router.get('/calidad', authorizeRoles('Administrador', 'Analista'), (req, res) => {
  res.json({
    ok: true,
    data: buildPlaceholderDashboard('calidad'),
  });
});

router.get('/desarrollo', authorizeRoles('Administrador', 'Analista'), (req, res) => {
  res.json({
    ok: true,
    data: buildPlaceholderDashboard('desarrollo'),
  });
});

router.get('/retencion', authorizeRoles('Administrador', 'Analista'), (req, res) => {
  res.json({
    ok: true,
    data: buildPlaceholderDashboard('retencion'),
  });
});

module.exports = router;

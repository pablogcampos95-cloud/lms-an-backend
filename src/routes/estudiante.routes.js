const { Router } = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const asyncHandler = require('../utils/asyncHandler');
const estudianteService = require('../services/estudiante.service');

const router = Router();
router.use(requireAuth);
router.use(authorizeRoles('Estudiante'));
router.get('/evaluaciones', asyncHandler(async (req, res) => res.json({ ok: true, data: await estudianteService.getEvaluations(req.user.id) })));
router.get('/certificados', asyncHandler(async (req, res) => res.json({ ok: true, data: await estudianteService.getCertificates(req.user.id) })));
router.post('/cursos/:cursoId/finalizar', asyncHandler(async (req, res) => res.json({ ok: true, data: await estudianteService.finishCourse(req.user.id, req.params.cursoId) })));

module.exports = router;

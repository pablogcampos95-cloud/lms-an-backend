const { Router } = require('express');
const controller = require('../controllers/academico.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

router.get('/catalogo-publico', asyncHandler(controller.listarCursosPublicos));
router.use(requireAuth);
router.get('/', asyncHandler(controller.listarCursos));
router.get('/:id/asignaciones', authorizeRoles('Administrador'), asyncHandler(controller.obtenerEstudiantesCurso));
router.put('/:id/asignaciones', authorizeRoles('Administrador'), asyncHandler(controller.asignarEstudiantesCurso));
router.get('/:id/aprender', asyncHandler(controller.obtenerCursoPublicado));
router.get('/:id', authorizeRoles('Administrador', 'Instructor'), asyncHandler(controller.obtenerCurso));
router.post('/', authorizeRoles('Administrador', 'Instructor'), asyncHandler(controller.crearCurso));
router.post('/:id/duplicar', authorizeRoles('Administrador', 'Instructor'), asyncHandler(controller.duplicarCurso));
router.put('/:id', authorizeRoles('Administrador', 'Instructor'), asyncHandler(controller.actualizarCurso));
router.delete('/:id', authorizeRoles('Administrador'), asyncHandler(controller.eliminarCurso));

module.exports = router;

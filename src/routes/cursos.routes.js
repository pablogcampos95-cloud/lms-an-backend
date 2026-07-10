const { Router } = require('express');
const multer = require('multer');
const controller = require('../controllers/academico.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const router = Router();
const uploadCover = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return callback(new AppError('Solo puedes subir imagenes JPG, PNG o WEBP como portada', 400));
    }
    return callback(null, true);
  },
});

router.get('/catalogo-publico', asyncHandler(controller.listarCursosPublicos));
router.use(requireAuth);
router.get('/', asyncHandler(controller.listarCursos));
router.post('/portada', authorizeRoles('Administrador', 'Instructor'), uploadCover.single('imagen'), asyncHandler(controller.subirPortadaCurso));
router.get('/:id/asignaciones', authorizeRoles('Administrador'), asyncHandler(controller.obtenerEstudiantesCurso));
router.put('/:id/asignaciones', authorizeRoles('Administrador'), asyncHandler(controller.asignarEstudiantesCurso));
router.get('/:id/aprender', asyncHandler(controller.obtenerCursoPublicado));
router.get('/:id', authorizeRoles('Administrador', 'Instructor'), asyncHandler(controller.obtenerCurso));
router.post('/', authorizeRoles('Administrador', 'Instructor'), asyncHandler(controller.crearCurso));
router.post('/:id/duplicar', authorizeRoles('Administrador', 'Instructor'), asyncHandler(controller.duplicarCurso));
router.put('/:id', authorizeRoles('Administrador', 'Instructor'), asyncHandler(controller.actualizarCurso));
router.delete('/:id', authorizeRoles('Administrador'), asyncHandler(controller.eliminarCurso));

module.exports = router;

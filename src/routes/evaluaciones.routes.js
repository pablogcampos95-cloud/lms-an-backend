const { Router } = require('express');
const multer = require('multer');
const controller = require('../controllers/evaluaciones.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: (req, file, callback) => callback(null, /\.(pdf|doc|docx|ppt|pptx|jpg|jpeg|png|webp|xlsx|xls)$/i.test(file.originalname)) });
router.use(requireAuth);

router.get('/foros', asyncHandler(controller.listarForos));
router.post('/foros', authorizeRoles('Administrador', 'Instructor'), asyncHandler(controller.crearForo));
router.get('/foros/:id', asyncHandler(controller.obtenerForo));
router.put('/foros/:id', authorizeRoles('Administrador', 'Instructor'), asyncHandler(controller.actualizarForo));
router.post('/foros/:id/archivo', authorizeRoles('Administrador', 'Instructor'), upload.single('archivo'), asyncHandler(controller.subirArchivoForo));
router.delete('/foros/:id', authorizeRoles('Administrador', 'Instructor'), asyncHandler(controller.eliminarForo));
router.post('/foros/:id/responder', authorizeRoles('Estudiante'), asyncHandler(controller.responderForo));
router.get('/foros/:id/resultados', authorizeRoles('Administrador', 'Instructor'), asyncHandler(controller.resultadosForo));
router.patch('/foros/respuestas/:id/calificar', authorizeRoles('Administrador', 'Instructor'), asyncHandler(controller.calificarForo));

router.get('/', asyncHandler(controller.listar));
router.post('/', authorizeRoles('Administrador', 'Instructor'), asyncHandler(controller.crear));
router.get('/:id', asyncHandler(controller.obtener));
router.put('/:id', authorizeRoles('Administrador', 'Instructor'), asyncHandler(controller.actualizar));
router.patch('/:id/orden', authorizeRoles('Administrador', 'Instructor'), asyncHandler(controller.ordenar));
router.delete('/:id', authorizeRoles('Administrador', 'Instructor'), asyncHandler(controller.eliminar));
router.post('/:id/duplicar', authorizeRoles('Administrador', 'Instructor'), asyncHandler(controller.duplicar));
router.post('/:id/intentos', authorizeRoles('Estudiante'), asyncHandler(controller.iniciarIntento));
router.post('/:id/intentos/:intentoId/enviar', authorizeRoles('Estudiante'), asyncHandler(controller.enviarIntento));
router.get('/:id/resultados', authorizeRoles('Administrador', 'Instructor'), asyncHandler(controller.resultados));
router.patch('/respuestas/:id/calificar', authorizeRoles('Administrador', 'Instructor'), asyncHandler(controller.calificarRespuesta));

module.exports = router;

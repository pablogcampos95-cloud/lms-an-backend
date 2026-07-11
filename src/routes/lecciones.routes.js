const { Router } = require('express');
const multer = require('multer');
const controller = require('../controllers/academico.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowed = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|jpg|jpeg|png|webp|mp4|mov|webm|zip)$/i;
    callback(null, allowed.test(file.originalname));
  },
});

router.use(requireAuth);
router.patch('/:id/completar', asyncHandler(controller.completarLeccion));
router.get('/', authorizeRoles('Administrador', 'Instructor'), asyncHandler(controller.listarLecciones));
router.post('/', authorizeRoles('Administrador', 'Instructor'), asyncHandler(controller.crearLeccion));
router.post('/:id/archivo', authorizeRoles('Administrador', 'Instructor'), upload.single('archivo'), asyncHandler(controller.subirArchivo));
router.put('/:id', authorizeRoles('Administrador', 'Instructor'), asyncHandler(controller.actualizarLeccion));
router.patch('/:id/orden', authorizeRoles('Administrador', 'Instructor'), asyncHandler(controller.ordenarLeccion));
router.delete('/:id', authorizeRoles('Administrador', 'Instructor'), asyncHandler(controller.eliminarLeccion));

module.exports = router;

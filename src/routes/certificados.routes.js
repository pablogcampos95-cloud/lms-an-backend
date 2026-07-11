const { Router } = require('express');
const multer = require('multer');

const controller = require('../controllers/certificados.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const router = Router();
const uploadCertificateBackground = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return callback(new AppError('Solo puedes subir imagenes JPG, PNG o WEBP como fondo', 400));
    }
    return callback(null, true);
  },
});

router.use(requireAuth);

router.get('/plantillas', authorizeRoles('Administrador'), asyncHandler(controller.listarPlantillas));
router.post('/plantillas/fondo', authorizeRoles('Administrador'), uploadCertificateBackground.single('imagen'), asyncHandler(controller.subirFondoPlantilla));
router.post('/plantillas', authorizeRoles('Administrador'), asyncHandler(controller.crearPlantilla));
router.put('/plantillas/:id', authorizeRoles('Administrador'), asyncHandler(controller.actualizarPlantilla));
router.delete('/plantillas/:id', authorizeRoles('Administrador'), asyncHandler(controller.eliminarPlantilla));

module.exports = router;

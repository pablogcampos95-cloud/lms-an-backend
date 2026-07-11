const { Router } = require('express');

const controller = require('../controllers/certificados.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

router.use(requireAuth);

router.get('/plantillas', authorizeRoles('Administrador'), asyncHandler(controller.listarPlantillas));
router.post('/plantillas', authorizeRoles('Administrador'), asyncHandler(controller.crearPlantilla));
router.put('/plantillas/:id', authorizeRoles('Administrador'), asyncHandler(controller.actualizarPlantilla));
router.delete('/plantillas/:id', authorizeRoles('Administrador'), asyncHandler(controller.eliminarPlantilla));

module.exports = router;

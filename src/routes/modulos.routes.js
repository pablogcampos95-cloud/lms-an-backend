const { Router } = require('express');
const controller = require('../controllers/academico.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

router.use(requireAuth, authorizeRoles('Administrador', 'Instructor'));
router.get('/', asyncHandler(controller.listarModulos));
router.post('/', asyncHandler(controller.crearModulo));
router.put('/:id', asyncHandler(controller.actualizarModulo));
router.patch('/:id/orden', asyncHandler(controller.ordenarModulo));
router.delete('/:id', asyncHandler(controller.eliminarModulo));

module.exports = router;

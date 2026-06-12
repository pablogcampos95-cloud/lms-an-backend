const { Router } = require('express');

const rolesController = require('../controllers/roles.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const asyncHandler = require('../utils/asyncHandler');
const {
  validateRolId,
  validateCreateRol,
  validateUpdateRol,
} = require('../validations/roles.validation');

const router = Router();

router.use(requireAuth);

router.get('/', authorizeRoles('Administrador', 'Analista'), asyncHandler(rolesController.listarRoles));
router.post('/', authorizeRoles('Administrador'), validateCreateRol, asyncHandler(rolesController.crearRol));
router.put('/:id', authorizeRoles('Administrador'), validateRolId, validateUpdateRol, asyncHandler(rolesController.actualizarRol));
router.delete('/:id', authorizeRoles('Administrador'), validateRolId, asyncHandler(rolesController.eliminarRol));

module.exports = router;

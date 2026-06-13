const { Router } = require('express');

const usuariosController = require('../controllers/usuarios.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const asyncHandler = require('../utils/asyncHandler');
const {
  validateUsuarioId,
  validateCreateUsuario,
  validateUpdateUsuario,
} = require('../validations/usuarios.validation');

const router = Router();

router.use(requireAuth);

router.get('/', authorizeRoles('Administrador', 'Analista'), asyncHandler(usuariosController.listarUsuarios));
router.get('/:id', authorizeRoles('Administrador', 'Analista'), validateUsuarioId, asyncHandler(usuariosController.obtenerUsuario));
router.get('/:id/asignaciones', authorizeRoles('Administrador'), validateUsuarioId, asyncHandler(usuariosController.obtenerAsignaciones));
router.post('/', authorizeRoles('Administrador'), validateCreateUsuario, asyncHandler(usuariosController.crearUsuario));
router.put('/:id', authorizeRoles('Administrador'), validateUsuarioId, validateUpdateUsuario, asyncHandler(usuariosController.actualizarUsuario));
router.put('/:id/asignaciones', authorizeRoles('Administrador'), validateUsuarioId, asyncHandler(usuariosController.guardarAsignaciones));
router.delete('/:id', authorizeRoles('Administrador'), validateUsuarioId, asyncHandler(usuariosController.eliminarUsuario));

module.exports = router;

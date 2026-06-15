const { Router } = require('express');

const controller = require('../controllers/home-page.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

router.get('/', asyncHandler(controller.getPublic));
router.get('/admin', requireAuth, authorizeRoles('Administrador'), asyncHandler(controller.getAdmin));
router.put('/admin', requireAuth, authorizeRoles('Administrador'), asyncHandler(controller.saveAdmin));
router.post('/admin/defaults', requireAuth, authorizeRoles('Administrador'), asyncHandler(controller.restoreDefaults));

module.exports = router;

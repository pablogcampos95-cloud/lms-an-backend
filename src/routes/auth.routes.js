const { Router } = require('express');

const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { validateLogin } = require('../validations/auth.validation');

const router = Router();

router.post('/login', validateLogin, asyncHandler(authController.login));
router.post('/register-public', asyncHandler(authController.registerPublic));
router.post('/magic-link', asyncHandler(authController.requestMagicLink));
router.post('/magic-session', asyncHandler(authController.completeMagicLink));
router.get('/google/config', asyncHandler(authController.googleConfig));
router.post('/google', asyncHandler(authController.google));
router.put('/change-password', requireAuth, asyncHandler(authController.changePassword));
router.get('/me', requireAuth, asyncHandler(authController.me));

module.exports = router;

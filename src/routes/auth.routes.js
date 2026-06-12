const { Router } = require('express');

const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { validateLogin } = require('../validations/auth.validation');

const router = Router();

router.post('/login', validateLogin, asyncHandler(authController.login));
router.get('/me', requireAuth, asyncHandler(authController.me));

module.exports = router;

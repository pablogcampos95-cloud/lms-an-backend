const { Router } = require('express');

const router = Router();

router.get('/', (req, res) => {
  res.status(501).json({
    ok: false,
    message: 'Modulo de evaluaciones pendiente de implementar',
  });
});

module.exports = router;

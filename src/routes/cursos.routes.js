const { Router } = require('express');

const router = Router();

router.get('/', (req, res) => {
  res.status(501).json({
    ok: false,
    message: 'Modulo de cursos pendiente de implementar',
  });
});

module.exports = router;

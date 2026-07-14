const { Router } = require('express');

const { requireAuth } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const router = Router();
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

router.post('/chat', requireAuth, asyncHandler(async (req, res) => {
  const message = String(req.body.message || '').trim();
  if (!message) throw new AppError('Escribe una consulta para el asistente', 400);
  if (!process.env.GROQ_API_KEY) throw new AppError('GROQ_API_KEY no configurada', 503);

  const groqResponse = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.3,
      max_tokens: 700,
      messages: [
        {
          role: 'system',
          content: 'Eres el Asistente IA Learning Solutions del LMS. Responde en espanol, breve, claro y util. Ayuda con dudas de aprendizaje, cursos, evaluaciones y rutas. No inventes credenciales ni datos administrativos.',
        },
        { role: 'user', content: message },
      ],
    }),
  });

  const payload = await groqResponse.json().catch(() => ({}));
  if (!groqResponse.ok) {
    throw new AppError('No se pudo consultar Groq', groqResponse.status >= 500 ? 502 : 400, payload.error?.message || null);
  }

  res.json({
    ok: true,
    data: {
      answer: payload.choices?.[0]?.message?.content || 'No pude generar una respuesta en este momento.',
      model: payload.model || GROQ_MODEL,
    },
  });
}));

module.exports = router;

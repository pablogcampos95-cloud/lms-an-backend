const crypto = require('crypto');

const certificadosService = require('../services/certificados.service');
const supabase = require('../services/supabase.service');
const AppError = require('../utils/AppError');

const ok = (res, data, message) => res.json({ ok: true, message, data });
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const listarPlantillas = async (req, res) => ok(res, await certificadosService.listTemplates());

const crearPlantilla = async (req, res) => res.status(201).json({
  ok: true,
  data: await certificadosService.createTemplate(req.body, req.user.id),
});

const actualizarPlantilla = async (req, res) => ok(
  res,
  await certificadosService.updateTemplate(req.params.id, req.body, req.user.id),
  'Plantilla actualizada',
);

const eliminarPlantilla = async (req, res) => ok(
  res,
  await certificadosService.deleteTemplate(req.params.id),
  'Plantilla eliminada',
);

const subirFondoPlantilla = async (req, res) => {
  if (!req.file) throw new AppError('Debes seleccionar una imagen de fondo', 400);
  if (!IMAGE_MIME_TYPES.has(req.file.mimetype)) {
    throw new AppError('Solo puedes subir imagenes JPG, PNG o WEBP como fondo', 400);
  }

  const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `certificado-fondos/${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeName}`;

  const { error } = await supabase.storage.from('lms-recursos').upload(storagePath, req.file.buffer, {
    contentType: req.file.mimetype,
    upsert: false,
  });
  if (error) throw new AppError('No se pudo subir el fondo a Supabase', 500, error.message);

  const { data: publicData } = supabase.storage.from('lms-recursos').getPublicUrl(storagePath);

  res.status(201).json({
    ok: true,
    data: {
      bucket: 'lms-recursos',
      path: storagePath,
      url: publicData.publicUrl,
    },
  });
};

module.exports = {
  listarPlantillas,
  crearPlantilla,
  actualizarPlantilla,
  eliminarPlantilla,
  subirFondoPlantilla,
};

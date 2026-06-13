const service = require('../services/evaluaciones.service');
const supabase = require('../services/supabase.service');
const AppError = require('../utils/AppError');

const ok = (res, data, message) => res.json({ ok: true, message, data });

module.exports = {
  listar: async (req, res) => ok(res, await service.list(req.user, req.query)),
  obtener: async (req, res) => ok(res, await service.detail(req.user, req.params.id)),
  crear: async (req, res) => res.status(201).json({ ok: true, data: await service.create(req.user, req.body) }),
  actualizar: async (req, res) => ok(res, await service.update(req.user, req.params.id, req.body), 'Evaluacion actualizada'),
  eliminar: async (req, res) => ok(res, await service.remove(req.user, req.params.id), 'Evaluacion eliminada'),
  ordenar: async (req, res) => ok(res, await service.reorder(req.user, req.params.id, req.body.direction), 'Orden actualizado'),
  duplicar: async (req, res) => res.status(201).json({ ok: true, data: await service.duplicate(req.user, req.params.id) }),
  iniciarIntento: async (req, res) => res.status(201).json({ ok: true, data: await service.startAttempt(req.user, req.params.id) }),
  enviarIntento: async (req, res) => ok(res, await service.submitAttempt(req.user, req.params.id, req.params.intentoId, req.body.respuestas), 'Evaluacion enviada'),
  resultados: async (req, res) => ok(res, await service.results(req.user, req.params.id)),
  calificarRespuesta: async (req, res) => ok(res, await service.gradeAnswer(req.user, req.params.id, req.body), 'Respuesta calificada'),
  listarForos: async (req, res) => ok(res, await service.listForums(req.user)),
  obtenerForo: async (req, res) => ok(res, await service.forumDetail(req.user, req.params.id)),
  crearForo: async (req, res) => res.status(201).json({ ok: true, data: await service.saveForum(req.user, req.body) }),
  actualizarForo: async (req, res) => ok(res, await service.saveForum(req.user, req.body, req.params.id), 'Foro actualizado'),
  subirArchivoForo: async (req, res) => {
    if (!req.file) throw new AppError('Debes seleccionar un archivo permitido', 400);
    const forum = await service.forumDetail(req.user, req.params.id);
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `foros/${forum.curso_id}/${forum.id}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from('lms-recursos').upload(storagePath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (error) throw new AppError('No se pudo subir el archivo del foro', 500, error.message);
    const { data: publicData } = supabase.storage.from('lms-recursos').getPublicUrl(storagePath);
    return ok(res, await service.saveForum(req.user, { ...forum, archivo_url: publicData.publicUrl, archivo_nombre: req.file.originalname }, forum.id), 'Archivo adjuntado');
  },
  eliminarForo: async (req, res) => ok(res, await service.removeForum(req.user, req.params.id), 'Foro eliminado'),
  responderForo: async (req, res) => ok(res, await service.respondForum(req.user, req.params.id, req.body), 'Respuesta enviada'),
  resultadosForo: async (req, res) => ok(res, await service.forumResults(req.user, req.params.id)),
  calificarForo: async (req, res) => ok(res, await service.gradeForum(req.user, req.params.id, req.body), 'Foro calificado'),
};

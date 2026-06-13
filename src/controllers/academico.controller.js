const path = require('path');

const academicoService = require('../services/academico.service');
const supabase = require('../services/supabase.service');
const AppError = require('../utils/AppError');
const estudianteService = require('../services/estudiante.service');

const ok = (res, data, message) => res.json({ ok: true, message, data });

const listarCursos = async (req, res) => {
  const rol = req.user.rol && req.user.rol.nombre;
  if (rol === 'Estudiante') {
    const ids = await estudianteService.getAssignedCourseIds(req.user.id);
    return ok(res, ids.length ? await academicoService.listCursosByIds(ids) : []);
  }
  const filters = ['Administrador', 'Instructor'].includes(rol) ? req.query : { ...req.query, estado: 'Publicado' };
  return ok(res, await academicoService.listCursos(filters));
};
const obtenerCurso = async (req, res) => ok(res, await academicoService.getCursoEstructura(req.params.id));
const obtenerCursoPublicado = async (req, res) => {
  if (req.user.rol && req.user.rol.nombre === 'Estudiante') {
    const ids = await estudianteService.getAssignedCourseIds(req.user.id);
    if (!ids.includes(Number(req.params.id))) throw new AppError('Este curso no esta asignado al estudiante', 403);
  }
  return ok(res, await academicoService.getCursoEstructura(req.params.id, { publicado: true, usuarioId: req.user.id }));
};
const crearCurso = async (req, res) => res.status(201).json({ ok: true, data: await academicoService.createCurso(req.body, req.user.id) });
const actualizarCurso = async (req, res) => ok(res, await academicoService.updateCurso(req.params.id, req.body), 'Curso actualizado');
const eliminarCurso = async (req, res) => ok(res, await academicoService.deleteCurso(req.params.id), 'Curso eliminado');
const duplicarCurso = async (req, res) => res.status(201).json({ ok: true, data: await academicoService.duplicateCurso(req.params.id, req.user.id) });
const obtenerEstudiantesCurso = async (req, res) => ok(res, await estudianteService.getCourseStudents(req.params.id));
const asignarEstudiantesCurso = async (req, res) => ok(res, await estudianteService.setCourseStudents(req.params.id, req.body.usuario_ids, req.user.id), 'Estudiantes asignados');

const listarModulos = async (req, res) => ok(res, await academicoService.listModulos(req.query.curso_id));
const crearModulo = async (req, res) => res.status(201).json({ ok: true, data: await academicoService.createModulo(req.body) });
const actualizarModulo = async (req, res) => ok(res, await academicoService.updateModulo(req.params.id, req.body), 'Modulo actualizado');
const eliminarModulo = async (req, res) => ok(res, await academicoService.deleteModulo(req.params.id), 'Modulo eliminado');
const ordenarModulo = async (req, res) => ok(res, await academicoService.reorderModulo(req.params.id, req.body.direction), 'Orden actualizado');

const listarLecciones = async (req, res) => ok(res, await academicoService.listLecciones(req.query.modulo_id));
const crearLeccion = async (req, res) => res.status(201).json({ ok: true, data: await academicoService.createLeccion(req.body) });
const actualizarLeccion = async (req, res) => ok(res, await academicoService.updateLeccion(req.params.id, req.body), 'Leccion actualizada');
const eliminarLeccion = async (req, res) => ok(res, await academicoService.deleteLeccion(req.params.id), 'Leccion eliminada');
const ordenarLeccion = async (req, res) => ok(res, await academicoService.reorderLeccion(req.params.id, req.body.direction), 'Orden actualizado');

const subirArchivo = async (req, res) => {
  if (!req.file) throw new AppError('Debes seleccionar un archivo', 400);
  const leccionId = Number(req.params.id);
  const cursoId = Number(req.body.curso_id);
  const moduloId = Number(req.body.modulo_id);
  const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${cursoId}/${moduloId}/${leccionId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from('lms-recursos').upload(storagePath, req.file.buffer, {
    contentType: req.file.mimetype,
    upsert: false,
  });
  if (error) throw new AppError('No se pudo subir el archivo', 500, error.message);

  const { data: publicData } = supabase.storage.from('lms-recursos').getPublicUrl(storagePath);
  const recurso = await academicoService.saveRecurso({
    curso_id: cursoId,
    modulo_id: moduloId,
    leccion_id: leccionId,
    nombre_original: req.file.originalname,
    nombre_interno: path.basename(storagePath),
    tipo_archivo: req.file.mimetype,
    tamano_bytes: req.file.size,
    url: publicData.publicUrl,
    storage_path: storagePath,
    subido_por: req.user.id,
  });
  res.status(201).json({ ok: true, data: recurso });
};

const completarLeccion = async (req, res) => {
  if (req.user.rol && req.user.rol.nombre === 'Estudiante' && !(await estudianteService.isLessonAssigned(req.user.id, req.params.id))) {
    throw new AppError('Esta leccion no pertenece a un curso asignado', 403);
  }
  if (req.user.rol && req.user.rol.nombre === 'Estudiante') {
    const evaluacionesService = require('../services/evaluaciones.service');
    await evaluacionesService.assertLessonUnlocked(req.user.id, req.params.id);
  }
  return ok(res, await academicoService.completeLeccion(req.user.id, req.params.id, req.body.completado !== false));
};

module.exports = {
  listarCursos, obtenerCurso, obtenerCursoPublicado, crearCurso, actualizarCurso, eliminarCurso, duplicarCurso, obtenerEstudiantesCurso, asignarEstudiantesCurso,
  listarModulos, crearModulo, actualizarModulo, eliminarModulo, ordenarModulo,
  listarLecciones, crearLeccion, actualizarLeccion, eliminarLeccion, ordenarLeccion,
  subirArchivo, completarLeccion,
};

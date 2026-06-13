const crypto = require('crypto');

const supabase = require('./supabase.service');
const AppError = require('../utils/AppError');

const throwSupabaseError = (error) => {
  if (error) throw new AppError('Error al consultar Supabase', 500, error.message);
};

const getAssignedCourseIds = async (usuarioId) => {
  const { data, error } = await supabase
    .from('curso_asignaciones')
    .select('curso_id')
    .eq('usuario_id', usuarioId)
    .neq('estado', 'Cancelado');
  throwSupabaseError(error);
  return data.map((item) => Number(item.curso_id));
};

const getAssignedCoursesProgress = async (usuarioId) => {
  const { data: assignments, error } = await supabase
    .from('curso_asignaciones')
    .select('id,estado,assigned_at,curso:cursos(*)')
    .eq('usuario_id', usuarioId)
    .neq('estado', 'Cancelado')
    .order('assigned_at', { ascending: false });
  throwSupabaseError(error);

  const courses = assignments.filter((item) => item.curso && item.curso.estado === 'Publicado');
  if (!courses.length) return [];

  const courseIds = courses.map((item) => item.curso.id);
  const { data: modules, error: modulesError } = await supabase.from('modulos').select('id,curso_id').in('curso_id', courseIds).eq('estado', 'Publicado');
  throwSupabaseError(modulesError);
  const moduleIds = modules.map((item) => item.id);
  let lessons = [];
  if (moduleIds.length) {
    const result = await supabase.from('lecciones').select('id,modulo_id,tipo_contenido,tiempo_estimado_min').in('modulo_id', moduleIds).eq('estado', 'Publicado');
    throwSupabaseError(result.error);
    lessons = result.data;
  }
  let progress = [];
  if (lessons.length) {
    const result = await supabase.from('progreso_lecciones').select('leccion_id,completado').eq('usuario_id', usuarioId).in('leccion_id', lessons.map((item) => item.id));
    throwSupabaseError(result.error);
    progress = result.data;
  }
  const completedIds = new Set(progress.filter((item) => item.completado).map((item) => item.leccion_id));
  const moduleCourse = new Map(modules.map((item) => [item.id, item.curso_id]));

  return courses.map((assignment) => {
    const courseLessons = lessons.filter((lesson) => moduleCourse.get(lesson.modulo_id) === assignment.curso.id);
    const completed = courseLessons.filter((lesson) => completedIds.has(lesson.id)).length;
    const completedMinutes = courseLessons.filter((lesson) => completedIds.has(lesson.id)).reduce((sum, lesson) => sum + Number(lesson.tiempo_estimado_min || 0), 0);
    const total = courseLessons.length;
    const avance = total ? Math.round((completed / total) * 100) : 0;
    return { ...assignment.curso, asignacion_id: assignment.id, assigned_at: assignment.assigned_at, cantidad_modulos: modules.filter((item) => Number(item.curso_id) === Number(assignment.curso.id)).length, total_lecciones: total, lecciones_completadas: completed, minutos_completados: completedMinutes, avance };
  });
};

const syncCertificates = async (usuarioId, courses) => {
  const completed = courses.filter((course) => course.total_lecciones > 0 && course.avance === 100);
  for (const course of completed) {
    const codigo = `IALS-${usuarioId}-${course.id}-${crypto.createHash('sha1').update(`${usuarioId}:${course.id}`).digest('hex').slice(0, 8).toUpperCase()}`;
    const { error } = await supabase.from('certificados').upsert({ usuario_id: usuarioId, curso_id: course.id, codigo }, { onConflict: 'usuario_id,curso_id' });
    throwSupabaseError(error);
    await supabase.from('curso_asignaciones').update({ estado: 'Completado' }).eq('usuario_id', usuarioId).eq('curso_id', course.id);
  }
};

const getDashboard = async (usuarioId) => {
  const courses = await getAssignedCoursesProgress(usuarioId);
  await syncCertificates(usuarioId, courses);
  const completed = courses.filter((course) => course.total_lecciones > 0 && course.avance === 100);
  const totalMinutes = courses.reduce((sum, course) => sum + course.minutos_completados, 0);
  const totalLessons = courses.reduce((sum, course) => sum + course.total_lecciones, 0);
  const completedLessons = courses.reduce((sum, course) => sum + course.lecciones_completadas, 0);
  const featured = courses.find((course) => course.avance < 100) || courses[0] || null;
  return {
    cursosAsignados: courses.length,
    cursosCompletados: completed.length,
    cursosPendientes: courses.length - completed.length,
    horasCapacitacion: Math.round((totalMinutes / 60) * 10) / 10,
    certificadosObtenidos: completed.length,
    notaPromedio: 0,
    rankingPersonal: 0,
    avanceGeneral: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
    pasosCompletados: completedLessons,
    pasosTotales: totalLessons,
    cursoDestacado: featured,
    cursos: courses,
  };
};

const getEvaluations = async (usuarioId) => {
  const courseIds = await getAssignedCourseIds(usuarioId);
  if (!courseIds.length) return [];
  const { data: modules, error } = await supabase.from('modulos').select('id,curso_id,curso:cursos(id,nombre)').in('curso_id', courseIds).eq('estado', 'Publicado');
  throwSupabaseError(error);
  if (!modules.length) return [];
  const { data: lessons, error: lessonError } = await supabase.from('lecciones').select('id,modulo_id,titulo,descripcion,tiempo_estimado_min').in('modulo_id', modules.map((item) => item.id)).eq('tipo_contenido', 'Evaluacion').eq('estado', 'Publicado');
  throwSupabaseError(lessonError);
  const moduleMap = new Map(modules.map((item) => [item.id, item]));
  return lessons.map((lesson) => ({ ...lesson, curso: moduleMap.get(lesson.modulo_id).curso }));
};

const getCertificates = async (usuarioId) => {
  const courses = await getAssignedCoursesProgress(usuarioId);
  await syncCertificates(usuarioId, courses);
  const { data, error } = await supabase.from('certificados').select('id,codigo,emitido_at,curso:cursos(id,nombre,categoria)').eq('usuario_id', usuarioId).order('emitido_at', { ascending: false });
  throwSupabaseError(error);
  return data;
};

const getAssignments = async (usuarioId) => {
  const { data, error } = await supabase.from('curso_asignaciones').select('curso_id').eq('usuario_id', usuarioId).neq('estado', 'Cancelado');
  throwSupabaseError(error);
  return data.map((item) => item.curso_id);
};

const setAssignments = async (usuarioId, courseIds, assignedBy) => {
  const ids = [...new Set((courseIds || []).map(Number).filter(Number.isInteger))];
  const { error: deleteError } = await supabase.from('curso_asignaciones').delete().eq('usuario_id', usuarioId);
  throwSupabaseError(deleteError);
  if (ids.length) {
    const { error } = await supabase.from('curso_asignaciones').insert(ids.map((cursoId) => ({ usuario_id: usuarioId, curso_id: cursoId, asignado_por: assignedBy })));
    throwSupabaseError(error);
  }
  return ids;
};

const isLessonAssigned = async (usuarioId, lessonId) => {
  const courseIds = await getAssignedCourseIds(usuarioId);
  if (!courseIds.length) return false;
  const { data, error } = await supabase.from('lecciones').select('modulo:modulos(curso_id)').eq('id', lessonId).maybeSingle();
  throwSupabaseError(error);
  return Boolean(data && data.modulo && courseIds.includes(Number(data.modulo.curso_id)));
};

module.exports = { getAssignedCourseIds, getDashboard, getEvaluations, getCertificates, getAssignments, setAssignments, isLessonAssigned };

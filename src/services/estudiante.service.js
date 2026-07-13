const crypto = require('crypto');

const supabase = require('./supabase.service');
const AppError = require('../utils/AppError');

const throwSupabaseError = (error) => {
  if (error) throw new AppError('Error al consultar Supabase', 500, error.message);
};

const buildCertificateCode = (usuarioId, cursoId) => (
  `IALS-${usuarioId}-${cursoId}-${crypto.createHash('sha1').update(`${usuarioId}:${cursoId}`).digest('hex').slice(0, 8).toUpperCase()}`
);

const DEFAULT_CERTIFICATE_TEMPLATE = {
  nombre: 'Diploma IA Learning Solutions',
  titulo: 'Diploma de finalizacion de curso',
  subtitulo: '{{curso}}',
  cuerpo: 'Certificado emitido para {{nombre}} el {{fecha}}.',
  firma_nombre: 'Pablo Gutierrez Campos',
  firma_cargo: 'Director General',
  color_principal: '#00d8ff',
  fondo_url: '/assets/certificates/ials-diploma-template.png',
};

const formatCertificateDate = (value) => {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
};

const replaceCertificatePlaceholders = (value, fields) => String(value || '')
  .replaceAll('{{nombre}}', fields.nombre)
  .replaceAll('{{curso}}', fields.curso)
  .replaceAll('{{fecha}}', fields.fecha);

const applyCertificateTemplate = (template, certificate, user) => {
  const base = template || DEFAULT_CERTIFICATE_TEMPLATE;
  const fields = {
    nombre: user?.Nombres || user?.usuario || 'Participante',
    curso: certificate.curso?.nombre || 'Curso finalizado',
    fecha: formatCertificateDate(certificate.emitido_at),
  };
  return {
    ...base,
    titulo_render: replaceCertificatePlaceholders(base.titulo, fields),
    subtitulo_render: replaceCertificatePlaceholders(base.subtitulo, fields),
    cuerpo_render: replaceCertificatePlaceholders(base.cuerpo, fields),
    participante: fields.nombre,
    curso_finalizado: fields.curso,
    fecha_emision: fields.fecha,
  };
};

const isCertificateSchemaError = (error) => {
  if (!error) return false;
  const message = [error.message, error.details, error.hint, error.code].filter(Boolean).join(' ');
  return /schema cache|column .*does not exist|Could not find .* column|PGRST204|42703|codigo|emitido_at/i.test(message);
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

  const evaluacionesService = require('./evaluaciones.service');
  return Promise.all(courses.map(async (assignment) => {
    const courseLessons = lessons.filter((lesson) => moduleCourse.get(lesson.modulo_id) === assignment.curso.id);
    const completedLessons = courseLessons.filter((lesson) => completedIds.has(lesson.id)).length;
    const completedMinutes = courseLessons.filter((lesson) => completedIds.has(lesson.id)).reduce((sum, lesson) => sum + Number(lesson.tiempo_estimado_min || 0), 0);
    const courseMinutes = courseLessons.reduce((sum, lesson) => sum + Number(lesson.tiempo_estimado_min || 0), 0);
    const activities = await evaluacionesService.courseActivities(assignment.curso.id, usuarioId);
    const completedActivities = activities.filter((activity) => activity.completada).length;
    const total = courseLessons.length + activities.length;
    const completed = completedLessons + completedActivities;
    const avance = total ? Math.round((completed / total) * 100) : 0;
    return { ...assignment.curso, duracion_estimada_min: courseMinutes || Number(assignment.curso.duracion_estimada_min || 0), asignacion_id: assignment.id, assigned_at: assignment.assigned_at, cantidad_modulos: modules.filter((item) => Number(item.curso_id) === Number(assignment.curso.id)).length, total_lecciones: total, lecciones_completadas: completed, total_actividades: activities.length, actividades_completadas: completedActivities, minutos_completados: completedMinutes, avance };
  }));
};

const syncCertificates = async (usuarioId, courses) => {
  const completed = courses.filter((course) => course.total_lecciones > 0 && course.avance === 100);
  for (const course of completed) {
    const codigo = buildCertificateCode(usuarioId, course.id);
    const { error } = await supabase.from('certificados').upsert({ usuario_id: usuarioId, curso_id: course.id, codigo }, { onConflict: 'usuario_id,curso_id' });
    if (error && !isCertificateSchemaError(error)) throwSupabaseError(error);
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
  const evaluacionesService = require('./evaluaciones.service');
  return evaluacionesService.listStudent(usuarioId);
};

const getCertificates = async (usuarioId) => {
  const courses = await getAssignedCoursesProgress(usuarioId);
  await syncCertificates(usuarioId, courses);
  const { data, error } = await supabase.from('certificados').select('id,codigo,emitido_at,curso:cursos(id,nombre,categoria)').eq('usuario_id', usuarioId).order('emitido_at', { ascending: false });
  const { data: user } = await supabase.from('usuarios').select('id,"Nombres",usuario').eq('id', usuarioId).maybeSingle();
  const enrich = async (certificates) => {
    if (!certificates.length) return [];
    const courseIds = certificates.map((certificate) => certificate.curso?.id || certificate.curso_id).filter(Boolean);
    const { data: templates } = await supabase
      .from('certificado_plantillas')
      .select('*')
      .eq('activo', true)
      .or(courseIds.length ? `curso_id.is.null,curso_id.in.(${courseIds.join(',')})` : 'curso_id.is.null')
      .order('curso_id', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    return certificates.map((certificate) => {
      const courseId = certificate.curso?.id || certificate.curso_id;
      const template = (templates || []).find((item) => Number(item.curso_id) === Number(courseId)) || (templates || []).find((item) => item.curso_id === null) || DEFAULT_CERTIFICATE_TEMPLATE;
      return {
        ...certificate,
        plantilla: applyCertificateTemplate(template, certificate, user),
      };
    });
  };
  if (!error) return enrich(data || []);
  if (!isCertificateSchemaError(error)) throwSupabaseError(error);

  const fallback = await supabase.from('certificados').select('id,curso_id,curso:cursos(id,nombre,categoria)').eq('usuario_id', usuarioId);
  if (fallback.error) {
    if (isCertificateSchemaError(fallback.error)) return [];
    throwSupabaseError(fallback.error);
  }
  return enrich(fallback.data.map((certificate) => ({
    ...certificate,
    codigo: buildCertificateCode(usuarioId, certificate.curso_id || certificate.curso?.id),
    emitido_at: null,
  })));
};

const finishCourse = async (usuarioId, cursoId) => {
  const courseId = Number(cursoId);
  if (!Number.isInteger(courseId)) throw new AppError('Curso invalido', 400);

  const courses = await getAssignedCoursesProgress(usuarioId);
  const course = courses.find((item) => Number(item.id) === courseId);
  if (!course) throw new AppError('Curso no asignado al estudiante', 404);
  if (course.total_lecciones <= 0 || course.avance < 100) {
    throw new AppError('Completa todos los pasos del curso antes de generar el certificado', 400);
  }

  await syncCertificates(usuarioId, courses);
  const certificates = await getCertificates(usuarioId);
  const certificate = certificates.find((item) => Number(item.curso?.id || item.curso_id) === courseId);
  if (!certificate) throw new AppError('No se pudo generar el certificado del curso', 500);
  return certificate;
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

const getCourseStudents = async (cursoId) => {
  const { data: role, error: roleError } = await supabase.from('roles').select('id').eq('nombre', 'Estudiante').maybeSingle();
  throwSupabaseError(roleError);
  if (!role) return [];
  const { data: users, error: usersError } = await supabase.from('usuarios').select('id,"Nombres",usuario,"Correo","Estado"').eq('rol_id', role.id).order('Nombres');
  throwSupabaseError(usersError);
  const { data: assignments, error } = await supabase.from('curso_asignaciones').select('usuario_id').eq('curso_id', cursoId).neq('estado', 'Cancelado');
  throwSupabaseError(error);
  const selected = new Set(assignments.map((item) => Number(item.usuario_id)));
  return users.map((user) => ({ ...user, asignado: selected.has(Number(user.id)) }));
};

const setCourseStudents = async (cursoId, usuarioIds, assignedBy) => {
  const ids = [...new Set((usuarioIds || []).map(Number).filter(Number.isInteger))];
  const { data: role, error: roleError } = await supabase.from('roles').select('id').eq('nombre', 'Estudiante').maybeSingle();
  throwSupabaseError(roleError);
  if (ids.length) {
    const { data: validUsers, error: usersError } = await supabase.from('usuarios').select('id').eq('rol_id', role.id).in('id', ids);
    throwSupabaseError(usersError);
    if (validUsers.length !== ids.length) throw new AppError('Solo se puede asignar el curso a usuarios con rol Estudiante', 400);
  }
  const { error: deleteError } = await supabase.from('curso_asignaciones').delete().eq('curso_id', cursoId);
  throwSupabaseError(deleteError);
  if (ids.length) {
    const { error } = await supabase.from('curso_asignaciones').insert(ids.map((usuarioId) => ({ usuario_id: usuarioId, curso_id: Number(cursoId), asignado_por: assignedBy })));
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

module.exports = { getAssignedCourseIds, getDashboard, getEvaluations, getCertificates, finishCourse, getAssignments, setAssignments, getCourseStudents, setCourseStudents, isLessonAssigned };

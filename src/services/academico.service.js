const sanitizeHtml = require('sanitize-html');
const courseSequence = require('./course-sequence.service');

const supabase = require('./supabase.service');
const AppError = require('../utils/AppError');

const ESTADOS = ['Borrador', 'Publicado', 'Inactivo'];
const TIPOS_CONTENIDO = ['Texto', 'URL', 'HTML', 'Archivo', 'Video', 'Evaluacion'];
const PUBLIC_COURSE_FIELDS = 'id,nombre,descripcion_corta,descripcion_completa,imagen_portada_url,categoria,campana_area,duracion_estimada_min,modulos_planificados,pasos_planificados,es_gratis,estado,created_at,modulos(count)';
const OPTIONAL_COURSE_COLUMNS = ['es_gratis', 'modulos_planificados', 'pasos_planificados'];

const throwSupabaseError = (error, message = 'Error al consultar Supabase') => {
  if (!error) return;
  if (error.code === '23505') throw new AppError('El orden indicado ya esta ocupado', 409, error.message);
  if (error.code === '23503') throw new AppError('La operacion referencia un registro inexistente', 400, error.message);
  throw new AppError(message, 500, error.message);
};

const isMissingColumnError = (error, column) => {
  const message = [error && error.message, error && error.details].filter(Boolean).join(' ');
  return new RegExp(`Could not find the '${column}' column|column (?:\\w+\\.)?"?${column}"? does not exist|schema cache`, 'i').test(message);
};

const isMissingOptionalCourseColumn = (error) => OPTIONAL_COURSE_COLUMNS.some((column) => isMissingColumnError(error, column));

const stripOptionalCourseColumns = (payload) => {
  const clean = { ...payload };
  OPTIONAL_COURSE_COLUMNS.forEach((column) => delete clean[column]);
  return clean;
};

const withCourseDefaults = (curso) => ({
  ...curso,
  es_gratis: curso.es_gratis === true,
  modulos_planificados: Number(curso.modulos_planificados || 0),
  pasos_planificados: Number(curso.pasos_planificados || 0),
});

const prepareCoursePayload = (payload) => ({
  ...payload,
  es_gratis: payload.es_gratis === true,
  modulos_planificados: Math.max(0, Number(payload.modulos_planificados || 0)),
  pasos_planificados: Math.max(0, Number(payload.pasos_planificados || 0)),
});

const emptyCourseStats = () => ({
  durationMinutes: 0,
  modules: 0,
  steps: 0,
});

const getCourseStructureStats = async (courseIds = []) => {
  const ids = [...new Set((courseIds || []).map((id) => Number(id)).filter(Boolean))];
  const stats = new Map(ids.map((id) => [id, emptyCourseStats()]));
  if (!ids.length) return stats;

  const { data: modules, error: modulesError } = await supabase
    .from('modulos')
    .select('id,curso_id')
    .in('curso_id', ids);
  throwSupabaseError(modulesError);

  (modules || []).forEach((module) => {
    const item = stats.get(Number(module.curso_id));
    if (item) item.modules += 1;
  });

  const moduleIds = (modules || []).map((module) => module.id);
  if (moduleIds.length) {
    const { data: lessons, error: lessonsError } = await supabase
      .from('lecciones')
      .select('modulo_id,tiempo_estimado_min')
      .in('modulo_id', moduleIds);
    throwSupabaseError(lessonsError);

    const moduleToCourse = new Map((modules || []).map((module) => [Number(module.id), Number(module.curso_id)]));
    (lessons || []).forEach((lesson) => {
      const courseId = moduleToCourse.get(Number(lesson.modulo_id));
      const item = stats.get(courseId);
      if (!item) return;
      item.steps += 1;
      item.durationMinutes += Number(lesson.tiempo_estimado_min || 0);
    });
  }

  const evaluations = await supabase
    .from('evaluaciones')
    .select('curso_id,tiempo_limite_min')
    .in('curso_id', ids);
  if (!evaluations.error) {
    (evaluations.data || []).forEach((evaluation) => {
      const item = stats.get(Number(evaluation.curso_id));
      if (!item) return;
      item.steps += 1;
      item.durationMinutes += Number(evaluation.tiempo_limite_min || 0);
    });
  }

  const forums = await supabase
    .from('foros_evaluables')
    .select('curso_id')
    .in('curso_id', ids);
  if (!forums.error) {
    (forums.data || []).forEach((forum) => {
      const item = stats.get(Number(forum.curso_id));
      if (item) item.steps += 1;
    });
  }

  return stats;
};

const applyComputedCourseStats = async (courses = []) => {
  const stats = await getCourseStructureStats(courses.map((curso) => curso.id));
  return courses.map((curso) => {
    const item = stats.get(Number(curso.id)) || emptyCourseStats();
    return {
      ...curso,
      duracion_estimada_min: item.durationMinutes || Number(curso.duracion_estimada_min || 0),
      cantidad_modulos: item.modules || (curso.modulos && curso.modulos[0] ? curso.modulos[0].count : 0),
      pasos_planificados: item.steps || Number(curso.pasos_planificados || 0),
      modulos: undefined,
    };
  });
};

const assertEstado = (estado) => {
  if (estado && !ESTADOS.includes(estado)) throw new AppError('Estado academico invalido', 400);
};

const sanitizeEmbeddedHtml = (html) => sanitizeHtml(html || '', {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['iframe', 'video', 'source']),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    iframe: ['src', 'title', 'width', 'height', 'allow', 'allowfullscreen', 'loading', 'referrerpolicy'],
    video: ['src', 'controls', 'width', 'height', 'poster'],
    source: ['src', 'type'],
    '*': ['class', 'style'],
  },
  allowedSchemes: ['http', 'https', 'data'],
  allowedIframeHostnames: [
    'www.youtube.com', 'youtube.com', 'player.vimeo.com', 'view.genially.com',
    'www.canva.com', 'docs.google.com', 'forms.gle', 'app.powerbi.com',
  ],
  allowProtocolRelative: false,
});

const nextOrder = async (table, foreignKey, foreignId) => {
  const { data, error } = await supabase
    .from(table)
    .select('orden')
    .eq(foreignKey, foreignId)
    .order('orden', { ascending: false })
    .limit(1);
  throwSupabaseError(error);
  return data.length ? data[0].orden + 1 : 1;
};

const listCursos = async ({ estado, categoria, search } = {}) => {
  let query = supabase
    .from('cursos')
    .select('*, creador:usuarios(id,"Nombres",usuario), modulos(count)')
    .order('created_at', { ascending: false });
  if (estado) query = query.eq('estado', estado);
  if (categoria) query = query.eq('categoria', categoria);
  if (search) query = query.ilike('nombre', `%${search}%`);
  const { data, error } = await query;
  throwSupabaseError(error);
  return applyComputedCourseStats(data);
};

const listPublicCourses = async ({ categoria, search } = {}) => {
  let query = supabase
    .from('cursos')
    .select(PUBLIC_COURSE_FIELDS)
    .eq('estado', 'Publicado')
    .order('created_at', { ascending: false });
  if (categoria) query = query.eq('categoria', categoria);
  if (search) query = query.ilike('nombre', `%${search}%`);
  let { data, error } = await query;
  if (isMissingOptionalCourseColumn(error)) {
    let fallbackQuery = supabase
      .from('cursos')
      .select(OPTIONAL_COURSE_COLUMNS.reduce((fields, column) => fields.replace(`,${column}`, ''), PUBLIC_COURSE_FIELDS))
      .eq('estado', 'Publicado')
      .order('created_at', { ascending: false });
    if (categoria) fallbackQuery = fallbackQuery.eq('categoria', categoria);
    if (search) fallbackQuery = fallbackQuery.ilike('nombre', `%${search}%`);
    const fallback = await fallbackQuery;
    data = (fallback.data || []).map(withCourseDefaults);
    error = fallback.error;
  }
  throwSupabaseError(error);
  return applyComputedCourseStats(data);
};

const listCursosByIds = async (ids) => {
  const { data, error } = await supabase.from('cursos').select('*, modulos(count)').in('id', ids).eq('estado', 'Publicado').order('created_at', { ascending: false });
  throwSupabaseError(error);
  return applyComputedCourseStats(data);
};

const getCurso = async (id) => {
  const { data, error } = await supabase.from('cursos').select('*').eq('id', id).maybeSingle();
  throwSupabaseError(error);
  if (!data) throw new AppError('Curso no encontrado', 404);
  return data;
};

const getCursoEstructura = async (id, { publicado = false, usuarioId = null } = {}) => {
  const curso = await getCurso(id);
  if (publicado && curso.estado !== 'Publicado') throw new AppError('Curso no disponible', 404);

  let modulosQuery = supabase.from('modulos').select('*').eq('curso_id', id).order('orden');
  if (publicado) modulosQuery = modulosQuery.eq('estado', 'Publicado');
  const { data: modulos, error: modulosError } = await modulosQuery;
  throwSupabaseError(modulosError);

  const moduloIds = modulos.map((modulo) => modulo.id);
  let lecciones = [];
  if (moduloIds.length) {
    let leccionesQuery = supabase
      .from('lecciones')
      .select('*, recursos(*)')
      .in('modulo_id', moduloIds)
      .order('orden');
    if (publicado) leccionesQuery = leccionesQuery.eq('estado', 'Publicado');
    const result = await leccionesQuery;
    throwSupabaseError(result.error);
    lecciones = result.data;
  }

  let progreso = [];
  if (usuarioId && lecciones.length) {
    const result = await supabase
      .from('progreso_lecciones')
      .select('leccion_id,completado,completado_at')
      .eq('usuario_id', usuarioId)
      .in('leccion_id', lecciones.map((leccion) => leccion.id));
    throwSupabaseError(result.error);
    progreso = result.data;
  }
  const progresoMap = new Map(progreso.map((item) => [item.leccion_id, item]));

  const evaluacionesService = require('./evaluaciones.service');
  const actividades = await evaluacionesService.courseActivities(Number(id), usuarioId, { publishedOnly: publicado });

  const lockedLessonIds = new Set();
  if (publicado && usuarioId && actividades.length) {
    let locked = false;
    modulos.forEach((modulo) => {
      const moduleItems = [
        ...lecciones.filter((leccion) => Number(leccion.modulo_id) === Number(modulo.id)).map((leccion) => ({ ...leccion, tipo_secuencia: 'Leccion' })),
        ...actividades.filter((actividad) => actividad.orden != null && Number(actividad.modulo_id) === Number(modulo.id)).map((actividad) => ({ ...actividad, tipo_secuencia: 'Actividad' })),
      ].sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));
      moduleItems.forEach((item) => {
        if (item.tipo_secuencia === 'Leccion') {
          if (locked) lockedLessonIds.add(item.id);
          actividades.filter((actividad) => actividad.orden == null && actividad.ubicacion === 'DespuesPaso' && Number(actividad.leccion_id) === Number(item.id)).forEach((actividad) => {
            if (actividad.obligatoria && actividad.bloquea_avance && !actividad.completada) locked = true;
          });
        } else if (item.obligatoria && item.bloquea_avance && !item.completada) locked = true;
      });
      actividades.filter((actividad) => actividad.orden == null && actividad.ubicacion === 'FinModulo' && Number(actividad.modulo_id) === Number(modulo.id)).forEach((actividad) => {
        if (actividad.obligatoria && actividad.bloquea_avance && !actividad.completada) locked = true;
      });
    });
  }

  return {
    ...curso,
    actividades,
    modulos: modulos.map((modulo) => ({
      ...modulo,
      lecciones: lecciones
        .filter((leccion) => leccion.modulo_id === modulo.id)
        .map((leccion) => lockedLessonIds.has(leccion.id) ? ({ ...leccion, contenido_texto: null, contenido_html: null, url_externa: null, recursos: [], bloqueado: true, progreso: progresoMap.get(leccion.id) || null }) : ({ ...leccion, bloqueado: false, progreso: progresoMap.get(leccion.id) || null })),
    })),
  };
};

const createCurso = async (payload, userId) => {
  assertEstado(payload.estado);
  if (!payload.nombre || !payload.nombre.trim()) throw new AppError('El nombre del curso es obligatorio', 400);
  const cursoPayload = prepareCoursePayload(payload);
  const { data, error } = await supabase
    .from('cursos')
    .insert({ ...cursoPayload, nombre: payload.nombre.trim(), creado_por: userId })
    .select('*')
    .single();
  if (isMissingOptionalCourseColumn(error)) {
    const fallbackPayload = stripOptionalCourseColumns(cursoPayload);
    const fallback = await supabase
      .from('cursos')
      .insert({ ...fallbackPayload, nombre: payload.nombre.trim(), creado_por: userId })
      .select('*')
      .single();
    throwSupabaseError(fallback.error);
    return withCourseDefaults(fallback.data);
  }
  throwSupabaseError(error);
  return withCourseDefaults(data);
};

const updateCurso = async (id, payload) => {
  assertEstado(payload.estado);
  const cursoPayload = prepareCoursePayload(payload);
  const { data, error } = await supabase
    .from('cursos')
    .update({ ...cursoPayload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (isMissingOptionalCourseColumn(error)) {
    const fallbackPayload = stripOptionalCourseColumns(cursoPayload);
    const fallback = await supabase
      .from('cursos')
      .update({ ...fallbackPayload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    throwSupabaseError(fallback.error);
    if (!fallback.data) throw new AppError('Curso no encontrado', 404);
    return withCourseDefaults(fallback.data);
  }
  throwSupabaseError(error);
  if (!data) throw new AppError('Curso no encontrado', 404);
  return withCourseDefaults(data);
};

const deleteCurso = async (id) => {
  const curso = await getCurso(id);
  const { error } = await supabase.from('cursos').delete().eq('id', id);
  throwSupabaseError(error);
  return curso;
};

const duplicateCurso = async (id, userId) => {
  const original = await getCursoEstructura(id);
  const { id: ignoredId, created_at: ignoredCreated, updated_at: ignoredUpdated, modulos, ...cursoPayload } = original;
  const copia = await createCurso({ ...cursoPayload, nombre: `${original.nombre} (copia)`, estado: 'Borrador' }, userId);
  for (const modulo of modulos) {
    const { id: ignoredModuloId, curso_id: ignoredCurso, created_at, updated_at, lecciones, ...moduloPayload } = modulo;
    const moduloCopia = await createModulo({ ...moduloPayload, curso_id: copia.id, estado: 'Borrador' });
    for (const leccion of lecciones) {
      const { id: ignoredLeccionId, modulo_id, created_at: lc, updated_at: lu, recursos, progreso, ...leccionPayload } = leccion;
      await createLeccion({ ...leccionPayload, modulo_id: moduloCopia.id, estado: 'Borrador' });
    }
  }
  return getCursoEstructura(copia.id);
};

const listModulos = async (cursoId) => {
  const { data, error } = await supabase.from('modulos').select('*, lecciones(count)').eq('curso_id', cursoId).order('orden');
  throwSupabaseError(error);
  return data.map((modulo) => ({ ...modulo, cantidad_lecciones: modulo.lecciones[0] ? modulo.lecciones[0].count : 0 }));
};

const createModulo = async (payload) => {
  assertEstado(payload.estado);
  if (!payload.curso_id || !payload.nombre) throw new AppError('Curso y nombre del modulo son obligatorios', 400);
  const orden = payload.orden || await nextOrder('modulos', 'curso_id', payload.curso_id);
  const { data, error } = await supabase.from('modulos').insert({ ...payload, orden }).select('*').single();
  throwSupabaseError(error);
  return data;
};

const updateModulo = async (id, payload) => {
  assertEstado(payload.estado);
  const { data, error } = await supabase.from('modulos').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id).select('*').maybeSingle();
  throwSupabaseError(error);
  if (!data) throw new AppError('Modulo no encontrado', 404);
  return data;
};

const deleteModulo = async (id) => {
  const { data, error } = await supabase.from('modulos').delete().eq('id', id).select('*').maybeSingle();
  throwSupabaseError(error);
  if (!data) throw new AppError('Modulo no encontrado', 404);
  return data;
};

const reorderModulo = async (id, direction) => reorderItem('modulos', id, 'curso_id', direction);

const listLecciones = async (moduloId) => {
  const { data, error } = await supabase.from('lecciones').select('*, recursos(*)').eq('modulo_id', moduloId).order('orden');
  throwSupabaseError(error);
  return data;
};

const prepareLeccionPayload = (payload) => {
  const clean = { ...payload };
  assertEstado(clean.estado);
  if (clean.tipo_contenido && !TIPOS_CONTENIDO.includes(clean.tipo_contenido)) throw new AppError('Tipo de contenido invalido', 400);
  if (clean.tipo_contenido === 'HTML' || clean.contenido_html !== undefined) clean.contenido_html = sanitizeEmbeddedHtml(clean.contenido_html);
  if (clean.url_externa) {
    try { new URL(clean.url_externa); } catch (error) { throw new AppError('La URL no es valida', 400); }
  }
  return clean;
};

const createLeccion = async (payload) => {
  const clean = prepareLeccionPayload(payload);
  if (!clean.modulo_id || !clean.titulo) throw new AppError('Modulo y titulo de la leccion son obligatorios', 400);
  clean.orden = clean.orden || await courseSequence.nextOrder(clean.modulo_id);
  const { data, error } = await supabase.from('lecciones').insert(clean).select('*, recursos(*)').single();
  throwSupabaseError(error);
  return data;
};

const updateLeccion = async (id, payload) => {
  const clean = prepareLeccionPayload(payload);
  const { data, error } = await supabase.from('lecciones').update({ ...clean, updated_at: new Date().toISOString() }).eq('id', id).select('*, recursos(*)').maybeSingle();
  throwSupabaseError(error);
  if (!data) throw new AppError('Leccion no encontrada', 404);
  return data;
};

const deleteLeccion = async (id) => {
  const { data, error } = await supabase.from('lecciones').delete().eq('id', id).select('*').maybeSingle();
  throwSupabaseError(error);
  if (!data) throw new AppError('Leccion no encontrada', 404);
  return data;
};

const reorderLeccion = async (id, direction) => courseSequence.reorder('Leccion', id, direction);

const reorderItem = async (table, id, parentKey, direction) => {
  if (!['up', 'down'].includes(direction)) throw new AppError('Direccion de orden invalida', 400);
  const { data: current, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
  throwSupabaseError(error);
  if (!current) throw new AppError('Elemento no encontrado', 404);
  const operator = direction === 'up' ? 'lt' : 'gt';
  let query = supabase.from(table).select('*').eq(parentKey, current[parentKey]);
  query = query[operator]('orden', current.orden).order('orden', { ascending: direction !== 'up' }).limit(1);
  const neighborResult = await query;
  throwSupabaseError(neighborResult.error);
  if (!neighborResult.data.length) return current;
  const neighbor = neighborResult.data[0];
  const temporaryOrder = 2000000000 + Number(current.id);
  throwSupabaseError((await supabase.from(table).update({ orden: temporaryOrder }).eq('id', current.id)).error);
  throwSupabaseError((await supabase.from(table).update({ orden: current.orden }).eq('id', neighbor.id)).error);
  throwSupabaseError((await supabase.from(table).update({ orden: neighbor.orden }).eq('id', current.id)).error);
  return { ...current, orden: neighbor.orden };
};

const saveRecurso = async (payload) => {
  const { data, error } = await supabase.from('recursos').insert(payload).select('*').single();
  throwSupabaseError(error);
  return data;
};

const completeLeccion = async (usuarioId, leccionId, completado = true) => {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from('progreso_lecciones').upsert({
    usuario_id: usuarioId,
    leccion_id: leccionId,
    completado,
    completado_at: completado ? now : null,
    updated_at: now,
  }, { onConflict: 'usuario_id,leccion_id' }).select('*').single();
  throwSupabaseError(error);
  return data;
};

module.exports = {
  listCursos, listPublicCourses, listCursosByIds, getCurso, getCursoEstructura, createCurso, updateCurso, deleteCurso, duplicateCurso,
  listModulos, createModulo, updateModulo, deleteModulo, reorderModulo,
  listLecciones, createLeccion, updateLeccion, deleteLeccion, reorderLeccion,
  saveRecurso, completeLeccion,
};

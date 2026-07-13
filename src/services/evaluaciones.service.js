const supabase = require('./supabase.service');
const AppError = require('../utils/AppError');
const estudianteService = require('./estudiante.service');
const courseSequence = require('./course-sequence.service');

const fail = (error, message = 'Error al consultar Supabase') => {
  if (error) throw new AppError(message, 500, error.message);
};
const missingEvaluationSchema = (error) => error && ['42P01', 'PGRST204', 'PGRST205'].includes(error.code);

const missingColumn = (error) => {
  const text = `${error && error.message ? error.message : ''} ${error && error.details ? error.details : ''}`;
  const match = text.match(/column "([^"]+)" (?:of relation "[^"]+" )?does not exist/i)
    || text.match(/'([^']+)' column of '[^']+' in the schema cache/i);
  return match ? match[1] : null;
};

const withoutColumn = (payload, column) => {
  if (Array.isArray(payload)) return payload.map((item) => withoutColumn(item, column));
  const { [column]: removed, ...rest } = payload;
  return rest;
};

const insertSingle = async (table, payload) => {
  let current = payload;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await supabase.from(table).insert(current).select('*').single();
    if (!error) return data;
    const column = missingColumn(error);
    if (!column || !(column in current)) fail(error);
    current = withoutColumn(current, column);
  }
  throw new AppError('No se pudo guardar la evaluacion', 500);
};

const insertMany = async (table, rows) => {
  if (!rows.length) return;
  let current = rows;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { error } = await supabase.from(table).insert(current);
    if (!error) return;
    const column = missingColumn(error);
    if (!column || !(column in current[0])) fail(error);
    current = withoutColumn(current, column);
  }
  throw new AppError('No se pudo guardar la evaluacion', 500);
};

const updateRows = async (table, payload, applyFilter) => {
  let current = payload;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { error } = await applyFilter(supabase.from(table).update(current));
    if (!error) return;
    const column = missingColumn(error);
    if (!column || !(column in current)) fail(error);
    current = withoutColumn(current, column);
  }
  throw new AppError('No se pudo guardar la evaluacion', 500);
};

const normalizeDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  const match = String(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!match) return null;
  const [, day, month, year, hour = '00', minute = '00'] = match;
  const local = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  return Number.isNaN(local.getTime()) ? null : local.toISOString();
};

const roleName = (user) => user && user.rol && user.rol.nombre;
const isManager = (user) => ['Administrador', 'Instructor'].includes(roleName(user));

const assertCourseAccess = async (user, courseId) => {
  if (roleName(user) === 'Administrador') return;
  if (roleName(user) === 'Instructor') {
    const { data, error } = await supabase.from('cursos').select('id').eq('id', courseId).eq('creado_por', user.id).maybeSingle();
    fail(error);
    if (!data) throw new AppError('No tienes permisos sobre este curso', 403);
    return;
  }
  const ids = await estudianteService.getAssignedCourseIds(user.id);
  if (!ids.includes(Number(courseId))) throw new AppError('Esta actividad no pertenece a un curso asignado', 403);
};

const uniqueIds = (items, key) => [...new Set(items.map((item) => item[key]).filter(Boolean).map(Number))];
const mapById = (items = []) => new Map(items.map((item) => [Number(item.id), item]));

const hydrateEvaluationRelations = async (items, { includeCreator = false } = {}) => {
  const evaluations = Array.isArray(items) ? items : [items];
  if (!evaluations.length) return Array.isArray(items) ? [] : null;

  const courseIds = uniqueIds(evaluations, 'curso_id');
  const moduleIds = uniqueIds(evaluations, 'modulo_id');
  const lessonIds = uniqueIds(evaluations, 'leccion_id');
  const creatorIds = includeCreator ? uniqueIds(evaluations, 'creado_por') : [];

  const [coursesResult, modulesResult, lessonsResult, creatorsResult] = await Promise.all([
    courseIds.length ? supabase.from('cursos').select('id,nombre,creado_por').in('id', courseIds) : Promise.resolve({ data: [], error: null }),
    moduleIds.length ? supabase.from('modulos').select('id,nombre').in('id', moduleIds) : Promise.resolve({ data: [], error: null }),
    lessonIds.length ? supabase.from('lecciones').select('id,titulo').in('id', lessonIds) : Promise.resolve({ data: [], error: null }),
    creatorIds.length ? supabase.from('usuarios').select('id,"Nombres",usuario').in('id', creatorIds) : Promise.resolve({ data: [], error: null }),
  ]);

  fail(coursesResult.error);
  fail(modulesResult.error);
  fail(lessonsResult.error);
  fail(creatorsResult.error);

  const courses = mapById(coursesResult.data);
  const modules = mapById(modulesResult.data);
  const lessons = mapById(lessonsResult.data);
  const creators = mapById(creatorsResult.data);

  const hydrated = evaluations.map((evaluation) => ({
    ...evaluation,
    titulo: evaluation.titulo || evaluation.nombre || '',
    curso: courses.get(Number(evaluation.curso_id)) || null,
    modulo: evaluation.modulo_id ? modules.get(Number(evaluation.modulo_id)) || null : null,
    leccion: evaluation.leccion_id ? lessons.get(Number(evaluation.leccion_id)) || null : null,
    creador: includeCreator && evaluation.creado_por ? creators.get(Number(evaluation.creado_por)) || null : evaluation.creador,
  }));

  return Array.isArray(items) ? hydrated : hydrated[0];
};

const getEvaluation = async (id) => {
  const { data, error } = await supabase.from('evaluaciones').select('*').eq('id', id).maybeSingle();
  fail(error);
  if (!data) throw new AppError('Evaluacion no encontrada', 404);
  return hydrateEvaluationRelations(data, { includeCreator: true });
};

const getQuestions = async (evaluationId, includeAnswers = true) => {
  const { data, error } = await supabase.from('evaluacion_preguntas').select('*, opciones:evaluacion_opciones(*)').eq('evaluacion_id', evaluationId).eq('activo', true).order('orden');
  fail(error);
  return data.map((question) => ({
    ...question,
    opciones: (question.opciones || []).sort((a, b) => a.orden - b.orden).map((option) => includeAnswers ? option : ({ id: option.id, pregunta_id: option.pregunta_id, texto: option.texto, orden: option.orden })),
  }));
};

const list = async (user, filters = {}) => {
  if (roleName(user) === 'Estudiante') return listStudent(user.id);
  let query = supabase.from('evaluaciones').select('*, preguntas:evaluacion_preguntas(count), intentos:evaluacion_intentos(id,usuario_id,porcentaje,estado)').order('created_at', { ascending: false });
  if (filters.curso_id) query = query.eq('curso_id', filters.curso_id);
  if (filters.modulo_id) query = query.eq('modulo_id', filters.modulo_id);
  if (filters.estado) query = query.eq('estado', filters.estado);
  const { data, error } = await query;
  fail(error);
  const hydrated = await hydrateEvaluationRelations(data);
  return hydrated.filter((item) => roleName(user) === 'Administrador' || Number(item.curso && item.curso.creado_por) === Number(user.id)).map((item) => {
    const submitted = (item.intentos || []).filter((attempt) => attempt.estado !== 'EnProgreso');
    const average = submitted.length ? Math.round(submitted.reduce((sum, attempt) => sum + Number(attempt.porcentaje || 0), 0) / submitted.length) : 0;
    return { ...item, cantidad_preguntas: item.preguntas && item.preguntas[0] ? item.preguntas[0].count : 0, estudiantes_respondieron: new Set(submitted.map((attempt) => attempt.usuario_id)).size, promedio: average };
  });
};

const listStudent = async (userId) => {
  const courseIds = await estudianteService.getAssignedCourseIds(userId);
  if (!courseIds.length) return [];
  const { data, error } = await supabase.from('evaluaciones').select('*').in('curso_id', courseIds).eq('estado', 'Publicada').order('fecha_limite', { ascending: true, nullsFirst: false });
  fail(error);
  if (!data.length) return [];
  const { data: attempts, error: attemptsError } = await supabase.from('evaluacion_intentos').select('*').eq('usuario_id', userId).in('evaluacion_id', data.map((item) => item.id)).order('numero_intento', { ascending: false });
  fail(attemptsError);
  const hydrated = await hydrateEvaluationRelations(data);
  return hydrated.map((evaluation) => {
    const attempt = attempts.find((item) => Number(item.evaluacion_id) === Number(evaluation.id)) || null;
    const expired = evaluation.fecha_limite && new Date(evaluation.fecha_limite) < new Date();
    return { ...evaluation, ultimo_intento: attempt, estado_estudiante: expired && !attempt ? 'Vencida' : attempt ? attempt.estado : 'Pendiente' };
  });
};

const detail = async (user, id) => {
  const evaluation = await getEvaluation(id);
  await assertCourseAccess(user, evaluation.curso_id);
  if (roleName(user) === 'Estudiante' && evaluation.estado !== 'Publicada') throw new AppError('Evaluacion no disponible', 404);
  const questions = await getQuestions(id, isManager(user));
  let attempts = [];
  if (roleName(user) === 'Estudiante') {
    const result = await supabase.from('evaluacion_intentos').select('*').eq('evaluacion_id', id).eq('usuario_id', user.id).order('numero_intento', { ascending: false });
    fail(result.error);
    attempts = result.data;
  }
  let attemptCount = attempts.length;
  if (isManager(user)) {
    const result = await supabase.from('evaluacion_intentos').select('id', { count: 'exact', head: true }).eq('evaluacion_id', id);
    fail(result.error); attemptCount = result.count || 0;
  }
  return { ...evaluation, preguntas: questions, intentos: attempts, cantidad_intentos: attemptCount };
};

const normalizeEvaluation = (payload) => ({
  curso_id: Number(payload.curso_id), modulo_id: payload.modulo_id ? Number(payload.modulo_id) : null, leccion_id: payload.leccion_id ? Number(payload.leccion_id) : null,
  orden: payload.orden ? Number(payload.orden) : null,
  titulo: String(payload.titulo || '').trim(), descripcion: payload.descripcion || null, ubicacion: payload.ubicacion || 'FinModulo', estado: payload.estado || 'Borrador',
  fecha_inicio: normalizeDate(payload.fecha_inicio), fecha_limite: normalizeDate(payload.fecha_limite), tiempo_limite_min: payload.tiempo_limite_min ? Number(payload.tiempo_limite_min) : null,
  intentos_permitidos: Math.max(1, Number(payload.intentos_permitidos || 1)), puntaje_minimo: Number(payload.puntaje_minimo ?? 70),
  mostrar_resultado: payload.mostrar_resultado !== false, mostrar_correctas: Boolean(payload.mostrar_correctas), permitir_retroalimentacion: payload.permitir_retroalimentacion !== false,
  preguntas_aleatorias: Boolean(payload.preguntas_aleatorias), alternativas_aleatorias: Boolean(payload.alternativas_aleatorias), obligatoria: Boolean(payload.obligatoria), bloquea_avance: Boolean(payload.bloquea_avance),
  condicion_desbloqueo: payload.condicion_desbloqueo || 'Responder', permitir_reintentos: payload.permitir_reintentos !== false, mensaje_bloqueo: payload.mensaje_bloqueo || null,
});

const snapshotExistingOptionAnswers = async (evaluationId) => {
  const { data: attempts, error: attemptsError } = await supabase.from('evaluacion_intentos').select('id').eq('evaluacion_id', evaluationId);
  fail(attemptsError);
  const attemptIds = (attempts || []).map((attempt) => attempt.id);
  if (!attemptIds.length) return;
  const { data: answers, error: answersError } = await supabase.from('evaluacion_respuestas').select('id,opcion_id,opciones_ids,respuesta_texto').in('intento_id', attemptIds);
  fail(answersError);
  const optionIds = [...new Set((answers || []).flatMap((answer) => [
    answer.opcion_id,
    ...(Array.isArray(answer.opciones_ids) ? answer.opciones_ids : []),
  ]).filter(Boolean).map(Number))];
  if (!optionIds.length) return;
  const { data: options, error: optionsError } = await supabase.from('evaluacion_opciones').select('id,texto').in('id', optionIds);
  fail(optionsError);
  const optionText = new Map((options || []).map((option) => [Number(option.id), option.texto]));
  for (const answer of answers || []) {
    if (answer.respuesta_texto) continue;
    const selectedIds = Array.isArray(answer.opciones_ids) && answer.opciones_ids.length ? answer.opciones_ids : [answer.opcion_id];
    const text = selectedIds.filter(Boolean).map((id) => optionText.get(Number(id))).filter(Boolean).join('; ');
    if (text) await updateRows('evaluacion_respuestas', { respuesta_texto: text }, (query) => query.eq('id', answer.id));
  }
};

const saveQuestionOptions = async (questionId, options, preserveHistory) => {
  if (!preserveHistory) {
    fail((await supabase.from('evaluacion_opciones').delete().eq('pregunta_id', questionId)).error);
  } else {
    const { data: currentOptions, error } = await supabase.from('evaluacion_opciones').select('id,orden').eq('pregunta_id', questionId);
    fail(error);
    for (let index = 0; index < (currentOptions || []).length; index += 1) {
      await updateRows('evaluacion_opciones', { orden: 10000 + index }, (query) => query.eq('id', currentOptions[index].id));
    }
  }
  for (let optionIndex = 0; optionIndex < options.length; optionIndex += 1) {
    const option = options[optionIndex];
    const payload = { texto: option.texto, es_correcta: Boolean(option.es_correcta), orden: optionIndex + 1 };
    if (preserveHistory && option.id) {
      await updateRows('evaluacion_opciones', payload, (query) => query.eq('id', option.id).eq('pregunta_id', questionId));
    } else {
      await insertSingle('evaluacion_opciones', { pregunta_id: questionId, ...payload });
    }
  }
};

const replaceQuestions = async (evaluationId, questions = [], preserveHistory = false) => {
  if (preserveHistory) {
    await snapshotExistingOptionAnswers(evaluationId);
    const { data: currentQuestions, error } = await supabase.from('evaluacion_preguntas').select('id,orden').eq('evaluacion_id', evaluationId);
    fail(error);
    for (let index = 0; index < (currentQuestions || []).length; index += 1) {
      await updateRows('evaluacion_preguntas', { orden: 10000 + index, activo: false }, (query) => query.eq('id', currentQuestions[index].id));
    }
  } else {
    fail((await supabase.from('evaluacion_preguntas').delete().eq('evaluacion_id', evaluationId)).error);
  }
  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    if (!question.enunciado || !question.tipo) throw new AppError('Cada pregunta requiere enunciado y tipo', 400);
    const questionPayload = { enunciado: question.enunciado, tipo: question.tipo, puntaje: Number(question.puntaje || 1), explicacion: question.explicacion || null, criterios_evaluacion: question.criterios_evaluacion || null, guia_instructor: question.guia_instructor || null, calificacion_parcial: Boolean(question.calificacion_parcial), orden: index + 1, activo: question.activo !== false };
    let data;
    if (preserveHistory && question.id) {
      await updateRows('evaluacion_preguntas', questionPayload, (query) => query.eq('id', question.id).eq('evaluacion_id', evaluationId));
      data = { id: question.id };
    } else {
      data = await insertSingle('evaluacion_preguntas', { evaluacion_id: evaluationId, ...questionPayload });
    }
    const options = question.opciones || [];
    if (['OpcionUnica', 'OpcionMultiple'].includes(question.tipo) && options.length < 2) throw new AppError('Las preguntas de opcion requieren al menos dos alternativas', 400);
    if (question.tipo === 'VerdaderoFalso' && !options.length) options.push({ texto: 'Verdadero', es_correcta: question.respuesta_correcta === true }, { texto: 'Falso', es_correcta: question.respuesta_correcta !== true });
    if (options.length) await saveQuestionOptions(data.id, options, preserveHistory);
  }
};

const create = async (user, payload) => {
  if (!isManager(user)) throw new AppError('No tienes permisos para crear evaluaciones', 403);
  const clean = normalizeEvaluation(payload);
  if (!clean.curso_id || !clean.titulo) throw new AppError('Curso y titulo son obligatorios', 400);
  await assertCourseAccess(user, clean.curso_id);
  if (!(payload.preguntas || []).length) throw new AppError('La evaluacion debe incluir al menos una pregunta', 400);
  if (clean.ubicacion === 'FinModulo' && !clean.modulo_id) throw new AppError('Selecciona el modulo donde se ubicara la evaluacion', 400);
  if (clean.ubicacion === 'DespuesPaso' && !clean.leccion_id) throw new AppError('Selecciona el paso despues del cual aparecera la evaluacion', 400);
  if (clean.modulo_id && !clean.orden) clean.orden = await courseSequence.nextOrder(clean.modulo_id);
  const data = await insertSingle('evaluaciones', { ...clean, nombre: clean.titulo, creado_por: user.id });
  await replaceQuestions(data.id, payload.preguntas || []);
  return detail(user, data.id);
};

const update = async (user, id, payload) => {
  const current = await getEvaluation(id);
  await assertCourseAccess(user, current.curso_id);
  const clean = normalizeEvaluation({ ...current, ...payload });
  await assertCourseAccess(user, clean.curso_id);
  const { count: attemptCount, error: attemptsError } = await supabase.from('evaluacion_intentos').select('id', { count: 'exact', head: true }).eq('evaluacion_id', id);
  fail(attemptsError);
  if (clean.modulo_id && Number(clean.modulo_id) !== Number(current.modulo_id) && !payload.orden) clean.orden = await courseSequence.nextOrder(clean.modulo_id);
  await updateRows('evaluaciones', { ...clean, nombre: clean.titulo, updated_at: new Date().toISOString() }, (query) => query.eq('id', id));
  if (payload.preguntas) await replaceQuestions(id, payload.preguntas, attemptCount > 0);
  return detail(user, id);
};

const remove = async (user, id) => { const current = await getEvaluation(id); await assertCourseAccess(user, current.curso_id); fail((await supabase.from('evaluaciones').delete().eq('id', id)).error); return current; };
const reorder = async (user, id, direction) => { const current = await getEvaluation(id); await assertCourseAccess(user, current.curso_id); return courseSequence.reorder('Evaluacion', id, direction); };
const duplicate = async (user, id) => { const source = await detail(user, id); const { preguntas, curso, modulo, leccion, creador, ...payload } = source; return create(user, { ...payload, orden: null, titulo: `${source.titulo} (copia)`, estado: 'Borrador', preguntas }); };

const getAttemptResponses = async (attemptId) => {
  const { data, error } = await supabase
    .from('evaluacion_respuestas')
    .select('*')
    .eq('intento_id', attemptId);
  fail(error);
  return data;
};

const buildAttemptPayload = async (attempt, evaluation) => ({
  intento: attempt,
  evaluacion: evaluation,
  finalizado: attempt && attempt.estado !== 'EnProgreso',
  respuestas: attempt && attempt.estado !== 'EnProgreso' ? await getAttemptResponses(attempt.id) : [],
});

const startAttempt = async (user, evaluationId) => {
  if (roleName(user) !== 'Estudiante') throw new AppError('Solo estudiantes pueden responder evaluaciones', 403);
  const evaluation = await detail(user, evaluationId);
  await assertActivityUnlocked(user.id, evaluation.curso_id, 'Evaluacion', evaluationId);
  if (evaluation.fecha_inicio && new Date(evaluation.fecha_inicio) > new Date()) throw new AppError('La evaluacion aun no esta disponible', 409);
  if (evaluation.fecha_limite && new Date(evaluation.fecha_limite) < new Date()) throw new AppError('La evaluacion esta vencida', 409);
  const attempts = evaluation.intentos || [];
  const active = attempts.find((attempt) => attempt.estado === 'EnProgreso');
  if (active) return { intento: active, evaluacion: evaluation };
  const latestFinished = attempts.find((attempt) => attempt.estado !== 'EnProgreso');
  if (attempts.length >= evaluation.intentos_permitidos || (attempts.length && !evaluation.permitir_reintentos)) {
    if (latestFinished) return buildAttemptPayload(latestFinished, evaluation);
    throw new AppError('No tienes intentos disponibles', 409);
  }
  const { data, error } = await supabase.from('evaluacion_intentos').insert({ evaluacion_id: evaluationId, usuario_id: user.id, numero_intento: attempts.length + 1 }).select('*').single();
  fail(error);
  return { intento: data, evaluacion: evaluation };
};

const recalculateAttempt = async (attemptId) => {
  const { data: attempt, error } = await supabase.from('evaluacion_intentos').select('*, evaluacion:evaluaciones(*)').eq('id', attemptId).single();
  fail(error);
  const { data: questions, error: qError } = await supabase.from('evaluacion_preguntas').select('id,puntaje,tipo').eq('evaluacion_id', attempt.evaluacion_id).eq('activo', true);
  fail(qError);
  const { data: answers, error: aError } = await supabase.from('evaluacion_respuestas').select('*').eq('intento_id', attemptId);
  fail(aError);
  const total = questions.reduce((sum, question) => sum + Number(question.puntaje || 0), 0);
  const obtained = answers.reduce((sum, answer) => sum + Number(answer.puntaje_obtenido || 0), 0);
  const pending = answers.some((answer) => answer.requiere_revision && answer.puntaje_obtenido === null);
  const percentage = total ? Math.round((obtained / total) * 10000) / 100 : 0;
  const state = pending ? 'PendienteCalificacion' : percentage >= Number(attempt.evaluacion.puntaje_minimo) ? 'Aprobado' : 'Desaprobado';
  const { data, error: updateError } = await supabase.from('evaluacion_intentos').update({ puntaje_obtenido: obtained, puntaje_total: total, porcentaje: percentage, estado: state, calificado_at: pending ? null : new Date().toISOString() }).eq('id', attemptId).select('*').single();
  fail(updateError);
  return data;
};

const submitAttempt = async (user, evaluationId, attemptId, submittedAnswers) => {
  const evaluation = await detail(user, evaluationId);
  const { data: attempt, error } = await supabase.from('evaluacion_intentos').select('*').eq('id', attemptId).eq('evaluacion_id', evaluationId).eq('usuario_id', user.id).maybeSingle();
  fail(error);
  if (!attempt || attempt.estado !== 'EnProgreso') throw new AppError('El intento no esta disponible para envio', 409);
  const questions = await getQuestions(evaluationId, true);
  for (const question of questions) {
    const answer = (submittedAnswers || []).find((item) => Number(item.pregunta_id) === Number(question.id)) || {};
    let score = null; let correct = null; let review = ['TextoCorto', 'TextoLargo'].includes(question.tipo);
    if (!review) {
      const correctIds = question.opciones.filter((option) => option.es_correcta).map((option) => Number(option.id)).sort();
      const selectedIds = (question.tipo === 'OpcionMultiple' ? answer.opciones_ids || [] : [answer.opcion_id]).filter(Boolean).map(Number).sort();
      correct = JSON.stringify(correctIds) === JSON.stringify(selectedIds);
      score = correct ? Number(question.puntaje) : 0;
    }
    const selectedIds = (question.tipo === 'OpcionMultiple' ? answer.opciones_ids || [] : [answer.opcion_id]).filter(Boolean).map(Number);
    const answerText = answer.respuesta_texto || selectedIds.map((id) => {
      const option = question.opciones.find((item) => Number(item.id) === id);
      return option ? option.texto : null;
    }).filter(Boolean).join('; ') || null;
    const row = { intento_id: attemptId, pregunta_id: question.id, opcion_id: answer.opcion_id || null, opciones_ids: answer.opciones_ids || null, respuesta_texto: answerText, puntaje_obtenido: score, correcta: correct, requiere_revision: review };
    fail((await supabase.from('evaluacion_respuestas').upsert(row, { onConflict: 'intento_id,pregunta_id' })).error);
  }
  fail((await supabase.from('evaluacion_intentos').update({ enviado_at: new Date().toISOString(), estado: 'Enviado' }).eq('id', attemptId)).error);
  return recalculateAttempt(attemptId);
};

const results = async (user, evaluationId) => {
  const evaluation = await getEvaluation(evaluationId); await assertCourseAccess(user, evaluation.curso_id);
  const { data, error } = await supabase.from('evaluacion_intentos').select('*, estudiante:usuarios(id,"Nombres",usuario,"Correo"), respuestas:evaluacion_respuestas(*, pregunta:evaluacion_preguntas(id,enunciado,tipo,puntaje))').eq('evaluacion_id', evaluationId).neq('estado', 'EnProgreso').order('enviado_at', { ascending: false });
  fail(error); return { evaluacion: evaluation, intentos: data };
};

const gradeAnswer = async (user, answerId, payload) => {
  const { data: answer, error } = await supabase.from('evaluacion_respuestas').select('*, intento:evaluacion_intentos(evaluacion_id), pregunta:evaluacion_preguntas(puntaje)').eq('id', answerId).maybeSingle();
  fail(error); if (!answer) throw new AppError('Respuesta no encontrada', 404);
  const evaluation = await getEvaluation(answer.intento.evaluacion_id); await assertCourseAccess(user, evaluation.curso_id);
  const score = Number(payload.puntaje); if (score < 0 || score > Number(answer.pregunta.puntaje)) throw new AppError('Puntaje manual fuera de rango', 400);
  fail((await supabase.from('evaluacion_respuestas').update({ puntaje_obtenido: score, retroalimentacion: payload.retroalimentacion || null, calificado_por: user.id, calificado_at: new Date().toISOString() }).eq('id', answerId)).error);
  return recalculateAttempt(answer.intento_id);
};

const getForum = async (id) => { const { data, error } = await supabase.from('foros_evaluables').select('*, curso:cursos(id,nombre), modulo:modulos(id,nombre), leccion:lecciones(id,titulo)').eq('id', id).maybeSingle(); fail(error); if (!data) throw new AppError('Foro no encontrado', 404); return data; };
const forumDetail = async (user, id) => { const forum = await getForum(id); await assertCourseAccess(user, forum.curso_id); if (roleName(user) === 'Estudiante' && forum.estado !== 'Publicado') throw new AppError('Foro no disponible', 404); return forum; };
const listForums = async (user) => {
  let query = supabase.from('foros_evaluables').select('*, curso:cursos(id,nombre,creado_por), modulo:modulos(id,nombre), respuestas:foro_respuestas(count)').order('created_at', { ascending: false });
  if (roleName(user) === 'Estudiante') {
    const ids = await estudianteService.getAssignedCourseIds(user.id); if (!ids.length) return [];
    query = query.in('curso_id', ids).eq('estado', 'Publicado');
  }
  const { data, error } = await query; fail(error);
  const visible = data.filter((item) => roleName(user) !== 'Instructor' || Number(item.curso.creado_por) === Number(user.id));
  if (roleName(user) !== 'Estudiante' || !visible.length) return visible;
  const { data: responses, error: responseError } = await supabase.from('foro_respuestas').select('*').eq('usuario_id', user.id).in('foro_id', visible.map((item) => item.id));
  fail(responseError);
  return visible.map((item) => ({ ...item, mi_respuesta: responses.find((response) => Number(response.foro_id) === Number(item.id)) || null }));
};
const saveForum = async (user, payload, id = null) => {
  const clean = {
    curso_id: Number(payload.curso_id), modulo_id: payload.modulo_id ? Number(payload.modulo_id) : null, leccion_id: payload.leccion_id ? Number(payload.leccion_id) : null,
    orden: payload.orden ? Number(payload.orden) : null, titulo: String(payload.titulo || '').trim(), descripcion: String(payload.descripcion || '').trim(),
    instrucciones: payload.instrucciones || null, ubicacion: payload.ubicacion || 'FinModulo', archivo_url: payload.archivo_url || null, archivo_nombre: payload.archivo_nombre || null,
    fecha_inicio: payload.fecha_inicio || null, fecha_limite: payload.fecha_limite || null, estado: payload.estado || 'Borrador', visibilidad: payload.visibilidad || 'SoloInstructor',
    obligatorio: Boolean(payload.obligatorio), bloquea_avance: Boolean(payload.bloquea_avance), condicion_desbloqueo: payload.condicion_desbloqueo || 'Responder',
    minimo_estrellas: Number(payload.minimo_estrellas || 1), mensaje_bloqueo: payload.mensaje_bloqueo || null,
  };
  if (!clean.curso_id || !clean.titulo || !clean.descripcion) throw new AppError('Curso, titulo y caso son obligatorios', 400);
  let current = null;
  if (id) { current = await getForum(id); await assertCourseAccess(user, current.curso_id); }
  await assertCourseAccess(user, clean.curso_id);
  if (clean.modulo_id && (!id || Number(clean.modulo_id) !== Number(current.modulo_id)) && !clean.orden) clean.orden = await courseSequence.nextOrder(clean.modulo_id);
  const query = id ? supabase.from('foros_evaluables').update({ ...clean, updated_at: new Date().toISOString() }).eq('id', id) : supabase.from('foros_evaluables').insert({ ...clean, creado_por: user.id });
  const { data, error } = await query.select('*').single(); fail(error); return data;
};
const removeForum = async (user, id) => { const forum = await getForum(id); await assertCourseAccess(user, forum.curso_id); fail((await supabase.from('foros_evaluables').delete().eq('id', id)).error); return forum; };
const reorderForum = async (user, id, direction) => { const forum = await getForum(id); await assertCourseAccess(user, forum.curso_id); return courseSequence.reorder('Foro', id, direction); };
const respondForum = async (user, forumId, payload) => { const forum = await getForum(forumId); await assertCourseAccess(user, forum.curso_id); if (roleName(user) !== 'Estudiante' || forum.estado !== 'Publicado') throw new AppError('Foro no disponible', 403); await assertActivityUnlocked(user.id, forum.curso_id, 'Foro', forumId); const { data, error } = await supabase.from('foro_respuestas').upsert({ foro_id: forumId, usuario_id: user.id, texto: payload.texto, archivo_url: payload.archivo_url || null, archivo_nombre: payload.archivo_nombre || null, estado: 'Enviado', enviado_at: new Date().toISOString() }, { onConflict: 'foro_id,usuario_id' }).select('*').single(); fail(error); return data; };
const forumResults = async (user, forumId) => {
  const forum = await getForum(forumId);
  await assertCourseAccess(user, forum.curso_id);
  const { data, error } = await supabase
    .from('foro_respuestas')
    .select('*, estudiante:usuarios!foro_respuestas_usuario_id_fkey(id,"Nombres",usuario,"Correo"), evaluador:usuarios!foro_respuestas_calificado_por_fkey(id,"Nombres",usuario)')
    .eq('foro_id', forumId)
    .order('enviado_at', { ascending: true });
  fail(error);
  const student = roleName(user) === 'Estudiante';
  const responses = data.map((response) => {
    const own = Number(response.usuario_id) === Number(user.id);
    if (!student || own) return { ...response, es_mia: own };
    const { estrellas, retroalimentacion, calificado_por, calificado_at, evaluador, ...publicResponse } = response;
    return { ...publicResponse, es_mia: false };
  });
  return { foro: forum, respuestas: responses, puede_calificar: isManager(user) };
};
const gradeForum = async (user, responseId, payload) => { const { data: response, error } = await supabase.from('foro_respuestas').select('*, foro:foros_evaluables(curso_id)').eq('id', responseId).maybeSingle(); fail(error); if (!response) throw new AppError('Respuesta no encontrada', 404); await assertCourseAccess(user, response.foro.curso_id); const stars = Number(payload.estrellas); if (stars < 1 || stars > 5) throw new AppError('La calificacion debe estar entre 1 y 5 estrellas', 400); const { data, error: updateError } = await supabase.from('foro_respuestas').update({ estrellas: stars, retroalimentacion: payload.retroalimentacion || null, estado: 'Calificado', calificado_por: user.id, calificado_at: new Date().toISOString() }).eq('id', responseId).select('*').single(); fail(updateError); return data; };

const activitySatisfied = (activity, record) => { if (!record) return false; if (activity.tipo_actividad === 'Evaluacion') { if (activity.condicion_desbloqueo === 'Responder') return record.estado !== 'EnProgreso'; if (activity.condicion_desbloqueo === 'CalificacionManual') return !['EnProgreso','Enviado','PendienteCalificacion'].includes(record.estado); return record.estado === 'Aprobado'; } if (activity.condicion_desbloqueo === 'Responder') return true; if (activity.condicion_desbloqueo === 'Calificacion') return record.estado === 'Calificado'; return Number(record.estrellas || 0) >= Number(activity.minimo_estrellas || 1); };
const courseActivities = async (courseId, userId, { publishedOnly = true } = {}) => { let evaluationsQuery = supabase.from('evaluaciones').select('*, preguntas:evaluacion_preguntas(count)').eq('curso_id', courseId); if (publishedOnly) evaluationsQuery = evaluationsQuery.eq('estado', 'Publicada'); const { data: evaluations, error } = await evaluationsQuery; if (missingEvaluationSchema(error)) return []; fail(error); let forumsQuery = supabase.from('foros_evaluables').select('*, respuestas:foro_respuestas(count)').eq('curso_id', courseId); if (publishedOnly) forumsQuery = forumsQuery.eq('estado', 'Publicado'); const { data: forums, error: forumError } = await forumsQuery; if (missingEvaluationSchema(forumError)) return []; fail(forumError); let attempts = []; let responses = []; if (userId && evaluations.length) { const result = await supabase.from('evaluacion_intentos').select('*').eq('usuario_id', userId).in('evaluacion_id', evaluations.map((item) => item.id)).order('numero_intento', { ascending: false }); fail(result.error); attempts = result.data; } if (userId && forums.length) { const result = await supabase.from('foro_respuestas').select('*').eq('usuario_id', userId).in('foro_id', forums.map((item) => item.id)); fail(result.error); responses = result.data; } return [...evaluations.map((item) => { const record = attempts.find((attempt) => Number(attempt.evaluacion_id) === Number(item.id)); const activity = { ...item, cantidad_preguntas: item.preguntas && item.preguntas[0] ? item.preguntas[0].count : 0, tipo_actividad: 'Evaluacion', intento: record || null }; return { ...activity, completada: activitySatisfied(activity, record) }; }), ...forums.map((item) => { const record = responses.find((response) => Number(response.foro_id) === Number(item.id)); const activity = { ...item, obligatoria: Boolean(item.obligatorio), cantidad_respuestas: item.respuestas && item.respuestas[0] ? item.respuestas[0].count : 0, tipo_actividad: 'Foro', respuesta: record || null }; return { ...activity, completada: activitySatisfied(activity, record) }; })]; };

const buildCourseJourney = async (courseId, userId) => {
  const { data: modules, error: moduleError } = await supabase.from('modulos').select('id,orden').eq('curso_id', courseId).eq('estado', 'Publicado').order('orden'); fail(moduleError);
  if (!modules.length) return [];
  const { data: lessons, error: lessonsError } = await supabase.from('lecciones').select('id,orden,modulo_id').in('modulo_id', modules.map((item) => item.id)).eq('estado', 'Publicado').order('orden'); fail(lessonsError);
  const activities = await courseActivities(courseId, userId);
  const journey = [];
  modules.forEach((module) => {
    const items = [
      ...lessons.filter((item) => Number(item.modulo_id) === Number(module.id)).map((item) => ({ tipo: 'Leccion', id: item.id, orden: item.orden })),
      ...activities.filter((activity) => activity.orden != null && Number(activity.modulo_id) === Number(module.id)).map((activity) => ({ tipo: 'Actividad', activity, orden: activity.orden })),
    ].sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));
    items.forEach((item) => {
      journey.push(item);
      if (item.tipo === 'Leccion') activities.filter((activity) => !activity.modulo_id && activity.ubicacion === 'DespuesPaso' && Number(activity.leccion_id) === Number(item.id)).forEach((activity) => journey.push({ tipo: 'Actividad', activity }));
    });
    activities.filter((activity) => !activity.orden && activity.ubicacion === 'FinModulo' && Number(activity.modulo_id) === Number(module.id)).forEach((activity) => journey.push({ tipo: 'Actividad', activity }));
  });
  activities.filter((activity) => activity.ubicacion === 'FinCurso').forEach((activity) => journey.push({ tipo: 'Actividad', activity }));
  return journey;
};

const blockerMessage = (activity) => {
  if (activity.tipo_actividad === 'Evaluacion' && activity.intento && activity.intento.estado === 'PendienteCalificacion') return 'Tu evaluacion esta pendiente de revision por el instructor.';
  if (activity.tipo_actividad === 'Foro' && activity.respuesta && activity.respuesta.estado !== 'Calificado' && activity.condicion_desbloqueo !== 'Responder') return 'Tu respuesta esta pendiente de revision por el instructor.';
  return activity.mensaje_bloqueo || (activity.tipo_actividad === 'Foro' ? 'Debes completar este foro para continuar.' : 'Debes completar esta evaluacion para continuar.');
};

const assertJourneyUnlocked = async (userId, courseId, predicate) => {
  const journey = await buildCourseJourney(courseId, userId);
  const targetIndex = journey.findIndex(predicate);
  if (targetIndex < 0) throw new AppError('Contenido no encontrado en el recorrido publicado', 404);
  const blocker = journey.slice(0, targetIndex).find((item) => item.tipo === 'Actividad' && item.activity.obligatoria && item.activity.bloquea_avance && !item.activity.completada);
  if (blocker) throw new AppError(blockerMessage(blocker.activity), 423);
  return true;
};

const assertLessonUnlocked = async (userId, lessonId) => {
  const { data: lesson, error } = await supabase.from('lecciones').select('id,modulo:modulos(curso_id)').eq('id', lessonId).maybeSingle();
  fail(error); if (!lesson) throw new AppError('Leccion no encontrada', 404);
  return assertJourneyUnlocked(userId, lesson.modulo.curso_id, (item) => item.tipo === 'Leccion' && Number(item.id) === Number(lessonId));
};

const assertActivityUnlocked = async (userId, courseId, activityType, activityId) => assertJourneyUnlocked(userId, courseId, (item) => item.tipo === 'Actividad' && item.activity.tipo_actividad === activityType && Number(item.activity.id) === Number(activityId));

module.exports = { list, listStudent, detail, create, update, remove, reorder, duplicate, startAttempt, submitAttempt, results, gradeAnswer, listForums, getForum, forumDetail, saveForum, removeForum, reorderForum, respondForum, forumResults, gradeForum, courseActivities, assertLessonUnlocked };

const supabase = require('./supabase.service');
const AppError = require('../utils/AppError');

const fail = (error) => {
  if (!error) return;
  if (['42703', 'PGRST204'].includes(error.code)) throw new AppError('Falta ejecutar la migracion 007_integracion_evaluaciones_modulos.sql en Supabase', 500, error.message);
  throw new AppError('Error al ordenar el contenido del modulo', 500, error.message);
};

const TABLES = {
  Leccion: 'lecciones',
  Evaluacion: 'evaluaciones',
};

const listModuleItems = async (moduleId) => {
  const [lessonsResult, evaluationsResult] = await Promise.all([
    supabase.from('lecciones').select('id,modulo_id,orden').eq('modulo_id', moduleId),
    supabase.from('evaluaciones').select('id,modulo_id,orden').eq('modulo_id', moduleId),
  ]);
  fail(lessonsResult.error);
  fail(evaluationsResult.error);
  return [
    ...lessonsResult.data.map((item) => ({ ...item, tipo: 'Leccion' })),
    ...evaluationsResult.data.map((item) => ({ ...item, tipo: 'Evaluacion' })),
  ].sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0) || a.tipo.localeCompare(b.tipo) || Number(a.id) - Number(b.id));
};

const nextOrder = async (moduleId) => {
  const items = await listModuleItems(moduleId);
  return items.length ? Math.max(...items.map((item) => Number(item.orden || 0))) + 1 : 1;
};

const reorder = async (type, id, direction) => {
  if (!TABLES[type] || !['up', 'down'].includes(direction)) throw new AppError('Solicitud de orden invalida', 400);
  const table = TABLES[type];
  const { data: current, error } = await supabase.from(table).select('id,modulo_id,orden').eq('id', id).maybeSingle();
  fail(error);
  if (!current || !current.modulo_id) throw new AppError('Elemento del modulo no encontrado', 404);

  const items = await listModuleItems(current.modulo_id);
  const currentIndex = items.findIndex((item) => item.tipo === type && Number(item.id) === Number(id));
  const neighborIndex = currentIndex + (direction === 'up' ? -1 : 1);
  if (currentIndex < 0 || neighborIndex < 0 || neighborIndex >= items.length) return current;

  const neighbor = items[neighborIndex];
  const temporaryOrder = 2000000000 + Number(current.id);
  fail((await supabase.from(table).update({ orden: temporaryOrder }).eq('id', current.id)).error);
  fail((await supabase.from(TABLES[neighbor.tipo]).update({ orden: current.orden }).eq('id', neighbor.id)).error);
  fail((await supabase.from(table).update({ orden: neighbor.orden }).eq('id', current.id)).error);
  return { ...current, orden: neighbor.orden };
};

module.exports = { listModuleItems, nextOrder, reorder };

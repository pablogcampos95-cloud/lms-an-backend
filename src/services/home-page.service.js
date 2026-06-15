const sanitizeHtml = require('sanitize-html');

const supabase = require('./supabase.service');
const academicoService = require('./academico.service');
const AppError = require('../utils/AppError');

const CONFIG_ID = 'principal';

const DEFAULT_HOME_CONFIG = Object.freeze({
  heroTopLabel: 'FORMACION CORPORATIVA BPO & CONTACT CENTER',
  heroTitle: 'Desarrolla habilidades que elevan el desempeno en operaciones BPO y Contact Center.',
  heroDescription: 'Accede a cursos disenados para fortalecer la gestion, la productividad, la calidad, la atencion al cliente y los resultados comerciales de tus equipos.',
  heroPrimaryButtonText: 'Explorar cursos',
  heroPrimaryButtonUrl: '#publicCourses',
  heroSecondaryButtonText: 'Ingresar al LMS',
  heroSecondaryButtonUrl: '#login',
  heroImage: '',
  heroBackground: '',
  heroAccentColor: '#00d8ff',
  showHero: true,
  showPrimaryButton: true,
  showSecondaryButton: true,
  showSideCard: true,
  sideCardTitle: 'Aprende. Gestiona. Mejora.',
  sideCardDescription: 'Formacion corporativa enfocada en desempeno operativo, calidad y experiencia del cliente.',
  sideCardIcon: 'fa-brain',
  sideCardImage: '',
  sideCardBackground: '',
  featuredCoursesMode: 'manual',
  featuredCourses: [],
  featuredCoursesLimit: 6,
  featuredCoursesEnabled: true,
  visibleCategories: [
    'Atencion al cliente',
    'Ventas consultivas',
    'Calidad y monitoreo',
    'Productividad operativa',
    'Gestion de llamadas',
    'Back Office',
    'Supervision',
    'Herramientas digitales',
    'IA aplicada al Contact Center',
    'Experiencia del cliente',
  ],
  brandColors: {
    primary: '#00d8ff',
    secondary: '#1f6bff',
    background: '#071426',
  },
  homeSections: [
    { id: 'hero', type: 'hero', title: 'Portada principal', description: '', icon: 'fa-bullhorn', order: 1, visible: true, buttonText: '', buttonUrl: '', image: '' },
    { id: 'categories', type: 'categories', title: 'Categorias de formacion', description: 'Explora rutas por necesidad operativa.', icon: 'fa-layer-group', order: 2, visible: true, buttonText: '', buttonUrl: '', image: '' },
    { id: 'featuredCourses', type: 'featuredCourses', title: 'Cursos destacados', description: 'Programas seleccionados para equipos BPO y Contact Center.', icon: 'fa-graduation-cap', order: 3, visible: true, buttonText: '', buttonUrl: '', image: '' },
    { id: 'benefits', type: 'benefits', title: 'Beneficios de la plataforma', description: 'Gestiona aprendizaje, avance y resultados desde un solo lugar.', icon: 'fa-chart-line', order: 4, visible: true, buttonText: '', buttonUrl: '', image: '' },
  ],
});

const schemaError = (error) => {
  if (!error) return false;
  const message = [error.message, error.details, error.code].filter(Boolean).join(' ');
  return /home_page_config|schema cache|Could not find|does not exist|PGRST|42P01/i.test(message);
};

const cleanText = (value) => sanitizeHtml(String(value || '').trim(), { allowedTags: [], allowedAttributes: {} });

const cleanUrl = (value, fieldName, allowAnchor = true) => {
  const text = cleanText(value);
  if (!text) return '';
  if (allowAnchor && text.startsWith('#')) return text;
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol');
    return text;
  } catch (error) {
    throw new AppError(`El enlace de ${fieldName} no es valido`, 400);
  }
};

const toBoolean = (value, fallback = false) => (typeof value === 'boolean' ? value : fallback);

const mergeConfig = (config = {}) => ({
  ...DEFAULT_HOME_CONFIG,
  ...config,
  brandColors: { ...DEFAULT_HOME_CONFIG.brandColors, ...(config.brandColors || {}) },
  visibleCategories: Array.isArray(config.visibleCategories) ? config.visibleCategories : DEFAULT_HOME_CONFIG.visibleCategories,
  featuredCourses: Array.isArray(config.featuredCourses) ? config.featuredCourses.map(Number).filter(Number.isInteger) : DEFAULT_HOME_CONFIG.featuredCourses,
  homeSections: Array.isArray(config.homeSections) && config.homeSections.length ? config.homeSections : DEFAULT_HOME_CONFIG.homeSections,
});

const sanitizeSection = (section, index) => ({
  id: cleanText(section.id) || `section-${index + 1}`,
  type: cleanText(section.type) || 'custom',
  title: cleanText(section.title),
  description: cleanText(section.description),
  icon: cleanText(section.icon) || 'fa-layer-group',
  order: Number(section.order || index + 1),
  visible: toBoolean(section.visible, true),
  buttonText: cleanText(section.buttonText),
  buttonUrl: cleanUrl(section.buttonUrl, `boton de ${section.title || 'seccion'}`),
  image: cleanUrl(section.image, `imagen de ${section.title || 'seccion'}`, false),
});

const validateSections = (sections) => {
  sections.filter((section) => section.visible).forEach((section) => {
    if (!section.title && !['hero', 'featuredCourses', 'categories'].includes(section.type)) {
      throw new AppError('Las secciones activas deben tener titulo', 400);
    }
  });
};

const sanitizeConfig = (payload = {}) => {
  const incoming = mergeConfig(payload);
  const config = {
    ...incoming,
    heroTopLabel: cleanText(incoming.heroTopLabel),
    heroTitle: cleanText(incoming.heroTitle),
    heroDescription: cleanText(incoming.heroDescription),
    heroPrimaryButtonText: cleanText(incoming.heroPrimaryButtonText),
    heroPrimaryButtonUrl: cleanUrl(incoming.heroPrimaryButtonUrl, 'boton principal'),
    heroSecondaryButtonText: cleanText(incoming.heroSecondaryButtonText),
    heroSecondaryButtonUrl: cleanUrl(incoming.heroSecondaryButtonUrl, 'boton secundario'),
    heroImage: cleanUrl(incoming.heroImage, 'imagen principal', false),
    heroBackground: cleanUrl(incoming.heroBackground, 'fondo de portada', false),
    heroAccentColor: /^#[0-9A-F]{6}$/i.test(incoming.heroAccentColor || '') ? incoming.heroAccentColor : DEFAULT_HOME_CONFIG.heroAccentColor,
    showHero: toBoolean(incoming.showHero, true),
    showPrimaryButton: toBoolean(incoming.showPrimaryButton, true),
    showSecondaryButton: toBoolean(incoming.showSecondaryButton, true),
    showSideCard: toBoolean(incoming.showSideCard, true),
    sideCardTitle: cleanText(incoming.sideCardTitle),
    sideCardDescription: cleanText(incoming.sideCardDescription),
    sideCardIcon: cleanText(incoming.sideCardIcon) || 'fa-brain',
    sideCardImage: cleanUrl(incoming.sideCardImage, 'imagen de tarjeta lateral', false),
    sideCardBackground: /^#[0-9A-F]{6}$/i.test(incoming.sideCardBackground || '') ? incoming.sideCardBackground : '',
    featuredCoursesMode: ['manual', 'recent', 'category', 'recommended', 'mandatory', 'mostViewed'].includes(incoming.featuredCoursesMode) ? incoming.featuredCoursesMode : 'manual',
    featuredCourses: incoming.featuredCourses.map(Number).filter(Number.isInteger),
    featuredCoursesLimit: Math.min(12, Math.max(1, Number(incoming.featuredCoursesLimit || 6))),
    featuredCoursesEnabled: toBoolean(incoming.featuredCoursesEnabled, true),
    visibleCategories: incoming.visibleCategories.map(cleanText).filter(Boolean).slice(0, 24),
    brandColors: {
      primary: /^#[0-9A-F]{6}$/i.test(incoming.brandColors.primary || '') ? incoming.brandColors.primary : DEFAULT_HOME_CONFIG.brandColors.primary,
      secondary: /^#[0-9A-F]{6}$/i.test(incoming.brandColors.secondary || '') ? incoming.brandColors.secondary : DEFAULT_HOME_CONFIG.brandColors.secondary,
      background: /^#[0-9A-F]{6}$/i.test(incoming.brandColors.background || '') ? incoming.brandColors.background : DEFAULT_HOME_CONFIG.brandColors.background,
    },
    homeSections: incoming.homeSections.map(sanitizeSection),
  };

  if (!config.heroTitle) throw new AppError('El titulo principal no puede estar vacio', 400);
  if (!config.heroDescription) throw new AppError('La descripcion principal no puede estar vacia', 400);
  if (config.showPrimaryButton && !config.heroPrimaryButtonText) throw new AppError('El boton principal activo debe tener texto', 400);
  if (config.showSecondaryButton && !config.heroSecondaryButtonText) throw new AppError('El boton secundario activo debe tener texto', 400);
  validateSections(config.homeSections);
  return config;
};

const getConfigRow = async () => {
  const { data, error } = await supabase.from('home_page_config').select('*').eq('id', CONFIG_ID).maybeSingle();
  if (error) {
    if (schemaError(error)) return null;
    throw new AppError('Error al consultar configuracion de pagina inicial', 500, error.message);
  }
  return data;
};

const resolveFeaturedCourses = async (config) => {
  const all = await academicoService.listPublicCourses({});
  const byId = new Map(all.map((course) => [Number(course.id), course]));
  let selected = [];
  if (config.featuredCoursesMode === 'manual') {
    selected = config.featuredCourses.map((id) => byId.get(Number(id))).filter(Boolean);
    if (!selected.length) selected = all;
  } else if (config.featuredCoursesMode === 'category' && config.visibleCategories.length) {
    selected = all.filter((course) => config.visibleCategories.includes(course.categoria));
  } else {
    selected = all;
  }
  return selected.slice(0, config.featuredCoursesLimit);
};

const getPublicConfig = async () => {
  const row = await getConfigRow();
  const config = mergeConfig(row ? (row.published_config || row.config) : {});
  return { config, featuredCoursesData: config.featuredCoursesEnabled ? await resolveFeaturedCourses(config) : [] };
};

const getAdminConfig = async () => {
  const row = await getConfigRow();
  const config = mergeConfig(row ? row.config : {});
  return {
    config,
    publishedConfig: mergeConfig(row ? (row.published_config || row.config) : {}),
    lastUpdatedBy: row ? row.updated_by : null,
    lastUpdatedAt: row ? row.updated_at : null,
    publishedAt: row ? row.published_at : null,
  };
};

const saveAdminConfig = async (payload, userId, publish = false) => {
  const config = sanitizeConfig(payload);
  if (config.featuredCourses.length) {
    const valid = await academicoService.listCursosByIds(config.featuredCourses);
    const validIds = new Set(valid.map((course) => Number(course.id)));
    const invalid = config.featuredCourses.filter((id) => !validIds.has(Number(id)));
    if (invalid.length) throw new AppError('Uno o mas cursos destacados no existen o no estan publicados', 400);
  }
  const update = {
    id: CONFIG_ID,
    config,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };
  if (publish) {
    update.published_config = config;
    update.published_by = userId;
    update.published_at = new Date().toISOString();
  }
  const { data, error } = await supabase.from('home_page_config').upsert(update, { onConflict: 'id' }).select('*').single();
  if (error) throw new AppError('No se pudo guardar la pagina inicial. Ejecuta la migracion 010_home_page_config.sql en Supabase.', 500, error.message);
  return { config: mergeConfig(data.config), publishedConfig: mergeConfig(data.published_config || data.config) };
};

const restoreDefaults = async (userId, publish = false) => saveAdminConfig(DEFAULT_HOME_CONFIG, userId, publish);

module.exports = {
  DEFAULT_HOME_CONFIG,
  getPublicConfig,
  getAdminConfig,
  saveAdminConfig,
  restoreDefaults,
};

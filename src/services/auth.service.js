const crypto = require('crypto');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const supabase = require('./supabase.service');
const usuariosService = require('./usuarios.service');
const AppError = require('../utils/AppError');

const USER_SELECT = '*, rol:roles(id,nombre,descripcion)';

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());

const getUserByCredential = async (credential) => {
  const loginValue = String(credential || '').trim();

  let { data, error } = await supabase
    .from('usuarios')
    .select(USER_SELECT)
    .ilike('usuario', loginValue)
    .maybeSingle();

  if (error) {
    throw new AppError('Error al consultar credenciales', 500, error.message);
  }

  if (data || !loginValue.includes('@')) return data;

  ({ data, error } = await supabase
    .from('usuarios')
    .select(USER_SELECT)
    .ilike('Correo', loginValue)
    .maybeSingle());

  if (error) {
    throw new AppError('Error al consultar credenciales', 500, error.message);
  }

  return data;
};

const signSession = (data, rememberMe = false) => {
  if (data.Estado && data.Estado.toLowerCase() !== 'activo') {
    throw new AppError('El usuario no se encuentra activo', 403);
  }

  const token = jwt.sign(
    {
      id: data.id,
      usuario: data.usuario,
      rol: data.rol ? data.rol.nombre : null,
    },
    process.env.JWT_SECRET,
    { expiresIn: rememberMe ? (process.env.JWT_REMEMBER_EXPIRES_IN || '30d') : (process.env.JWT_EXPIRES_IN || '8h') }
  );

  return {
    token,
    usuario: usuariosService.sanitizeUsuario(data),
  };
};

const getStudentRoleId = async () => {
  const { data, error } = await supabase.from('roles').select('id').eq('nombre', 'Estudiante').maybeSingle();
  if (error) throw new AppError('Error al consultar roles', 500, error.message);
  if (!data) throw new AppError('No existe el rol Estudiante para registrar usuarios', 500);
  return data.id;
};

const normalizeUsername = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9._-]/g, '_')
  .replace(/_+/g, '_')
  .replace(/^_+|_+$/g, '')
  .toLowerCase();

const uniqueUsername = async (baseValue) => {
  const base = normalizeUsername(baseValue) || `estudiante_${Date.now()}`;
  let candidate = base.slice(0, 46);

  for (let index = 0; index < 8; index += 1) {
    const { data, error } = await supabase.from('usuarios').select('id').ilike('usuario', candidate).maybeSingle();
    if (error) throw new AppError('Error al validar usuario', 500, error.message);
    if (!data) return candidate;
    candidate = `${base.slice(0, 38)}_${Date.now().toString().slice(-4)}${index}`;
  }

  return `${base.slice(0, 32)}_${crypto.randomBytes(3).toString('hex')}`;
};

const validateFreeCourse = async (cursoId) => {
  const id = Number(cursoId);
  if (!Number.isInteger(id) || id <= 0) return null;

  let { data: course, error: courseError } = await supabase
    .from('cursos')
    .select('id,estado,es_gratis')
    .eq('id', id)
    .maybeSingle();

  if (courseError && /es_gratis|schema cache|Could not find/i.test([courseError.message, courseError.details].filter(Boolean).join(' '))) {
    const fallback = await supabase
      .from('cursos')
      .select('id,estado')
      .eq('id', id)
      .maybeSingle();
    course = fallback.data ? { ...fallback.data, es_gratis: false } : fallback.data;
    courseError = fallback.error;
  }

  if (courseError) throw new AppError('Error al validar curso', 500, courseError.message);
  if (!course || course.estado !== 'Publicado') throw new AppError('Este curso no esta disponible para registro gratuito', 403);
  if (course.es_gratis !== true) throw new AppError('Este curso no es gratuito. Inicia sesion o solicita asignacion al administrador.', 403);
  return id;
};

const ensureCourseAssignment = async (usuarioId, cursoId) => {
  const id = await validateFreeCourse(cursoId);
  if (!id) return;

  const { error } = await supabase
    .from('curso_asignaciones')
    .upsert({ usuario_id: usuarioId, curso_id: id, asignado_por: null, estado: 'Asignado' }, { onConflict: 'usuario_id,curso_id' });

  if (error) throw new AppError('No se pudo asignar el curso gratuito', 500, error.message);
};

const createPublicStudent = async ({ nombres, correo, usuario, password, dni, curso_id: cursoId }) => {
  const cleanEmail = String(correo || '').trim().toLowerCase();
  const cleanName = String(nombres || '').trim();
  const cleanPassword = String(password || '').trim();

  if (!cleanName) throw new AppError('El nombre es obligatorio', 400);
  if (!isValidEmail(cleanEmail)) throw new AppError('Ingresa un correo valido', 400);
  if (cleanPassword.length < 4) throw new AppError('La contrasena debe tener al menos 4 caracteres', 400);

  const existing = await getUserByCredential(cleanEmail);
  if (existing) throw new AppError('Ya existe una cuenta con ese correo. Inicia sesion para continuar.', 409);
  await validateFreeCourse(cursoId);

  const rolId = await getStudentRoleId();
  const username = await uniqueUsername(usuario || cleanEmail.split('@')[0]);
  const documentValue = String(dni || '').trim() || Date.now().toString().slice(-9);

  const created = await usuariosService.createUsuario({
    DNI: documentValue,
    Nombres: cleanName,
    Correo: cleanEmail,
    Cargo: 'Estudiante',
    'Campaña': 'Cursos Gratis',
    Supervisor: '',
    Estado: 'Activo',
    fecha_ingreso: new Date().toISOString().slice(0, 10),
    usuario: username,
    password: cleanPassword,
    rol_id: rolId,
    tipo_plan: 'Gratuito',
  });

  await ensureCourseAssignment(created.id, cursoId);

  const user = await getUserByCredential(username);
  return signSession(user, true);
};

const login = async ({ usuario, password, rememberMe = false }) => {
  const data = await getUserByCredential(usuario);
  const cleanPassword = typeof password === 'string' ? password.trim() : password;

  if (!data || !data.password_hash) {
    throw new AppError('Usuario o contrasena incorrectos', 401);
  }

  const passwordValida = await bcrypt.compare(cleanPassword, data.password_hash);

  if (!passwordValida) {
    throw new AppError('Usuario o contrasena incorrectos', 401);
  }

  return signSession(data, rememberMe);
};

const googleConfig = () => ({
  clientId: process.env.GOOGLE_CLIENT_ID || null,
  enabled: Boolean(process.env.GOOGLE_CLIENT_ID),
});

const verifyGoogleCredential = async (credential) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new AppError('Google login no esta configurado. Define GOOGLE_CLIENT_ID en Railway.', 501);
  }

  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential || '')}`);
  const payload = await response.json().catch(() => ({}));

  const emailVerified = payload.email_verified === true || payload.email_verified === 'true';

  if (!response.ok || payload.aud !== process.env.GOOGLE_CLIENT_ID || !emailVerified) {
    throw new AppError('No se pudo validar la cuenta de Google', 401);
  }

  return payload;
};

const loginWithGoogle = async ({ credential, curso_id: cursoId, rememberMe = true }) => {
  const profile = await verifyGoogleCredential(credential);
  const email = String(profile.email || '').trim().toLowerCase();
  await validateFreeCourse(cursoId);
  let user = await getUserByCredential(email);

  if (!user) {
    const rolId = await getStudentRoleId();
    const username = await uniqueUsername(email.split('@')[0]);
    const created = await usuariosService.createUsuario({
      DNI: Date.now().toString().slice(-9),
      Nombres: profile.name || email,
      Correo: email,
      Cargo: 'Estudiante',
      'Campaña': 'Cursos Gratis',
      Supervisor: '',
      Estado: 'Activo',
      fecha_ingreso: new Date().toISOString().slice(0, 10),
      usuario: username,
      password: crypto.randomBytes(16).toString('hex'),
      rol_id: rolId,
      tipo_plan: 'Gratuito',
    });
    await ensureCourseAssignment(created.id, cursoId);
    user = await getUserByCredential(username);
  } else {
    await ensureCourseAssignment(user.id, cursoId);
  }

  return signSession(user, rememberMe);
};

const getMe = (usuario) => usuariosService.sanitizeUsuario(usuario);

module.exports = {
  login,
  registerPublic: createPublicStudent,
  googleConfig,
  loginWithGoogle,
  getMe,
};

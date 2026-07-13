const crypto = require('crypto');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const supabase = require('./supabase.service');
const usuariosService = require('./usuarios.service');
const AppError = require('../utils/AppError');

const USER_SELECT = '*, rol:roles(id,nombre,descripcion)';
const CAMPAIGN_COLUMN = 'Campa\u00f1a';
const PUBLIC_USERNAME_DOMAIN = process.env.PUBLIC_USERNAME_DOMAIN || 'ialearningsolutions.net';
const PUBLIC_TEMPORARY_PASSWORD = process.env.PUBLIC_TEMPORARY_PASSWORD || '123456';
const PUBLIC_REGISTRATION_ADMIN_EMAIL = process.env.PUBLIC_REGISTRATION_ADMIN_EMAIL || 'Pablo.gutierrez@ialearningsolutions.net';

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());

const isAllowedRedirectUrl = (value) => {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol)
      && (
        url.hostname === 'localhost'
        || url.hostname === '127.0.0.1'
        || url.hostname.endsWith('.railway.app')
        || url.hostname === 'ialearningsolutions.net'
        || url.hostname === 'www.ialearningsolutions.net'
      );
  } catch (error) {
    return false;
  }
};

const magicLinkError = (error) => {
  const message = String(error && error.message ? error.message : '');
  if (/rate limit/i.test(message)) {
    return new AppError(
      'Supabase alcanzo el limite temporal de correos. Espera unos minutos o configura un SMTP propio para enviar mas enlaces magicos.',
      429,
      message
    );
  }
  if (/signup|signups/i.test(message)) {
    return new AppError('El registro por correo no esta habilitado en Supabase Auth.', 400, message);
  }
  if (/redirect|url/i.test(message)) {
    return new AppError('La URL de retorno del enlace magico no esta permitida en Supabase.', 400, message);
  }
  return new AppError('No se pudo enviar el enlace magico', 500, message);
};

const resendError = (error, status = 500) => {
  const message = typeof error === 'string'
    ? error
    : String(error && (error.message || error.name || error.error) ? (error.message || error.name || error.error) : '');
  if (/domain|from/i.test(message)) {
    return new AppError('Resend no pudo enviar el correo. Verifica el remitente RESEND_FROM_EMAIL y el dominio validado.', 400, message);
  }
  if (/api.?key|unauthorized|forbidden/i.test(message) || status === 401 || status === 403) {
    return new AppError('Resend no esta autorizado. Revisa RESEND_API_KEY en Railway.', 401, message);
  }
  return new AppError('No se pudo enviar el enlace magico con Resend', status >= 400 ? status : 500, message);
};

const buildMagicEmailHtml = ({ name, link, username, temporaryPassword }) => `
  <div style="font-family:Arial,sans-serif;background:#06111f;padding:32px;color:#eaf6ff">
    <div style="max-width:560px;margin:auto;background:#0b1d33;border:1px solid #00c8ff55;border-radius:18px;padding:28px">
      <p style="letter-spacing:2px;text-transform:uppercase;color:#00d9ff;font-size:12px;margin:0 0 12px">IA Learning Solutions</p>
      <h1 style="font-size:26px;margin:0 0 12px;color:#fff">Tu acceso seguro esta listo</h1>
      <p style="font-size:16px;line-height:1.5;color:#bfd0e2">Hola ${name || 'talento'}, ya creamos tu acceso al LMS para continuar tu curso gratuito.</p>
      ${username && temporaryPassword ? `
        <div style="background:#06111f;border:1px solid #00d9ff55;border-radius:14px;padding:16px;margin:20px 0;color:#dff7ff">
          <p style="margin:0 0 8px;font-size:13px;color:#8fa4b8">Tambien puedes ingresar manualmente con:</p>
          <p style="margin:0 0 6px"><strong>Usuario:</strong> ${username}</p>
          <p style="margin:0"><strong>Clave temporal:</strong> ${temporaryPassword}</p>
          <p style="margin:12px 0 0;font-size:13px;color:#8fa4b8">En tu primer ingreso te pediremos cambiar esta clave.</p>
        </div>
      ` : ''}
      <p style="margin:28px 0">
        <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#20e6c3,#1688ff);color:#00111f;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:12px">Entrar al LMS</a>
      </p>
      <p style="font-size:13px;line-height:1.5;color:#8fa4b8">Si no solicitaste este acceso, puedes ignorar este correo.</p>
    </div>
  </div>
`;

const sendMagicLinkWithResend = async ({ to, name, actionLink, username, temporaryPassword }) => {
  if (!process.env.RESEND_API_KEY) return false;

  const from = process.env.RESEND_FROM_EMAIL || 'IA Learning Solutions <onboarding@resend.dev>';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Tu enlace de acceso a IA Learning Solutions',
      html: buildMagicEmailHtml({ name, link: actionLink, username, temporaryPassword }),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw resendError(payload, response.status);
  return true;
};

const sendAdminRegistrationNotification = async ({ student, courseId, source }) => {
  if (!process.env.RESEND_API_KEY || !PUBLIC_REGISTRATION_ADMIN_EMAIL) return false;

  const from = process.env.RESEND_FROM_EMAIL || 'IA Learning Solutions <onboarding@resend.dev>';
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [PUBLIC_REGISTRATION_ADMIN_EMAIL],
        subject: 'Nuevo estudiante registrado en IA Learning Solutions',
        html: `
          <div style="font-family:Arial,sans-serif;background:#06111f;padding:28px;color:#eaf6ff">
            <div style="max-width:620px;margin:auto;background:#0b1d33;border:1px solid #00c8ff55;border-radius:18px;padding:26px">
              <p style="letter-spacing:2px;text-transform:uppercase;color:#00d9ff;font-size:12px;margin:0 0 12px">IA Learning Solutions LMS</p>
              <h1 style="font-size:24px;margin:0 0 16px;color:#fff">Nuevo registro de estudiante</h1>
              <table style="width:100%;border-collapse:collapse;color:#dff7ff">
                <tr><td style="padding:8px 0;color:#8fa4b8">Nombre</td><td style="padding:8px 0"><strong>${student.Nombres || ''}</strong></td></tr>
                <tr><td style="padding:8px 0;color:#8fa4b8">Correo</td><td style="padding:8px 0">${student.Correo || ''}</td></tr>
                <tr><td style="padding:8px 0;color:#8fa4b8">Celular</td><td style="padding:8px 0">${student.Celular || 'No registrado'}</td></tr>
                <tr><td style="padding:8px 0;color:#8fa4b8">Usuario creado</td><td style="padding:8px 0">${student.usuario || ''}</td></tr>
                <tr><td style="padding:8px 0;color:#8fa4b8">Curso ID</td><td style="padding:8px 0">${courseId || 'No indicado'}</td></tr>
                <tr><td style="padding:8px 0;color:#8fa4b8">Origen</td><td style="padding:8px 0">${source || 'Cursos Gratis'}</td></tr>
              </table>
              <p style="font-size:13px;line-height:1.5;color:#8fa4b8;margin-top:18px">Este aviso se genero automaticamente desde el registro publico de cursos gratis.</p>
            </div>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      console.error('No se pudo notificar nuevo registro al administrador', payload);
      return false;
    }
    return true;
  } catch (error) {
    console.error('No se pudo notificar nuevo registro al administrador', error);
    return false;
  }
};

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

const normalizePublicUsernameLocalPart = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]/g, '')
  .toLowerCase();

const uniquePublicUsername = async (nameOrEmail) => {
  const source = String(nameOrEmail || '').includes('@')
    ? String(nameOrEmail).split('@')[0]
    : nameOrEmail;
  const base = normalizePublicUsernameLocalPart(source) || `estudiante${Date.now()}`;

  for (let index = 0; index < 20; index += 1) {
    const suffix = index === 0 ? '' : String(index + 1);
    const candidate = `${base}${suffix}@${PUBLIC_USERNAME_DOMAIN}`;
    const { data, error } = await supabase.from('usuarios').select('id').ilike('usuario', candidate).maybeSingle();
    if (error) throw new AppError('Error al validar usuario', 500, error.message);
    if (!data) return candidate;
  }

  return `${base}${crypto.randomBytes(3).toString('hex')}@${PUBLIC_USERNAME_DOMAIN}`;
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

const isMissingOptionalColumn = (error, columnName) => {
  const detail = [error && error.message, error && error.details].filter(Boolean).join(' ');
  return new RegExp(`${columnName}|schema cache|could not find|column .*does not exist`, 'i').test(detail);
};

const createUsuarioAllowingMissingOptionalColumns = async (payload) => {
  const fallbackPayload = { ...payload };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await usuariosService.createUsuario(fallbackPayload);
    } catch (error) {
      if (Object.prototype.hasOwnProperty.call(fallbackPayload, 'Celular') && isMissingOptionalColumn(error, 'Celular')) {
        delete fallbackPayload.Celular;
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(fallbackPayload, 'requiere_cambio_password') && isMissingOptionalColumn(error, 'requiere_cambio_password')) {
        delete fallbackPayload.requiere_cambio_password;
        continue;
      }
      throw error;
    }
  }

  return usuariosService.createUsuario(fallbackPayload);
};

const createPublicStudent = async ({ nombres, correo, usuario, password, dni, celular, curso_id: cursoId }) => {
  const cleanEmail = String(correo || '').trim().toLowerCase();
  const cleanName = String(nombres || '').trim();
  const cleanPassword = String(password || '').trim();
  const cleanPhone = String(celular || '').trim();

  if (!cleanName) throw new AppError('El nombre es obligatorio', 400);
  if (!isValidEmail(cleanEmail)) throw new AppError('Ingresa un correo valido', 400);
  if (!cleanPhone) throw new AppError('El celular es obligatorio', 400);
  if (cleanPassword.length < 4) throw new AppError('La contrasena debe tener al menos 4 caracteres', 400);

  const existing = await getUserByCredential(cleanEmail);
  if (existing) throw new AppError('Ya existe una cuenta con ese correo. Inicia sesion para continuar.', 409);
  await validateFreeCourse(cursoId);

  const rolId = await getStudentRoleId();
  const username = await uniquePublicUsername(usuario || cleanName || cleanEmail);
  const documentValue = String(dni || '').trim() || Date.now().toString().slice(-9);

  const created = await createUsuarioAllowingMissingOptionalColumns({
    DNI: documentValue,
    Nombres: cleanName,
    Correo: cleanEmail,
    Celular: cleanPhone || null,
    Cargo: 'Estudiante',
    [CAMPAIGN_COLUMN]: 'Cursos Gratis',
    Supervisor: '',
    Estado: 'Activo',
    fecha_ingreso: new Date().toISOString().slice(0, 10),
    usuario: username,
    password: cleanPassword,
    requiere_cambio_password: cleanPassword === PUBLIC_TEMPORARY_PASSWORD,
    rol_id: rolId,
    tipo_plan: 'Gratuito',
  });

  await ensureCourseAssignment(created.id, cursoId);
  await sendAdminRegistrationNotification({ student: created, courseId: cursoId, source: 'Registro con contrasena' });

  const user = await getUserByCredential(username);
  return signSession(user, true);
};

const requestMagicLink = async ({ nombres, correo, usuario, dni, celular, curso_id: cursoId, redirect_to: redirectTo }) => {
  const cleanEmail = String(correo || '').trim().toLowerCase();
  const cleanName = String(nombres || '').trim();
  const cleanPhone = String(celular || '').trim();
  let existing = cleanEmail ? await getUserByCredential(cleanEmail) : null;

  if (!isValidEmail(cleanEmail)) throw new AppError('Ingresa un correo valido', 400);
  if (!existing && !cleanName) throw new AppError('El nombre es obligatorio para crear la cuenta gratuita', 400);
  if (!existing && !cleanPhone) throw new AppError('El celular es obligatorio para crear la cuenta gratuita', 400);
  await validateFreeCourse(cursoId);
  if (!isAllowedRedirectUrl(redirectTo)) throw new AppError('La URL de retorno no es valida', 400);

  let generatedUsername = existing ? existing.usuario : '';
  let includeTemporaryCredentials = false;

  if (!existing) {
    const rolId = await getStudentRoleId();
    generatedUsername = await uniquePublicUsername(usuario || cleanName || cleanEmail);
    const created = await createUsuarioAllowingMissingOptionalColumns({
      DNI: String(dni || '').trim() || Date.now().toString().slice(-9),
      Nombres: cleanName,
      Correo: cleanEmail,
      Celular: cleanPhone || null,
      Cargo: 'Estudiante',
      [CAMPAIGN_COLUMN]: 'Cursos Gratis',
      Supervisor: '',
      Estado: 'Activo',
      fecha_ingreso: new Date().toISOString().slice(0, 10),
      usuario: generatedUsername,
      password: PUBLIC_TEMPORARY_PASSWORD,
      requiere_cambio_password: true,
      rol_id: rolId,
      tipo_plan: 'Gratuito',
    });
    existing = await getUserByCredential(created.usuario || generatedUsername);
    includeTemporaryCredentials = true;
    await sendAdminRegistrationNotification({ student: created, courseId: cursoId, source: 'Enlace magico / cursos gratis' });
  }

  if (existing && cursoId) await ensureCourseAssignment(existing.id, cursoId);

  const metadata = {
    nombres: cleanName || existing.Nombres || cleanEmail.split('@')[0],
    usuario: String(generatedUsername || existing?.usuario || '').trim(),
    dni: String(dni || existing?.DNI || '').trim(),
    celular: cleanPhone || existing?.Celular || '',
    curso_id: String(cursoId || ''),
    origen: 'catalogo_publico',
  };

  if (process.env.RESEND_API_KEY) {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: cleanEmail,
      options: {
        redirectTo,
        data: metadata,
      },
    });
    if (error) throw magicLinkError(error);
    const actionLink = data && data.properties && data.properties.action_link;
    if (!actionLink) throw new AppError('Supabase no genero el enlace magico', 500);
    await sendMagicLinkWithResend({
      to: cleanEmail,
      name: metadata.nombres,
      actionLink,
      username: includeTemporaryCredentials ? generatedUsername : null,
      temporaryPassword: includeTemporaryCredentials ? PUBLIC_TEMPORARY_PASSWORD : null,
    });
    return { correo: cleanEmail, provider: 'resend' };
  }

  throw new AppError('Configura RESEND_API_KEY en Railway para enviar enlaces magicos con Resend.', 500);
};

const completeMagicLink = async ({ access_token: accessToken, curso_id: cursoId }) => {
  const token = String(accessToken || '').trim();
  if (!token) throw new AppError('Token de acceso no recibido', 400);

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user || !data.user.email) {
    throw new AppError('No se pudo validar el enlace magico', 401, error ? error.message : null);
  }

  const email = String(data.user.email).trim().toLowerCase();
  const metadata = data.user.user_metadata || {};
  const resolvedCourseId = cursoId || metadata.curso_id || null;
  let user = await getUserByCredential(email);

  if (!user) {
    const rolId = await getStudentRoleId();
    const username = metadata.usuario
      ? await uniquePublicUsername(metadata.usuario)
      : await uniquePublicUsername(metadata.nombres || email);
    const created = await createUsuarioAllowingMissingOptionalColumns({
      DNI: String(metadata.dni || '').trim() || Date.now().toString().slice(-9),
      Nombres: String(metadata.nombres || metadata.name || email.split('@')[0]).trim(),
      Correo: email,
      Celular: String(metadata.celular || '').trim() || null,
      Cargo: 'Estudiante',
      [CAMPAIGN_COLUMN]: 'Cursos Gratis',
      Supervisor: '',
      Estado: 'Activo',
      fecha_ingreso: new Date().toISOString().slice(0, 10),
      usuario: username,
      password: PUBLIC_TEMPORARY_PASSWORD,
      requiere_cambio_password: true,
      rol_id: rolId,
      tipo_plan: 'Gratuito',
    });
    user = await getUserByCredential(created.usuario || username);
  }

  if (resolvedCourseId) await ensureCourseAssignment(user.id, resolvedCourseId);

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

const changePassword = async (usuarioId, { currentPassword, newPassword }) => {
  const user = await usuariosService.getUsuarioWithPasswordById(usuarioId);
  const current = String(currentPassword || '').trim();
  const next = String(newPassword || '').trim();

  if (!current) throw new AppError('Ingresa tu clave actual', 400);
  if (next.length < 6) throw new AppError('La nueva contrasena debe tener al menos 6 caracteres', 400);

  const isCurrentValid = await bcrypt.compare(current, user.password_hash || '');
  if (!isCurrentValid) throw new AppError('La clave actual no es correcta', 401);

  const updated = await usuariosService.updateUsuario(usuarioId, {
    password: next,
    requiere_cambio_password: false,
  });

  return updated;
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
      [CAMPAIGN_COLUMN]: 'Cursos Gratis',
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
  requestMagicLink,
  completeMagicLink,
  googleConfig,
  loginWithGoogle,
  changePassword,
  getMe,
};

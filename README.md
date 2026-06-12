# AN Academy - Backend LMS

Backend Node.js + Express + Supabase PostgreSQL para el LMS corporativo AN Academy.

## 1. Instalar dependencias

```bash
npm install
```

## 2. Configurar variables de entorno

Crea `.env` usando `.env.example` como base:

```env
PORT=3001
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu_clave_de_supabase
JWT_SECRET=una_clave_larga_y_segura
JWT_EXPIRES_IN=8h
```

No uses la Service Role Key en el frontend.

## 3. Crear roles y usuario Admin

Ejecuta en Supabase SQL Editor:

```text
database/001_roles_usuarios_auth.sql
```

Ese script crea/actualiza:

- `roles`
- columnas de auth en `usuarios`
- roles por defecto
- usuario `Admin` con contrasena `Admin` hasheada con bcrypt

## 4. Ejecutar servidor

```bash
npm run dev
```

Servidor local:

```text
http://localhost:3001
```

## 5. Probar login Admin/Admin

```bash
curl -X POST http://localhost:3001/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"usuario\":\"Admin\",\"password\":\"Admin\"}"
```

Respuesta esperada:

```json
{
  "ok": true,
  "token": "...",
  "usuario": {
    "id": 1,
    "usuario": "Admin",
    "nombre": "Administrador",
    "rol_nombre": "Administrador"
  }
}
```

## 6. Probar CRUD de usuarios

Usa el token del login:

```bash
curl http://localhost:3001/api/usuarios ^
  -H "Authorization: Bearer TU_TOKEN"
```

Crear usuario:

```bash
curl -X POST http://localhost:3001/api/usuarios ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer TU_TOKEN" ^
  -d "{\"DNI\":\"12345678\",\"Nombres\":\"Juan Perez\",\"Correo\":\"juan@empresa.com\",\"Cargo\":\"Asesor\",\"Campaña\":\"Ventas\",\"Supervisor\":\"Maria Lopez\",\"Estado\":\"Activo\",\"fecha_ingreso\":\"2026-06-04\",\"usuario\":\"jperez\",\"password\":\"1234\",\"rol_id\":4}"
```

## Endpoints implementados

Auth:

- `POST /api/auth/login`
- `GET /api/auth/me`

Roles:

- `GET /api/roles`
- `POST /api/roles`
- `PUT /api/roles/:id`
- `DELETE /api/roles/:id`

Usuarios:

- `GET /api/usuarios`
- `GET /api/usuarios/:id`
- `POST /api/usuarios`
- `PUT /api/usuarios/:id`
- `DELETE /api/usuarios/:id`

Dashboard inicial:

- `GET /api/dashboard/general`
- `GET /api/dashboard/capacitacion`
- `GET /api/dashboard/calidad`
- `GET /api/dashboard/desarrollo`
- `GET /api/dashboard/retencion`

## Frontend Google Apps Script

Los archivos estan en:

```text
frontend-gas/
```

Como Google Apps Script no maneja carpetas igual que un proyecto local, se simulo la estructura con nombres:

- `components_login.html`
- `components_sidebar.html`
- `components_navbar.html`
- `components_dashboard.html`
- `components_usuarios.html`
- `components_cursos.html`
- `services_api.html`
- `services_auth.html`
- `services_usuarios.html`
- `services_cursos.html`
- `services_dashboard.html`

Pega cada archivo en el editor de Apps Script con el mismo nombre.

Importante: `services_api.html` usa:

```js
const API_URL = 'http://localhost:3001';
```

Para usar Apps Script publicado en internet, cambia esa URL por una API publica como Render, Railway, VPS o un tunel tipo ngrok.

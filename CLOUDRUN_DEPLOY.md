# Despliegue en Google Cloud Run - AN Academy

Guia para desplegar el backend `lms-an-api` en Google Cloud Run.

## 1. Instalar Google Cloud CLI

Descarga e instala Google Cloud CLI:

```text
https://cloud.google.com/sdk/docs/install
```

Verifica la instalacion:

```bash
gcloud --version
```

## 2. Iniciar sesion

```bash
gcloud auth login
```

## 3. Seleccionar proyecto

Reemplaza `PROJECT_ID` por el id real de tu proyecto en Google Cloud.

```bash
gcloud config set project PROJECT_ID
```

## 4. Habilitar APIs necesarias

```bash
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

## 5. Desplegar desde el codigo fuente

Ejecuta este comando desde la raiz del backend, donde estan `package.json` y `Dockerfile`.

```bash
gcloud run deploy lms-an-api \
--source . \
--region us-west2 \
--allow-unauthenticated
```

Cloud Run detectara el proyecto Node.js y usara el puerto definido por `process.env.PORT`.

## 6. Configurar variables de entorno

Reemplaza los valores `...` por tus credenciales reales.

```bash
gcloud run services update lms-an-api \
--region us-west2 \
--update-env-vars="SUPABASE_URL=...,SUPABASE_KEY=...,JWT_SECRET=...,JWT_EXPIRES_IN=8h,NODE_ENV=production"
```

Variables requeridas:

```text
SUPABASE_URL
SUPABASE_KEY
JWT_SECRET
JWT_EXPIRES_IN
PORT
```

Nota: `PORT` lo define Cloud Run automaticamente. No necesitas configurarlo manualmente.

## 7. Verificar health check

Cuando termine el despliegue, Cloud Run mostrara una URL parecida a:

```text
https://lms-an-api-xxxxx-uw.a.run.app
```

Prueba:

```bash
curl https://TU_URL_CLOUD_RUN/api/health
```

Respuesta esperada:

```json
{
  "ok": true,
  "service": "lms-an-api"
}
```

Tambien puedes validar version:

```bash
curl https://TU_URL_CLOUD_RUN/api/version
```

Respuesta esperada:

```json
{
  "app": "AN Academy",
  "version": "1.0.0",
  "environment": "production"
}
```

## 8. Probar login

```bash
curl -X POST https://TU_URL_CLOUD_RUN/api/auth/login \
-H "Content-Type: application/json" \
-d "{\"usuario\":\"Admin\",\"password\":\"Admin\"}"
```

La respuesta debe incluir un token JWT y los datos del usuario administrador.

## 9. Actualizar frontend

Cuando Cloud Run este funcionando, cambia la URL del frontend desde:

```js
const API_URL = 'http://localhost:3001';
```

a:

```js
const API_URL = 'https://TU_URL_CLOUD_RUN';
```

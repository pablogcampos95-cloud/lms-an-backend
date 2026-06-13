require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth.routes');
const rolesRoutes = require('./routes/roles.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const cursosRoutes = require('./routes/cursos.routes');
const modulosRoutes = require('./routes/modulos.routes');
const leccionesRoutes = require('./routes/lecciones.routes');
const evaluacionesRoutes = require('./routes/evaluaciones.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const estudianteRoutes = require('./routes/estudiante.routes');
const { notFoundHandler, errorHandler } = require('./middlewares/error.middleware');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    ok: true,
    message: 'LMS conectado a Supabase',
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'lms-an-api',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/version', (req, res) => {
  res.json({
    app: 'AN Academy',
    version: '1.0.0',
    environment: process.env.NODE_ENV,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/cursos', cursosRoutes);
app.use('/api/modulos', modulosRoutes);
app.use('/api/lecciones', leccionesRoutes);
app.use('/api/evaluaciones', evaluacionesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/estudiante', estudianteRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Servidor LMS AN escuchando en el puerto ${PORT}`);
});

require('dotenv').config();
require('express-async-errors');
const path = require('path');
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { Server } = require('socket.io');

const { runMigrations } = require('./db/migrate');
const { connectMongo } = require('./db/mongo');
const { initSockets } = require('./sockets/index');
const { startCleanupJob } = require('./jobs/cleanupStories');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN || '*' },
  maxHttpBufferSize: 5e6, // consistente con los 5MB de express.json
});

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(compression());
app.use(morgan('tiny'));
app.use(express.json({ limit: '5mb' })); // suficiente para fotos de perfil en base64

// ---------------- API ----------------
app.get('/api/salud', (req, res) => res.json({ ok: true, hora: new Date().toISOString() }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/usuarios', require('./routes/users'));
app.use('/api/amigos', require('./routes/friends'));
app.use('/api/publicaciones', require('./routes/posts'));
app.use('/api/estados', require('./routes/stories'));
app.use('/api/notificaciones', require('./routes/notifications'));
app.use('/api/mensajes', require('./routes/messages'));
app.use('/api/moderacion', require('./routes/moderacion'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/anuncios', require('./routes/announcements'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/ailab', require('./routes/ailab'));
app.use('/api/features', require('./routes/features'));
app.use('/api/monetizacion', require('./routes/monetization'));
app.use('/api/bridge', require('./routes/bridge'));
app.use('/api/citas', require('./routes/appointments'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/image-editor', require('./routes/imageEditor'));

// Endpoint para Android App Links (Digital Asset Links)
app.get('/.well-known/assetlinks.json', (req, res) => {
  res.json([{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "com.enlace.bridge",
      sha256_cert_fingerprints: [
        process.env.ANDROID_APP_SHA256 || "00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00"
      ]
    }
  }]);
});

// ---------------- Frontend (PWA estática) ----------------
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_DIR, { maxAge: '1h' }));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// ---------------- Manejo de errores ----------------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

const PORT = process.env.PORT || 10000;

async function start() {
  try {
    await runMigrations(); // crea/actualiza el esquema de Postgres solo, sin destruir nada
  } catch (err) {
    console.warn('[arranque] Omitiendo migraciones PostgreSQL (sin DATABASE_URL o base de datos no configurada):', err.message);
  }
  try {
    await connectMongo(); // conecta a MongoDB Atlas si existe
  } catch (err) {
    console.warn('[arranque] Omitiendo Mongo (se usará PostgreSQL para la mensajería).');
  }

  // Inicializar sockets y trabajadores en segundo plano una vez completadas las migraciones
  initSockets(io);
  startCleanupJob();

  server.listen(PORT, () => {
    console.log(`[arranque] Enlace escuchando en el puerto ${PORT}`);
  });
}

start();

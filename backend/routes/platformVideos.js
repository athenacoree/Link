const express = require('express');
const multer = require('multer');
const { query } = require('../db/postgres');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB max per video upload
});

// Lista de ranuras / posiciones de video soportadas en la plataforma
const STANDARD_SLOTS = [
  {
    slot: 'splash',
    title: 'Pantalla de Carga (Splash Screen)',
    description: 'Video a pantalla completa que se muestra a todos los usuarios mientras carga la aplicación o la página web.'
  },
  {
    slot: 'intermission',
    title: 'Intermisión / Receso de Link Video',
    description: 'Video promocional que se reproduce durante pausas, reconexión o recesos en la plataforma de streaming Link Video.'
  },
  {
    slot: 'login_bg',
    title: 'Fondo de Inicio de Sesión',
    description: 'Video animado de fondo opcional que se muestra en la pantalla de autenticación y registro.'
  },
  {
    slot: 'banner_promo',
    title: 'Banner Promocional / Publicidad Global',
    description: 'Video destacado que se muestra en la sección de inicio o promociones de la plataforma.'
  }
];

/**
 * GET /api/platform-videos/slots
 * Obtener lista de posiciones soportadas y su descripción
 */
router.get('/slots', (req, res) => {
  res.json({ slots: STANDARD_SLOTS });
});

/**
 * GET /api/platform-videos/active
 * Obtener metadatos de los videos activos actualmente (sin la data binaria grande)
 */
router.get('/active', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, slot, title, description, mime_type, filename, file_size, updated_at
         FROM platform_videos
        ORDER BY slot ASC`
    );

    const activeMap = {};
    rows.forEach(r => {
      activeMap[r.slot] = {
        ...r,
        stream_url: `/api/platform-videos/stream/${r.slot}?v=${new Date(r.updated_at).getTime()}`
      };
    });

    res.json({
      slots: STANDARD_SLOTS.map(s => ({
        ...s,
        video: activeMap[s.slot] || null
      }))
    });
  } catch (err) {
    console.error('Error al obtener videos activos de la plataforma:', err.message);
    res.json({
      slots: STANDARD_SLOTS.map(s => ({
        ...s,
        video: null
      }))
    });
  }
});

/**
 * GET /api/platform-videos/stream/:slot
 * Transmite el video binario almacenado en la base de datos para la ranura especificada.
 * Soporta peticiones HTTP Range (206 Partial Content) indispensables para reproductores de video en navegadores.
 */
router.get('/stream/:slot', async (req, res) => {
  try {
    const { slot } = req.params;
    const { rows } = await query(
      `SELECT video_data, mime_type, filename, file_size, updated_at
         FROM platform_videos
        WHERE slot = $1`,
      [slot]
    );

    if (!rows.length || !rows[0].video_data) {
      return res.status(404).json({ error: `No hay un video configurado para la ranura '${slot}'.` });
    }

    const video = rows[0];
    const videoBuffer = video.video_data;
    const totalSize = videoBuffer.length;
    const mimeType = video.mime_type || 'video/mp4';
    const etag = `W/"video-${slot}-${new Date(video.updated_at).getTime()}"`;

    // Comprobar cabecera ETag / If-None-Match para caché 304 Not Modified
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', etag);

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

      if (isNaN(start) || isNaN(end) || start >= totalSize || end >= totalSize || start > end) {
        res.setHeader('Content-Range', `bytes */${totalSize}`);
        return res.status(416).end();
      }

      const chunkSize = (end - start) + 1;
      const chunk = videoBuffer.slice(start, end + 1);

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Content-Length': chunkSize,
        'Content-Type': mimeType
      });
      res.end(chunk);
    } else {
      res.writeHead(200, {
        'Content-Length': totalSize,
        'Content-Type': mimeType
      });
      res.end(videoBuffer);
    }
  } catch (err) {
    console.error('Error transmitiendo video de plataforma:', err);
    res.status(500).json({ error: 'Error al transmitir el video de la plataforma.' });
  }
});

// ================= RUTAS ADMINISTRATIVAS =================

/**
 * GET /api/admin/platform-videos
 * Obtiene el estado detallado de las ranuras de video para el panel de administración
 */
router.get('/admin/list', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, slot, title, description, mime_type, filename, file_size, updated_at
         FROM platform_videos
        ORDER BY slot ASC`
    );

    const existingMap = {};
    rows.forEach(r => {
      existingMap[r.slot] = {
        ...r,
        stream_url: `/api/platform-videos/stream/${r.slot}?v=${new Date(r.updated_at).getTime()}`
      };
    });

    res.json({
      slots: STANDARD_SLOTS.map(s => ({
        ...s,
        video: existingMap[s.slot] || null
      }))
    });
  } catch (err) {
    console.error('Error al listar videos en el panel de administrador:', err.message);
    res.json({
      slots: STANDARD_SLOTS.map(s => ({
        ...s,
        video: null
      }))
    });
  }
});

/**
 * POST /api/admin/platform-videos/upload
 * Sube o actualiza un video guardando el archivo binario completo directamente en la BD
 */
router.post('/admin/upload', requireAuth, requireAdmin, upload.single('video_file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Debes seleccionar un archivo de video válido.' });
    }

    const slot = (req.body.slot || 'splash').trim().toLowerCase();
    const title = (req.body.title || req.file.originalname || `Video ${slot}`).trim();
    const description = (req.body.description || '').trim();
    const mimeType = req.file.mimetype || 'video/mp4';
    const filename = req.file.originalname || `${slot}.mp4`;
    const fileSize = req.file.size;
    const videoBuffer = req.file.buffer;

    if (!slot || !/^[a-z0-9_]+$/.test(slot)) {
      return res.status(400).json({ error: 'Identificador de ranura (slot) inválido.' });
    }

    const { rows } = await query(
      `INSERT INTO platform_videos (slot, title, description, video_data, mime_type, filename, file_size, updated_at, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8)
       ON CONFLICT (slot) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         video_data = EXCLUDED.video_data,
         mime_type = EXCLUDED.mime_type,
         filename = EXCLUDED.filename,
         file_size = EXCLUDED.file_size,
         updated_at = now(),
         updated_by = EXCLUDED.updated_by
       RETURNING id, slot, title, description, mime_type, filename, file_size, updated_at`,
      [slot, title, description, videoBuffer, mimeType, filename, fileSize, req.userId]
    );

    const saved = rows[0];
    res.json({
      ok: true,
      mensaje: `¡Video para '${slot}' subido a la base de datos con éxito en su calidad original!`,
      video: {
        ...saved,
        stream_url: `/api/platform-videos/stream/${saved.slot}?v=${new Date(saved.updated_at).getTime()}`
      }
    });
  } catch (err) {
    console.error('Error al subir video de la plataforma:', err);
    res.status(500).json({ error: 'No se pudo subir el video: ' + err.message });
  }
});

/**
 * DELETE /api/admin/platform-videos/:slot
 * Elimina el video configurado para una ranura específica
 */
router.delete('/admin/:slot', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { slot } = req.params;
    await query(`DELETE FROM platform_videos WHERE slot = $1`, [slot]);
    res.json({ ok: true, mensaje: `Video para '${slot}' eliminado correctamente.` });
  } catch (err) {
    console.error('Error al eliminar video de la plataforma:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

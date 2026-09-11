const express = require('express');
const multer = require('multer');
const AdmZip = require('adm-zip');
const { query, pool } = require('../db/postgres');
const Message = require('../models/Message');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { publicUser, meUser } = require('../utils/serialize');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const router = express.Router();
router.use(requireAuth, requireAdmin);

// ---- Buscar cualquier usuario (para verificar/banear) ----
router.get('/usuarios', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const { rows } = q
      ? (await query(`SELECT * FROM users WHERE name ILIKE $1 OR email ILIKE $1 ORDER BY name ASC LIMIT 40`, [`%${q}%`]))
      : (await query(`SELECT * FROM users ORDER BY created_at DESC LIMIT 40`))
    ;
    res.json({ personas: rows.map(meUser) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Poner / quitar el check de verificado (como Instagram/WhatsApp) ----
router.put('/usuarios/:id/verificado', async (req, res) => {
  try {
    const { verificado } = req.body;
    const { rows } = await query(
      `UPDATE users SET verified=$1, verified_at = CASE WHEN $1 THEN now() ELSE NULL END, verified_by = CASE WHEN $1 THEN $2 ELSE NULL END
        WHERE id=$3 RETURNING *`,
      [!!verificado, req.userId, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Persona no encontrada.' });
    res.json({ persona: publicUser(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Banear / desbanear una cuenta ----
router.put('/usuarios/:id/baneo', async (req, res) => {
  try {
    const { baneado, motivo } = req.body;
    if (req.params.id === req.userId && baneado) {
      return res.status(400).json({ error: 'No puedes banearte a ti mismo.' });
    }
    const { rows } = await query(
      `UPDATE users SET banned=$1,
          banned_reason = CASE WHEN $1 THEN $2 ELSE NULL END,
          banned_at = CASE WHEN $1 THEN now() ELSE NULL END,
          banned_by = CASE WHEN $1 THEN $3 ELSE NULL END
        WHERE id=$4 RETURNING *`,
      [!!baneado, (motivo || '').slice(0, 300) || null, req.userId, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Persona no encontrada.' });
    res.json({ persona: meUser(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Ver reportes (por defecto, solo los pendientes) ----
router.get('/reportes', async (req, res) => {
  try {
    const estado = req.query.estado || 'pendiente';
    const { rows } = await query(
      `SELECT r.*,
          ru.name AS reportante_nombre,
          tu.name AS objetivo_nombre, tu.avatar_data AS objetivo_avatar,
          p.text AS publicacion_texto, p.image_data AS publicacion_imagen
         FROM reports r
         JOIN users ru ON ru.id = r.reporter_id
         LEFT JOIN users tu ON tu.id = r.target_user_id
         LEFT JOIN posts p ON p.id = r.target_post_id
        WHERE ($1 = 'todos' OR r.status = $1)
        ORDER BY r.created_at DESC LIMIT 100`,
      [estado]
    );
    res.json({ reportes: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Marcar un reporte como resuelto o descartado ----
router.put('/reportes/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['resuelto', 'descartado', 'pendiente'].includes(status)) {
      return res.status(400).json({ error: 'Estado inválido.' });
    }
    const { rows } = await query(
      `UPDATE reports SET status=$1, reviewed_by=$2, reviewed_at=now() WHERE id=$3 RETURNING *`,
      [status, req.userId, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Reporte no encontrado.' });
    res.json({ reporte: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Publicaciones de una persona, para moderar desde el panel ----
router.get('/usuarios/:id/publicaciones', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT p.*,
          (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS total_likes,
          (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS total_comentarios
         FROM posts p WHERE p.user_id = $1 ORDER BY p.created_at DESC LIMIT 50`,
      [req.params.id]
    );
    res.json({ publicaciones: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---- EXPORTAR BASE DE DATOS EN ZIP CON MANIFEST ----
router.get('/exportar-db', async (req, res) => {
  try {
    const zip = new AdmZip();

    // Export Postgres Tables
    const tables = [
      'users',
      'friendships',
      'posts',
      'post_likes',
      'post_comments',
      'stories',
      'story_views',
      'notifications',
      'calls',
      'contact_verifications',
      'reports'
    ];

    const recordCounts = {};

    for (const table of tables) {
      try {
        const { rows } = await query(`SELECT * FROM ${table}`);
        zip.addFile(`postgres_${table}.json`, Buffer.from(JSON.stringify(rows, null, 2), 'utf8'));
        recordCounts[`postgres_${table}`] = rows.length;
      } catch (e) {
        console.error(`Export warning for table ${table}:`, e.message);
        recordCounts[`postgres_${table}`] = 0;
      }
    }

    // Export MongoDB Messages
    let mongoMessages = [];
    try {
      mongoMessages = await Message.find({}).lean();
      zip.addFile('mongodb_messages.json', Buffer.from(JSON.stringify(mongoMessages, null, 2), 'utf8'));
      recordCounts['mongodb_messages'] = mongoMessages.length;
    } catch (e) {
      console.error('Export warning for Mongo messages:', e.message);
      recordCounts['mongodb_messages'] = 0;
    }

    const manifest = {
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      exported_by: req.userId,
      app: 'Enlace Red Social',
      environment: process.env.NODE_ENV || 'production',
      records: recordCounts,
      description: 'Respaldo completo de base de datos de Enlace (PostgreSQL + MongoDB Atlas).'
    };

    zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));

    const zipBuffer = zip.toBuffer();
    const filename = `enlace_db_backup_${new Date().toISOString().slice(0, 10)}.zip`;

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': zipBuffer.length,
    });

    return res.send(zipBuffer);
  } catch (err) {
    console.error('Error al exportar base de datos:', err);
    res.status(500).json({ error: 'No se pudo exportar la base de datos.' });
  }
});

// ---- IMPORTAR BASE DE DATOS DESDE ZIP ----
router.post('/importar-db', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Debes proporcionar un archivo ZIP de respaldo.' });
    }

    const zip = new AdmZip(req.file.buffer);
    const manifestEntry = zip.getEntry('manifest.json');
    if (!manifestEntry) {
      return res.status(400).json({ error: 'El archivo ZIP no contiene un manifest.json válido.' });
    }

    const manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
    console.log(`[Import] Procesando respaldo versión ${manifest.version} exportado el ${manifest.exported_at}`);

    // Non-destructive import for PostgreSQL tables
    const tableFiles = [
      'postgres_users.json',
      'postgres_friendships.json',
      'postgres_posts.json',
      'postgres_post_likes.json',
      'postgres_post_comments.json',
      'postgres_stories.json',
      'postgres_story_views.json',
      'postgres_notifications.json',
      'postgres_calls.json',
      'postgres_contact_verifications.json',
      'postgres_reports.json'
    ];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const file of tableFiles) {
        const entry = zip.getEntry(file);
        if (!entry) continue;
        const tableName = file.replace('postgres_', '').replace('.json', '');
        const rows = JSON.parse(entry.getData().toString('utf8'));

        for (const row of rows) {
          const keys = Object.keys(row);
          if (!keys.length) continue;
          const columns = keys.map(k => `"${k}"`).join(', ');
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
          const values = keys.map(k => row[k]);

          // Non-destructive: ON CONFLICT DO NOTHING
          const conflictTarget = keys.includes('id') ? '("id")' : (keys.includes('user_a') && keys.includes('user_b') ? '("user_a", "user_b")' : null);
          const sql = conflictTarget
            ? `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders}) ON CONFLICT ${conflictTarget} DO NOTHING`
            : `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

          await client.query(sql, values).catch(e => {
            // Log warning if conflict target signature doesn't match table constraint, keep moving non-destructively
            console.warn(`[Import warning] Tabla ${tableName}:`, e.message);
          });
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Import MongoDB Messages
    const mongoEntry = zip.getEntry('mongodb_messages.json');
    if (mongoEntry) {
      const messages = JSON.parse(mongoEntry.getData().toString('utf8'));
      for (const msg of messages) {
        await Message.updateOne({ _id: msg._id }, { $setOnInsert: msg }, { upsert: true }).catch(e => {
          console.warn('[Import Mongo warning]:', e.message);
        });
      }
    }

    res.json({
      ok: true,
      mensaje: `Base de datos importada correctamente (Versión del manifiesto: ${manifest.version}, Fecha: ${manifest.exported_at}).`,
      manifest
    });
  } catch (err) {
    console.error('Error al importar base de datos:', err);
    res.status(500).json({ error: `Falló la importación: ${err.message}` });
  }
});

module.exports = router;

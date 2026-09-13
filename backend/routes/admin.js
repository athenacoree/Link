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
      ? (await query(`SELECT * FROM users WHERE name ILIKE $1 OR email ILIKE $1 OR username ILIKE $1 ORDER BY name ASC LIMIT 40`, [`%${q}%`]))
      : (await query(`SELECT * FROM users ORDER BY created_at DESC LIMIT 40`))
    ;
    res.json({ personas: rows.map(meUser) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const isUuid = (val) => typeof val === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val);

// ---- Poner / quitar el check de verificado ----
router.put('/usuarios/:id/verificado', async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const adminUserId = req.userId;

    if (!isUuid(adminUserId)) {
      return res.status(400).json({ error: 'El ID del administrador no es un UUID válido.' });
    }
    if (!isUuid(targetUserId)) {
      return res.status(400).json({ error: 'El ID del usuario a verificar no es un UUID válido.' });
    }

    const verificadoInput = req.body.verificado;
    const isVerified = verificadoInput === true || verificadoInput === 'true';
    const { rows } = await query(
      `UPDATE users
       SET verified = $1,
           verified_at = CASE WHEN $1 THEN now() ELSE NULL END,
           verified_by = CASE WHEN $1 THEN $2::uuid ELSE NULL::uuid END
       WHERE id = $3::uuid RETURNING *`,
      [isVerified, adminUserId, targetUserId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Persona no encontrada.' });
    res.json({ persona: meUser(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Banear / desbanear una cuenta ----
router.put('/usuarios/:id/baneo', async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const adminUserId = req.userId;

    if (!isUuid(adminUserId)) {
      return res.status(400).json({ error: 'El ID del administrador no es un UUID válido.' });
    }
    if (!isUuid(targetUserId)) {
      return res.status(400).json({ error: 'El ID del usuario no es un UUID válido.' });
    }

    const { baneado, motivo } = req.body;
    if (targetUserId === adminUserId && baneado) {
      return res.status(400).json({ error: 'No puedes banearte a ti mismo.' });
    }
    const { rows } = await query(
      `UPDATE users SET banned=$1,
          banned_reason = CASE WHEN $1 THEN $2 ELSE NULL END,
          banned_at = CASE WHEN $1 THEN now() ELSE NULL END,
          banned_by = CASE WHEN $1 THEN $3::uuid ELSE NULL::uuid END
        WHERE id=$4::uuid RETURNING *`,
      [!!baneado, (motivo || '').slice(0, 300) || null, adminUserId, targetUserId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Persona no encontrada.' });
    res.json({ persona: meUser(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Ver reportes ----
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

// ---- ANUNCIOS GLOBALES DEL ADMIN ----
router.post('/anuncios', async (req, res) => {
  try {
    const { title, content, expires_in_hours } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Falta título o contenido.' });
    const hours = Math.max(1, parseInt(expires_in_hours) || 24);
    const { rows } = await query(
      `INSERT INTO announcements (title, content, created_by, expires_at)
       VALUES ($1, $2, $3, now() + ($4 || ' hours')::interval) RETURNING *`,
      [title.trim(), content.trim(), req.userId, `${hours}`]
    );
    res.status(201).json({ anuncio: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/anuncios', async (req, res) => {
  try {
    const { rows } = await query(`SELECT * FROM announcements ORDER BY created_at DESC LIMIT 50`);
    res.json({ anuncios: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/anuncios/:id', async (req, res) => {
  try {
    await query(`DELETE FROM announcements WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---- CONFIGURACIÓN DEL SISTEMA (AI OpenRouter, etc.) ----
router.get('/system-settings', async (req, res) => {
  try {
    const { rows } = await query(`SELECT key, value, updated_at FROM system_settings`);
    const settingsMap = {};
    rows.forEach(r => { settingsMap[r.key] = r.value; });
    res.json({ settings: settingsMap });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/system-settings', async (req, res) => {
  try {
    const settings = req.body.settings || req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Datos de configuración inválidos.' });
    }

    const keys = Object.keys(settings);
    for (const key of keys) {
      const val = String(settings[key] ?? '');
      await query(
        `INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [key, val]
      );
    }
    res.json({ ok: true, mensaje: 'Configuración del sistema actualizada correctamente.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Comprobar OpenRouter API contra la API oficial en tiempo real
router.post('/test-openrouter', async (req, res) => {
  try {
    const { openrouter_api_key, openrouter_model, ai_personality } = req.body;
    if (!openrouter_api_key || !openrouter_api_key.trim()) {
      return res.status(400).json({ error: 'Debes ingresar una clave API de OpenRouter.' });
    }

    const modelToUse = openrouter_model || 'meta-llama/llama-3.1-8b-instruct:free';
    const testMessages = [
      { role: 'system', content: ai_personality || 'Eres un asistente de pruebas.' },
      { role: 'user', content: 'Responde sólo en 5 palabras probando la conexión de API.' }
    ];

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouter_api_key.trim()}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.SITE_URL || 'https://link-app.onrender.com',
        'X-Title': 'Link App Admin Test',
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: testMessages,
        max_tokens: 50
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Falló la prueba con OpenRouter (${response.status}): ${errText}` });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'Conexión exitosa pero sin contenido de respuesta.';

    res.json({
      success: true,
      message: '¡Prueba exitosa! La API de OpenRouter respondió correctamente.',
      model: data.model || modelToUse,
      reply,
      usage: data.usage || null
    });
  } catch (err) {
    console.error('Error probando OpenRouter:', err);
    res.status(500).json({ error: `Error de red al conectar con OpenRouter: ${err.message}` });
  }
});

// ---- EDITOR DIRECTO DE TABLAS Y CONSOLA SQL ----
router.get('/db/tables', async (req, res) => {
  try {
    const { rows: tables } = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const result = [];
    for (const t of tables) {
      const name = t.table_name;
      try {
        const { rows: countRows } = await query(`SELECT COUNT(*) AS total FROM "${name}"`);
        result.push({ name, total: parseInt(countRows[0].total) || 0 });
      } catch (e) {
        result.push({ name, total: 0 });
      }
    }
    res.json({ tables: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/db/tables/:table', async (req, res) => {
  const tableName = req.params.table;
  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    return res.status(400).json({ error: 'Nombre de tabla inválido.' });
  }

  try {
    const { rows: columns } = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `, [tableName]);

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 50;
    const offset = (page - 1) * limit;

    const { rows: data } = await query(`SELECT * FROM "${tableName}" LIMIT $1 OFFSET $2`, [limit, offset]);
    const { rows: totalRows } = await query(`SELECT COUNT(*) AS total FROM "${tableName}"`);

    res.json({
      table: tableName,
      columns,
      rows: data,
      total: parseInt(totalRows[0].total) || 0,
      page,
      limit
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/db/tables/:table/row', async (req, res) => {
  const tableName = req.params.table;
  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    return res.status(400).json({ error: 'Nombre de tabla inválido.' });
  }

  const { primaryKeyField, primaryKeyValue, data } = req.body;
  if (!primaryKeyField || primaryKeyValue === undefined || !data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Debes proporcionar la clave primaria y los datos a actualizar.' });
  }

  if (!/^[a-zA-Z0-9_]+$/.test(primaryKeyField)) {
    return res.status(400).json({ error: 'Campo de clave primaria inválido.' });
  }

  try {
    const keys = Object.keys(data).filter(k => /^[a-zA-Z0-9_]+$/.test(k));
    if (!keys.length) return res.status(400).json({ error: 'No se enviaron campos válidos para actualizar.' });

    const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    const values = keys.map(k => {
      const val = data[k];
      return (typeof val === 'object' && val !== null) ? JSON.stringify(val) : val;
    });

    values.push(primaryKeyValue);
    const sql = `UPDATE "${tableName}" SET ${setClauses} WHERE "${primaryKeyField}" = $${values.length} RETURNING *`;

    const { rows } = await query(sql, values);
    if (!rows.length) return res.status(404).json({ error: 'Fila no encontrada para actualizar.' });
    res.json({ ok: true, row: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/db/tables/:table/row', async (req, res) => {
  const tableName = req.params.table;
  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    return res.status(400).json({ error: 'Nombre de tabla inválido.' });
  }

  const { primaryKeyField, primaryKeyValue } = req.body;
  if (!primaryKeyField || primaryKeyValue === undefined) {
    return res.status(400).json({ error: 'Debes proporcionar la clave primaria para borrar.' });
  }

  if (!/^[a-zA-Z0-9_]+$/.test(primaryKeyField)) {
    return res.status(400).json({ error: 'Campo de clave primaria inválido.' });
  }

  try {
    const sql = `DELETE FROM "${tableName}" WHERE "${primaryKeyField}" = $1 RETURNING *`;
    const { rows } = await query(sql, [primaryKeyValue]);
    res.json({ ok: true, deleted: rows[0] || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/db/query', async (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql || !sql.trim()) return res.status(400).json({ error: 'Proporciona una consulta SQL.' });

    const result = await query(sql.trim());
    res.json({
      command: result.command,
      rowCount: result.rowCount,
      fields: result.fields ? result.fields.map(f => f.name) : [],
      rows: result.rows || []
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
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

    // Obtener dinámicamente la lista de todas las tablas existentes en el esquema público
    const { rows: tableRows } = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tables = tableRows.map(t => t.table_name);
    const recordCounts = {};

    for (const table of tables) {
      try {
        const { rows } = await query(`SELECT * FROM "${table}"`);
        zip.addFile(`postgres_${table}.json`, Buffer.from(JSON.stringify(rows, null, 2), 'utf8'));
        recordCounts[`postgres_${table}`] = rows.length;
      } catch (e) {
        console.error(`Export warning for table ${table}:`, e.message);
        recordCounts[`postgres_${table}`] = 0;
      }
    }

    const manifest = {
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      exported_by: req.userId,
      app: 'Enlace Red Social',
      environment: process.env.NODE_ENV || 'production',
      tables_count: tables.length,
      records: recordCounts,
      description: 'Respaldo completo de base de datos de Enlace (PostgreSQL).'
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

    const entries = zip.getEntries();
    const tableEntries = entries.filter(e => e.entryName.startsWith('postgres_') && e.entryName.endsWith('.json'));

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const entry of tableEntries) {
        const tableName = entry.entryName.replace('postgres_', '').replace('.json', '');
        if (!/^[a-zA-Z0-9_]+$/.test(tableName)) continue;

        const rows = JSON.parse(entry.getData().toString('utf8'));

        for (const row of rows) {
          const keys = Object.keys(row);
          if (!keys.length) continue;
          const columns = keys.map(k => `"${k}"`).join(', ');
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
          const values = keys.map(k => {
            const val = row[k];
            return (typeof val === 'object' && val !== null) ? JSON.stringify(val) : val;
          });

          const sql = `INSERT INTO "${tableName}" (${columns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

          await client.query(sql, values).catch(e => {
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

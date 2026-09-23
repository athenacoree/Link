const express = require('express');
const multer = require('multer');
const AdmZip = require('adm-zip');
const { query, pool } = require('../db/postgres');
const Message = require('../models/Message');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { publicUser, meUser } = require('../utils/serialize');
const { getAISettings, chatCompletion } = require('../services/aiService');
const { registry, stateManager, runGoogleServicesBootstrap, sanitizeObject } = require('../google-services');

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

router.put('/ai-characters/:id', async (req, res) => {
  try {
    const { name, avatar, personality, greeting, is_public } = req.body;
    if (!name || !personality) {
      return res.status(400).json({ error: 'Nombre y personalidad son requeridos.' });
    }

    const { rows } = await query(
      `UPDATE ai_characters SET name=$1, avatar=$2, personality=$3, greeting=$4, is_public=$5 WHERE id=$6 RETURNING *`,
      [name.trim(), avatar || '🤖', personality.trim(), greeting || '¡Hola!', is_public !== false, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Personaje no encontrado.' });
    res.json({ character: rows[0] });
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
    const verifiedByVal = isVerified ? adminUserId : null;
    const { rows } = await query(
      `UPDATE users
       SET verified = $1::boolean,
           verified_at = CASE WHEN $1::boolean THEN now() ELSE NULL END,
           verified_by = $2::uuid
       WHERE id = $3::uuid RETURNING *`,
      [isVerified, verifiedByVal, targetUserId]
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

// ---- GESTIÓN DE PERSONAJES IA DESDE EL PANEL DE ADMINISTRACIÓN ----
router.get('/ai-characters', async (req, res) => {
  try {
    const { rows } = await query(`SELECT * FROM ai_characters ORDER BY created_at DESC`);
    res.json({ characters: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/ai-characters', async (req, res) => {
  try {
    const { id, name, avatar, personality, greeting, is_public } = req.body;
    if (!name || !personality) {
      return res.status(400).json({ error: 'Nombre y personalidad son requeridos.' });
    }

    if (id) {
      const { rows } = await query(
        `UPDATE ai_characters SET name=$1, avatar=$2, personality=$3, greeting=$4, is_public=$5 WHERE id=$6 RETURNING *`,
        [name.trim(), avatar || '🤖', personality.trim(), greeting || '¡Hola!', is_public !== false, id]
      );
      return res.json({ character: rows[0] });
    } else {
      const { rows } = await query(
        `INSERT INTO ai_characters (name, avatar, personality, greeting, is_public) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [name.trim(), avatar || '🤖', personality.trim(), greeting || '¡Hola!', is_public !== false]
      );
      return res.status(201).json({ character: rows[0] });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/ai-characters/:id', async (req, res) => {
  try {
    await query(`DELETE FROM ai_characters WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---- CONFIGURACIÓN DEL SISTEMA (AI Gemini) ----
router.get('/system-settings', async (req, res) => {
  try {
    const { rows } = await query(`SELECT key, value, updated_at FROM system_settings`);
    const settingsMap = {};
    rows.forEach(r => { settingsMap[r.key] = r.value; });
    settingsMap['gemini_model'] = (process.env.GEMINI_MODEL || '').trim();
    settingsMap['gemini_api_key_configured'] = !!(process.env.GEMINI_API_KEY || '').trim();
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

    const sensitiveKeys = [
      'gemini_api_key', 'gemini_key', 'cerebras_api_key', 'cerebras_key'
    ];

    const keys = Object.keys(settings);
    for (const key of keys) {
      if (sensitiveKeys.includes(key.toLowerCase())) {
        continue;
      }
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

// Comprobar la conexión con Google Gemini API
router.post('/test-ai', async (req, res) => {
  try {
    const { ai_personality } = req.body;
    const settings = await getAISettings();

    if (!process.env.GEMINI_API_KEY && !settings.gemini_api_key) {
      return res.status(400).json({ error: 'No se detectó la variable de entorno GEMINI_API_KEY en Render.' });
    }

    if (!process.env.GEMINI_MODEL && !settings.gemini_model) {
      return res.status(400).json({ error: 'No se detectó la variable de entorno GEMINI_MODEL en Render.' });
    }

    await query(`INSERT INTO system_settings (key, value, updated_at) VALUES ('ai_provider', 'gemini', now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`).catch(() => {});

    const testMessages = [
      { role: 'system', content: ai_personality || settings.ai_personality || 'Eres un asistente de pruebas.' },
      { role: 'user', content: 'Hola, prueba de conexión a la API.' }
    ];

    const result = await chatCompletion({
      messages: testMessages,
      maxTokens: 50,
      provider: 'gemini'
    });

    if (!result.available) {
      const errDetail = typeof result.error === 'object' ? (result.error?.message || JSON.stringify(result.error)) : result.error;
      return res.status(400).json({ error: result.reply || errDetail || 'Falló la prueba del proveedor Gemini.' });
    }

    res.json({
      success: true,
      message: `¡Prueba exitosa! El proveedor Gemini respondió correctamente.`,
      model: result.model_used,
      reply: result.reply,
      usage: result.usage || null
    });
  } catch (err) {
    console.error('Error probando proveedor de IA:', err);
    res.status(500).json({ error: `Error al conectar con Gemini: ${err.message}` });
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

      // Ordenar inserción para respetar claves foráneas (ej. 'users' primero)
      tableEntries.sort((a, b) => {
        const nameA = a.entryName;
        const nameB = b.entryName;
        if (nameA.includes('users')) return -1;
        if (nameB.includes('users')) return 1;
        return 0;
      });

      for (const entry of tableEntries) {
        const tableName = entry.entryName.replace('postgres_', '').replace('.json', '');
        if (!/^[a-zA-Z0-9_]+$/.test(tableName)) continue;

        let rows = [];
        try {
          rows = JSON.parse(entry.getData().toString('utf8'));
        } catch (e) {
          console.warn(`[Import error] Falló lectura de JSON para ${tableName}:`, e.message);
          continue;
        }

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

          await client.query('SAVEPOINT sp_row');
          try {
            await client.query(sql, values);
            await client.query('RELEASE SAVEPOINT sp_row');
          } catch (e) {
            await client.query('ROLLBACK TO SAVEPOINT sp_row');
            console.warn(`[Import warning] Tabla ${tableName}:`, e.message);
          }
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

// ---- MONETIZACIÓN Y GESTIÓN DE QVAPAY ----
router.get('/monetizacion/resumen', async (req, res) => {
  try {
    const [revRes, txRes, verifRes, adRes, activeAdsRes, unameRes] = await Promise.all([
      query(`SELECT COALESCE(SUM(amount), 0) AS total FROM payment_transactions WHERE status IN ('paid', 'completed')`),
      query(`SELECT service_type, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM payment_transactions GROUP BY service_type`),
      query(`SELECT COUNT(*) AS count FROM verification_requests WHERE status = 'pending_review'`),
      query(`SELECT COUNT(*) AS count FROM ad_campaigns WHERE status = 'pending_review'`),
      query(`SELECT COUNT(*) AS count FROM ad_campaigns WHERE status = 'active'`),
      query(`SELECT COUNT(*) AS count FROM username_purchases WHERE status = 'completed'`),
    ]);

    res.json({
      ingresos_totales: parseFloat(revRes.rows[0]?.total || 0),
      desglose_servicios: txRes.rows,
      verificaciones_pendientes: parseInt(verifRes.rows[0]?.count || 0),
      campanas_pendientes: parseInt(adRes.rows[0]?.count || 0),
      campanas_activas: parseInt(activeAdsRes.rows[0]?.count || 0),
      usernames_comprados: parseInt(unameRes.rows[0]?.count || 0),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/monetizacion/transacciones', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT pt.*, u.name AS usuario_nombre, u.email AS usuario_correo, u.username AS usuario_username
         FROM payment_transactions pt
         JOIN users u ON u.id = pt.user_id
        ORDER BY pt.created_at DESC LIMIT 100`
    );
    res.json({ transacciones: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/monetizacion/verificaciones', async (req, res) => {
  try {
    const estado = req.query.estado || 'pending_review';
    const { rows } = await query(
      `SELECT vr.*, u.name AS usuario_nombre, u.email AS usuario_correo, u.username AS usuario_username, u.avatar_data AS usuario_avatar,
              pt.status AS tx_status, pt.qvapay_trans_id, pt.qvapay_url
         FROM verification_requests vr
         JOIN users u ON u.id = vr.user_id
         LEFT JOIN payment_transactions pt ON pt.id = vr.transaction_id
        WHERE ($1 = 'todos' OR vr.status = $1)
        ORDER BY vr.created_at DESC LIMIT 100`,
      [estado]
    );
    res.json({ verificaciones: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/monetizacion/verificaciones/:id', async (req, res) => {
  try {
    const { accion, motivo_rechazo } = req.body;
    const reqId = req.params.id;
    const adminId = req.userId;

    const vRes = await query(`SELECT * FROM verification_requests WHERE id = $1`, [reqId]);
    if (!vRes.rows.length) {
      return res.status(404).json({ error: 'Solicitud de verificación no encontrada.' });
    }

    const vReq = vRes.rows[0];

    if (accion === 'aprobar') {
      const { rows } = await query(
        `UPDATE verification_requests
            SET status = 'approved', reviewed_by = $1, reviewed_at = now()
          WHERE id = $2 RETURNING *`,
        [adminId, reqId]
      );

      // Grant verification badge on user account
      await query(
        `UPDATE users
            SET verified = true, verified_at = now(), verified_by = $1::uuid
          WHERE id = $2`,
        [adminId, vReq.user_id]
      );

      return res.json({ ok: true, solicitud: rows[0] });
    } else if (accion === 'rechazar') {
      const { rows } = await query(
        `UPDATE verification_requests
            SET status = 'rejected', rejection_reason = $1, reviewed_by = $2, reviewed_at = now()
          WHERE id = $3 RETURNING *`,
        [(motivo_rechazo || '').trim() || 'No cumple con las políticas de verificación.', adminId, reqId]
      );

      return res.json({ ok: true, solicitud: rows[0] });
    } else {
      return res.status(400).json({ error: 'Acción no válida. Usa "aprobar" o "rechazar".' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/monetizacion/usernames', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT up.*, u.name AS usuario_nombre, u.email AS usuario_correo
         FROM username_purchases up
         JOIN users u ON u.id = up.user_id
        ORDER BY up.created_at DESC LIMIT 100`
    );
    res.json({ usernames: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/monetizacion/campanas', async (req, res) => {
  try {
    const estado = req.query.estado || 'todos';
    const { rows } = await query(
      `SELECT c.*, u.name AS usuario_nombre, u.email AS usuario_correo,
              ROUND((c.clicks_count::numeric / NULLIF(c.impressions_count, 0) * 100), 2) AS ctr
         FROM ad_campaigns c
         JOIN users u ON u.id = c.user_id
        WHERE ($1 = 'todos' OR c.status = $1)
        ORDER BY c.created_at DESC LIMIT 100`,
      [estado]
    );
    res.json({ campanas: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/monetizacion/campanas/:id', async (req, res) => {
  try {
    const { accion, motivo_rechazo } = req.body;
    const campaignId = req.params.id;
    const adminId = req.userId;

    const cRes = await query(`SELECT * FROM ad_campaigns WHERE id = $1`, [campaignId]);
    if (!cRes.rows.length) {
      return res.status(404).json({ error: 'Campaña no encontrada.' });
    }

    const campaign = cRes.rows[0];

    if (accion === 'aprobar') {
      const days = campaign.duration_days || 7;
      const { rows } = await query(
        `UPDATE ad_campaigns
            SET status = 'active',
                reviewed_by = $1,
                reviewed_at = now(),
                starts_at = now(),
                ends_at = now() + ($2 || ' days')::interval
          WHERE id = $3 RETURNING *`,
        [adminId, `${days}`, campaignId]
      );
      return res.json({ ok: true, campana: rows[0] });
    } else if (accion === 'rechazar') {
      const { rows } = await query(
        `UPDATE ad_campaigns
            SET status = 'rejected', rejection_reason = $1, reviewed_by = $2, reviewed_at = now()
          WHERE id = $3 RETURNING *`,
        [(motivo_rechazo || '').trim() || 'Campaña rechazada por el administrador.', adminId, campaignId]
      );
      return res.json({ ok: true, campana: rows[0] });
    } else if (accion === 'pausar') {
      const { rows } = await query(
        `UPDATE ad_campaigns SET status = 'paused', updated_at = now() WHERE id = $1 RETURNING *`,
        [campaignId]
      );
      return res.json({ ok: true, campana: rows[0] });
    } else if (accion === 'activar') {
      const { rows } = await query(
        `UPDATE ad_campaigns SET status = 'active', updated_at = now() WHERE id = $1 RETURNING *`,
        [campaignId]
      );
      return res.json({ ok: true, campana: rows[0] });
    } else {
      return res.status(400).json({ error: 'Acción no válida.' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/monetizacion/reembolsar/:id', async (req, res) => {
  try {
    const txId = req.params.id;
    const { rows } = await query(
      `UPDATE payment_transactions
          SET status = 'refunded', updated_at = now()
        WHERE id = $1 RETURNING *`,
      [txId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Transacción no encontrada.' });
    }

    res.json({ ok: true, transaccion: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---- GOOGLE SERVICES ENGINE ADMIN ROUTES ----
router.get('/google-services/status', async (req, res) => {
  try {
    const currentState = await stateManager.getState();
    const liveStatus = await registry.checkAllStatus();
    const sanitizedStatus = sanitizeObject(liveStatus);

    res.json({
      firebase: sanitizedStatus.firebase_auth?.status === 'CONNECTED' ? 'connected' : 'configuration_required',
      googleCloud: 'detected',
      gemini: sanitizedStatus.gemini?.status === 'CONFIGURED' ? 'configured' : 'not_configured',
      maps: sanitizedStatus.maps?.status === 'CONFIGURED' ? 'configured' : 'configuration_required',
      places: sanitizedStatus.maps?.status === 'CONFIGURED' ? 'configured' : 'configuration_required',
      vision: sanitizedStatus.vision?.status === 'CONFIGURED' ? 'configured' : (sanitizedStatus.vision?.status === 'BILLING_REQUIRED' ? 'billing_required' : 'not_configured'),
      translation: sanitizedStatus.translation?.status === 'CONFIGURED' ? 'configured' : (sanitizedStatus.translation?.status === 'BILLING_REQUIRED' ? 'billing_required' : 'not_configured'),
      speech: sanitizedStatus.speech?.status === 'CONFIGURED' ? 'configured' : (sanitizedStatus.speech?.status === 'BILLING_REQUIRED' ? 'billing_required' : 'not_configured'),
      environmental: sanitizedStatus.environmental?.status === 'CONFIGURED' ? 'configured' : (sanitizedStatus.environmental?.status === 'BILLING_REQUIRED' ? 'billing_required' : 'not_configured'),
      details: sanitizedStatus,
      bootstrap: {
        completed: currentState.completed,
        version: currentState.version,
        timestamp: currentState.timestamp
      }
    });
  } catch (err) {
    console.error('Error fetching google services status:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/google-services/configure', async (req, res) => {
  try {
    const result = await runGoogleServicesBootstrap({ force: true });
    res.json({
      ok: true,
      mensaje: 'Servicios de Google comprobados y reconfigurados correctamente sin cargos.',
      bootstrapResult: result
    });
  } catch (err) {
    console.error('Error re-configuring google services:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

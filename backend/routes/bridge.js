const express = require('express');
const crypto = require('crypto');
const { query } = require('../db/postgres');
const { requireAuth } = require('../middleware/auth');
const { isUUID } = require('../utils/validation');

const router = express.Router();

const ALLOWED_ACTION_TYPES = new Set([
  'NOTIFICATION',
  'MESSAGE',
  'CALL',
  'INCOMING_CALL',
  'PAYMENT',
  'SECURITY_CONFIRMATION',
  'OPEN_SCREEN',
  'NEW_CONNECTION',
  'SYSTEM_EVENT'
]);

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generatePairingCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

// Download Bridge APK (Redirect to admin configured URL or default release asset)
router.get('/download-apk', async (req, res) => {
  try {
    const { rows } = await query(`SELECT value FROM system_settings WHERE key = 'apk_download_url'`);
    const apkUrl = rows[0]?.value?.trim();
    if (apkUrl) {
      return res.redirect(302, apkUrl);
    }
    return res.status(404).json({ error: 'El administrador aún no ha configurado el enlace de descarga del APK.' });
  } catch (err) {
    console.error('[bridge download-apk]', err);
    res.status(500).json({ error: 'Error al procesar la descarga del APK.' });
  }
});

// Helper para crear acciones nativas desde cualquier módulo del backend
async function createBridgeActionForUser({ userId, actionType, payload, targetRoute, deviceId = null, expiresInMinutes = 15 }) {
  if (!userId || !actionType || !targetRoute) return null;
  if (!targetRoute.startsWith('/app/')) return null;

  const validActionType = ALLOWED_ACTION_TYPES.has(actionType) ? actionType : 'NOTIFICATION';
  const expiresAt = new Date(Date.now() + (Number(expiresInMinutes) || 15) * 60 * 1000);
  const nonce = crypto.randomBytes(16).toString('hex');
  const signature = crypto.createHmac('sha256', nonce).update(`${userId}:${targetRoute}:${validActionType}`).digest('hex');

  try {
    let targetDeviceId = deviceId;
    if (!targetDeviceId) {
      const devRes = await query(
        `SELECT id FROM bridge_devices WHERE user_id = $1 ORDER BY last_active_at DESC LIMIT 1`,
        [userId]
      );
      targetDeviceId = devRes.rows[0]?.id || null;
    }

    const { rows } = await query(
      `INSERT INTO bridge_actions (user_id, device_id, action_type, payload, target_route, status, signature, expires_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7)
       RETURNING id, action_type, payload, target_route, status, signature, expires_at, created_at`,
      [userId, targetDeviceId, validActionType, payload || {}, targetRoute, signature, expiresAt]
    );

    return rows[0] || null;
  } catch (err) {
    console.error('[bridge] Error creando acción para usuario:', err);
    return null;
  }
}

// Middleware para autenticar requests enviados directamente por el Bridge (vía Header x-bridge-token + x-bridge-device-id)
async function requireDeviceAuth(req, res, next) {
  const authHeader = req.headers['x-bridge-token'] || req.headers.authorization || '';
  const rawToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  const deviceId = req.headers['x-bridge-device-id'] || req.body?.device_id;

  if (!rawToken || !deviceId || !isUUID(deviceId)) {
    return res.status(401).json({ error: 'Credenciales de dispositivo Bridge no proporcionadas o inválidas.' });
  }

  const tokenHash = hashToken(rawToken);
  try {
    const { rows } = await query(
      `SELECT d.*, u.id AS user_id, u.banned FROM bridge_devices d JOIN users u ON u.id = d.user_id WHERE d.id = $1 AND d.device_token_hash = $2`,
      [deviceId, tokenHash]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Dispositivo Bridge no autorizado o desvinculado.' });
    }

    if (rows[0].banned) {
      return res.status(403).json({ error: 'La cuenta asociada al dispositivo se encuentra suspendida.' });
    }

    req.bridgeDevice = rows[0];
    req.userId = rows[0].user_id;

    // Actualizar última actividad
    query(`UPDATE bridge_devices SET last_active_at = now() WHERE id = $1`, [deviceId]).catch(() => {});

    next();
  } catch (err) {
    console.error('[bridgeAuth] Error:', err.message);
    res.status(500).json({ error: 'Error autenticando dispositivo.' });
  }
}

// ---------------------------------------------------------------------------
// 1. VINCULACIÓN / PAIRING FLOW
// ---------------------------------------------------------------------------

// Web user generates a temporary pairing code
router.post('/pairing/generate', requireAuth, async (req, res) => {
  const { device_name } = req.body;
  const code = generatePairingCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

  try {
    // Invalidate existing unused codes for user
    await query(`UPDATE bridge_pairing_codes SET used = true WHERE user_id = $1 AND used = false`, [req.userId]);

    const { rows } = await query(
      `INSERT INTO bridge_pairing_codes (user_id, pairing_code, device_name, expires_at)
       VALUES ($1, $2, $3, $4) RETURNING id, pairing_code, expires_at`,
      [req.userId, code, device_name || 'Android Device', expiresAt]
    );

    res.json({
      ok: true,
      pairing_code: rows[0].pairing_code,
      expires_at: rows[0].expires_at,
    });
  } catch (err) {
    console.error('[bridge] Error generando código:', err);
    res.status(500).json({ error: 'No se pudo generar código de vinculación.' });
  }
});

// Bridge claims code and registers device
router.post('/pairing/claim', async (req, res) => {
  const { pairing_code, device_name, bridge_version, capabilities } = req.body;

  if (!pairing_code || typeof pairing_code !== 'string') {
    return res.status(400).json({ error: 'Ingresa un código de vinculación válido.' });
  }

  const cleanCode = pairing_code.trim().toUpperCase();

  try {
    const { rows } = await query(
      `SELECT * FROM bridge_pairing_codes WHERE pairing_code = $1 AND used = false AND expires_at > now()`,
      [cleanCode]
    );

    if (!rows.length) {
      return res.status(400).json({ error: 'Código de vinculación inválido o expirado.' });
    }

    const pairing = rows[0];
    const rawDeviceToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawDeviceToken);

    // Marcar código como usado
    await query(`UPDATE bridge_pairing_codes SET used = true WHERE id = $1`, [pairing.id]);

    // Crear registro de dispositivo
    const devRes = await query(
      `INSERT INTO bridge_devices (user_id, device_name, device_token_hash, bridge_version, capabilities)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, user_id, device_name, bridge_version, created_at`,
      [pairing.user_id, device_name || pairing.device_name || 'Android Bridge', tokenHash, bridge_version || '1.0.0', capabilities || {}]
    );

    const device = devRes.rows[0];

    res.json({
      ok: true,
      device_id: device.id,
      device_token: rawDeviceToken,
      user_id: device.user_id,
      device_name: device.device_name,
    });
  } catch (err) {
    console.error('[bridge] Error reclamando código:', err);
    res.status(500).json({ error: 'Error durante la vinculación del dispositivo.' });
  }
});

// ---------------------------------------------------------------------------
// 2. DISPOSITIVOS & ESTADO DE CAPACIDADES
// ---------------------------------------------------------------------------

// List user devices (from Web)
router.get('/devices', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, device_name, bridge_version, capabilities, permissions, last_active_at, created_at
       FROM bridge_devices WHERE user_id = $1 ORDER BY last_active_at DESC`,
      [req.userId]
    );
    res.json({ ok: true, devices: rows });
  } catch (err) {
    res.status(500).json({ error: 'Error consultando dispositivos vinculados.' });
  }
});

// Unlink/Revoke device
router.delete('/devices/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (!isUUID(id)) return res.status(400).json({ error: 'ID de dispositivo inválido.' });

  try {
    await query(`DELETE FROM bridge_devices WHERE id = $1 AND user_id = $2`, [id, req.userId]);
    res.json({ ok: true, message: 'Dispositivo desvinculado correctamente.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al desvincular dispositivo.' });
  }
});

// Heartbeat and dynamic capabilities sync (from Bridge)
router.post('/device/heartbeat', requireDeviceAuth, async (req, res) => {
  const { bridge_version, capabilities, permissions } = req.body;

  try {
    const { rows } = await query(
      `UPDATE bridge_devices
          SET bridge_version = COALESCE($1, bridge_version),
              capabilities = COALESCE($2, capabilities),
              permissions = COALESCE($3, permissions),
              last_active_at = now()
        WHERE id = $4 RETURNING id, device_name, capabilities, permissions, bridge_version`,
      [bridge_version || null, capabilities ? JSON.stringify(capabilities) : null, permissions ? JSON.stringify(permissions) : null, req.bridgeDevice.id]
    );

    res.json({ ok: true, device: rows[0] });
  } catch (err) {
    console.error('[bridge] Error en heartbeat:', err);
    res.status(500).json({ error: 'Error actualizando estado del dispositivo.' });
  }
});

// ---------------------------------------------------------------------------
// 3. SISTEMA DE ACCIONES NATIVAS SEGURAS (PAYMENT, SECURITY, CALLS, NOTIFS)
// ---------------------------------------------------------------------------

// Create native action (Triggered by Web or Backend)
router.post('/actions/create', requireAuth, async (req, res) => {
  const { action_type, payload, target_route, device_id, expires_in_minutes } = req.body;

  if (!action_type || !target_route) {
    return res.status(400).json({ error: 'action_type y target_route son requeridos.' });
  }

  if (!target_route.startsWith('/app/')) {
    return res.status(400).json({ error: 'target_route debe ser una ruta interna válida (/app/...)' });
  }

  const action = await createBridgeActionForUser({
    userId: req.userId,
    actionType: action_type,
    payload,
    targetRoute: target_route,
    deviceId: device_id,
    expiresInMinutes: expires_in_minutes
  });

  if (!action) {
    return res.status(500).json({ error: 'Error creando la acción segura.' });
  }

  res.json({ ok: true, action });
});

// Fetch pending actions for device
router.get('/actions/pending', requireDeviceAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, action_type, payload, target_route, status, signature, expires_at, created_at
         FROM bridge_actions
        WHERE user_id = $1
          AND (device_id IS NULL OR device_id = $2)
          AND status = 'pending'
          AND expires_at > now()
        ORDER BY created_at ASC`,
      [req.userId, req.bridgeDevice.id]
    );

    res.json({ ok: true, pending_actions: rows });
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo acciones pendientes.' });
  }
});

// Verify action before execution (Device auth)
router.post('/actions/:id/verify', requireDeviceAuth, async (req, res) => {
  const { id } = req.params;
  if (!isUUID(id)) return res.status(400).json({ error: 'ID de acción inválido.' });

  try {
    const { rows } = await query(
      `SELECT * FROM bridge_actions WHERE id = $1 AND user_id = $2`,
      [id, req.userId]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, valid: false, reason: 'Acción no encontrada.' });
    }

    const action = rows[0];

    if (action.status !== 'pending') {
      return res.status(400).json({ ok: false, valid: false, reason: `La acción ya fue procesada (${action.status}).` });
    }

    if (new Date(action.expires_at) < new Date()) {
      await query(`UPDATE bridge_actions SET status = 'expired' WHERE id = $1`, [id]);
      return res.status(400).json({ ok: false, valid: false, reason: 'La acción ha expirado.' });
    }

    if (action.device_id && action.device_id !== req.bridgeDevice.id) {
      return res.status(403).json({ ok: false, valid: false, reason: 'La acción pertenece a otro dispositivo.' });
    }

    res.json({
      ok: true,
      valid: true,
      action: {
        id: action.id,
        action_type: action.action_type,
        payload: action.payload,
        target_route: action.target_route,
        expires_at: action.expires_at,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Error verificando la acción.' });
  }
});

// Complete single-use action (Device auth)
router.post('/actions/:id/complete', requireDeviceAuth, async (req, res) => {
  const { id } = req.params;
  const { status_result, result_payload } = req.body;
  if (!isUUID(id)) return res.status(400).json({ error: 'ID de acción inválido.' });

  try {
    const { rows } = await query(
      `UPDATE bridge_actions
          SET status = COALESCE($1, 'completed'),
              used_at = now(),
              payload = payload || $2::jsonb
        WHERE id = $3 AND user_id = $4 AND status = 'pending' AND expires_at > now()
        RETURNING id, action_type, target_route, status, used_at`,
      [status_result === 'failed' ? 'failed' : 'completed', JSON.stringify(result_payload || {}), id, req.userId]
    );

    if (!rows.length) {
      return res.status(400).json({ error: 'No se pudo completar la acción. Puede haber expirado o sido utilizada previa o paralelamente.' });
    }

    res.json({ ok: true, action: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al finalizar la acción.' });
  }
});

module.exports = router;
module.exports.createBridgeActionForUser = createBridgeActionForUser;

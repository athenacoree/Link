const express = require('express');
const { query, pool } = require('../db/postgres');
const { requireAuth } = require('../middleware/auth');
const qvapayService = require('../services/qvapayService');

const router = express.Router();

const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'root', 'enlace', 'system', 'support', 'api', 'null',
  'undefined', 'mod', 'moderator', 'help', 'info', 'official', 'public', 'link',
  'qvapay', 'bot', 'owner', 'staff', 'contacto', 'mensajes', 'feed', 'ailab'
]);

/**
 * Atomic helper function to process a confirmed payment and deliver the requested benefit.
 * Enforces strict idempotency so benefits are never delivered twice.
 */
async function processConfirmedPayment(remoteId, rawPayload = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock payment_transaction row
    const txRes = await client.query(
      `SELECT * FROM payment_transactions WHERE remote_id = $1 FOR UPDATE`,
      [remoteId]
    );

    if (!txRes.rows.length) {
      await client.query('ROLLBACK');
      console.warn(`[Monetización] Transacción no encontrada para remote_id: ${remoteId}`);
      return { success: false, message: 'Transacción no encontrada.' };
    }

    const tx = txRes.rows[0];

    // Idempotency check: If already processed, return immediately without re-granting benefits
    if (tx.status === 'paid' || tx.status === 'completed') {
      await client.query('COMMIT');
      return { success: true, alreadyProcessed: true, transaction: tx };
    }

    const transId = rawPayload.trans_id || rawPayload.id || tx.qvapay_trans_id;

    // Mark payment transaction as paid
    const updatedTxRes = await client.query(
      `UPDATE payment_transactions
          SET status = 'paid', paid_at = now(), qvapay_trans_id = COALESCE($1, qvapay_trans_id), updated_at = now()
        WHERE id = $2 RETURNING *`,
      [transId, tx.id]
    );

    // Update QvaPay invoice record
    await client.query(
      `UPDATE qvapay_invoices
          SET status = 'paid', qvapay_id = COALESCE($1, qvapay_id), raw_payload = COALESCE($2::jsonb, raw_payload), updated_at = now()
        WHERE transaction_id = $3`,
      [transId, JSON.stringify(rawPayload), tx.id]
    );

    // Process specific benefit according to service type
    if (tx.service_type === 'verification') {
      await client.query(
        `UPDATE verification_requests
            SET status = 'pending_review', updated_at = now()
          WHERE transaction_id = $1`,
        [tx.id]
      );
    } else if (tx.service_type === 'username') {
      const unameRes = await client.query(
        `SELECT * FROM username_purchases WHERE transaction_id = $1 FOR UPDATE`,
        [tx.id]
      );

      if (unameRes.rows.length) {
        const purchase = unameRes.rows[0];
        const newUsername = purchase.requested_username;

        // Check availability in users table
        const userCheck = await client.query(
          `SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id <> $2`,
          [newUsername, tx.user_id]
        );

        if (!userCheck.rows.length) {
          await client.query(
            `UPDATE users SET username = $1, updated_at = now() WHERE id = $2`,
            [newUsername, tx.user_id]
          );
          await client.query(
            `UPDATE username_purchases SET status = 'completed', updated_at = now() WHERE id = $3`,
            [purchase.id]
          );
        } else {
          console.warn(`[Monetización] Username @${newUsername} ya fue tomado por otro usuario.`);
          await client.query(
            `UPDATE username_purchases SET status = 'failed', updated_at = now() WHERE id = $1`,
            [purchase.id]
          );
        }
      }
    } else if (tx.service_type === 'ad_campaign') {
      await client.query(
        `UPDATE ad_campaigns
            SET status = 'pending_review', updated_at = now()
          WHERE transaction_id = $1`,
        [tx.id]
      );
    }

    await client.query('COMMIT');
    console.log(`[Monetización] Pago confirmado y procesado con éxito para remote_id: ${remoteId}`);
    return { success: true, transaction: updatedTxRes.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[Monetización] Error procesando pago para ${remoteId}:`, err);
    throw err;
  } finally {
    client.release();
  }
}

async function getPriceSetting(key, defaultVal) {
  try {
    const { rows } = await query(`SELECT value FROM system_settings WHERE key = $1`, [key]);
    if (rows.length && rows[0].value) {
      const parsed = parseFloat(rows[0].value);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch (e) {}
  return defaultVal;
}

router.get('/precios', requireAuth, async (req, res) => {
  try {
    const verifPrice = await getPriceSetting('price_verification', 5.00);
    const unamePrice = await getPriceSetting('price_username', 10.00);
    res.json({ price_verification: verifPrice, price_username: unamePrice });
  } catch (e) {
    res.json({ price_verification: 5.00, price_username: 10.00 });
  }
});

// ============================================================
//  1. VERIFICACIÓN PAGADA DE PERFIL
// ============================================================

router.post('/verificacion/solicitar', requireAuth, async (req, res) => {
  const userId = req.userId;
  const VERIFICATION_PRICE = await getPriceSetting('price_verification', 5.00);

  // Check if user already has an active verification or pending request
  const existingReq = await query(
    `SELECT * FROM verification_requests
      WHERE user_id = $1 AND status IN ('pending_payment', 'pending_review', 'approved')
      ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );

  if (existingReq.rows.length) {
    const cur = existingReq.rows[0];
    if (cur.status === 'approved') {
      return res.status(400).json({ error: 'Tu perfil ya cuenta con la insignia de verificado.' });
    }
    if (cur.status === 'pending_review') {
      return res.status(400).json({ error: 'Ya tienes una solicitud de verificación abonada y en revisión por el administrador.' });
    }
  }

  const remoteId = `verif_${userId.substring(0, 8)}_${Date.now()}`;

  // Create payment transaction
  const txRes = await query(
    `INSERT INTO payment_transactions (user_id, service_type, amount, status, remote_id, metadata)
     VALUES ($1, 'verification', $2, 'pending_payment', $3, $4) RETURNING *`,
    [userId, VERIFICATION_PRICE, remoteId, JSON.stringify({ action: 'verification_request' })]
  );
  const tx = txRes.rows[0];

  // Create QvaPay invoice
  const qvInvoice = await qvapayService.createInvoice({
    amount: VERIFICATION_PRICE,
    description: 'Solicitud de Revisión para Verificación de Perfil',
    remoteId,
  });

  // Update transaction with QvaPay info
  await query(
    `UPDATE payment_transactions SET qvapay_trans_id = $1, qvapay_url = $2 WHERE id = $3`,
    [qvInvoice.id, qvInvoice.url, tx.id]
  );

  // Record QvaPay invoice
  await query(
    `INSERT INTO qvapay_invoices (transaction_id, qvapay_id, remote_id, amount, status)
     VALUES ($1, $2, $3, $4, 'pending')`,
    [tx.id, qvInvoice.id, remoteId, VERIFICATION_PRICE]
  );

  // Record verification request
  const verifRes = await query(
    `INSERT INTO verification_requests (user_id, transaction_id, amount, status)
     VALUES ($1, $2, $3, 'pending_payment') RETURNING *`,
    [userId, tx.id, VERIFICATION_PRICE]
  );

  res.json({
    ok: true,
    solicitud: verifRes.rows[0],
    transaccion: { ...tx, qvapay_trans_id: qvInvoice.id, qvapay_url: qvInvoice.url },
    checkout_url: qvInvoice.url,
  });
});

router.get('/verificacion/mi-solicitud', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT vr.*, pt.qvapay_url, pt.status AS tx_status
       FROM verification_requests vr
       LEFT JOIN payment_transactions pt ON pt.id = vr.transaction_id
      WHERE vr.user_id = $1
      ORDER BY vr.created_at DESC LIMIT 1`,
    [req.userId]
  );
  res.json({ solicitud: rows[0] || null });
});

// ============================================================
//  2. USERNAMES CORTOS (< 4 caracteres)
// ============================================================

router.post('/username/comprobar', requireAuth, async (req, res) => {
  const rawName = (req.body.username || '').trim().toLowerCase().replace(/^@/, '');

  if (!rawName || rawName.length < 1 || rawName.length >= 4) {
    return res.status(400).json({
      disponible: false,
      error: 'El username corto debe tener entre 1 y 3 caracteres.',
    });
  }

  if (!/^[a-z0-9_]+$/.test(rawName)) {
    return res.status(400).json({
      disponible: false,
      error: 'El username solo puede contener letras, números y guiones bajos.',
    });
  }

  if (RESERVED_USERNAMES.has(rawName)) {
    return res.status(400).json({
      disponible: false,
      error: 'Este nombre de usuario está reservado por el sistema.',
    });
  }

  // Check if taken in users
  const userCheck = await query(
    `SELECT id FROM users WHERE LOWER(username) = $1`,
    [rawName]
  );
  if (userCheck.rows.length) {
    return res.json({ disponible: false, username: rawName, razon: 'Ya pertenece a otro usuario.' });
  }

  // Check active pending purchases
  const purchaseCheck = await query(
    `SELECT id FROM username_purchases
      WHERE LOWER(requested_username) = $1 AND status IN ('pending_payment', 'completed')`,
    [rawName]
  );

  if (purchaseCheck.rows.length) {
    return res.json({ disponible: false, username: rawName, razon: 'Está siendo reservado o ya fue comprado.' });
  }

  res.json({ disponible: true, username: rawName });
});

router.post('/username/comprar', requireAuth, async (req, res) => {
  const userId = req.userId;
  const rawName = (req.body.username || '').trim().toLowerCase().replace(/^@/, '');
  const USERNAME_PRICE = await getPriceSetting('price_username', 10.00);

  if (!rawName || rawName.length < 1 || rawName.length >= 4 || !/^[a-z0-9_]+$/.test(rawName)) {
    return res.status(400).json({ error: 'Username no válido. Debe tener entre 1 y 3 caracteres alfanuméricos.' });
  }

  if (RESERVED_USERNAMES.has(rawName)) {
    return res.status(400).json({ error: 'Este nombre de usuario está reservado.' });
  }

  // Check availability
  const userCheck = await query(`SELECT id FROM users WHERE LOWER(username) = $1`, [rawName]);
  if (userCheck.rows.length) {
    return res.status(400).json({ error: `El username @${rawName} ya está ocupado.` });
  }

  const purchaseCheck = await query(
    `SELECT id FROM username_purchases WHERE LOWER(requested_username) = $1 AND status IN ('pending_payment', 'completed')`,
    [rawName]
  );
  if (purchaseCheck.rows.length) {
    return res.status(400).json({ error: `El username @${rawName} ya tiene un proceso de compra activo.` });
  }

  const remoteId = `uname_${rawName}_${Date.now()}`;

  // Create payment transaction
  const txRes = await query(
    `INSERT INTO payment_transactions (user_id, service_type, amount, status, remote_id, metadata)
     VALUES ($1, 'username', $2, 'pending_payment', $3, $4) RETURNING *`,
    [userId, USERNAME_PRICE, remoteId, JSON.stringify({ requested_username: rawName })]
  );
  const tx = txRes.rows[0];

  // Create QvaPay invoice
  const qvInvoice = await qvapayService.createInvoice({
    amount: USERNAME_PRICE,
    description: `Compra de Username Corto @${rawName}`,
    remoteId,
  });

  await query(
    `UPDATE payment_transactions SET qvapay_trans_id = $1, qvapay_url = $2 WHERE id = $3`,
    [qvInvoice.id, qvInvoice.url, tx.id]
  );

  await query(
    `INSERT INTO qvapay_invoices (transaction_id, qvapay_id, remote_id, amount, status)
     VALUES ($1, $2, $3, $4, 'pending')`,
    [tx.id, qvInvoice.id, remoteId, USERNAME_PRICE]
  );

  const unameRes = await query(
    `INSERT INTO username_purchases (user_id, transaction_id, requested_username, amount, status)
     VALUES ($1, $2, $3, $4, 'pending_payment') RETURNING *`,
    [userId, tx.id, rawName, USERNAME_PRICE]
  );

  res.json({
    ok: true,
    compra: unameRes.rows[0],
    transaccion: { ...tx, qvapay_trans_id: qvInvoice.id, qvapay_url: qvInvoice.url },
    checkout_url: qvInvoice.url,
  });
});

// ============================================================
//  3. PUBLICIDAD INTERACTIVA / CAMPAÑAS
// ============================================================

router.post('/campanas', requireAuth, async (req, res) => {
  const userId = req.userId;
  const { title, description, button_text, destination_url, image_url, target_audience, budget, duration_days } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'El título de la campaña es obligatorio.' });
  }

  if (!destination_url || !destination_url.trim()) {
    return res.status(400).json({ error: 'La URL de destino es obligatoria.' });
  }

  const numBudget = parseFloat(budget);
  if (isNaN(numBudget) || numBudget < 2.00) {
    return res.status(400).json({ error: 'El presupuesto mínimo para una campaña es de $2.00 USD.' });
  }

  const numDays = Math.max(1, parseInt(duration_days) || 7);
  const approxImpressions = Math.round(numBudget * 500); // 500 impresiones por dólar

  const remoteId = `ad_${userId.substring(0, 8)}_${Date.now()}`;

  // Create payment transaction
  const txRes = await query(
    `INSERT INTO payment_transactions (user_id, service_type, amount, status, remote_id, metadata)
     VALUES ($1, 'ad_campaign', $2, 'pending_payment', $3, $4) RETURNING *`,
    [userId, numBudget, remoteId, JSON.stringify({ title: title.trim(), duration_days: numDays })]
  );
  const tx = txRes.rows[0];

  // Create QvaPay invoice
  const qvInvoice = await qvapayService.createInvoice({
    amount: numBudget,
    description: `Campaña Publicitaria: ${title.trim().slice(0, 30)}`,
    remoteId,
  });

  await query(
    `UPDATE payment_transactions SET qvapay_trans_id = $1, qvapay_url = $2 WHERE id = $3`,
    [qvInvoice.id, qvInvoice.url, tx.id]
  );

  await query(
    `INSERT INTO qvapay_invoices (transaction_id, qvapay_id, remote_id, amount, status)
     VALUES ($1, $2, $3, $4, 'pending')`,
    [tx.id, qvInvoice.id, remoteId, numBudget]
  );

  const campaignRes = await query(
    `INSERT INTO ad_campaigns (
        user_id, transaction_id, title, description, button_text, destination_url, image_url,
        target_audience, budget, approx_impressions, duration_days, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending_payment') RETURNING *`,
    [
      userId,
      tx.id,
      title.trim(),
      (description || '').trim(),
      (button_text || 'Ver más').trim(),
      destination_url.trim(),
      (image_url || '').trim(),
      JSON.stringify(target_audience || {}),
      numBudget,
      approxImpressions,
      numDays,
    ]
  );

  res.json({
    ok: true,
    campana: campaignRes.rows[0],
    transaccion: { ...tx, qvapay_trans_id: qvInvoice.id, qvapay_url: qvInvoice.url },
    checkout_url: qvInvoice.url,
  });
});

router.get('/campanas/mis-campanas', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT c.*,
        ROUND((c.clicks_count::numeric / NULLIF(c.impressions_count, 0) * 100), 2) AS ctr
       FROM ad_campaigns c
      WHERE c.user_id = $1
      ORDER BY c.created_at DESC`,
    [req.userId]
  );
  res.json({ campanas: rows });
});

router.get('/campanas/:id', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT c.*,
        ROUND((c.clicks_count::numeric / NULLIF(c.impressions_count, 0) * 100), 2) AS ctr
       FROM ad_campaigns c
      WHERE c.id = $1 AND (c.user_id = $2 OR EXISTS (SELECT 1 FROM users WHERE id = $2 AND is_admin = true))`,
    [req.params.id, req.userId]
  );

  if (!rows.length) {
    return res.status(404).json({ error: 'Campaña no encontrada.' });
  }

  const metricsRes = await query(
    `SELECT event_type, COUNT(*) as total
       FROM ad_metrics WHERE campaign_id = $1 GROUP BY event_type`,
    [req.params.id]
  );

  res.json({ campana: rows[0], metricas: metricsRes.rows });
});

router.put('/campanas/:id/estado', requireAuth, async (req, res) => {
  const { status } = req.body;

  if (!['active', 'paused'].includes(status)) {
    return res.status(400).json({ error: 'Estado inválido. Solo se permite pausar o reanudar.' });
  }

  const { rows } = await query(
    `UPDATE ad_campaigns
        SET status = $1, updated_at = now()
      WHERE id = $2 AND user_id = $3 AND status IN ('active', 'paused') RETURNING *`,
    [status, req.params.id, req.userId]
  );

  if (!rows.length) {
    return res.status(404).json({ error: 'Campaña no encontrada o no está activa/pausada.' });
  }

  res.json({ campana: rows[0] });
});

// Anuncio activo para el feed
router.get('/anuncios/activo', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT id, title, description, button_text, destination_url, image_url, budget, spent
       FROM ad_campaigns
      WHERE status = 'active'
        AND spent < budget
        AND (ends_at IS NULL OR ends_at > now())
      ORDER BY RANDOM() LIMIT 1`
  );

  res.json({ anuncio: rows[0] || null });
});

router.post('/anuncios/:id/metrica', requireAuth, async (req, res) => {
  const campaignId = req.params.id;
  const eventType = (req.body.event_type || 'impression').toLowerCase();

  if (!['impression', 'click', 'interaction'].includes(eventType)) {
    return res.status(400).json({ error: 'Tipo de métrica no válido.' });
  }

  const campRes = await query(`SELECT * FROM ad_campaigns WHERE id = $1`, [campaignId]);
  if (!campRes.rows.length) {
    return res.status(404).json({ error: 'Campaña no encontrada.' });
  }

  const campaign = campRes.rows[0];

  // Record metric
  await query(
    `INSERT INTO ad_metrics (campaign_id, user_id, event_type) VALUES ($1, $2, $3)`,
    [campaignId, req.userId, eventType]
  );

  if (eventType === 'impression') {
    const costPerImpression = (parseFloat(campaign.budget) / Math.max(1, campaign.approx_impressions));
    const newSpent = Math.min(parseFloat(campaign.budget), parseFloat(campaign.spent) + costPerImpression);
    const newImpressions = campaign.impressions_count + 1;
    const isCompleted = newSpent >= parseFloat(campaign.budget) || newImpressions >= campaign.approx_impressions;

    await query(
      `UPDATE ad_campaigns
          SET impressions_count = impressions_count + 1,
              spent = $1,
              status = CASE WHEN $2 THEN 'completed' ELSE status END,
              updated_at = now()
        WHERE id = $3`,
      [newSpent, isCompleted, campaignId]
    );
  } else if (eventType === 'click') {
    await query(`UPDATE ad_campaigns SET clicks_count = clicks_count + 1, updated_at = now() WHERE id = $1`, [campaignId]);
  } else if (eventType === 'interaction') {
    await query(`UPDATE ad_campaigns SET interactions_count = interactions_count + 1, updated_at = now() WHERE id = $1`, [campaignId]);
  }

  res.json({ ok: true });
});

// ============================================================
//  4. TRANSACCIONES DEL USUARIO
// ============================================================

router.get('/transacciones', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM payment_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [req.userId]
  );
  res.json({ transacciones: rows });
});

router.get('/transacciones/:id/verificar', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM payment_transactions WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.userId]
  );

  if (!rows.length) {
    return res.status(404).json({ error: 'Transacción no encontrada.' });
  }

  const tx = rows[0];

  if (tx.status === 'paid' || tx.status === 'completed') {
    return res.json({ ok: true, transaccion: tx, pagado: true });
  }

  // Poll QvaPay API
  if (tx.qvapay_trans_id) {
    const statusData = await qvapayService.getTransactionStatus(tx.qvapay_trans_id);
    if (statusData && statusData.paid) {
      const result = await processConfirmedPayment(tx.remote_id, statusData.raw || statusData);
      return res.json({ ok: true, transaccion: result.transaction, pagado: true });
    }
  }

  res.json({ ok: true, transaccion: tx, pagado: false });
});

// ============================================================
//  5. WEBHOOK DE QVAPAY
// ============================================================

router.all('/webhook/qvapay', async (req, res) => {
  try {
    const payload = await qvapayService.verifyWebhookPayload(req);

    if (!payload || !payload.remote_id) {
      return res.status(400).json({ error: 'Webhook payload inválido.' });
    }

    if (payload.paid) {
      await processConfirmedPayment(payload.remote_id, payload.raw || payload);
    }

    res.json({ received: true, remote_id: payload.remote_id, status: payload.status });
  } catch (err) {
    console.error('[QvaPay Webhook Error]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

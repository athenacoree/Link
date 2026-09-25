/**
 * Centralized QvaPay Payment Service
 *
 * Exclusively uses process.env.QVAPAY_APP_ID, process.env.QVAPAY_APP_SECRET, and process.env.QVAPAY_WEBHOOK_URL.
 * Handles invoice creation, transaction status lookup, and strict webhook verification.
 */

function getBaseUrl() {
  const url = (process.env.QVAPAY_BASE_URL || 'https://qvapay.com/api/v2').trim();
  return url.replace(/\/+$/, '');
}

function getAppId() {
  return (process.env.QVAPAY_APP_ID || '').trim();
}

function getAppSecret() {
  return (process.env.QVAPAY_APP_SECRET || '').trim();
}

function getWebhookUrl() {
  return (process.env.QVAPAY_WEBHOOK_URL || '').trim();
}

function isConfigured() {
  return Boolean(getAppId() && getAppSecret());
}

/**
 * Creates a QvaPay invoice via POST /v2/create_invoice.
 * Sends credentials via app-id and app-secret headers.
 * @param {Object} params
 * @param {number|string} params.amount Amount in USD (e.g., 5.00)
 * @param {string} params.description Invoice description
 * @param {string} params.remoteId Unique identifier in Enlace
 * @returns {Promise<Object>} Created invoice details including QvaPay URL and ID
 */
async function createInvoice({ amount, description, remoteId }) {
  const appId = getAppId();
  const appSecret = getAppSecret();

  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    const err = new Error('Monto de factura no válido.');
    err.httpStatus = 400;
    err.code = 'INVALID_AMOUNT';
    throw err;
  }

  if (!remoteId) {
    const err = new Error('Identificador remoto (remoteId) requerido.');
    err.httpStatus = 400;
    err.code = 'MISSING_REMOTE_ID';
    throw err;
  }

  if (!appId || !appSecret) {
    console.warn('[QvaPay] Credenciales de QvaPay no configuradas en el entorno (QVAPAY_APP_ID / QVAPAY_APP_SECRET).');
    const err = new Error('Credenciales de QvaPay no configuradas en el servidor.');
    err.httpStatus = 500;
    err.code = 'CONFIG_ERROR';
    err.remoteId = remoteId;
    throw err;
  }

  const baseUrl = getBaseUrl();
  const webhookUrl = getWebhookUrl();

  const payload = {
    amount: numAmount.toFixed(2),
    description: (description || 'Servicio de Enlace').slice(0, 100),
    remote_id: remoteId,
  };
  if (webhookUrl) {
    payload.webhook = webhookUrl;
  }

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  console.log(`[QvaPay] Intentando crear factura: remote_id=${remoteId}, amount=$${payload.amount}`);

  try {
    const response = await fetch(`${baseUrl}/create_invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'app-id': appId,
        'app-secret': appSecret,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const elapsed = Date.now() - startTime;

    let data;
    try {
      data = await response.json();
    } catch (parseErr) {
      console.error(`[QvaPay] Respuesta no-JSON recibida (${response.status}) en ${elapsed}ms`);
      const err = new Error(`QvaPay devolvió una respuesta no válida (HTTP ${response.status}).`);
      err.httpStatus = response.status;
      err.code = 'INVALID_RESPONSE';
      err.remoteId = remoteId;
      throw err;
    }

    if (!response.ok || data.error) {
      const errDetail = typeof data.error === 'object'
        ? (data.error.message || JSON.stringify(data.error))
        : (data.error || data.message || `Error de QvaPay API (${response.status})`);

      console.error(`[QvaPay] Error de API (${response.status}) en ${elapsed}ms: ${errDetail} | remote_id=${remoteId}`);

      const err = new Error(errDetail);
      err.httpStatus = response.status;
      err.code = data.code || `HTTP_${response.status}`;
      err.remoteId = remoteId;
      err.transactionUuid = data.transaction_uuid || data.trans_id || data.id || null;
      err.qvapayStatus = data.status || null;
      err.raw = data;
      throw err;
    }

    const transId = data.trans_id || data.id || data.transaction_uuid;
    const payUrl = data.url || data.signedUrl;

    if (!payUrl) {
      console.error(`[QvaPay] La respuesta de QvaPay no incluyó una URL real de pago. remote_id=${remoteId}`);
      const err = new Error('QvaPay no proporcionó una URL válida de pago.');
      err.httpStatus = 502;
      err.code = 'NO_PAYMENT_URL';
      err.remoteId = remoteId;
      err.transactionUuid = transId;
      throw err;
    }

    console.log(`[QvaPay] Factura creada exitosamente en ${elapsed}ms: trans_id=${transId}, url=${payUrl}, remote_id=${remoteId}`);

    return {
      id: transId,
      trans_id: transId,
      transaction_uuid: transId,
      url: payUrl,
      amount: numAmount.toFixed(2),
      remote_id: remoteId,
      status: data.status || 'pending',
      raw: data,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.error(`[QvaPay] Timeout de 15s agotado al crear factura. remote_id=${remoteId}`);
      const timeoutErr = new Error('Tiempo de espera agotado al conectar con QvaPay.');
      timeoutErr.httpStatus = 504;
      timeoutErr.code = 'TIMEOUT';
      timeoutErr.remoteId = remoteId;
      throw timeoutErr;
    }
    if (!err.httpStatus) {
      err.httpStatus = 500;
      err.code = 'NETWORK_ERROR';
      err.remoteId = remoteId;
    }
    throw err;
  }
}

/**
 * Gets transaction status directly from QvaPay API.
 * Uses GET /v2/get_transaction/:id with header-based credentials.
 * @param {string} transactionId QvaPay Transaction ID/UUID
 * @returns {Promise<Object>} Transaction status and details
 */
async function getTransactionStatus(transactionId) {
  const appId = getAppId();
  const appSecret = getAppSecret();

  if (!transactionId) {
    const err = new Error('ID de transacción requerido.');
    err.httpStatus = 400;
    err.code = 'MISSING_TRANSACTION_ID';
    throw err;
  }

  if (!appId || !appSecret) {
    return {
      id: transactionId,
      trans_id: transactionId,
      status: 'unknown',
      paid: false,
      error: 'Credenciales de QvaPay no configuradas.',
    };
  }

  const baseUrl = getBaseUrl();
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${baseUrl}/get_transaction/${encodeURIComponent(transactionId)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'app-id': appId,
        'app-secret': appSecret,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const elapsed = Date.now() - startTime;

    let data;
    try {
      data = await response.json();
    } catch (parseErr) {
      return {
        id: transactionId,
        trans_id: transactionId,
        status: 'unknown',
        paid: false,
        error: `Respuesta no válida de QvaPay (HTTP ${response.status})`,
      };
    }

    if (!response.ok || data.error) {
      const errDetail = typeof data.error === 'object'
        ? (data.error.message || JSON.stringify(data.error))
        : (data.error || data.message || `Error HTTP ${response.status}`);

      console.warn(`[QvaPay] Estado de transacción ${transactionId} falló (${response.status}) en ${elapsed}ms: ${errDetail}`);

      return {
        id: transactionId,
        trans_id: transactionId,
        status: 'unknown',
        paid: false,
        error: errDetail,
      };
    }

    const rawStatus = (data.status || '').toLowerCase();
    const isPaid = rawStatus === 'paid' || rawStatus === 'completed' || data.paid === 1 || data.paid === '1' || data.paid === true;

    return {
      id: data.id || data.trans_id || transactionId,
      trans_id: data.trans_id || data.id || transactionId,
      amount: data.amount !== undefined ? parseFloat(data.amount) : undefined,
      remote_id: data.remote_id,
      status: isPaid ? 'paid' : (rawStatus || 'pending'),
      paid: isPaid,
      raw: data,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';
    console.error(`[QvaPay] Error al consultar estado de transacción ${transactionId}: ${err.message}`);
    return {
      id: transactionId,
      trans_id: transactionId,
      status: 'unknown',
      paid: false,
      error: isTimeout ? 'Tiempo de espera agotado.' : err.message,
    };
  }
}

/**
 * Validates incoming QvaPay webhook payload.
 * NEVER marks a transaction as paid based solely on webhook body parameters.
 * Mandatorily verifies transaction status with QvaPay API servers.
 * @param {Object} req Express request object
 * @returns {Promise<Object>} Verified transaction payload
 */
async function verifyWebhookPayload(req) {
  const body = req.body || {};
  const query = req.query || {};

  const remoteId = body.remote_id || query.remote_id;
  const transId = body.id || body.trans_id || body.transaction_uuid || query.id || query.trans_id;
  const rawAmount = body.amount !== undefined ? body.amount : query.amount;

  if (!remoteId) {
    throw new Error('Webhook de QvaPay rechazado: Falta remote_id.');
  }

  if (!transId) {
    throw new Error('Webhook de QvaPay rechazado: ID de transacción ausente.');
  }

  if (!isConfigured()) {
    throw new Error('Webhook de QvaPay rechazado: Credenciales de QvaPay no configuradas.');
  }

  const qvData = await getTransactionStatus(transId);

  if (!qvData || !qvData.paid) {
    console.warn(`[QvaPay Webhook] Verificación API rechazada para trans_id=${transId}, estado en QvaPay: ${qvData?.status}`);
    return {
      valid: false,
      paid: false,
      remote_id: remoteId,
      trans_id: transId,
      amount: qvData?.amount || rawAmount,
      status: qvData?.status || 'unverified',
      raw: body,
    };
  }

  return {
    valid: true,
    paid: true,
    remote_id: qvData.remote_id || remoteId,
    trans_id: qvData.trans_id || transId,
    amount: qvData.amount !== undefined ? qvData.amount : rawAmount,
    status: 'paid',
    raw: qvData.raw || body,
  };
}

module.exports = {
  isConfigured,
  createInvoice,
  getTransactionStatus,
  verifyWebhookPayload,
};

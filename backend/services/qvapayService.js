/**
 * Centralized QvaPay Payment Service (V2 API)
 *
 * Exclusively uses process.env.QVAPAY_APP_ID, process.env.QVAPAY_APP_SECRET, and process.env.QVAPAY_WEBHOOK_URL.
 * All HTTP calls to QvaPay V2 send credentials in `app-id` and `app-secret` headers and operational data in JSON body.
 */

function getBaseUrl() {
  const url = (process.env.QVAPAY_BASE_URL || 'https://api.qvapay.com/v2').trim();
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
 * Executes a sanitized HTTP request against QvaPay API V2.
 * Headers `app-id` and `app-secret` are automatically injected.
 * Credentials are NEVER placed in query parameters or request body.
 */
async function qvapayRequest(endpoint, { method = 'GET', body = null } = {}) {
  const appId = getAppId();
  const appSecret = getAppSecret();

  if (!appId || !appSecret) {
    const err = new Error('Credenciales de QvaPay no configuradas en el servidor (QVAPAY_APP_ID / QVAPAY_APP_SECRET).');
    err.httpStatus = 500;
    err.code = 'CONFIG_ERROR';
    throw err;
  }

  const baseUrl = getBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${cleanEndpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'app-id': appId,
    'app-secret': appSecret,
  };

  const fetchOptions = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  fetchOptions.signal = controller.signal;

  const startTime = Date.now();

  try {
    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);
    const elapsed = Date.now() - startTime;

    let data;
    try {
      data = await response.json();
    } catch (parseErr) {
      console.error(`[QvaPay] Respuesta no-JSON recibida (${response.status}) en ${elapsed}ms desde ${cleanEndpoint}`);
      const err = new Error(`QvaPay devolvió una respuesta no válida (HTTP ${response.status}).`);
      err.httpStatus = response.status;
      err.code = 'INVALID_RESPONSE';
      throw err;
    }

    if (!response.ok || (data && data.error)) {
      let errDetail = 'Error en la petición a QvaPay API';
      if (data && data.error) {
        errDetail = typeof data.error === 'object'
          ? (data.error.message || JSON.stringify(data.error))
          : String(data.error);
      } else if (data && data.message) {
        errDetail = String(data.message);
      } else {
        errDetail = `Error de QvaPay API (HTTP ${response.status})`;
      }

      console.error(`[QvaPay] Error de API (${response.status}) en ${elapsed}ms en ${cleanEndpoint}: ${errDetail}`);

      const err = new Error(errDetail);
      err.httpStatus = response.status;
      err.code = data?.code || `HTTP_${response.status}`;
      err.raw = data;
      throw err;
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.error(`[QvaPay] Timeout de 15s agotado en ${cleanEndpoint}`);
      const timeoutErr = new Error('Tiempo de espera agotado al conectar con QvaPay API.');
      timeoutErr.httpStatus = 504;
      timeoutErr.code = 'TIMEOUT';
      throw timeoutErr;
    }

    if (!err.httpStatus) {
      err.httpStatus = 500;
      err.code = 'NETWORK_ERROR';
    }

    // Ensure appSecret is NEVER leaked in the error message
    const secret = getAppSecret();
    if (secret && err.message && err.message.includes(secret)) {
      err.message = err.message.replace(new RegExp(secret, 'g'), '[REDACTED]');
    }

    throw err;
  }
}

/**
 * Gets info about current QvaPay app / account.
 * GET /v2/info
 */
async function getInfo() {
  return qvapayRequest('/info', { method: 'GET' });
}

/**
 * Gets account balance details.
 * GET /v2/balance
 */
async function getBalance() {
  return qvapayRequest('/balance', { method: 'GET' });
}

/**
 * Gets transactions list.
 * GET /v2/transactions
 */
async function getTransactions(params = {}) {
  let endpoint = '/transactions';
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.append('page', params.page);
  if (params.page_size) queryParams.append('page_size', params.page_size);
  const qStr = queryParams.toString();
  if (qStr) endpoint += `?${qStr}`;

  return qvapayRequest(endpoint, { method: 'GET' });
}

/**
 * Creates a QvaPay invoice via POST /v2/create_invoice.
 * @param {Object} params
 * @param {number|string} params.amount Amount in USD (e.g. 5.00)
 * @param {string} params.description Invoice description
 * @param {string} params.remoteId Unique remote identifier
 * @param {string} [params.webhook] Custom webhook URL
 * @param {Object} [params.customData] Additional payload
 */
async function createInvoice({ amount, description, remoteId, webhook, customData }) {
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    const err = new Error('Monto de factura no válido.');
    err.httpStatus = 400;
    err.code = 'INVALID_AMOUNT';
    throw err;
  }

  if (!remoteId || !String(remoteId).trim()) {
    const err = new Error('Identificador remoto (remoteId) requerido.');
    err.httpStatus = 400;
    err.code = 'MISSING_REMOTE_ID';
    throw err;
  }

  const webhookUrl = webhook || getWebhookUrl();

  const payload = {
    amount: numAmount.toFixed(2),
    description: (description || 'Servicio de Enlace').slice(0, 100),
    remote_id: String(remoteId).trim(),
  };

  if (webhookUrl) {
    payload.webhook = webhookUrl;
  }

  if (customData) {
    payload.custom_data = customData;
  }

  console.log(`[QvaPay] Intentando crear factura: remote_id=${payload.remote_id}, amount=$${payload.amount}`);

  try {
    const data = await qvapayRequest('/create_invoice', {
      method: 'POST',
      body: payload,
    });

    const transId = data.trans_id || data.id || data.transaction_uuid;
    const payUrl = data.url || data.signedUrl;

    if (!payUrl) {
      console.error(`[QvaPay] La respuesta de QvaPay no incluyó una URL real de pago. remote_id=${payload.remote_id}`);
      const err = new Error('QvaPay no proporcionó una URL válida de pago.');
      err.httpStatus = 502;
      err.code = 'NO_PAYMENT_URL';
      err.remoteId = payload.remote_id;
      err.transactionUuid = transId;
      throw err;
    }

    console.log(`[QvaPay] Factura creada exitosamente: trans_id=${transId}, url=${payUrl}, remote_id=${payload.remote_id}`);

    return {
      id: transId,
      trans_id: transId,
      transaction_uuid: transId,
      url: payUrl,
      amount: numAmount.toFixed(2),
      remote_id: payload.remote_id,
      status: data.status || 'pending',
      raw: data,
    };
  } catch (err) {
    err.remoteId = payload.remote_id;
    throw err;
  }
}

/**
 * Modifies an existing invoice via POST /v2/modify_invoice.
 * @param {Object} params
 * @param {string} params.id Invoice ID or transaction UUID
 * @param {number|string} [params.amount] New amount
 * @param {string} [params.description] New description
 * @param {string} [params.remoteId] New remote ID
 */
async function modifyInvoice({ id, amount, description, remoteId }) {
  if (!id) {
    const err = new Error('ID de factura requerido para modificar.');
    err.httpStatus = 400;
    err.code = 'MISSING_INVOICE_ID';
    throw err;
  }

  const payload = { id };
  if (amount !== undefined) payload.amount = parseFloat(amount).toFixed(2);
  if (description) payload.description = description.slice(0, 100);
  if (remoteId) payload.remote_id = String(remoteId).trim();

  return qvapayRequest('/modify_invoice', {
    method: 'POST',
    body: payload,
  });
}

/**
 * Direct charge / payment authorization via POST /v2/charge.
 * @param {Object} params
 * @param {number|string} params.amount Amount to charge
 * @param {string} params.description Charge description
 * @param {string} [params.userId] Target QvaPay user ID or email
 * @param {string} [params.remoteId] Remote identifier
 */
async function charge({ amount, description, userId, remoteId }) {
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    const err = new Error('Monto de cobro no válido.');
    err.httpStatus = 400;
    err.code = 'INVALID_AMOUNT';
    throw err;
  }

  const payload = {
    amount: numAmount.toFixed(2),
    description: (description || 'Cobro directo QvaPay').slice(0, 100),
  };

  if (userId) payload.user_id = userId;
  if (remoteId) payload.remote_id = remoteId;

  return qvapayRequest('/charge', {
    method: 'POST',
    body: payload,
  });
}

/**
 * Gets transaction status directly from QvaPay API V2.
 * GET /v2/get_transaction/:id
 * @param {string} transactionId QvaPay Transaction ID/UUID
 */
async function getTransactionStatus(transactionId) {
  if (!transactionId) {
    const err = new Error('ID de transacción requerido.');
    err.httpStatus = 400;
    err.code = 'MISSING_TRANSACTION_ID';
    throw err;
  }

  if (!isConfigured()) {
    return {
      id: transactionId,
      trans_id: transactionId,
      status: 'unknown',
      paid: false,
      error: 'Credenciales de QvaPay no configuradas.',
    };
  }

  try {
    const data = await qvapayRequest(`/get_transaction/${encodeURIComponent(transactionId)}`, {
      method: 'GET',
    });

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
    console.error(`[QvaPay] Error al consultar estado de transacción ${transactionId}: ${err.message}`);
    return {
      id: transactionId,
      trans_id: transactionId,
      status: 'unknown',
      paid: false,
      error: err.httpStatus === 504 ? 'Tiempo de espera agotado.' : err.message,
    };
  }
}

/**
 * Validates incoming QvaPay webhook payload.
 * NEVER marks a transaction as paid based solely on webhook body parameters.
 * Mandatorily verifies transaction status with QvaPay API servers.
 * @param {Object} req Express request object
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
  qvapayRequest,
  getInfo,
  getBalance,
  getTransactions,
  createInvoice,
  modifyInvoice,
  charge,
  getTransactionStatus,
  verifyWebhookPayload,
};

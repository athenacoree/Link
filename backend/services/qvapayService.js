/**
 * Centralized QvaPay Payment Service
 *
 * Exclusively uses process.env.QVAPAY_APP_ID, process.env.QVAPAY_APP_SECRET, and process.env.QVAPAY_WEBHOOK_URL.
 * Handles invoice creation, transaction status lookup, and webhook verification.
 */

const QVAPAY_BASE_URL = 'https://qvapay.com/api/v1';

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
 * Creates a QvaPay invoice.
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
    throw new Error('Monto de factura no válido.');
  }

  if (!remoteId) {
    throw new Error('Identificador remoto (remoteId) requerido.');
  }

  // If QvaPay credentials are not configured (e.g., in local dev without env vars), generate a simulated checkout URL
  if (!appId || !appSecret) {
    console.warn('[QvaPay] Credenciales de QvaPay no configuradas en entorno. Generando factura de simulación.');
    const mockTransId = `qvapay_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      id: mockTransId,
      trans_id: mockTransId,
      url: `https://qvapay.com/pay/${mockTransId}?simulated=1&remote_id=${encodeURIComponent(remoteId)}`,
      amount: numAmount.toFixed(2),
      remote_id: remoteId,
      status: 'pending',
      simulated: true,
    };
  }

  const queryParams = new URLSearchParams({
    app_id: appId,
    app_secret: appSecret,
    amount: numAmount.toFixed(2),
    description: (description || 'Servicio de Enlace').slice(0, 100),
    remote_id: remoteId,
    signed: '1',
  });

  const webhookUrl = getWebhookUrl();
  if (webhookUrl) {
    queryParams.append('webhook', webhookUrl);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${QVAPAY_BASE_URL}/create_invoice?${queryParams.toString()}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || data.message || `Error de QvaPay API (${response.status})`);
    }

    const transId = data.trans_id || data.id || data.transaction_uuid || `qv_${Date.now()}`;
    const payUrl = data.url || data.signedUrl || `https://qvapay.com/pay/${transId}`;

    return {
      id: transId,
      trans_id: transId,
      url: payUrl,
      amount: numAmount.toFixed(2),
      remote_id: remoteId,
      status: data.status || 'pending',
      simulated: false,
      raw: data,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Tiempo de espera agotado al conectar con QvaPay.');
    }
    console.error('[QvaPay] Error al crear factura:', err.message);
    throw new Error(`Error al conectar con QvaPay: ${err.message}`);
  }
}

/**
 * Gets status of a transaction directly from QvaPay API.
 * @param {string} transactionId QvaPay Transaction ID/UUID
 * @returns {Promise<Object>} Transaction status and details
 */
async function getTransactionStatus(transactionId) {
  const appId = getAppId();
  const appSecret = getAppSecret();

  if (!transactionId) {
    throw new Error('ID de transacción requerido.');
  }

  if (!appId || !appSecret || transactionId.startsWith('qvapay_sim_')) {
    return {
      id: transactionId,
      status: 'pending',
      paid: false,
      simulated: true,
    };
  }

  const queryParams = new URLSearchParams({
    app_id: appId,
    app_secret: appSecret,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${QVAPAY_BASE_URL}/get_transaction/${transactionId}?${queryParams.toString()}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok || data.error) {
      return {
        id: transactionId,
        status: 'unknown',
        error: data.error || data.message || 'Error al obtener estado',
      };
    }

    const rawStatus = (data.status || '').toLowerCase();
    const isPaid = rawStatus === 'paid' || rawStatus === 'completed' || data.paid === 1 || data.paid === '1';

    return {
      id: data.id || transactionId,
      trans_id: data.trans_id || data.id || transactionId,
      amount: data.amount,
      remote_id: data.remote_id,
      status: isPaid ? 'paid' : (rawStatus || 'pending'),
      paid: isPaid,
      raw: data,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('[QvaPay] Error al consultar estado de transacción:', err.message);
    return {
      id: transactionId,
      status: 'unknown',
      error: err.message,
    };
  }
}

/**
 * Validates incoming QvaPay webhook payload.
 * @param {Object} req Express request object or webhook body
 * @returns {Promise<Object>} Standardized transaction payload if valid
 */
async function verifyWebhookPayload(req) {
  const body = req.body || {};
  const query = req.query || {};

  const remoteId = body.remote_id || query.remote_id;
  const transId = body.id || body.trans_id || query.id || query.trans_id;
  const statusStr = (body.status || query.status || '').toLowerCase();
  const paidVal = body.paid !== undefined ? body.paid : query.paid;

  if (!remoteId) {
    throw new Error('Webhook inválido: Falta remote_id.');
  }

  const isPaidSignal = statusStr === 'paid' || statusStr === 'completed' || paidVal === 1 || paidVal === '1' || paidVal === true;

  // Double check transaction status with QvaPay backend API if credentials exist and transId present
  if (isConfigured() && transId && !transId.startsWith('qvapay_sim_')) {
    try {
      const qvData = await getTransactionStatus(transId);
      if (qvData && qvData.paid) {
        return {
          valid: true,
          remote_id: remoteId,
          trans_id: transId,
          amount: qvData.amount || body.amount,
          status: 'paid',
          paid: true,
          raw: body,
        };
      }
    } catch (e) {
      console.warn('[QvaPay Webhook] Falló verificación secundaria API:', e.message);
    }
  }

  return {
    valid: isPaidSignal,
    remote_id: remoteId,
    trans_id: transId,
    amount: body.amount || query.amount,
    status: isPaidSignal ? 'paid' : (statusStr || 'pending'),
    paid: isPaidSignal,
    raw: body,
  };
}

module.exports = {
  isConfigured,
  createInvoice,
  getTransactionStatus,
  verifyWebhookPayload,
};

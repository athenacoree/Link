const { query } = require('../db/postgres');

function getConfig() {
  const baseUrl = (process.env.IMAGE_EDITOR_BASE_URL || '').replace(/\/+$/, '');
  const apiKey = process.env.IMAGE_EDITOR_API_KEY || '';

  if (!baseUrl || !apiKey) {
    const err = new Error('El servicio externo de edición de fotos no está configurado (IMAGE_EDITOR_BASE_URL / IMAGE_EDITOR_API_KEY).');
    err.code = 'CONFIG_MISSING';
    throw err;
  }
  return { baseUrl, apiKey };
}

async function safeQuery(sql, params) {
  try {
    return await query(sql, params);
  } catch (err) {
    console.warn('[imageEditorService] Advertencia Postgres:', err.message);
    return { rows: [] };
  }
}

async function makeApiRequest(url, options = {}) {
  const controller = new AbortController();
  const timeoutMs = parseInt(process.env.IMAGE_EDITOR_TIMEOUT_MS || '30000', 10);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': options.apiKey,
        ...(options.headers || {}),
      },
    });

    clearTimeout(timeout);

    let data;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { rawText: text };
    }

    if (!response.ok) {
      const errorMsg = data.error || data.message || `Error HTTP ${response.status} del editor de imágenes.`;
      const err = new Error(errorMsg);
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      const timeoutErr = new Error('Tiempo de espera agotado al comunicarse con el servicio de edición de imágenes.');
      timeoutErr.status = 504;
      throw timeoutErr;
    }
    throw err;
  }
}

async function createJob({ userId, prompt, imageBase64, metadata = {}, upscale = false, upscaleFactor = '2x', provider = 'auto' }) {
  const { baseUrl, apiKey } = getConfig();

  const payload = {
    prompt: prompt || '',
    provider: provider || 'auto',
    user_id: String(userId),
    image_base64: imageBase64,
    metadata: metadata || {},
    upscale: Boolean(upscale),
    upscale_factor: upscaleFactor || '2x',
  };

  const responseData = await makeApiRequest(`${baseUrl}/api/jobs`, {
    method: 'POST',
    apiKey,
    body: JSON.stringify(payload),
  });

  const requestId = responseData.requestId || responseData.request_id || responseData.id;
  if (!requestId) {
    throw new Error('El servicio de edición de imágenes no devolvió un requestId válido.');
  }

  const initialStatus = responseData.status || 'queued';

  const sql = `
    INSERT INTO image_editor_jobs (request_id, user_id, prompt, status, metadata)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (request_id) DO UPDATE SET
      status = EXCLUDED.status,
      updated_at = now()
    RETURNING *;
  `;

  const { rows } = await safeQuery(sql, [requestId, userId, prompt, initialStatus, JSON.stringify(metadata)]);
  return rows[0] || {
    request_id: requestId,
    user_id: userId,
    prompt,
    status: initialStatus,
    metadata,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function getJobStatus(requestId, userId = null) {
  const { baseUrl, apiKey } = getConfig();

  // Buscar en DB local
  let jobRow = null;
  if (userId) {
    const { rows } = await safeQuery('SELECT * FROM image_editor_jobs WHERE request_id = $1 AND user_id = $2', [requestId, userId]);
    jobRow = rows[0];
  } else {
    const { rows } = await safeQuery('SELECT * FROM image_editor_jobs WHERE request_id = $1', [requestId]);
    jobRow = rows[0];
  }

  // Consultar estado en API externa
  let responseData;
  try {
    responseData = await makeApiRequest(`${baseUrl}/api/jobs/${encodeURIComponent(requestId)}`, {
      method: 'GET',
      apiKey,
    });
  } catch (err) {
    if (jobRow) {
      return jobRow;
    }
    throw err;
  }

  const currentStatus = responseData.status || jobRow?.status || 'processing';
  const errorMessage = responseData.error || responseData.error_message || null;

  const sql = `
    UPDATE image_editor_jobs
    SET status = $1,
        error_message = COALESCE($2, error_message),
        updated_at = now()
    WHERE request_id = $3
    RETURNING *;
  `;

  const { rows } = await safeQuery(sql, [currentStatus, errorMessage, requestId]);
  return rows[0] || jobRow || { request_id: requestId, status: currentStatus, error_message: errorMessage };
}

async function getJobResult(requestId, userId = null) {
  const { baseUrl, apiKey } = getConfig();

  let jobRow = null;
  if (userId) {
    const { rows } = await safeQuery('SELECT * FROM image_editor_jobs WHERE request_id = $1 AND user_id = $2', [requestId, userId]);
    jobRow = rows[0];
  } else {
    const { rows } = await safeQuery('SELECT * FROM image_editor_jobs WHERE request_id = $1', [requestId]);
    jobRow = rows[0];
  }

  const responseData = await makeApiRequest(`${baseUrl}/api/jobs/${encodeURIComponent(requestId)}/result`, {
    method: 'GET',
    apiKey,
  });

  let resultDataStr = '';
  if (typeof responseData === 'object') {
    resultDataStr = JSON.stringify(responseData);
  } else {
    resultDataStr = String(responseData);
  }

  const sql = `
    UPDATE image_editor_jobs
    SET status = 'completed',
        result_data = $1,
        updated_at = now()
    WHERE request_id = $2
    RETURNING *;
  `;

  const { rows } = await safeQuery(sql, [resultDataStr, requestId]);
  return rows[0] || { ...jobRow, request_id: requestId, status: 'completed', result_data: resultDataStr };
}

async function getUserJobs(userId, limit = 20) {
  const { rows } = await safeQuery(
    'SELECT * FROM image_editor_jobs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, limit]
  );
  return rows;
}

module.exports = {
  getConfig,
  createJob,
  getJobStatus,
  getJobResult,
  getUserJobs,
};

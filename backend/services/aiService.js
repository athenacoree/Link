const { query } = require('../db/postgres');

/**
 * Centralized AI System Service for Enlace.
 * Exclusively uses Google Gemini API.
 * Supports Real Timeout (AbortController), Response Truncation Continuation,
 * Context Budgeting, Vision Input, and Structured Tool Definitions.
 */

async function getAISettings() {
  const config = {
    ai_provider: 'gemini',
    gemini_api_key: (process.env.GEMINI_API_KEY || '').trim(),
    gemini_model: (process.env.GEMINI_MODEL || '').trim(),
    ai_temperature: process.env.AI_TEMPERATURE || '0.7',
    ai_name: process.env.AI_NAME || 'Link AI',
    ai_avatar: process.env.AI_AVATAR || '',
    ai_personality: process.env.AI_PERSONALITY || 'Eres Link AI, un asistente inteligente integrado en la plataforma social Link. Responde siempre en español, con amabilidad y precisión. REGLA DE LONGITUD: Responde siempre con mensajes normales y cortos por defecto (estilo chat conversacional breve). Entrega respuestas más largas y detalladas únicamente cuando el usuario te solicite explícitamente explicaciones profundas. EMOCIONES DE MENSAJE: Puedes incluir discretamente al inicio de tu respuesta uno de los siguientes tags de emoción según tu estado de ánimo o el tono de la respuesta: [EMOTION: happy], [EMOTION: angry], [EMOTION: love], [EMOTION: excited], [EMOTION: sad], [EMOTION: neutral], [EMOTION: cool]. Ejemplo: "[EMOTION: happy] ¡Hola! Me alegra mucho hablar contigo."',
    ai_max_tokens: process.env.AI_MAX_TOKENS || '1000',
    ai_context_tokens: process.env.AI_CONTEXT_TOKENS || '4000',
    ailab_max_msg_length: process.env.AILAB_MAX_MSG_LENGTH || '2000',
    ailab_max_personality_length: process.env.AILAB_MAX_PERSONALITY_LENGTH || '1000',
    ailab_max_image_size_mb: process.env.AILAB_MAX_IMAGE_SIZE_MB || '5',
    ailab_max_history: process.env.AILAB_MAX_HISTORY || '10',
    ailab_timeout_ms: process.env.AI_TIMEOUT_MS || process.env.AILAB_TIMEOUT_MS || '120000',
    ailab_auto_interval_min: process.env.AILAB_AUTO_INTERVAL_MIN || '20',
    ai_max_continuations: process.env.AI_MAX_CONTINUATIONS || '2',
    ai_max_tool_steps: process.env.AI_MAX_TOOL_STEPS || '5',
  };

  try {
    const { rows } = await query(
      `SELECT key, value FROM system_settings WHERE key IN (
        'ai_provider',
        'ai_name', 'ai_avatar', 'ai_personality', 'ai_temperature',
        'ai_max_tokens', 'ai_context_tokens',
        'ailab_max_msg_length', 'ailab_max_personality_length',
        'ailab_max_image_size_mb', 'ailab_max_history', 'ailab_timeout_ms', 'ailab_auto_interval_min',
        'ai_max_continuations', 'ai_max_tool_steps'
      )`
    );
    rows.forEach(r => {
      if (r.value !== undefined && r.value !== null && r.value !== '') {
        config[r.key] = r.value;
      }
    });
  } catch (err) {
    // If system_settings cannot be queried, fall back to defaults
  }

  // Las claves y límites principales provienen directamente de process.env en Render
  if (process.env.AI_MAX_TOKENS) config.ai_max_tokens = process.env.AI_MAX_TOKENS;
  if (process.env.AI_CONTEXT_TOKENS) config.ai_context_tokens = process.env.AI_CONTEXT_TOKENS;
  if (process.env.AI_TEMPERATURE) config.ai_temperature = process.env.AI_TEMPERATURE;
  if (process.env.AILAB_AUTO_INTERVAL_MIN) config.ailab_auto_interval_min = process.env.AILAB_AUTO_INTERVAL_MIN;

  // Garantizar que GEMINI_API_KEY y GEMINI_MODEL provienen estrictamente de process.env en Render sin fallbacks hardcodeados
  config.gemini_api_key = (process.env.GEMINI_API_KEY || config.gemini_api_key || '').trim();
  config.gemini_model = (process.env.GEMINI_MODEL || config.gemini_model || '').trim();

  // Garantizar un timeout mínimo seguro (mínimo 10.000 ms, por defecto 120.000 ms)
  const envTimeout = process.env.AI_TIMEOUT_MS || process.env.AILAB_TIMEOUT_MS;
  const parsedTimeout = parseInt(envTimeout || config.ailab_timeout_ms || '120000', 10);
  config.ailab_timeout_ms = String(!isNaN(parsedTimeout) && parsedTimeout >= 10000 ? parsedTimeout : 120000);

  return config;
}

/**
 * Prunes and budgets message context safely without cutting system prompts or duplicating messages.
 */
function pruneMessages(messages, maxContextTokens = 4000) {
  if (!Array.isArray(messages) || messages.length === 0) return [];

  const maxChars = Math.max(1000, maxContextTokens * 4);
  let systemMsg = null;
  const nonSystemMsgs = [];

  for (const msg of messages) {
    if (!msg) continue;
    if (msg.role === 'system' && !systemMsg) {
      systemMsg = msg;
    } else if (msg.role !== 'system') {
      nonSystemMsgs.push(msg);
    }
  }

  let totalChars = systemMsg ? JSON.stringify(systemMsg.content).length : 0;
  const pruned = [];

  for (let i = nonSystemMsgs.length - 1; i >= 0; i--) {
    const msg = nonSystemMsgs[i];
    const msgLen = typeof msg.content === 'string'
      ? msg.content.length
      : JSON.stringify(msg.content).length;

    if (totalChars + msgLen > maxChars && pruned.length > 0) {
      break;
    }
    totalChars += msgLen;
    pruned.unshift(msg);
  }

  if (systemMsg) {
    pruned.unshift(systemMsg);
  }

  return pruned;
}

/**
 * Invoker for Google Gemini REST API Endpoints
 */
async function callGeminiApi({ apiKey, model, messages, maxTokens, temperature, visionImage, signal }) {
  if (!model) {
    return {
      ok: false,
      status: 400,
      error: {
        code: 'NO_MODEL',
        message: 'No se ha configurado el modelo Gemini (GEMINI_MODEL) en Render.',
        retryable: false,
      }
    };
  }

  if (!apiKey) {
    return {
      ok: false,
      status: 401,
      error: {
        code: 'NO_API_KEY',
        message: 'No se ha configurado la API Key de Gemini (GEMINI_API_KEY) en Render.',
        retryable: false,
      }
    };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let systemInstruction = null;
  const geminiContents = [];

  for (const m of messages) {
    if (!m) continue;
    if (m.role === 'system') {
      systemInstruction = {
        parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
      };
    } else {
      const role = m.role === 'assistant' ? 'model' : 'user';
      const parts = [];
      if (typeof m.content === 'string') {
        parts.push({ text: m.content });
      } else if (Array.isArray(m.content)) {
        for (const part of m.content) {
          if (part.type === 'text') parts.push({ text: part.text });
          else if (part.type === 'image_url' && part.image_url?.url) {
            const imgUrl = part.image_url.url;
            if (imgUrl.startsWith('data:')) {
              const [header, base64] = imgUrl.split(';base64,');
              const mimeType = header.replace('data:', '') || 'image/jpeg';
              parts.push({ inlineData: { mimeType, data: base64 } });
            }
          }
        }
      } else {
        parts.push({ text: JSON.stringify(m.content) });
      }
      geminiContents.push({ role, parts });
    }
  }

  if (visionImage) {
    let mimeType = 'image/jpeg';
    let base64Data = visionImage;
    if (visionImage.startsWith('data:')) {
      const parts = visionImage.split(';base64,');
      mimeType = parts[0].replace('data:', '') || 'image/jpeg';
      base64Data = parts[1] || '';
    }

    const lastUserMsg = geminiContents.slice().reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      lastUserMsg.parts.push({ inlineData: { mimeType, data: base64Data } });
    } else {
      geminiContents.push({
        role: 'user',
        parts: [
          { text: 'Describe esta imagen' },
          { inlineData: { mimeType, data: base64Data } }
        ]
      });
    }
  }

  if (geminiContents.length === 0) {
    geminiContents.push({ role: 'user', parts: [{ text: 'Hola' }] });
  }

  const generationConfig = {
    maxOutputTokens: maxTokens,
  };

  const parsedTemp = parseFloat(temperature);
  if (!isNaN(parsedTemp) && parsedTemp >= 0.0 && parsedTemp <= 2.0) {
    generationConfig.temperature = parsedTemp;
  }

  const payload = {
    contents: geminiContents,
    generationConfig,
  };

  if (systemInstruction) {
    payload.systemInstruction = systemInstruction;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text();
    let errDetail = errText;
    let errCode = `HTTP_${response.status}`;

    try {
      const parsed = JSON.parse(errText);
      if (parsed.error && parsed.error.message) {
        errDetail = parsed.error.message;
      }
      if (parsed.error && parsed.error.code) {
        errCode = String(parsed.error.code);
      }
    } catch (e) {}

    let friendlyMessage = errDetail;
    if (response.status === 401 || response.status === 403 || errDetail.toLowerCase().includes('api_key') || errDetail.toLowerCase().includes('invalid')) {
      errCode = 'AUTH_ERROR';
      friendlyMessage = 'Error de autenticación con Gemini. Verifica que GEMINI_API_KEY esté configurada correctamente en Render.';
    } else if (response.status === 404 || errDetail.toLowerCase().includes('not found')) {
      errCode = 'MODEL_NOT_FOUND';
      friendlyMessage = `El modelo Gemini especificado '${model}' no existe o no está disponible en la API (404). Verifica GEMINI_MODEL en Render.`;
    } else if (response.status === 429 || errDetail.toLowerCase().includes('quota') || errDetail.toLowerCase().includes('rate')) {
      errCode = 'RATE_LIMIT';
      friendlyMessage = 'Se ha alcanzado el límite de velocidad o cuota (Rate limit / Quota) en Gemini. Por favor, reintenta en unos momentos.';
    } else if (response.status === 400) {
      errCode = 'BAD_REQUEST';
      friendlyMessage = `Solicitud rechazada por Gemini (400): ${errDetail}`;
    } else if (response.status >= 500) {
      errCode = 'SERVER_ERROR';
      friendlyMessage = `El servidor de Gemini experimentó un error interno (${response.status}).`;
    }

    return {
      ok: false,
      status: response.status,
      error: {
        code: errCode,
        message: friendlyMessage,
        raw_detail: errDetail,
        retryable: response.status === 429 || response.status >= 500,
      }
    };
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];

  if (!candidate && data.promptFeedback?.blockReason) {
    return {
      ok: false,
      status: 400,
      error: {
        code: 'BLOCKED',
        message: `El mensaje fue bloqueado por Gemini: ${data.promptFeedback.blockReason}`,
        retryable: false,
      }
    };
  }

  const replyParts = candidate?.content?.parts || [];
  const reply = replyParts.map(p => p.text || '').join('');
  const finishReason = candidate?.finishReason === 'MAX_TOKENS' ? 'length' : (candidate?.finishReason || 'stop');

  return {
    ok: true,
    reply,
    finish_reason: finishReason,
    model_used: model,
    usage: data.usageMetadata || null,
  };
}

/**
 * Provider Adapters Registry - Exclusively Gemini
 */
const ProviderAdapters = {
  gemini: async ({ settings, messages, maxTokens, modelOverride, visionImage, signal, temperature }) => {
    const apiKey = (settings.gemini_api_key || process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      return { ok: false, error: { code: 'NO_API_KEY', message: 'Gemini API Key no configurada en las variables de entorno (GEMINI_API_KEY en Render).', retryable: false } };
    }
    const model = (modelOverride || settings.gemini_model || process.env.GEMINI_MODEL || '').trim();
    if (!model) {
      return { ok: false, error: { code: 'NO_MODEL', message: 'Modelo Gemini no configurado en las variables de entorno (GEMINI_MODEL en Render). Debe definirse en las variables de entorno.', retryable: false } };
    }
    return callGeminiApi({
      apiKey,
      model,
      messages,
      maxTokens,
      temperature: temperature !== undefined && temperature !== null ? temperature : settings.ai_temperature,
      visionImage,
      signal,
    });
  }
};

/**
 * Main AI Chat Completion method using exclusively Google Gemini.
 */
async function chatCompletion({
  messages = [],
  systemPrompt = null,
  maxTokens = null,
  model = null,
  provider = null,
  temperature = null,
  visionImage = null,
  timeoutMs = null,
  signal = null,
} = {}) {
  const settings = await getAISettings();

  const effectiveMaxTokens = Math.max(50, Math.min(16000, parseInt(maxTokens || settings.ai_max_tokens || '1000', 10)));
  const effectiveContextTokens = parseInt(settings.ai_context_tokens || '4000', 10);
  const effectiveTimeout = Math.max(10000, parseInt(timeoutMs || settings.ailab_timeout_ms || '120000', 10));
  const maxContinuations = Math.min(3, Math.max(0, parseInt(settings.ai_max_continuations || '2', 10)));

  let formattedMessages = Array.isArray(messages) ? [...messages] : [];

  if (systemPrompt && !formattedMessages.some(m => m && m.role === 'system')) {
    formattedMessages.unshift({ role: 'system', content: systemPrompt });
  } else if (!formattedMessages.some(m => m && m.role === 'system')) {
    formattedMessages.unshift({ role: 'system', content: settings.ai_personality });
  }

  formattedMessages = pruneMessages(formattedMessages, effectiveContextTokens);

  const selectedModel = (model || settings.gemini_model || process.env.GEMINI_MODEL || '').trim();

  let lastError = null;
  let successfulResult = null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), effectiveTimeout);

  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const res = await ProviderAdapters.gemini({
      settings,
      messages: formattedMessages,
      maxTokens: effectiveMaxTokens,
      modelOverride: selectedModel,
      temperature,
      visionImage,
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (res.ok) {
      successfulResult = { ...res, provider: 'gemini' };
    } else {
      lastError = res.error;
      console.warn(`[AI Service] Gemini provider failed: ${res.error?.message || 'Error desconocido'}`);
    }
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err.name === 'AbortError';
    lastError = {
      code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      message: isTimeout ? `El proveedor Gemini superó el tiempo de espera (${effectiveTimeout}ms).` : err.message,
      retryable: true,
    };
    console.warn(`[AI Service] Exception on Gemini: ${lastError.message}`);
  }

  if (!successfulResult) {
    let friendlyMsg = '⚠️ Estoy teniendo problemas técnicos para comunicarme con la IA.';
    if (lastError?.code === 'NO_API_KEY') {
      friendlyMsg = '⚠️ Error de configuración: La clave GEMINI_API_KEY no está configurada en las variables de entorno de Render.';
    } else if (lastError?.code === 'NO_MODEL') {
      friendlyMsg = '⚠️ Error de configuración: La variable GEMINI_MODEL no está configurada en Render.';
    } else if (lastError?.code === 'AUTH_ERROR' || lastError?.status === 401 || lastError?.status === 403) {
      friendlyMsg = `⚠️ Error de autenticación en Gemini: ${lastError.message || 'Clave API GEMINI_API_KEY no válida.'}`;
    } else if (lastError?.code === 'MODEL_NOT_FOUND' || lastError?.status === 404) {
      friendlyMsg = `⚠️ Error de modelo en Gemini: ${lastError.message || 'El modelo configurado en GEMINI_MODEL no existe.'}`;
    } else if (lastError?.code === 'RATE_LIMIT' || lastError?.status === 429) {
      friendlyMsg = '⚠️ Se ha superado el límite de peticiones o cuota de Gemini. Intenta de nuevo en unos instantes.';
    } else if (lastError?.code === 'TIMEOUT') {
      friendlyMsg = `⚠️ El proveedor Gemini superó el tiempo de espera de respuesta (${effectiveTimeout}ms).`;
    } else if (lastError?.message) {
      friendlyMsg = `⚠️ Error al conectar con Gemini: ${lastError.message}`;
    }

    return {
      available: false,
      reply: friendlyMsg,
      error: lastError || { code: 'UNKNOWN_ERROR', message: 'Error al conectar con Gemini.' },
    };
  }

  // Handle Automatic Continuations if finish_reason === 'length'
  let fullReply = successfulResult.reply;
  let finishReason = successfulResult.finish_reason;
  let continuationCount = 0;

  while (finishReason === 'length' && continuationCount < maxContinuations) {
    continuationCount++;
    console.log(`[AI Service] Answer truncated (length). Triggering automatic continuation ${continuationCount}/${maxContinuations}...`);

    const contMessages = [
      ...formattedMessages,
      { role: 'assistant', content: fullReply },
      { role: 'user', content: 'Por favor continúa exactamente donde te quedaste, sin repetir el texto previo.' }
    ];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), effectiveTimeout);

    try {
      const contRes = await ProviderAdapters.gemini({
        settings,
        messages: contMessages,
        maxTokens: effectiveMaxTokens,
        modelOverride: successfulResult.model_used,
        temperature,
        visionImage: null,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (contRes.ok && contRes.reply) {
        fullReply = fullReply.trim() + ' ' + contRes.reply.trim();
        finishReason = contRes.finish_reason;
      } else {
        break;
      }
    } catch (e) {
      clearTimeout(timer);
      break;
    }
  }

  return {
    available: true,
    reply: fullReply,
    finish_reason: finishReason,
    model_used: successfulResult.model_used,
    provider: 'gemini',
    usage: successfulResult.usage || null,
    continuations: continuationCount,
  };
}

module.exports = {
  getAISettings,
  pruneMessages,
  chatCompletion,
  ProviderAdapters,
};

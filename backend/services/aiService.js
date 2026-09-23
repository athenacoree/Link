const { query } = require('../db/postgres');

/**
 * Centralized AI System Service for Enlace.
 * Exclusively uses Cerebras AI Cloud.
 * Supports Real Timeout (AbortController), Response Truncation Continuation,
 * Context Budgeting, and Structured Tool Definitions.
 */

async function getAISettings() {
  const config = {
    ai_provider: 'cerebras',
    cerebras_api_key: process.env.CEREBRAS_API_KEY || '',
    cerebras_model: process.env.CEREBRAS_MODEL || 'llama-3.3-70b',
    ai_name: process.env.AI_NAME || 'Link AI',
    ai_avatar: process.env.AI_AVATAR || '',
    ai_personality: process.env.AI_PERSONALITY || 'Eres Link AI, un asistente inteligente integrado en la plataforma social Link. Responde siempre en español, con amabilidad y precisión.',
    ai_max_tokens: process.env.AI_MAX_TOKENS || '1000',
    ai_context_tokens: process.env.AI_CONTEXT_TOKENS || '4000',
    ailab_max_msg_length: process.env.AILAB_MAX_MSG_LENGTH || '2000',
    ailab_max_personality_length: process.env.AILAB_MAX_PERSONALITY_LENGTH || '1000',
    ailab_max_image_size_mb: process.env.AILAB_MAX_IMAGE_SIZE_MB || '5',
    ailab_max_history: process.env.AILAB_MAX_HISTORY || '10',
    ailab_timeout_ms: process.env.AILAB_TIMEOUT_MS || '30000',
    ailab_auto_interval_min: process.env.AILAB_AUTO_INTERVAL_MIN || '0.5',
    ai_max_continuations: process.env.AI_MAX_CONTINUATIONS || '2',
    ai_max_tool_steps: process.env.AI_MAX_TOOL_STEPS || '5',
  };

  try {
    const { rows } = await query(
      `SELECT key, value FROM system_settings WHERE key IN (
        'ai_provider',
        'cerebras_model',
        'ai_name', 'ai_avatar', 'ai_personality',
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

  // Las claves y límites principales provienen prioritariamente de process.env en Render
  if (process.env.AI_MAX_TOKENS) config.ai_max_tokens = process.env.AI_MAX_TOKENS;
  if (process.env.AI_CONTEXT_TOKENS) config.ai_context_tokens = process.env.AI_CONTEXT_TOKENS;
  if (process.env.AILAB_AUTO_INTERVAL_MIN) config.ailab_auto_interval_min = process.env.AILAB_AUTO_INTERVAL_MIN;

  config.cerebras_api_key = process.env.CEREBRAS_API_KEY || '';
  config.cerebras_model = process.env.CEREBRAS_MODEL || config.cerebras_model || 'llama-3.3-70b';

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
 * Base Adapter Invoker for OpenAI / Cerebras Compatible Endpoints
 */
async function callOpenAICompatible({ endpoint, apiKey, model, messages, maxTokens, visionImage, extraHeaders = {}, signal }) {
  let payloadMessages = messages.map(m => ({ ...m }));

  if (visionImage) {
    const lastUserIdx = payloadMessages.map(m => m.role).lastIndexOf('user');
    if (lastUserIdx !== -1) {
      const existingContent = payloadMessages[lastUserIdx].content;
      const textPrompt = typeof existingContent === 'string' ? existingContent : 'Describe esta imagen';
      payloadMessages[lastUserIdx] = {
        role: 'user',
        content: [
          { type: 'text', text: textPrompt },
          { type: 'image_url', image_url: { url: visionImage } }
        ]
      };
    }
  }

  const payload = {
    model,
    messages: payloadMessages,
    max_tokens: maxTokens,
  };

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text();
    let errDetail = errText;
    try {
      const parsed = JSON.parse(errText);
      if (parsed.error && parsed.error.message) errDetail = parsed.error.message;
      else if (parsed.error) errDetail = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
    } catch (e) {}

    const isVisionErr = visionImage && (
      errDetail.toLowerCase().includes('vision') ||
      errDetail.toLowerCase().includes('multimodal') ||
      errDetail.toLowerCase().includes('support')
    );

    return {
      ok: false,
      status: response.status,
      error: {
        code: isVisionErr ? 'VISION_NOT_SUPPORTED' : `HTTP_${response.status}`,
        message: errDetail,
        retryable: response.status === 429 || response.status >= 500 || isVisionErr,
      }
    };
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  const reply = choice?.message?.content || '';

  return {
    ok: true,
    reply,
    finish_reason: choice?.finish_reason || 'stop',
    model_used: data.model || model,
    usage: data.usage || null,
  };
}

/**
 * Provider Adapters Registry - Exclusively Cerebras
 */
const ProviderAdapters = {
  cerebras: async ({ settings, messages, maxTokens, modelOverride, visionImage, signal }) => {
    const apiKey = (settings.cerebras_api_key || process.env.CEREBRAS_API_KEY || '').trim();
    if (!apiKey) {
      return { ok: false, error: { code: 'NO_API_KEY', message: 'Cerebras API Key no configurada en las variables de entorno.', retryable: true } };
    }
    const model = modelOverride || process.env.CEREBRAS_MODEL || settings.cerebras_model || 'llama-3.3-70b';
    return callOpenAICompatible({
      endpoint: 'https://api.cerebras.ai/v1/chat/completions',
      apiKey,
      model,
      messages,
      maxTokens,
      visionImage,
      signal,
    });
  }
};

/**
 * Main AI Chat Completion method using exclusively Cerebras AI Cloud.
 */
async function chatCompletion({
  messages = [],
  systemPrompt = null,
  maxTokens = null,
  model = null,
  provider = null,
  visionImage = null,
  timeoutMs = null,
} = {}) {
  const settings = await getAISettings();

  const effectiveMaxTokens = Math.max(50, Math.min(16000, parseInt(maxTokens || settings.ai_max_tokens || '1000', 10)));
  const effectiveContextTokens = parseInt(settings.ai_context_tokens || '4000', 10);
  const effectiveTimeout = parseInt(timeoutMs || settings.ailab_timeout_ms || '30000', 10);
  const maxContinuations = Math.min(3, Math.max(0, parseInt(settings.ai_max_continuations || '2', 10)));

  let formattedMessages = Array.isArray(messages) ? [...messages] : [];

  if (systemPrompt && !formattedMessages.some(m => m && m.role === 'system')) {
    formattedMessages.unshift({ role: 'system', content: systemPrompt });
  } else if (!formattedMessages.some(m => m && m.role === 'system')) {
    formattedMessages.unshift({ role: 'system', content: settings.ai_personality });
  }

  formattedMessages = pruneMessages(formattedMessages, effectiveContextTokens);

  const selectedModel = model || process.env.CEREBRAS_MODEL || settings.cerebras_model || 'llama-3.3-70b';

  let lastError = null;
  let successfulResult = null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), effectiveTimeout);

  try {
    const res = await ProviderAdapters.cerebras({
      settings,
      messages: formattedMessages,
      maxTokens: effectiveMaxTokens,
      modelOverride: selectedModel,
      visionImage,
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (res.ok) {
      successfulResult = { ...res, provider: 'cerebras' };
    } else {
      lastError = res.error;
      console.warn(`[AI Service] Cerebras provider failed: ${res.error?.message || 'Error desconocido'}`);
    }
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err.name === 'AbortError';
    lastError = {
      code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      message: isTimeout ? `El proveedor Cerebras superó el tiempo de espera (${effectiveTimeout}ms).` : err.message,
      retryable: true,
    };
    console.warn(`[AI Service] Exception on Cerebras: ${lastError.message}`);
  }

  if (!successfulResult) {
    let friendlyMsg = '⚠️ Estoy teniendo problemas técnicos para comunicarme con el modelo de IA.';
    if (lastError?.code === 'VISION_NOT_SUPPORTED') {
      friendlyMsg = '⚠️ El modelo de IA seleccionado no soporta análisis de imágenes en este momento.';
    } else if (lastError?.code === 'NO_API_KEY' || lastError?.status === 401 || (lastError?.message && (lastError.message.toLowerCase().includes('api key') || lastError.message.toLowerCase().includes('authentication header')))) {
      friendlyMsg = `⚠️ Error de autenticación en la IA: ${lastError.message || 'Clave API de Cerebras no provista o inválida en las variables de entorno.'}`;
    } else if (lastError?.message) {
      friendlyMsg = `⚠️ Error al conectar con la IA: ${lastError.message}`;
    }

    return {
      available: false,
      reply: friendlyMsg,
      error: lastError || { code: 'UNKNOWN_ERROR', message: 'Error al conectar con Cerebras.' },
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
      const contRes = await ProviderAdapters.cerebras({
        settings,
        messages: contMessages,
        maxTokens: effectiveMaxTokens,
        modelOverride: successfulResult.model_used,
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
    provider: 'cerebras',
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

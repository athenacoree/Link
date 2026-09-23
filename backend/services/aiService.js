const { query } = require('../db/postgres');

/**
 * Centralized AI System Service for Enlace.
 * Supports Provider Adapters, Automatic Fallback, Real Timeout (AbortController),
 * Response Truncation Continuation, Context Budgeting, and Structured Tool Definitions.
 */

async function getAISettings() {
  const config = {
    ai_provider: process.env.AI_PROVIDER || 'cerebras',
    openrouter_api_key: process.env.OPENROUTER_API_KEY || '',
    openrouter_model: process.env.OPENROUTER_MODEL || 'openrouter/free',
    xai_api_key: process.env.XAI_API_KEY || process.env.GROK_API_KEY || '',
    xai_model: process.env.XAI_MODEL || process.env.GROK_MODEL || 'grok-beta',
    fallback_provider: process.env.FALLBACK_PROVIDER || 'huggingface',
    fallback_model: process.env.FALLBACK_MODEL || process.env.HF_MODEL || 'meta-llama/Llama-3.2-3B-Instruct',
    hf_token: process.env.HF_TOKEN || '',
    hf_model: process.env.HF_MODEL || 'meta-llama/Llama-3.2-3B-Instruct',
    hf_provider: process.env.HF_PROVIDER || 'hf-inference',
    gemini_api_key: process.env.GEMINI_API_KEY || '',
    gemini_model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    openai_api_key: process.env.OPENAI_API_KEY || '',
    openai_model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    anthropic_api_key: process.env.ANTHROPIC_API_KEY || '',
    anthropic_model: process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307',
    groq_api_key: process.env.GROQ_API_KEY || '',
    groq_model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
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
    ai_max_fallback_attempts: process.env.AI_MAX_FALLBACK_ATTEMPTS || '3',
    ai_max_tool_steps: process.env.AI_MAX_TOOL_STEPS || '5',
  };

  try {
    const { rows } = await query(
      `SELECT key, value FROM system_settings WHERE key IN (
        'ai_provider',
        'fallback_provider', 'fallback_model',
        'hf_model', 'hf_provider',
        'gemini_model',
        'openai_model',
        'anthropic_model',
        'groq_model',
        'xai_model',
        'cerebras_model',
        'ai_name', 'ai_avatar', 'ai_personality',
        'ai_max_tokens', 'ai_context_tokens',
        'ailab_max_msg_length', 'ailab_max_personality_length',
        'ailab_max_image_size_mb', 'ailab_max_history', 'ailab_timeout_ms', 'ailab_auto_interval_min',
        'ai_max_continuations', 'ai_max_fallback_attempts', 'ai_max_tool_steps'
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

  config.openrouter_api_key = process.env.OPENROUTER_API_KEY || '';
  config.openrouter_model = process.env.OPENROUTER_MODEL || config.openrouter_model || 'openrouter/free';

  config.hf_token = process.env.HF_TOKEN || '';
  config.gemini_api_key = process.env.GEMINI_API_KEY || '';
  config.openai_api_key = process.env.OPENAI_API_KEY || '';
  config.anthropic_api_key = process.env.ANTHROPIC_API_KEY || '';
  config.groq_api_key = process.env.GROQ_API_KEY || '';
  config.xai_api_key = process.env.XAI_API_KEY || process.env.GROK_API_KEY || '';
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
 * Base Adapter Invoker for OpenRouter / OpenAI Compatible Endpoints
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
 * Provider Adapters Registry
 */
const ProviderAdapters = {
  openrouter: async ({ settings, messages, maxTokens, modelOverride, visionImage, signal }) => {
    const apiKey = (settings.openrouter_api_key || process.env.OPENROUTER_API_KEY || '').trim();
    if (!apiKey) {
      return {
        ok: false,
        error: { code: 'NO_API_KEY', message: 'OpenRouter API Key no configurada.', retryable: true },
      };
    }
    const model = process.env.OPENROUTER_MODEL || modelOverride || settings.openrouter_model || 'openrouter/free';
    return callOpenAICompatible({
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey,
      model,
      messages,
      maxTokens,
      visionImage,
      extraHeaders: {
        'HTTP-Referer': process.env.SITE_URL || 'https://link-app.onrender.com',
        'X-Title': 'Link Social Platform',
      },
      signal,
    });
  },

  huggingface: async ({ settings, messages, maxTokens, modelOverride, visionImage, signal }) => {
    const token = (settings.hf_token || '').trim();
    if (!token) {
      return {
        ok: false,
        error: { code: 'NO_API_KEY', message: 'Hugging Face Token no configurado.', retryable: true },
      };
    }
    if (visionImage) {
      return {
        ok: false,
        error: { code: 'VISION_NOT_SUPPORTED', message: 'Hugging Face por defecto no tiene visión activa.', retryable: true },
      };
    }
    const model = modelOverride || settings.hf_model || 'meta-llama/Llama-3.2-3B-Instruct';
    return callOpenAICompatible({
      endpoint: 'https://router.huggingface.co/hf-inference/v1/chat/completions',
      apiKey: token,
      model,
      messages,
      maxTokens,
      visionImage: null,
      signal,
    });
  },

  openai: async ({ settings, messages, maxTokens, modelOverride, visionImage, signal }) => {
    const apiKey = (settings.openai_api_key || '').trim();
    if (!apiKey) {
      return { ok: false, error: { code: 'NO_API_KEY', message: 'OpenAI API Key no configurada.', retryable: true } };
    }
    const model = modelOverride || settings.openai_model || 'gpt-4o-mini';
    return callOpenAICompatible({
      endpoint: 'https://api.openai.com/v1/chat/completions',
      apiKey,
      model,
      messages,
      maxTokens,
      visionImage,
      signal,
    });
  },

  groq: async ({ settings, messages, maxTokens, modelOverride, visionImage, signal }) => {
    const apiKey = (settings.groq_api_key || '').trim();
    if (!apiKey) {
      return { ok: false, error: { code: 'NO_API_KEY', message: 'Groq API Key no configurada.', retryable: true } };
    }
    const model = modelOverride || settings.groq_model || 'llama-3.1-8b-instant';
    return callOpenAICompatible({
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      apiKey,
      model,
      messages,
      maxTokens,
      visionImage,
      signal,
    });
  },

  gemini: async ({ settings, messages, maxTokens, modelOverride, visionImage, signal }) => {
    const apiKey = (settings.gemini_api_key || '').trim();
    if (!apiKey) {
      return { ok: false, error: { code: 'NO_API_KEY', message: 'Gemini API Key no configurada.', retryable: true } };
    }
    const model = modelOverride || settings.gemini_model || 'gemini-1.5-flash';
    return callOpenAICompatible({
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      apiKey,
      model,
      messages,
      maxTokens,
      visionImage,
      signal,
    });
  },

  anthropic: async ({ settings, messages, maxTokens, modelOverride, visionImage, signal }) => {
    const apiKey = (settings.anthropic_api_key || '').trim();
    if (!apiKey) {
      return { ok: false, error: { code: 'NO_API_KEY', message: 'Anthropic API Key no configurada.', retryable: true } };
    }
    const model = modelOverride || settings.anthropic_model || 'claude-3-haiku-20240307';

    let sysPrompt = '';
    const formattedMsgs = [];
    messages.forEach(m => {
      if (m.role === 'system') sysPrompt = typeof m.content === 'string' ? m.content : '';
      else formattedMsgs.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
    });

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          system: sysPrompt,
          messages: formattedMsgs,
          max_tokens: maxTokens,
        }),
        signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        return { ok: false, status: response.status, error: { code: `HTTP_${response.status}`, message: errText, retryable: true } };
      }

      const data = await response.json();
      const reply = data.content?.[0]?.text || '';
      return {
        ok: true,
        reply,
        finish_reason: data.stop_reason === 'max_tokens' ? 'length' : 'stop',
        model_used: data.model || model,
      };
    } catch (e) {
      return { ok: false, error: { code: 'NETWORK_ERROR', message: e.message, retryable: true } };
    }
  },

  xai: async ({ settings, messages, maxTokens, modelOverride, visionImage, signal }) => {
    const apiKey = (settings.xai_api_key || process.env.XAI_API_KEY || process.env.GROK_API_KEY || '').trim();
    if (!apiKey) {
      return { ok: false, error: { code: 'NO_API_KEY', message: 'xAI / Grok API Key no configurada.', retryable: true } };
    }
    const model = modelOverride || settings.xai_model || process.env.XAI_MODEL || process.env.GROK_MODEL || 'grok-beta';
    return callOpenAICompatible({
      endpoint: 'https://api.x.ai/v1/chat/completions',
      apiKey,
      model,
      messages,
      maxTokens,
      visionImage,
      signal,
    });
  },

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
 * Main AI Chat Completion method with automatic fallback, real timeout, and response continuation.
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

  const primaryProvider = (provider || settings.ai_provider || 'cerebras').toLowerCase();
  const fallbackProvider = (settings.fallback_provider || 'huggingface').toLowerCase();

  const effectiveMaxTokens = Math.max(50, Math.min(16000, parseInt(maxTokens || settings.ai_max_tokens || '1000', 10)));
  const effectiveContextTokens = parseInt(settings.ai_context_tokens || '4000', 10);
  const effectiveTimeout = parseInt(timeoutMs || settings.ailab_timeout_ms || '30000', 10);
  const maxContinuations = Math.min(3, Math.max(0, parseInt(settings.ai_max_continuations || '2', 10)));
  const maxFallbackAttempts = Math.min(5, Math.max(1, parseInt(settings.ai_max_fallback_attempts || '3', 10)));

  let formattedMessages = Array.isArray(messages) ? [...messages] : [];

  if (systemPrompt && !formattedMessages.some(m => m && m.role === 'system')) {
    formattedMessages.unshift({ role: 'system', content: systemPrompt });
  } else if (!formattedMessages.some(m => m && m.role === 'system')) {
    formattedMessages.unshift({ role: 'system', content: settings.ai_personality });
  }

  formattedMessages = pruneMessages(formattedMessages, effectiveContextTokens);

  // Obtención dinámica de modelos gratuitos de OpenRouter para la secuencia de rotación
  const freeModelsList = await getOpenRouterFreeModels();

  // Fallback sequence building
  const attemptsSequence = [];

  if (model) {
    attemptsSequence.push({ provider: primaryProvider, model });
  } else if (primaryProvider === 'openrouter') {
    const mainModel = process.env.OPENROUTER_MODEL || settings.openrouter_model || 'openrouter/free';
    attemptsSequence.push({ provider: 'openrouter', model: mainModel });
  } else if (primaryProvider === 'cerebras') {
    const mainModel = process.env.CEREBRAS_MODEL || settings.cerebras_model || 'llama-3.3-70b';
    attemptsSequence.push({ provider: 'cerebras', model: mainModel });
  } else {
    attemptsSequence.push({ provider: primaryProvider, model: null });
  }

  // Si Cerebras está configurado y no es el proveedor principal, agregarlo a la secuencia de respaldos
  if (primaryProvider !== 'cerebras' && (process.env.CEREBRAS_API_KEY || settings.cerebras_api_key)) {
    const cbModel = process.env.CEREBRAS_MODEL || settings.cerebras_model || 'llama-3.3-70b';
    attemptsSequence.push({ provider: 'cerebras', model: cbModel });
  }

  // Agregar modelos free de OpenRouter como fallback dinámico, priorizando visión si hay imagen
  if (visionImage) {
    const visionFreeModels = freeModelsList.filter(m => m.isVision);
    for (const vm of visionFreeModels) {
      if (!attemptsSequence.some(a => a.provider === 'openrouter' && a.model === vm.id)) {
        attemptsSequence.push({ provider: 'openrouter', model: vm.id });
      }
    }
  }

  for (const fm of freeModelsList) {
    if (!attemptsSequence.some(a => a.provider === 'openrouter' && a.model === fm.id)) {
      attemptsSequence.push({ provider: 'openrouter', model: fm.id });
    }
  }

  if (fallbackProvider && fallbackProvider !== primaryProvider) {
    attemptsSequence.push({ provider: fallbackProvider, model: settings.fallback_model || null });
  }

  // Backup huggingface default
  if (!attemptsSequence.some(a => a.provider === 'huggingface')) {
    attemptsSequence.push({ provider: 'huggingface', model: 'meta-llama/Llama-3.2-3B-Instruct' });
  }

  let lastError = null;
  let successfulResult = null;
  let attemptsCount = 0;

  for (const attempt of attemptsSequence) {
    if (attemptsCount >= maxFallbackAttempts) break;

    const adapter = ProviderAdapters[attempt.provider];
    if (!adapter) continue;

    attemptsCount++;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), effectiveTimeout);

    try {
      const res = await adapter({
        settings,
        messages: formattedMessages,
        maxTokens: effectiveMaxTokens,
        modelOverride: attempt.model,
        visionImage,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (res.ok) {
        successfulResult = { ...res, provider: attempt.provider };
        break;
      } else {
        lastError = res.error;
        console.warn(`[AI Service Attempt ${attemptsCount}] Provider ${attempt.provider} failed: ${res.error?.message || 'Error desconocido'}`);
      }
    } catch (err) {
      clearTimeout(timer);
      const isTimeout = err.name === 'AbortError';
      lastError = {
        code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
        message: isTimeout ? `El proveedor ${attempt.provider} superó el tiempo de espera (${effectiveTimeout}ms).` : err.message,
        retryable: true,
      };
      console.warn(`[AI Service Attempt ${attemptsCount}] Exception on ${attempt.provider}: ${lastError.message}`);
    }
  }

  if (!successfulResult) {
    let friendlyMsg = '⚠️ Estoy teniendo problemas técnicos para comunicarme con el modelo de IA.';
    if (lastError?.code === 'VISION_NOT_SUPPORTED') {
      friendlyMsg = '⚠️ El modelo de IA seleccionado no soporta análisis de imágenes en este momento.';
    } else if (lastError?.code === 'NO_API_KEY' || lastError?.status === 401 || (lastError?.message && (lastError.message.toLowerCase().includes('api key') || lastError.message.toLowerCase().includes('authentication header')))) {
      friendlyMsg = `⚠️ Error de autenticación en la IA: ${lastError.message || 'Clave API no provista o inválida en las variables de entorno.'}`;
    } else if (lastError?.message) {
      friendlyMsg = `⚠️ Error al conectar con la IA: ${lastError.message}`;
    }

    return {
      available: false,
      reply: friendlyMsg,
      error: lastError || { code: 'UNKNOWN_ERROR', message: 'Todos los intentos de proveedores fallaron.' },
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
      const adapter = ProviderAdapters[successfulResult.provider];
      const contRes = await adapter({
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
    provider: successfulResult.provider,
    usage: successfulResult.usage || null,
    continuations: continuationCount,
  };
}

let openRouterFreeModelsCache = { models: [], timestamp: 0 };
const OPENROUTER_CACHE_TTL = 15 * 60 * 1000; // 15 minutos

/**
 * Consulta la API de OpenRouter para obtener la lista dinámica de modelos gratuitos disponibles.
 */
async function getOpenRouterFreeModels() {
  const now = Date.now();
  if (openRouterFreeModelsCache.models.length > 0 && (now - openRouterFreeModelsCache.timestamp < OPENROUTER_CACHE_TTL)) {
    return openRouterFreeModelsCache.models;
  }

  const fallbackFreeModels = [
    { id: process.env.OPENROUTER_MODEL || 'openrouter/free', isVision: true },
  ];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch('https://openrouter.ai/api/v1/models', { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      return fallbackFreeModels;
    }

    const data = await res.json();
    if (!data || !Array.isArray(data.data)) {
      return fallbackFreeModels;
    }

    const freeModels = [];
    for (const item of data.data) {
      const isFreeById = item.id && item.id.endsWith(':free');
      const isFreeByPrice = item.pricing && parseFloat(item.pricing.prompt || '1') === 0 && parseFloat(item.pricing.completion || '1') === 0;

      if (isFreeById || isFreeByPrice) {
        const modality = (item.architecture?.modality || '').toLowerCase();
        const description = (item.description || '').toLowerCase();
        const isVision = modality.includes('image') || modality.includes('multimodal') || description.includes('vision') || item.id.includes('vision');
        freeModels.push({ id: item.id, isVision });
      }
    }

    if (freeModels.length > 0) {
      openRouterFreeModelsCache = { models: freeModels, timestamp: now };
      return freeModels;
    }
    return fallbackFreeModels;
  } catch (err) {
    return fallbackFreeModels;
  }
}

module.exports = {
  getAISettings,
  pruneMessages,
  chatCompletion,
  getOpenRouterFreeModels,
  ProviderAdapters,
};

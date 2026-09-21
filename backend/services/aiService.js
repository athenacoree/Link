const { query } = require('../db/postgres');

/**
 * Servicio Centralizado de IA para Enlace
 * Soporta OpenRouter y Hugging Face Inference Providers.
 */

async function getAISettings() {
  const config = {
    ai_provider: process.env.AI_PROVIDER || 'openrouter',
    openrouter_api_key: process.env.OPENROUTER_API_KEY || '',
    openrouter_model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',
    hf_token: process.env.HF_TOKEN || '',
    hf_model: process.env.HF_MODEL || 'meta-llama/Llama-3.2-3B-Instruct',
    hf_provider: process.env.HF_PROVIDER || 'hf-inference',
    ai_name: 'Link AI',
    ai_avatar: '',
    ai_personality: 'Eres Link AI, un asistente inteligente integrado en la plataforma social Link. Responde siempre en español, con amabilidad y precisión.',
    ai_max_tokens: '1000',
    ai_context_tokens: '4000',
    ailab_max_msg_length: '2000',
    ailab_max_personality_length: '1000',
    ailab_max_image_size_mb: '5',
    ailab_max_history: '10',
    ailab_timeout_ms: '30000',
  };

  try {
    const { rows } = await query(
      `SELECT key, value FROM system_settings WHERE key IN (
        'ai_provider', 'openrouter_api_key', 'openrouter_model',
        'hf_token', 'hf_model', 'hf_provider',
        'ai_name', 'ai_avatar', 'ai_personality',
        'ai_max_tokens', 'ai_context_tokens',
        'ailab_max_msg_length', 'ailab_max_personality_length',
        'ailab_max_image_size_mb', 'ailab_max_history', 'ailab_timeout_ms'
      )`
    );
    rows.forEach(r => {
      if (r.value !== undefined && r.value !== null && r.value !== '') {
        config[r.key] = r.value;
      }
    });
  } catch (err) {
    // Si no se puede consultar system_settings, se utilizan los valores predeterminados
  }

  return config;
}

/**
 * Controla y ajusta el contexto de mensajes según el límite de tokens configurado.
 */
function pruneMessages(messages, maxContextTokens = 4000) {
  if (!Array.isArray(messages) || messages.length === 0) return [];

  const maxChars = Math.max(1000, maxContextTokens * 4);
  let systemMsg = null;
  const nonSystemMsgs = [];

  for (const msg of messages) {
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
 * Petición centralizada de generación de chat / texto
 */
async function chatCompletion({
  messages = [],
  systemPrompt = null,
  maxTokens = null,
  model = null,
  provider = null,
  visionImage = null,
} = {}) {
  const settings = await getAISettings();
  const selectedProvider = (provider || settings.ai_provider || 'openrouter').toLowerCase();

  const effectiveMaxTokens = parseInt(maxTokens || settings.ai_max_tokens || '1000', 10);
  const effectiveContextTokens = parseInt(settings.ai_context_tokens || '4000', 10);

  let formattedMessages = Array.isArray(messages) ? [...messages] : [];

  if (systemPrompt && !formattedMessages.some(m => m.role === 'system')) {
    formattedMessages.unshift({ role: 'system', content: systemPrompt });
  } else if (!formattedMessages.some(m => m.role === 'system')) {
    formattedMessages.unshift({ role: 'system', content: settings.ai_personality });
  }

  formattedMessages = pruneMessages(formattedMessages, effectiveContextTokens);

  if (selectedProvider === 'huggingface') {
    return callHuggingFace({
      messages: formattedMessages,
      settings,
      maxTokens: effectiveMaxTokens,
      modelOverride: model,
      visionImage,
    });
  }

  return callOpenRouter({
    messages: formattedMessages,
    settings,
    maxTokens: effectiveMaxTokens,
    modelOverride: model,
    visionImage,
  });
}

/**
 * Ejecución vía OpenRouter API
 */
async function callOpenRouter({ messages, settings, maxTokens, modelOverride, visionImage }) {
  const apiKey = (settings.openrouter_api_key || '').trim();
  if (!apiKey) {
    return {
      available: false,
      error: 'La API de OpenRouter no está configurada. Ingresa tu API Key en el Panel Administrativo.',
      reply: '⚠️ No se pudo completar esta acción. El proveedor no respondió correctamente.',
    };
  }

  const modelToUse = modelOverride || settings.openrouter_model || 'meta-llama/llama-3.1-8b-instruct:free';

  let payloadMessages = [...messages];
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
    model: modelToUse,
    messages: payloadMessages,
    max_tokens: maxTokens,
  };

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.SITE_URL || 'https://link-app.onrender.com',
        'X-Title': 'Link Social Platform',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      let errDetail = errText;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error && parsed.error.message) errDetail = parsed.error.message;
      } catch (e) {}

      // Manejo de Vision no soportado en OpenRouter
      if (visionImage && (errDetail.toLowerCase().includes('vision') || errDetail.toLowerCase().includes('multimodal') || errDetail.toLowerCase().includes('support'))) {
        return {
          available: false,
          error: `El modelo seleccionado (${modelToUse}) no soporta análisis de imágenes/visión.`,
          reply: '⚠️ El modelo de IA seleccionado no soporta análisis de visión. Cambia el modelo en Administración o intenta con un modelo compatible.',
        };
      }

      console.error(`[OpenRouter Error ${response.status}]:`, errDetail);
      return {
        available: false,
        error: `Error de OpenRouter (${response.status}): ${errDetail}`,
        reply: '⚠️ No se pudo completar esta acción. El proveedor no respondió correctamente.',
      };
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    let reply = choice?.message?.content || 'Sin respuesta.';

    if (choice?.finish_reason === 'length') {
      reply += '\n\n[Nota: La respuesta alcanzó el límite máximo de tokens configurado.]';
    }

    return {
      available: true,
      reply,
      finish_reason: choice?.finish_reason || 'stop',
      model_used: data.model || modelToUse,
      provider: 'openrouter',
      usage: data.usage || null,
    };
  } catch (err) {
    console.error('Error al conectar con OpenRouter:', err);
    return {
      available: false,
      error: `Error de red con OpenRouter: ${err.message}`,
      reply: '⚠️ No se pudo completar esta acción. El proveedor no respondió correctamente.',
    };
  }
}

/**
 * Ejecución vía Hugging Face Inference Providers
 */
async function callHuggingFace({ messages, settings, maxTokens, modelOverride, visionImage }) {
  const token = (settings.hf_token || '').trim();
  if (!token) {
    return {
      available: false,
      error: 'La API Key (HF_TOKEN) de Hugging Face no está configurada.',
      reply: '⚠️ No se pudo completar esta acción. Hugging Face no está configurado en Administración.',
    };
  }

  const modelToUse = modelOverride || settings.hf_model || 'meta-llama/Llama-3.2-3B-Instruct';

  if (visionImage) {
    return {
      available: false,
      error: 'Visión multimodal no configurada para este modelo en Hugging Face.',
      reply: '⚠️ El modelo de Hugging Face configurado actualmente no soporta visión directa.',
    };
  }

  try {
    // Usar el endpoint OpenAI-compatible de Hugging Face Serverless Router
    const response = await fetch('https://router.huggingface.co/hf-inference/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: messages,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let errDetail = errText;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error) errDetail = typeof parsed.error === 'string' ? parsed.error : (parsed.error.message || errText);
      } catch (e) {}

      console.error(`[HuggingFace Error ${response.status}]:`, errDetail);
      return {
        available: false,
        error: `Error de Hugging Face (${response.status}): ${errDetail}`,
        reply: '⚠️ No se pudo completar esta acción. El proveedor no respondió correctamente.',
      };
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    let reply = choice?.message?.content || 'Sin respuesta.';

    if (choice?.finish_reason === 'length') {
      reply += '\n\n[Nota: La respuesta alcanzó el límite máximo de tokens configurado.]';
    }

    return {
      available: true,
      reply,
      finish_reason: choice?.finish_reason || 'stop',
      model_used: data.model || modelToUse,
      provider: 'huggingface',
      usage: data.usage || null,
    };
  } catch (err) {
    console.error('Error al conectar con Hugging Face:', err);
    return {
      available: false,
      error: `Error de red con Hugging Face: ${err.message}`,
      reply: '⚠️ No se pudo completar esta acción. El proveedor no respondió correctamente.',
    };
  }
}

module.exports = {
  getAISettings,
  pruneMessages,
  chatCompletion,
};

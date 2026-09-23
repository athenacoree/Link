const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getAISettings, chatCompletion } = require('../services/aiService');
const ToolManager = require('../tools/ToolManager');

const router = express.Router();

// Simple in-memory rate limiting map for AI requests
const aiRateLimitMap = new Map();

function aiRateLimiter(req, res, next) {
  const key = req.user?.id || req.ip || 'anonymous';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minuto
  const maxRequests = 40; // Límite máximo de peticiones por minuto

  let record = aiRateLimitMap.get(key);
  if (!record || now - record.startTime > windowMs) {
    record = { count: 1, startTime: now };
  } else {
    record.count++;
  }
  aiRateLimitMap.set(key, record);

  if (record.count > maxRequests) {
    return res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Has alcanzado el límite de peticiones de IA por minuto. Por favor espera un momento.',
        retryable: true,
      }
    });
  }
  next();
}

// GET /api/ai/config -> Configuración pública y herramientas
router.get('/config', requireAuth, async (req, res) => {
  try {
    const settings = await getAISettings();
    const available = true; // El sistema soporta adaptadores y fallbacks automáticos

    res.json({
      available,
      provider: settings.ai_provider || 'cerebras',
      fallback_provider: settings.fallback_provider || 'huggingface',
      name: settings.ai_name || 'Link AI',
      avatar: settings.ai_avatar || '',
      personality: settings.ai_personality,
      model: settings.ai_provider === 'huggingface' ? settings.hf_model : (settings.ai_provider === 'cerebras' ? settings.cerebras_model : settings.openrouter_model),
      max_tokens: parseInt(settings.ai_max_tokens, 10) || 1000,
      context_tokens: parseInt(settings.ai_context_tokens, 10) || 4000,
      tools: ToolManager.getToolDefinitions(),
    });
  } catch (err) {
    console.error('Error en /api/ai/config:', err);
    res.status(500).json({ error: 'No se pudo obtener la configuración de IA.' });
  }
});

// POST /api/ai/chat -> Chat principal con el Asistente de IA
router.post('/chat', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const settings = await getAISettings();
    const { messages, prompt, tool_name, tool_params, vision_image, file_data } = req.body;

    // Ejecución explícita de herramienta si fue solicitada
    if (tool_name) {
      const toolResult = await ToolManager.executeTool(tool_name, tool_params || {}, req.user.id);
      return res.json({
        available: true,
        tool_result: toolResult,
        reply: toolResult.error ? `⚠️ ${toolResult.error}` : null
      });
    }

    let userPrompt = prompt || (Array.isArray(messages) && messages.length > 0 ? messages[messages.length - 1]?.content : '');

    // Si se adjunta un archivo/documento, procesar extracción de texto
    let docResult = null;
    if (file_data) {
      docResult = await ToolManager.executeTool('doc.extract', file_data, req.user.id);
      if (docResult && docResult.data && docResult.data.extracted_text) {
        userPrompt += `\n\n[Contenido del documento adjunto '${docResult.data.filename}']: ${docResult.data.extracted_text.slice(0, 3000)}`;
      }
    }

    // Detectar intención de herramienta automática y ejecutar antes de llamar a la IA
    const detectedTool = ToolManager.detectToolIntent(userPrompt);
    let toolResult = docResult;
    if (detectedTool && !toolResult) {
      toolResult = await ToolManager.executeTool(detectedTool.tool, detectedTool.params, req.user.id);
    }

    let toolContextText = '';
    if (toolResult) {
      if (toolResult.error) {
        toolContextText = `\n\n[Información de Herramienta '${detectedTool?.tool || 'desconocida'}']: Ocurrió un error al consultar: ${toolResult.error}`;
      } else if (toolResult.data) {
        toolContextText = `\n\n[Datos obtenidos de la herramienta '${detectedTool?.tool || toolResult.type || 'ejecutada'}']: ${JSON.stringify(toolResult.data)}`;
      }
    }

    const inputMessages = messages ? [...messages] : [
      { role: 'system', content: settings.ai_personality },
      { role: 'user', content: (userPrompt || 'Hola') + toolContextText },
    ];

    if (messages && toolContextText && inputMessages.length > 0) {
      const lastMsg = { ...inputMessages[inputMessages.length - 1] };
      if (lastMsg.role === 'user') {
        lastMsg.content = (lastMsg.content || '') + toolContextText;
        inputMessages[inputMessages.length - 1] = lastMsg;
      } else {
        inputMessages.push({ role: 'user', content: toolContextText });
      }
    }

    const result = await chatCompletion({
      messages: inputMessages,
      systemPrompt: settings.ai_personality,
      maxTokens: settings.ai_max_tokens,
      visionImage: vision_image || null,
    });

    res.json({
      available: result.available,
      reply: result.reply,
      name: settings.ai_name || 'Link AI',
      avatar: settings.ai_avatar || '',
      model_used: result.model_used,
      provider: result.provider,
      finish_reason: result.finish_reason,
      usage: result.usage,
      tool_result: toolResult,
      continuations: result.continuations || 0,
    });
  } catch (err) {
    console.error('Error en /api/ai/chat:', err);
    res.status(500).json({ error: `⚠️ No se pudo completar esta acción. El proveedor no respondió correctamente.` });
  }
});

module.exports = router;

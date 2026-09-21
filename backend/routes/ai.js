const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getAISettings, chatCompletion } = require('../services/aiService');
const ToolManager = require('../tools/ToolManager');

const router = express.Router();

// GET /api/ai/config -> Devuelve disponibilidad y configuración pública del bot
router.get('/config', requireAuth, async (req, res) => {
  try {
    const settings = await getAISettings();
    const available = settings.ai_provider === 'huggingface'
      ? !!(settings.hf_token && settings.hf_token.trim())
      : !!(settings.openrouter_api_key && settings.openrouter_api_key.trim());

    res.json({
      available,
      provider: settings.ai_provider || 'openrouter',
      name: settings.ai_name || 'Link AI',
      avatar: settings.ai_avatar || '',
      personality: settings.ai_personality,
      model: settings.ai_provider === 'huggingface' ? settings.hf_model : settings.openrouter_model,
      max_tokens: parseInt(settings.ai_max_tokens, 10) || 1000,
      context_tokens: parseInt(settings.ai_context_tokens, 10) || 4000,
    });
  } catch (err) {
    console.error('Error en /api/ai/config:', err);
    res.status(500).json({ error: 'No se pudo obtener la configuración de IA.' });
  }
});

// POST /api/ai/chat -> Chat principal con el Asistente de IA
router.post('/chat', requireAuth, async (req, res) => {
  try {
    const settings = await getAISettings();
    const isAvailable = settings.ai_provider === 'huggingface'
      ? !!(settings.hf_token && settings.hf_token.trim())
      : !!(settings.openrouter_api_key && settings.openrouter_api_key.trim());

    if (!isAvailable) {
      return res.json({
        available: false,
        message: 'La función de inteligencia artificial no está configurada aún (falta ingresar la clave API en el panel de administrador). Todo el sistema sigue funcionando normalmente.',
      });
    }

    const { messages, prompt, tool_name, tool_params } = req.body;

    // Ejecución explícita de herramienta si fue solicitada
    if (tool_name) {
      const toolResult = await ToolManager.executeTool(tool_name, tool_params || {}, req.userId);
      return res.json({
        available: true,
        tool_result: toolResult,
        reply: toolResult.error ? `⚠️ ${toolResult.error}` : null
      });
    }

    const userPrompt = prompt || (Array.isArray(messages) && messages.length > 0 ? messages[messages.length - 1]?.content : '');

    // Detectar intención de herramienta automática
    const detectedTool = ToolManager.detectToolIntent(userPrompt);

    const inputMessages = messages || [
      { role: 'system', content: settings.ai_personality },
      { role: 'user', content: prompt || 'Hola' },
    ];

    const result = await chatCompletion({
      messages: inputMessages,
      systemPrompt: settings.ai_personality,
      maxTokens: settings.ai_max_tokens,
    });

    if (!result.available && result.error) {
      return res.status(500).json({
        error: result.error,
        reply: result.reply,
      });
    }

    let toolResult = null;
    if (detectedTool) {
      toolResult = await ToolManager.executeTool(detectedTool.tool, detectedTool.params, req.userId);
    }

    res.json({
      available: true,
      reply: result.reply,
      name: settings.ai_name || 'Link AI',
      avatar: settings.ai_avatar || '',
      model_used: result.model_used,
      provider: result.provider,
      finish_reason: result.finish_reason,
      usage: result.usage,
      tool_result: toolResult
    });
  } catch (err) {
    console.error('Error en /api/ai/chat:', err);
    res.status(500).json({ error: `⚠️ No se pudo completar esta acción. El proveedor no respondió correctamente.` });
  }
});

module.exports = router;

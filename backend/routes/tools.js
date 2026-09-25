const express = require('express');
const { requireAuth } = require('../middleware/auth');
const ToolManager = require('../tools/ToolManager');

const router = express.Router();

// GET /api/tools/categories -> Obtener categorías registradas
router.get('/categories', requireAuth, async (req, res) => {
  try {
    const caps = await ToolManager.executeTool('system.capabilities', {});
    const categories = caps.data?.categories || [];
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al obtener categorías de herramientas.' });
  }
});

// GET /api/tools -> Obtener catálogo completo de herramientas registradas
router.get('/', requireAuth, async (req, res) => {
  try {
    const defs = ToolManager.getToolDefinitions();
    const caps = await ToolManager.executeTool('system.capabilities', {});
    const categories = caps.data?.categories || [];

    const toolList = [];
    categories.forEach(cat => {
      (cat.tools || []).forEach(t => {
        toolList.push({
          id: t.id,
          tool: t.tool || t.id,
          name: t.name,
          category: cat.id,
          category_name: cat.name,
          icon: t.icon,
          description: t.description,
          params: t.params || {},
          prompt_example: t.prompt_example || '',
          supportsDoubleTap: ['joke.get', 'advice.slip', 'nasa.apod', 'coingecko.prices', 'world.time'].includes(t.tool || t.id),
          enabled: true,
          animation: 'pulse',
          permissions: [],
          inputs: t.params ? Object.keys(t.params) : []
        });
      });
    });

    res.json({ success: true, tools: toolList, count: toolList.length });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al obtener catálogo de herramientas.' });
  }
});

// GET /api/tools/:id -> Obtener detalles de una herramienta específica
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const toolId = req.params.id;
    const caps = await ToolManager.executeTool('system.capabilities', {});
    const categories = caps.data?.categories || [];

    let found = null;
    categories.forEach(cat => {
      (cat.tools || []).forEach(t => {
        if (t.id === toolId || t.tool === toolId) {
          found = {
            id: t.id,
            tool: t.tool || t.id,
            name: t.name,
            category: cat.id,
            category_name: cat.name,
            icon: t.icon,
            description: t.description,
            params: t.params || {},
            prompt_example: t.prompt_example || '',
            supportsDoubleTap: ['joke.get', 'advice.slip', 'nasa.apod', 'coingecko.prices', 'world.time'].includes(t.tool || t.id),
            enabled: true,
            permissions: [],
            inputs: t.params ? Object.keys(t.params) : []
          };
        }
      });
    });

    if (!found) {
      // Buscar en definiciones directas de ToolManager
      const toolDefs = ToolManager.getToolDefinitions();
      const def = toolDefs.find(d => d.name === toolId || d.name.replace(/\./g, '_') === toolId);
      if (def) {
        found = {
          id: def.name,
          tool: def.name,
          name: def.name,
          category: 'herramientas',
          category_name: 'Herramientas',
          icon: '🛠️',
          description: def.description || 'Herramienta modular',
          params: {},
          supportsDoubleTap: false,
          enabled: true,
          permissions: [],
          inputs: def.parameters?.properties ? Object.keys(def.parameters.properties) : []
        };
      }
    }

    if (!found) {
      return res.status(404).json({ success: false, error: `Herramienta '${toolId}' no encontrada.` });
    }

    res.json({ success: true, tool: found });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al consultar detalles de la herramienta.' });
  }
});

// POST /api/tools/execute -> Ejecutar directamente una herramienta en backend de forma independiente
router.post('/execute', requireAuth, async (req, res) => {
  try {
    const { tool_id, params = {} } = req.body;
    if (!tool_id) {
      return res.status(400).json({ success: false, error: 'tool_id es requerido para la ejecución.' });
    }

    const requesterId = req.user.id;
    console.log(`[Tools API] Ejecutando herramienta '${tool_id}' para usuario ${requesterId}...`);

    // Validar si requiere datos obligatorios no provistos
    const toolDefs = ToolManager.getToolDefinitions();
    const def = toolDefs.find(d => d.name === tool_id || d.name.replace(/\./g, '_') === tool_id);

    if (def && def.parameters && Array.isArray(def.parameters.required)) {
      const missing = def.parameters.required.filter(r => params[r] === undefined || params[r] === null || params[r] === '');
      if (missing.length > 0) {
        return res.json({
          success: true,
          status: 'waiting_for_input',
          message: `La herramienta '${def.name}' requiere los siguientes datos: ${missing.join(', ')}`,
          missing_inputs: missing,
          tool_id: def.name,
          provided_params: params
        });
      }
    }

    const result = await ToolManager.executeTool(tool_id, params, requesterId);

    if (result && result.error) {
      return res.json({
        success: false,
        status: 'error',
        tool_id,
        error: result.error
      });
    }

    res.json({
      success: true,
      status: 'completed',
      tool_id,
      params,
      result
    });
  } catch (err) {
    console.error(`[Tools API Error] Error ejecutando herramienta ${req.body?.tool_id}:`, err);
    res.status(500).json({
      success: false,
      status: 'error',
      error: `Error interno al ejecutar la herramienta: ${err.message}`
    });
  }
});

// POST /api/tools/input -> Enviar datos/permisos faltantes para continuar ejecución
router.post('/input', requireAuth, async (req, res) => {
  try {
    const { tool_id, params = {} } = req.body;
    if (!tool_id) {
      return res.status(400).json({ success: false, error: 'tool_id es requerido.' });
    }

    const result = await ToolManager.executeTool(tool_id, params, req.user.id);
    if (result && result.error) {
      return res.json({
        success: false,
        status: 'error',
        tool_id,
        error: result.error
      });
    }

    res.json({
      success: true,
      status: 'completed',
      tool_id,
      params,
      result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

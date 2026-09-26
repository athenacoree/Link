const express = require('express');
const { requireAuth } = require('../middleware/auth');
const videoStreamTool = require('../tools/videoStreamTool');
const linkVideoService = require('../services/linkVideoService');

const router = express.Router();

/**
 * GET /api/linkvideo/catalog - Obtener el catálogo de streaming de películas/audio/video de Link Video
 */
router.get('/catalog', requireAuth, async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const catalog = await linkVideoService.getCatalog(forceRefresh);
    res.json({
      base_url: linkVideoService.getLinkVideoBaseUrl(),
      catalog
    });
  } catch (err) {
    console.error('Error al obtener catálogo de Link Video:', err);
    res.status(500).json({ error: 'No se pudo obtener el catálogo de Link Video.' });
  }
});

/**
 * GET /api/linkvideo/streams - Herramienta de consulta/filtrado de transmisiones
 */
router.get('/streams', requireAuth, async (req, res) => {
  try {
    const result = await videoStreamTool.listStreams({
      type: req.query.type,
      query: req.query.q || req.query.query,
      refresh: req.query.refresh === 'true'
    });
    res.json(result);
  } catch (err) {
    console.error('Error al listar transmisiones:', err);
    res.status(500).json({ error: 'Error al consultar transmisiones de Link Video.' });
  }
});

/**
 * GET /api/linkvideo/streams/:id - Obtener detalles de una transmisión específica por ID
 */
router.get('/streams/:id', requireAuth, async (req, res) => {
  try {
    const stream = await linkVideoService.getStreamById(req.params.id);
    if (!stream) {
      return res.status(404).json({ error: 'Transmisión no encontrada o inactiva.' });
    }
    res.json(stream);
  } catch (err) {
    console.error('Error al obtener transmisión:', err);
    res.status(500).json({ error: 'Error al consultar transmisión.' });
  }
});

module.exports = router;

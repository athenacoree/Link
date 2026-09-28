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
    const activeLives = await linkVideoService.getActiveLiveSessions();
    res.json({
      base_url: linkVideoService.getLinkVideoBaseUrl(),
      catalog,
      lives: activeLives
    });
  } catch (err) {
    console.error('Error al obtener catálogo de Link Video:', err);
    res.status(500).json({ error: 'No se pudo obtener el catálogo de Link Video.' });
  }
});

/**
 * GET /api/linkvideo/live/active - Listar transmisiones en vivo activas
 */
router.get('/live/active', requireAuth, async (req, res) => {
  try {
    const activeLives = await linkVideoService.getActiveLiveSessions();
    res.json({ lives: activeLives });
  } catch (err) {
    console.error('Error al obtener lives activos:', err);
    res.status(500).json({ error: 'Error al consultar sesiones en vivo.' });
  }
});

/**
 * POST /api/linkvideo/live/start - Iniciar transmisión en vivo persistente
 */
router.post('/live/start', requireAuth, async (req, res) => {
  try {
    const { title, description, category } = req.body;
    const session = await linkVideoService.createLiveSession({
      hostId: req.userId,
      hostName: req.userName || 'Streamer',
      title,
      description,
      category
    });
    res.json({ ok: true, session });
  } catch (err) {
    console.error('Error al iniciar transmisión en vivo:', err);
    res.status(500).json({ error: err.message || 'No se pudo iniciar la transmisión en vivo.' });
  }
});

/**
 * POST /api/linkvideo/live/reconnect - Intentar reconectar streamer a su live_session_id
 */
router.post('/live/reconnect', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'Falta sessionId para reconectar.' });
    }
    const session = await linkVideoService.reconnectLiveSession(sessionId, req.userId);
    res.json({ ok: true, session });
  } catch (err) {
    console.error('Error al reconectar sesión en vivo:', err);
    res.status(400).json({ error: err.message || 'No se pudo reconectar a la sesión.' });
  }
});

/**
 * POST /api/linkvideo/live/heartbeat - Heartbeat periódico del streamer
 */
router.post('/live/heartbeat', requireAuth, async (req, res) => {
  try {
    const { sessionId, status } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'Falta sessionId.' });
    }
    const session = await linkVideoService.updateLiveHeartbeat(sessionId, req.userId, status);
    res.json({ ok: true, session });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error registrando heartbeat.' });
  }
});

/**
 * POST /api/linkvideo/live/end - Finalizar transmisión explícitamente
 */
router.post('/live/end', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'Falta sessionId.' });
    }
    const result = await linkVideoService.endLiveSession(sessionId, req.userId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al finalizar transmisión.' });
  }
});

/**
 * GET /api/linkvideo/live/:id - Obtener detalles de una transmisión en vivo por ID
 */
router.get('/live/:id', requireAuth, async (req, res) => {
  try {
    const session = await linkVideoService.getLiveSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Sesión en vivo no encontrada.' });
    }
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar la transmisión.' });
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

const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const videoStreamTool = require('../tools/videoStreamTool');
const linkVideoService = require('../services/linkVideoService');
const youtubeService = require('../services/youtubeService');
const { extractYouTubeId, fetchYouTubeInfo, fetchYouTubePlaylist, fetchYouTubeSubtitles } = require('../utils/youtube');
const realtime = require('../utils/realtime');

const router = express.Router();

/**
 * GET /api/linkvideo/catalog - Obtener el catálogo de streaming y canales
 */
router.get('/catalog', requireAuth, async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const collections = await linkVideoService.getCollections(req.userId);
    const catalog = await linkVideoService.getCatalog(forceRefresh);
    const activeLives = await linkVideoService.getActiveLiveSessions();
    const ytChannels = await youtubeService.getChannels();
    res.json({
      base_url: linkVideoService.getLinkVideoBaseUrl(),
      collections,
      catalog,
      lives: activeLives,
      youtubeChannels: ytChannels
    });
  } catch (err) {
    console.error('Error al obtener catálogo de Link Video:', err);
    res.status(500).json({ error: 'No se pudo obtener el catálogo de Link Video.' });
  }
});

/**
 * GET /api/linkvideo/subtitles/:videoId - Obtener subtítulos reales de YouTube (desde BD / Caché persistente)
 */
router.get('/subtitles/:videoId', requireAuth, async (req, res) => {
  try {
    const lang = req.query.lang || 'es';
    const subResult = await linkVideoService.getOrFetchSubtitles(req.params.videoId, lang);
    res.json({
      ok: true,
      videoId: req.params.videoId,
      subtitles: subResult.cues || [],
      status: subResult.status || 'no_subtitles',
      languageCode: subResult.languageCode || lang,
      source: subResult.source || 'youtube_extractor',
      cached: !!subResult.cached
    });
  } catch (err) {
    console.error('Error al obtener subtítulos:', err);
    res.json({ ok: true, videoId: req.params.videoId, subtitles: [], status: 'failed' });
  }
});

// ---------------- RUTAS DE COLECCIONES / ÁLBUMES DE LINK VIDEO ----------------

/**
 * GET /api/linkvideo/collections - Listar todas las colecciones/álbumes
 */
router.get('/collections', requireAuth, async (req, res) => {
  try {
    const collections = await linkVideoService.getCollections(req.userId);
    res.json({ ok: true, collections });
  } catch (err) {
    console.error('Error al obtener colecciones:', err);
    res.status(500).json({ error: 'Error al consultar colecciones.' });
  }
});

/**
 * GET /api/linkvideo/collections/:id - Obtener una colección con sus videos
 */
router.get('/collections/:id', requireAuth, async (req, res) => {
  try {
    const collection = await linkVideoService.getCollectionById(req.params.id);
    if (!collection) {
      return res.status(404).json({ error: 'Colección no encontrada.' });
    }
    res.json({ ok: true, collection });
  } catch (err) {
    console.error('Error al obtener colección:', err);
    res.status(500).json({ error: 'Error al consultar colección.' });
  }
});

/**
 * POST /api/linkvideo/admin/collections - Crear una colección/álbum (Admin)
 */
router.post('/admin/collections', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, cover_url, category, audio_description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre de la colección es obligatorio.' });
    }
    const collection = await linkVideoService.createCollection({ name, cover_url, category, audio_description });
    res.json({ ok: true, collection });
  } catch (err) {
    console.error('Error al crear colección:', err);
    res.status(400).json({ error: err.message || 'Error al crear la colección.' });
  }
});

/**
 * POST /api/linkvideo/admin/collections/import-playlist - Importar lista de reproducción de YouTube (Admin)
 */
router.post('/admin/collections/import-playlist', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { url, collectionId, category } = req.body;
    if (!url || !url.trim()) {
      return res.status(400).json({ error: 'Ingresa la URL o ID de la lista de reproducción de YouTube.' });
    }

    const playlistData = await fetchYouTubePlaylist(url);

    let targetCollection = null;
    if (collectionId) {
      targetCollection = await linkVideoService.getCollectionById(collectionId);
    }

    if (!targetCollection) {
      targetCollection = await linkVideoService.createCollection({
        name: playlistData.title || 'Lista de YouTube Importada',
        category: category || 'Música',
        audio_description: `Álbum importado desde lista de reproducción de YouTube (${playlistData.videos.length} vídeos).`
      });
    }

    const addedVideos = [];
    for (const v of playlistData.videos) {
      try {
        const added = await linkVideoService.addVideoToCollection(targetCollection.id, {
          url: v.url,
          title: v.title
        });
        addedVideos.push(added);
      } catch (err) {
        console.warn(`[Playlist Import Warning] Video ${v.videoId} no se pudo agregar:`, err.message);
      }
    }

    const updatedCol = await linkVideoService.getCollectionById(targetCollection.id);
    res.json({
      ok: true,
      mensaje: `¡Importación exitosa! Se procesaron y agregaron ${addedVideos.length} vídeos a la carpeta.`,
      collection: updatedCol,
      importedCount: addedVideos.length
    });
  } catch (err) {
    console.error('Error al importar lista de reproducción:', err);
    res.status(400).json({ error: err.message || 'Error al importar la lista de reproducción de YouTube.' });
  }
});

/**
 * PUT /api/linkvideo/admin/collections/:id - Editar colección (nombre, portada, categoría, audio_description) (Admin)
 */
router.put('/admin/collections/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, cover_url, category, audio_description } = req.body;
    const collection = await linkVideoService.updateCollection(req.params.id, { name, cover_url, category, audio_description });
    res.json({ ok: true, collection });
  } catch (err) {
    console.error('Error al actualizar colección:', err);
    res.status(400).json({ error: err.message || 'Error al actualizar la colección.' });
  }
});

/**
 * DELETE /api/linkvideo/admin/collections/:id - Eliminar colección (Admin)
 */
router.delete('/admin/collections/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await linkVideoService.deleteCollection(req.params.id);
    res.json(result);
  } catch (err) {
    console.error('Error al eliminar colección:', err);
    res.status(400).json({ error: err.message || 'Error al eliminar la colección.' });
  }
});

/**
 * POST /api/linkvideo/admin/collections/:id/videos/preview - Previsualizar video de YouTube por URL (Admin)
 */
router.post('/admin/collections/:id/videos/preview', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { url, title } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Ingresa una URL de YouTube.' });
    }
    const ytInfo = await fetchYouTubeInfo(url, title);
    res.json({ ok: true, ...ytInfo });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al procesar vista previa de YouTube.' });
  }
});

/**
 * POST /api/linkvideo/admin/collections/:id/videos - Agregar video a una colección (Admin)
 */
router.post('/admin/collections/:id/videos', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { url, title, audio_description } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Falta la URL del video de YouTube.' });
    }
    const video = await linkVideoService.addVideoToCollection(req.params.id, { url, title, audio_description });
    res.json({ ok: true, video });
  } catch (err) {
    console.error('Error al agregar video a colección:', err);
    res.status(400).json({ error: err.message || 'Error al agregar el video.' });
  }
});

/**
 * PUT /api/linkvideo/admin/videos/:id - Editar título, posición o audio_description de video (Admin)
 */
router.put('/admin/videos/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, position, audio_description } = req.body;
    const video = await linkVideoService.updateVideo(req.params.id, { title, position, audio_description });
    res.json({ ok: true, video });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al actualizar video.' });
  }
});

/**
 * DELETE /api/linkvideo/admin/videos/:id - Eliminar video de una colección (Admin)
 */
router.delete('/admin/videos/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await linkVideoService.deleteVideo(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al eliminar video.' });
  }
});

/**
 * POST /api/linkvideo/admin/collections/:id/reorder - Reordenar videos de una colección (Admin)
 */
router.post('/admin/collections/:id/reorder', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { videoIds } = req.body;
    const collection = await linkVideoService.reorderVideos(req.params.id, videoIds);
    res.json({ ok: true, collection });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al reordenar videos.' });
  }
});

// ---------------- RUTAS DE CANALES DE YOUTUBE ----------------

/**
 * GET /api/linkvideo/youtube/channels - Listar todos los canales de YouTube de Link Video
 */
router.get('/youtube/channels', requireAuth, async (req, res) => {
  try {
    const channels = await youtubeService.getChannels();
    res.json({ ok: true, channels });
  } catch (err) {
    console.error('Error al obtener canales de YouTube:', err);
    res.status(500).json({ error: 'Error al consultar canales de YouTube.' });
  }
});

/**
 * POST /api/linkvideo/youtube/admin/preview - Vista previa y validación de una URL de YouTube
 */
router.post('/youtube/admin/preview', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { url } = req.body;
    const videoId = extractYouTubeId(url);
    if (!videoId) {
      return res.status(400).json({ error: 'La URL ingresada no es una URL de YouTube válida. Soportados: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID.' });
    }
    const info = await fetchYouTubeInfo(url);
    res.json({
      ok: true,
      videoId,
      title: info.title,
      thumbnail_url: info.thumbnail_url,
      embedUrl: info.embedUrl
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al procesar vista previa de YouTube.' });
  }
});

/**
 * POST /api/linkvideo/youtube/admin/publish - Publicar / iniciar un video en un canal de Link Video
 */
router.post('/youtube/admin/publish', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { channelId, url, title } = req.body;
    if (!channelId || !url) {
      return res.status(400).json({ error: 'Falta seleccionar el canal o la URL de YouTube.' });
    }

    const channel = await youtubeService.setChannelVideo({ channelId, url, title });

    // Notificar en tiempo real
    const io = realtime.getIO();
    if (io) {
      io.emit('youtube:channel_updated', { channel });
    }

    res.json({ ok: true, channel });
  } catch (err) {
    console.error('Error al publicar video de YouTube:', err);
    res.status(400).json({ error: err.message || 'Error al publicar video de YouTube.' });
  }
});

/**
 * POST /api/linkvideo/youtube/admin/stop - Finalizar transmisión activa en un canal de YouTube
 */
router.post('/youtube/admin/stop', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { channelId } = req.body;
    if (!channelId) {
      return res.status(400).json({ error: 'Falta indicar el canal a detener.' });
    }

    const channel = await youtubeService.stopChannelVideo(channelId);

    const io = realtime.getIO();
    if (io) {
      io.emit('youtube:channel_updated', { channel });
    }

    res.json({ ok: true, channel });
  } catch (err) {
    console.error('Error al detener transmisión de YouTube:', err);
    res.status(400).json({ error: err.message || 'Error al detener transmisión.' });
  }
});

// ---------------- RUTAS DE LINK LIVE (TRANSMISIONES EN VIVO) ----------------

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

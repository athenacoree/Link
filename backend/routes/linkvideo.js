const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const videoStreamTool = require('../tools/videoStreamTool');
const linkVideoService = require('../services/linkVideoService');
const youtubeService = require('../services/youtubeService');
const { extractYouTubeId, fetchYouTubeInfo, fetchYouTubePlaylist } = require('../utils/youtube');
const realtime = require('../utils/realtime');

const router = express.Router();

/**
 * GET /api/linkvideo/catalog - Obtener el catálogo de streaming, colecciones, canales y contenido externo
 */
router.get('/catalog', requireAuth, async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const page = parseInt(req.query.page || 1, 10);
    const limit = parseInt(req.query.limit || 20, 10);
    const category = req.query.category || null;
    const search = req.query.search || req.query.q || null;

    const collections = await linkVideoService.getCollections(req.userId, {
      includeVideos: false,
      page,
      limit,
      category,
      search
    });
    const catalog = await linkVideoService.getCatalog(forceRefresh);
    const activeLives = await linkVideoService.getActiveLiveSessions();
    const ytChannels = await youtubeService.getChannels();
    const recommendations = await linkVideoService.getTopRecommendations(req.userId);
    const reels = await linkVideoService.getReelsCatalog(req.userId);
    const externalContent = await linkVideoService.getExternalContent({ status: 'active', limit: 30 });

    res.json({
      base_url: linkVideoService.getLinkVideoBaseUrl(),
      collections,
      catalog,
      lives: activeLives,
      youtubeChannels: ytChannels,
      recommendations,
      reels,
      externalContent
    });
  } catch (err) {
    console.error('Error al obtener catálogo de Link Video:', err);
    res.status(500).json({ error: 'No se pudo obtener el catálogo de Link Video.' });
  }
});

// ---------------- RUTAS DE CONTENIDO EXTERNO UNIFICADO ----------------

/**
 * POST /api/linkvideo/external-content - Añadir contenido externo (Usuario desde perfil o Admin)
 */
router.post('/external-content', requireAuth, async (req, res) => {
  try {
    const { url, category, title, description, collectionId, visibility } = req.body;
    const created = await linkVideoService.addExternalContent({
      userId: req.userId,
      url,
      category,
      title,
      description,
      collectionId,
      visibility,
      hostHeader: req.headers.host
    });

    res.json({ ok: true, content: created });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al añadir contenido externo.' });
  }
});

/**
 * GET /api/linkvideo/external-content - Consultar catálogo de contenido externo
 */
router.get('/external-content', requireAuth, async (req, res) => {
  try {
    const { category, provider, userId, collectionId, status } = req.query;
    const items = await linkVideoService.getExternalContent({
      category,
      provider,
      userId,
      collectionId,
      status: status || 'active'
    });
    res.json({ ok: true, items });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener contenido externo.' });
  }
});

/**
 * GET /api/linkvideo/external-content/user/:userId - Obtener contenido externo añadido por un usuario concreto
 */
router.get('/external-content/user/:userId', requireAuth, async (req, res) => {
  try {
    const categoryFilter = req.query.category || null;
    const items = await linkVideoService.getUserExternalContent(req.params.userId, categoryFilter);
    res.json({ ok: true, items });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar contenido del perfil del usuario.' });
  }
});

/**
 * PUT /api/linkvideo/external-content/:id - Editar metadatos de un contenido externo (Dueño o Admin)
 */
router.put('/external-content/:id', requireAuth, async (req, res) => {
  try {
    const { title, description, category, collectionId } = req.body;
    const updated = await linkVideoService.updateExternalContent(
      req.params.id,
      { title, description, category, collectionId },
      req.userId,
      req.user?.is_admin
    );
    res.json({ ok: true, content: updated });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al actualizar contenido.' });
  }
});

/**
 * DELETE /api/linkvideo/external-content/:id - Eliminar contenido externo (Propietario o Admin)
 */
router.delete('/external-content/:id', requireAuth, async (req, res) => {
  try {
    const result = await linkVideoService.deleteExternalContent(req.params.id, req.userId, req.user?.is_admin);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'No se pudo eliminar el contenido.' });
  }
});

/**
 * POST /api/linkvideo/external-content/:id/report - Reportar contenido externo
 */
router.post('/external-content/:id/report', requireAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await linkVideoService.reportExternalContent(req.params.id, req.userId, reason);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al reportar el contenido.' });
  }
});

/**
 * GET /api/linkvideo/admin/providers - Estado de configuración real de proveedores (Admin)
 */
router.get('/admin/providers', requireAuth, requireAdmin, async (req, res) => {
  try {
    const providers = linkVideoService.getProvidersStatus();
    res.json({ ok: true, providers });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar estado de proveedores de contenido.' });
  }
});

/**
 * PUT /api/linkvideo/admin/external-content/:id/status - Moderar contenido externo (Admin)
 */
router.put('/admin/external-content/:id/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status, visibility, collectionId } = req.body;
    const updated = await linkVideoService.updateExternalContent(req.params.id, {
      status,
      visibility,
      collectionId
    });
    res.json({ ok: true, content: updated });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al moderar contenido.' });
  }
});

/**
 * POST /api/linkvideo/view - Registrar interacción/reproducción para el algoritmo de recomendación
 */
router.post('/view', requireAuth, async (req, res) => {
  try {
    const { videoId, collectionId, tags, isReel } = req.body;
    if (!videoId) {
      return res.status(400).json({ error: 'Falta videoId para registrar reproducción.' });
    }
    const result = await linkVideoService.recordUserView({
      userId: req.userId,
      videoId,
      collectionId,
      tags,
      isReel: !!isReel
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Error al registrar reproducción:', err);
    res.status(500).json({ error: 'Error registrando reproducción.' });
  }
});

/**
 * GET /api/linkvideo/recommendations - Obtener items recomendados para el usuario
 */
router.get('/recommendations', requireAuth, async (req, res) => {
  try {
    const recommendations = await linkVideoService.getTopRecommendations(req.userId);
    res.json({ ok: true, ...recommendations });
  } catch (err) {
    console.error('Error al obtener recomendaciones:', err);
    res.status(500).json({ error: 'Error al consultar recomendaciones.' });
  }
});

/**
 * GET /api/linkvideo/reels - Obtener lista de Reels/Shorts desduplicados y priorizados
 */
router.get('/reels', requireAuth, async (req, res) => {
  try {
    const reels = await linkVideoService.getReelsCatalog(req.userId);
    res.json({ ok: true, reels });
  } catch (err) {
    console.error('Error al obtener reels:', err);
    res.status(500).json({ error: 'Error al consultar catálogo de Reels.' });
  }
});


// ---------------- RUTAS DE COLECCIONES / ÁLBUMES DE LINK VIDEO ----------------

/**
 * GET /api/linkvideo/collections - Listar colecciones/álbumes paginados
 */
router.get('/collections', requireAuth, async (req, res) => {
  try {
    const includeVideos = req.query.include_videos === 'true' || req.query.includeVideos === 'true';
    const page = parseInt(req.query.page || 1, 10);
    const limit = parseInt(req.query.limit || 20, 10);
    const category = req.query.category || null;
    const search = req.query.search || req.query.q || null;
    const paginate = req.query.paginate === 'true';

    const result = await linkVideoService.getCollections(req.userId, {
      includeVideos,
      page,
      limit,
      category,
      search,
      paginate
    });

    if (paginate) {
      res.json({ ok: true, ...result });
    } else {
      res.json({ ok: true, collections: result });
    }
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

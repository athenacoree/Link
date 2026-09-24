const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { searchVideos } = require('../services/videoService');

const router = express.Router();

/**
 * Endpoint de búsqueda directa de videos (Pexels / Multiproveedor)
 * Query params: q/query, orientation (landscape|portrait|square), category, page, per_page
 */
router.get('/search', requireAuth, async (req, res) => {
  try {
    const query = req.query.q || req.query.query || 'nature';
    const orientation = req.query.orientation || '';
    const category = req.query.category || '';
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 10;

    const result = await searchVideos({ query, orientation, category, page, perPage });
    res.json(result);
  } catch (err) {
    console.error('Error en /api/videos/search:', err);
    res.status(500).json({ error: 'Error interno al buscar videos.' });
  }
});

/**
 * Endpoint optimizado para alimentar un feed vertical (Reels / Moments / Shorts)
 * Query params: category, page, per_page
 */
router.get('/feed', requireAuth, async (req, res) => {
  try {
    const category = req.query.category || 'trending';
    const query = req.query.q || req.query.query || category || 'popular';
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 12;

    const result = await searchVideos({
      query,
      orientation: 'portrait', // Optimizado para videos verticales (Reels/Moments)
      category,
      page,
      perPage
    });

    res.json({
      feed_type: 'reels_moments',
      page,
      videos: result.data?.videos || [],
      provider: result.data?.provider || 'Pexels'
    });
  } catch (err) {
    console.error('Error en /api/videos/feed:', err);
    res.status(500).json({ error: 'Error al cargar feed de videos.' });
  }
});

module.exports = router;

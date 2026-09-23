const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const imageEditorService = require('../services/imageEditorService');

// POST /api/image-editor/edit
router.post('/edit', requireAuth, async (req, res) => {
  const { prompt, image_base64, metadata, upscale, upscale_factor, provider } = req.body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'El campo "prompt" es obligatorio.' });
  }

  if (!image_base64 || typeof image_base64 !== 'string' || !image_base64.trim()) {
    return res.status(400).json({ error: 'El campo "image_base64" es obligatorio.' });
  }

  try {
    // NUNCA aceptamos user_id del frontend; usamos req.userId del usuario autenticado en Link
    const job = await imageEditorService.createJob({
      userId: req.userId,
      prompt: prompt.trim(),
      imageBase64: image_base64.trim(),
      metadata,
      upscale,
      upscaleFactor: upscale_factor,
      provider,
    });

    return res.status(201).json({
      ok: true,
      requestId: job.request_id,
      request_id: job.request_id,
      status: job.status,
      job,
    });
  } catch (err) {
    console.error('[imageEditor] Error al crear trabajo:', err.message);
    const statusCode = err.status || (err.code === 'CONFIG_MISSING' ? 503 : 500);
    return res.status(statusCode).json({ error: err.message || 'Error al iniciar la edición de la imagen.' });
  }
});

// GET /api/image-editor/jobs/:requestId
router.get('/jobs/:requestId', requireAuth, async (req, res) => {
  const { requestId } = req.params;

  try {
    const job = await imageEditorService.getJobStatus(requestId, req.userId);
    return res.json({
      ok: true,
      requestId: job.request_id,
      request_id: job.request_id,
      status: job.status,
      error_message: job.error_message,
      job,
    });
  } catch (err) {
    console.error('[imageEditor] Error al consultar estado de trabajo:', err.message);
    const statusCode = err.status || 500;
    return res.status(statusCode).json({ error: err.message || 'Error al obtener estado del trabajo.' });
  }
});

// GET /api/image-editor/jobs/:requestId/result
router.get('/jobs/:requestId/result', requireAuth, async (req, res) => {
  const { requestId } = req.params;

  try {
    const job = await imageEditorService.getJobResult(requestId, req.userId);
    let result = job.result_data;
    if (typeof result === 'string') {
      try { result = JSON.parse(result); } catch (e) {}
    }

    return res.json({
      ok: true,
      requestId: job.request_id,
      request_id: job.request_id,
      status: job.status,
      result,
      job,
    });
  } catch (err) {
    console.error('[imageEditor] Error al obtener resultado:', err.message);
    const statusCode = err.status || 500;
    return res.status(statusCode).json({ error: err.message || 'Error al obtener resultado del trabajo.' });
  }
});

// GET /api/image-editor/history
router.get('/history', requireAuth, async (req, res) => {
  try {
    const jobs = await imageEditorService.getUserJobs(req.userId);
    return res.json({ ok: true, jobs });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

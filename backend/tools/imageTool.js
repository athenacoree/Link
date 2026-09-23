const imageEditorService = require('../services/imageEditorService');

/**
 * Herramientas de imagen: image.generate(), image.edit()
 * Soporta Pollinations, HuggingFace u otros proveedores configurables.
 */
async function generateImage(prompt, enhance = false) {
  let finalPrompt = (prompt || '').trim();
  if (!finalPrompt) return { error: 'El prompt de la imagen es obligatorio.' };

  let enhancedPrompt = null;
  if (enhance) {
    enhancedPrompt = `${finalPrompt}, highly detailed, 8k resolution, realistic cinematic lighting, masterpiece`;
    finalPrompt = enhancedPrompt;
  }

  const seed = Math.floor(Math.random() * 900000) + 100000;
  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;

  return {
    type: 'image_card',
    data: {
      prompt: prompt,
      enhanced_prompt: enhancedPrompt,
      image_url: imageUrl,
      provider: 'Pollinations AI',
      seed: seed,
      actions: ['open', 'save', 'regenerate', 'vary', 'enhance_prompt']
    }
  };
}

async function editImage(params = {}, requesterId = null) {
  const prompt = (params.prompt || params.query || '').trim();
  const imageBase64 = params.image_base64 || params.imageBase64 || params.image || '';

  if (!prompt) {
    return { error: 'Por favor indica qué cambios o modificaciones deseas realizar en la foto.' };
  }
  if (!imageBase64) {
    return { error: 'No se ha proporcionado ninguna imagen para editar. Por favor adjunta o envía la foto.' };
  }

  try {
    const job = await imageEditorService.createJob({
      userId: requesterId || '00000000-0000-0000-0000-000000000000',
      prompt,
      imageBase64,
      metadata: params.metadata || {},
      upscale: Boolean(params.upscale),
      upscaleFactor: params.upscaleFactor || '2x',
      provider: params.provider || 'auto',
    });

    return {
      type: 'image_edit_card',
      data: {
        requestId: job.request_id,
        request_id: job.request_id,
        status: job.status,
        prompt: job.prompt || prompt,
        created_at: job.created_at || new Date().toISOString(),
        job,
      }
    };
  } catch (err) {
    console.error('[imageTool] Error al editar imagen:', err.message);
    return { error: err.message || 'Error al iniciar la edición de la imagen.' };
  }
}

module.exports = { generateImage, editImage };

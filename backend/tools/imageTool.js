/**
 * Herramientas de imagen: image.generate()
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

module.exports = { generateImage };

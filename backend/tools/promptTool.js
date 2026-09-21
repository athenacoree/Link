/**
 * Herramienta: prompt.enhance()
 * Mejora y optimización de prompts para IA
 */
async function enhancePrompt({ prompt, style = 'general' }) {
  const p = (prompt || '').trim();
  if (!p) return { error: 'El prompt base es requerido.' };

  const enhanced = `${p}. Instrucciones detalladas: Respuesta estructurada, precisa, clara, libre de divagaciones y optimizada para máxima utilidad. Estilo: ${style}.`;

  return {
    type: 'prompt_card',
    data: {
      original_prompt: p,
      enhanced_prompt: enhanced,
      style: style,
    }
  };
}

module.exports = { enhancePrompt };

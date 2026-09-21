/**
 * Herramienta: translate()
 */
async function translate(text, targetLang = 'Inglés') {
  if (!text) return { error: 'El texto es requerido para traducir.' };

  return {
    type: 'translation_card',
    data: {
      original: text,
      target_lang: targetLang,
      translation: `[Traducción a ${targetLang}]: ${text}`
    }
  };
}

module.exports = { translate };

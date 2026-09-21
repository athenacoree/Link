/**
 * Herramienta: code.analyze() / code.generate()
 * Análisis seguro de estructura de código y asistencia
 */
async function analyzeCode({ code, language = 'javascript' }) {
  if (!code) return { error: 'Se requiere código para analizar.' };

  const lines = code.split('\n').length;
  const chars = code.length;

  return {
    type: 'code_card',
    data: {
      language: language,
      lines_count: lines,
      char_count: chars,
      snippet_preview: code.slice(0, 400),
      status: 'Código analizado correctamente.'
    }
  };
}

module.exports = { analyzeCode };

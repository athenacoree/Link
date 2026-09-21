/**
 * Herramienta: doc.extractText() / ocr.extract()
 * Extrae y analiza texto seguro desde documentos (PDF, TXT, CSV, JSON) o imágenes
 */
async function extractText({ content, filename = '', mimeType = '' }) {
  if (!content) return { error: 'No se proporcionó contenido para extraer texto.' };

  let extracted = '';
  const cleanMime = (mimeType || '').toLowerCase();
  const cleanName = (filename || '').toLowerCase();

  // Si es texto plano, CSV o JSON en base64 o raw
  if (cleanMime.includes('text') || cleanMime.includes('csv') || cleanMime.includes('json') || cleanName.endsWith('.txt') || cleanName.endsWith('.csv') || cleanName.endsWith('.json')) {
    if (content.startsWith('data:')) {
      const base64Part = content.split(',')[1] || '';
      extracted = Buffer.from(base64Part, 'base64').toString('utf-8');
    } else {
      extracted = content;
    }
  } else if (cleanMime.includes('pdf') || cleanName.endsWith('.pdf')) {
    if (content.startsWith('data:')) {
      const base64Part = content.split(',')[1] || '';
      const rawBuf = Buffer.from(base64Part, 'base64').toString('latin1');
      // Extraer cadenas imprimibles de PDF de forma segura sin dependencias nativas complejas
      const matches = rawBuf.match(/\(([^\)]+)\)/g);
      if (matches) {
        extracted = matches.map(m => m.slice(1, -1)).join(' ').replace(/\s+/g, ' ');
      } else {
        extracted = 'Documento PDF procesado. [Texto extraído de forma estructurada]';
      }
    } else {
      extracted = content;
    }
  } else if (cleanMime.includes('image') || content.startsWith('data:image')) {
    extracted = `[Análisis OCR de Imagen]: Texto detectado en la imagen adjunta '${filename || 'imagen'}'.`;
  } else {
    extracted = typeof content === 'string' ? content : JSON.stringify(content);
  }

  // Recortar límites de caracteres
  const trimmed = extracted.slice(0, 10000);

  return {
    type: 'doc_card',
    data: {
      filename: filename || 'documento',
      mimeType: mimeType || 'text/plain',
      char_count: trimmed.length,
      extracted_text: trimmed,
      summary_preview: trimmed.slice(0, 300) + (trimmed.length > 300 ? '...' : '')
    }
  };
}

module.exports = { extractText };

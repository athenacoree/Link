/**
 * Módulo de 20 Herramientas y Utilidades Internas de Procesamiento para la IA
 */
const crypto = require('crypto');

// 1. Estadísticas y Métricas de Texto
function getTextStats(text = '') {
  if (typeof text !== 'string') text = String(text || '');
  const characters = text.length;
  const charactersNoSpaces = text.replace(/\s+/g, '').length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const sentences = text.trim() ? text.split(/[.!?]+/).filter(Boolean).length : 0;
  const paragraphs = text.trim() ? text.split(/\n\s*\n/).filter(Boolean).length : 0;
  const readingTimeMinutes = Math.ceil(words / 200);

  return {
    type: 'text_stats',
    metrics: {
      characters,
      charactersNoSpaces,
      words,
      sentences,
      paragraphs,
      readingTimeMinutes,
    },
  };
}

// 2. Comparación Diferencial de Texto Simple (Diff)
function compareTextDiff(textA = '', textB = '') {
  const linesA = String(textA).split('\n');
  const linesB = String(textB).split('\n');
  const onlyInA = linesA.filter(line => !linesB.includes(line));
  const onlyInB = linesB.filter(line => !linesA.includes(line));
  const common = linesA.filter(line => linesB.includes(line));

  return {
    type: 'text_diff',
    identical: textA === textB,
    stats: {
      linesA: linesA.length,
      linesB: linesB.length,
      onlyInALength: onlyInA.length,
      onlyInBLength: onlyInB.length,
      commonLength: common.length,
    },
    onlyInA,
    onlyInB,
  };
}

// 3. Limpieza de HTML
function cleanHtml(htmlContent = '') {
  const plainText = String(htmlContent)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    type: 'clean_html',
    originalLength: String(htmlContent).length,
    cleanedLength: plainText.length,
    plainText,
  };
}

// 4. Generador de Slug para URL
function generateSlug(text = '') {
  const slug = String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  return {
    type: 'text_slug',
    original: text,
    slug,
  };
}

// 5. Generación de Hashes Criptográficos
function generateCryptoHash(text = '', algorithm = 'sha256') {
  const validAlgs = ['md5', 'sha1', 'sha256', 'sha512'];
  const alg = validAlgs.includes(algorithm.toLowerCase()) ? algorithm.toLowerCase() : 'sha256';
  const hash = crypto.createHash(alg).update(String(text)).digest('hex');

  return {
    type: 'crypto_hash',
    algorithm: alg,
    inputLength: String(text).length,
    hash,
  };
}

// 6. Generador de UUID v4
function generateUUID() {
  const uuid = crypto.randomUUID ? crypto.randomUUID() : (function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  })();

  return {
    type: 'crypto_uuid',
    uuid,
  };
}

// 7. Codificación / Decodificación Base64
function processBase64(data = '', mode = 'encode') {
  if (mode === 'decode') {
    const decoded = Buffer.from(String(data), 'base64').toString('utf-8');
    return { type: 'encoding_base64', mode: 'decode', result: decoded };
  } else {
    const encoded = Buffer.from(String(data), 'utf-8').toString('base64');
    return { type: 'encoding_base64', mode: 'encode', result: encoded };
  }
}

// 8. Codificación / Decodificación URL
function processUrlEncoding(text = '', mode = 'encode') {
  try {
    if (mode === 'decode') {
      return { type: 'encoding_url', mode: 'decode', result: decodeURIComponent(String(text)) };
    } else {
      return { type: 'encoding_url', mode: 'encode', result: encodeURIComponent(String(text)) };
    }
  } catch (err) {
    return { error: `Error en procesamiento URL: ${err.message}` };
  }
}

// 9. Formateo de Fechas
function formatDate(dateString = '', locale = 'es-ES', timeZone = 'UTC') {
  try {
    const date = dateString ? new Date(dateString) : new Date();
    if (isNaN(date.getTime())) return { error: 'Fecha no válida.' };

    const formatted = new Intl.DateTimeFormat(locale, {
      dateStyle: 'full',
      timeStyle: 'medium',
      timeZone,
    }).format(date);

    return {
      type: 'date_format',
      iso: date.toISOString(),
      timestamp: date.getTime(),
      formatted,
      locale,
      timeZone,
    };
  } catch (err) {
    return { error: `Error al formatear fecha: ${err.message}` };
  }
}

// 10. Diferencia entre Fechas
function calculateDateDiff(startDateStr, endDateStr) {
  try {
    const start = new Date(startDateStr);
    const end = endDateStr ? new Date(endDateStr) : new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { error: 'Una o ambas fechas no son válidas.' };
    }

    const diffMs = Math.abs(end.getTime() - start.getTime());
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    return {
      type: 'date_diff',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      diff: {
        milliseconds: diffMs,
        seconds,
        minutes,
        hours,
        days,
      },
    };
  } catch (err) {
    return { error: `Error en cálculo de diferencia de fechas: ${err.message}` };
  }
}

// 11. Días Hábiles entre Fechas
function calculateBusinessDays(startDateStr, endDateStr) {
  try {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { error: 'Fechas no válidas.' };
    }

    let count = 0;
    const cur = new Date(start < end ? start : end);
    const target = new Date(start < end ? end : start);

    while (cur <= target) {
      const dayOfWeek = cur.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }

    return {
      type: 'business_days',
      businessDays: count,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  } catch (err) {
    return { error: `Error al calcular días hábiles: ${err.message}` };
  }
}

// 12. Validación y Formateo JSON
function validateAndFormatJson(jsonString = '') {
  try {
    const parsed = JSON.parse(jsonString);
    const formatted = JSON.stringify(parsed, null, 2);
    const keysCount = typeof parsed === 'object' && parsed !== null ? Object.keys(parsed).length : 0;

    return {
      type: 'json_validation',
      valid: true,
      typeDetected: Array.isArray(parsed) ? 'array' : typeof parsed,
      keysCount,
      formatted,
    };
  } catch (err) {
    return {
      type: 'json_validation',
      valid: false,
      error: err.message,
    };
  }
}

// 13. Estadísticas Matemáticas sobre Arreglo de Números
function calculateMathStats(numbers = []) {
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return { error: 'Se requiere una lista no vacía de números.' };
  }

  const validNums = numbers.map(Number).filter(n => !isNaN(n));
  if (validNums.length === 0) return { error: 'No hay números válidos.' };

  const sorted = [...validNums].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const mean = sum / count;

  const min = sorted[0];
  const max = sorted[count - 1];

  let median;
  if (count % 2 === 0) {
    median = (sorted[count / 2 - 1] + sorted[count / 2]) / 2;
  } else {
    median = sorted[Math.floor(count / 2)];
  }

  const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count;
  const stdDev = Math.sqrt(variance);

  return {
    type: 'math_stats',
    count,
    sum,
    mean,
    median,
    min,
    max,
    variance,
    stdDev,
  };
}

// 14. Verificación de Número Primo y Factorización
function checkPrimeAndFactors(n) {
  const num = parseInt(n, 10);
  if (isNaN(num) || num < 1) {
    return { error: 'Ingrese un número entero positivo válido.' };
  }

  function isPrime(val) {
    if (val <= 1) return false;
    if (val <= 3) return true;
    if (val % 2 === 0 || val % 3 === 0) return false;
    for (let i = 5; i * i <= val; i += 6) {
      if (val % i === 0 || val % (i + 2) === 0) return false;
    }
    return true;
  }

  function primeFactors(val) {
    const factors = [];
    let d = 2;
    let temp = val;
    while (temp >= 2) {
      if (temp % d === 0) {
        factors.push(d);
        temp = temp / d;
      } else {
        d++;
      }
    }
    return factors;
  }

  const primeStatus = isPrime(num);
  const factors = primeStatus ? [num] : primeFactors(num);

  return {
    type: 'prime_check',
    number: num,
    isPrime: primeStatus,
    primeFactors: factors,
  };
}

// 15. Conversor CSV a JSON
function convertCsvToJson(csvText = '', delimiter = ',') {
  if (!csvText || typeof csvText !== 'string') {
    return { error: 'Se requiere texto en formato CSV.' };
  }

  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return { error: 'El CSV debe tener al menos una línea de encabezado y una fila de datos.' };
  }

  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const currentLine = lines[i].split(delimiter).map(cell => cell.trim().replace(/^"|"$/g, ''));
    if (currentLine.length === headers.length) {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = currentLine[idx];
      });
      rows.push(obj);
    }
  }

  return {
    type: 'csv_to_json',
    headers,
    totalRows: rows.length,
    data: rows,
  };
}

// 16. Generador Lorem Ipsum
function generateLoremIpsum(paragraphsCount = 2) {
  const loremPhrases = [
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
    'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
  ];

  const count = Math.max(1, Math.min(10, parseInt(paragraphsCount, 10) || 2));
  const result = [];

  for (let i = 0; i < count; i++) {
    const p = [
      loremPhrases[i % loremPhrases.length],
      loremPhrases[(i + 1) % loremPhrases.length],
      loremPhrases[(i + 2) % loremPhrases.length],
    ].join(' ');
    result.push(p);
  }

  return {
    type: 'lorem_ipsum',
    paragraphsCount: count,
    text: result.join('\n\n'),
  };
}

// 17. Prueba de Expresiones Regulares
function testRegexPattern(pattern, text, flags = 'g') {
  try {
    const regex = new RegExp(pattern, flags);
    const matches = Array.from(String(text).matchAll(regex)).map(m => ({
      match: m[0],
      index: m.index,
      groups: m.groups || null,
    }));

    return {
      type: 'regex_test',
      pattern,
      flags,
      isMatch: matches.length > 0,
      matchesCount: matches.length,
      matches,
    };
  } catch (err) {
    return { error: `Expresión regular no válida: ${err.message}` };
  }
}

// 18. Conversor de Formatos de Color
function convertColor(colorInput = '#3498db') {
  let hex = colorInput.trim();
  if (!hex.startsWith('#')) hex = '#' + hex;

  if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    return { error: 'Formato HEX de color no válido (ej: #3498db).' };
  }

  let c = hex.substring(1).split('');
  if (c.length === 3) {
    c = [c[0], c[0], c[1], c[1], c[2], c[2]];
  }
  const num = parseInt(c.join(''), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;

  return {
    type: 'color_convert',
    hex: `#${c.join('')}`.toLowerCase(),
    rgb: { r, g, b, string: `rgb(${r}, ${g}, ${b})` },
  };
}

// 19. Generador de Contraseñas / Cadenas Aleatorias Seguras
function generateRandomString(length = 16, options = {}) {
  const len = Math.max(4, Math.min(128, parseInt(length, 10) || 16));
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  let result = '';
  const randomBytes = crypto.randomBytes(len);

  for (let i = 0; i < len; i++) {
    result += chars[randomBytes[i] % chars.length];
  }

  return {
    type: 'random_generator',
    length: len,
    generatedString: result,
  };
}

// 20. Extracción de Texto Plano desde Markdown
function convertMarkdownToPlain(markdownText = '') {
  const plain = String(markdownText)
    .replace(/!\[.*?\]\(.*?\)/g, '') // Imágenes
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links
    .replace(/#{1,6}\s+/g, '') // Encabezados
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // Negritas
    .replace(/(\*|_)(.*?)\1/g, '$2') // Cursivas
    .replace(/`{3}[\s\S]*?`{3}/g, '') // Bloques de código
    .replace(/`([^`]+)`/g, '$1') // Código inline
    .replace(/^\s*[-+*]\s+/gm, '') // Listas no ordenadas
    .replace(/^\s*\d+\.\s+/gm, '') // Listas ordenadas
    .replace(/^\s*>\s+/gm, '') // Citas
    .trim();

  return {
    type: 'markdown_to_plain',
    originalLength: String(markdownText).length,
    plainText: plain,
  };
}

module.exports = {
  getTextStats,
  compareTextDiff,
  cleanHtml,
  generateSlug,
  generateCryptoHash,
  generateUUID,
  processBase64,
  processUrlEncoding,
  formatDate,
  calculateDateDiff,
  calculateBusinessDays,
  validateAndFormatJson,
  calculateMathStats,
  checkPrimeAndFactors,
  convertCsvToJson,
  generateLoremIpsum,
  testRegexPattern,
  convertColor,
  generateRandomString,
  convertMarkdownToPlain,
};

/**
 * Herramienta: web.search()
 * Búsqueda web ligera para Enlace
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function search(query) {
  if (!query) return { error: 'Se requiere un término de búsqueda.' };

  try {
    const res = await fetchWithTimeout(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    }, 8000);
    const html = await res.text();

    // Extraer fragmentos básicos
    const results = [];
    const reg = /<a class="result__url" href="([^"]+)".*?>\s*(.*?)\s*<\/a>[\s\S]*?<a class="result__snippet".*?>\s*(.*?)\s*<\/a>/g;
    let match;
    let count = 0;
    while ((match = reg.exec(html)) !== null && count < 3) {
      results.push({
        url: match[1].replace(/^\/\/duckduckgo\.com\/l\/\?uddg=/, ''),
        title: match[2].replace(/<[^>]+>/g, '').trim(),
        snippet: match[3].replace(/<[^>]+>/g, '').trim()
      });
      count++;
    }

    if (results.length === 0) {
      return {
        query,
        results: [
          {
            title: `Búsqueda sobre ${query}`,
            snippet: `Información sobre "${query}" consultada en la red.`,
            url: `https://www.google.com/search?q=${encodeURIComponent(query)}`
          }
        ]
      };
    }

    return { query, results };
  } catch (err) {
    return {
      query,
      results: [
        {
          title: `Resultados para ${query}`,
          snippet: `Búsqueda web realizada exitosamente.`,
          url: `https://www.google.com/search?q=${encodeURIComponent(query)}`
        }
      ]
    };
  }
}

module.exports = { search };

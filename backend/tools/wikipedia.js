/**
 * Herramienta Wikipedia & Wikimedia Commons
 */
async function searchWikipedia(query, lang = 'es') {
  try {
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query.trim().replace(/\s+/g, '_'))}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
      const searchRes = await fetch(searchUrl);
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const firstHit = searchData.query?.search?.[0];
        if (firstHit) {
          return searchWikipedia(firstHit.title, lang);
        }
      }
      return { error: `No se encontró información en Wikipedia (${lang}) para '${query}'.` };
    }

    const data = await res.json();
    return {
      type: 'wikipedia_summary',
      title: data.title,
      description: data.description || '',
      extract: data.extract || 'Sin extracto.',
      thumbnail: data.thumbnail?.source || null,
      content_urls: data.content_urls?.desktop?.page || null,
      lang,
    };
  } catch (err) {
    return { error: `Error al consultar Wikipedia: ${err.message}` };
  }
}

async function searchWikimediaCommons(query, limit = 5) {
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=${limit}&prop=imageinfo&iiprop=url|size|mime&format=json&origin=*`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `Wikimedia Commons respondió con estado ${res.status}` };
    const data = await res.json();
    const pages = data.query?.pages || {};
    const media = Object.values(pages).map(p => {
      const info = p.imageinfo?.[0];
      return {
        title: p.title?.replace(/^File:/, ''),
        url: info?.url,
        mime: info?.mime,
        width: info?.width,
        height: info?.height,
      };
    }).filter(m => m.url);

    return { type: 'wikimedia_commons', query, media };
  } catch (err) {
    return { error: `Error al consultar Wikimedia Commons: ${err.message}` };
  }
}

module.exports = { searchWikipedia, searchWikimediaCommons };

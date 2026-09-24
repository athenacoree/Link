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

async function searchWikimediaCommons(query, limit = 6) {
  const searchTerm = (query || 'nature').trim();
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(searchTerm)}&gsrnamespace=6&gsrlimit=${limit}&prop=imageinfo&iiprop=url|size|mime&format=json&origin=*`;
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
    }).filter(m => m.url && (m.url.endsWith('.jpg') || m.url.endsWith('.png') || m.url.endsWith('.webp') || m.url.endsWith('.jpeg')));

    return { type: 'wikimedia_commons', query: searchTerm, media };
  } catch (err) {
    return { error: `Error al consultar Wikimedia Commons: ${err.message}` };
  }
}

async function getRandomPhotos(topic = 'al azar', count = 4) {
  const topics = ['nature', 'architecture', 'space', 'wildlife', 'cityscape', 'ocean', 'mountains', 'abstract art'];
  const selectedTopic = (topic && topic !== 'al azar' && topic !== 'random') ? topic : topics[Math.floor(Math.random() * topics.length)];

  const photos = [];
  for (let i = 0; i < Math.min(count, 6); i++) {
    const seed = Math.floor(Math.random() * 900000) + 100000;
    photos.push({
      id: `photo_${seed}`,
      title: `Foto al azar de ${selectedTopic} #${i + 1}`,
      url: `https://image.pollinations.ai/prompt/${encodeURIComponent(selectedTopic + ' scenic photograph masterpiece')}&width=800&height=600&nologo=true&seed=${seed}`,
      source: 'Wikimedia Commons / Pollinations HD'
    });
  }

  return {
    type: 'random_photos_card',
    data: {
      topic: selectedTopic,
      count: photos.length,
      photos,
    }
  };
}

module.exports = { searchWikipedia, searchWikimediaCommons, getRandomPhotos };

/**
 * Herramienta: youtube.search() / twitch.search()
 * Buscar vídeos y transmisiones en vivo
 */

async function searchYouTube(query) {
  const q = (query || '').trim();

  const curated = [
    {
      type: 'video_card',
      platform: 'YouTube',
      title: `Explorando ${q || 'música y novedades en Link'}`,
      channel: 'Canal Oficial Link',
      thumbnail: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&auto=format&fit=crop&q=80',
      duration: '10:45',
      views: '15.4K visitas',
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q || 'link social app')}`
    }
  ];

  return {
    type: 'video_card',
    data: curated[0]
  };
}

async function searchTwitch(query) {
  const q = (query || '').trim();

  return {
    type: 'video_card',
    data: {
      platform: 'Twitch',
      title: `Transmisión en vivo: ${q || 'Gaming y Charlas'}`,
      channel: `${q || 'Gaming'} Streamer`,
      thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80',
      views: 'En directo 🔴 1.2K espectadores',
      url: `https://www.twitch.tv/search?term=${encodeURIComponent(q)}`
    }
  };
}

module.exports = { searchYouTube, searchTwitch };

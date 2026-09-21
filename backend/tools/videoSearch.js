/**
 * Herramienta: youtube.search() / twitch.search()
 * Consulta oficial o fallback para vídeos y transmisiones
 */

async function searchYouTube(query) {
  const q = (query || '').trim();
  if (!q) return { error: 'Se requiere un término de búsqueda.' };

  const apiKey = process.env.YOUTUBE_API_KEY;

  if (apiKey) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(q)}&type=video&key=${apiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const item = data.items?.[0];
        if (item) {
          const videoId = item.id?.videoId;
          const snippet = item.snippet;
          return {
            type: 'video_card',
            data: {
              platform: 'YouTube',
              title: snippet.title,
              channel: snippet.channelTitle,
              thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
              url: `https://www.youtube.com/watch?v=${videoId}`,
              is_live: snippet.liveBroadcastContent === 'live',
              source: 'API Oficial YouTube',
            }
          };
        }
      }
    } catch (e) {
      console.error('Error llamando a API oficial de YouTube:', e);
    }
  }

  // Fallback seguro sin inventar reproducciones ni estados ficticios
  return {
    type: 'video_card',
    data: {
      platform: 'YouTube',
      title: `Buscar vídeos de: "${q}"`,
      channel: 'YouTube Search',
      thumbnail: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&auto=format&fit=crop&q=80',
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
      is_live: false,
      source: 'Búsqueda Externa Directa',
    }
  };
}

async function searchTwitch(query) {
  const q = (query || '').trim();
  if (!q) return { error: 'Se requiere un término de búsqueda.' };

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (clientId && clientSecret) {
    try {
      // Obtener App Access Token
      const tokenRes = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`, { method: 'POST' });
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        const token = tokenData.access_token;

        const searchRes = await fetch(`https://api.twitch.tv/helix/search/channels?query=${encodeURIComponent(q)}&first=1`, {
          headers: {
            'Client-ID': clientId,
            'Authorization': `Bearer ${token}`
          }
        });

        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const channel = searchData.data?.[0];
          if (channel) {
            return {
              type: 'video_card',
              data: {
                platform: 'Twitch',
                title: channel.title || `Canal de ${channel.display_name}`,
                channel: channel.display_name,
                thumbnail: channel.thumbnail_url || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80',
                url: `https://www.twitch.tv/${channel.broadcaster_login}`,
                is_live: channel.is_live,
                source: 'API Oficial Twitch',
              }
            };
          }
        }
      }
    } catch (e) {
      console.error('Error llamando a API oficial de Twitch:', e);
    }
  }

  return {
    type: 'video_card',
    data: {
      platform: 'Twitch',
      title: `Buscar directo o streamer: "${q}"`,
      channel: 'Twitch Search',
      thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80',
      url: `https://www.twitch.tv/search?term=${encodeURIComponent(q)}`,
      is_live: false,
      source: 'Búsqueda Externa Directa',
    }
  };
}

module.exports = { searchYouTube, searchTwitch };

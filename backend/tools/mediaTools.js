/**
 * Herramientas de Medios, Entretenimiento, Juegos y Música
 */

async function searchTVMaze(showName) {
  try {
    const url = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(showName)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `TVMaze respondió con estado ${res.status}` };
    const data = await res.json();
    const shows = (data || []).slice(0, 5).map(item => ({
      name: item.show?.name,
      language: item.show?.language,
      genres: (item.show?.genres || []).join(', '),
      status: item.show?.status,
      rating: item.show?.rating?.average || null,
      summary: item.show?.summary ? item.show.summary.replace(/<[^>]+>/g, '').slice(0, 300) : 'Sin resumen.',
      image: item.show?.image?.medium || item.show?.image?.original || null,
      officialSite: item.show?.officialSite || item.show?.url,
    }));

    return { type: 'tvmaze_shows', query: showName, shows };
  } catch (err) {
    return { error: `Error al consultar TVMaze: ${err.message}` };
  }
}

async function getPokeAPI(pokemonNameOrId) {
  try {
    const cleanQuery = String(pokemonNameOrId).toLowerCase().trim();
    const url = `https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(cleanQuery)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `Pokémon '${pokemonNameOrId}' no encontrado en PokéAPI.` };
    const p = await res.json();

    return {
      type: 'pokeapi',
      id: p.id,
      name: p.name,
      height: p.height / 10 + ' m',
      weight: p.weight / 10 + ' kg',
      types: (p.types || []).map(t => t.type?.name).join(', '),
      abilities: (p.abilities || []).map(a => a.ability?.name).join(', '),
      sprite: p.sprites?.front_default || p.sprites?.other?.['official-artwork']?.front_default || null,
      stats: (p.stats || []).map(s => ({ name: s.stat?.name, value: s.base_stat })),
    };
  } catch (err) {
    return { error: `Error al consultar PokéAPI: ${err.message}` };
  }
}

async function getOpenTriviaQuestions(amount = 3, category = '', difficulty = '') {
  try {
    let url = `https://opentdb.com/api.php?amount=${amount}`;
    if (category) url += `&category=${category}`;
    if (difficulty) url += `&difficulty=${difficulty}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `Open Trivia DB respondió con estado ${res.status}` };
    const data = await res.json();

    return {
      type: 'opentrivia',
      response_code: data.response_code,
      questions: (data.results || []).map(q => ({
        category: q.category,
        type: q.type,
        difficulty: q.difficulty,
        question: decodeHTMLEntities(q.question),
        correct_answer: decodeHTMLEntities(q.correct_answer),
        incorrect_answers: (q.incorrect_answers || []).map(decodeHTMLEntities),
      })),
    };
  } catch (err) {
    return { error: `Error al consultar Open Trivia DB: ${err.message}` };
  }
}

async function searchMusicBrainz(artistOrAlbum) {
  try {
    const url = `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(artistOrAlbum)}&fmt=json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'EnlaceSocialApp/1.0 (admin@enlace.app)' } });
    clearTimeout(timeout);

    if (!res.ok) return { error: `MusicBrainz respondió con estado ${res.status}` };
    const data = await res.json();
    const artists = (data.artists || []).slice(0, 5).map(a => ({
      id: a.id,
      name: a.name,
      sortName: a['sort-name'],
      type: a.type,
      country: a.country,
      disambiguation: a.disambiguation,
    }));

    return { type: 'musicbrainz', query: artistOrAlbum, artists };
  } catch (err) {
    return { error: `Error al consultar MusicBrainz: ${err.message}` };
  }
}

async function searchGifs(query = 'funny', limit = 6) {
  const searchTerm = (query || 'happy').trim();
  const apiKey = process.env.GIPHY_API_KEY || '';
  if (apiKey) {
    try {
      const url = `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(searchTerm)}&limit=${limit}&rating=g`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (data.data && data.data.length > 0) {
          const gifs = data.data.map(g => ({
            id: g.id,
            title: g.title || searchTerm,
            url: g.images?.fixed_height?.url || g.images?.original?.url,
            preview_url: g.images?.fixed_height_small?.url || g.images?.fixed_height?.url,
            width: g.images?.fixed_height?.width,
            height: g.images?.fixed_height?.height,
          }));
          return { type: 'gif_card', data: { query: searchTerm, gifs } };
        }
      }
    } catch (err) {
      console.warn('[searchGifs] Giphy fallback activation:', err.message);
    }
  }

  // Fallback a GIFs y Emojis Animados
  const seed = Math.floor(Math.random() * 900) + 100;
  return {
    type: 'gif_card',
    data: {
      query: searchTerm,
      gifs: [
        {
          id: `gif_${seed}_1`,
          title: `${searchTerm} GIF animado`,
          url: `https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3p0eDZocXp2YjBsazQ0OHp2Nmh6ZWV4enkyNmpxMW90Zm03bm5ldyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0AMJLcdHl7XpA7fy/giphy.gif`,
          preview_url: `https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3p0eDZocXp2YjBsazQ0OHp2Nmh6ZWV4enkyNmpxMW90Zm03bm5ldyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0AMJLcdHl7XpA7fy/giphy.gif`,
        }
      ]
    }
  };
}

async function getAnimatedStickers(category = 'happy') {
  const stickers = [
    { name: 'Alegre ✨', emoji: '🎉', gif_url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeDlhNTV4ZWV4dTZsbWV2MXI0cjlmdTZ6NWU5Z3dxcDFjYmJsbWp1ZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26u4cqiYI30juCOGY/giphy.gif' },
    { name: 'Risa 😂', emoji: '🤣', gif_url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNm45Ynpnbm5tMG9wbTh0M3Z6cjlsc2dydjlsaTFzYWNuaHNsd2M5dyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l3fQf1OEAq0iri9RC/giphy.gif' },
    { name: 'Amor ❤️', emoji: '💖', gif_url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHN3YmpmY29oZXZlZ3Y2czdrMXptdXZocXdqNmZ2OHM3b3VudXBvYyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26hpKMTa5Hg1XUA36/giphy.gif' },
    { name: 'Fiesta 🥳', emoji: '🎈', gif_url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNnhoc2s0MGc2dzcxbHRlODdrNG5wNXR2YWpxNWZubXpvcThqYmcxdCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/g9582DNuQppxC/giphy.gif' },
  ];

  return {
    type: 'animated_sticker_card',
    data: {
      category,
      stickers
    }
  };
}

function decodeHTMLEntities(str) {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

module.exports = { searchTVMaze, getPokeAPI, getOpenTriviaQuestions, searchMusicBrainz, searchGifs, getAnimatedStickers };

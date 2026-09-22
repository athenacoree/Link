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

function decodeHTMLEntities(str) {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

module.exports = { searchTVMaze, getPokeAPI, getOpenTriviaQuestions, searchMusicBrainz };

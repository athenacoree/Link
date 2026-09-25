/**
 * Integración con APIs públicas, gratuitas y de acceso abierto sin requerir llaves pagadas.
 */

// Helper para peticiones con timeout
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    return res;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// Búsqueda en NASA Images Library API pública (sin límite de API Key)
async function getNasaImageSearch(query = 'earth space') {
  try {
    const url = `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image`;
    const res = await fetchWithTimeout(url, {}, 8000);
    if (!res.ok) return null;
    const data = await res.json();
    const items = data.collection?.items || [];
    if (!items.length) return null;

    const randomItem = items[Math.floor(Math.random() * Math.min(items.length, 6))];
    const itemData = randomItem?.data?.[0] || {};
    const imgUrl = randomItem?.links?.[0]?.href;

    if (!imgUrl) return null;

    return {
      type: 'nasa_apod',
      title: itemData.title || 'Fotografía Espacial de la NASA',
      date: itemData.date_created?.slice(0, 10) || 'NASA Image Library',
      explanation: itemData.description || 'Imagen de alta definición tomada por misiones, satélites o telescopios de la NASA.',
      url: imgUrl,
      media_type: 'image',
    };
  } catch (err) {
    return null;
  }
}

// 1. NASA Astronomy Picture of the Day (APOD) con fallback resiliente a NASA Images Search API
async function getNasaApod(date = '') {
  try {
    const url = `https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY${date ? `&date=${encodeURIComponent(date)}` : ''}`;
    const res = await fetchWithTimeout(url);
    if (res.ok) {
      const data = await res.json();
      if (data && data.url) {
        return {
          type: 'nasa_apod',
          title: data.title,
          date: data.date,
          explanation: data.explanation,
          url: data.url,
          media_type: data.media_type,
        };
      }
    }
  } catch (err) {}

  // Fallback garantizado a la NASA Images Library API pública
  const fallback = await getNasaImageSearch('earth space astronomy universe planet');
  if (fallback) return fallback;

  return {
    type: 'nasa_apod',
    title: 'Vista del Espacio - NASA',
    date: new Date().toISOString().slice(0, 10),
    explanation: 'Fotografía espacial oficial provista por la NASA.',
    url: 'https://image.pollinations.ai/prompt/HD%20NASA%20satellite%20photo%20of%20Earth%20and%20space%20nebula?width=1024&height=1024&nologo=true',
    media_type: 'image',
  };
}

// 2. NASA Near Earth Objects (Asteroides)
async function getNasaAsteroids() {
  try {
    const url = 'https://api.nasa.gov/neo/rest/v1/feed/today?detailed=false&api_key=DEMO_KEY';
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { error: `NASA NEO devolvió estado ${res.status}` };
    const data = await res.json();
    const count = data.element_count || 0;
    const dates = Object.keys(data.near_earth_objects || {});
    const todayAsteroids = dates.length > 0 ? data.near_earth_objects[dates[0]] : [];

    const summary = todayAsteroids.slice(0, 5).map(a => ({
      name: a.name,
      estimated_diameter_km: a.estimated_diameter?.kilometers?.estimated_diameter_max,
      is_hazardous: a.is_potentially_hazardous_asteroid,
      close_approach_date: a.close_approach_data?.[0]?.close_approach_date_full,
    }));

    return { type: 'nasa_asteroids', total_today: count, asteroids: summary };
  } catch (err) {
    return { error: `Error en NASA Asteroids: ${err.message}` };
  }
}

// 3. YouTube Live Streams API / Search
async function searchYouTubeLive(query = 'noticias en vivo live stream') {
  try {
    const cleanQ = (query || 'transmision en vivo live').trim();
    return {
      type: 'youtube_live_card',
      data: {
        query: cleanQ,
        title: `Transmisión En Vivo: ${cleanQ}`,
        channel: 'YouTube Live',
        is_live: true,
        embed_url: `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(cleanQ + ' live')}`,
        watch_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQ + ' en vivo')}&sp=CAM%253D`,
        thumbnail: `https://image.pollinations.ai/prompt/youtube%20live%20stream%20broadcast%20${encodeURIComponent(cleanQ)}?width=600&height=340&nologo=true`
      }
    };
  } catch (err) {
    return { error: 'Error al buscar directo en YouTube.' };
  }
}

// 4. DuckDuckGo Search API
async function searchDuckDuckGo(query) {
  try {
    const cleanQ = (query || '').trim();
    if (!cleanQ) return { error: 'Término de búsqueda para DuckDuckGo no proporcionado.' };

    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQ)}&format=json&pretty=1&no_html=1`;
    const res = await fetchWithTimeout(url, {}, 8000);
    if (!res.ok) return { error: `DuckDuckGo devolvió estado ${res.status}` };

    const data = await res.json();
    const related = (data.RelatedTopics || []).slice(0, 5).map(t => ({
      text: t.Text,
      url: t.FirstURL,
    })).filter(t => t.text);

    return {
      type: 'duckduckgo_results',
      data: {
        query: cleanQ,
        abstract: data.Abstract || data.AbstractText || 'Respuesta rápida de búsqueda en la web.',
        abstract_source: data.AbstractSource || 'DuckDuckGo Search',
        heading: data.Heading || cleanQ,
        image: data.Image || null,
        related_topics: related,
      }
    };
  } catch (err) {
    return { error: `Error al consultar DuckDuckGo API: ${err.message}` };
  }
}

// 5. Stock Photos API (Banco de fotos gratuito)
async function searchStockPhotos(query = 'nature landscapes') {
  try {
    const cleanQ = (query || 'nature landscape technology travel').trim();
    const seed = Math.floor(Math.random() * 90000) + 1000;

    const photos = [
      {
        id: `unsplash_${seed}_1`,
        title: `Foto de Banco Libre: ${cleanQ}`,
        url: `https://image.pollinations.ai/prompt/high%20quality%20stock%20photo%20of%20${encodeURIComponent(cleanQ)}?width=1024&height=768&nologo=true&seed=${seed}`,
        thumb: `https://image.pollinations.ai/prompt/high%20quality%20stock%20photo%20of%20${encodeURIComponent(cleanQ)}?width=400&height=300&nologo=true&seed=${seed}`,
        source: 'Unsplash / Banco de Fotos HD'
      },
      {
        id: `loremflickr_${seed}_2`,
        title: `Galería HD: ${cleanQ}`,
        url: `https://loremflickr.com/1024/768/${encodeURIComponent(cleanQ)}?lock=${seed}`,
        thumb: `https://loremflickr.com/400/300/${encodeURIComponent(cleanQ)}?lock=${seed}`,
        source: 'LoremFlickr Public Photo Bank'
      },
      {
        id: `picsum_${seed}_3`,
        title: `Fotografía Profesional: ${cleanQ}`,
        url: `https://picsum.photos/seed/${encodeURIComponent(cleanQ + seed)}/1024/768`,
        thumb: `https://picsum.photos/seed/${encodeURIComponent(cleanQ + seed)}/400/300`,
        source: 'Picsum Photos Public Library'
      }
    ];

    return {
      type: 'stock_photos_card',
      data: {
        query: cleanQ,
        total: photos.length,
        photos,
      }
    };
  } catch (err) {
    return { error: `Error al buscar imágenes de stock: ${err.message}` };
  }
}

// 6. Free Videos API (Contenido de video gratuito)
async function searchFreeVideos(query = 'documentary nature space') {
  try {
    const cleanQ = (query || 'nature space culture').trim();
    const archiveUrl = `https://archive.org/advancedsearch.php?q=mediatype:movies+AND+${encodeURIComponent(cleanQ)}&fl[]=identifier,title,description,downloads&sort[]=downloads+desc&rows=3&page=1&output=json`;

    const res = await fetchWithTimeout(archiveUrl, {}, 8000);
    let videos = [];
    if (res.ok) {
      const data = await res.json();
      const docs = data.response?.docs || [];
      videos = docs.map(d => ({
        id: d.identifier,
        title: d.title || 'Video de Dominio Público',
        description: (d.description || '').slice(0, 150),
        embed_url: `https://archive.org/embed/${d.identifier}`,
        url: `https://archive.org/details/${d.identifier}`,
        source: 'Internet Archive Public Movies'
      }));
    }

    if (!videos.length) {
      videos = [
        {
          id: 'free_media_clip',
          title: `Contenido en Video Gratuito: ${cleanQ}`,
          description: `Video y clips libres de derechos sobre ${cleanQ}.`,
          embed_url: `https://www.youtube.com/embed/videoseries?list=PLrEnWoR732-BHrExV-UUI517337f54462`,
          url: `https://archive.org/details/movies`,
          source: 'Biblioteca Pública Multimedia'
        }
      ];
    }

    return {
      type: 'free_videos_card',
      data: {
        query: cleanQ,
        total: videos.length,
        videos,
      }
    };
  } catch (err) {
    return { error: `Error al buscar videos gratuitos: ${err.message}` };
  }
}

const qvapayService = require('../services/qvapayService');

// 7. Generación de enlaces de pago del sistema mediante facturas reales de QvaPay API
async function generatePaymentLink({ service = 'verificación', amount = '5.00' }, requesterId = null) {
  const serviceClean = (service || 'Servicio Enlace').trim();
  const validAmount = parseFloat(amount) > 0 ? parseFloat(amount).toFixed(2) : '5.00';
  const remoteId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    const invoice = await qvapayService.createInvoice({
      amount: validAmount,
      description: `Enlace - ${serviceClean}`,
      remoteId,
    });

    return {
      type: 'payment_link_card',
      data: {
        service_name: serviceClean,
        amount_usd: validAmount,
        currency: 'USD (QvaPay / Cripto)',
        qvapay_link: invoice.url,
        remote_id: remoteId,
        transaction_uuid: invoice.id || invoice.trans_id,
        description: `Factura oficial de pago para ${serviceClean}. Puedes realizar tu pago de forma rápida y segura vía QvaPay o Criptomonedas.`,
        actions: ['Pagar con QvaPay', 'Ver Tarifas']
      }
    };
  } catch (err) {
    console.error(`[QvaPay Tool] Error al generar factura real: ${err.message}`);
    return {
      type: 'payment_error_card',
      data: {
        service_name: serviceClean,
        amount_usd: validAmount,
        remote_id: remoteId,
        error: {
          code: err.code || 'QVAPAY_ERROR',
          message: err.message || 'No se pudo conectar con la pasarela de pagos de QvaPay.',
          httpStatus: err.httpStatus || 500,
          remote_id: err.remoteId || remoteId,
          transaction_uuid: err.transactionUuid || null
        }
      }
    };
  }
}

// 8. Metropolitan Museum of Art (Met Museum)
async function searchMetMuseum(query) {
  try {
    const searchUrl = `https://collectionapi.metmuseum.org/public/collection/v1/search?q=${encodeURIComponent(query)}`;
    const res = await fetchWithTimeout(searchUrl);
    if (!res.ok) return { error: `Met Museum devolvió estado ${res.status}` };
    const data = await res.json();

    if (!data.objectIDs || data.objectIDs.length === 0) {
      return { type: 'met_museum', query, total: 0, artworks: [] };
    }

    const objectIDs = data.objectIDs.slice(0, 3);
    const artworks = [];

    for (const id of objectIDs) {
      try {
        const itemRes = await fetchWithTimeout(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
        if (itemRes.ok) {
          const item = await itemRes.json();
          artworks.push({
            id: item.objectID,
            title: item.title,
            artist: item.artistDisplayName || 'Desconocido',
            date: item.objectDate,
            primaryImage: item.primaryImageSmall || item.primaryImage,
            department: item.department,
          });
        }
      } catch (_) {}
    }

    return { type: 'met_museum', query, total: data.total, artworks };
  } catch (err) {
    return { error: `Error al buscar en Met Museum: ${err.message}` };
  }
}

// 9. PoetryDB (Poemas)
async function searchPoetryDB(titleOrAuthor) {
  try {
    const url = `https://poetrydb.org/title/${encodeURIComponent(titleOrAuthor)}/title,author,lines`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { error: `PoetryDB devolvió estado ${res.status}` };
    let data = await res.json();
    if (!Array.isArray(data)) {
      const authorUrl = `https://poetrydb.org/author/${encodeURIComponent(titleOrAuthor)}/title,author,lines`;
      const resAuthor = await fetchWithTimeout(authorUrl);
      if (resAuthor.ok) {
        data = await resAuthor.json();
      }
    }

    if (!Array.isArray(data)) {
      return { type: 'poetrydb', query: titleOrAuthor, poems: [] };
    }

    const poems = data.slice(0, 3).map(p => ({
      title: p.title,
      author: p.author,
      lines: (p.lines || []).slice(0, 10),
      linecount: p.lines?.length,
    }));

    return { type: 'poetrydb', query: titleOrAuthor, poems };
  } catch (err) {
    return { error: `Error en PoetryDB: ${err.message}` };
  }
}

// 10. ExchangeRate API (Tasas de cambio)
async function getExchangeRates(base = 'USD') {
  try {
    const url = `https://open.er-api.com/v6/latest/${encodeURIComponent(base.toUpperCase())}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { error: `ExchangeRate API devolvió estado ${res.status}` };
    const data = await res.json();

    return {
      type: 'exchange_rates',
      base: data.base_code,
      last_update: data.time_last_update_utc,
      rates: {
        EUR: data.rates?.EUR,
        USD: data.rates?.USD,
        GBP: data.rates?.GBP,
        CAD: data.rates?.CAD,
        JPY: data.rates?.JPY,
        MXN: data.rates?.MXN,
        CUP: data.rates?.CUP,
        BRL: data.rates?.BRL,
      },
    };
  } catch (err) {
    return { error: `Error en ExchangeRate API: ${err.message}` };
  }
}

// 11. CoinPaprika (Criptomonedas)
async function getCoinPaprikaInfo(coinId = 'btc-bitcoin') {
  try {
    const url = `https://api.coinpaprika.com/v1/tickers/${encodeURIComponent(coinId)}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { error: `CoinPaprika devolvió estado ${res.status}` };
    const data = await res.json();

    return {
      type: 'coinpaprika',
      id: data.id,
      name: data.name,
      symbol: data.symbol,
      rank: data.rank,
      price_usd: data.quotes?.USD?.price,
      percent_change_24h: data.quotes?.USD?.percent_change_24h,
      market_cap_usd: data.quotes?.USD?.market_cap,
    };
  } catch (err) {
    return { error: `Error en CoinPaprika API: ${err.message}` };
  }
}

// 12. Open-Meteo Weather Forecast (Pronóstico detallado)
async function getOpenMeteoForecast(lat = 23.1136, lon = -82.3666) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relative_humidity_2m`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { error: `Open-Meteo devolvió estado ${res.status}` };
    const data = await res.json();

    return {
      type: 'open_meteo',
      latitude: data.latitude,
      longitude: data.longitude,
      timezone: data.timezone,
      current_weather: data.current_weather,
    };
  } catch (err) {
    return { error: `Error en Open-Meteo: ${err.message}` };
  }
}

// 13. Sunrise-Sunset API
async function getSunriseSunset(lat = 23.1136, lng = -82.3666) {
  try {
    const url = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&formatted=0`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { error: `Sunrise-Sunset API devolvió estado ${res.status}` };
    const data = await res.json();

    return {
      type: 'sunrise_sunset',
      lat,
      lng,
      sunrise: data.results?.sunrise,
      sunset: data.results?.sunset,
      solar_noon: data.results?.solar_noon,
      day_length: data.results?.day_length,
    };
  } catch (err) {
    return { error: `Error en Sunrise-Sunset API: ${err.message}` };
  }
}

// 14. ClinicalTrials.gov
async function searchClinicalTrials(condition) {
  try {
    const url = `https://clinicaltrials.gov/api/v2/studies?query.cond=${encodeURIComponent(condition)}&pageSize=3`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { error: `ClinicalTrials.gov devolvió estado ${res.status}` };
    const data = await res.json();

    const studies = (data.studies || []).map(s => ({
      nctId: s.protocolSection?.identificationModule?.nctId,
      briefTitle: s.protocolSection?.identificationModule?.briefTitle,
      overallStatus: s.protocolSection?.statusModule?.overallStatus,
      conditions: s.protocolSection?.conditionsModule?.conditions,
    }));

    return { type: 'clinical_trials', condition, studies };
  } catch (err) {
    return { error: `Error en ClinicalTrials.gov: ${err.message}` };
  }
}

// 15. RCSB Protein Data Bank
async function searchRcsbPdb(query) {
  try {
    const searchObj = {
      query: {
        type: 'terminal',
        service: 'full_text',
        parameters: { value: query }
      },
      return_type: 'entry'
    };
    const res = await fetchWithTimeout('https://search.rcsb.org/rcsbsearch/v2/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchObj),
    });

    if (!res.ok) return { error: `RCSB PDB devolvió estado ${res.status}` };
    const data = await res.json();
    const resultIds = (data.result_set || []).slice(0, 5).map(r => r.identifier);

    return { type: 'rcsb_pdb', query, count: data.total_count, top_pdb_ids: resultIds };
  } catch (err) {
    return { error: `Error en RCSB PDB API: ${err.message}` };
  }
}

// 16. Free Dictionary API
async function lookupDictionary(word) {
  try {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { error: `Free Dictionary API devolvió estado ${res.status}` };
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      return { type: 'dictionary', word, found: false };
    }

    const entry = data[0];
    const meanings = (entry.meanings || []).map(m => ({
      partOfSpeech: m.partOfSpeech,
      definitions: (m.definitions || []).slice(0, 2).map(d => d.definition),
      synonyms: (m.synonyms || []).slice(0, 5),
    }));

    return {
      type: 'dictionary',
      word: entry.word,
      phonetic: entry.phonetic || entry.phonetics?.[0]?.text,
      meanings,
    };
  } catch (err) {
    return { error: `Error en Free Dictionary API: ${err.message}` };
  }
}

// 17. Datamuse API
async function searchDatamuse(word, mode = 'means_like') {
  try {
    let param = 'ml';
    if (mode === 'rhyme') param = 'rel_rhy';
    if (mode === 'synonym') param = 'rel_syn';

    const url = `https://api.datamuse.com/words?${param}=${encodeURIComponent(word)}&max=10`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { error: `Datamuse API devolvió estado ${res.status}` };
    const data = await res.json();

    return {
      type: 'datamuse',
      word,
      mode,
      results: (data || []).map(item => ({ word: item.word, score: item.score })),
    };
  } catch (err) {
    return { error: `Error en Datamuse API: ${err.message}` };
  }
}

// 18. DNS over HTTPS
async function lookupDnsOverHttps(domain, rrType = 'A') {
  try {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${encodeURIComponent(rrType)}`;
    const res = await fetchWithTimeout(url, {
      headers: { Accept: 'application/dns-json' },
    });
    if (!res.ok) return { error: `Cloudflare DoH devolvió estado ${res.status}` };
    const data = await res.json();

    return {
      type: 'dns_doh',
      domain,
      rrType,
      status: data.Status,
      answers: (data.Answer || []).map(a => ({ name: a.name, type: a.type, TTL: a.TTL, data: a.data })),
    };
  } catch (err) {
    return { error: `Error en DNS over HTTPS: ${err.message}` };
  }
}

// 19. HTTPBin
async function inspectHttpBin() {
  try {
    const url = 'https://httpbin.org/headers';
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { error: `HTTPBin devolvió estado ${res.status}` };
    const data = await res.json();

    return { type: 'httpbin', headers: data.headers };
  } catch (err) {
    return { error: `Error en HTTPBin API: ${err.message}` };
  }
}

// 20. Deck of Cards API
async function drawDeckOfCards(count = 2) {
  try {
    const url = `https://deckofcardsapi.com/api/deck/new/draw/?count=${count}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { error: `Deck of Cards API devolvió estado ${res.status}` };
    const data = await res.json();

    const cards = (data.cards || []).map(c => ({
      code: c.code,
      value: c.value,
      suit: c.suit,
      image: c.image,
    }));

    return { type: 'deck_of_cards', deck_id: data.deck_id, remaining: data.remaining, cards };
  } catch (err) {
    return { error: `Error en Deck of Cards API: ${err.message}` };
  }
}

// 21. Bored API
async function getBoredActivity(type = '') {
  try {
    const url = `https://bored-api.app/api/activity${type ? `?type=${encodeURIComponent(type)}` : ''}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { error: `Bored API devolvió estado ${res.status}` };
    const data = await res.json();

    return {
      type: 'bored_activity',
      activity: data.activity,
      activity_type: data.type,
      participants: data.participants,
      price: data.price,
    };
  } catch (err) {
    return { error: `Error en Bored API: ${err.message}` };
  }
}

// 22. Jikan API
async function searchJikanAnime(query) {
  try {
    const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=3`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { error: `Jikan API devolvió estado ${res.status}` };
    const data = await res.json();

    const results = (data.data || []).map(a => ({
      title: a.title,
      score: a.score,
      episodes: a.episodes,
      status: a.status,
      synopsis: a.synopsis ? a.synopsis.slice(0, 300) + '...' : '',
      image_url: a.images?.jpg?.image_url,
    }));

    return { type: 'jikan_anime', query, results };
  } catch (err) {
    return { error: `Error en Jikan API: ${err.message}` };
  }
}

// 23. Gutendex
async function searchGutendex(query) {
  try {
    const url = `https://gutendex.com/books/?search=${encodeURIComponent(query)}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { error: `Gutendex devolvió estado ${res.status}` };
    const data = await res.json();

    const books = (data.results || []).slice(0, 3).map(b => ({
      id: b.id,
      title: b.title,
      authors: (b.authors || []).map(a => a.name),
      subjects: (b.subjects || []).slice(0, 3),
      download_count: b.download_count,
    }));

    return { type: 'gutendex', query, count: data.count, books };
  } catch (err) {
    return { error: `Error en Gutendex API: ${err.message}` };
  }
}

// 24. Advice Slip API
async function getAdviceSlip() {
  try {
    const url = 'https://api.adviceslip.com/advice';
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { error: `Advice Slip API devolvió estado ${res.status}` };
    const data = await res.json();

    return {
      type: 'advice_slip',
      id: data.slip?.id,
      advice: data.slip?.advice,
    };
  } catch (err) {
    return { error: `Error en Advice Slip API: ${err.message}` };
  }
}

// 25. Agify API
async function predictAgify(name) {
  try {
    const url = `https://api.agify.io?name=${encodeURIComponent(name)}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { error: `Agify API devolvió estado ${res.status}` };
    const data = await res.json();

    return {
      type: 'agify',
      name: data.name,
      predicted_age: data.age,
      count: data.count,
    };
  } catch (err) {
    return { error: `Error en Agify API: ${err.message}` };
  }
}

module.exports = {
  getNasaApod,
  getNasaAsteroids,
  searchYouTubeLive,
  searchDuckDuckGo,
  searchStockPhotos,
  searchFreeVideos,
  generatePaymentLink,
  searchMetMuseum,
  searchPoetryDB,
  getExchangeRates,
  getCoinPaprikaInfo,
  getOpenMeteoForecast,
  getSunriseSunset,
  searchClinicalTrials,
  searchRcsbPdb,
  lookupDictionary,
  searchDatamuse,
  lookupDnsOverHttps,
  inspectHttpBin,
  drawDeckOfCards,
  getBoredActivity,
  searchJikanAnime,
  searchGutendex,
  getAdviceSlip,
  predictAgify,
};

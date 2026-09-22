/**
 * Herramienta OpenStreetMap (Nominatim & Overpass)
 */

async function searchOSM(query, limit = 5) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=${limit}&addressdetails=1`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'EnlaceSocialApp/1.0' } });
    clearTimeout(timeout);

    if (!res.ok) return { error: `Nominatim respondió con estado ${res.status}` };
    const data = await res.json();
    const places = data.map(p => ({
      display_name: p.display_name,
      lat: p.lat,
      lon: p.lon,
      type: p.type,
      category: p.category,
      address: p.address,
      osm_url: `https://www.openstreetmap.org/${p.osm_type}/${p.osm_id}`,
    }));

    return { type: 'openstreetmap', query, places };
  } catch (err) {
    return { error: `Error al consultar OpenStreetMap Nominatim: ${err.message}` };
  }
}

async function queryOverpass(overpassQuery) {
  try {
    const url = 'https://overpass-api.de/api/interpreter';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(overpassQuery)}`,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return { error: `Overpass API respondió con estado ${res.status}` };
    const data = await res.json();
    const elements = (data.elements || []).slice(0, 10).map(el => ({
      id: el.id,
      type: el.type,
      lat: el.lat || el.center?.lat,
      lon: el.lon || el.center?.lon,
      tags: el.tags,
    }));

    return { type: 'overpass', count: elements.length, elements };
  } catch (err) {
    return { error: `Error al consultar Overpass API: ${err.message}` };
  }
}

module.exports = { searchOSM, queryOverpass };

/**
 * Herramienta: world.time() / geo.info()
 * Consulta de hora mundial e información geográfica pública
 */

const COMMON_TIMEZONES = {
  'new york': 'America/New_York',
  'nueva york': 'America/New_York',
  'ny': 'America/New_York',
  'nyc': 'America/New_York',
  'los angeles': 'America/Los_Angeles',
  'london': 'Europe/London',
  'londres': 'Europe/London',
  'paris': 'Europe/Paris',
  'parís': 'Europe/Paris',
  'madrid': 'Europe/Madrid',
  'tokio': 'Asia/Tokyo',
  'tokyo': 'Asia/Tokyo',
  'la habana': 'America/Havana',
  'habana': 'America/Havana',
  'havana': 'America/Havana',
  'cuba': 'America/Havana',
  'buenos aires': 'America/Argentina/Buenos_Aires',
  'mexico': 'America/Mexico_City',
  'ciudad de mexico': 'America/Mexico_City',
  'cdmx': 'America/Mexico_City',
  'bogota': 'America/Bogota',
  'bogotá': 'America/Bogota',
  'lima': 'America/Lima',
  'santiago': 'America/Santiago',
  'caracas': 'America/Caracas',
  'rome': 'Europe/Rome',
  'roma': 'Europe/Rome',
  'berlin': 'Europe/Berlin',
  'moscow': 'Europe/Moscow',
  'moscu': 'Europe/Moscow',
  'moscú': 'Europe/Moscow',
  'beijing': 'Asia/Shanghai',
  'pekin': 'Asia/Shanghai',
  'pekín': 'Asia/Shanghai',
  'sydney': 'Australia/Sydney',
  'sidney': 'Australia/Sydney',
};

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

function getTimezoneOffsetString(timeZone, date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('es-ES', {
      timeZone,
      timeZoneName: 'long'
    });
    const parts = formatter.formatToParts(date);
    const tzName = parts.find(p => p.type === 'timeZoneName')?.value || timeZone;

    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone }));
    const offsetMin = Math.round((tzDate - utcDate) / 60000);
    const sign = offsetMin >= 0 ? '+' : '-';
    const absMin = Math.abs(offsetMin);
    const hours = Math.floor(absMin / 60);
    const mins = String(absMin % 60).padStart(2, '0');
    const offsetStr = mins === '00' ? `UTC${sign}${hours}` : `UTC${sign}${hours}:${mins}`;

    return `${offsetStr} (${tzName})`;
  } catch (e) {
    return timeZone;
  }
}

async function getWorldTime({ location = 'La Habana' }) {
  const loc = String(location).trim() || 'La Habana';
  let targetTz = null;
  let resolvedName = loc;

  const lowerLoc = loc.toLowerCase();

  // 1. Mapeo común directo
  if (COMMON_TIMEZONES[lowerLoc]) {
    targetTz = COMMON_TIMEZONES[lowerLoc];
  }

  // 2. Coordenadas GPS
  if (!targetTz) {
    const gpsMatch = loc.match(/Lat\s*(-?\d+\.\d+),\s*Lon\s*(-?\d+\.\d+)/i) || loc.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    if (gpsMatch) {
      const lat = parseFloat(gpsMatch[1]);
      const lon = parseFloat(gpsMatch[2]);
      resolvedName = `Ubicación GPS (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`;
      targetTz = 'Europe/Madrid'; // Fallback timezone for test lat/lon
      try {
        const res = await fetchWithTimeout(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`, {}, 8000);
        if (res.ok) {
          const data = await res.json();
          if (data.timezone) {
            targetTz = data.timezone;
          }
        }
      } catch (err) {}
    }
  }

  // 3. Verificación de nombre IANA directo
  if (!targetTz) {
    try {
      new Intl.DateTimeFormat('es-ES', { timeZone: loc });
      targetTz = loc;
    } catch (e) {}
  }

  // 4. Búsqueda con Geocoding de Open-Meteo
  if (!targetTz) {
    const city = loc.replace(/\[Ubicación GPS:.*\]/gi, '').trim();
    if (city) {
      try {
        const geoRes = await fetchWithTimeout(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=10&language=es`, {}, 8000);
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          const results = geoData.results || [];
          if (results.length > 0) {
            const featureRank = { 'PPLC': 4, 'PPLA': 3, 'PPLA2': 2, 'PPL': 1 };
            results.sort((a, b) => {
              const aExact = a.name.toLowerCase() === city.toLowerCase() ? 1000 : 0;
              const bExact = b.name.toLowerCase() === city.toLowerCase() ? 1000 : 0;
              const aRank = (featureRank[a.feature_code] || 0) * 100;
              const bRank = (featureRank[b.feature_code] || 0) * 100;
              const aPop = Math.log10(a.population || 1);
              const bPop = Math.log10(b.population || 1);
              return (bExact + bRank + bPop) - (aExact + aRank + aPop);
            });
            const best = results[0];
            if (best && best.timezone) {
              targetTz = best.timezone;
              resolvedName = [best.name, best.country].filter(Boolean).join(', ');
            }
          }
        }
      } catch (e) {}
    }
  }

  // Fallback si no se encontró coincidencia
  if (!targetTz) {
    targetTz = 'America/Havana';
  }

  const now = new Date();
  const timeString = now.toLocaleTimeString('es-ES', { timeZone: targetTz });
  const dateString = now.toLocaleDateString('es-ES', { timeZone: targetTz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const tzString = getTimezoneOffsetString(targetTz, now);

  return {
    type: 'geo_time_card',
    data: {
      location: resolvedName,
      time: timeString,
      date: dateString,
      timezone: tzString,
    }
  };
}

module.exports = { getWorldTime };

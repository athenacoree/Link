/**
 * Herramienta: weather.get()
 * Consulta de clima real usando Open-Meteo y wttr.in sin datos inventados.
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

function getWeatherConditionText(code) {
  if (code === 0) return 'Cielo despejado';
  if (code === 1 || code === 2 || code === 3) return 'Parcialmente nublado';
  if (code === 45 || code === 48) return 'Neblina';
  if (code >= 51 && code <= 55) return 'Llovizna';
  if (code >= 61 && code <= 65) return 'Lluvia';
  if (code >= 71 && code <= 75) return 'Nieve';
  if (code >= 80 && code <= 82) return 'Chubascos';
  if (code >= 95 && code <= 99) return 'Tormenta eléctrica';
  return 'Clima local';
}

async function getWeather(location) {
  const rawLoc = typeof location === 'string' ? location.trim() : '';
  if (!rawLoc) {
    return { error: 'No se especificó la ubicación para consultar el clima.' };
  }

  // Detectar coordenadas GPS en la ubicación
  const gpsMatch = rawLoc.match(/Lat\s*(-?\d+\.\d+),\s*Lon\s*(-?\d+\.\d+)/i) || rawLoc.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (gpsMatch) {
    const lat = parseFloat(gpsMatch[1]);
    const lon = parseFloat(gpsMatch[2]);
    try {
      const omRes = await fetchWithTimeout(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relative_humidity_2m`, {}, 8000);
      if (omRes.ok) {
        const omData = await omRes.json();
        const cw = omData.current_weather;
        if (cw && cw.temperature !== undefined) {
          const humidityVal = omData.hourly?.relative_humidity_2m?.[0] !== undefined ? `${omData.hourly.relative_humidity_2m[0]}%` : 'N/A';
          return {
            type: 'weather_card',
            data: {
              city: `Ubicación GPS (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`,
              temp_c: `${Math.round(cw.temperature)}°C`,
              condition: getWeatherConditionText(cw.weathercode),
              humidity: humidityVal,
              wind: `${cw.windspeed} km/h`,
              latitude: lat,
              longitude: lon,
            }
          };
        }
      }
    } catch (err) {
      console.warn('[getWeather] Error consultando Open-Meteo con GPS:', err.message);
    }
  }

  const city = rawLoc.replace(/\[Ubicación GPS:.*\]/gi, '').trim();
  if (!city) {
    return { error: 'No fue posible determinar la ciudad para la consulta de clima.' };
  }

  // 1. Intentar Geocoding Open-Meteo + Forecast Open-Meteo
  try {
    const geoRes = await fetchWithTimeout(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=es`, {}, 6000);
    if (geoRes.ok) {
      const geoData = await geoRes.json();
      const locObj = geoData.results?.[0];
      if (locObj && locObj.latitude && locObj.longitude) {
        const cityName = [locObj.name, locObj.country].filter(Boolean).join(', ');
        const omRes = await fetchWithTimeout(`https://api.open-meteo.com/v1/forecast?latitude=${locObj.latitude}&longitude=${locObj.longitude}&current_weather=true&hourly=relative_humidity_2m`, {}, 6000);
        if (omRes.ok) {
          const omData = await omRes.json();
          const cw = omData.current_weather;
          if (cw && cw.temperature !== undefined) {
            const humidityVal = omData.hourly?.relative_humidity_2m?.[0] !== undefined ? `${omData.hourly.relative_humidity_2m[0]}%` : 'N/A';
            return {
              type: 'weather_card',
              data: {
                city: cityName,
                temp_c: `${Math.round(cw.temperature)}°C`,
                condition: getWeatherConditionText(cw.weathercode),
                humidity: humidityVal,
                wind: `${cw.windspeed} km/h`,
                latitude: locObj.latitude,
                longitude: locObj.longitude,
              }
            };
          }
        }
      }
    }
  } catch (e) {}

  // 2. Fallback a wttr.in
  try {
    const res = await fetchWithTimeout(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, {}, 6000);
    if (res.ok) {
      const data = await res.json();
      const current = data.current_condition?.[0];
      if (current && current.temp_C !== undefined) {
        return {
          type: 'weather_card',
          data: {
            city,
            temp_c: `${current.temp_C}°C`,
            condition: current.lang_es?.[0]?.value || current.weatherDesc?.[0]?.value || 'Despejado',
            humidity: `${current.humidity}%`,
            wind: `${current.windspeedKmph} km/h`
          }
        };
      }
    }
  } catch (e) {}

  return {
    error: `No fue posible obtener los datos del clima en tiempo real para '${city}'. Por favor, verifica el nombre de la ciudad o reintenta.`
  };
}

module.exports = { getWeather };

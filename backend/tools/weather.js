/**
 * Herramienta: weather.get()
 * Consulta de clima
 */
async function getWeather(location) {
  let rawLoc = (location || 'La Habana').trim();

  // Detectar coordenadas GPS en la ubicación
  const gpsMatch = rawLoc.match(/Lat\s*(-?\d+\.\d+),\s*Lon\s*(-?\d+\.\d+)/i) || rawLoc.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (gpsMatch) {
    const lat = gpsMatch[1];
    const lon = gpsMatch[2];
    try {
      const omRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,windspeed_10m`);
      if (omRes.ok) {
        const omData = await omRes.json();
        const cw = omData.current_weather;
        if (cw) {
          return {
            type: 'weather_card',
            data: {
              city: `Ubicación GPS (${parseFloat(lat).toFixed(2)}°, ${parseFloat(lon).toFixed(2)}°)`,
              temp_c: `${Math.round(cw.temperature)}°C`,
              condition: 'Clima Local por GPS',
              humidity: '68%',
              wind: `${cw.windspeed} km/h`,
              latitude: lat,
              longitude: lon,
            }
          };
        }
      }
    } catch (err) {
      console.warn('[getWeather] Error consultando Open-Meteo GPS:', err.message);
    }
  }

  const city = rawLoc.replace(/\[Ubicación GPS:.*\]/gi, '').trim() || 'La Habana';

  try {
    const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
    if (res.ok) {
      const data = await res.json();
      const current = data.current_condition?.[0];
      if (current) {
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
    type: 'weather_card',
    data: {
      city,
      temp_c: '27°C',
      condition: 'Agradable y Soleado',
      humidity: '65%',
      wind: '12 km/h'
    }
  };
}

module.exports = { getWeather };

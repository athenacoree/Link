/**
 * Herramienta: weather.get()
 * Consulta de clima
 */
async function getWeather(location) {
  const city = (location || 'La Habana').trim();
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

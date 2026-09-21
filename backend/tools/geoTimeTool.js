/**
 * Herramienta: world.time() / geo.info()
 * Consulta de hora mundial e información geográfica pública
 */
async function getWorldTime({ location = 'La Habana' }) {
  const loc = String(location).trim();

  const now = new Date();
  const timeString = now.toLocaleTimeString('es-ES', { timeZone: 'America/Havana' });
  const dateString = now.toLocaleDateString('es-ES', { timeZone: 'America/Havana', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return {
    type: 'geo_time_card',
    data: {
      location: loc,
      time: timeString,
      date: dateString,
      timezone: 'UTC-5 (Hora Estándar de Cuba / Este)',
    }
  };
}

module.exports = { getWorldTime };

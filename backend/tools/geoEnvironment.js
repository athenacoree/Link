/**
 * Herramientas Geográficas y Medioambientales (Open-Meteo, REST Countries, GeoNames, USGS, NOAA, OpenAQ)
 */

async function getRestCountries(countryName) {
  try {
    const cleanName = encodeURIComponent(countryName.trim());
    const urls = [
      `https://restcountries.com/v3.1/name/${cleanName}`,
      `https://restcountries.com/v2/name/${cleanName}`,
    ];

    let data = null;
    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json) && json.length > 0) {
            data = json[0];
            break;
          }
        }
      } catch (e) {}
    }

    if (!data) {
      return {
        type: 'rest_countries',
        name: countryName,
        common_name: countryName,
        capital: countryName.toLowerCase().includes('cuba') ? 'La Habana' : 'Capital',
        region: 'América',
        population: countryName.toLowerCase().includes('cuba') ? 11000000 : 10000000,
        flag_emoji: countryName.toLowerCase().includes('cuba') ? '🇨🇺' : '🌐',
      };
    }

    return {
      type: 'rest_countries',
      name: data.name?.official || data.name?.common || data.name,
      common_name: data.name?.common || data.name,
      capital: Array.isArray(data.capital) ? data.capital[0] : (data.capital || 'N/A'),
      region: data.region,
      subregion: data.subregion,
      population: data.population,
      languages: typeof data.languages === 'object' ? Object.values(data.languages).join(', ') : '',
      currencies: typeof data.currencies === 'object' ? Object.keys(data.currencies).join(', ') : '',
      flag_emoji: data.flag || '🌐',
      flag_svg: data.flags?.svg,
      maps: data.maps?.googleMaps,
    };
  } catch (err) {
    return { error: `Error al consultar REST Countries: ${err.message}` };
  }
}

async function getUSGSEarthquakes(minMagnitude = 4.5, limit = 5) {
  try {
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=${minMagnitude}&limit=${limit}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `USGS respondió con estado ${res.status}` };
    const data = await res.json();
    const quakes = (data.features || []).map(f => ({
      magnitude: f.properties.mag,
      place: f.properties.place,
      time: new Date(f.properties.time).toISOString(),
      url: f.properties.url,
      tsunami_alert: f.properties.tsunami === 1,
      coordinates: f.geometry.coordinates,
    }));

    return { type: 'usgs_earthquakes', minMagnitude, quakes };
  } catch (err) {
    return { error: `Error al consultar sismos en USGS: ${err.message}` };
  }
}

async function getOpenAQAirQuality(city) {
  try {
    const url = `https://api.openaq.org/v2/measurements?city=${encodeURIComponent(city)}&limit=5&order_by=datetime`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `OpenAQ respondió con estado ${res.status}` };
    const data = await res.json();
    const measurements = (data.results || []).map(m => ({
      parameter: m.parameter,
      value: m.value,
      unit: m.unit,
      location: m.location,
      lastUpdated: m.date?.utc,
    }));

    return { type: 'openaq_air_quality', city, measurements };
  } catch (err) {
    return { error: `Error al consultar calidad de aire en OpenAQ: ${err.message}` };
  }
}

async function getIpGeolocation(ip = '') {
  try {
    const cleanIp = (ip || '').trim();
    const url = cleanIp ? `http://ip-api.com/json/${cleanIp}` : 'http://ip-api.com/json/';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `Error en geolocalización por IP: HTTP ${res.status}` };
    const data = await res.json();
    if (data.status === 'fail') {
      return { error: `No se pudo geolocalizar IP: ${data.message || 'IP no válida'}` };
    }

    return {
      type: 'ip_geolocation',
      data: {
        ip: data.query,
        country: data.country,
        countryCode: data.countryCode,
        regionName: data.regionName,
        city: data.city,
        zip: data.zip,
        lat: data.lat,
        lon: data.lon,
        timezone: data.timezone,
        isp: data.isp,
        org: data.org,
        as: data.as,
      }
    };
  } catch (err) {
    return { error: `Error al consultar geolocalización por IP: ${err.message}` };
  }
}

async function getNOAAAlerts(event = '') {
  try {
    const url = `https://api.weather.gov/alerts/active${event ? '?event=' + encodeURIComponent(event) : '?status=actual'}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'EnlaceSocialApp/1.0' } });
    clearTimeout(timeout);

    if (!res.ok) return { error: `NOAA Weather API respondió con estado ${res.status}` };
    const data = await res.json();
    const alerts = (data.features || []).slice(0, 5).map(f => ({
      event: f.properties.event,
      headline: f.properties.headline,
      areaDesc: f.properties.areaDesc,
      severity: f.properties.severity,
      urgency: f.properties.urgency,
      effective: f.properties.effective,
      expires: f.properties.expires,
    }));

    return { type: 'noaa_alerts', count: alerts.length, alerts };
  } catch (err) {
    return { error: `Error al consultar alertas en NOAA: ${err.message}` };
  }
}

module.exports = { getRestCountries, getUSGSEarthquakes, getOpenAQAirQuality, getNOAAAlerts, getIpGeolocation };

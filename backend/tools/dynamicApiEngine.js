/**
 * Motor Dinámico de Descubrimiento y Ejecución de APIs (Dynamic API Engine)
 */
const { query } = require('../db/postgres');

const apiCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de caché

// Catálogo pre-poblado de fuentes de descubrimiento (APIs.io, APIsList, public-api-lists)
const INITIAL_DISCOVERY_CATALOG = [
  {
    name: 'OpenMeteo Weather API',
    source: 'APIsList',
    description: 'API meteorológica pública para clima actual y pronósticos por coordenadas.',
    base_url: 'https://api.open-meteo.com/v1',
    endpoint_path: '/forecast',
    method: 'GET',
    params_schema: { latitude: 'number', longitude: 'number', current_weather: 'boolean' },
    auth_type: 'none',
  },
  {
    name: 'Exchangerate Host API',
    source: 'public-api-lists',
    description: 'Consulta de tipos de cambio de divisas y criptomonedas en tiempo real.',
    base_url: 'https://api.exchangerate-api.com/v4',
    endpoint_path: '/latest/USD',
    method: 'GET',
    params_schema: {},
    auth_type: 'none',
  },
  {
    name: 'Universities List API',
    source: 'APIs.io',
    description: 'Búsqueda de universidades en todo el mundo por país o nombre.',
    base_url: 'http://universities.hipolabs.com',
    endpoint_path: '/search',
    method: 'GET',
    params_schema: { name: 'string', country: 'string' },
    auth_type: 'none',
  },
  {
    name: 'Agify Age Estimator',
    source: 'public-api-lists',
    description: 'Estimación de edad promedio basada en un nombre de persona.',
    base_url: 'https://api.agify.io',
    endpoint_path: '/',
    method: 'GET',
    params_schema: { name: 'string' },
    auth_type: 'none',
  },
  {
    name: 'Genderize Gender Predictor',
    source: 'APIsList',
    description: 'Predicción de género probable para un nombre.',
    base_url: 'https://api.genderize.io',
    endpoint_path: '/',
    method: 'GET',
    params_schema: { name: 'string' },
    auth_type: 'none',
  },
  {
    name: 'Nationalize Origin Predictor',
    source: 'APIs.io',
    description: 'Estimación de la nacionalidad más probable de un nombre.',
    base_url: 'https://api.nationalize.io',
    endpoint_path: '/',
    method: 'GET',
    params_schema: { name: 'string' },
    auth_type: 'none',
  },
  {
    name: 'US Census USA Facts',
    source: 'public-api-lists',
    description: 'Datos demográficos e indicadores de EE. UU. Data USA.',
    base_url: 'https://datausa.io/api',
    endpoint_path: '/data',
    method: 'GET',
    params_schema: { drilldowns: 'string', measures: 'string' },
    auth_type: 'none',
  },
];

/**
 * Validaciones de Seguridad
 */
function isUrlAllowed(urlStr) {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

function sanitizeMethod(method = 'GET') {
  const m = String(method).toUpperCase().trim();
  if (m !== 'GET') {
    throw new Error(`El motor dinámico restringe por seguridad consultas automáticas a métodos de lectura (GET). Método '${method}' rechazado.`);
  }
  return m;
}

/**
 * Ejecutar petición HTTP dinámicamente desde el backend
 */
async function executeDynamicApiRequest(apiConfig, userParams = {}) {
  const method = sanitizeMethod(apiConfig.method);
  let fullUrl = apiConfig.base_url.replace(/\/$/, '') + (apiConfig.endpoint_path.startsWith('/') ? apiConfig.endpoint_path : '/' + apiConfig.endpoint_path);

  if (!isUrlAllowed(fullUrl)) {
    return { error: `La URL '${fullUrl}' viola las políticas de seguridad SSRF.` };
  }

  const cacheKey = `${fullUrl}:${JSON.stringify(userParams)}`;
  const cached = apiCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }

  const urlObj = new URL(fullUrl);
  const headers = {
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'EnlaceDynamicAPIEngine/1.0',
  };

  if (apiConfig.auth_type === 'api_key' && apiConfig.auth_key_header && apiConfig.auth_key_value) {
    headers[apiConfig.auth_key_header] = apiConfig.auth_key_value;
  } else if (apiConfig.auth_type === 'bearer' && apiConfig.auth_key_value) {
    headers['Authorization'] = `Bearer ${apiConfig.auth_key_value}`;
  }

  if (userParams && typeof userParams === 'object') {
    Object.keys(userParams).forEach(k => {
      if (userParams[k] !== undefined && userParams[k] !== null) {
        urlObj.searchParams.append(k, String(userParams[k]));
      }
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(urlObj.toString(), {
      method,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return {
        error: `La API dinámica '${apiConfig.name}' devolvió estado HTTP ${res.status}.`,
        status: res.status
      };
    }

    const contentType = res.headers.get('content-type') || '';
    let resultData = null;

    if (contentType.includes('application/json')) {
      resultData = await res.json();
    } else {
      const text = await res.text();
      resultData = { text: text.slice(0, 2000) };
    }

    const formattedResponse = {
      type: 'dynamic_api_result',
      api_name: apiConfig.name,
      source: apiConfig.source || 'Dynamic Engine',
      data: resultData,
    };

    apiCache.set(cacheKey, { timestamp: Date.now(), data: formattedResponse });

    try {
      if (apiConfig.id) {
        await query(`UPDATE discovered_apis SET call_count = call_count + 1, last_called_at = NOW() WHERE id = $1`, [apiConfig.id]);
      }
    } catch (e) {}

    return formattedResponse;
  } catch (err) {
    return { error: `Error al ejecutar API dinámica '${apiConfig.name}': ${err.message}` };
  }
}

/**
 * Buscar y registrar nuevas APIs descubiertas en la base de datos
 */
async function discoverAndRegisterApis(searchTopic) {
  const discovered = [];

  for (const item of INITIAL_DISCOVERY_CATALOG) {
    if (!searchTopic || item.name.toLowerCase().includes(searchTopic.toLowerCase()) || item.description.toLowerCase().includes(searchTopic.toLowerCase())) {
      discovered.push(item);
    }
  }

  try {
    for (const apiItem of discovered) {
      await query(
        `INSERT INTO discovered_apis (name, source, description, base_url, endpoint_path, method, params_schema, auth_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (name, endpoint_path) DO UPDATE SET description = EXCLUDED.description, is_active = true`,
        [
          apiItem.name,
          apiItem.source,
          apiItem.description,
          apiItem.base_url,
          apiItem.endpoint_path,
          apiItem.method,
          JSON.stringify(apiItem.params_schema),
          apiItem.auth_type
        ]
      );
    }
  } catch (e) {
    console.warn('[DynamicAPIEngine] Aviso al persistir APIs descubiertas:', e.message);
  }

  return discovered;
}

/**
 * Obtener todas las APIs dinámicas activas registradas
 */
async function getRegisteredDynamicApis() {
  try {
    const { rows } = await query(`SELECT * FROM discovered_apis WHERE is_active = true ORDER BY name ASC`);
    if (rows && rows.length > 0) return rows;
  } catch (e) {}

  return INITIAL_DISCOVERY_CATALOG.map((item, idx) => ({ id: `init_${idx}`, ...item, is_active: true }));
}

/**
 * Sincronizar e integrar las APIs descubiertas con el ToolManager existente
 */
async function syncDynamicApisWithToolManager(ToolManager) {
  if (!ToolManager || !ToolManager.tools) return;

  const dynamicApis = await getRegisteredDynamicApis();

  for (const apiConfig of dynamicApis) {
    const toolName = `dynamic.${apiConfig.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    ToolManager.tools[toolName] = (params) => executeDynamicApiRequest(apiConfig, params);
  }
}

module.exports = {
  executeDynamicApiRequest,
  discoverAndRegisterApis,
  getRegisteredDynamicApis,
  syncDynamicApisWithToolManager,
  INITIAL_DISCOVERY_CATALOG,
};

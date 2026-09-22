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
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.localhost')
    ) {
      return false;
    }

    // Comprobar rangos de IP privadas IPv4
    if (/^(10\.|192\.168\.|169\.254\.|100\.64\.|127\.)/.test(hostname)) {
      return false;
    }

    // Rango 172.16.0.0 - 172.31.255.255
    const match172 = hostname.match(/^172\.(\d+)\./);
    if (match172) {
      const secondOctet = parseInt(match172[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) return false;
    }

    // IPv6 privadas/link-local
    if (hostname.startsWith('fe80:') || hostname.startsWith('fd') || hostname.startsWith('fc00:')) {
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
/**
 * Descubrir e interpretar especificación OpenAPI / Swagger (v2 o v3)
 */
async function discoverFromOpenApiSpec(specSource) {
  let specObj = null;

  if (typeof specSource === 'string' && (specSource.startsWith('http://') || specSource.startsWith('https://'))) {
    if (!isUrlAllowed(specSource)) {
      throw new Error(`URL de especificación OpenAPI '${specSource}' rechazada por políticas SSRF.`);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(specSource, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP Error ${res.status} al descargar OpenAPI spec de ${specSource}`);
    specObj = await res.json();
  } else if (typeof specSource === 'object' && specSource !== null) {
    specObj = specSource;
  }

  if (!specObj) return [];

  const discovered = [];
  let baseUrl = '';

  if (specObj.servers && specObj.servers[0] && specObj.servers[0].url) {
    baseUrl = specObj.servers[0].url;
  } else if (specObj.host) {
    const scheme = (specObj.schemes && specObj.schemes[0]) || 'https';
    baseUrl = `${scheme}://${specObj.host}${specObj.basePath || ''}`;
  }

  const paths = specObj.paths || {};
  const apiTitle = specObj.info?.title || 'OpenAPI Service';

  Object.keys(paths).forEach(pathKey => {
    const pathItem = paths[pathKey];
    if (pathItem.get) {
      const getOp = pathItem.get;
      const paramsSchema = {};

      if (Array.isArray(getOp.parameters)) {
        getOp.parameters.forEach(p => {
          if (p.name && p.in === 'query') {
            paramsSchema[p.name] = p.type || (p.schema ? p.schema.type : 'string') || 'string';
          }
        });
      }

      discovered.push({
        name: `${apiTitle} - ${getOp.summary || pathKey}`,
        source: 'OpenAPI Spec',
        description: getOp.description || getOp.summary || `Endpoint ${pathKey} de ${apiTitle}`,
        base_url: baseUrl || 'https://api.example.com',
        endpoint_path: pathKey,
        method: 'GET',
        params_schema: paramsSchema,
        auth_type: 'none',
      });
    }
  });

  return discovered;
}

/**
 * Buscar y registrar nuevas APIs descubiertas en la base de datos
 */
async function discoverAndRegisterApis(searchTopic) {
  const discovered = [];

  // 1. Catálogo inicial estático
  for (const item of INITIAL_DISCOVERY_CATALOG) {
    if (!searchTopic || item.name.toLowerCase().includes(searchTopic.toLowerCase()) || item.description.toLowerCase().includes(searchTopic.toLowerCase())) {
      discovered.push(item);
    }
  }

  // 2. Si el parámetro es una URL de OpenAPI/Swagger doc, descubrir dinámicamente sus endpoints
  if (typeof searchTopic === 'string' && (searchTopic.startsWith('http://') || searchTopic.startsWith('https://')) && (searchTopic.includes('swagger') || searchTopic.includes('openapi') || searchTopic.endsWith('.json'))) {
    try {
      const openApiDiscovered = await discoverFromOpenApiSpec(searchTopic);
      discovered.push(...openApiDiscovered);
    } catch (err) {
      console.warn('[DynamicAPIEngine] No se pudo analizar OpenAPI spec:', err.message);
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
  discoverFromOpenApiSpec,
  getRegisteredDynamicApis,
  syncDynamicApisWithToolManager,
  INITIAL_DISCOVERY_CATALOG,
};

/* =========================================================
   BASE DE DATOS GLOBAL DE PAÍSES, ESTADOS/PROVINCIAS Y PREFIJOS
   ========================================================= */
const PAISES_DATA = [
  {
    code: 'CU',
    flag: '🇨🇺',
    prefix: '+53',
    nombreEs: 'Cuba',
    nombreEn: 'Cuba',
    states: [
      'Pinar del Río', 'Artemisa', 'La Habana', 'Mayabeque', 'Matanzas',
      'Cienfuegos', 'Villa Clara', 'Sancti Spíritus', 'Ciego de Ávila',
      'Camagüey', 'Las Tunas', 'Holguín', 'Granma', 'Santiago de Cuba',
      'Guantánamo', 'Isla de la Juventud'
    ]
  },
  {
    code: 'US',
    flag: '🇺🇸',
    prefix: '+1',
    nombreEs: 'Estados Unidos',
    nombreEn: 'United States',
    states: [
      'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
      'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland',
      'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
      'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
      'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
      'District of Columbia', 'Puerto Rico'
    ]
  },
  {
    code: 'ES',
    flag: '🇪🇸',
    prefix: '+34',
    nombreEs: 'España',
    nombreEn: 'Spain',
    states: [
      'Andalucía', 'Aragón', 'Asturias', 'Baleares', 'Canarias', 'Cantabria', 'Castilla-La Mancha', 'Castilla y León',
      'Cataluña', 'Extremadura', 'Galicia', 'La Rioja', 'Madrid', 'Murcia', 'Navarra', 'País Vasco', 'Comunidad Valenciana',
      'Ceuta', 'Melilla'
    ]
  },
  {
    code: 'MX',
    flag: '🇲🇽',
    prefix: '+52',
    nombreEs: 'México',
    nombreEn: 'Mexico',
    states: [
      'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua', 'Coahuila', 'Colima',
      'Ciudad de México', 'Durango', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Estado de México', 'Michoacán',
      'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa',
      'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas'
    ]
  },
  {
    code: 'CO',
    flag: '🇨🇴',
    prefix: '+57',
    nombreEs: 'Colombia',
    nombreEn: 'Colombia',
    states: [
      'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá D.C.', 'Bolívar', 'Boyacá', 'Caldas', 'Caquetá', 'Casanare',
      'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía', 'Guaviare', 'Huila', 'La Guajira', 'Magdalena',
      'Meta', 'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda', 'San Andrés y Providencia', 'Santander',
      'Sucre', 'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada'
    ]
  },
  {
    code: 'AR',
    flag: '🇦🇷',
    prefix: '+54',
    nombreEs: 'Argentina',
    nombreEn: 'Argentina',
    states: [
      'Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos',
      'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan',
      'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
    ]
  },
  {
    code: 'CL',
    flag: '🇨🇱',
    prefix: '+56',
    nombreEs: 'Chile',
    nombreEn: 'Chile',
    states: [
      'Arica y Parinacota', 'Tarapacá', 'Antofagasta', 'Atacama', 'Coquimbo', 'Valparaíso', 'Región Metropolitana de Santiago',
      "O'Higgins", 'Maule', 'Ñuble', 'Biobío', 'La Araucanía', 'Los Ríos', 'Los Lagos', 'Aysén', 'Magallanes y Antártica Chilena'
    ]
  },
  {
    code: 'VE',
    flag: '🇻🇪',
    prefix: '+58',
    nombreEs: 'Venezuela',
    nombreEn: 'Venezuela',
    states: [
      'Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 'Carabobo', 'Cojedes', 'Delta Amacuro', 'Distrito Capital',
      'Falcón', 'Guárico', 'Lara', 'Mérida', 'Miranda', 'Monagas', 'Nueva Esparta', 'Portuguesa', 'Sucre', 'Táchira',
      'Trujillo', 'La Guaira', 'Yaracuy', 'Zulia'
    ]
  },
  {
    code: 'PE',
    flag: '🇵🇪',
    prefix: '+51',
    nombreEs: 'Perú',
    nombreEn: 'Peru',
    states: [
      'Amazonas', 'Áncash', 'Apurímac', 'Arequipa', 'Ayacucho', 'Cajamarca', 'Callao', 'Cusco', 'Huancavelica', 'Huánuco',
      'Ica', 'Junín', 'La Libertad', 'Lambayeque', 'Lima', 'Loreto', 'Madre de Dios', 'Moquegua', 'Pasco', 'Piura',
      'Puno', 'San Martín', 'Tacna', 'Tumbes', 'Ucayali'
    ]
  },
  {
    code: 'EC',
    flag: '🇪🇨',
    prefix: '+593',
    nombreEs: 'Ecuador',
    nombreEn: 'Ecuador',
    states: [
      'Azuay', 'Bolívar', 'Cañar', 'Carchi', 'Chimborazo', 'Cotopaxi', 'El Oro', 'Esmeraldas', 'Galápagos', 'Guayas',
      'Imbabura', 'Loja', 'Los Ríos', 'Manabí', 'Morona Santiago', 'Napo', 'Orellana', 'Pastaza', 'Pichincha', 'Santa Elena',
      'Santo Domingo de los Tsáchilas', 'Sucumbíos', 'Tungurahua', 'Zamora Chinchipe'
    ]
  },
  {
    code: 'UY',
    flag: '🇺🇾',
    prefix: '+598',
    nombreEs: 'Uruguay',
    nombreEn: 'Uruguay',
    states: [
      'Artigas', 'Canelones', 'Cerro Largo', 'Colonia', 'Durazno', 'Flores', 'Florida', 'Lavalleja', 'Maldonado', 'Montevideo',
      'Paysandú', 'Río Negro', 'Rivera', 'Rocha', 'Salto', 'San José', 'Soriano', 'Tacuarembó', 'Treinta y Tres'
    ]
  },
  {
    code: 'PY',
    flag: '🇵🇾',
    prefix: '+595',
    nombreEs: 'Paraguay',
    nombreEn: 'Paraguay',
    states: [
      'Alto Paraguay', 'Alto Paraná', 'Amambay', 'Asunción', 'Boquerón', 'Caaguazú', 'Caazapá', 'Canindeyú', 'Central',
      'Concepción', 'Cordillera', 'Guairá', 'Itapúa', 'Misiones', 'Ñeembucú', 'Paraguarí', 'Presidente Hayes', 'San Pedro'
    ]
  },
  {
    code: 'BO',
    flag: '🇧🇴',
    prefix: '+591',
    nombreEs: 'Bolivia',
    nombreEn: 'Bolivia',
    states: ['Beni', 'Chuquisaca', 'Cochabamba', 'La Paz', 'Oruro', 'Pando', 'Potosí', 'Santa Cruz', 'Tarija']
  },
  {
    code: 'DO',
    flag: '🇩🇴',
    prefix: '+1',
    nombreEs: 'República Dominicana',
    nombreEn: 'Dominican Republic',
    states: [
      'Distrito Nacional', 'Azua', 'Baoruco', 'Barahona', 'Dajabón', 'Duarte', 'El Seibo', 'Elías Piña', 'Espaillat', 'Hato Mayor',
      'Hermanas Mirabal', 'Independencia', 'La Altagracia', 'La Romana', 'La Vega', 'María Trinidad Sánchez', 'Monseñor Nouel',
      'Monte Cristi', 'Monte Plata', 'Pedernales', 'Peravia', 'Puerto Plata', 'Samaná', 'San Cristóbal', 'San José de Ocoa',
      'San Juan', 'San Pedro de Macorís', 'Sánchez Ramírez', 'Santiago', 'Santiago Rodríguez', 'Santo Domingo', 'Valverde'
    ]
  },
  {
    code: 'GT',
    flag: '🇬🇹',
    prefix: '+502',
    nombreEs: 'Guatemala',
    nombreEn: 'Guatemala',
    states: [
      'Alta Verapaz', 'Baja Verapaz', 'Chimaltenango', 'Chiquimula', 'El Progreso', 'Escuintla', 'Guatemala', 'Huehuetenango',
      'Izabal', 'Jalapa', 'Jutiapa', 'Petén', 'Quetzaltenango', 'Quiché', 'Retalhuleu', 'Sacatepéquez', 'San Marcos',
      'Santa Rosa', 'Sololá', 'Suchitepéquez', 'Totonicapán', 'Zacapa'
    ]
  },
  {
    code: 'CR',
    flag: '🇨🇷',
    prefix: '+506',
    nombreEs: 'Costa Rica',
    nombreEn: 'Costa Rica',
    states: ['San José', 'Alajuela', 'Cartago', 'Heredia', 'Guanacaste', 'Puntarenas', 'Limón']
  },
  {
    code: 'PA',
    flag: '🇵🇦',
    prefix: '+507',
    nombreEs: 'Panamá',
    nombreEn: 'Panama',
    states: [
      'Bocas del Toro', 'Coclé', 'Colón', 'Chiriquí', 'Darién', 'Herrera', 'Los Santos', 'Panamá', 'Panamá Oeste', 'Veraguas',
      'Emberá-Wounaan', 'Guna Yala', 'Ngäbe-Buglé'
    ]
  },
  {
    code: 'HN',
    flag: '🇭🇳',
    prefix: '+504',
    nombreEs: 'Honduras',
    nombreEn: 'Honduras',
    states: [
      'Atlántida', 'Choluteca', 'Colón', 'Comayagua', 'Copán', 'Cortés', 'El Paraíso', 'Francisco Morazán', 'Gracias a Dios',
      'Intibucá', 'Islas de la Bahía', 'La Paz', 'Lempira', 'Ocotepeque', 'Olancho', 'Santa Bárbara', 'Valle', 'Yoro'
    ]
  },
  {
    code: 'SV',
    flag: '🇸🇻',
    prefix: '+503',
    nombreEs: 'El Salvador',
    nombreEn: 'El Salvador',
    states: [
      'Ahuachapán', 'Cabañas', 'Chalatenango', 'Cuscatlán', 'La Libertad', 'La Paz', 'La Unión', 'Morazán', 'San Miguel',
      'San Salvador', 'San Vicente', 'Santa Ana', 'Sonsonate', 'Usulután'
    ]
  },
  {
    code: 'NI',
    flag: '🇳🇮',
    prefix: '+505',
    nombreEs: 'Nicaragua',
    nombreEn: 'Nicaragua',
    states: [
      'Boaco', 'Carazo', 'Chinandega', 'Chontales', 'Estelí', 'Granada', 'Jinotega', 'León', 'Madriz', 'Managua',
      'Masaya', 'Matagalpa', 'Nueva Segovia', 'Rivas', 'Río San Juan', 'RACCN', 'RACCS'
    ]
  },
  {
    code: 'BR',
    flag: '🇧🇷',
    prefix: '+55',
    nombreEs: 'Brasil',
    nombreEn: 'Brazil',
    states: [
      'Acre', 'Alagoas', 'Amapá', 'Amazonas', 'Bahia', 'Ceará', 'Distrito Federal', 'Espírito Santo', 'Goiás', 'Maranhão',
      'Mato Grosso', 'Mato Grosso do Sul', 'Minas Gerais', 'Pará', 'Paraíba', 'Paraná', 'Pernambuco', 'Piauí', 'Rio de Janeiro',
      'Rio Grande do Norte', 'Rio Grande do Sul', 'Rondônia', 'Roraima', 'Santa Catarina', 'São Paulo', 'Sergipe', 'Tocantins'
    ]
  },
  {
    code: 'CA',
    flag: '🇨🇦',
    prefix: '+1',
    nombreEs: 'Canadá',
    nombreEn: 'Canada',
    states: [
      'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador', 'Nova Scotia', 'Ontario',
      'Prince Edward Island', 'Quebec', 'Saskatchewan', 'Northwest Territories', 'Nunavut', 'Yukon'
    ]
  },
  {
    code: 'GB',
    flag: '🇬🇧',
    prefix: '+44',
    nombreEs: 'Reino Unido',
    nombreEn: 'United Kingdom',
    states: ['England', 'Scotland', 'Wales', 'Northern Ireland']
  },
  {
    code: 'FR',
    flag: '🇫🇷',
    prefix: '+33',
    nombreEs: 'Francia',
    nombreEn: 'France',
    states: [
      'Auvergne-Rhône-Alpes', 'Bourgogne-Franche-Comté', 'Bretagne', 'Centre-Val de Loire', 'Corse', 'Grand Est',
      'Hauts-de-France', 'Île-de-France', 'Normandie', 'Nouvelle-Aquitaine', 'Occitanie', 'Pays de la Loire', 'Provence-Alpes-Côte d\'Azur'
    ]
  },
  {
    code: 'DE',
    flag: '🇩🇪',
    prefix: '+49',
    nombreEs: 'Alemania',
    nombreEn: 'Germany',
    states: [
      'Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg', 'Hessen', 'Mecklenburg-Vorpommern',
      'Niedersachsen', 'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland', 'Sachsen', 'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen'
    ]
  },
  {
    code: 'IT',
    flag: '🇮🇹',
    prefix: '+39',
    nombreEs: 'Italia',
    nombreEn: 'Italy',
    states: [
      'Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna', 'Friuli-Venezia Giulia', 'Lazio', 'Liguria', 'Lombardia',
      'Marche', 'Molise', 'Piemonte', 'Puglia', 'Sardegna', 'Sicilia', 'Toscana', 'Trentino-Alto Adige', 'Umbria', "Valle d'Aosta", 'Veneto'
    ]
  },
  {
    code: 'PT',
    flag: '🇵🇹',
    prefix: '+351',
    nombreEs: 'Portugal',
    nombreEn: 'Portugal',
    states: [
      'Aveiro', 'Beja', 'Braga', 'Bragança', 'Castelo Branco', 'Coimbra', 'Évora', 'Faro', 'Guarda', 'Leiria', 'Lisboa',
      'Portalegre', 'Porto', 'Santarém', 'Setúbal', 'Viana do Castelo', 'Vila Real', 'Viseu', 'Açores', 'Madeira'
    ]
  },
  {
    code: 'RU',
    flag: '🇷🇺',
    prefix: '+7',
    nombreEs: 'Rusia',
    nombreEn: 'Russia',
    states: ['Moscow', 'Saint Petersburg', 'Novosibirsk', 'Yekaterinburg', 'Kazan', 'Nizhny Novgorod', 'Chelyabinsk', 'Samara', 'Omsk', 'Rostov-on-Don']
  },
  {
    code: 'CN',
    flag: '🇨🇳',
    prefix: '+86',
    nombreEs: 'China',
    nombreEn: 'China',
    states: ['Beijing', 'Shanghai', 'Guangdong', 'Zhejiang', 'Jiangsu', 'Shandong', 'Sichuan', 'Henan', 'Hubei', 'Fujian']
  },
  {
    code: 'JP',
    flag: '🇯🇵',
    prefix: '+81',
    nombreEs: 'Japón',
    nombreEn: 'Japan',
    states: ['Tokyo', 'Osaka', 'Kanagawa', 'Aichi', 'Saitama', 'Chiba', 'Hokkaido', 'Fukuoka', 'Hyogo', 'Kyoto']
  },
  {
    code: 'KR',
    flag: '🇰🇷',
    prefix: '+82',
    nombreEs: 'Corea del Sur',
    nombreEn: 'South Korea',
    states: ['Seoul', 'Busan', 'Incheon', 'Daegu', 'Daejeon', 'Gwangju', 'Ulsan', 'Gyeonggi', 'Gangwon', 'Jeju']
  },
  {
    code: 'IN',
    flag: '🇮🇳',
    prefix: '+91',
    nombreEs: 'India',
    nombreEn: 'India',
    states: ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Gujarat', 'Uttar Pradesh', 'West Bengal', 'Telangana', 'Kerala', 'Rajasthan']
  },
  {
    code: 'AU',
    flag: '🇦🇺',
    prefix: '+61',
    nombreEs: 'Australia',
    nombreEn: 'Australia',
    states: ['New South Wales', 'Victoria', 'Queensland', 'Western Australia', 'South Australia', 'Tasmania', 'Australian Capital Territory', 'Northern Territory']
  },
  {
    code: 'ZA',
    flag: '🇿🇦',
    prefix: '+27',
    nombreEs: 'Sudáfrica',
    nombreEn: 'South Africa',
    states: ['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Free State', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape']
  },
  {
    code: 'EG',
    flag: '🇪🇬',
    prefix: '+20',
    nombreEs: 'Egipto',
    nombreEn: 'Egypt',
    states: ['Cairo', 'Alexandria', 'Giza', 'Qalyubia', 'Port Said', 'Suez', 'Gharbia', 'Dakahlia', 'Aswan', 'Luxor']
  },
  {
    code: 'MA',
    flag: '🇲🇦',
    prefix: '+212',
    nombreEs: 'Marruecos',
    nombreEn: 'Morocco',
    states: ['Casablanca-Settat', 'Rabat-Salé-Kénitra', 'Tanger-Tetouan-Al Hoceima', 'Marrakesh-Safi', 'Fès-Meknès', 'Souss-Massa']
  },
  {
    code: 'NG',
    flag: '🇳🇬',
    prefix: '+234',
    nombreEs: 'Nigeria',
    nombreEn: 'Nigeria',
    states: ['Lagos', 'Kano', 'Ibadan', 'Abuja', 'Rivers', 'Kaduna', 'Oyo', 'Enugu', 'Edo', 'Delta']
  },
  {
    code: 'TR',
    flag: '🇹🇷',
    prefix: '+90',
    nombreEs: 'Turquía',
    nombreEn: 'Turkey',
    states: ['Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Antalya', 'Adana', 'Konya', 'Gaziantep', 'Sanliurfa', 'Kocaeli']
  },
  {
    code: 'SA',
    flag: '🇸🇦',
    prefix: '+966',
    nombreEs: 'Arabia Saudita',
    nombreEn: 'Saudi Arabia',
    states: ['Riyadh', 'Makkah', 'Madinah', 'Eastern Province', 'Asir', 'Tabuk', 'Hail', 'Northern Borders', 'Jazan', 'Najran']
  },
  {
    code: 'AE',
    flag: '🇦🇪',
    prefix: '+971',
    nombreEs: 'Emiratos Árabes Unidos',
    nombreEn: 'United Arab Emirates',
    states: ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah']
  }
];

// Utilidades para consultar el dataset de países
function obtenerPaisPorCodigo(code) {
  if (!code) return PAISES_DATA[0];
  const c = String(code).trim().toUpperCase();
  return PAISES_DATA.find((p) => p.code === c) || PAISES_DATA[0];
}

function obtenerPaisPorNombre(nombre) {
  if (!nombre) return PAISES_DATA[0];
  const n = String(nombre).trim().toLowerCase();
  return PAISES_DATA.find((p) => p.nombreEs.toLowerCase() === n || p.nombreEn.toLowerCase() === n) || PAISES_DATA[0];
}

function obtenerNombrePais(pais, lang = 'es') {
  if (!pais) return '';
  return lang === 'en' ? (pais.nombreEn || pais.nombreEs) : pais.nombreEs;
}

function poblarSelectPaises(selectElem, lang = 'es', valorActual = '') {
  if (!selectElem) return;
  const paisesOrdenados = [...PAISES_DATA].sort((a, b) =>
    obtenerNombrePais(a, lang).localeCompare(obtenerNombrePais(b, lang))
  );

  selectElem.innerHTML = paisesOrdenados.map((p) => {
    const nombre = obtenerNombrePais(p, lang);
    return `<option value="${p.code}" data-flag="${p.flag}" data-prefix="${p.prefix}">${p.flag} ${nombre}</option>`;
  }).join('');

  if (valorActual) {
    const p = PAISES_DATA.find(x => x.code === valorActual || x.nombreEs.toLowerCase() === valorActual.toLowerCase() || x.nombreEn.toLowerCase() === valorActual.toLowerCase());
    if (p) selectElem.value = p.code;
  }
}

function poblarSelectEstados(selectEstadoElem, codigoOPais, lang = 'es', valorActual = '') {
  if (!selectEstadoElem) return;
  let paisObj = typeof codigoOPais === 'object' ? codigoOPais : obtenerPaisPorCodigo(codigoOPais);
  if (!paisObj) paisObj = PAISES_DATA[0];

  const estados = paisObj.states || [];
  const placeholderText = lang === 'en' ? 'Select state/province...' : 'Selecciona estado / provincia...';

  selectEstadoElem.innerHTML = `<option value="">${placeholderText}</option>` +
    estados.map((est) => `<option value="${est}">${est}</option>`).join('') +
    `<option value="OTRO">${lang === 'en' ? 'Other / Unlisted' : 'Otro / No listado'}</option>`;

  if (valorActual) {
    const coincidencia = estados.find(e => e.toLowerCase() === valorActual.toLowerCase());
    if (coincidencia) {
      selectEstadoElem.value = coincidencia;
    } else {
      selectEstadoElem.value = 'OTRO';
    }
  }
}

function poblarSelectPrefijos(selectPrefijoElem, valorActual = '+53') {
  if (!selectPrefijoElem) return;
  // Obtener prefijos únicos y ordenados por código
  const prefijosMap = new Map();
  PAISES_DATA.forEach(p => {
    if (!prefijosMap.has(p.prefix)) {
      prefijosMap.set(p.prefix, `${p.flag} ${p.nombreEs} (${p.prefix})`);
    }
  });

  const optionsHTML = Array.from(prefijosMap.entries()).map(([pref, label]) =>
    `<option value="${pref}">${label}</option>`
  ).join('');

  selectPrefijoElem.innerHTML = optionsHTML;
  if (valorActual) selectPrefijoElem.value = valorActual;
}

window.PAISES_DATA = PAISES_DATA;
window.obtenerPaisPorCodigo = obtenerPaisPorCodigo;
window.obtenerPaisPorNombre = obtenerPaisPorNombre;
window.obtenerNombrePais = obtenerNombrePais;
window.poblarSelectPaises = poblarSelectPaises;
window.poblarSelectEstados = poblarSelectEstados;
window.poblarSelectPrefijos = poblarSelectPrefijos;

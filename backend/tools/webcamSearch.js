/**
 * Herramienta: webcam.search()
 * Búsqueda de cámaras públicas y transmisiones panorámicas
 */
async function search(location) {
  const queryLoc = (location || 'Tokio').toLowerCase().trim();

  const realPublicSources = [
    {
      keywords: ['tokio', 'tokyo', 'shibuya', 'japon', 'japan'],
      title: 'Shibuya Scramble Crossing Cam',
      location: 'Shibuya, Tokio, Japón',
      preview: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=800&auto=format&fit=crop&q=80',
      official_url: 'https://www.youtube.com/watch?v=HpdO5NkuiOM',
      source_type: 'Fuente Pública Oficial (YouTube Live)',
      status: 'Transmisión Pública Externa',
    },
    {
      keywords: ['madrid', 'puerta del sol', 'españa', 'spain'],
      title: 'Cámara Panorámica Puerta del Sol',
      location: 'Madrid, España',
      preview: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=800&auto=format&fit=crop&q=80',
      official_url: 'https://www.madrid.es',
      source_type: 'Fuente Pública Municipal',
      status: 'Acceso Externo Oficial',
    },
    {
      keywords: ['nueva york', 'new york', 'times square', 'usa', 'eeuu'],
      title: 'Times Square Street Live Cam',
      location: 'Nueva York, EE. UU.',
      preview: 'https://images.unsplash.com/photo-1506146332389-18140dc7b2fb?w=800&auto=format&fit=crop&q=80',
      official_url: 'https://www.timessquarenyc.org/live-stream',
      source_type: 'Fuente Pública Oficial',
      status: 'Directo Web',
    },
    {
      keywords: ['paris', 'torre eiffel', 'francia', 'france'],
      title: 'Vista Panorámica Torre Eiffel',
      location: 'París, Francia',
      preview: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&auto=format&fit=crop&q=80',
      official_url: 'https://www.toureiffel.paris',
      source_type: 'Fuente Pública Oficial',
      status: 'Vista Panorámica',
    },
    {
      keywords: ['habana', 'cuba', 'malecon'],
      title: 'Vista Malecón Habanero',
      location: 'La Habana, Cuba',
      preview: 'https://images.unsplash.com/photo-1500835556837-99ac94a94552?w=800&auto=format&fit=crop&q=80',
      official_url: 'https://www.google.com/search?q=camara+publica+malecon+habana',
      source_type: 'Resultado Externo',
      status: 'Consulta Externa',
    }
  ];

  const match = realPublicSources.find(cam =>
    cam.keywords.some(kw => queryLoc.includes(kw))
  );

  if (match) {
    return {
      type: 'webcam_card',
      data: match,
    };
  }

  // Fallback para ubicaciones sin cámara mapeada
  return {
    type: 'webcam_card',
    data: {
      title: `Búsqueda de Cámaras en ${location}`,
      location: location,
      preview: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&auto=format&fit=crop&q=80',
      official_url: `https://www.google.com/search?q=${encodeURIComponent('webcam live stream ' + location)}`,
      source_type: 'Búsqueda Externa Pública',
      status: 'Enlace a Fuentes Públicas',
    }
  };
}

module.exports = { search };

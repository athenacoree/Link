/* Lógica para Link Video (Streaming de Películas, Video y Audio) */

function escapeHTMLLinkVideo(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.LinkVideo = {
  initialized: false,
  catalog: [],
  baseUrl: '',

  async init() {
    if (this.initialized) return;
    this.initialized = true;
    await this.cargarCatalogo();
  },

  async cargarCatalogo() {
    const contenedor = document.getElementById('linkVideoGrid');
    if (!contenedor) return;

    contenedor.innerHTML = `<div style="text-align:center; padding:30px; color:var(--texto-500); font-weight:700;">Cargando catálogo de Link Video...</div>`;

    try {
      const res = await api('/linkvideo/catalog');
      if (res && Array.isArray(res.catalog)) {
        this.catalog = res.catalog;
        this.baseUrl = res.base_url || '';
        this.renderizarCatalogo(this.catalog);
      } else {
        contenedor.innerHTML = `<div class="aviso-vacio">No hay transmisiones disponibles en este momento.</div>`;
      }
    } catch (err) {
      console.error('Error al cargar catálogo de Link Video:', err);
      contenedor.innerHTML = `<div class="aviso-vacio">No se pudo conectar con el servidor de streaming de Link Video.</div>`;
    }
  },

  renderizarCatalogo(lista) {
    const contenedor = document.getElementById('linkVideoGrid');
    if (!contenedor) return;

    if (!lista || lista.length === 0) {
      contenedor.innerHTML = `<div class="aviso-vacio">No se encontraron contenidos transmitiendo.</div>`;
      return;
    }

    contenedor.innerHTML = lista.map(item => {
      const isVideo = item.type === 'video' || item.category === 'movies';
      const icon = isVideo ? '🎬' : '🎧';
      const typeLabel = isVideo ? 'Video / Película' : 'Audio / Radio';
      const playUrl = item.full_url || item.url || (this.baseUrl + (item.id ? item.id + '/' : ''));

      return `
        <div class="card" style="padding:14px; border-radius:16px; background:var(--blanco); border:1px solid var(--borde); display:flex; flex-direction:column; justify-space-between;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-size:24px;">${icon}</span>
              <span style="font-size:10px; font-weight:800; background:rgba(139,92,246,0.15); color:var(--morado-600); padding:3px 8px; border-radius:12px; text-transform:uppercase;">${typeLabel}</span>
            </div>
            <div style="font-weight:800; font-size:15px; color:var(--texto-900); margin-bottom:4px;">${escapeHTMLLinkVideo(item.title || item.name || 'Transmisión')}</div>
            <div style="font-size:12px; color:var(--texto-600); line-height:1.4; margin-bottom:12px;">${escapeHTMLLinkVideo(item.description || 'Transmisión en vivo y streaming continuo.')}</div>
          </div>
          <button class="btn btn-primario" style="width:100%; border-radius:10px; font-weight:800; padding:10px; display:inline-flex; align-items:center; justify-content:center; gap:6px;" onclick="LinkVideo.reproducir('${escapeHTMLLinkVideo(playUrl)}', '${escapeHTMLLinkVideo(item.title || item.name)}')">
            <span>▶ Reproducir</span>
          </button>
        </div>
      `;
    }).join('');
  },

  reproducir(url, titulo) {
    if (window.abrirVideoStream) {
      window.abrirVideoStream(url, titulo);
    } else if (window.abrirJuego) {
      window.abrirJuego(url, titulo, 'linkvideo');
    } else {
      window.open(url, '_blank');
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('vistaAilab')) {
    window.LinkVideo.init();
  }
});

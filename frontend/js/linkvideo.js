/* Lógica para Link Video (Streaming de Películas, Video y Audio) y Link Live (Transmisiones Persistentes) */

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
  collections: [],
  catalog: [],
  activeLives: [],
  baseUrl: '',

  // Colección actual seleccionada y cola de reproductor
  currentCollection: null,
  currentVideos: [],
  currentVideoIndex: -1,

  // Estado del Streamer (Host)
  isHost: false,
  activeSessionId: null,
  localMediaStream: null,
  heartbeatInterval: null,
  peerConnections: new Map(), // socketId -> RTCPeerConnection
  micMuted: false,
  camOff: false,

  // Estado del Espectador (Viewer)
  isViewer: false,
  viewerSessionId: null,
  viewerPeerConnection: null,
  intermissionClips: [
    'reconectando.mp4',
    'un-momento.mp4',
    'seguimos-aqui.mp4',
    'estamos-de-vuelta.mp4'
  ],
  currentClipIndex: 0,
  intermissionInterval: null,

  async init() {
    if (this.initialized) return;
    this.initialized = true;
    this.setupSocketListeners();
    this.setupNetworkListeners();
    await this.cargarCatalogo();
  },

  setupNetworkListeners() {
    window.addEventListener('online', async () => {
      console.log('[LinkLive] Red reconectada (online). Intentando recuperar transmisión...');
      if (this.isHost && this.activeSessionId) {
        await this.reintentarConexionStreamer();
      } else if (this.isViewer && this.viewerSessionId) {
        this.reintentarConexionViewer();
      }
    });
  },

  setupSocketListeners() {
    if (!window.socket) return;

    window.socket.on('connect', async () => {
      if (this.isHost && this.activeSessionId) {
        console.log('[LinkLive] Socket reconectado. Reasociando streamer session:', this.activeSessionId);
        await this.reintentarConexionStreamer();
      } else if (this.isViewer && this.viewerSessionId) {
        console.log('[LinkLive] Socket reconectado. Reasociando espectador a room:', this.viewerSessionId);
        window.socket.emit('live:join', { sessionId: this.viewerSessionId });
      }
    });

    window.socket.on('youtube:channel_updated', (data) => {
      if (data && data.channel) {
        console.log('[LinkVideo] Canal de YouTube actualizado:', data.channel);
        this.cargarCatalogo(false);
      }
    });

    window.socket.on('live:status_changed', (data) => {
      if (this.isViewer && data.sessionId === this.viewerSessionId) {
        this.procesarCambioEstadoViewer(data.status, data.session);
      }
      if (this.isHost && data.sessionId === this.activeSessionId) {
        this.actualizarUIStateStreamer(data.status);
      }
    });

    window.socket.on('live:viewer_count', (data) => {
      if (this.isHost && data.sessionId === this.activeSessionId) {
        const countEl = document.getElementById('streamerViewerCount');
        if (countEl) countEl.textContent = data.viewerCount || 0;
      }
      if (this.isViewer && data.sessionId === this.viewerSessionId) {
        const countEl = document.getElementById('viewerLiveCount');
        if (countEl) countEl.textContent = data.viewerCount || 0;
      }
    });

    window.socket.on('live:offer', async ({ sessionId, sdp, senderSocketId }) => {
      if (this.isViewer && sessionId === this.viewerSessionId) {
        await this.manejarOfertaWebRTCViewer(sdp, senderSocketId);
      }
    });

    window.socket.on('live:answer', async ({ sessionId, sdp, senderSocketId }) => {
      if (this.isHost && sessionId === this.activeSessionId) {
        const pc = this.peerConnections.get(senderSocketId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        }
      }
    });

    window.socket.on('live:ice_candidate', async ({ sessionId, candidate, senderSocketId }) => {
      if (this.isViewer && sessionId === this.viewerSessionId && this.viewerPeerConnection) {
        try {
          await this.viewerPeerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {}
      } else if (this.isHost && sessionId === this.activeSessionId) {
        const pc = this.peerConnections.get(senderSocketId);
        if (pc) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {}
        }
      }
    });
  },

  searchQuery: '',
  selectedCategory: 'Todas',

  async cargarCatalogo(forceRefresh = false) {
    const gridEl = document.getElementById('linkVideoCollectionsGrid');
    if (!gridEl) return;

    gridEl.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; padding:30px; color:var(--texto-500); font-weight:700;">Cargando colecciones de Link Video...</div>`;

    try {
      const url = forceRefresh ? '/linkvideo/catalog?refresh=true' : '/linkvideo/catalog';
      const res = await api(url);
      if (res) {
        this.collections = res.collections || [];
        this.catalog = res.catalog || [];
        this.activeLives = res.lives || [];
        this.baseUrl = res.base_url || '';
        this.setupUIControls();
        this.renderizarColecciones(this.collections);
      } else {
        gridEl.innerHTML = `<div class="aviso-vacio" style="grid-column: 1 / -1;">No hay colecciones disponibles en este momento.</div>`;
      }
    } catch (err) {
      console.error('Error al cargar catálogo de Link Video:', err);
      gridEl.innerHTML = `<div class="aviso-vacio" style="grid-column: 1 / -1;">No se pudo conectar con el servidor de streaming de Link Video.</div>`;
    }
  },

  setupUIControls() {
    const searchInput = document.getElementById('linkVideoSearchInput');
    if (searchInput) {
      searchInput.oninput = (e) => {
        this.searchQuery = (e.target.value || '').trim().toLowerCase();
        if (this.currentCollection) {
          this.renderizarDetalleColeccion(this.currentCollection);
        } else {
          this.renderizarColecciones(this.collections);
        }
      };
    }
  },

  renderizarColecciones(colecciones) {
    const gridEl = document.getElementById('linkVideoCollectionsGrid');
    const detailView = document.getElementById('linkVideoCollectionDetailView');
    if (!gridEl) return;

    if (detailView) {
      detailView.style.display = 'none';
      detailView.innerHTML = '';
    }
    gridEl.style.display = 'grid';
    this.currentCollection = null;

    // Extraer categorías únicas
    const catSet = new Set(['Todas']);
    (colecciones || []).forEach(c => {
      if (c.category) {
        c.category.split(',').forEach(subCat => {
          const trimmed = subCat.trim();
          if (trimmed) catSet.add(trimmed);
        });
      }
    });

    const categoriasUnicas = Array.from(catSet);

    // Crear barra de píldoras de categorías si no existe
    let catBar = document.getElementById('linkVideoCategoryBar');
    if (!catBar) {
      catBar = document.createElement('div');
      catBar.id = 'linkVideoCategoryBar';
      catBar.style.cssText = 'display:flex; gap:8px; overflow-x:auto; margin-bottom:14px; padding-bottom:4px; width:100%; box-sizing:border-box; scrollbar-width:none;';
      gridEl.parentNode.insertBefore(catBar, gridEl);
    }

    catBar.style.display = 'flex';
    catBar.innerHTML = categoriasUnicas.map(cat => {
      const activo = (this.selectedCategory === cat) ? 'background:var(--morado-600); color:#fff;' : 'background:var(--fondo-tarjeta); color:var(--texto-800); border:1px solid var(--borde);';
      return `<button class="mini-btn" style="padding:6px 12px; border-radius:14px; font-weight:800; font-size:12px; white-space:nowrap; cursor:pointer; ${activo}" onclick="LinkVideo.filtrarPorCategoria('${escapeHTMLLinkVideo(cat)}')">${escapeHTMLLinkVideo(cat)}</button>`;
    }).join('');

    let filtradas = colecciones || [];

    if (this.selectedCategory && this.selectedCategory !== 'Todas') {
      const sel = this.selectedCategory.toLowerCase();
      filtradas = filtradas.filter(c => (c.category || '').toLowerCase().includes(sel));
    }

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtradas = filtradas.filter(c => (c.name || '').toLowerCase().includes(q) || (c.category || '').toLowerCase().includes(q));
    }

    if (!filtradas || filtradas.length === 0) {
      gridEl.innerHTML = `<div class="aviso-vacio" style="grid-column: 1 / -1; padding:30px;">No se encontraron colecciones o álbumes.</div>`;
      return;
    }

    gridEl.innerHTML = filtradas.map(col => {
      const cover = col.cover_url || 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=600';
      const count = col.video_count || (col.videos ? col.videos.length : 0);
      const categoryTag = col.category || 'General';

      return `
        <div class="linkvideo-square-card" onclick="LinkVideo.abrirColeccion('${col.id}')">
          <img class="linkvideo-card-thumb-img" src="${cover}" alt="${escapeHTMLLinkVideo(col.name)}" onerror="this.src='https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=600'">
          <div class="linkvideo-card-overlay-gradient">
            <div style="font-size:10px; font-weight:800; background:rgba(0,0,0,0.6); color:#ddd6fe; padding:2px 6px; border-radius:6px; width:fit-content; margin-bottom:4px;">🏷️ ${escapeHTMLLinkVideo(categoryTag)}</div>
            <div class="linkvideo-card-title">${escapeHTMLLinkVideo(col.name)}</div>
            <div class="linkvideo-card-badge-count">🎬 ${count} video${count === 1 ? '' : 's'}</div>
          </div>
        </div>
      `;
    }).join('');
  },

  filtrarPorCategoria(cat) {
    this.selectedCategory = cat;
    this.renderizarColecciones(this.collections);
  },

  async abrirColeccion(collectionId) {
    const gridEl = document.getElementById('linkVideoCollectionsGrid');
    const detailView = document.getElementById('linkVideoCollectionDetailView');
    if (!gridEl || !detailView) return;

    gridEl.style.display = 'none';
    detailView.style.display = 'block';
    detailView.innerHTML = `<div style="text-align:center; padding:30px; color:var(--texto-500); font-weight:700;">Cargando videos de la colección...</div>`;

    try {
      const res = await api(`/linkvideo/collections/${collectionId}`);
      if (res && res.collection) {
        this.currentCollection = res.collection;
        this.currentVideos = res.collection.videos || [];
        this.renderizarDetalleColeccion(this.currentCollection);
      } else {
        detailView.innerHTML = `<div class="aviso-vacio">No se pudo cargar la colección.</div>`;
      }
    } catch (err) {
      detailView.innerHTML = `<div class="aviso-vacio">Error al obtener detalles de la colección.</div>`;
    }
  },

  renderizarDetalleColeccion(col) {
    const detailView = document.getElementById('linkVideoCollectionDetailView');
    const catBar = document.getElementById('linkVideoCategoryBar');
    if (catBar) catBar.style.display = 'none';

    if (!detailView) return;

    let videos = col.videos || [];
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      videos = videos.filter(v => (v.title || '').toLowerCase().includes(q));
    }

    const cover = col.cover_url || 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=600';
    const categoryTag = col.category || 'General';
    const esAdmin = !!(window.currentUser?.is_admin || window.MI_ES_ADMIN);

    detailView.innerHTML = `
      <div style="margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <button class="btn btn-secundario mini-btn" onclick="LinkVideo.volverAColecciones()" style="padding:8px 14px; font-weight:800; border-radius:12px;">
            ‹ Volver a Colecciones
          </button>
          ${esAdmin ? `
            <button class="btn btn-primario mini-btn" onclick="LinkVideo.abrirModalAdminAlbum('${col.id}')" style="padding:8px 14px; font-weight:800; border-radius:12px; background:linear-gradient(135deg, #7c3aed, #ec4899);">
              ⚙️ Administrar álbum
            </button>
          ` : ''}
        </div>
        <div style="display:flex; align-items:center; gap:14px; background:var(--blanco); border:1.5px solid rgba(139, 92, 246, 0.2); border-radius:18px; padding:12px; box-shadow:0 4px 16px rgba(91, 33, 182, 0.08);">
          <img src="${cover}" style="width:64px; height:64px; border-radius:14px; object-fit:cover;" alt="Cover">
          <div>
            <div style="font-weight:900; font-size:16px; color:var(--texto-900);">${escapeHTMLLinkVideo(col.name)}</div>
            <div style="display:flex; gap:6px; align-items:center; margin-top:2px;">
              <span style="font-size:11px; font-weight:800; background:var(--morado-100); color:var(--morado-700); padding:2px 8px; border-radius:8px;">🏷️ ${escapeHTMLLinkVideo(categoryTag)}</span>
              <span style="font-size:12px; color:var(--morado-700); font-weight:700;">${videos.length} video${videos.length === 1 ? '' : 's'}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="grid-cuadrados-linkvideo" id="linkVideoVideosGrid">
        ${videos.length === 0 ? `<div class="aviso-vacio" style="grid-column: 1 / -1;">Esta colección no tiene videos aún.</div>` : videos.map((v, idx) => `
          <div class="linkvideo-video-item">
            <div class="linkvideo-square-card" onclick="LinkVideo.reproducirVideoColeccion(${idx})">
              <img class="linkvideo-card-thumb-img" src="${v.thumbnail_url || 'https://img.youtube.com/vi/' + v.video_id + '/hqdefault.jpg'}" alt="${escapeHTMLLinkVideo(v.title)}">
              <div class="linkvideo-card-overlay-gradient">
                <div style="font-size:26px; text-align:center; margin:auto;">▶</div>
              </div>
            </div>
            <div class="linkvideo-video-title-below" title="${escapeHTMLLinkVideo(v.title)}">${escapeHTMLLinkVideo(v.title)}</div>
          </div>
        `).join('')}
      </div>
    `;
  },

  // Direct In-Place Album Administration Modal & Handlers
  async abrirModalAdminAlbum(colId) {
    let modal = document.getElementById('modalAdminAlbumLinkVideo');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalAdminAlbumLinkVideo';
      modal.style.cssText = 'position:fixed; inset:0; z-index:100005; background:rgba(0,0,0,0.7); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; padding:16px;';
      document.body.appendChild(modal);
    }

    modal.style.display = 'flex';
    modal.innerHTML = `<div style="background:var(--blanco); border-radius:20px; padding:24px; color:var(--texto-900); text-align:center; font-weight:800;">Cargando datos para administrar el álbum...</div>`;

    try {
      const res = await api(`/linkvideo/collections/${colId}`);
      if (!res || !res.collection) throw new Error('No se pudo obtener la colección');

      const col = res.collection;
      const videos = col.videos || [];

      modal.innerHTML = `
        <div style="background:var(--blanco); border-radius:24px; width:100%; max-width:520px; max-height:90vh; overflow-y:auto; padding:20px; box-shadow:0 12px 32px rgba(0,0,0,0.3); position:relative; color:var(--texto-900);">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--linea); padding-bottom:12px; margin-bottom:16px;">
            <div style="font-size:18px; font-weight:900; color:var(--morado-700);">⚙️ Administrar Álbum</div>
            <button onclick="LinkVideo.cerrarModalAdminAlbum()" style="background:var(--hueso); border:none; width:32px; height:32px; border-radius:50%; font-size:18px; font-weight:bold; cursor:pointer;">&times;</button>
          </div>

          <!-- Modificar Álbum -->
          <div style="background:var(--hueso); border-radius:16px; padding:14px; margin-bottom:16px; border:1px solid var(--linea);">
            <div style="font-size:13px; font-weight:800; color:var(--morado-700); margin-bottom:8px;">Datos del Álbum</div>
            <div class="campo" style="margin-bottom:8px;">
              <label>Nombre del Álbum</label>
              <input type="text" id="adminAlbumNameInput" value="${escapeHTMLLinkVideo(col.name)}">
            </div>
            <div class="campo" style="margin-bottom:8px;">
              <label>URL de Portada</label>
              <input type="text" id="adminAlbumCoverInput" value="${escapeHTMLLinkVideo(col.cover_url || '')}">
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-primario mini-btn" style="flex:1;" onclick="LinkVideo.guardarCambiosAlbum('${col.id}')">💾 Guardar Álbum</button>
              <button class="btn btn-secundario mini-btn peligro" onclick="LinkVideo.eliminarAlbumDirecto('${col.id}')">🗑️ Eliminar</button>
            </div>
          </div>

          <!-- Agregar Nuevo Video -->
          <div style="background:var(--hueso); border-radius:16px; padding:14px; margin-bottom:16px; border:1px solid var(--linea);">
            <div style="font-size:13px; font-weight:800; color:var(--morado-700); margin-bottom:8px;">➕ Agregar Video de YouTube</div>
            <div class="campo" style="margin-bottom:8px;">
              <label>URL de YouTube (watch, youtu.be o shorts)</label>
              <input type="text" id="adminAlbumVideoUrlInput" placeholder="https://www.youtube.com/watch?v=..." oninput="LinkVideo.vistaPreviaVideoInput(this.value)">
            </div>
            <div id="adminAlbumPreviewContainer" style="display:none; margin-bottom:8px; text-align:center;">
              <img id="adminAlbumPreviewThumb" src="" style="width:120px; height:70px; object-fit:cover; border-radius:8px; margin-bottom:4px;">
              <div id="adminAlbumPreviewId" style="font-size:11px; font-weight:700; color:var(--morado-700);"></div>
            </div>
            <div class="campo" style="margin-bottom:8px;">
              <label>Título del Video (Opcional - Autodetectado)</label>
              <input type="text" id="adminAlbumVideoTitleInput" placeholder="Título personalizado">
            </div>
            <button class="btn btn-primario mini-btn" style="width:100%;" onclick="LinkVideo.agregarVideoAAlbum('${col.id}')">✨ Agregar Video al Álbum</button>
          </div>

          <!-- Lista de Videos -->
          <div style="font-size:13px; font-weight:800; color:var(--texto-900); margin-bottom:8px;">Vídeos del Álbum (${videos.length})</div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${videos.length === 0 ? `<div style="font-size:12px; color:var(--texto-500); text-align:center; padding:12px;">No hay vídeos en este álbum.</div>` : videos.map((v) => `
              <div style="display:flex; align-items:center; gap:10px; background:var(--blanco); border:1px solid var(--linea); border-radius:12px; padding:8px;">
                <img src="${v.thumbnail_url || 'https://img.youtube.com/vi/' + v.video_id + '/hqdefault.jpg'}" style="width:48px; height:36px; border-radius:6px; object-fit:cover; flex-shrink:0;">
                <div style="flex:1; min-width:0;">
                  <input type="text" id="vidTitle_${v.id}" value="${escapeHTMLLinkVideo(v.title)}" style="width:100%; font-size:12px; font-weight:700; border:1px solid var(--linea); border-radius:6px; padding:4px 6px;">
                </div>
                <div style="display:flex; gap:4px; flex-shrink:0;">
                  <button class="mini-btn primario" onclick="LinkVideo.guardarTituloVideo('${v.id}')" title="Guardar título">💾</button>
                  <button class="mini-btn peligro" onclick="LinkVideo.eliminarVideoDeAlbum('${col.id}', '${v.id}')" title="Eliminar video">🗑️</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } catch (err) {
      modal.innerHTML = `<div style="background:var(--blanco); border-radius:20px; padding:20px; color:var(--peligro); text-align:center;">Error al cargar datos del álbum: ${err.message}<br><br><button class="btn btn-secundario mini-btn" onclick="LinkVideo.cerrarModalAdminAlbum()">Cerrar</button></div>`;
    }
  },

  cerrarModalAdminAlbum() {
    const modal = document.getElementById('modalAdminAlbumLinkVideo');
    if (modal) modal.style.display = 'none';
  },

  extractYouTubeIdLocal(url) {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    const regExp = /^(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&].*)?$/;
    const match = trimmed.match(regExp);
    return (match && match[1]) ? match[1] : null;
  },

  vistaPreviaVideoInput(url) {
    const videoId = this.extractYouTubeIdLocal(url);
    const container = document.getElementById('adminAlbumPreviewContainer');
    const thumb = document.getElementById('adminAlbumPreviewThumb');
    const badge = document.getElementById('adminAlbumPreviewId');

    if (videoId && container && thumb && badge) {
      thumb.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      badge.textContent = 'Video ID: ' + videoId;
      container.style.display = 'block';
    } else if (container) {
      container.style.display = 'none';
    }
  },

  async guardarCambiosAlbum(colId) {
    const name = document.getElementById('adminAlbumNameInput')?.value.trim();
    const cover_url = document.getElementById('adminAlbumCoverInput')?.value.trim();

    if (!name) {
      if (window.mostrarToast) window.mostrarToast('Ingresa un nombre para el álbum.');
      return;
    }

    try {
      await api(`/linkvideo/admin/collections/${colId}`, { method: 'PUT', body: { name, cover_url } });
      if (window.mostrarToast) window.mostrarToast('Álbum actualizado');
      this.cerrarModalAdminAlbum();
      await this.cargarCatalogo();
      await this.abrirColeccion(colId);
    } catch (err) {
      if (window.mostrarToast) window.mostrarToast(err.message || 'Error al actualizar el álbum.');
    }
  },

  async eliminarAlbumDirecto(colId) {
    if (!confirm('¿Seguro que deseas eliminar este álbum y todos sus vídeos?')) return;
    try {
      await api(`/linkvideo/admin/collections/${colId}`, { method: 'DELETE' });
      if (window.mostrarToast) window.mostrarToast('Álbum eliminado');
      this.cerrarModalAdminAlbum();
      await this.cargarCatalogo();
    } catch (err) {
      if (window.mostrarToast) window.mostrarToast(err.message || 'Error al eliminar el álbum.');
    }
  },

  async agregarVideoAAlbum(colId) {
    const url = document.getElementById('adminAlbumVideoUrlInput')?.value.trim();
    const title = document.getElementById('adminAlbumVideoTitleInput')?.value.trim();

    if (!url) {
      if (window.mostrarToast) window.mostrarToast('Ingresa una URL de YouTube.');
      return;
    }

    try {
      await api(`/linkvideo/admin/collections/${colId}/videos`, { method: 'POST', body: { url, title } });
      if (window.mostrarToast) window.mostrarToast('¡Video agregado con éxito!');
      await this.abrirModalAdminAlbum(colId);
      const res = await api(`/linkvideo/collections/${colId}`);
      if (res && res.collection) {
        this.currentCollection = res.collection;
        this.currentVideos = res.collection.videos || [];
        this.renderizarDetalleColeccion(this.currentCollection);
      }
    } catch (err) {
      if (window.mostrarToast) window.mostrarToast(err.message || 'Error al agregar el video.');
    }
  },

  async guardarTituloVideo(videoId) {
    const input = document.getElementById(`vidTitle_${videoId}`);
    const title = input ? input.value.trim() : '';
    if (!title) return;

    try {
      await api(`/linkvideo/admin/videos/${videoId}`, { method: 'PUT', body: { title } });
      if (window.mostrarToast) window.mostrarToast('Título actualizado');
      if (this.currentCollection) {
        const res = await api(`/linkvideo/collections/${this.currentCollection.id}`);
        if (res && res.collection) {
          this.currentCollection = res.collection;
          this.currentVideos = res.collection.videos || [];
          this.renderizarDetalleColeccion(this.currentCollection);
        }
      }
    } catch (err) {
      if (window.mostrarToast) window.mostrarToast('Error al actualizar título.');
    }
  },

  async eliminarVideoDeAlbum(colId, videoId) {
    if (!confirm('¿Eliminar este vídeo del álbum?')) return;
    try {
      await api(`/linkvideo/admin/videos/${videoId}`, { method: 'DELETE' });
      if (window.mostrarToast) window.mostrarToast('Video eliminado');
      await this.abrirModalAdminAlbum(colId);
      const res = await api(`/linkvideo/collections/${colId}`);
      if (res && res.collection) {
        this.currentCollection = res.collection;
        this.currentVideos = res.collection.videos || [];
        this.renderizarDetalleColeccion(this.currentCollection);
      }
    } catch (err) {
      if (window.mostrarToast) window.mostrarToast(err.message || 'Error al eliminar el video.');
    }
  },

  volverAColecciones() {
    this.renderizarColecciones(this.collections);
  },

  reproducirVideoColeccion(index) {
    if (!this.currentVideos || !this.currentVideos[index]) return;
    this.currentVideoIndex = index;
    const video = this.currentVideos[index];
    this.abrirReproductorLinkVideo(video);
  },

  abrirReproductorLinkVideo(video) {
    if (!video || !video.video_id) return;

    let modal = document.getElementById('modalPlayerLinkVideo');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalPlayerLinkVideo';
      modal.style.cssText = 'position:fixed; inset:0; z-index:100000; background:#000; display:flex; flex-direction:column; color:#fff; overflow:hidden;';
      document.body.appendChild(modal);
    }

    modal.style.display = 'flex';

    let rawOrigin = window.location.origin;
    if (!rawOrigin || rawOrigin === 'null' || rawOrigin.startsWith('file://')) {
      rawOrigin = window.location.protocol && window.location.host ? (window.location.protocol + '//' + window.location.host) : '';
    }

    const params = [
      'autoplay=1',
      'controls=1',
      'fs=1',
      'playsinline=1',
      'enablejsapi=1',
      'rel=0',
      'modestbranding=1',
      'widget_referrer=' + encodeURIComponent(window.location.href)
    ];
    if (rawOrigin && !rawOrigin.startsWith('file://') && rawOrigin !== 'null') {
      params.push('origin=' + encodeURIComponent(rawOrigin));
    }

    const embedUrl = `https://www.youtube.com/embed/${video.video_id}?${params.join('&')}`;

    const totalVideos = this.currentVideos ? this.currentVideos.length : 1;
    const currentNum = this.currentVideoIndex >= 0 ? this.currentVideoIndex + 1 : 1;

    modal.innerHTML = `
      <!-- Sleek Modern Header Overlay -->
      <div style="position:absolute; top:0; left:0; right:0; z-index:20; padding:12px 16px; background:linear-gradient(to bottom, rgba(0,0,0,0.85), rgba(0,0,0,0)); display:flex; justify-content:space-between; align-items:center; gap:12px; pointer-events:auto;">
        <button onclick="LinkVideo.cerrarReproductorLinkVideo()" style="background:rgba(255,255,255,0.18); backdrop-filter:blur(10px); border:none; color:#fff; width:38px; height:38px; border-radius:50%; font-size:22px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 10px rgba(0,0,0,0.3); transition:transform 0.15s ease;" onmouseenter="this.style.transform='scale(1.08)'" onmouseleave="this.style.transform='scale(1)'" title="Cerrar">&times;</button>

        <div style="text-align:center; flex:1; min-width:0; padding:0 8px;">
          <div style="font-weight:800; font-size:14px; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-shadow:0 2px 4px rgba(0,0,0,0.8);">${escapeHTMLLinkVideo(video.title)}</div>
          <div style="font-size:11px; color:rgba(255,255,255,0.75); text-shadow:0 1px 3px rgba(0,0,0,0.8);">${this.currentCollection ? escapeHTMLLinkVideo(this.currentCollection.name) : 'Link Video'}</div>
        </div>

        <button onclick="LinkVideo.toggleFullscreenPlayer()" style="background:rgba(255,255,255,0.18); backdrop-filter:blur(10px); border:none; color:#fff; width:38px; height:38px; border-radius:50%; font-size:16px; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 10px rgba(0,0,0,0.3); transition:transform 0.15s ease;" onmouseenter="this.style.transform='scale(1.08)'" onmouseleave="this.style.transform='scale(1)'" title="Pantalla completa">⛶</button>
      </div>

      <!-- Video Stage Maximized -->
      <div id="linkVideoIframeContainer" style="flex:1; position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#000;">
        <iframe id="linkVideoIframePlayer" src="${embedUrl}" style="width:100%; height:100%; border:none; position:absolute; inset:0;" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" allowfullscreen></iframe>
      </div>

      <!-- Discreet Floating Queue Control Bar -->
      ${totalVideos > 1 ? `
        <div style="position:absolute; bottom:16px; left:50%; transform:translateX(-50%); z-index:20; padding:6px 14px; background:rgba(0,0,0,0.65); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); border:1px solid rgba(255,255,255,0.2); border-radius:30px; display:flex; align-items:center; gap:14px; box-shadow:0 8px 24px rgba(0,0,0,0.5);">
          <button onclick="LinkVideo.reproducirAnteriorVideo()" ${this.currentVideoIndex <= 0 ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : 'style="cursor:pointer;"'} style="background:none; border:none; color:#fff; font-size:16px; padding:4px 8px; border-radius:12px; display:flex; align-items:center; justify-content:center;" title="Anterior">
            ⏮
          </button>

          <span style="font-size:12px; font-weight:800; color:rgba(255,255,255,0.9); letter-spacing:0.5px;">
            ${currentNum} / ${totalVideos}
          </span>

          <button onclick="LinkVideo.reproducirSiguienteVideo()" ${this.currentVideoIndex >= totalVideos - 1 ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : 'style="cursor:pointer;"'} style="background:none; border:none; color:#fff; font-size:16px; padding:4px 8px; border-radius:12px; display:flex; align-items:center; justify-content:center;" title="Siguiente">
            ⏭
          </button>
        </div>
      ` : ''}
    `;

    // Emitir actividad multimedia en tiempo real
    if (window.socket) {
      window.socket.emit('actividad:viendo', {
        title: video.title,
        videoUrl: embedUrl,
        collectionName: this.currentCollection ? this.currentCollection.name : 'Link Video'
      });
    }

    // Configurar MediaSession API para reproducción en segundo plano e integración multimedia
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: video.title,
          artist: this.currentCollection ? this.currentCollection.name : 'Link Video',
          artwork: [
            { src: video.thumbnail_url || `https://img.youtube.com/vi/${video.video_id}/hqdefault.jpg`, sizes: '512x512', type: 'image/jpeg' }
          ]
        });

        navigator.mediaSession.setActionHandler('nexttrack', () => this.reproducirSiguienteVideo());
        navigator.mediaSession.setActionHandler('previoustrack', () => this.reproducirAnteriorVideo());
      } catch (e) {}
    }
  },

  reproducirSiguienteVideo() {
    if (this.currentVideoIndex < this.currentVideos.length - 1) {
      this.reproducirVideoColeccion(this.currentVideoIndex + 1);
    }
  },

  reproducirAnteriorVideo() {
    if (this.currentVideoIndex > 0) {
      this.reproducirVideoColeccion(this.currentVideoIndex - 1);
    }
  },

  cerrarReproductorLinkVideo() {
    if (window.socket) {
      window.socket.emit('actividad:detener_viendo');
    }
    const modal = document.getElementById('modalPlayerLinkVideo');
    if (modal) {
      const iframe = modal.querySelector('iframe');
      if (iframe) {
        iframe.src = 'about:blank';
      }
      modal.style.display = 'none';
      modal.innerHTML = '';
    }
  },

  toggleFullscreenPlayer() {
    const container = document.getElementById('modalPlayerLinkVideo') || document.getElementById('linkVideoIframeContainer');
    if (!container) return;

    if (!document.fullscreenElement) {
      if (container.requestFullscreen) {
        container.requestFullscreen().catch(() => {});
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  },

  // ---------------- GESTIÓN DEL STREAMER (HOST) ----------------
  abrirModalIniciarLive() {
    const velo = document.getElementById('veloIniciarLive');
    const hoja = document.getElementById('hojaIniciarLive');
    if (velo && hoja) {
      velo.classList.add('activo');
      hoja.classList.add('activo');
    }
  },

  cerrarModalIniciarLive() {
    const velo = document.getElementById('veloIniciarLive');
    const hoja = document.getElementById('hojaIniciarLive');
    if (velo && hoja) {
      velo.classList.remove('activo');
      hoja.classList.remove('activo');
    }
  },

  async confirmarIniciarLive() {
    const titleInput = document.getElementById('liveInputTitle');
    const catInput = document.getElementById('liveSelectCategory');
    const descInput = document.getElementById('liveInputDescription');

    const title = titleInput ? titleInput.value.trim() : '';
    const category = catInput ? catInput.value : 'general';
    const description = descInput ? descInput.value.trim() : '';

    if (!title) {
      if (window.mostrarToast) window.mostrarToast('Por favor escribe un título para tu Live.');
      return;
    }

    this.cerrarModalIniciarLive();

    try {
      const res = await api('/linkvideo/live/start', { method: 'POST', body: { title, category, description } });
      if (res && res.ok && res.session) {
        this.activeSessionId = res.session.id;
        this.isHost = true;
        this.abrirStreamerStudio(res.session);
      } else {
        throw new Error(res.error || 'No se pudo crear la sesión en vivo.');
      }
    } catch (err) {
      console.error('[LinkLive] Error creando sesión live:', err);
      if (window.mostrarToast) window.mostrarToast('Error al iniciar el Live: ' + err.message);
    }
  },

  async abrirStreamerStudio(session) {
    const modal = document.getElementById('modalStreamerStudio');
    if (!modal) return;

    modal.style.display = 'flex';
    document.getElementById('streamerLiveTitle').textContent = session.title || 'Mi Live';
    document.getElementById('streamerSessionIdBadge').textContent = 'ID: ' + session.id;

    try {
      this.localMediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true
      });
      const videoEl = document.getElementById('liveStreamerVideo');
      if (videoEl) videoEl.srcObject = this.localMediaStream;
    } catch (e) {
      console.warn('[LinkLive] No se pudo obtener cámara/micrófono real:', e.message);
    }

    if (window.socket) {
      window.socket.emit('live:heartbeat', { sessionId: session.id, isHost: true });
    }

    this.iniciarHeartbeatStreamer();
  },

  iniciarHeartbeatStreamer() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

    this.heartbeatInterval = setInterval(async () => {
      if (!this.isHost || !this.activeSessionId) return;

      if (window.socket && window.socket.connected) {
        window.socket.emit('live:heartbeat', { sessionId: this.activeSessionId, isHost: true });
      }

      try {
        await api('/linkvideo/live/heartbeat', { method: 'POST', body: { sessionId: this.activeSessionId, status: 'LIVE' } });
      } catch (e) {}
    }, 3000);
  },

  async reintentarConexionStreamer() {
    if (!this.activeSessionId) return;
    const banner = document.getElementById('streamerReconnectingBanner');
    if (banner) banner.style.display = 'flex';

    try {
      const res = await api('/linkvideo/live/reconnect', { method: 'POST', body: { sessionId: this.activeSessionId } });
      if (res && res.ok) {
        if (window.socket) {
          window.socket.emit('live:reconnect', { sessionId: this.activeSessionId });
        }
        if (banner) banner.style.display = 'none';
        if (window.mostrarToast) window.mostrarToast('¡Transmisión reconectada exitosamente!');
      }
    } catch (err) {
      console.error('[LinkLive] Error reconectando streamer:', err.message);
    }
  },

  actualizarUIStateStreamer(status) {
    const badge = document.getElementById('streamerLiveStatusBadge');
    const banner = document.getElementById('streamerReconnectingBanner');

    if (status === 'LIVE' || status === 'RECONNECTED') {
      if (badge) {
        badge.textContent = '● EN VIVO';
        badge.style.background = '#ef4444';
      }
      if (banner) banner.style.display = 'none';
    } else if (status === 'RECONNECTING' || status === 'INTERMISSION') {
      if (badge) {
        badge.textContent = 'RECONECTANDO...';
        badge.style.background = '#f59e0b';
      }
      if (banner) banner.style.display = 'flex';
    }
  },

  toggleMicStreamer() {
    if (!this.localMediaStream) return;
    const audioTrack = this.localMediaStream.getAudioTracks()[0];
    if (audioTrack) {
      this.micMuted = !this.micMuted;
      audioTrack.enabled = !this.micMuted;
      const btn = document.getElementById('btnStreamerToggleMic');
      if (btn) btn.textContent = this.micMuted ? '🔇' : '🎙️';
    }
  },

  toggleCamStreamer() {
    if (!this.localMediaStream) return;
    const videoTrack = this.localMediaStream.getVideoTracks()[0];
    if (videoTrack) {
      this.camOff = !this.camOff;
      videoTrack.enabled = !this.camOff;
      const btn = document.getElementById('btnStreamerToggleCam');
      if (btn) btn.textContent = this.camOff ? '🙈' : '📹';
    }
  },

  async finalizarLiveVoluntario() {
    if (!confirm('¿Estás seguro de finalizar la transmisión?')) return;

    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

    if (this.activeSessionId) {
      try {
        await api('/linkvideo/live/end', { method: 'POST', body: { sessionId: this.activeSessionId } });
        if (window.socket) {
          window.socket.emit('live:end', { sessionId: this.activeSessionId });
        }
      } catch (e) {}
    }

    if (this.localMediaStream) {
      this.localMediaStream.getTracks().forEach(t => t.stop());
      this.localMediaStream = null;
    }

    this.isHost = false;
    this.activeSessionId = null;

    const modal = document.getElementById('modalStreamerStudio');
    if (modal) modal.style.display = 'none';

    if (window.mostrarToast) window.mostrarToast('Transmisión finalizada.');
    await this.cargarCatalogo();
  },

  // ---------------- GESTIÓN DEL ESPECTADOR (VIEWER) ----------------
  async unirseLiveViewer(sessionId) {
    this.isViewer = true;
    this.viewerSessionId = sessionId;

    const modal = document.getElementById('modalViewerLive');
    if (!modal) return;
    modal.style.display = 'flex';

    try {
      const session = await api(`/linkvideo/live/${sessionId}`);
      if (session) {
        document.getElementById('viewerLiveTitle').textContent = session.title || 'Transmisión en Vivo';
        document.getElementById('viewerLiveHost').textContent = 'Streamer: ' + (session.hostName || 'Usuario');
        document.getElementById('viewerLiveCount').textContent = session.viewerCount || 1;
        this.procesarCambioEstadoViewer(session.status || 'LIVE', session);
      }
    } catch (e) {}

    if (window.socket) {
      window.socket.emit('live:join', { sessionId });
    }
  },

  reintentarConexionViewer() {
    if (window.socket && this.viewerSessionId) {
      window.socket.emit('live:join', { sessionId: this.viewerSessionId });
    }
  },

  procesarCambioEstadoViewer(status, sessionData) {
    const badge = document.getElementById('viewerLiveStatusBadge');
    const recOverlay = document.getElementById('viewerReconnectingOverlay');
    const interOverlay = document.getElementById('viewerIntermissionOverlay');
    const videoEl = document.getElementById('liveViewerVideo');

    if (status === 'LIVE' || status === 'RECONNECTED') {
      if (badge) {
        badge.textContent = '● LIVE';
        badge.style.background = '#ef4444';
      }
      if (recOverlay) recOverlay.style.display = 'none';
      if (interOverlay) interOverlay.style.display = 'none';
      if (videoEl) videoEl.style.opacity = '1';
      this.detenerMascotaIntermission();
    } else if (status === 'RECONNECTING') {
      if (badge) {
        badge.textContent = 'RECONECTANDO...';
        badge.style.background = '#f59e0b';
      }
      if (recOverlay) recOverlay.style.display = 'flex';
      if (interOverlay) interOverlay.style.display = 'none';
    } else if (status === 'INTERMISSION') {
      if (badge) {
        badge.textContent = 'INTERMISSION';
        badge.style.background = '#8b5cf6';
      }
      if (recOverlay) recOverlay.style.display = 'none';
      if (interOverlay) interOverlay.style.display = 'flex';
      this.iniciarMascotaIntermission();
    } else if (status === 'ENDED') {
      if (window.mostrarToast) window.mostrarToast('El streamer ha finalizado la transmisión.');
      setTimeout(() => {
        this.salirLiveViewer();
      }, 1500);
    }
  },

  iniciarMascotaIntermission() {
    if (this.intermissionInterval) return;

    this.currentClipIndex = 0;
    const clipVideo = document.getElementById('intermissionClipVideo');
    const clipBadge = document.getElementById('intermissionClipTitleBadge');

    const updateClip = () => {
      const clipName = this.intermissionClips[this.currentClipIndex];
      if (clipBadge) clipBadge.textContent = 'Clip: ' + clipName;

      if (clipVideo) {
        clipVideo.src = '/media/' + clipName;
        clipVideo.style.display = 'block';
        clipVideo.play().catch(() => {
          clipVideo.style.display = 'none';
        });
      }

      this.currentClipIndex = (this.currentClipIndex + 1) % this.intermissionClips.length;
    };

    updateClip();
    this.intermissionInterval = setInterval(updateClip, 5000);
  },

  detenerMascotaIntermission() {
    if (this.intermissionInterval) {
      clearInterval(this.intermissionInterval);
      this.intermissionInterval = null;
    }
    const clipVideo = document.getElementById('intermissionClipVideo');
    if (clipVideo) {
      clipVideo.pause();
      clipVideo.style.display = 'none';
    }
  },

  async manejarOfertaWebRTCViewer(sdp, senderSocketId) {
    try {
      this.viewerPeerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      this.viewerPeerConnection.ontrack = (event) => {
        const videoEl = document.getElementById('liveViewerVideo');
        if (videoEl && event.streams[0]) {
          videoEl.srcObject = event.streams[0];
        }
      };

      this.viewerPeerConnection.onicecandidate = (event) => {
        if (event.candidate && window.socket) {
          window.socket.emit('live:ice_candidate', {
            sessionId: this.viewerSessionId,
            candidate: event.candidate,
            targetSocketId: senderSocketId
          });
        }
      };

      await this.viewerPeerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await this.viewerPeerConnection.createAnswer();
      await this.viewerPeerConnection.setLocalDescription(answer);

      if (window.socket) {
        window.socket.emit('live:answer', {
          sessionId: this.viewerSessionId,
          sdp: answer,
          targetSocketId: senderSocketId
        });
      }
    } catch (e) {
      console.error('[LinkLive] Error WebRTC viewer:', e.message);
    }
  },

  salirLiveViewer(usarPiP = true) {
    const videoElem = document.getElementById('liveViewerVideo');
    if (usarPiP && videoElem && videoElem.srcObject && !videoElem.paused) {
      window.activarPiPVideo(videoElem.srcObject);
    }

    if (this.viewerSessionId && window.socket && !usarPiP) {
      window.socket.emit('live:leave', { sessionId: this.viewerSessionId });
    }

    if (this.viewerPeerConnection && !usarPiP) {
      this.viewerPeerConnection.close();
      this.viewerPeerConnection = null;
    }

    this.detenerMascotaIntermission();
    if (!usarPiP) {
      this.isViewer = false;
      this.viewerSessionId = null;
    }

    const modal = document.getElementById('modalViewerLive');
    if (modal) modal.style.display = 'none';

    this.cargarCatalogo();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('vistaAilab')) {
    window.LinkVideo.init();
  }
});

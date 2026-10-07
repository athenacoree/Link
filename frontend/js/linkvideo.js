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

function normalizarTextoBusquedaLV(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
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
    this.setupVolumeKeyListeners();
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
      const qNorm = normalizarTextoBusquedaLV(this.searchQuery);
      const qTokens = qNorm.split(/\s+/).filter(Boolean);
      if (qTokens.length > 0) {
        filtradas = filtradas.filter(c => {
          const cNameNorm = normalizarTextoBusquedaLV(c.name);
          const cCatNorm = normalizarTextoBusquedaLV(c.category);
          const fullText = `${cNameNorm} ${cCatNorm}`;
          return qTokens.every(tok => fullText.includes(tok)) ||
                 qTokens.some(tok => tok.length >= 3 && fullText.includes(tok));
        });
      }
    }

    if (!filtradas || filtradas.length === 0) {
      gridEl.innerHTML = `<div class="aviso-vacio" style="grid-column: 1 / -1; padding:30px;">No se encontraron colecciones o álbumes.</div>`;
      return;
    }

    gridEl.innerHTML = filtradas.map(col => {
      const cover = col.cover_url || 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=600';
      const categoryTag = col.category || 'General';

      return `
        <div class="linkvideo-square-card" onclick="LinkVideo.abrirColeccion('${col.id}')">
          <img class="linkvideo-card-thumb-img" src="${cover}" alt="${escapeHTMLLinkVideo(col.name)}" onerror="this.src='https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=600'">
          <div class="linkvideo-card-overlay-gradient">
            <div style="font-size:10px; font-weight:800; background:rgba(0,0,0,0.6); color:#ddd6fe; padding:2px 6px; border-radius:6px; width:fit-content; margin-bottom:4px;">🏷️ ${escapeHTMLLinkVideo(categoryTag)}</div>
            <div class="linkvideo-card-title">${escapeHTMLLinkVideo(col.name)}</div>
          </div>
        </div>
      `;
    }).join('');
  },

  toggleAlbumDesc(el) {
    if (el) {
      el.classList.toggle('expandido');
    }
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
      const qNorm = normalizarTextoBusquedaLV(this.searchQuery);
      const qTokens = qNorm.split(/\s+/).filter(Boolean);
      if (qTokens.length > 0) {
        videos = videos.filter(v => {
          const vTitleNorm = normalizarTextoBusquedaLV(v.title);
          const vDescNorm = normalizarTextoBusquedaLV(v.audio_description);
          const fullText = `${vTitleNorm} ${vDescNorm}`;
          return qTokens.every(tok => fullText.includes(tok)) ||
                 qTokens.some(tok => tok.length >= 3 && fullText.includes(tok));
        });
      }
    }

    const cover = col.cover_url || 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=600';
    const categoryTag = col.category || 'General';
    const esAdmin = !!(window.currentUser?.is_admin || window.MI_ES_ADMIN);

    const colAudioDesc = col.audio_description || '';

    detailView.innerHTML = `
      <div style="margin-bottom:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <button class="btn btn-secundario mini-btn" onclick="LinkVideo.volverAColecciones()" style="padding:8px 14px; font-weight:800; border-radius:14px; display:flex; align-items:center; gap:4px;">
            ‹ Volver a Álbumes
          </button>
          ${esAdmin ? `
            <button class="btn btn-primario mini-btn" onclick="LinkVideo.abrirModalAdminAlbum('${col.id}')" style="padding:8px 14px; font-weight:800; border-radius:14px; background:linear-gradient(135deg, #7c3aed, #ec4899);">
              ⚙️ Administrar álbum
            </button>
          ` : ''}
        </div>

        <!-- Banner de Álbum estilo HiTV con Blur de Fondo -->
        <div style="position:relative; border-radius:24px; overflow:hidden; padding:18px; border:1px solid rgba(139, 92, 246, 0.3); background:linear-gradient(135deg, rgba(124,58,237,0.15), rgba(236,72,153,0.1)); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); box-shadow:0 8px 24px rgba(91,33,182,0.12);">
          <div style="display:flex; align-items:center; gap:16px;">
            <img src="${cover}" style="width:84px; height:84px; border-radius:18px; object-fit:cover; box-shadow:0 6px 18px rgba(0,0,0,0.25); flex-shrink:0;" alt="Cover">
            <div style="flex:1; min-width:0;">
              <div style="font-weight:900; font-size:18px; color:var(--texto-900); margin-bottom:4px; line-height:1.2;">${escapeHTMLLinkVideo(col.name)}</div>
              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:6px;">
                <span style="font-size:11px; font-weight:800; background:var(--morado-600); color:#ffffff; padding:3px 10px; border-radius:10px;">🏷️ ${escapeHTMLLinkVideo(categoryTag)}</span>
                <span style="font-size:12px; color:var(--morado-700); font-weight:800;">🎬 ${videos.length} video${videos.length === 1 ? '' : 's'}</span>
              </div>
              ${colAudioDesc ? `
                <div class="linkvideo-album-desc-truncated" onclick="LinkVideo.toggleAlbumDesc(this)" title="Toca para expandir / contraer">
                  🎙️ ${escapeHTMLLinkVideo(colAudioDesc)}
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      </div>

      <!-- Grilla Cuadrada Estilo HiTV de Videos del Álbum -->
      <div class="grid-cuadrados-linkvideo" id="linkVideoVideosGrid">
        ${videos.length === 0 ? `<div class="aviso-vacio" style="grid-column: 1 / -1;">Este álbum no contiene videos aún.</div>` : videos.map((v, idx) => `
          <div class="linkvideo-video-item">
            <div class="linkvideo-square-card" onclick="LinkVideo.reproducirVideoColeccion(${idx})">
              <img class="linkvideo-card-thumb-img" src="${v.thumbnail_url || 'https://img.youtube.com/vi/' + v.video_id + '/hqdefault.jpg'}" alt="${escapeHTMLLinkVideo(v.title)}">
              <div class="linkvideo-card-overlay-gradient">
                <div style="font-size:28px; text-align:center; margin:auto; filter:drop-shadow(0 2px 8px rgba(0,0,0,0.6));">▶</div>
              </div>
            </div>
            <div class="linkvideo-video-title-below" title="${escapeHTMLLinkVideo(v.title)}">${escapeHTMLLinkVideo(v.title)}</div>
            ${v.audio_description ? `<div style="font-size:10.5px; color:var(--texto-500); text-align:center; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">🎙️ ${escapeHTMLLinkVideo(v.audio_description)}</div>` : ''}
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
              <label>Categoría</label>
              <select id="adminAlbumCategorySelect" style="width:100%; padding:8px; border-radius:10px; border:1px solid var(--linea); font-size:12px; font-weight:700; background:var(--blanco);">
                ${['General', 'Música', 'Álbumes', 'Películas', 'Series', 'Telenovelas', 'Documentales', 'Animes'].map(cat => `
                  <option value="${cat}" ${col.category === cat ? 'selected' : ''}>${cat}</option>
                `).join('')}
              </select>
            </div>
            <div class="campo" style="margin-bottom:8px;">
              <label>Descripción de Audio del Álbum</label>
              <textarea id="adminAlbumAudioDescInput" rows="2" style="width:100%; font-size:12px; padding:6px; border-radius:8px; border:1px solid var(--linea);" placeholder="Descripción hablada / resumen del álbum...">${escapeHTMLLinkVideo(col.audio_description || '')}</textarea>
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

          <!-- Importar Lista de Reproducción de YouTube -->
          <div style="background:var(--hueso); border-radius:16px; padding:14px; margin-bottom:16px; border:1px solid var(--linea);">
            <div style="font-size:13px; font-weight:800; color:var(--morado-700); margin-bottom:8px;">📥 Importar Lista de Reproducción de YouTube</div>
            <div class="campo" style="margin-bottom:8px;">
              <label>URL o ID de la Playlist de YouTube</label>
              <input type="text" id="adminPlaylistUrlInput" placeholder="https://www.youtube.com/playlist?list=...">
            </div>
            <button class="btn btn-primario mini-btn" style="width:100%; background:linear-gradient(135deg, #2563eb, #7c3aed);" onclick="LinkVideo.importarPlaylistYouTube('${col.id}')">
              🚀 Importar todos los vídeos de la Playlist
            </button>
          </div>

          <!-- Agregar Nuevo Video -->
          <div style="background:var(--hueso); border-radius:16px; padding:14px; margin-bottom:16px; border:1px solid var(--linea);">
            <div style="font-size:13px; font-weight:800; color:var(--morado-700); margin-bottom:8px;">➕ Agregar Video Único de YouTube</div>
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
            <div class="campo" style="margin-bottom:8px;">
              <label>Descripción de Audio del Video (Opcional)</label>
              <textarea id="adminAlbumVideoAudioDescInput" rows="2" style="width:100%; font-size:12px; padding:6px; border-radius:8px; border:1px solid var(--linea);" placeholder="Descripción hablada para el video..."></textarea>
            </div>
            <button class="btn btn-primario mini-btn" style="width:100%;" onclick="LinkVideo.agregarVideoAAlbum('${col.id}')">✨ Agregar Video al Álbum</button>
          </div>

          <!-- Lista de Videos -->
          <div style="font-size:13px; font-weight:800; color:var(--texto-900); margin-bottom:8px;">Vídeos del Álbum (${videos.length})</div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${videos.length === 0 ? `<div style="font-size:12px; color:var(--texto-500); text-align:center; padding:12px;">No hay vídeos en este álbum.</div>` : videos.map((v) => `
              <div style="display:flex; flex-direction:column; gap:6px; background:var(--blanco); border:1px solid var(--linea); border-radius:12px; padding:10px;">
                <div style="display:flex; align-items:center; gap:10px;">
                  <img src="${v.thumbnail_url || 'https://img.youtube.com/vi/' + v.video_id + '/hqdefault.jpg'}" style="width:48px; height:36px; border-radius:6px; object-fit:cover; flex-shrink:0;">
                  <div style="flex:1; min-width:0;">
                    <input type="text" id="vidTitle_${v.id}" value="${escapeHTMLLinkVideo(v.title)}" style="width:100%; font-size:12px; font-weight:700; border:1px solid var(--linea); border-radius:6px; padding:4px 6px;">
                  </div>
                  <div style="display:flex; gap:4px; flex-shrink:0;">
                    <button class="mini-btn primario" onclick="LinkVideo.guardarTituloVideo('${v.id}')" title="Guardar cambios">💾</button>
                    <button class="mini-btn peligro" onclick="LinkVideo.eliminarVideoDeAlbum('${col.id}', '${v.id}')" title="Eliminar video">🗑️</button>
                  </div>
                </div>
                <div style="margin-top:2px;">
                  <textarea id="vidAudioDesc_${v.id}" rows="1" style="width:100%; font-size:11px; border:1px solid var(--linea); border-radius:6px; padding:4px 6px;" placeholder="Descripción de audio del video...">${escapeHTMLLinkVideo(v.audio_description || '')}</textarea>
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

  async importarPlaylistYouTube(colId) {
    const url = document.getElementById('adminPlaylistUrlInput')?.value.trim();
    if (!url) {
      if (window.mostrarToast) window.mostrarToast('Ingresa la URL o ID de la lista de reproducción de YouTube.');
      return;
    }

    if (window.mostrarToast) window.mostrarToast('📥 Importando vídeos de la playlist... Espere un momento.');

    try {
      const res = await api('/linkvideo/admin/collections/import-playlist', {
        method: 'POST',
        body: { url, collectionId: colId }
      });

      if (res && res.ok) {
        if (window.mostrarToast) window.mostrarToast(res.mensaje || '¡Lista de reproducción importada con éxito!');
        await this.abrirModalAdminAlbum(colId);
        const colRes = await api(`/linkvideo/collections/${colId}`);
        if (colRes && colRes.collection) {
          this.currentCollection = colRes.collection;
          this.currentVideos = colRes.collection.videos || [];
          this.renderizarDetalleColeccion(this.currentCollection);
        }
      } else {
        throw new Error(res.error || 'Fallo al importar la lista.');
      }
    } catch (err) {
      if (window.mostrarToast) window.mostrarToast(err.message || 'Error al importar lista de reproducción.');
    }
  },

  async guardarCambiosAlbum(colId) {
    const name = document.getElementById('adminAlbumNameInput')?.value.trim();
    const category = document.getElementById('adminAlbumCategorySelect')?.value || 'General';
    const audio_description = document.getElementById('adminAlbumAudioDescInput')?.value.trim();
    const cover_url = document.getElementById('adminAlbumCoverInput')?.value.trim();

    if (!name) {
      if (window.mostrarToast) window.mostrarToast('Ingresa un nombre para el álbum.');
      return;
    }

    try {
      await api(`/linkvideo/admin/collections/${colId}`, { method: 'PUT', body: { name, category, audio_description, cover_url } });
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
    const audio_description = document.getElementById('adminAlbumVideoAudioDescInput')?.value.trim();

    if (!url) {
      if (window.mostrarToast) window.mostrarToast('Ingresa una URL de YouTube.');
      return;
    }

    try {
      await api(`/linkvideo/admin/collections/${colId}/videos`, { method: 'POST', body: { url, title, audio_description } });
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
    const titleInput = document.getElementById(`vidTitle_${videoId}`);
    const audioDescInput = document.getElementById(`vidAudioDesc_${videoId}`);
    const title = titleInput ? titleInput.value.trim() : '';
    const audio_description = audioDescInput ? audioDescInput.value.trim() : '';

    if (!title) return;

    try {
      await api(`/linkvideo/admin/videos/${videoId}`, { method: 'PUT', body: { title, audio_description } });
      if (window.mostrarToast) window.mostrarToast('Video actualizado');
      if (this.currentCollection) {
        const res = await api(`/linkvideo/collections/${this.currentCollection.id}`);
        if (res && res.collection) {
          this.currentCollection = res.collection;
          this.currentVideos = res.collection.videos || [];
          this.renderizarDetalleColeccion(this.currentCollection);
        }
      }
    } catch (err) {
      if (window.mostrarToast) window.mostrarToast('Error al actualizar video.');
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

  activarVolumenProteccion() {
    this.hasUserActivatedVolume = true;
    if (this.ytPlayer && typeof this.ytPlayer.unMute === 'function') {
      try { this.ytPlayer.unMute(); } catch (e) {}
    }
    const btn = document.getElementById('hitvVolumeProtectionBtn');
    if (btn) btn.style.display = 'none';
  },

  setupVolumeKeyListeners() {
    if (this.volumeKeyListenersSet) return;
    this.volumeKeyListenersSet = true;

    window.addEventListener('keydown', (e) => {
      if (this.activeVideoData && !this.hasUserActivatedVolume) {
        if (e.key === 'AudioVolumeUp' || e.key === 'AudioVolumeDown' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          this.activarVolumenProteccion();
        }
      }
    });
  },

  ensureYouTubeApiLoaded(callback) {
    if (window.YT && window.YT.Player) {
      callback();
      return;
    }

    const prevOnReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevOnReady === 'function') prevOnReady();
      callback();
    };

    if (!document.getElementById('ytIframeApiScript')) {
      const tag = document.createElement('script');
      tag.id = 'ytIframeApiScript';
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      } else {
        document.head.appendChild(tag);
      }
    }
  },

  currentCues: [],
  lastDisplayedCueText: null,
  subSyncInterval: null,
  ytPlayer: null,
  activeVideoData: null,
  isPlayingAudioBackground: false,
  isAudioProtectionActive: true, // Protección de volumen activada por defecto al entrar
  hasUserActivatedVolume: false, // Flag de volumen activado por usuario en la sesión de Link Video

  async abrirReproductorLinkVideo(video) {
    if (!video || !video.video_id) return;

    this.activeVideoData = video;
    this.isPlayingAudioBackground = true;

    let modal = document.getElementById('modalPlayerLinkVideo');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalPlayerLinkVideo';
      modal.className = 'hitv-player-modal';
      document.body.appendChild(modal);
    }

    modal.style.display = 'flex';

    const colName = this.currentCollection ? this.currentCollection.name : 'Link Video';

    // SVG vectorial para el botón desplegable pegado a la izquierda
    const vectorArrowSvg = `
      <svg id="hitvFolderToggleArrowSvg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="18 15 12 9 6 15"></polyline>
      </svg>
    `;

    // SVG vectorial para el botón flotante de volumen (Protección de sonido)
    const vectorVolumeSvg = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <line x1="23" y1="9" x2="17" y2="15"></line>
        <line x1="17" y1="9" x2="23" y2="15"></line>
      </svg>
    `;

    modal.innerHTML = `
      <button onclick="LinkVideo.confirmarSalidaYSegundoPlano()" class="hitv-close-btn" title="Cerrar reproductor">&times;</button>

      <div class="hitv-player-wrapper">
        <!-- El video se posiciona arriba casi tocando el borde superior -->
        <div class="hitv-video-container" id="linkVideoIframeContainer">
          <div id="linkVideoIframePlayer"></div>

          <!-- Botón vectorial pequeño flotante sobre el video para activar sonido -->
          <button id="hitvVolumeProtectionBtn" class="hitv-volume-protection-btn" style="display:${this.hasUserActivatedVolume ? 'none' : 'flex'}; position:absolute; bottom:14px; right:14px; z-index:30; background:rgba(124,58,237,0.85); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.4); border-radius:30px; padding:8px 14px; color:#fff; font-size:12px; font-weight:800; cursor:pointer; align-items:center; gap:8px; box-shadow:0 6px 20px rgba(0,0,0,0.5);" onclick="LinkVideo.activarVolumenProteccion()">
            ${vectorVolumeSvg}
            <span>Activar sonido</span>
          </button>
        </div>

        <!-- Area de Subtitulos / Animación Aurora (Debajo del video, NO encima del video) -->
        <div class="hitv-subtitle-area" id="hitvSubtitleArea">
          <div id="hitvSubtitlesText" class="hitv-subtitle-line hitv-subtitle-hidden"></div>

          <div id="hitvAuroraContainer" class="hitv-aurora-container hitv-aurora-hidden">
            <div class="hitv-aurora-sphere">
              <div class="hitv-aurora-wave wave-1"></div>
              <div class="hitv-aurora-wave wave-2"></div>
              <div class="hitv-aurora-wave wave-3"></div>
              <div class="hitv-aurora-core"></div>
            </div>
            <span class="hitv-aurora-notice">Subtítulos no disponibles</span>
          </div>
        </div>

        <!-- Flecha vectorial pegada al lado izquierdo debajo del video -->
        <div style="display:flex; justify-content:flex-start; width:100%; margin-top:10px; padding-left:4px;">
          <button id="hitvFolderToggleBtn" class="hitv-folder-toggle-btn" onclick="LinkVideo.toggleFolderVideosList()" title="Ver otros vídeos de la carpeta">
            ${vectorArrowSvg}
          </button>
        </div>

        <!-- Contenedor desplegable de videos de la carpeta -->
        <div id="hitvFolderVideosContainer" class="hitv-folder-videos-container" style="display:none;"></div>
      </div>
    `;

    // Cargar subtítulos desde el backend
    this.currentCues = [];
    this.lastDisplayedCueText = null;

    try {
      const subRes = await api(`/linkvideo/subtitles/${video.video_id}`);
      if (subRes && subRes.ok && Array.isArray(subRes.subtitles) && subRes.subtitles.length > 0) {
        this.currentCues = subRes.subtitles;
      }
    } catch (e) {
      console.warn('[LinkVideo Subtitles] Error al consultar subtítulos:', e.message);
    }

    const subTextEl = document.getElementById('hitvSubtitlesText');
    const auroraEl = document.getElementById('hitvAuroraContainer');

    if (this.currentCues.length > 0) {
      if (auroraEl) auroraEl.classList.add('hitv-aurora-hidden');
    } else {
      if (subTextEl) subTextEl.classList.add('hitv-subtitle-hidden');
      if (auroraEl) auroraEl.classList.remove('hitv-aurora-hidden');
    }

    // Inicializar reproductor mediante YouTube IFrame Player API
    this.ensureYouTubeApiLoaded(() => {
      try {
        if (!document.getElementById('linkVideoIframePlayer')) return;
        this.ytPlayer = new YT.Player('linkVideoIframePlayer', {
          videoId: video.video_id,
          playerVars: {
            autoplay: 1,
            controls: 1,
            fs: 1,
            playsinline: 1,
            enablejsapi: 1,
            rel: 0,
            modestbranding: 1
          },
          events: {
            onReady: (event) => {
              try {
                // Aplicar sistema de protección de audio si no se ha activado aún el volumen
                if (!this.hasUserActivatedVolume) {
                  event.target.mute();
                } else {
                  event.target.unMute();
                }
                event.target.playVideo();
              } catch (err) {}
            },
            onStateChange: (event) => {
              if (window.YT && event.data === YT.PlayerState.PLAYING) {
                this.isPlayingAudioBackground = true;
                this.iniciarSincronizacionSubtitulos();
                this.actualizarAudioBannerTop();
              } else if (window.YT && event.data === YT.PlayerState.PAUSED) {
                this.isPlayingAudioBackground = false;
                this.actualizarAudioBannerTop();
              } else {
                this.detenerSincronizacionSubtitulos();
              }
            }
          }
        });
      } catch (err) {
        console.warn('[LinkVideo] Fallback iframe directo:', err.message);
        this.crearIframeFallback(video.video_id);
      }
    });

    // Fallback de respaldo por si la API de YouTube no se carga a tiempo
    setTimeout(() => {
      if (!this.ytPlayer && document.getElementById('linkVideoIframeContainer')) {
        const container = document.getElementById('linkVideoIframeContainer');
        if (container && !container.querySelector('iframe')) {
          this.crearIframeFallback(video.video_id);
        }
      }
    }, 2000);

    // Emitir actividad multimedia en tiempo real
    if (window.socket) {
      window.socket.emit('actividad:viendo', {
        title: video.title,
        videoUrl: `https://www.youtube.com/watch?v=${video.video_id}`,
        collectionName: colName
      });
    }

    // Configurar MediaSession API
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: video.title,
          artist: colName,
          artwork: [
            { src: video.thumbnail_url || `https://img.youtube.com/vi/${video.video_id}/hqdefault.jpg`, sizes: '512x512', type: 'image/jpeg' }
          ]
        });

        navigator.mediaSession.setActionHandler('nexttrack', () => this.reproducirSiguienteVideo());
        navigator.mediaSession.setActionHandler('previoustrack', () => this.reproducirAnteriorVideo());
      } catch (e) {}
    }

    this.actualizarAudioBannerTop();
  },

  toggleFolderVideosList() {
    const container = document.getElementById('hitvFolderVideosContainer');
    const arrowSvg = document.getElementById('hitvFolderToggleArrowSvg');
    const subArea = document.getElementById('hitvSubtitleArea');
    if (!container) return;

    const isHidden = container.style.display === 'none';
    if (isHidden) {
      this.renderizarVideosCarpetaPlayer();
      container.style.display = 'flex';
      if (arrowSvg) arrowSvg.style.transform = 'rotate(180deg)';
      if (subArea) subArea.style.display = 'none';
    } else {
      container.style.display = 'none';
      if (arrowSvg) arrowSvg.style.transform = 'rotate(0deg)';
      if (subArea) subArea.style.display = 'flex';
    }
  },

  renderizarVideosCarpetaPlayer() {
    const container = document.getElementById('hitvFolderVideosContainer');
    if (!container) return;

    const videos = this.currentVideos || [];
    if (videos.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:16px; color:rgba(255,255,255,0.7); font-size:13px; font-weight:700;">No hay otros vídeos en esta carpeta.</div>`;
      return;
    }

    const vectorPlay = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="#ffffff">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
    `;

    container.innerHTML = videos.map((v, idx) => {
      const isCurrent = idx === this.currentVideoIndex;
      const thumb = v.thumbnail_url || `https://img.youtube.com/vi/${v.video_id}/hqdefault.jpg`;
      return `
        <div class="hitv-folder-video-card-item ${isCurrent ? 'active' : ''}" onclick="LinkVideo.reproducirVideoColeccion(${idx})">
          <div class="hitv-folder-card-thumb-wrap">
            <img class="hitv-folder-card-thumb-img" src="${thumb}" alt="${escapeHTMLLinkVideo(v.title)}">
            <div class="hitv-folder-card-overlay">
              <div class="hitv-folder-card-play-icon">
                ${vectorPlay}
              </div>
            </div>
            ${isCurrent ? `
              <div style="position:absolute; top:10px; right:10px; background:#7c3aed; color:#fff; font-size:11px; font-weight:900; padding:4px 10px; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.4);">
                ▶ Reproduciendo
              </div>
            ` : ''}
          </div>
          <div class="hitv-folder-card-info">
            <div class="hitv-folder-card-title">${escapeHTMLLinkVideo(v.title)}</div>
            ${v.audio_description ? `<div style="font-size:11px; color:rgba(255,255,255,0.6);">🎙️ ${escapeHTMLLinkVideo(v.audio_description)}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  },

  minimizarOOcultarModalPlayer() {
    const modal = document.getElementById('modalPlayerLinkVideo');
    if (modal) {
      modal.style.display = 'none';
    }
    this.actualizarAudioBannerTop();
  },

  reabrirReproductorModal() {
    const modal = document.getElementById('modalPlayerLinkVideo');
    if (modal) {
      modal.style.display = 'flex';
    }
  },

  confirmarSalidaYSegundoPlano() {
    if (!this.activeVideoData) {
      this.cerrarReproductorLinkVideo();
      return;
    }

    let confirmModal = document.getElementById('modalConfirmBackgroundAudio');
    if (!confirmModal) {
      confirmModal = document.createElement('div');
      confirmModal.id = 'modalConfirmBackgroundAudio';
      confirmModal.style.cssText = 'position:fixed; inset:0; z-index:100010; background:rgba(0,0,0,0.7); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); display:flex; align-items:center; justify-content:center; padding:20px;';
      document.body.appendChild(confirmModal);
    }

    const vectorCheckSvg = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;

    const vectorCrossSvg = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;

    confirmModal.style.display = 'flex';
    confirmModal.innerHTML = `
      <div style="background:rgba(20, 16, 36, 0.95); border:1px solid rgba(139,92,246,0.4); border-radius:24px; padding:24px; width:100%; max-width:380px; text-align:center; box-shadow:0 16px 40px rgba(0,0,0,0.6); color:#fff;">
        <div style="font-size:17px; font-weight:900; margin-bottom:8px; color:#ddd6fe;">¿Seguir escuchando en segundo plano?</div>
        <div style="font-size:13px; color:rgba(255,255,255,0.75); margin-bottom:20px; line-height:1.4;">El audio del video continuará reproduciéndose de forma fluida mientras navegas por la plataforma.</div>

        <div style="display:flex; gap:12px; justify-content:center;">
          <button onclick="LinkVideo.respuestaSegundoPlano(false)" style="flex:1; background:rgba(239,68,68,0.2); border:1px solid rgba(239,68,68,0.5); border-radius:16px; padding:10px; color:#fca5a5; font-size:13px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">
            ${vectorCrossSvg}
            <span>Rechazar</span>
          </button>

          <button onclick="LinkVideo.respuestaSegundoPlano(true)" style="flex:1; background:linear-gradient(135deg, #7c3aed, #ec4899); border:none; border-radius:16px; padding:10px; color:#ffffff; font-size:13px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; box-shadow:0 4px 16px rgba(124,58,237,0.4);">
            ${vectorCheckSvg}
            <span>Aceptar</span>
          </button>
        </div>
      </div>
    `;
  },

  respuestaSegundoPlano(aceptar) {
    const confirmModal = document.getElementById('modalConfirmBackgroundAudio');
    if (confirmModal) confirmModal.style.display = 'none';

    if (aceptar) {
      this.minimizarOOcultarModalPlayer();
    } else {
      this.cerrarReproductorLinkVideo();
    }
  },

  actualizarAudioBannerTop() {
    let banner = document.getElementById('topAudioBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'topAudioBanner';
      banner.className = 'top-audio-banner oculto';
      banner.onclick = () => this.reabrirReproductorModal();
      banner.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; width:100%; font-size:11px; font-weight:800; letter-spacing:0.3px;">
          <div style="display:flex; align-items:center; gap:6px; min-width:0;">
            <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#a78bfa; animation:pulse 1.5s infinite;"></span>
            <span id="topAudioTimeText" style="color:#ddd6fe; font-family:monospace;">00:00 / 00:00</span>
          </div>
          <div style="font-size:10px; font-weight:700; color:rgba(255,255,255,0.7); text-transform:uppercase; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:180px;" id="topAudioMiniTitle">
            Link Video
          </div>
        </div>
      `;
      const appShell = document.getElementById('appShell');
      if (appShell) {
        appShell.insertBefore(banner, appShell.firstChild);
      } else {
        document.body.insertBefore(banner, document.body.firstChild);
      }
    }

    if (this.activeVideoData && this.isPlayingAudioBackground) {
      banner.classList.remove('oculto');
      const titleEl = document.getElementById('topAudioMiniTitle');
      if (titleEl && this.activeVideoData.title) {
        titleEl.textContent = this.activeVideoData.title;
      }
      this.iniciarTimerBannerAudio();
    } else {
      banner.classList.add('oculto');
      this.detenerTimerBannerAudio();
    }
  },

  bannerTimerInterval: null,

  iniciarTimerBannerAudio() {
    this.detenerTimerBannerAudio();
    this.bannerTimerInterval = setInterval(() => {
      const timeEl = document.getElementById('topAudioTimeText');
      if (!timeEl || !this.ytPlayer) return;

      try {
        if (typeof this.ytPlayer.getCurrentTime === 'function' && typeof this.ytPlayer.getDuration === 'function') {
          const current = Math.floor(this.ytPlayer.getCurrentTime() || 0);
          const duration = Math.floor(this.ytPlayer.getDuration() || 0);
          const remaining = Math.max(0, duration - current);

          timeEl.textContent = `${this.formatTimeSeconds(current)} / -${this.formatTimeSeconds(remaining)}`;
        }
      } catch (e) {}
    }, 500);
  },

  detenerTimerBannerAudio() {
    if (this.bannerTimerInterval) {
      clearInterval(this.bannerTimerInterval);
      this.bannerTimerInterval = null;
    }
  },

  formatTimeSeconds(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  },

  togglePlayPauseAudioBanner() {
    if (!this.ytPlayer) return;
    try {
      if (typeof this.ytPlayer.getPlayerState === 'function') {
        const state = this.ytPlayer.getPlayerState();
        if (window.YT && state === YT.PlayerState.PLAYING) {
          this.ytPlayer.pauseVideo();
          this.isPlayingAudioBackground = false;
        } else if (typeof this.ytPlayer.playVideo === 'function') {
          this.ytPlayer.playVideo();
          this.isPlayingAudioBackground = true;
        }
      }
    } catch (e) {}
    this.actualizarAudioBannerTop();
  },

  detenerYOtrosBannerAudio() {
    this.cerrarReproductorLinkVideo();
  },

  crearIframeFallback(videoId) {
    const playerTarget = document.getElementById('linkVideoIframePlayer');
    if (playerTarget) {
      playerTarget.outerHTML = `<iframe id="linkVideoIframePlayer" src="https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&fs=1&playsinline=1&enablejsapi=1&rel=0&modestbranding=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" allowfullscreen></iframe>`;
    }
  },

  iniciarSincronizacionSubtitulos() {
    this.detenerSincronizacionSubtitulos();
    this.subSyncInterval = setInterval(() => {
      let currentTime = 0;
      if (this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
        try { currentTime = this.ytPlayer.getCurrentTime(); } catch (e) {}
      }
      this.actualizarSubtituloActivo(currentTime);
    }, 100);
  },

  detenerSincronizacionSubtitulos() {
    if (this.subSyncInterval) {
      clearInterval(this.subSyncInterval);
      this.subSyncInterval = null;
    }
  },

  actualizarSubtituloActivo(currentTime) {
    const subTextEl = document.getElementById('hitvSubtitlesText');
    const auroraEl = document.getElementById('hitvAuroraContainer');
    if (!subTextEl) return;

    if (!this.currentCues || this.currentCues.length === 0) {
      subTextEl.classList.add('hitv-subtitle-hidden');
      if (auroraEl) auroraEl.classList.remove('hitv-aurora-hidden');
      return;
    }

    if (auroraEl) auroraEl.classList.add('hitv-aurora-hidden');

    const activeCue = this.currentCues.find(cue => {
      const dur = typeof cue.dur === 'number' && cue.dur > 0 ? cue.dur : 3;
      return currentTime >= cue.start && currentTime < (cue.start + dur);
    });

    if (activeCue && activeCue.text) {
      if (this.lastDisplayedCueText !== activeCue.text) {
        this.lastDisplayedCueText = activeCue.text;
        subTextEl.textContent = activeCue.text;
        subTextEl.classList.remove('hitv-subtitle-hidden');
      }
    } else {
      if (this.lastDisplayedCueText !== '') {
        this.lastDisplayedCueText = '';
        subTextEl.classList.add('hitv-subtitle-hidden');
      }
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
    this.detenerSincronizacionSubtitulos();
    this.currentCues = [];
    this.lastDisplayedCueText = null;
    this.activeVideoData = null;
    this.isPlayingAudioBackground = false;

    if (this.ytPlayer) {
      try {
        if (typeof this.ytPlayer.destroy === 'function') {
          this.ytPlayer.destroy();
        }
      } catch (e) {}
      this.ytPlayer = null;
    }

    if (window.socket) {
      window.socket.emit('actividad:detener_viendo');
    }

    const modal = document.getElementById('modalPlayerLinkVideo');
    if (modal) {
      modal.style.display = 'none';
      modal.innerHTML = '';
    }

    this.actualizarAudioBannerTop();
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

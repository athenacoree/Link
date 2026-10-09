/* Lógica para Link Video (Streaming de Películas, Video y Audio), Algoritmo de Recomendación y Reels Verticales */

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

function esReelOShort(url = '', title = '') {
  const normUrl = (url || '').toLowerCase();
  const normTitle = (title || '').toLowerCase();
  return normUrl.includes('/shorts/') || normUrl.includes('#shorts') || normTitle.includes('#shorts') || normTitle.includes('reel') || normTitle.includes('short');
}

// ---------------- GESTOR DE CACHÉ LOCAL PERSISTENTE PARA PORTADAS ----------------
const CoverCache = {
  CACHE_NAME: 'link-covers-v1',
  memoryMap: new Map(),

  async obtenerPortada(url, id = '') {
    if (!url || typeof url !== 'string') {
      return 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=600';
    }

    if (this.memoryMap.has(url)) {
      return this.memoryMap.get(url);
    }

    if (!('caches' in window)) {
      return url;
    }

    try {
      const cache = await caches.open(this.CACHE_NAME);
      const cachedRes = await cache.match(url);
      if (cachedRes) {
        const blob = await cachedRes.blob();
        const objectUrl = URL.createObjectURL(blob);
        this.memoryMap.set(url, objectUrl);
        return objectUrl;
      }

      // Descargar y guardar en caché si es nueva o cambió
      fetch(url, { mode: 'cors' }).then(async (res) => {
        if (res.ok) {
          const resToCache = res.clone();
          await cache.put(url, resToCache);
          const blob = await res.blob();
          const objectUrl = URL.createObjectURL(blob);
          this.memoryMap.set(url, objectUrl);
        }
      }).catch(() => {});

      return url;
    } catch (e) {
      return url;
    }
  }
};

window.LinkVideo = {
  initialized: false,
  collections: [],
  catalog: [],
  activeLives: [],
  recommendations: null,
  reels: [],
  baseUrl: '',

  // Colección actual seleccionada y cola de reproductor
  currentCollection: null,
  currentVideos: [],
  currentVideoIndex: -1,

  // Estado de Reels
  currentReelsIndex: 0,
  activeReelsList: [],

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
      const queryParams = new URLSearchParams();
      if (forceRefresh) queryParams.set('refresh', 'true');
      if (this.searchQuery) queryParams.set('search', this.searchQuery);
      if (this.selectedCategory && this.selectedCategory !== 'Todas') queryParams.set('category', this.selectedCategory);

      const url = '/linkvideo/catalog?' + queryParams.toString();
      const res = await api(url);
      if (res) {
        this.collections = res.collections || [];
        this.catalog = res.catalog || [];
        this.activeLives = res.lives || [];
        this.recommendations = res.recommendations || null;
        this.reels = res.reels || [];
        this.baseUrl = res.base_url || '';
        this.setupUIControls();
        await this.renderizarColecciones(this.collections);
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
      let searchTimeout;
      searchInput.oninput = (e) => {
        clearTimeout(searchTimeout);
        this.searchQuery = (e.target.value || '').trim().toLowerCase();
        searchTimeout = setTimeout(() => {
          if (this.currentCollection) {
            this.renderizarDetalleColeccion(this.currentCollection);
          } else {
            this.cargarCatalogo(false);
          }
        }, 300);
      };
    }
  },

  /**
   * Envia la información de reproducción al algoritmo de recomendación
   */
  async registrarVisualizacionVideo(video) {
    if (!video || (!video.video_id && !video.id)) return;

    const vid = video.video_id || video.id;
    const isReel = esReelOShort(video.original_url, video.title);

    try {
      await api('/linkvideo/view', {
        method: 'POST',
        body: {
          videoId: vid,
          collectionId: video.collection_id || null,
          tags: video.hidden_tags || [],
          isReel
        }
      });
    } catch (e) {
      console.warn('[LinkVideo Algorithm] Error registrando reproducción:', e.message);
    }
  },

  async renderizarColecciones(colecciones) {
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
    const catSet = new Set(['Todas', '🔥 Recomendados', '📱 Reels / Shorts']);
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

    if (this.selectedCategory === '📱 Reels / Shorts') {
      this.renderizarSeccionReels();
      return;
    }

    if (this.selectedCategory === '🔥 Recomendados') {
      if (this.recommendations && Array.isArray(this.recommendations.collections) && this.recommendations.collections.length > 0) {
        filtradas = this.recommendations.collections;
      }
    } else if (this.selectedCategory && this.selectedCategory !== 'Todas') {
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

    // Cargar portadas desde caché local persistente
    const colCardsHtml = await Promise.all(filtradas.map(async col => {
      const rawCover = col.cover_url || 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=600';
      const cover = await CoverCache.obtenerPortada(rawCover, col.id);
      const categoryTag = col.category || 'General';

      const svgTag = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:3px;"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>`;

      return `
        <div class="linkvideo-square-card" onclick="LinkVideo.abrirColeccion('${col.id}')">
          <img class="linkvideo-card-thumb-img" src="${cover}" alt="${escapeHTMLLinkVideo(col.name)}" onerror="this.src='https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=600'">
          <div class="linkvideo-card-overlay-gradient">
            <div style="font-size:10px; font-weight:800; background:rgba(0,0,0,0.6); color:#ddd6fe; padding:2px 6px; border-radius:6px; width:fit-content; margin-bottom:4px; display:inline-flex; align-items:center;">${svgTag}${escapeHTMLLinkVideo(categoryTag)}</div>
            <div class="linkvideo-card-title">${escapeHTMLLinkVideo(col.name)}</div>
          </div>
        </div>
      `;
    }));

    gridEl.innerHTML = colCardsHtml.join('');
  },

  abrirRecomendadoIndividual(vidOrId) {
    let foundVid = null;
    for (const c of this.collections) {
      if (Array.isArray(c.videos)) {
        const match = c.videos.find(v => v.id === vidOrId || v.video_id === vidOrId);
        if (match) {
          foundVid = match;
          this.currentCollection = c;
          this.currentVideos = c.videos;
          break;
        }
      }
    }

    if (foundVid) {
      if (esReelOShort(foundVid.original_url, foundVid.title)) {
        this.abrirReproductorReels(foundVid);
      } else {
        this.abrirReproductorLinkVideo(foundVid);
      }
    }
  },

  renderizarSeccionReels() {
    const gridEl = document.getElementById('linkVideoCollectionsGrid');
    if (!gridEl) return;

    if (!this.reels || this.reels.length === 0) {
      gridEl.innerHTML = `<div class="aviso-vacio" style="grid-column: 1 / -1; padding:30px;">No hay Reels/Shorts disponibles en este momento.</div>`;
      return;
    }

    gridEl.innerHTML = `
      <div style="grid-column: 1 / -1; margin-bottom:12px;">
        <div style="font-size:16px; font-weight:900; color:var(--texto-900); margin-bottom:4px; display:flex; align-items:center; gap:8px;">
          <span style="background:linear-gradient(135deg, #ef4444, #f59e0b); color:#fff; padding:3px 10px; border-radius:12px; font-size:12px; font-weight:900;">REELS & SHORTS</span>
          Deslizamiento Vertical Pantalla Completa
        </div>
      </div>
      ${this.reels.map((reel, idx) => `
        <div class="linkvideo-square-card" onclick="LinkVideo.abrirReproductorReelsPorIndice(${idx})">
          <img class="linkvideo-card-thumb-img" src="${reel.thumbnail_url || 'https://img.youtube.com/vi/' + reel.video_id + '/hqdefault.jpg'}" alt="${escapeHTMLLinkVideo(reel.title)}">
          <div class="linkvideo-card-overlay-gradient">
            <div class="linkvideo-card-title">${escapeHTMLLinkVideo(reel.title)}</div>
          </div>
        </div>
      `).join('')}
    `;
  },

  abrirReproductorReelsPorIndice(index) {
    if (this.reels && this.reels[index]) {
      this.abrirReproductorReels(this.reels[index], this.reels, index);
    }
  },

  // ---------------- REPRODUCTOR FULLSCREEN VERTICAL DE REELS / SHORTS ----------------
  abrirReproductorReels(video, reelsList = null, initialIndex = 0) {
    if (!video) return;

    this.activeReelsList = (Array.isArray(reelsList) && reelsList.length > 0) ? reelsList : (this.reels.length > 0 ? this.reels : [video]);
    this.currentReelsIndex = initialIndex >= 0 ? initialIndex : this.activeReelsList.findIndex(r => (r.video_id || r.id) === (video.video_id || video.id));
    if (this.currentReelsIndex < 0) this.currentReelsIndex = 0;

    let modal = document.getElementById('modalReelsPlayer');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalReelsPlayer';
      modal.className = 'modal-reels-container';
      document.body.appendChild(modal);
    }

    modal.style.display = 'flex';
    this.renderizarFeedReelsFullscreen();

    // Registrar reproducción para el algoritmo
    this.registrarVisualizacionVideo(this.activeReelsList[this.currentReelsIndex]);
  },

  renderizarFeedReelsFullscreen() {
    const modal = document.getElementById('modalReelsPlayer');
    if (!modal) return;

    const list = this.activeReelsList || [];

    const vectorClose = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;

    const vectorHeart = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.78-8.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
      </svg>
    `;

    const vectorShare = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="18" cy="5" r="3"></circle>
        <circle cx="6" cy="12" r="3"></circle>
        <circle cx="18" cy="19" r="3"></circle>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
      </svg>
    `;

    const vectorUp = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="18 15 12 9 6 15"></polyline>
      </svg>
    `;

    const vectorDown = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    `;

    modal.innerHTML = `
      <div class="reels-vertical-scroll" id="reelsVerticalScrollContainer">
        ${list.map((r, idx) => {
          const isCurrent = idx === this.currentReelsIndex;
          const vidId = r.video_id || r.id;
          const isInstagram = r.provider === 'instagram' || (r.original_url && r.original_url.includes('instagram.com/reel'));
          const embedSrc = isInstagram
            ? (r.embed_url || `https://www.instagram.com/reel/${vidId}/embed`)
            : `https://www.youtube.com/embed/${vidId}?autoplay=1&controls=1&fs=1&playsinline=1&enablejsapi=1&rel=0`;

          return `
            <div class="reel-item-card ${isInstagram ? 'instagram-reel-aspect' : ''}" id="reelCardItem_${idx}" data-index="${idx}">
              <div class="reel-top-bar">
                <button class="reel-close-btn" onclick="LinkVideo.cerrarReproductorReels()" title="Cerrar Reels">
                  ${vectorClose}
                </button>
              </div>

              ${isCurrent ? `
                <iframe class="reel-video-iframe" src="${embedSrc}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
              ` : `
                <div style="background:#111; width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
                  <img src="${r.thumbnail_url || 'https://img.youtube.com/vi/' + vidId + '/hqdefault.jpg'}" style="width:100%; height:100%; object-fit:cover; opacity:0.6;">
                </div>
              `}

              <!-- Overlay de información del Reel -->
              <div class="reel-overlay-info">
                <div style="font-size:16px; font-weight:900; color:#fff; margin-bottom:4px;">${escapeHTMLLinkVideo(r.title)}</div>
                <div style="font-size:12px; font-weight:700; color:#ddd6fe;">${escapeHTMLLinkVideo(r.collection_name || 'Link Video')}</div>
              </div>

              <!-- Botones de Acción flotantes a la derecha -->
              <div class="reel-overlay-actions">
                <button class="reel-action-btn" onclick="LinkVideo.reproducirAnteriorReel()" title="Reel Anterior">
                  ${vectorUp}
                </button>

                <button class="reel-action-btn" onclick="LinkVideo.darMeGustaReel(this)" title="Me Gusta">
                  ${vectorHeart}
                </button>

                <button class="reel-action-btn" onclick="LinkVideo.compartirReel('${vidId}')" title="Compartir">
                  ${vectorShare}
                </button>

                <button class="reel-action-btn" onclick="LinkVideo.reproducirSiguienteReel()" title="Siguiente Reel">
                  ${vectorDown}
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Hacer scroll suave hasta el elemento actual
    const targetCard = document.getElementById(`reelCardItem_${this.currentReelsIndex}`);
    if (targetCard) {
      targetCard.scrollIntoView({ behavior: 'auto' });
    }

    // Escuchar scroll para actualizar el índice activo y registrar la vista
    const scrollContainer = document.getElementById('reelsVerticalScrollContainer');
    if (scrollContainer) {
      let scrollTimeout;
      scrollContainer.onscroll = () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          const index = Math.round(scrollContainer.scrollTop / window.innerHeight);
          if (index !== this.currentReelsIndex && index >= 0 && index < list.length) {
            this.currentReelsIndex = index;
            this.renderizarFeedReelsFullscreen();
            this.registrarVisualizacionVideo(list[index]);
          }
        }, 150);
      };
    }
  },

  reproducirSiguienteReel() {
    if (this.currentReelsIndex < (this.activeReelsList || []).length - 1) {
      this.currentReelsIndex += 1;
      this.renderizarFeedReelsFullscreen();
      this.registrarVisualizacionVideo(this.activeReelsList[this.currentReelsIndex]);
    }
  },

  reproducirAnteriorReel() {
    if (this.currentReelsIndex > 0) {
      this.currentReelsIndex -= 1;
      this.renderizarFeedReelsFullscreen();
      this.registrarVisualizacionVideo(this.activeReelsList[this.currentReelsIndex]);
    }
  },

  darMeGustaReel(btn) {
    if (btn) {
      btn.style.background = '#ef4444';
      if (window.mostrarToast) window.mostrarToast('¡Guardado en tus reels favoritos!');
    }
  },

  compartirReel(videoId) {
    const url = `https://www.youtube.com/shorts/${videoId}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        if (window.mostrarToast) window.mostrarToast('¡Enlace del Reel copiado al portapapeles!');
      });
    } else if (window.mostrarToast) {
      window.mostrarToast(`Reel: ${url}`);
    }
  },

  cerrarReproductorReels() {
    const modal = document.getElementById('modalReelsPlayer');
    if (modal) {
      modal.style.display = 'none';
      modal.innerHTML = '';
    }
    this.cargarCatalogo();
  },

  toggleAlbumDesc(el) {
    if (el) {
      el.classList.toggle('expandido');
    }
  },

  filtrarPorCategoria(cat) {
    this.selectedCategory = cat;
    this.cargarCatalogo(false);
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
        await this.renderizarDetalleColeccion(this.currentCollection);
      } else {
        detailView.innerHTML = `<div class="aviso-vacio">No se pudo cargar la colección.</div>`;
      }
    } catch (err) {
      detailView.innerHTML = `<div class="aviso-vacio">Error al obtener detalles de la colección.</div>`;
    }
  },

  async renderizarDetalleColeccion(col) {
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

    const rawCover = col.cover_url || 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=600';
    const cover = await CoverCache.obtenerPortada(rawCover, col.id);
    const categoryTag = col.category || 'General';
    const esAdmin = !!(window.currentUser?.is_admin || window.MI_ES_ADMIN);

    const colAudioDesc = col.audio_description || '';

    const svgTagDetail = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:3px;"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>`;
    const svgVideoClap = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:3px;"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>`;
    const svgMic = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:3px;"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`;
    const svgPlayIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="#ffffff"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;

    detailView.innerHTML = `
      <div style="margin-bottom:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <button class="btn btn-secundario mini-btn" onclick="LinkVideo.volverAColecciones()" style="padding:8px 14px; font-weight:800; border-radius:14px; display:flex; align-items:center; gap:4px;">
            ‹ Volver a Álbumes
          </button>
          ${esAdmin ? `
            <button class="btn btn-primario mini-btn" onclick="LinkVideo.abrirModalAdminAlbum('${col.id}')" style="padding:8px 14px; font-weight:800; border-radius:14px; background:linear-gradient(135deg, #7c3aed, #ec4899); display:inline-flex; align-items:center; gap:6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"></path></svg>
              Administrar álbum
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
                <span style="font-size:11px; font-weight:800; background:var(--morado-600); color:#ffffff; padding:3px 10px; border-radius:10px; display:inline-flex; align-items:center;">${svgTagDetail}${escapeHTMLLinkVideo(categoryTag)}</span>
                <span style="font-size:12px; color:var(--morado-700); font-weight:800; display:inline-flex; align-items:center;">${svgVideoClap}${videos.length} video${videos.length === 1 ? '' : 's'}</span>
              </div>
              ${colAudioDesc ? `
                <div class="linkvideo-album-desc-truncated" onclick="LinkVideo.toggleAlbumDesc(this)" title="Toca para expandir / contraer">
                  ${svgMic}${escapeHTMLLinkVideo(colAudioDesc)}
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
                <div style="display:flex; align-items:center; justify-content:center; margin:auto; filter:drop-shadow(0 2px 8px rgba(0,0,0,0.6));">${svgPlayIcon}</div>
              </div>
            </div>
            <div class="linkvideo-video-title-below" title="${escapeHTMLLinkVideo(v.title)}">${escapeHTMLLinkVideo(v.title)}</div>
            ${v.audio_description ? `<div style="font-size:10.5px; color:var(--texto-500); text-align:center; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${svgMic}${escapeHTMLLinkVideo(v.audio_description)}</div>` : ''}
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
                    <button class="mini-btn primario" onclick="LinkVideo.guardarTituloVideo('${v.id}')" title="Guardar cambios" style="padding:6px 8px;">💾</button>
                    <button class="mini-btn peligro" onclick="LinkVideo.eliminarVideoDeAlbum('${col.id}', '${v.id}')" title="Eliminar video" style="padding:6px 8px;">🗑️</button>
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

    // Verificar si es un YouTube Short / Reel
    if (esReelOShort(video.original_url, video.title)) {
      this.abrirReproductorReels(video, this.currentVideos, index);
    } else {
      this.abrirReproductorLinkVideo(video);
    }
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

  ytPlayer: null,
  activeVideoData: null,
  isPlayingAudioBackground: false,
  isAudioProtectionActive: true, // Protección de volumen activada por defecto al entrar
  hasUserActivatedVolume: false, // Flag de volumen activado por usuario en la sesión de Link Video

  async abrirReproductorLinkVideo(video) {
    if (!video || !video.video_id) return;

    // Destruir cualquier reproductor anterior antes de iniciar uno nuevo
    this.limpiarReproductorAnterior();

    this.activeVideoData = video;
    this.isPlayingAudioBackground = true;

    // Registrar reproducción para el algoritmo
    this.registrarVisualizacionVideo(video);

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

    // Inicializar reproductor mediante YouTube IFrame Player API con origin y manejo de error 153
    let rawOrigin = window.location.origin;
    if (!rawOrigin || rawOrigin === 'null' || rawOrigin.startsWith('file://')) {
      rawOrigin = undefined;
    }

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
            modestbranding: 1,
            origin: rawOrigin,
            widget_referrer: window.location.href
          },
          events: {
            onReady: (event) => {
              try {
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
                this.actualizarAudioBannerTop();
              } else if (window.YT && event.data === YT.PlayerState.PAUSED) {
                this.isPlayingAudioBackground = false;
                this.actualizarAudioBannerTop();
              } else if (window.YT && event.data === YT.PlayerState.ENDED) {
                this.isPlayingAudioBackground = false;
                this.actualizarAudioBannerTop();
                this.reproducirSiguienteVideo();
              }
            },
            onError: (event) => {
              console.warn('[LinkVideo Player] Error en reproductor YouTube API (Error ' + event.data + '). Activando fallback directo...');
              this.crearIframeFallback(video.video_id);
            }
          }
        });
      } catch (err) {
        console.warn('[LinkVideo] Fallback iframe directo por excepción:', err.message);
        this.crearIframeFallback(video.video_id);
      }
    });

    // Fallback de respaldo por si la API de YouTube no responde
    setTimeout(() => {
      if (!this.ytPlayer && document.getElementById('linkVideoIframeContainer')) {
        const container = document.getElementById('linkVideoIframeContainer');
        if (container && !container.querySelector('iframe')) {
          this.crearIframeFallback(video.video_id);
        }
      }
    }, 2200);

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

  limpiarReproductorAnterior() {
    this.detenerTimerBannerAudio();

    if (this.ytPlayer) {
      try {
        if (typeof this.ytPlayer.destroy === 'function') {
          this.ytPlayer.destroy();
        }
      } catch (e) {}
      this.ytPlayer = null;
    }
  },

  toggleFolderVideosList() {
    const container = document.getElementById('hitvFolderVideosContainer');
    const arrowSvg = document.getElementById('hitvFolderToggleArrowSvg');
    if (!container) return;

    const isHidden = container.style.display === 'none';
    if (isHidden) {
      this.renderizarVideosCarpetaPlayer();
      container.style.display = 'flex';
      if (arrowSvg) arrowSvg.style.transform = 'rotate(180deg)';
    } else {
      container.style.display = 'none';
      if (arrowSvg) arrowSvg.style.transform = 'rotate(0deg)';
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
    const svgPlayingBadge = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block; vertical-align:middle; margin-right:4px;">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
    `;
    const svgMicSmall = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:3px;"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`;

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
              <div style="position:absolute; top:10px; right:10px; background:#7c3aed; color:#fff; font-size:11px; font-weight:900; padding:4px 10px; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.4); display:inline-flex; align-items:center;">
                ${svgPlayingBadge}Reproduciendo
              </div>
            ` : ''}
          </div>
          <div class="hitv-folder-card-info">
            <div class="hitv-folder-card-title">${escapeHTMLLinkVideo(v.title)}</div>
            ${v.audio_description ? `<div style="font-size:11px; color:rgba(255,255,255,0.6);">${svgMicSmall}${escapeHTMLLinkVideo(v.audio_description)}</div>` : ''}
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

      const vectorPlay = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
      const vectorPause = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>`;
      const vectorPrev = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"></line></svg>`;
      const vectorNext = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"></line></svg>`;
      const vectorExpand = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>`;
      const vectorClose = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

      banner.innerHTML = `
        <div style="display:flex; flex-direction:column; width:100%; gap:4px; padding:4px 0;">
          <div style="display:flex; align-items:center; justify-content:space-between; width:100%; gap:10px;">
            <div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1; cursor:pointer;" onclick="LinkVideo.reabrirReproductorModal()">
              <img id="topAudioThumb" src="" style="width:36px; height:36px; border-radius:10px; object-fit:cover; flex-shrink:0; box-shadow:0 2px 8px rgba(0,0,0,0.2);">
              <div style="display:flex; flex-direction:column; min-width:0; flex:1;">
                <div id="topAudioMiniTitle" style="font-size:12px; font-weight:800; color:var(--texto-900); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Link Video</div>
                <div style="display:flex; align-items:center; gap:6px; font-size:10.5px; color:var(--texto-500); font-weight:700;">
                  <span id="topAudioTimeText">00:00 / 00:00</span>
                </div>
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
              <button onclick="LinkVideo.reproducirAnteriorVideo()" style="background:none; border:none; color:var(--texto-800); cursor:pointer; padding:6px; display:flex; align-items:center;" title="Anterior">
                ${vectorPrev}
              </button>
              <button id="topAudioBtnTogglePlay" onclick="LinkVideo.togglePlayPauseAudioBanner()" style="background:var(--morado-600); border:none; color:#ffffff; width:32px; height:32px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 10px rgba(124,58,237,0.3);" title="Play / Pausa">
                ${vectorPause}
              </button>
              <button onclick="LinkVideo.reproducirSiguienteVideo()" style="background:none; border:none; color:var(--texto-800); cursor:pointer; padding:6px; display:flex; align-items:center;" title="Siguiente">
                ${vectorNext}
              </button>
              <button onclick="LinkVideo.reabrirReproductorModal()" style="background:none; border:none; color:var(--texto-800); cursor:pointer; padding:6px; display:flex; align-items:center;" title="Expandir reproductor">
                ${vectorExpand}
              </button>
              <button onclick="LinkVideo.cerrarReproductorLinkVideo()" style="background:none; border:none; color:var(--peligro); cursor:pointer; padding:6px; display:flex; align-items:center;" title="Cerrar">
                ${vectorClose}
              </button>
            </div>
          </div>
          <div style="width:100%; background:var(--borde); height:3px; border-radius:2px; overflow:hidden; cursor:pointer;" onclick="LinkVideo.seekAudioBanner(event)">
            <div id="topAudioProgressBar" style="width:0%; height:100%; background:linear-gradient(90deg, var(--morado-600), #ec4899); transition:width 0.3s linear;"></div>
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

    if (this.activeVideoData) {
      banner.classList.remove('oculto');
      const titleEl = document.getElementById('topAudioMiniTitle');
      const thumbEl = document.getElementById('topAudioThumb');
      const toggleBtn = document.getElementById('topAudioBtnTogglePlay');

      if (titleEl && this.activeVideoData.title) {
        titleEl.textContent = this.activeVideoData.title;
      }
      if (thumbEl) {
        thumbEl.src = this.activeVideoData.thumbnail_url || `https://img.youtube.com/vi/${this.activeVideoData.video_id}/hqdefault.jpg`;
      }
      if (toggleBtn) {
        const vectorPlay = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
        const vectorPause = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>`;
        toggleBtn.innerHTML = this.isPlayingAudioBackground ? vectorPause : vectorPlay;
      }
      this.iniciarTimerBannerAudio();
    } else {
      banner.classList.add('oculto');
      this.detenerTimerBannerAudio();
    }
  },

  seekAudioBanner(e) {
    if (!this.ytPlayer || typeof this.ytPlayer.getDuration !== 'function' || typeof this.ytPlayer.seekTo !== 'function') return;
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const duration = this.ytPlayer.getDuration() || 0;
    this.ytPlayer.seekTo(pct * duration, true);
  },

  bannerTimerInterval: null,

  iniciarTimerBannerAudio() {
    this.detenerTimerBannerAudio();
    this.bannerTimerInterval = setInterval(() => {
      const timeEl = document.getElementById('topAudioTimeText');
      const progressEl = document.getElementById('topAudioProgressBar');
      if (!timeEl || !this.ytPlayer) return;

      try {
        if (typeof this.ytPlayer.getCurrentTime === 'function' && typeof this.ytPlayer.getDuration === 'function') {
          const current = Math.floor(this.ytPlayer.getCurrentTime() || 0);
          const duration = Math.floor(this.ytPlayer.getDuration() || 0);
          const remaining = Math.max(0, duration - current);

          timeEl.textContent = `${this.formatTimeSeconds(current)} / -${this.formatTimeSeconds(remaining)}`;
          if (progressEl && duration > 0) {
            progressEl.style.width = `${Math.min(100, (current / duration) * 100)}%`;
          }
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
    const playerTarget = document.getElementById('linkVideoIframePlayer') || document.getElementById('linkVideoIframeContainer');
    if (playerTarget) {
      const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&fs=1&playsinline=1&enablejsapi=1&rel=0&modestbranding=1`;
      playerTarget.innerHTML = `<iframe id="linkVideoIframePlayer" src="${embedUrl}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" allowfullscreen style="width:100%; height:100%; border:none;"></iframe>`;
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
    this.limpiarReproductorAnterior();
    this.activeVideoData = null;
    this.isPlayingAudioBackground = false;

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

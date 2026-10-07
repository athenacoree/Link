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

    let filtradas = colecciones || [];
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtradas = filtradas.filter(c => (c.name || '').toLowerCase().includes(q));
    }

    if (!filtradas || filtradas.length === 0) {
      gridEl.innerHTML = `<div class="aviso-vacio" style="grid-column: 1 / -1; padding:30px;">No se encontraron colecciones o álbumes.</div>`;
      return;
    }

    gridEl.innerHTML = filtradas.map(col => {
      const cover = col.cover_url || 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=600';
      const count = col.video_count || (col.videos ? col.videos.length : 0);

      return `
        <div class="linkvideo-square-card" onclick="LinkVideo.abrirColeccion('${col.id}')">
          <img class="linkvideo-card-thumb-img" src="${cover}" alt="${escapeHTMLLinkVideo(col.name)}" onerror="this.src='https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=600'">
          <div class="linkvideo-card-overlay-gradient">
            <div class="linkvideo-card-title">${escapeHTMLLinkVideo(col.name)}</div>
            <div class="linkvideo-card-badge-count">🎬 ${count} video${count === 1 ? '' : 's'}</div>
          </div>
        </div>
      `;
    }).join('');
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
    if (!detailView) return;

    let videos = col.videos || [];
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      videos = videos.filter(v => (v.title || '').toLowerCase().includes(q));
    }

    const cover = col.cover_url || 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=600';

    detailView.innerHTML = `
      <div style="margin-bottom:16px;">
        <button class="btn btn-secundario mini-btn" onclick="LinkVideo.volverAColecciones()" style="padding:8px 14px; font-weight:800; border-radius:12px; margin-bottom:12px;">
          ‹ Volver a Colecciones
        </button>
        <div style="display:flex; align-items:center; gap:14px; background:var(--blanco); border:1.5px solid rgba(139, 92, 246, 0.2); border-radius:18px; padding:12px; box-shadow:0 4px 16px rgba(91, 33, 182, 0.08);">
          <img src="${cover}" style="width:64px; height:64px; border-radius:14px; object-fit:cover;" alt="Cover">
          <div>
            <div style="font-weight:900; font-size:16px; color:var(--texto-900);">${escapeHTMLLinkVideo(col.name)}</div>
            <div style="font-size:12px; color:var(--morado-700); font-weight:700;">${videos.length} video${videos.length === 1 ? '' : 's'} disponibles</div>
          </div>
        </div>
      </div>

      <div class="grid-cuadrados-linkvideo" id="linkVideoVideosGrid">
        ${videos.length === 0 ? `<div class="aviso-vacio" style="grid-column: 1 / -1;">Esta colección no tiene videos aún.</div>` : videos.map((v, idx) => `
          <div class="linkvideo-square-card" onclick="LinkVideo.reproducirVideoColeccion(${idx})">
            <img class="linkvideo-card-thumb-img" src="${v.thumbnail_url || 'https://img.youtube.com/vi/' + v.video_id + '/hqdefault.jpg'}" alt="${escapeHTMLLinkVideo(v.title)}">
            <div class="linkvideo-card-overlay-gradient">
              <div style="font-size:24px; text-align:center; margin-bottom:auto; padding-top:14px;">▶</div>
              <div class="linkvideo-card-title">${escapeHTMLLinkVideo(v.title)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
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
      modal.style.cssText = 'position:fixed; inset:0; z-index:100000; background:#000; display:flex; flex-direction:column; color:#fff;';
      document.body.appendChild(modal);
    }

    modal.style.display = 'flex';

    let rawOrigin = window.location.origin;
    if (!rawOrigin || rawOrigin === 'null' || rawOrigin.startsWith('file://')) {
      rawOrigin = window.location.protocol && window.location.host ? (window.location.protocol + '//' + window.location.host) : '';
    }

    const params = [
      'autoplay=1',
      'enablejsapi=1',
      'rel=0',
      'modestbranding=1',
      'controls=1',
      'widget_referrer=' + encodeURIComponent(window.location.href)
    ];
    if (rawOrigin && !rawOrigin.startsWith('file://') && rawOrigin !== 'null') {
      params.push('origin=' + encodeURIComponent(rawOrigin));
    }

    const embedUrl = `https://www.youtube.com/embed/${video.video_id}?${params.join('&')}`;

    modal.innerHTML = `
      <!-- Header -->
      <div style="position:absolute; top:0; left:0; right:0; z-index:20; padding:12px 16px; background:linear-gradient(to bottom, rgba(0,0,0,0.85), transparent); display:flex; justify-content:space-between; align-items:center;">
        <button onclick="LinkVideo.cerrarReproductorLinkVideo()" style="background:rgba(255,255,255,0.2); border:none; color:#fff; width:36px; height:36px; border-radius:50%; font-size:20px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center;">&times;</button>
        <div style="text-align:center; flex:1; min-width:0; padding:0 12px;">
          <div style="font-weight:800; font-size:14px; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTMLLinkVideo(video.title)}</div>
          <div style="font-size:11px; color:rgba(255,255,255,0.7);">${this.currentCollection ? escapeHTMLLinkVideo(this.currentCollection.name) : 'Link Video'}</div>
        </div>
        <button onclick="LinkVideo.toggleFullscreenPlayer()" style="background:rgba(255,255,255,0.2); border:none; color:#fff; width:36px; height:36px; border-radius:50%; font-size:16px; cursor:pointer; display:flex; align-items:center; justify-content:center;" title="Pantalla completa">⛶</button>
      </div>

      <!-- Video Stage -->
      <div id="linkVideoIframeContainer" style="flex:1; position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#000;">
        <iframe id="linkVideoIframePlayer" src="${embedUrl}" style="width:100%; height:100%; border:none;" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" allowfullscreen></iframe>
      </div>

      <!-- Controls & Queue Footer -->
      <div style="position:absolute; bottom:0; left:0; right:0; z-index:20; padding:12px 16px; background:linear-gradient(to top, rgba(0,0,0,0.85), transparent); display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <button onclick="LinkVideo.reproducirAnteriorVideo()" ${this.currentVideoIndex <= 0 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''} class="btn btn-secundario mini-btn" style="padding:8px 14px; font-weight:800; border-radius:12px;">
          ⏮ Anterior
        </button>

        <span style="font-size:12px; font-weight:700; color:rgba(255,255,255,0.8);">
          ${this.currentVideoIndex + 1} de ${this.currentVideos.length}
        </span>

        <button onclick="LinkVideo.reproducirSiguienteVideo()" ${this.currentVideoIndex >= this.currentVideos.length - 1 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''} class="btn btn-primario mini-btn" style="padding:8px 14px; font-weight:800; border-radius:12px;">
          Siguiente ⏭
        </button>
      </div>
    `;

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
    const modal = document.getElementById('modalPlayerLinkVideo');
    if (modal) {
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

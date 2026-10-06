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
  catalog: [],
  activeLives: [],
  baseUrl: '',

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

  // Evento en tiempo real para actualización de canales de YouTube
  window.socket.on('youtube:channel_updated', (data) => {
    if (data && data.channel) {
      console.log('[LinkVideo] Canal de YouTube actualizado:', data.channel);
      this.cargarCatalogo(false);
    }
  });

    // Eventos de estado de Live
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

    // Señalización WebRTC para Live
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

  selectedCategory: 'all',
  searchQuery: '',

  async cargarCatalogo(forceRefresh = false) {
    const contenedor = document.getElementById('linkVideoGrid');
    if (!contenedor) return;

    contenedor.innerHTML = `<div style="text-align:center; padding:30px; color:var(--texto-500); font-weight:700;">Verificando transmisiones en directo...</div>`;

    try {
      const url = forceRefresh ? '/linkvideo/catalog?refresh=true' : '/linkvideo/catalog';
      const res = await api(url);
      if (res) {
        this.catalog = res.catalog || [];
        this.activeLives = res.lives || [];
        this.youtubeChannels = res.youtubeChannels || [];
        this.baseUrl = res.base_url || '';
        this.renderizarCanalesYouTube(this.youtubeChannels);
        this.renderizarLivesActivos(this.activeLives);
        this.setupUIControls();
        this.actualizarDisponibilidadPills();
        this.aplicarFiltrosYRenderizar();
      } else {
        contenedor.innerHTML = `<div class="aviso-vacio">No hay transmisiones disponibles en este momento.</div>`;
      }
    } catch (err) {
      console.error('Error al cargar catálogo de Link Video:', err);
      contenedor.innerHTML = `<div class="aviso-vacio">No se pudo conectar con el servidor de streaming de Link Video.</div>`;
    }
  },

  setupUIControls() {
    const pills = document.querySelectorAll('#linkVideoCategoryPills .linkvideo-pill');
    pills.forEach(pill => {
      pill.onclick = () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.selectedCategory = pill.dataset.cat || 'all';
        this.aplicarFiltrosYRenderizar();
      };
    });

    const searchInput = document.getElementById('linkVideoSearchInput');
    if (searchInput) {
      searchInput.oninput = (e) => {
        this.searchQuery = (e.target.value || '').trim().toLowerCase();
        this.aplicarFiltrosYRenderizar();
      };
    }
  },

  actualizarDisponibilidadPills() {
    const categoriesPresent = new Set((this.catalog || []).map(item => item.category || item.type));
    const pills = document.querySelectorAll('#linkVideoCategoryPills .linkvideo-pill');

    pills.forEach(pill => {
      const cat = pill.dataset.cat;
      if (cat === 'all') return;
      if (categoriesPresent.has(cat)) {
        pill.style.display = 'inline-block';
      } else {
        // Si no hay transmisiones activas para esta categoría, ocultarla automáticamente
        pill.style.display = 'none';
      }
    });
  },

  aplicarFiltrosYRenderizar() {
    let list = this.catalog || [];

    if (this.selectedCategory && this.selectedCategory !== 'all') {
      list = list.filter(item => item.category === this.selectedCategory || item.type === this.selectedCategory);
    }

    if (this.searchQuery) {
      list = list.filter(item =>
        (item.title || item.name || '').toLowerCase().includes(this.searchQuery) ||
        (item.description || '').toLowerCase().includes(this.searchQuery)
      );
    }

    this.renderizarCatalogo(list);
  },

  renderizarCanalesYouTube(channels) {
    const secEl = document.getElementById('linkYouTubeChannelsSection');
    const gridEl = document.getElementById('linkYouTubeChannelsGrid');
    if (!secEl || !gridEl) return;

    if (!channels || channels.length === 0) {
      secEl.style.display = 'none';
      gridEl.innerHTML = '';
      return;
    }

    secEl.style.display = 'block';
    gridEl.innerHTML = channels.map(item => {
      const isAct = item.is_active && item.video_id;
      const statusLabel = isAct ? '● EN VIVO (YouTube)' : 'INACTIVO';
      const badgeBg = isAct ? '#ef4444' : 'var(--texto-500)';
      const thumb = isAct ? `https://img.youtube.com/vi/${item.video_id}/hqdefault.jpg` : 'https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=600';

      return `
        <div class="card" style="padding:14px; border-radius:16px; background:var(--blanco); border:1.5px solid rgba(239,68,68,0.3); display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 4px 14px rgba(239,68,68,0.08);">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-weight:800; font-size:14px; color:var(--morado-700);">${escapeHTMLLinkVideo(item.channel_name || item.channel_id)}</span>
              <span style="font-size:10px; font-weight:800; background:${badgeBg}; color:#fff; padding:3px 8px; border-radius:12px; text-transform:uppercase;">${statusLabel}</span>
            </div>
            <div style="position:relative; width:100%; height:120px; border-radius:12px; overflow:hidden; margin-bottom:10px; background:#000;">
              <img src="${thumb}" style="width:100%; height:100%; object-fit:cover;" alt="YouTube Thumbnail">
              ${isAct ? `<div style="position:absolute; inset:0; background:rgba(0,0,0,0.25); display:flex; align-items:center; justify-content:center; color:#fff; font-size:32px;">▶</div>` : ''}
            </div>
            <div style="font-weight:800; font-size:14px; color:var(--texto-900); margin-bottom:4px;">${escapeHTMLLinkVideo(item.title || (isAct ? 'Contenido de YouTube' : 'Canal sin transmisión activa'))}</div>
            <div style="font-size:11.5px; color:var(--texto-600); line-height:1.4; margin-bottom:12px;">Transmisión sincronizada servida directamente por el IFrame Player oficial de YouTube.</div>
          </div>
          ${isAct ? `
            <button class="btn btn-primario" style="width:100%; border-radius:10px; font-weight:800; padding:10px; display:inline-flex; align-items:center; justify-content:center; gap:6px; background:linear-gradient(135deg, #ef4444, #b91c1c); border:none;" onclick="LinkVideo.reproducirYouTubeChannel('${escapeHTMLLinkVideo(item.video_id)}', '${escapeHTMLLinkVideo(item.title || item.channel_name)}', ${item.currentTime || 0})">
              <span>▶ Ver Canal (${item.channel_name})</span>
            </button>
          ` : `
            <button class="btn btn-secundario" style="width:100%; border-radius:10px; font-weight:700; padding:10px; opacity:0.6; cursor:not-allowed;" disabled>
              Canal inactivo
            </button>
          `}
        </div>
      `;
    }).join('');
  },

  reproducirYouTubeChannel(videoId, titulo, startSeconds = 0) {
    if (!videoId) return;
    let rawOrigin = window.location.origin;
    if (!rawOrigin || rawOrigin === 'null' || rawOrigin.startsWith('file://')) {
      rawOrigin = window.location.protocol && window.location.host ? (window.location.protocol + '//' + window.location.host) : '';
    }
    const params = ['autoplay=1', 'enablejsapi=1', 'rel=0', 'modestbranding=1', 'widget_referrer=' + encodeURIComponent(window.location.href)];
    if (startSeconds > 0) params.push('start=' + Math.max(0, startSeconds));
    if (rawOrigin && !rawOrigin.startsWith('file://') && rawOrigin !== 'null') {
      params.push('origin=' + encodeURIComponent(rawOrigin));
    }
    const embedUrl = `https://www.youtube.com/embed/${videoId}?${params.join('&')}`;
    if (window.abrirJuego) {
      window.abrirJuego(embedUrl, titulo || 'Canal YouTube', 'youtube_channel');
    } else {
      window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
    }
  },

  renderizarLivesActivos(lives) {
    const secEl = document.getElementById('linkLiveActiveSection');
    const gridEl = document.getElementById('linkLiveActiveGrid');
    if (!secEl || !gridEl) return;

    if (!lives || lives.length === 0) {
      secEl.style.display = 'none';
      gridEl.innerHTML = '';
      return;
    }

    secEl.style.display = 'block';
    gridEl.innerHTML = lives.map(item => {
      const isReconnecting = item.status === 'RECONNECTING' || item.status === 'INTERMISSION';
      const statusLabel = isReconnecting ? 'Reconectando...' : '● EN VIVO';
      const badgeBg = isReconnecting ? '#f59e0b' : '#ef4444';

      return `
        <div class="card" style="padding:14px; border-radius:16px; background:var(--blanco); border:1.5px solid var(--morado-300); display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 4px 14px rgba(139,92,246,0.08);">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-size:22px;">🔴</span>
              <span style="font-size:10px; font-weight:800; background:${badgeBg}; color:#fff; padding:3px 8px; border-radius:12px; text-transform:uppercase;">${statusLabel}</span>
            </div>
            <div style="font-weight:800; font-size:15px; color:var(--texto-900); margin-bottom:4px;">${escapeHTMLLinkVideo(item.title || 'Transmisión en Vivo')}</div>
            <div style="font-size:12px; color:var(--morado-700); font-weight:700; margin-bottom:6px;">Streamer: ${escapeHTMLLinkVideo(item.hostName || 'Usuario')}</div>
            <div style="font-size:11.5px; color:var(--texto-600); line-height:1.4; margin-bottom:12px;">${escapeHTMLLinkVideo(item.description || 'Transmisión directa persistente con reconexión inteligente.')}</div>
          </div>
          <button class="btn btn-primario" style="width:100%; border-radius:10px; font-weight:800; padding:10px; display:inline-flex; align-items:center; justify-content:center; gap:6px; background:linear-gradient(135deg, #8b5cf6, #6366f1); border:none;" onclick="LinkVideo.unirseLiveViewer('${escapeHTMLLinkVideo(item.id)}')">
            <span>📺 Unirse al Live (${item.viewerCount || 0} espectadores)</span>
          </button>
        </div>
      `;
    }).join('');
  },

  renderizarCatalogo(lista) {
    const contenedor = document.getElementById('linkVideoGrid');
    if (!contenedor) return;

    if (!lista || lista.length === 0) {
      contenedor.innerHTML = `<div class="aviso-vacio" style="grid-column: 1 / -1; padding:30px;">No se encontraron transmisiones activas en esta categoría.</div>`;
      return;
    }

    const categoryMap = {
      camaras: { label: '📹 Cámara / TV', bg: '#0284c7' },
      cortos_ai: { label: '🤖 Video AI', bg: '#7c3aed' },
      movies: { label: '🎬 Película', bg: '#e11d48' },
      audio: { label: '📻 Radio / Música', bg: '#059669' }
    };

    contenedor.innerHTML = lista.map(item => {
      const playUrl = item.full_url || item.url || (this.baseUrl + (item.id ? item.id + '/' : ''));
      const catInfo = categoryMap[item.category] || { label: item.type === 'video' ? '🎬 Video' : '📻 Audio', bg: '#7c3aed' };
      const thumb = item.thumbnail || 'https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=600';

      return `
        <div class="linkvideo-card">
          <div class="linkvideo-card-thumb-wrap">
            <img class="linkvideo-card-thumb" src="${thumb}" alt="${escapeHTMLLinkVideo(item.title || item.name)}" onerror="this.src='https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=600'">
            <div class="linkvideo-card-badge" style="background:${catInfo.bg}">${catInfo.label}</div>
          </div>
          <div class="linkvideo-card-body">
            <div class="linkvideo-card-title">${escapeHTMLLinkVideo(item.title || item.name || 'Transmisión')}</div>
            <div class="linkvideo-card-desc">${escapeHTMLLinkVideo(item.description || 'Transmisión en vivo y streaming continuo en Link Video.')}</div>
            <button class="btn btn-primario linkvideo-card-btn" onclick="LinkVideo.reproducir('${escapeHTMLLinkVideo(playUrl)}', '${escapeHTMLLinkVideo(item.title || item.name)}', ${JSON.stringify(item).replace(/"/g, '&quot;')})">
              ▶ Reproducir Stream
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  reproducir(url, titulo, itemData) {
    const isAudio = (itemData && itemData.type === 'audio') || (url && (url.endsWith('.mp3') || url.includes('icecast')));
    if (window.abrirVideoStream) {
      window.abrirVideoStream(url, titulo, isAudio ? 'audio' : 'video', itemData);
    } else if (window.abrirJuego) {
      window.abrirJuego(url, titulo, 'linkvideo');
    } else {
      window.open(url, '_blank');
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

    // Obtener stream de cámara y micrófono
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

    // Registrar en socket
    if (window.socket) {
      window.socket.emit('live:heartbeat', { sessionId: session.id, isHost: true });
    }

    // Iniciar temporizador de heartbeat continuo
    this.iniciarHeartbeatStreamer();
  },

  iniciarHeartbeatStreamer() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

    this.heartbeatInterval = setInterval(async () => {
      if (!this.isHost || !this.activeSessionId) return;

      if (window.socket && window.socket.connected) {
        window.socket.emit('live:heartbeat', { sessionId: this.activeSessionId, isHost: true });
      }

      // Heartbeat HTTP de respaldo para persistencia ante desconexiones de socket
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

    // Obtener metadatos de la transmisión
    try {
      const session = await api(`/linkvideo/live/${sessionId}`);
      if (session) {
        document.getElementById('viewerLiveTitle').textContent = session.title || 'Transmisión en Vivo';
        document.getElementById('viewerLiveHost').textContent = 'Streamer: ' + (session.hostName || 'Usuario');
        document.getElementById('viewerLiveCount').textContent = session.viewerCount || 1;
        this.procesarCambioEstadoViewer(session.status || 'LIVE', session);
      }
    } catch (e) {}

    // Unirse a room mediante socket
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
          // Fallback visual si el archivo mp4 no está presente físicamente
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

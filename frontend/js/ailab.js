/* Lógica para el Laboratorio IA Global en Enlace */

function escapeHTMLAILab(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.AILab = {
  activeCharacterId: null,
  attachments: [],
  initialized: false,
  isGenerating: false,
  socketConnected: false,

  init() {
    if (this.initialized) return;
    this.initialized = true;
    this.bindEvents();
    this.bindSocketEvents();
    this.loadGlobalMessages();
  },

  bindSocketEvents() {
    if (window.socket) {
      window.socket.emit('ailab:unirse');
      this.socketConnected = true;

      window.socket.off('ailab:nuevo_mensaje');
      window.socket.on('ailab:nuevo_mensaje', (msg) => {
        this.appendSingleMessage(msg);
      });

      window.socket.off('ailab:status');
      window.socket.on('ailab:status', (data) => {
        this.setStatus(data.text, data.isWorking !== false);
      });

      window.socket.off('ailab:mensaje_eliminado');
      window.socket.on('ailab:mensaje_eliminado', (data) => {
        if (data && data.id) {
          const el = document.getElementById(`ailab-msg-${data.id}`);
          if (el) {
            el.style.opacity = '0';
            el.style.transform = 'scale(0.95)';
            setTimeout(() => el.remove(), 200);
          }
        }
      });
    }

    const feed = document.getElementById('ailabChatMessages');
    const scrollBtn = document.getElementById('ailabScrollBottomBtn');
    if (feed && scrollBtn) {
      feed.addEventListener('scroll', () => {
        const distanceFromBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight;
        if (distanceFromBottom > 150) {
          scrollBtn.classList.remove('oculto');
        } else {
          scrollBtn.classList.add('oculto');
        }
      });
    }
  },

  scrollToBottom() {
    const feed = document.getElementById('ailabChatMessages');
    if (feed) {
      feed.scrollTo({ top: feed.scrollHeight, behavior: 'smooth' });
    }
  },

  bindEvents() {
    const fileImg = document.getElementById('ailabFileInputImage');
    const fileDoc = document.getElementById('ailabFileInputDoc');
    const composerInput = document.getElementById('ailabComposerInput');

    if (fileImg) {
      fileImg.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
          await this.processFileAttachment(e.target.files[0], 'image');
          e.target.value = '';
        }
      });
    }

    if (fileDoc) {
      fileDoc.addEventListener('change', async (e) => {
        if (e.target.files) {
          for (let i = 0; i < e.target.files.length; i++) {
            await this.processFileAttachment(e.target.files[i], 'document');
          }
          e.target.value = '';
        }
      });
    }

    if (composerInput) {
      composerInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessageFromComposer();
        }
      });

      composerInput.addEventListener('paste', async (e) => {
        const items = e.clipboardData?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
              const file = items[i].getAsFile();
              if (file) await this.processFileAttachment(file, 'image');
            }
          }
        }
      });
    }
  },

  async processFileAttachment(file, category) {
    try {
      const id = 'att-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
      if (category === 'image' || file.type.startsWith('image/')) {
        const base64 = await archivoABase64(file, 1024, 0.8);
        this.attachments.push({
          id,
          name: file.name,
          type: 'image',
          mime: file.type,
          data: base64,
          preview: base64
        });
      } else {
        const reader = new FileReader();
        const content = await new Promise((resolve, reject) => {
          reader.onload = e => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        this.attachments.push({
          id,
          name: file.name,
          type: 'document',
          mime: file.type || 'text/plain',
          data: content,
          preview: file.name
        });
      }
      this.renderComposerAttachments();
    } catch (err) {
      alert('No se pudo procesar el archivo adjunto.');
    }
  },

  renderComposerAttachments() {
    const list = document.getElementById('ailabComposerAttachmentsList');
    if (!list) return;

    if (this.attachments.length === 0) {
      list.style.display = 'none';
      list.innerHTML = '';
      return;
    }

    list.style.display = 'flex';
    list.innerHTML = this.attachments.map(att => {
      const isImg = att.type === 'image';
      return `
        <div class="ailab-attachment-chip">
          ${isImg ? `<img src="${att.preview}" alt="${escapeHTMLAILab(att.name)}" />` : `<span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>`}
          <span style="max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHTMLAILab(att.name)}</span>
          <button class="ailab-attachment-remove" onclick="AILab.removeAttachment('${att.id}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      `;
    }).join('');
  },

  removeAttachment(id) {
    this.attachments = this.attachments.filter(a => a.id !== id);
    this.renderComposerAttachments();
  },

  openComposer() {
    const overlay = document.getElementById('ailabComposerOverlay');
    const input = document.getElementById('ailabComposerInput');
    if (overlay) {
      overlay.classList.add('open');
      if (input) setTimeout(() => input.focus(), 150);
    }
  },

  closeComposer() {
    const overlay = document.getElementById('ailabComposerOverlay');
    if (overlay) overlay.classList.remove('open');
  },

  async loadCharacters() {
    return;
  },

  selectCharacter(charId, charName) {
    return;
  },

  setStatus(text, isWorking = true) {
    return;
  },

  async cancelGeneration() {
    return;
  },

  async loadGlobalMessages() {
    const feed = document.getElementById('ailabChatMessages');
    if (!feed) return;

    try {
      const res = await api('/ailab/messages?limit=60');
      feed.innerHTML = '';

      if (!res.messages || res.messages.length === 0) {
        feed.innerHTML = `
          <div style="text-align:center; padding:30px 16px; color:var(--texto-600); font-size:13px; line-height:1.5;">
            <div style="margin-bottom:8px; color:var(--morado-600);"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5Z"/></svg></div>
            <div style="font-weight:800; color:var(--morado-700); font-size:15px;">¡Bienvenido a la Sala Global!</div>
            <div>Todos los usuarios comparten este espacio de conversación en vivo.</div>
          </div>
        `;
        return;
      }

      res.messages.forEach(msg => {
        this.appendSingleMessage(msg, false);
      });

      feed.scrollTop = feed.scrollHeight;
    } catch (err) {
      console.error('Error al cargar historial de sala global:', err);
      feed.innerHTML = `<div class="aviso-vacio">No se pudo cargar el historial de la sala global.</div>`;
    }
  },

  appendSingleMessage(msg, autoScroll = true) {
    const feed = document.getElementById('ailabChatMessages');
    if (!feed || !msg) return;

    if (document.getElementById(`ailab-msg-${msg.id}`)) return;

    const currentUser = typeof Sesion !== 'undefined' ? Sesion.usuario() : null;
    const isMe = msg.sender_type === 'user' && currentUser && msg.sender_id === currentUser.id;
    const isAdmin = currentUser && currentUser.is_admin;
    const canDelete = isMe || isAdmin;

    let toolResultObj = msg.tool_result;
    if (typeof toolResultObj === 'string') {
      try { toolResultObj = JSON.parse(toolResultObj); } catch (e) {}
    }

    let attachmentsObj = msg.attachments;
    if (typeof attachmentsObj === 'string') {
      try { attachmentsObj = JSON.parse(attachmentsObj); } catch (e) {}
    }

    let cardHtml = this.renderToolCard(toolResultObj);

    let imageHtml = '';
    if (msg.image_url) {
      imageHtml = `<img src="${msg.image_url}" style="max-width:100%; max-height:260px; border-radius:12px; margin-bottom:8px; cursor:pointer; display:block;" onclick="window.abrirVisorImagen('${msg.image_url.replace(/'/g, "\\'")}')" />`;
    }

    const timeStr = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    const msgHtml = `
      <div class="ailab-msg-row ${isMe ? 'me' : 'ot'}" id="ailab-msg-${msg.id}">
        <div class="ailab-msg-meta ${isMe ? 'me' : 'ot'}">
          <span style="display:inline-flex; align-items:center; gap:4px;">
            ${msg.sender_type === 'ai' ? (
              (msg.sender_avatar && (msg.sender_avatar.startsWith('http') || msg.sender_avatar.startsWith('data:image')))
                ? `<img src="${msg.sender_avatar}" style="width:16px; height:16px; border-radius:50%; object-fit:cover; vertical-align:middle;" />`
                : (msg.sender_avatar || '')
            ) : ''}
            ${escapeHTMLAILab(msg.sender_name)}
            <span style="font-weight:400; opacity:0.7; font-size:10.5px;">• ${timeStr}</span>
          </span>
          ${canDelete ? `<button class="ailab-msg-delete-btn" onclick="AILab.deleteMessage('${msg.id}')" title="Eliminar mensaje"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>` : ''}
        </div>
        <div class="ailab-msg-bubble ${isMe ? 'me' : 'ot'}">
          ${imageHtml}
          <div>${procesarTextosYDriveLinks(msg.text || '')}</div>
          ${cardHtml}
        </div>
      </div>
    `;

    feed.insertAdjacentHTML('beforeend', msgHtml);

    if (autoScroll) {
      feed.scrollTop = feed.scrollHeight;
    }
  },

  async deleteMessage(msgId) {
    if (!confirm('¿Deseas borrar este mensaje de la sala global?')) return;

    try {
      await api(`/ailab/messages/${msgId}`, { method: 'DELETE' });
      const el = document.getElementById(`ailab-msg-${msgId}`);
      if (el) {
        el.style.opacity = '0';
        el.style.transform = 'scale(0.95)';
        setTimeout(() => el.remove(), 200);
      }
    } catch (err) {
      alert('Error al borrar el mensaje.');
    }
  },

  async sendMessageFromComposer() {
    const input = document.getElementById('ailabComposerInput');
    if (!input) return;

    const message = input.value.trim();
    const currentAttachments = [...this.attachments];

    if (!message && currentAttachments.length === 0) return;

    input.value = '';
    this.attachments = [];
    this.renderComposerAttachments();
    this.closeComposer();

    const imageAttachment = currentAttachments.find(a => a.type === 'image');
    const docAttachment = currentAttachments.find(a => a.type === 'document');
    const fileDataObj = docAttachment ? { content: docAttachment.data, filename: docAttachment.name, mimeType: docAttachment.mime } : null;

    try {
      await api('/ailab/messages', {
        method: 'POST',
        body: {
          message,
          image_url: imageAttachment ? imageAttachment.data : null,
          file_data: fileDataObj,
          character_id: this.activeCharacterId || null,
        }
      });
    } catch (err) {
      mostrarToast('No se pudo enviar el mensaje.');
    }
  },

  renderToolCard(toolResult) {
    if (!toolResult) return '';
    const d = toolResult.data || {};
    const type = toolResult.type;

    if (type === 'social_profile_card') {
      const avatarSrc = d.avatar || 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#efe3fe"/><circle cx="40" cy="30" r="16" fill="#5b21b6"/><path d="M16 68c0-13 10-22 24-22s24 9 24 22" fill="#5b21b6"/></svg>');
      return `
        <div class="ailab-profile-card">
          <div class="ailab-profile-header">
            <img class="ailab-profile-avatar" src="${avatarSrc}" alt="${escapeHTMLAILab(d.name)}" />
            <div class="ailab-profile-info">
              <div class="ailab-profile-name">
                ${escapeHTMLAILab(d.name)}
                ${d.verified ? ' <span style="color:#3897f0; display:inline-flex; align-items:center;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
              </div>
              <div class="ailab-profile-username">@${escapeHTMLAILab(d.username || 'usuario')} • ${escapeHTMLAILab(d.profession || 'Miembro')}</div>
              <div style="font-size:11px; color:var(--texto-500);"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:2px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>${escapeHTMLAILab(d.city || 'Cuba')}</div>
            </div>
          </div>
          ${d.bio ? `<div class="ailab-profile-bio">${escapeHTMLAILab(d.bio)}</div>` : ''}
          <div class="ailab-profile-actions">
            ${d.id ? `<button class="btn btn-primario mini-btn" style="flex:1; padding:6px 12px; font-size:12px;" onclick="abrirPerfil('${d.id}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:2px;"><path d="M20 21c0-4.4-3.6-8-8-8s-8 3.6-8 8"/><circle cx="12" cy="7" r="4"/></svg>Ver perfil completo</button>` : ''}
            ${d.id ? `<button class="btn btn-secundario mini-btn" style="flex:1; padding:6px 12px; font-size:12px;" onclick="solicitarContactoAccion('${d.id}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:2px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>Solicitar contacto</button>` : ''}
          </div>
        </div>
      `;
    }

    if (type === '3d_graphics_card' || type === 'interactive_chart_3d') {
      const canvasId = 'ailab_canvas3d_' + Math.random().toString(36).substring(2, 9);
      const title = d.title || 'Gráfico 3D Interactivo';
      const shape = d.shape || 'cube';
      const color = d.color || '#8b5cf6';

      setTimeout(() => {
        if (window.inicializarCanvas3D) {
          window.inicializarCanvas3D(canvasId, shape, color);
        }
      }, 100);

      return `
        <div class="card" style="margin-top:10px; padding:12px; border-radius:16px; background:linear-gradient(135deg, #111827, #1f2937); color:#fff; border:1px solid #8b5cf6;">
          <div style="font-weight:800; color:#a78bfa; font-size:13px; margin-bottom:6px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:4px;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>${escapeHTMLAILab(title)}</div>
          <div style="position:relative; width:100%; height:180px; background:#000; border-radius:10px; overflow:hidden;">
            <canvas id="${canvasId}" style="width:100%; height:100%; display:block; cursor:grab;"></canvas>
          </div>
        </div>
      `;
    }

    if (type === 'webcam_card') {
      return `
        <div class="card" style="margin-top:10px; padding:12px; border-radius:14px; background:var(--blanco); border:1px solid var(--borde);">
          <div style="font-weight:800; font-size:13.5px; color:var(--morado-700); margin-bottom:4px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:4px;"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>${escapeHTMLAILab(d.title || 'Cámara Pública')}</div>
          <div style="font-size:12px; color:var(--texto-600); margin-bottom:8px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:2px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>${escapeHTMLAILab(d.location || '')} • <span style="font-weight:700;">${escapeHTMLAILab(d.source_type || 'Fuente Pública')}</span></div>
          <img src="${d.preview}" style="width:100%; height:180px; object-fit:cover; border-radius:10px; margin-bottom:8px;" alt="Cámara" />
          <a href="${d.official_url}" target="_blank" rel="noopener" class="btn btn-primario" style="display:block; text-align:center; width:100%; padding:8px 0; font-size:12px; text-decoration:none; font-weight:800;">
            Abrir Fuente Oficial
          </a>
        </div>
      `;
    }

    if (type === 'video_card') {
      return `
        <div class="card" style="margin-top:10px; padding:12px; border-radius:14px; background:var(--blanco); border:1px solid var(--borde);">
          <div style="font-size:11px; font-weight:800; color:var(--morado-600); margin-bottom:4px;">▶️ ${escapeHTMLAILab(d.platform || 'Vídeo')}</div>
          <div style="font-weight:700; font-size:13.5px; color:var(--texto-900); margin-bottom:2px;">${escapeHTMLAILab(d.title || '')}</div>
          <div style="font-size:12px; color:var(--texto-600); margin-bottom:8px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:2px;"><path d="M20 21c0-4.4-3.6-8-8-8s-8 3.6-8 8"/><circle cx="12" cy="7" r="4"/></svg>${escapeHTMLAILab(d.channel || '')}</div>
          <img src="${d.thumbnail}" style="width:100%; height:160px; object-fit:cover; border-radius:10px; margin-bottom:8px;" alt="Video Miniatura" />
          <a href="${d.url}" target="_blank" rel="noopener" class="btn btn-secundario" style="display:block; text-align:center; width:100%; padding:8px 0; font-size:12px; text-decoration:none; font-weight:800;">
            Ver en ${escapeHTMLAILab(d.platform || 'Plataforma')}
          </a>
        </div>
      `;
    }

    if (type === 'image_card') {
      return `
        <div class="card" style="margin-top:10px; padding:10px; border-radius:14px; background:var(--blanco); border:1px solid var(--borde);">
          <img src="${d.image_url}" style="width:100%; border-radius:10px; margin-bottom:8px; display:block; cursor:pointer;" onclick="window.abrirVisorImagen('${d.image_url.replace(/'/g, "\\'")}')" alt="Imagen generada" />
          <div style="font-size:11px; color:var(--texto-600); margin-bottom:8px;">Prompt: "${escapeHTMLAILab(d.prompt)}"</div>
          <div class="ailab-card-actions" style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="ailab-card-btn" onclick="AILab.downloadPhoto('${d.image_url.replace(/'/g, "\\'")}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:2px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Descargar</button>
            <button class="ailab-card-btn" onclick="AILab.editWithBridgeApp('${d.image_url.replace(/'/g, "\\'")}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:2px;"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.92 0 1.5-.72 1.5-1.5 0-.4-.15-.76-.4-.98-.24-.22-.4-.54-.4-.91 0-.75.6-1.36 1.35-1.36H16c3.31 0 6-2.69 6-6 0-4.97-4.48-9-10-9z"/></svg>Editar (Bridge App)</button>
            <button class="ailab-card-btn" onclick="AILab.quickPrompt('Genera una variación de esta imagen: ${escapeHTMLAILab(d.prompt)}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:2px;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>Variar</button>
            <button class="ailab-card-btn" onclick="AILab.quickPrompt('Mejora el prompt visual: ${escapeHTMLAILab(d.prompt)}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:2px;"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/></svg>Mejorar Prompt</button>
          </div>
        </div>
      `;
    }

    if (type === 'doc_card') {
      return `
        <div class="card" style="margin-top:10px; padding:12px; border-radius:14px; background:var(--blanco); border:1px solid var(--borde);">
          <div style="font-weight:800; font-size:13px; color:var(--morado-700);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Documento Extraído (${escapeHTMLAILab(d.filename)})</div>
          <div style="font-size:12px; color:var(--texto-700); margin:6px 0;">${escapeHTMLAILab(d.summary_preview)}</div>
          <div style="font-size:11px; color:var(--texto-500);">${d.char_count} caracteres procesados.</div>
        </div>
      `;
    }

    if (type === 'math_card') {
      return `
        <div class="card" style="margin-top:10px; padding:10px 14px; border-radius:12px; background:var(--blanco); border:1px solid var(--borde);">
          <div style="font-size:12px; color:var(--texto-600);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:4px;"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/></svg>Cálculo: <b>${escapeHTMLAILab(d.expression)}</b></div>
          <div style="font-size:18px; font-weight:800; color:var(--morado-700); margin-top:2px;">= ${escapeHTMLAILab(d.result)}</div>
        </div>
      `;
    }

    if (type === 'weather_card') {
      return `
        <div class="card" style="margin-top:10px; padding:12px; border-radius:14px; background:var(--blanco); border:1px solid var(--borde);">
          <div style="font-weight:800; font-size:14px; color:var(--texto-900);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:4px;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>Clima en ${escapeHTMLAILab(d.city)}</div>
          <div style="font-size:24px; font-weight:900; color:var(--morado-700); margin:4px 0;">${escapeHTMLAILab(d.temp_c)}</div>
          <div style="font-size:12px; color:var(--texto-700);">${escapeHTMLAILab(d.condition)} • Humedad: ${escapeHTMLAILab(d.humidity)} • Viento: ${escapeHTMLAILab(d.wind)}</div>
        </div>
      `;
    }

    return '';
  },

  quickPrompt(promptText) {
    this.openComposer();
    const input = document.getElementById('ailabComposerInput');
    if (input) {
      input.value = promptText;
      input.focus();
    }
  },

  downloadPhoto(imgUrl) {
    if (!imgUrl) return;
    const a = document.createElement('a');
    a.href = imgUrl;
    a.download = `ailab_photo_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (typeof mostrarToast === 'function') {
      mostrarToast('Foto generada descargada');
    }
  },

  editWithBridgeApp(imgUrl) {
    if (typeof window.requerirAppEdicionFotos === 'function') {
      window.requerirAppEdicionFotos();
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('vistaAilab')) {
    window.AILab.init();
  }
});

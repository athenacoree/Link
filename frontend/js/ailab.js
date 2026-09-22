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
    this.loadCharacters();
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
          preview: '📄 ' + file.name
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
          ${isImg ? `<img src="${att.preview}" alt="${escapeHTMLAILab(att.name)}" />` : `<span>📄</span>`}
          <span style="max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHTMLAILab(att.name)}</span>
          <button class="ailab-attachment-remove" onclick="AILab.removeAttachment('${att.id}')">✕</button>
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
    const container = document.getElementById('ailabActiveCharacters');
    if (!container) return;

    try {
      const chars = await api('/ailab/characters');
      if (!Array.isArray(chars) || chars.length === 0) {
        container.innerHTML = '<div style="font-size:12px; color:var(--texto-500); padding:4px;">Asistente Principal Activo</div>';
        return;
      }

      container.innerHTML = chars.map(c => {
        const isImg = c.avatar && (c.avatar.startsWith('http') || c.avatar.startsWith('data:image'));
        const avatarHTML = isImg
          ? `<img src="${c.avatar}" style="width:20px; height:20px; border-radius:50%; object-fit:cover;" />`
          : `<span style="font-size:16px;">${escapeHTMLAILab(c.avatar || '🤖')}</span>`;

        return `
          <div class="ailab-char-chip ${this.activeCharacterId === c.id ? 'activo' : ''}" onclick="AILab.selectCharacter('${c.id}', '${escapeHTMLAILab(c.name)}')">
            ${avatarHTML}
            <span>${escapeHTMLAILab(c.name)}</span>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Error al cargar personajes de IA:', err);
    }
  },

  selectCharacter(charId, charName) {
    this.activeCharacterId = charId;
    this.openComposer();
    const input = document.getElementById('ailabComposerInput');
    if (input) {
      input.value = `@${charName} `;
      input.focus();
    }
  },

  setStatus(text, isWorking = true) {
    const statusBar = document.getElementById('ailabStatusBar');
    const statusText = document.getElementById('ailabStatusText');
    this.isGenerating = isWorking;

    if (statusBar && statusText) {
      if (isWorking && text) {
        statusText.textContent = text;
        statusBar.style.display = 'flex';
      } else {
        statusBar.style.display = 'none';
      }
    }
  },

  cancelGeneration() {
    this.setStatus(null, false);
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
            <div style="font-size:32px; margin-bottom:8px;">🧪</div>
            <div style="font-weight:800; color:var(--morado-700); font-size:15px;">¡Bienvenido a la Sala Global de IA!</div>
            <div>Todos los usuarios comparten este mismo espacio en vivo. La IA conversa continuamente y tú puedes intervenir en cualquier momento.</div>
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
                : (msg.sender_avatar || '🤖')
            ) : '👤'}
            ${escapeHTMLAILab(msg.sender_name)}
            <span style="font-weight:400; opacity:0.7; font-size:10.5px;">• ${timeStr}</span>
          </span>
          ${canDelete ? `<button class="ailab-msg-delete-btn" onclick="AILab.deleteMessage('${msg.id}')" title="Eliminar mensaje">🗑️</button>` : ''}
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
      const avatarSrc = d.avatar || 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#efe3fe"/><text x="50%" y="55%" font-size="30" text-anchor="middle" fill="#5b21b6" font-family="sans-serif">👤</text></svg>');
      return `
        <div class="ailab-profile-card">
          <div class="ailab-profile-header">
            <img class="ailab-profile-avatar" src="${avatarSrc}" alt="${escapeHTMLAILab(d.name)}" />
            <div class="ailab-profile-info">
              <div class="ailab-profile-name">
                ${escapeHTMLAILab(d.name)}
                ${d.verified ? ' <span style="color:#3897f0;">✓</span>' : ''}
              </div>
              <div class="ailab-profile-username">@${escapeHTMLAILab(d.username || 'usuario')} • ${escapeHTMLAILab(d.profession || 'Miembro')}</div>
              <div style="font-size:11px; color:var(--texto-500);">📍 ${escapeHTMLAILab(d.city || 'Cuba')}</div>
            </div>
          </div>
          ${d.bio ? `<div class="ailab-profile-bio">${escapeHTMLAILab(d.bio)}</div>` : ''}
          <div class="ailab-profile-actions">
            ${d.id ? `<button class="btn btn-primario mini-btn" style="flex:1; padding:6px 12px; font-size:12px;" onclick="abrirPerfil('${d.id}')">Ver perfil completo 👤</button>` : ''}
            ${d.id ? `<button class="btn btn-secundario mini-btn" style="flex:1; padding:6px 12px; font-size:12px;" onclick="solicitarContactoAccion('${d.id}')">Solicitar contacto 📩</button>` : ''}
          </div>
        </div>
      `;
    }

    if (type === 'webcam_card') {
      return `
        <div class="card" style="margin-top:10px; padding:12px; border-radius:14px; background:var(--blanco); border:1px solid var(--borde);">
          <div style="font-weight:800; font-size:13.5px; color:var(--morado-700); margin-bottom:4px;">📷 ${escapeHTMLAILab(d.title || 'Cámara Pública')}</div>
          <div style="font-size:12px; color:var(--texto-600); margin-bottom:8px;">📍 ${escapeHTMLAILab(d.location || '')} • <span style="font-weight:700;">${escapeHTMLAILab(d.source_type || 'Fuente Pública')}</span></div>
          <img src="${d.preview}" style="width:100%; height:180px; object-fit:cover; border-radius:10px; margin-bottom:8px;" alt="Cámara" />
          <a href="${d.official_url}" target="_blank" rel="noopener" class="btn btn-primario" style="display:block; text-align:center; width:100%; padding:8px 0; font-size:12px; text-decoration:none; font-weight:800;">
            Abrir Fuente Oficial 🔴
          </a>
        </div>
      `;
    }

    if (type === 'video_card') {
      return `
        <div class="card" style="margin-top:10px; padding:12px; border-radius:14px; background:var(--blanco); border:1px solid var(--borde);">
          <div style="font-size:11px; font-weight:800; color:var(--morado-600); margin-bottom:4px;">▶️ ${escapeHTMLAILab(d.platform || 'Vídeo')}</div>
          <div style="font-weight:700; font-size:13.5px; color:var(--texto-900); margin-bottom:2px;">${escapeHTMLAILab(d.title || '')}</div>
          <div style="font-size:12px; color:var(--texto-600); margin-bottom:8px;">👤 ${escapeHTMLAILab(d.channel || '')}</div>
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
            <button class="ailab-card-btn" onclick="AILab.downloadPhoto('${d.image_url.replace(/'/g, "\\'")}')">📥 Descargar</button>
            <button class="ailab-card-btn" onclick="AILab.editWithBridgeApp('${d.image_url.replace(/'/g, "\\'")}')">🎨 Editar (Bridge App)</button>
            <button class="ailab-card-btn" onclick="AILab.quickPrompt('Genera una variación de esta imagen: ${escapeHTMLAILab(d.prompt)}')">🔄 Variar</button>
            <button class="ailab-card-btn" onclick="AILab.quickPrompt('Mejora el prompt visual: ${escapeHTMLAILab(d.prompt)}')">✨ Mejorar Prompt</button>
          </div>
        </div>
      `;
    }

    if (type === 'doc_card') {
      return `
        <div class="card" style="margin-top:10px; padding:12px; border-radius:14px; background:var(--blanco); border:1px solid var(--borde);">
          <div style="font-weight:800; font-size:13px; color:var(--morado-700);">📄 Documento Extraído (${escapeHTMLAILab(d.filename)})</div>
          <div style="font-size:12px; color:var(--texto-700); margin:6px 0;">${escapeHTMLAILab(d.summary_preview)}</div>
          <div style="font-size:11px; color:var(--texto-500);">${d.char_count} caracteres procesados.</div>
        </div>
      `;
    }

    if (type === 'math_card') {
      return `
        <div class="card" style="margin-top:10px; padding:10px 14px; border-radius:12px; background:var(--blanco); border:1px solid var(--borde);">
          <div style="font-size:12px; color:var(--texto-600);">🔢 Cálculo: <b>${escapeHTMLAILab(d.expression)}</b></div>
          <div style="font-size:18px; font-weight:800; color:var(--morado-700); margin-top:2px;">= ${escapeHTMLAILab(d.result)}</div>
        </div>
      `;
    }

    if (type === 'weather_card') {
      return `
        <div class="card" style="margin-top:10px; padding:12px; border-radius:14px; background:var(--blanco); border:1px solid var(--borde);">
          <div style="font-weight:800; font-size:14px; color:var(--texto-900);">🌤️ Clima en ${escapeHTMLAILab(d.city)}</div>
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
      mostrarToast('Foto generada descargada 📥');
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

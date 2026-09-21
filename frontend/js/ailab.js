/* Lógica para el Laboratorio IA en Enlace */

function escapeHTML(str) {
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
  chatHistory: [],
  currentAbortController: null,
  isGenerating: false,
  initialized: false,
  lastSentPayload: null,

  init() {
    if (this.initialized) return;
    this.initialized = true;
    this.bindEvents();
    this.loadCharacters();
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

      // Soporte para pegar imágenes directamente del portapapeles
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
          ${isImg ? `<img src="${att.preview}" alt="${escapeHTML(att.name)}" />` : `<span>📄</span>`}
          <span style="max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHTML(att.name)}</span>
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

      container.innerHTML = `
        <div class="ailab-char-chip ${!this.activeCharacterId ? 'activo' : ''}" onclick="AILab.selectCharacter(null)">
          <span style="font-size:16px;">🤖</span>
          <span>Link AI</span>
        </div>
        ${chars.map(c => `
          <div class="ailab-char-chip ${this.activeCharacterId === c.id ? 'activo' : ''}" onclick="AILab.selectCharacter('${c.id}')">
            <span style="font-size:16px;">${escapeHTML(c.avatar || '🤖')}</span>
            <span>${escapeHTML(c.name)}</span>
          </div>
        `).join('')}
      `;
    } catch (err) {
      console.error('Error al cargar personajes de IA:', err);
    }
  },

  selectCharacter(charId) {
    this.activeCharacterId = charId;
    this.chatHistory = [];
    this.loadCharacters();

    const feed = document.getElementById('ailabChatMessages');
    if (feed) {
      feed.innerHTML = `
        <div style="text-align:center; font-size:12px; color:var(--texto-600); margin:12px 0;">
          Modo de conversación actualizado. Los personajes interactúan directamente en el feed.
        </div>
      `;
    }
  },

  setStatus(text, isWorking = true) {
    const statusBar = document.getElementById('ailabStatusBar');
    const statusText = document.getElementById('ailabStatusText');
    this.isGenerating = isWorking;

    if (statusBar && statusText) {
      if (isWorking) {
        statusText.textContent = text || 'Pensando...';
        statusBar.style.display = 'flex';
      } else {
        statusBar.style.display = 'none';
      }
    }
  },

  cancelGeneration() {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
    this.setStatus(null, false);
  },

  async sendMessageFromComposer() {
    const input = document.getElementById('ailabComposerInput');
    if (!input) return;

    const message = input.value.trim();
    const currentAttachments = [...this.attachments];

    if (!message && currentAttachments.length === 0) return;

    // Resetear compositor
    input.value = '';
    this.attachments = [];
    this.renderComposerAttachments();
    this.closeComposer();

    this.lastSentPayload = { message, attachments: currentAttachments };
    await this.executeSendMessage(message, currentAttachments);
  },

  async retryLastMessage() {
    if (!this.lastSentPayload) return;
    await this.executeSendMessage(this.lastSentPayload.message, this.lastSentPayload.attachments);
  },

  async executeSendMessage(message, currentAttachments = []) {
    const feed = document.getElementById('ailabChatMessages');
    const imageAttachment = currentAttachments.find(a => a.type === 'image');
    const docAttachment = currentAttachments.find(a => a.type === 'document');

    // Renderizar mensaje del usuario
    if (feed) {
      let attachmentsHtml = '';
      if (imageAttachment) {
        attachmentsHtml += `<img src="${imageAttachment.data}" style="max-width:220px; border-radius:12px; margin-bottom:6px; display:block;" />`;
      }
      if (docAttachment) {
        attachmentsHtml += `<div style="font-size:12px; background:rgba(255,255,255,0.2); padding:6px 10px; border-radius:8px; margin-bottom:6px;">📄 Adjunto: ${escapeHTML(docAttachment.name)}</div>`;
      }

      feed.innerHTML += `
        <div class="mensaje-fila me" style="display:flex; justify-content:flex-end; margin-bottom:12px;">
          <div class="mensaje-burbuja me" style="background:var(--morado-600); color:#fff; padding:10px 14px; border-radius:18px 18px 2px 18px; max-width:82%; font-size:14px; line-height:1.45; box-shadow:0 2px 8px rgba(0,0,0,0.12);">
            ${attachmentsHtml}
            <div>${escapeHTML(message)}</div>
          </div>
        </div>
      `;
      feed.scrollTop = feed.scrollHeight;
    }

    // Activar barra de estado
    this.setStatus('Pensando y procesando respuesta...', true);

    this.currentAbortController = new AbortController();

    try {
      let data;
      const fileDataObj = docAttachment ? { content: docAttachment.data, filename: docAttachment.name, mimeType: docAttachment.mime } : null;

      if (this.activeCharacterId) {
        data = await api('/ailab/chat-character', {
          method: 'POST',
          body: {
            character_id: this.activeCharacterId,
            message,
            image_url: imageAttachment ? imageAttachment.data : null,
            file_data: fileDataObj,
            history: this.chatHistory
          }
        });
      } else {
        data = await api('/ai/chat', {
          method: 'POST',
          body: {
            prompt: message,
            messages: [...this.chatHistory, { role: 'user', content: message }],
            vision_image: imageAttachment ? imageAttachment.data : null,
            file_data: fileDataObj,
          }
        });
      }

      this.setStatus(null, false);

      const replyText = data.reply || 'Sin respuesta del asistente.';
      const toolResult = data.tool_result;

      // Actualizar historial
      this.chatHistory.push({ role: 'user', content: message });
      this.chatHistory.push({ role: 'assistant', content: replyText });
      if (this.chatHistory.length > 10) this.chatHistory = this.chatHistory.slice(-10);

      let cardHtml = '';
      if (toolResult) {
        cardHtml = this.renderToolCard(toolResult);
      }

      if (feed) {
        const botAvatar = data.character?.avatar || data.avatar || '🤖';
        const botName = data.character?.name || data.name || 'Link AI';

        feed.innerHTML += `
          <div class="mensaje-fila ot" style="display:flex; flex-direction:column; align-items:flex-start; margin-bottom:14px;">
            <div style="font-size:11.5px; font-weight:800; color:var(--morado-700); margin-bottom:4px; margin-left:4px;">
              ${botAvatar} ${escapeHTML(botName)}
            </div>
            <div class="mensaje-burbuja ot" style="background:var(--fondo-tarjeta); border:1px solid var(--borde); color:var(--texto-900); padding:12px 16px; border-radius:18px 18px 18px 2px; max-width:88%; font-size:14px; line-height:1.5; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
              <div>${escapeHTML(replyText)}</div>
              ${cardHtml}
            </div>
          </div>
        `;
        feed.scrollTop = feed.scrollHeight;
      }
    } catch (err) {
      this.setStatus(null, false);

      if (feed) {
        feed.innerHTML += `
          <div class="mensaje-fila ot" style="display:flex; justify-content:flex-start; margin-bottom:12px;">
            <div class="mensaje-burbuja ot" style="background:#fee2e2; border:1px solid #fca5a5; color:#991b1b; padding:12px 16px; border-radius:16px; font-size:13px; font-weight:600; max-width:85%;">
              <div>⚠️ Estoy teniendo problemas técnicos para completar la solicitud.</div>
              <button class="btn btn-secundario" onclick="AILab.retryLastMessage()" style="margin-top:8px; padding:4px 12px; font-size:12px; border-radius:10px;">Reintentar 🔄</button>
            </div>
          </div>
        `;
        feed.scrollTop = feed.scrollHeight;
      }
    }
  },

  renderToolCard(toolResult) {
    if (!toolResult) return '';
    const d = toolResult.data || {};
    const type = toolResult.type;

    if (type === 'webcam_card') {
      return `
        <div class="card" style="margin-top:10px; padding:12px; border-radius:14px; background:var(--blanco); border:1px solid var(--borde);">
          <div style="font-weight:800; font-size:13.5px; color:var(--morado-700); margin-bottom:4px;">📷 ${escapeHTML(d.title || 'Cámara Pública')}</div>
          <div style="font-size:12px; color:var(--texto-600); margin-bottom:8px;">📍 ${escapeHTML(d.location || '')} • <span style="font-weight:700;">${escapeHTML(d.source_type || 'Fuente Pública')}</span></div>
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
          <div style="font-size:11px; font-weight:800; color:var(--morado-600); margin-bottom:4px;">▶️ ${escapeHTML(d.platform || 'Vídeo')}</div>
          <div style="font-weight:700; font-size:13.5px; color:var(--texto-900); margin-bottom:2px;">${escapeHTML(d.title || '')}</div>
          <div style="font-size:12px; color:var(--texto-600); margin-bottom:8px;">👤 ${escapeHTML(d.channel || '')}</div>
          <img src="${d.thumbnail}" style="width:100%; height:160px; object-fit:cover; border-radius:10px; margin-bottom:8px;" alt="Video Miniatura" />
          <a href="${d.url}" target="_blank" rel="noopener" class="btn btn-secundario" style="display:block; text-align:center; width:100%; padding:8px 0; font-size:12px; text-decoration:none; font-weight:800;">
            Ver en ${escapeHTML(d.platform || 'Plataforma')}
          </a>
        </div>
      `;
    }

    if (type === 'image_card') {
      return `
        <div class="card" style="margin-top:10px; padding:10px; border-radius:14px; background:var(--blanco); border:1px solid var(--borde);">
          <img src="${d.image_url}" style="width:100%; border-radius:10px; margin-bottom:8px; display:block;" alt="Imagen generada" />
          <div style="font-size:11px; color:var(--texto-600); margin-bottom:8px;">Prompt: "${escapeHTML(d.prompt)}"</div>
          <div class="ailab-card-actions">
            <a href="${d.image_url}" target="_blank" class="ailab-card-btn" style="text-decoration:none;">🔍 Abrir</a>
            <button class="ailab-card-btn" onclick="AILab.quickPrompt('Genera una variación de esta imagen: ${escapeHTML(d.prompt)}')">🔄 Variar</button>
            <button class="ailab-card-btn" onclick="AILab.quickPrompt('Mejora el prompt visual: ${escapeHTML(d.prompt)}')">✨ Mejorar Prompt</button>
          </div>
        </div>
      `;
    }

    if (type === 'doc_card') {
      return `
        <div class="card" style="margin-top:10px; padding:12px; border-radius:14px; background:var(--blanco); border:1px solid var(--borde);">
          <div style="font-weight:800; font-size:13px; color:var(--morado-700);">📄 Documento Extráido (${escapeHTML(d.filename)})</div>
          <div style="font-size:12px; color:var(--texto-700); margin:6px 0;">${escapeHTML(d.summary_preview)}</div>
          <div style="font-size:11px; color:var(--texto-500);">${d.char_count} caracteres procesados.</div>
        </div>
      `;
    }

    if (type === 'math_card') {
      return `
        <div class="card" style="margin-top:10px; padding:10px 14px; border-radius:12px; background:var(--blanco); border:1px solid var(--borde);">
          <div style="font-size:12px; color:var(--texto-600);">🔢 Cálculo: <b>${escapeHTML(d.expression)}</b></div>
          <div style="font-size:18px; font-weight:800; color:var(--morado-700); margin-top:2px;">= ${escapeHTML(d.result)}</div>
        </div>
      `;
    }

    if (type === 'weather_card') {
      return `
        <div class="card" style="margin-top:10px; padding:12px; border-radius:14px; background:var(--blanco); border:1px solid var(--borde);">
          <div style="font-weight:800; font-size:14px; color:var(--texto-900);">🌤️ Clima en ${escapeHTML(d.city)}</div>
          <div style="font-size:24px; font-weight:900; color:var(--morado-700); margin:4px 0;">${escapeHTML(d.temp_c)}</div>
          <div style="font-size:12px; color:var(--texto-700);">${escapeHTML(d.condition)} • Humedad: ${escapeHTML(d.humidity)} • Viento: ${escapeHTML(d.wind)}</div>
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
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('vistaAilab')) {
    window.AILab.init();
  }
});

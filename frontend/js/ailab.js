/* Lógica cliente para el Laboratorio IA en Enlace */

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
  attachmentBase64: null,
  chatHistory: [],

  init() {
    this.bindEvents();
    this.loadCharacters();
  },

  bindEvents() {
    const btnSend = document.getElementById('ailabBtnSend');
    const inputTxt = document.getElementById('ailabInputText');
    const btnAttach = document.getElementById('ailabBtnAttachImage');
    const fileInput = document.getElementById('ailabFileInput');

    if (btnSend) {
      btnSend.addEventListener('click', () => this.sendMessage());
    }

    if (inputTxt) {
      inputTxt.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
    }

    if (btnAttach && fileInput) {
      btnAttach.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
          try {
            this.attachmentBase64 = await archivoABase64(e.target.files[0], 1024, 0.8);
            const previewBox = document.getElementById('ailabAttachmentPreview');
            const previewImg = document.getElementById('ailabAttachmentImg');
            if (previewBox && previewImg) {
              previewImg.src = this.attachmentBase64;
              previewBox.style.display = 'flex';
            }
          } catch (err) {
            alert('No se pudo procesar la imagen.');
          }
        }
      });
    }
  },

  removeAttachment() {
    this.attachmentBase64 = null;
    const previewBox = document.getElementById('ailabAttachmentPreview');
    const fileInput = document.getElementById('ailabFileInput');
    if (previewBox) previewBox.style.display = 'none';
    if (fileInput) fileInput.value = '';
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
        <div class="chat-fecha" style="text-align:center; font-size:11px; color:var(--texto-500); margin:10px 0;">
          Modo de conversación actualizado.
        </div>
      `;
    }
  },

  async sendMessage() {
    const inputTxt = document.getElementById('ailabInputText');
    if (!inputTxt) return;

    const message = inputTxt.value.trim();
    const image = this.attachmentBase64;

    if (!message && !image) return;

    inputTxt.value = '';
    const feed = document.getElementById('ailabChatMessages');

    // Renderizar mensaje del usuario
    if (feed) {
      let contentHtml = escapeHTML(message);
      if (image) {
        contentHtml = `<img src="${image}" style="max-width:220px; border-radius:12px; margin-bottom:6px; display:block;" />` + contentHtml;
      }

      feed.innerHTML += `
        <div class="mensaje-fila me" style="display:flex; justify-content:flex-end; margin-bottom:10px;">
          <div class="mensaje-burbuja me" style="background:var(--morado-600); color:#fff; padding:10px 14px; border-radius:18px 18px 2px 18px; max-width:80%; font-size:14px; line-height:1.4; box-shadow:0 2px 6px rgba(0,0,0,0.1);">
            ${contentHtml}
          </div>
        </div>
      `;
      feed.scrollTop = feed.scrollHeight;
    }

    // Limpiar adjunto
    this.removeAttachment();

    // Indicador de "pensando..."
    const tempId = `loading-${Date.now()}`;
    if (feed) {
      feed.innerHTML += `
        <div class="mensaje-fila ot" id="${tempId}" style="display:flex; justify-content:flex-start; margin-bottom:10px;">
          <div class="mensaje-burbuja ot" style="background:var(--fondo-tarjeta); border:1px solid var(--borde); color:var(--texto-800); padding:10px 14px; border-radius:18px 18px 18px 2px; max-width:80%; font-size:13px; font-style:italic;">
            Escribiendo respuesta...
          </div>
        </div>
      `;
      feed.scrollTop = feed.scrollHeight;
    }

    try {
      let data;
      if (this.activeCharacterId) {
        data = await api('/ailab/chat-character', {
          method: 'POST',
          body: {
            character_id: this.activeCharacterId,
            message,
            image_url: image,
            history: this.chatHistory
          }
        });
      } else {
        data = await api('/ai/chat', {
          method: 'POST',
          body: {
            prompt: message,
            messages: [...this.chatHistory, { role: 'user', content: message }]
          }
        });
      }

      const tempLoading = document.getElementById(tempId);
      if (tempLoading) tempLoading.remove();

      const replyText = data.reply || 'Sin respuesta del asistente.';
      const toolResult = data.tool_result;

      // Actualizar historial
      this.chatHistory.push({ role: 'user', content: message });
      this.chatHistory.push({ role: 'assistant', content: replyText });
      if (this.chatHistory.length > 10) this.chatHistory = this.chatHistory.slice(-10);

      let cardHtml = '';
      if (toolResult && toolResult.type) {
        cardHtml = this.renderToolCard(toolResult);
      }

      if (feed) {
        const botAvatar = data.character?.avatar || data.avatar || '🤖';
        const botName = data.character?.name || data.name || 'Link AI';

        feed.innerHTML += `
          <div class="mensaje-fila ot" style="display:flex; flex-direction:column; align-items:flex-start; margin-bottom:12px;">
            <div style="font-size:11px; font-weight:700; color:var(--morado-700); margin-bottom:3px; margin-left:4px;">
              ${botAvatar} ${escapeHTML(botName)}
            </div>
            <div class="mensaje-burbuja ot" style="background:var(--fondo-tarjeta); border:1px solid var(--borde); color:var(--texto-900); padding:10px 14px; border-radius:18px 18px 18px 2px; max-width:85%; font-size:14px; line-height:1.45; box-shadow:0 2px 6px rgba(0,0,0,0.05);">
              ${escapeHTML(replyText)}
              ${cardHtml}
            </div>
          </div>
        `;
        feed.scrollTop = feed.scrollHeight;
      }
    } catch (err) {
      const tempLoading = document.getElementById(tempId);
      if (tempLoading) tempLoading.remove();

      if (feed) {
        feed.innerHTML += `
          <div class="mensaje-fila ot" style="display:flex; justify-content:flex-start; margin-bottom:10px;">
            <div class="mensaje-burbuja ot" style="background:#fee2e2; border:1px solid #fca5a5; color:#991b1b; padding:10px 14px; border-radius:14px; font-size:13px; font-weight:600;">
              ⚠️ No se pudo completar esta acción. El proveedor no respondió correctamente.
            </div>
          </div>
        `;
        feed.scrollTop = feed.scrollHeight;
      }
    }
  },

  renderToolCard(toolResult) {
    if (!toolResult || !toolResult.type) return '';
    const d = toolResult.data || {};

    if (toolResult.type === 'webcam_card') {
      return `
        <div class="card" style="margin-top:10px; padding:12px; border-radius:14px; background:var(--blanco); border:1px solid var(--borde);">
          <div style="font-weight:800; font-size:13.5px; color:var(--morado-700); margin-bottom:4px;">📷 ${escapeHTML(d.title || 'Cámara Pública')}</div>
          <div style="font-size:12px; color:var(--texto-600); margin-bottom:8px;">📍 ${escapeHTML(d.location || '')}</div>
          <img src="${d.preview}" style="width:100%; height:180px; object-fit:cover; border-radius:10px; margin-bottom:8px;" alt="Cámara" />
          <a href="${d.official_url}" target="_blank" rel="noopener" class="btn btn-primario" style="display:inline-block; text-align:center; width:100%; padding:8px 0; font-size:12px; text-decoration:none;">
            Ver Cámara en vivo 🔴
          </a>
        </div>
      `;
    }

    if (toolResult.type === 'video_card') {
      return `
        <div class="card" style="margin-top:10px; padding:12px; border-radius:14px; background:var(--blanco); border:1px solid var(--borde);">
          <div style="font-size:11px; font-weight:800; color:var(--morado-600); margin-bottom:4px;">▶️ ${escapeHTML(d.platform || 'Vídeo')}</div>
          <div style="font-weight:700; font-size:13.5px; color:var(--texto-900); margin-bottom:2px;">${escapeHTML(d.title || '')}</div>
          <div style="font-size:12px; color:var(--texto-600); margin-bottom:8px;">👤 ${escapeHTML(d.channel || '')} • ${escapeHTML(d.views || '')}</div>
          <img src="${d.thumbnail}" style="width:100%; height:160px; object-fit:cover; border-radius:10px; margin-bottom:8px;" alt="Video Miniatura" />
          <a href="${d.url}" target="_blank" rel="noopener" class="btn btn-secundario" style="display:inline-block; text-align:center; width:100%; padding:8px 0; font-size:12px; text-decoration:none; font-weight:700;">
            Ver en ${escapeHTML(d.platform || 'Plataforma')}
          </a>
        </div>
      `;
    }

    if (toolResult.type === 'social_profile_card') {
      return `
        <div class="card" style="margin-top:10px; padding:12px; border-radius:14px; background:var(--blanco); border:1px solid var(--borde); display:flex; gap:12px; align-items:center;">
          <img src="${d.avatar || '/icons/icon-192.png'}" style="width:50px; height:50px; border-radius:50%; object-fit:cover;" />
          <div style="flex:1; min-width:0;">
            <div style="font-weight:800; font-size:14px; color:var(--texto-900);">${escapeHTML(d.name)} ${d.verified ? '✓' : ''}</div>
            <div style="font-size:12px; color:var(--morado-700); font-weight:600;">@${escapeHTML(d.username)}</div>
            <div style="font-size:11.5px; color:var(--texto-600);">${escapeHTML(d.profession || '')}</div>
          </div>
        </div>
      `;
    }

    if (toolResult.type === 'weather_card') {
      return `
        <div class="card" style="margin-top:10px; padding:12px; border-radius:14px; background:var(--blanco); border:1px solid var(--borde);">
          <div style="font-weight:800; font-size:14px; color:var(--texto-900);">🌤️ Clima en ${escapeHTML(d.city)}</div>
          <div style="font-size:24px; font-weight:900; color:var(--morado-700); margin:4px 0;">${escapeHTML(d.temp_c)}</div>
          <div style="font-size:12px; color:var(--texto-700);">${escapeHTML(d.condition)} • Humedad: ${escapeHTML(d.humidity)} • Viento: ${escapeHTML(d.wind)}</div>
        </div>
      `;
    }

    if (toolResult.type === 'image_card') {
      return `
        <div class="card" style="margin-top:10px; padding:10px; border-radius:14px; background:var(--blanco); border:1px solid var(--borde); text-center;">
          <img src="${d.image_url}" style="width:100%; border-radius:10px; margin-bottom:6px;" alt="Imagen generada" />
          <div style="font-size:11px; color:var(--texto-500);">Prompt: "${escapeHTML(d.prompt)}"</div>
        </div>
      `;
    }

    return '';
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('vistaAilab')) {
    window.AILab.init();
  }
});

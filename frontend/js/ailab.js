/* Lógica cliente para el Laboratorio IA en Enlace */

window.AILab = {
  activeTab: 'personajes',

  init() {
    this.bindEvents();
    this.loadCharacters();
  },

  bindEvents() {
    const tabs = document.querySelectorAll('.ailab-tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.currentTarget.getAttribute('data-tab');
        this.switchTab(target);
      });
    });
  },

  switchTab(tabName) {
    this.activeTab = tabName;
    document.querySelectorAll('.ailab-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });
    document.querySelectorAll('.ailab-section').forEach(sec => {
      sec.classList.toggle('active', sec.id === `ailab-sec-${tabName}`);
    });

    if (tabName === 'personajes') this.loadCharacters();
    if (tabName === 'ai2ai') this.loadAi2AiOptions();
  },

  async loadCharacters() {
    const container = document.getElementById('ailab-char-list');
    if (!container) return;

    try {
      const res = await fetchAPI('/api/ailab/characters');
      if (!res.ok) throw new Error('Error al cargar personajes');
      const chars = await res.json();

      if (!chars || chars.length === 0) {
        container.innerHTML = '<div class="card p-3 text-center text-muted">No hay personajes creados aún.</div>';
        return;
      }

      container.innerHTML = chars.map(c => `
        <div class="char-card">
          <div class="char-avatar-box">${c.avatar || '🤖'}</div>
          <div style="flex:1;">
            <div style="font-weight:700; font-size:1rem; color:var(--text-color);">${escapeHTML(c.name)}</div>
            <div style="font-size:0.82rem; color:#6b7280; line-height:1.3; margin-top:2px;">${escapeHTML(c.personality)}</div>
          </div>
          <button class="btn btn-sm btn-primary" onclick="AILab.openCharChat('${c.id}', '${escapeHTML(c.name)}', '${escapeHTML(c.avatar || '🤖')}')">
            Conversar
          </button>
        </div>
      `).join('');
    } catch (err) {
      console.error(err);
      container.innerHTML = '<div class="card p-3 text-center text-danger">Error al conectar con Laboratorio IA.</div>';
    }
  },

  async createCharacter() {
    const name = document.getElementById('ailab-new-char-name').value.trim();
    const avatar = document.getElementById('ailab-new-char-avatar').value.trim() || '🤖';
    const personality = document.getElementById('ailab-new-char-personality').value.trim();
    const greeting = document.getElementById('ailab-new-char-greeting').value.trim();

    if (!name || !personality) {
      alert('Por favor ingresa el nombre y la personalidad del personaje.');
      return;
    }

    try {
      const res = await fetchAPI('/api/ailab/characters', {
        method: 'POST',
        body: JSON.stringify({ name, avatar, personality, greeting })
      });
      if (res.ok) {
        alert('¡Personaje IA creado exitosamente!');
        document.getElementById('ailab-new-char-name').value = '';
        document.getElementById('ailab-new-char-personality').value = '';
        document.getElementById('ailab-new-char-greeting').value = '';
        this.loadCharacters();
      } else {
        const err = await res.json();
        alert(err.error || 'No se pudo crear el personaje.');
      }
    } catch (e) {
      alert('Error de conexión.');
    }
  },

  async openCharChat(charId, name, avatar) {
    const promptMsg = prompt(`Escribe un mensaje para ${name}:`);
    if (!promptMsg) return;

    const chatBox = document.getElementById('ailab-char-chat-results');
    if (chatBox) {
      chatBox.innerHTML += `
        <div class="ai-dialog-box" style="border-left: 4px solid var(--primary-color);">
          <strong>Tú:</strong> ${escapeHTML(promptMsg)}
        </div>
        <div class="ai-dialog-box" id="temp-loading-${Date.now()}">
          <em>${avatar} ${escapeHTML(name)} está pensando...</em>
        </div>
      `;
    }

    try {
      const res = await fetchAPI('/api/ailab/chat-character', {
        method: 'POST',
        body: JSON.stringify({ character_id: charId, message: promptMsg })
      });
      const data = await res.json();

      const lastTemp = chatBox.querySelector('[id^="temp-loading-"]');
      if (lastTemp) lastTemp.remove();

      chatBox.innerHTML += `
        <div class="ai-dialog-box" style="background: rgba(112, 0, 255, 0.05); border-left: 4px solid #9d00ff;">
          <strong>${avatar} ${escapeHTML(name)}:</strong> ${escapeHTML(data.reply)}
        </div>
      `;
    } catch (e) {
      alert('Error al enviar mensaje.');
    }
  },

  async loadAi2AiOptions() {
    try {
      const res = await fetchAPI('/api/ailab/characters');
      if (!res.ok) return;
      const chars = await res.json();

      const sel1 = document.getElementById('ailab-ai1-select');
      const sel2 = document.getElementById('ailab-ai2-select');
      if (!sel1 || !sel2) return;

      const opts = chars.map(c => `<option value="${c.id}">${c.avatar || '🤖'} ${escapeHTML(c.name)}</option>`).join('');
      sel1.innerHTML = opts;
      sel2.innerHTML = opts;
      if (chars.length > 1) sel2.selectedIndex = 1;
    } catch (e) {}
  },

  async runAiToAi() {
    const char1_id = document.getElementById('ailab-ai1-select').value;
    const char2_id = document.getElementById('ailab-ai2-select').value;
    const topic = document.getElementById('ailab-ai2ai-topic').value.trim();

    if (char1_id === char2_id) {
      alert('Por favor selecciona dos personajes diferentes para la conversación.');
      return;
    }

    const container = document.getElementById('ailab-ai2ai-results');
    container.innerHTML = '<div class="text-center p-3"><em>Simulando conversación e intercambio de ideas...</em></div>';

    try {
      const res = await fetchAPI('/api/ailab/ai-to-ai', {
        method: 'POST',
        body: JSON.stringify({ char1_id, char2_id, topic, turns: 4 })
      });
      const data = await res.json();

      if (!res.ok) {
        container.innerHTML = `<div class="text-danger p-2">${data.error || 'Error'}</div>`;
        return;
      }

      container.innerHTML = `
        <div style="font-weight:700; margin-bottom:10px; color:var(--primary-color);">📌 Tema: "${escapeHTML(data.topic)}"</div>
        ${data.conversation.map(turn => `
          <div class="ai-dialog-box" style="margin-bottom:8px;">
            <strong>${turn.speaker_avatar} ${escapeHTML(turn.speaker_name)}:</strong>
            <p style="margin:4px 0 0 0;">${escapeHTML(turn.text)}</p>
          </div>
        `).join('')}
      `;
    } catch (e) {
      container.innerHTML = '<div class="text-danger p-2">Error al iniciar conversación IA ↔ IA.</div>';
    }
  },

  async generateImage() {
    const promptText = document.getElementById('ailab-img-prompt').value.trim();
    const enhance = document.getElementById('ailab-img-enhance-chk').checked;

    if (!promptText) {
      alert('Ingresa una descripción para generar la imagen.');
      return;
    }

    const resBox = document.getElementById('ailab-img-results');
    resBox.innerHTML = '<div class="text-center p-3"><em>Generando y mejorando prompt con IA...</em></div>';

    try {
      const res = await fetchAPI('/api/ailab/image-gen', {
        method: 'POST',
        body: JSON.stringify({ prompt: promptText, enhance })
      });
      const data = await res.json();

      resBox.innerHTML = `
        <div class="card p-3 text-center">
          ${data.enhanced_prompt ? `<div style="font-size:0.8rem; color:#6b7280; margin-bottom:8px;"><strong>Prompt optimizado:</strong> ${escapeHTML(data.enhanced_prompt)}</div>` : ''}
          <img src="${data.image_url}" style="width:100%; max-width:400px; border-radius:12px; margin:0 auto; box-shadow:0 4px 12px rgba(0,0,0,0.1);" alt="Imagen IA" />
        </div>
      `;
    } catch (e) {
      resBox.innerHTML = '<div class="text-danger p-2">Error al generar la imagen.</div>';
    }
  },

  speakText() {
    const text = document.getElementById('ailab-tts-text').value.trim();
    if (!text) return alert('Ingresa texto para convertir a voz.');

    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Tu navegador no soporta reproducción directa de voz.');
    }
  },

  async analyzeVision() {
    const imgUrl = document.getElementById('ailab-vision-url').value.trim();
    const question = document.getElementById('ailab-vision-q').value.trim();

    if (!imgUrl) return alert('Ingresa la URL de la imagen a analizar.');

    const resBox = document.getElementById('ailab-vision-results');
    resBox.innerHTML = '<div class="text-center p-3"><em>Analizando elementos de la imagen con visión IA...</em></div>';

    try {
      const res = await fetchAPI('/api/ailab/vision', {
        method: 'POST',
        body: JSON.stringify({ image_url: imgUrl, question })
      });
      const data = await res.json();
      resBox.innerHTML = `
        <div class="ai-dialog-box">
          <strong>Análisis Visión:</strong>
          <p style="margin-top:4px;">${escapeHTML(data.analysis)}</p>
        </div>
      `;
    } catch (e) {
      resBox.innerHTML = '<div class="text-danger p-2">Error al analizar imagen.</div>';
    }
  },

  async checkAffinity() {
    const userInterests = document.getElementById('ailab-aff-user').value.trim();
    const targetText = document.getElementById('ailab-aff-target').value.trim();

    if (!userInterests || !targetText) return alert('Por favor completa ambos campos.');

    const resBox = document.getElementById('ailab-aff-results');
    resBox.innerHTML = '<div class="text-center p-3"><em>Calculando afinidad semántica con embeddings...</em></div>';

    try {
      const res = await fetchAPI('/api/ailab/embeddings', {
        method: 'POST',
        body: JSON.stringify({ user_interests: userInterests, target_text: targetText })
      });
      const data = await res.json();

      resBox.innerHTML = `
        <div class="card p-3 text-center">
          <div style="font-size:2rem; font-weight:800; color:var(--primary-color);">${data.similarity_percentage}%</div>
          <div style="font-weight:600; margin-top:4px;">Coincidencia de Afinidad</div>
          <div style="font-size:0.85rem; color:#6b7280; margin-top:6px;">${escapeHTML(data.recommendation)}</div>
        </div>
      `;
    } catch (e) {
      resBox.innerHTML = '<div class="text-danger p-2">Error al calcular afinidad.</div>';
    }
  },

  async translateText() {
    const text = document.getElementById('ailab-trans-text').value.trim();
    const lang = document.getElementById('ailab-trans-lang').value;

    if (!text) return alert('Ingresa el texto a traducir.');

    const resBox = document.getElementById('ailab-trans-results');
    resBox.innerHTML = '<div class="text-center p-3"><em>Traduciendo...</em></div>';

    try {
      const res = await fetchAPI('/api/ailab/translate', {
        method: 'POST',
        body: JSON.stringify({ text, target_lang: lang })
      });
      const data = await res.json();

      resBox.innerHTML = `
        <div class="ai-dialog-box">
          <strong>Traducción a ${escapeHTML(data.target_lang)}:</strong>
          <p style="font-size:1.05rem; margin-top:4px; font-weight:500;">${escapeHTML(data.translation)}</p>
        </div>
      `;
    } catch (e) {
      resBox.innerHTML = '<div class="text-danger p-2">Error al traducir.</div>';
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('vistaAilab')) {
    window.AILab.init();
  }
});

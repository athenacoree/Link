/* =========================================================
   MENSAJERÍA EN TIEMPO REAL CON REACCIONES, RESPUESTAS Y AUDIOS
   ========================================================= */
const Chat = (() => {
  const $ = (id) => document.getElementById(id);
  let conversacionAbiertaCon = null; // {id, name, avatar_data, is_online, last_seen}
  let mensajeRespondiendo = null;
  let mensajeSeleccionado = null;
  let temporizadorEscribiendo = null;
  let mediaRecorder = null;
  let audioChunks = [];
  let tiempoGrabacionSeg = 0;
  let temporizadorGrabacion = null;

  function conversationId(a, b) { return [a, b].sort().join('_'); }

  // Helper auxiliar de escape HTML global para el chat y capacidades
  function meEscapar(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  window.meEscapar = meEscapar;

  function horaCorta(fecha) {
    if (!fecha) return '';
    const d = new Date(fecha);
    return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  }

  function formatearUltimaVez(fecha) {
    if (!fecha) return 'Desconectado';
    const diff = (Date.now() - new Date(fecha).getTime()) / 1000;
    if (diff < 60) return 'Conectado recientemente';
    if (diff < 3600) return `Últ. vez hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Últ. vez hace ${Math.floor(diff / 3600)} h`;
    return `Últ. vez el ${new Date(fecha).toLocaleDateString('es')}`;
  }

  function formatoTiempo(seg) {
    const m = Math.floor(seg / 60).toString().padStart(2, '0');
    const s = Math.floor(seg % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function extraerYouTubeEmbedHtml(url) {
    try {
      const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
      if (match && match[1]) {
        const videoId = match[1];
        const iframeId = 'yt_frame_' + Math.random().toString(36).substring(2, 9);
        return `<div class="contenedor-video-chat" style="margin-top:8px; background:#000; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.1); max-width:100%;">
          <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.7); padding:6px 10px; font-size:11px; color:#fff;">
            <span style="font-weight:600;">▶️ Video de YouTube</span>
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="opacity:0.8;">Calidad:</span>
              <select onchange="Chat.cambiarCalidadVideo('${iframeId}', this.value)" style="background:#1e1e24; color:#fff; border:1px solid #444; border-radius:4px; font-size:10.5px; padding:2px 4px; cursor:pointer;">
                <option value="small" selected>240p (Auto)</option>
                <option value="medium">360p</option>
                <option value="large">480p</option>
                <option value="hd720">720p HD</option>
                <option value="hd1080">1080p HD</option>
              </select>
            </div>
          </div>
          <div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden;">
            <iframe id="${iframeId}" src="https://www.youtube.com/embed/${videoId}?autoplay=0&vq=small&enablejsapi=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;"></iframe>
          </div>
        </div>`;
      }
    } catch (e) {}
    return '';
  }

  function formatearUrlsTexto(texto) {
    if (!texto) return '';
    let ytEmbeds = '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    const textoFormateado = texto.replace(urlRegex, (url) => {
      const ytHtml = extraerYouTubeEmbedHtml(url);
      if (ytHtml) {
        ytEmbeds += ytHtml;
      }
      try {
        const domain = new URL(url).hostname;
        return `<a href="${url}" target="_blank" class="chip-link-url" onclick="event.stopPropagation()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:2px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>${domain}</a>`;
      } catch (e) {
        return `<a href="${url}" target="_blank" class="chip-link-url" onclick="event.stopPropagation()">${url}</a>`;
      }
    });

    return textoFormateado + ytEmbeds;
  }

  function renderCapabilitiesCard(data, cardMsgId) {
    window.linkCapabilitiesData = window.linkCapabilitiesData || {};
    window.linkCapabilitiesData[cardMsgId] = data;

    const categories = data.categories || [];
    const categoriesHtml = categories.map(cat => renderCapabilityCategoryCard(cat, cardMsgId)).join('');

    return `
      <div id="${cardMsgId}" class="capabilities-container" style="margin-top:8px; padding:14px; background:var(--fondo-tarjeta, #111827); border:1.5px solid var(--morado-500, #8b5cf6); border-radius:20px; max-width:100%; color:#fff; box-shadow:0 8px 24px rgba(139,92,246,0.25); font-family:var(--fuente);">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; border-bottom:1px solid rgba(139,92,246,0.25); padding-bottom:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:34px; height:34px; border-radius:10px; background:linear-gradient(135deg, #8b5cf6, #6366f1); display:flex; align-items:center; justify-content:center; font-size:18px;">✨</div>
            <div>
              <div style="font-weight:800; font-size:14.5px; color:#fff; letter-spacing:-0.2px;">${meEscapar(data.title || 'Capacidades de Link')}</div>
              <div style="font-size:10.5px; opacity:0.75; color:#cbd5e1;">Catálogo de herramientas interactivas</div>
            </div>
          </div>
          <span style="font-size:10px; font-weight:800; background:rgba(139,92,246,0.25); color:#a78bfa; padding:3px 8px; border-radius:10px; border:1px solid rgba(139,92,246,0.4);">Link AI</span>
        </div>

        <div id="caps_nav_${cardMsgId}" style="margin-bottom:10px;">
          <div style="font-size:11.5px; opacity:0.85; color:#cbd5e1; margin-bottom:6px;">Selecciona una categoría para explorar:</div>
        </div>

        <div id="caps_body_${cardMsgId}" class="capabilities-body-grid" style="display:grid; grid-template-columns:repeat(2, 1fr); gap:10px; transition:all 0.3s ease;">
          ${categoriesHtml}
        </div>
      </div>
    `;
  }

  function renderCapabilityCategoryCard(cat, cardMsgId) {
    const toolCount = (cat.tools || []).length;
    return `
      <div class="capability-category-card" onclick="Chat.abrirCategoriaCapabilities('${cardMsgId}', '${cat.id}')" style="background:rgba(255,255,255,0.06); border:1px solid rgba(139,92,246,0.3); border-radius:16px; padding:12px 10px; text-align:center; cursor:pointer; transition:all 0.2s cubic-bezier(0.175,0.885,0.32,1.275); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; min-height:105px; user-select:none;">
        <div style="font-size:30px; width:48px; height:48px; border-radius:14px; background:linear-gradient(135deg, rgba(139,92,246,0.25), rgba(99,102,241,0.15)); display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,0.2);">${cat.icon || '🛠️'}</div>
        <div style="font-weight:800; font-size:12.5px; color:#fff; line-height:1.2;">${meEscapar(cat.name)}</div>
        <span style="font-size:9.5px; font-weight:700; background:rgba(139,92,246,0.2); color:#c4b5fd; padding:2px 8px; border-radius:10px;">${toolCount} ${toolCount === 1 ? 'función' : 'funciones'}</span>
      </div>
    `;
  }

  function renderCapabilityToolCard(tool, cardMsgId) {
    return `
      <div class="capability-tool-card" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:14px; padding:10px; display:flex; flex-direction:column; justify-content:space-between; gap:8px; min-height:120px;">
        <div style="display:flex; align-items:flex-start; gap:8px;">
          <div style="font-size:22px; width:36px; height:36px; border-radius:10px; background:rgba(139,92,246,0.2); display:flex; align-items:center; justify-content:center; flex:0 0 auto;">${tool.icon || '⚙️'}</div>
          <div style="min-width:0; flex:1;">
            <div style="font-weight:800; font-size:12.5px; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${meEscapar(tool.name)}</div>
            <div style="font-size:10.5px; opacity:0.75; color:#cbd5e1; line-height:1.3; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; margin-top:2px;">${meEscapar(tool.description)}</div>
          </div>
        </div>
        ${renderCapabilityActionButton(tool, cardMsgId)}
      </div>
    `;
  }

  function renderCapabilityActionButton(tool, cardMsgId) {
    return `
      <button class="capability-action-btn" onclick="event.stopPropagation(); Chat.ejecutarHerramientaDesdeCard('${meEscapar(tool.id)}', '${cardMsgId}', this)" style="width:100%; text-align:center; padding:7px 10px; font-size:11.5px; font-weight:800; border-radius:10px; background:linear-gradient(135deg, #8b5cf6, #6366f1); color:#fff; border:none; cursor:pointer; box-shadow:0 3px 10px rgba(99,102,241,0.25); transition:all 0.15s ease;">
        🚀 Iniciar
      </button>
    `;
  }

  function abrirCategoriaCapabilities(cardMsgId, catId) {
    const data = (window.linkCapabilitiesData && window.linkCapabilitiesData[cardMsgId]) || null;
    if (!data) return;

    const cat = (data.categories || []).find(c => c.id === catId);
    if (!cat) return;

    const navEl = document.getElementById(`caps_nav_${cardMsgId}`);
    const bodyEl = document.getElementById(`caps_body_${cardMsgId}`);

    if (navEl) {
      navEl.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
          <button onclick="event.stopPropagation(); Chat.volverACategoriasCapabilities('${cardMsgId}')" style="background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.2); color:#fff; font-size:11px; font-weight:700; padding:4px 10px; border-radius:10px; cursor:pointer; display:flex; align-items:center; gap:4px;">
            ← Volver a Categorías
          </button>
          <span style="font-weight:800; font-size:12.5px; color:#a78bfa;">${cat.icon} ${meEscapar(cat.name)}</span>
        </div>
      `;
    }

    if (bodyEl) {
      bodyEl.style.gridTemplateColumns = 'repeat(2, 1fr)';
      const toolsHtml = (cat.tools || []).map(t => {
        t.catId = catId;
        return renderCapabilityToolCard(t, cardMsgId);
      }).join('');

      bodyEl.classList.add('capabilities-fade-in');
      bodyEl.innerHTML = toolsHtml;
      setTimeout(() => bodyEl.classList.remove('capabilities-fade-in'), 300);
    }
  }

  function volverACategoriasCapabilities(cardMsgId) {
    const data = (window.linkCapabilitiesData && window.linkCapabilitiesData[cardMsgId]) || null;
    if (!data) return;

    const navEl = document.getElementById(`caps_nav_${cardMsgId}`);
    const bodyEl = document.getElementById(`caps_body_${cardMsgId}`);

    if (navEl) {
      navEl.innerHTML = `<div style="font-size:11.5px; opacity:0.85; color:#cbd5e1; margin-bottom:6px;">Selecciona una categoría para explorar:</div>`;
    }

    if (bodyEl) {
      bodyEl.style.gridTemplateColumns = 'repeat(2, 1fr)';
      const categoriesHtml = (data.categories || []).map(cat => renderCapabilityCategoryCard(cat, cardMsgId)).join('');
      bodyEl.classList.add('capabilities-fade-in');
      bodyEl.innerHTML = categoriesHtml;
      setTimeout(() => bodyEl.classList.remove('capabilities-fade-in'), 300);
    }
  }

  function ejecutarHerramientaDesdeCard(toolId, cardMsgId, btnElem) {
    const data = (window.linkCapabilitiesData && window.linkCapabilitiesData[cardMsgId]) || null;
    if (!data) return;

    let targetTool = null;
    for (const cat of (data.categories || [])) {
      const found = (cat.tools || []).find(t => t.id === toolId);
      if (found) {
        targetTool = found;
        break;
      }
    }

    if (!targetTool) return;

    if (btnElem) {
      btnElem.disabled = true;
      btnElem.innerHTML = '⏳ Cargando...';
      setTimeout(() => {
        if (btnElem) {
          btnElem.disabled = false;
          btnElem.innerHTML = '🚀 Iniciar';
        }
      }, 2500);
    }

    const toolName = targetTool.tool;
    const toolParams = targetTool.params || {};

    // Si es un minijuego (game.launch)
    if (toolName === 'game.launch' && toolParams.gameId) {
      api('/ai/chat', { method: 'POST', body: { tool_name: 'game.launch', tool_params: { gameId: toolParams.gameId } } })
        .then((res) => {
          if (res && res.tool_result) {
            const burbujaEl = pintarBurbuja({
              id: 'game_launch_' + Date.now(),
              senderId: '00000000-0000-0000-0000-0000000000a1',
              text: `🎮 Iniciando ${targetTool.name}...`,
              createdAt: new Date().toISOString()
            }, Sesion.usuario().id);

            const cardHtml = renderizarTarjetaResultadoHerramienta(res.tool_result);
            if (cardHtml) burbujaEl.insertAdjacentHTML('beforeend', cardHtml);
            $('chatMensajes').appendChild(burbujaEl);
            $('chatMensajes').scrollTop = $('chatMensajes').scrollHeight;

            // Lanzar juego directamente si URL está presente
            const gData = res.tool_result.data || {};
            if (window.abrirJuego && gData.url) {
              window.abrirJuego(gData.url, gData.name || targetTool.name, gData.game_id || toolParams.gameId);
            }
          }
        })
        .catch((err) => {
          mostrarToast('Error al lanzar minijuego: ' + (err.message || 'Desconocido'));
        });
      return;
    }

    // Si requiere consulta del usuario (búsqueda web, wikipedia, etc.)
    let finalPrompt = targetTool.prompt_example || `Ejecuta ${targetTool.name}`;
    if (toolName === 'web.search' || toolName === 'wikipedia.search' || toolName === 'github.search' || toolName === 'social.profile' || toolName === 'user.search_by_interest' || toolName === 'posts.search' || toolName === 'openlibrary.search' || toolName === 'youtube.search' || toolName === 'stock.photos') {
      const userInput = prompt(`Ingresa el término o consulta para ${targetTool.name}:`, targetTool.prompt_example || '');
      if (userInput === null) return; // Cancelado por usuario
      if (userInput.trim()) {
        finalPrompt = userInput.trim();
      }
    }

    // Ejecutar vía flujo normal del chat o AILab enviando el mensaje a la IA
    if (document.getElementById('vistaAilab')?.classList.contains('activo') && window.AILab) {
      window.AILab.quickPrompt(finalPrompt);
    } else {
      solicitarUbicacionYEnviar(finalPrompt, null, null, 0);
    }
  }

  function renderizarTarjetaResultadoHerramienta(toolResult) {
    if (!toolResult || !toolResult.type) return '';
    const t = toolResult.type;
    const data = toolResult.data || {};

    // 0. Tarjeta de Capacidades de Link (capabilities_card)
    if (t === 'capabilities_card' && data) {
      const cardMsgId = 'caps_' + Math.random().toString(36).substring(2, 9);
      return renderCapabilitiesCard(data, cardMsgId);
    }

    // 0a. Tarjeta de Lanzamiento de Minijuego (game_launch_card)
    if (t === 'game_launch_card') {
      const g = data;
      const icons = {
        tictactoe: '❌', connect4: '🟡', pong: '🏓', trivia: '🧠', memory: '🃏',
        snake: '🐍', '2048': '🔢', flappy: '🐤', breakout: '🧱', wordle: '🔤',
        minesweeper: '💣', simon: '🔴', sudoku: '🔢', spaceinvaders: '👾',
        whackamole: '🔨', solitaire: '🎴', checkers: '⚪', hanoi: '🗼',
        pacman: '👻', typing: '⌨️', towerstack: '🏗️', match3: '💎',
        mathquiz: '➕', doodlejump: '🦘', lightsout: '💡', hangman: '🪢',
        wordsearch: '🔠'
      };
      const icon = icons[g.game_id] || '🕹️';

      return `<div style="margin-top:8px; padding:14px; background:var(--fondo-tarjeta, #1e293b); border:1.5px solid var(--morado-500, #8b5cf6); border-radius:16px; max-width:320px; color:#fff; box-shadow:0 4px 12px rgba(139,92,246,0.15);">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
          <div style="font-size:28px; background:rgba(139,92,246,0.2); width:46px; height:46px; border-radius:12px; display:flex; align-items:center; justify-content:center;">${icon}</div>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:800; font-size:15px; color:#fff;">${meEscapar(g.name || 'Minijuego')}</div>
            <span style="font-size:10px; font-weight:700; background:var(--morado-600, #7c3aed); color:#fff; padding:2px 8px; border-radius:10px; text-transform:uppercase;">${meEscapar(g.category || 'Juego')}</span>
          </div>
        </div>
        <div style="font-size:12px; opacity:0.85; line-height:1.4; margin-bottom:12px; color:#cbd5e1;">${meEscapar(g.description || '')}</div>
        <button class="mini-btn primario" style="width:100%; text-align:center; padding:9px; font-size:13px; font-weight:800; border-radius:10px; background:linear-gradient(135deg, #8b5cf6, #6366f1); color:#fff; cursor:pointer; border:none; box-shadow:0 3px 10px rgba(99,102,241,0.3);" onclick="if(window.abrirJuego) window.abrirJuego('${meEscapar(g.url)}', '${meEscapar(g.name)}', '${meEscapar(g.game_id)}')">
          🎮 Jugar Ahora
        </button>
      </div>`;
    }

    // 0b. Tarjeta de Lista de Minijuegos (game_list_card)
    if (t === 'game_list_card') {
      const gamesList = toolResult.games || [];
      const icons = {
        tictactoe: '❌', connect4: '🟡', pong: '🏓', trivia: '🧠', memory: '🃏',
        snake: '🐍', '2048': '🔢', flappy: '🐤', breakout: '🧱', wordle: '🔤',
        minesweeper: '💣', simon: '🔴', sudoku: '🔢', spaceinvaders: '👾',
        whackamole: '🔨', solitaire: '🎴', checkers: '⚪', hanoi: '🗼',
        pacman: '👻', typing: '⌨️', towerstack: '🏗️', match3: '💎',
        mathquiz: '➕', doodlejump: '🦘', lightsout: '💡', hangman: '🪢',
        wordsearch: '🔠'
      };

      return `<div style="margin-top:8px; padding:12px; background:var(--fondo-tarjeta, #1e293b); border:1.5px solid rgba(139,92,246,0.3); border-radius:16px; max-width:340px; color:#fff;">
        <div style="font-weight:800; font-size:14px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
          <span>🎮 Minijuegos de Link Games (${gamesList.length})</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px; max-height:220px; overflow-y:auto; padding-right:4px;">
          ${gamesList.slice(0, 8).map(g => `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:8px; background:rgba(255,255,255,0.05); border-radius:10px;">
              <div style="display:flex; align-items:center; gap:8px; min-width:0; flex:1;">
                <span style="font-size:18px;">${icons[g.id] || '🕹️'}</span>
                <div style="min-width:0;">
                  <div style="font-weight:700; font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${meEscapar(g.name)}</div>
                  <div style="font-size:10px; opacity:0.7;">${meEscapar(g.category)}</div>
                </div>
              </div>
              <button style="padding:4px 10px; font-size:11px; font-weight:700; border-radius:6px; background:#8b5cf6; color:#fff; border:none; cursor:pointer;" onclick="if(window.abrirJuego) window.abrirJuego('${meEscapar(g.url)}', '${meEscapar(g.name)}', '${meEscapar(g.id)}')">
                Jugar
              </button>
            </div>
          `).join('')}
        </div>
      </div>`;
    }

    // 1. Tarjeta de Perfil Social / Usuario con animación de pulso y latido de ondas
    if (t === 'social_profile_card') {
      const avatarSrc = data.avatar || iconoDefecto();
      const esAdmin = data.is_admin || data.role === 'admin';
      const esVerificado = !!data.verified;

      let badgeAdmin = esAdmin ? `<span style="background:#ef4444; color:#fff; font-size:10px; font-weight:700; padding:2px 6px; border-radius:10px; margin-left:4px; display:inline-flex; align-items:center; gap:2px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-5.45 9-12V5l-9-4z"/></svg>ADMIN</span>` : '';
      let badgeVerif = esVerificado ? `<span style="color:#3b82f6; font-size:13px; margin-left:2px; display:inline-flex; align-items:center;" title="Verificado"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></span>` : '';

      return `<div class="tarjeta-contacto-pulsante">
        <div style="display:flex; align-items:center; gap:10px;">
          <img src="${escapar(avatarSrc)}" alt="" style="width:52px; height:52px; border-radius:50%; object-fit:cover; border:2.5px solid var(--morado-500, #8b5cf6);">
          <div style="flex:1; min-width:0;">
            <div style="font-weight:700; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapar(data.name || data.username)}${badgeVerif}${badgeAdmin}</div>
            <div style="font-size:12px; opacity:0.75;">@${escapar(data.username)}</div>
            <div style="font-size:11px; opacity:0.85; color:var(--morado-600, #7c3aed); font-weight:600;">${escapar(data.profession || 'Miembro de Link')}</div>
          </div>
        </div>
        ${data.bio ? `<div style="margin-top:8px; font-size:12px; line-height:1.35; opacity:0.9; max-height:48px; overflow:hidden;">${escapar(data.bio)}</div>` : ''}
        <div style="margin-top:10px; display:flex; gap:6px; flex-wrap:wrap;">
          ${data.id ? `<button class="mini-btn primario" style="flex:1; text-align:center; padding:6px 8px; font-size:11.5px; border-radius:8px;" onclick="if(window.abrirPerfil) window.abrirPerfil('${escapar(data.id)}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:2px;"><path d="M20 21c0-4.4-3.6-8-8-8s-8 3.6-8 8"/><circle cx="12" cy="7" r="4"/></svg>Ver Perfil</button>` : ''}
          ${data.id ? `<button class="mini-btn secundario" style="flex:1; padding:6px 8px; font-size:11.5px; border-radius:8px;" onclick="Chat.enviarSolicitudAmistadDirecta('${escapar(data.id)}', '${escapar(data.name || data.username)}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:2px;"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>Agregar</button>` : ''}
          <button class="mini-btn secundario" style="flex:1; padding:6px 8px; font-size:11.5px; border-radius:8px;" onclick="Chat.enviarInvitacionCita('${escapar(data.id || '')}', '${escapar(data.name || data.username)}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:2px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Cita</button>
        </div>
      </div>`;
    }

    // 2. Weather Widget con Sol/Nube/Sombrilla, números grandes y gráfica táctil SVG
    if (t === 'weather_card' || t === 'open_meteo') {
      const city = data.city || toolResult.city || 'Ubicación';
      const temp = data.temp_c || (data.current_weather ? `${data.current_weather.temperature}°C` : 'N/A');
      const condition = data.condition || 'Clima local';
      const hum = data.humidity || 'N/A';
      const wind = data.wind || 'N/A';

      let weatherIconSvg = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
      const condLower = condition.toLowerCase();
      if (condLower.includes('lluv') || condLower.includes('tormenta') || condLower.includes('agua') || condLower.includes('rain')) {
        weatherIconSvg = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M23 12a11 11 0 0 1-22 0z"/><line x1="12" y1="12" x2="12" y2="22"/></svg>`;
      } else if (condLower.includes('nub') || condLower.includes('cubierto') || condLower.includes('cloud')) {
        weatherIconSvg = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`;
      }

      const numTemp = parseInt(temp) || 25;
      const points = [
        { hr: '09:00', t: numTemp - 2 },
        { hr: '12:00', t: numTemp + 2 },
        { hr: '15:00', t: numTemp + 3 },
        { hr: '18:00', t: numTemp + 1 },
        { hr: '21:00', t: numTemp - 2 }
      ];

      return `<div style="margin-top:8px; padding:14px; background:var(--fondo-tarjeta, #fff); border:1.5px solid var(--morado-500, #8b5cf6); border-radius:16px; max-width:310px; font-size:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div>
            <div style="font-weight:800; font-size:15px; color:var(--texto-900);">${meEscapar(city)}</div>
            <div style="font-size:11.5px; opacity:0.8; color:var(--morado-600); font-weight:600;">${meEscapar(condition)}</div>
          </div>
          <div>${weatherIconSvg}</div>
        </div>
        <div style="display:flex; align-items:baseline; gap:8px; margin-bottom:12px;">
          <span style="font-size:36px; font-weight:900; color:var(--morado-700, #6000e6); line-height:1;">${meEscapar(temp)}</span>
          <span style="font-size:11.5px; opacity:0.75;">Humedad: ${meEscapar(hum)} • Viento: ${meEscapar(wind)}</span>
        </div>
        <div style="background:rgba(139,92,246,0.06); border-radius:12px; padding:8px; border:1px solid rgba(139,92,246,0.15);">
          <div style="font-size:10.5px; font-weight:700; opacity:0.75; margin-bottom:4px;">Pronóstico Térmico Táctil (°C)</div>
          <svg viewBox="0 0 200 65" style="width:100%; height:65px; overflow:visible;">
            <polyline fill="none" stroke="#8b5cf6" stroke-width="2.5" points="10,40 50,20 100,10 150,28 190,40"/>
            ${points.map((p, i) => {
              const x = 10 + i * 45;
              const y = 50 - (p.t - 20) * 3;
              return `
                <g style="cursor:pointer;" onclick="mostrarToast('Temperatura a las ${p.hr}: ${p.t}°C')">
                  <circle cx="${x}" cy="${y}" r="5" fill="#8b5cf6" stroke="#ffffff" stroke-width="1.5"/>
                  <text x="${x}" y="${y - 8}" font-size="8" font-weight="bold" fill="var(--morado-700)" text-anchor="middle">${p.t}°</text>
                  <text x="${x}" y="62" font-size="7" fill="var(--texto-500)" text-anchor="middle">${p.hr}</text>
                </g>
              `;
            }).join('')}
          </svg>
        </div>
      </div>`;
    }

    // 3. Resultados de Personas / Sugerencias por Similitud de Nombre
    if (t === 'user_search_results' && Array.isArray(data.users) && data.users.length) {
      const cardGroupId = 'group_' + Math.random().toString(36).substring(2, 9);
      const items = data.users.map(u => `
        <div class="tarjeta-usuario-item tarjeta-contacto-pulsante" id="user_card_${u.id}_${cardGroupId}" style="padding:8px; margin-bottom:6px; background:var(--fondo-pagina, #f9fafb); border:1px solid var(--borde, #e5e7eb); border-radius:10px; transition:all 0.2s ease;">
          <div style="display:flex; align-items:center; gap:10px; cursor:pointer;" onclick="Chat.alternarPanelUsuario('${u.id}', '${cardGroupId}')">
            <img src="${u.avatar || iconoDefecto()}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:1.5px solid var(--morado-500, #8b5cf6);">
            <div style="flex:1; min-width:0;">
              <div style="font-weight:700; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapar(u.name)} ${u.verified ? '<span style="color:#3b82f6; display:inline-flex; align-items:center;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}</div>
              <div style="font-size:11px; opacity:0.75;">@${escapar(u.username)} • ${escapar(u.profession || 'Link')}</div>
            </div>
            <span style="font-size:12px; opacity:0.6;">▼</span>
          </div>
          <div id="user_panel_${u.id}_${cardGroupId}" class="panel-usuario-desplegable" style="display:none; margin-top:8px; padding-top:8px; border-top:1px dashed var(--borde, #e5e7eb); font-size:11.5px;">
            ${u.bio ? `<div style="margin-bottom:6px; opacity:0.85;">${escapar(u.bio)}</div>` : ''}
            <div style="display:flex; gap:6px; margin-top:6px; flex-wrap:wrap;">
              <button class="mini-btn primario" style="flex:1; text-align:center; padding:4px 6px; font-size:11px; border-radius:6px;" onclick="if(window.abrirPerfil) window.abrirPerfil('${u.id}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:2px;"><path d="M20 21c0-4.4-3.6-8-8-8s-8 3.6-8 8"/><circle cx="12" cy="7" r="4"/></svg>Ver perfil</button>
              <button class="mini-btn secundario" style="flex:1; padding:4px 6px; font-size:11px; border-radius:6px;" onclick="Chat.enviarSolicitudAmistadDirecta('${u.id}', '${escapar(u.name)}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:2px;"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>Agregar</button>
              <button class="mini-btn secundario" style="padding:4px 6px; font-size:11px; border-radius:6px;" onclick="Chat.abrirConversacionConId('${u.id}', '${escapar(u.name)}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:2px;"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5Z"/></svg>Mensaje</button>
            </div>
          </div>
        </div>
      `).join('');

      return `<div id="contenedor_grupo_${cardGroupId}" style="margin-top:8px; padding:10px; background:var(--fondo-tarjeta, #fff); border:1px solid var(--borde, #e5e7eb); border-radius:12px; max-width:310px;">
        <div style="font-weight:700; font-size:12px; margin-bottom:8px; color:var(--morado-600, #7c3aed); display:flex; justify-space-between; align-items:center;">
          <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:4px;"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>Encontré ${data.count || data.users.length} persona(s) (${escapar(data.interest)}):</span>
        </div>
        <div class="contenedor-usuarios-lista">${items}</div>
      </div>`;
    }

    // 4. Vista previa del Chat con otro usuario & Opción de Responder directamente
    if (t === 'chat_preview_card' && data) {
      const cardId = 'chat_prev_' + Math.random().toString(36).substring(2, 9);
      const msgsHtml = Array.isArray(data.messages) && data.messages.length ? data.messages.map(m => `
        <div style="margin-bottom:4px; padding:4px 8px; border-radius:8px; font-size:11.5px; background:${m.is_me ? 'rgba(139,92,246,0.15)' : 'rgba(0,0,0,0.04)'}; align-self:${m.is_me ? 'flex-end' : 'flex-start'}; max-width:85%;">
          <div style="font-weight:700; font-size:10px; opacity:0.75;">${m.is_me ? 'Tú' : meEscapar(data.target_name)}</div>
          <div>${meEscapar(m.text)}</div>
        </div>
      `).join('') : '<div style="font-size:11.5px; opacity:0.7; font-style:italic;">No hay mensajes recientes en este chat.</div>';

      return `<div id="${cardId}" style="margin-top:8px; padding:12px; background:var(--fondo-tarjeta, #fff); border:1.5px solid var(--morado-500, #8b5cf6); border-radius:14px; max-width:310px; font-size:12px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; border-bottom:1px solid var(--borde); padding-bottom:6px;">
          <img src="${data.target_avatar || iconoDefecto()}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;">
          <div style="flex:1; min-width:0;">
            <div style="font-weight:700; font-size:13px;">Chat con ${meEscapar(data.target_name)}</div>
            <div style="font-size:10.5px; opacity:0.75;">@${meEscapar(data.target_username)}</div>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px; max-height:140px; overflow-y:auto; margin-bottom:10px; padding-right:2px;">
          ${msgsHtml}
        </div>
        <div id="reply_box_${cardId}" style="display:flex; gap:6px;">
          <input type="text" id="input_reply_${data.target_id}_${cardId}" placeholder="Escribe a ${meEscapar(data.target_name)}..." style="flex:1; border:1px solid var(--borde); border-radius:12px; padding:6px 10px; font-size:11.5px; outline:none; background:var(--hueso);">
          <button class="mini-btn primario" style="padding:6px 10px; font-size:11px; border-radius:12px;" onclick="Chat.enviarRespuestaDirectaEnChatCard('${data.target_id}', '${cardId}')">Responder</button>
        </div>
      </div>`;
    }

    // 5. Edición de Perfil Completada
    if (t === 'profile_updated_card' && data) {
      return `<div style="margin-top:8px; padding:12px; background:var(--fondo-tarjeta, #fff); border:1px solid #10b981; border-radius:12px; max-width:290px; font-size:12px;">
        <div style="font-weight:800; color:#10b981; font-size:13px; margin-bottom:4px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:middle; margin-right:4px;"><polyline points="20 6 9 17 4 12"/></svg>${meEscapar(data.message || 'Perfil Actualizado')}</div>
        <div style="font-size:11.5px; opacity:0.85;">Los cambios se han guardado en tu perfil público de Link.</div>
      </div>`;
    }

    // 6. Estado Creado o Eliminado
    if (t === 'status_created_card' || t === 'status_deleted_card') {
      const esBorrado = t === 'status_deleted_card';
      return `<div style="margin-top:8px; padding:12px; background:var(--fondo-tarjeta, #fff); border:1px solid ${esBorrado ? '#ef4444' : '#8b5cf6'}; border-radius:12px; max-width:290px; font-size:12px;">
        <div style="font-weight:800; color:${esBorrado ? '#ef4444' : '#8b5cf6'}; font-size:13px; margin-bottom:4px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:4px;"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>${meEscapar(data.message || (esBorrado ? 'Estado Eliminado' : 'Estado Publicado'))}</div>
        ${data.text ? `<div style="font-size:11.5px; opacity:0.85; font-style:italic;">"${meEscapar(data.text)}"</div>` : ''}
      </div>`;
    }

    // 7. Transmisiones en Vivo de YouTube
    if (t === 'youtube_live_card' && data) {
      const liveFrameId = 'yt_live_' + Math.random().toString(36).substring(2, 9);
      return `<div style="margin-top:8px; padding:10px; background:#0f0f15; border:1px solid #ef4444; border-radius:14px; max-width:320px; font-size:12px; color:#fff;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="background:#ef4444; color:#fff; font-size:10px; font-weight:800; padding:2px 8px; border-radius:10px; display:inline-flex; align-items:center; gap:4px;">● EN VIVO</span>
          <span style="font-size:10.5px; opacity:0.8;">YouTube Directos</span>
        </div>
        <div style="font-weight:700; font-size:12.5px; margin-bottom:6px;">${meEscapar(data.title)}</div>
        <div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:10px; margin-bottom:8px;">
          <iframe id="${liveFrameId}" src="${meEscapar(data.embed_url)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;"></iframe>
        </div>
        ${data.watch_url ? `<a href="${meEscapar(data.watch_url)}" target="_blank" class="mini-btn primario" style="display:block; text-align:center; padding:6px; font-size:11px; border-radius:8px; text-decoration:none;">Ver Transmisión en YouTube ↗</a>` : ''}
      </div>`;
    }

    // 8. Galería de Fotos de Banco / Stock / Wikimedia / Random Photos
    if ((t === 'stock_photos_card' || t === 'random_photos_card') && data && Array.isArray(data.photos)) {
      const photoItems = data.photos.map(p => `
        <div style="position:relative; margin-bottom:6px; border-radius:10px; overflow:hidden;">
          <img src="${meEscapar(p.url)}" alt="${meEscapar(p.title)}" style="width:100%; height:160px; object-fit:cover; border-radius:10px; cursor:pointer;" onclick="window.abrirVisorImagen('${p.url.replace(/'/g, "\\'")}')">
          <div style="position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.65); color:#fff; padding:4px 8px; font-size:10.5px; display:flex; justify-content:space-between; align-items:center;">
            <span>${meEscapar(p.source || 'Wikimedia / Photos')}</span>
            <a href="${meEscapar(p.url)}" download target="_blank" style="color:#60a5fa; font-weight:700; text-decoration:none;">Descargar ⬇️</a>
          </div>
        </div>
      `).join('');

      return `<div style="margin-top:8px; padding:10px; background:var(--fondo-tarjeta, #fff); border:1px solid var(--borde); border-radius:14px; max-width:310px; font-size:12px;">
        <div style="font-weight:700; color:var(--morado-600); margin-bottom:8px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:4px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>Fotos (${meEscapar(data.query || data.topic || 'Random')}):</div>
        ${photoItems}
      </div>`;
    }

    if (t === 'wikimedia_commons' && toolResult.media && Array.isArray(toolResult.media)) {
      const mediaItems = toolResult.media.map(m => `
        <div style="position:relative; margin-bottom:6px; border-radius:10px; overflow:hidden; background:#000;">
          <img src="${meEscapar(m.url)}" alt="${meEscapar(m.title)}" style="width:100%; height:160px; object-fit:cover; border-radius:10px; cursor:pointer;" onclick="window.abrirVisorImagen('${m.url.replace(/'/g, "\\'")}')">
          <div style="position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.7); color:#fff; padding:4px 8px; font-size:10px; display:flex; justify-space-between; align-items:center;">
            <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;">${meEscapar(m.title)}</span>
            <a href="${meEscapar(m.url)}" target="_blank" download style="color:#60a5fa; font-weight:700; text-decoration:none;">⬇️</a>
          </div>
        </div>
      `).join('');

      return `<div style="margin-top:8px; padding:10px; background:var(--fondo-tarjeta, #fff); border:1px solid var(--borde); border-radius:14px; max-width:310px; font-size:12px;">
        <div style="font-weight:700; color:var(--morado-600); margin-bottom:8px;">📚 Wikimedia Commons (${meEscapar(toolResult.query)}):</div>
        ${mediaItems || '<div style="font-size:11px; opacity:0.7;">No se encontraron imágenes en Wikimedia.</div>'}
      </div>`;
    }

    // 8c. GIFs Animados y Stickers en Movimiento
    if (t === 'gif_card' && data && Array.isArray(data.gifs)) {
      const gifItems = data.gifs.map(g => `
        <div style="position:relative; margin-bottom:8px; border-radius:12px; overflow:hidden; border:1px solid var(--borde);">
          <img src="${meEscapar(g.url)}" alt="${meEscapar(g.title)}" style="width:100%; max-height:180px; object-fit:cover; border-radius:12px; display:block; cursor:pointer;" onclick="window.abrirVisorImagen('${g.url.replace(/'/g, "\\'")}')">
          <div style="padding:4px 8px; font-size:10.5px; background:rgba(0,0,0,0.6); color:#fff; display:flex; justify-content:space-between; align-items:center;">
            <span>🎞️ ${meEscapar(g.title)}</span>
          </div>
        </div>
      `).join('');

      return `<div style="margin-top:8px; padding:10px; background:var(--fondo-tarjeta, #fff); border:1.5px solid var(--morado-500, #8b5cf6); border-radius:14px; max-width:310px; font-size:12px;">
        <div style="font-weight:800; color:var(--morado-700); margin-bottom:8px; font-size:13px;">🎬 GIFs Animados (${meEscapar(data.query)}):</div>
        ${gifItems}
      </div>`;
    }

    if (t === 'animated_sticker_card' && data && Array.isArray(data.stickers)) {
      const stickerItems = data.stickers.map(s => `
        <div style="text-align:center; padding:6px; background:var(--hueso); border-radius:10px;">
          <img src="${meEscapar(s.gif_url)}" alt="${meEscapar(s.name)}" style="width:64px; height:64px; object-fit:contain; margin:0 auto 4px; display:block;">
          <div style="font-size:10.5px; font-weight:700;">${meEscapar(s.name)} ${s.emoji || ''}</div>
        </div>
      `).join('');

      return `<div style="margin-top:8px; padding:10px; background:var(--fondo-tarjeta, #fff); border:1.5px solid var(--morado-500, #8b5cf6); border-radius:14px; max-width:310px; font-size:12px;">
        <div style="font-weight:800; color:var(--morado-700); margin-bottom:8px; font-size:13px;">✨ Stickers Animados:</div>
        <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:8px;">${stickerItems}</div>
      </div>`;
    }

    // 8d. Gráficos 3D Interactivos, Wiggle y Figuras Tridimensionales
    if (t === '3d_graphics_card' || t === 'interactive_chart_3d') {
      const canvasId = 'canvas3d_' + Math.random().toString(36).substring(2, 9);
      const title = data.title || 'Gráfico 3D Interactivo';
      const shape = data.shape || 'cube';
      const color = data.color || '#8b5cf6';

      setTimeout(() => {
        if (window.inicializarCanvas3D) {
          window.inicializarCanvas3D(canvasId, shape, color);
        }
      }, 100);

      return `<div class="tarjeta-3d-wiggle" style="margin-top:8px; padding:12px; background:linear-gradient(135deg, #111827, #1f2937); color:#fff; border:1.5px solid #8b5cf6; border-radius:16px; max-width:310px; font-size:12px; box-shadow:0 8px 24px rgba(139,92,246,0.25);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-weight:800; color:#a78bfa; font-size:13px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:4px;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>${meEscapar(title)}</span>
          <span style="background:#8b5cf6; color:#fff; font-size:10px; font-weight:800; padding:2px 8px; border-radius:10px;">3D Wiggle</span>
        </div>
        <div style="position:relative; width:100%; height:180px; background:#000; border-radius:12px; overflow:hidden; border:1px solid rgba(255,255,255,0.15);">
          <canvas id="${canvasId}" style="width:100%; height:100%; display:block; cursor:grab;"></canvas>
        </div>
        <div style="margin-top:8px; font-size:10.5px; opacity:0.8; text-align:center;">
          💡 Arrastra con el dedo/mouse para rotar en 3D.
        </div>
      </div>`;
    }

    // 9. Videos Gratuitos / Dominio Público
    if (t === 'free_videos_card' && data && Array.isArray(data.videos)) {
      const vidItems = data.videos.map(v => `
        <div style="margin-bottom:8px; padding:8px; background:rgba(0,0,0,0.03); border-radius:10px;">
          <div style="font-weight:700; font-size:12px; margin-bottom:4px;">${meEscapar(v.title)}</div>
          <div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:8px; margin-bottom:4px;">
            <iframe src="${meEscapar(v.embed_url)}" frameborder="0" allowfullscreen style="position:absolute; top:0; left:0; width:100%; height:100%;"></iframe>
          </div>
          <div style="font-size:10px; opacity:0.75;">${meEscapar(v.source)}</div>
        </div>
      `).join('');

      return `<div style="margin-top:8px; padding:10px; background:var(--fondo-tarjeta, #fff); border:1px solid var(--borde); border-radius:14px; max-width:310px; font-size:12px;">
        <div style="font-weight:700; color:var(--morado-600); margin-bottom:8px;">▶️ Contenido en Video Gratuito:</div>
        ${vidItems}
      </div>`;
    }

    // 9b. Búsqueda de Videos Interna / Pexels / Reproductor Integrado
    if (t === 'video_search_card' && data && Array.isArray(data.videos) && data.videos.length > 0) {
      const vidItems = data.videos.slice(0, 3).map(v => `
        <div style="margin-bottom:10px; padding:10px; background:rgba(0,0,0,0.05); border-radius:12px; border:1px solid rgba(139,92,246,0.2);">
          <div style="font-weight:700; font-size:12.5px; margin-bottom:6px; color:var(--texto-900); display:flex; justify-content:space-between; align-items:center;">
            <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px;">${meEscapar(v.title)}</span>
            <span style="font-size:10px; opacity:0.75; font-weight:600;">${v.orientation === 'portrait' ? '📱 Vertical' : '📺 Horizontal'}</span>
          </div>
          <div style="position:relative; width:100%; border-radius:10px; overflow:hidden; background:#000; margin-bottom:6px;">
            <video controls playsinline preload="metadata" poster="${meEscapar(v.thumbnail)}" style="width:100%; max-height:240px; display:block; border-radius:10px;">
              <source src="${meEscapar(v.stream_url)}" type="video/mp4">
              Tu navegador no soporta la reproducción de video HTML5.
            </video>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:10.5px; opacity:0.85; margin-bottom:6px;">
            <span>⏱️ ${v.duration ? v.duration + 's' : 'Video'}</span>
            <a href="${meEscapar(v.user?.url || v.url)}" target="_blank" rel="noopener noreferrer" style="color:var(--morado-600); text-decoration:none; font-weight:700;">
              📷 ${meEscapar(v.attribution_text || ('Video por ' + (v.user?.name || 'Creador') + ' en Pexels'))}
            </a>
          </div>
          <div style="display:flex; gap:6px;">
            <a href="${meEscapar(v.url)}" target="_blank" rel="noopener noreferrer" class="mini-btn primario" style="flex:1; text-align:center; padding:5px 8px; font-size:11px; border-radius:6px; text-decoration:none;">Ver en Pexels ↗</a>
            <a href="${meEscapar(v.stream_url)}" target="_blank" download class="mini-btn secundario" style="padding:5px 8px; font-size:11px; border-radius:6px; text-decoration:none;">⬇️ HD</a>
          </div>
        </div>
      `).join('');

      return `<div style="margin-top:8px; padding:12px; background:var(--fondo-tarjeta, #fff); border:1.5px solid var(--morado-500, #8b5cf6); border-radius:14px; max-width:315px; font-size:12px;">
        <div style="font-weight:800; color:var(--morado-700); margin-bottom:8px; font-size:13px; display:flex; justify-content:space-between; align-items:center;">
          <span>🎬 Videos (${meEscapar(data.query || 'Pexels')}):</span>
          <span style="font-size:10px; background:rgba(139,92,246,0.12); color:var(--morado-600); padding:2px 6px; border-radius:8px; font-weight:700;">${meEscapar(data.provider || 'Pexels')}</span>
        </div>
        ${vidItems}
      </div>`;
    }

    // 10. Tarjetas de Pago y Monetización QvaPay
    if (t === 'payment_link_card' && data) {
      return `<div style="margin-top:8px; padding:12px; background:var(--fondo-tarjeta, #fff); border:1.5px solid #10b981; border-radius:14px; max-width:300px; font-size:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-weight:800; color:#10b981; font-size:13px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:4px;"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>Checkout Link</span>
          <span style="font-weight:900; font-size:14px; color:#10b981;">$${meEscapar(data.amount_usd)} USD</span>
        </div>
        <div style="font-weight:700; font-size:12.5px; margin-bottom:4px;">${meEscapar(data.service_name)}</div>
        <div style="font-size:11px; opacity:0.85; margin-bottom:10px;">${meEscapar(data.description)}</div>
        <a href="${meEscapar(data.qvapay_link)}" target="_blank" class="mini-btn primario" style="display:block; text-align:center; padding:8px; font-size:12px; font-weight:800; border-radius:10px; text-decoration:none; background:#10b981; color:#fff;">Pagar con QvaPay 💳</a>
      </div>`;
    }

    // 11. Resultados de Búsqueda DuckDuckGo API
    if (t === 'duckduckgo_results' && data) {
      return `<div style="margin-top:8px; padding:10px; background:var(--fondo-tarjeta, #fff); border:1px solid var(--borde); border-radius:12px; max-width:310px; font-size:12px;">
        <div style="font-weight:700; color:#de5833; margin-bottom:4px;">🦆 DuckDuckGo Search:</div>
        <div style="font-weight:700; font-size:13px; margin-bottom:4px;">${meEscapar(data.heading)}</div>
        <div style="font-size:11.5px; opacity:0.85; line-height:1.35; margin-bottom:6px;">${meEscapar(data.abstract)}</div>
        <div style="font-size:10px; opacity:0.65;">Fuente: ${meEscapar(data.abstract_source)}</div>
      </div>`;
    }

    // 12. Edición de Imagen / Editor de Fotos
    if (t === 'image_edit_card' || t === 'image_editor_job') {
      const reqId = data.requestId || data.request_id || '';
      const promptTxt = data.prompt || 'Edición de foto';
      const initialStatus = data.status || 'queued';
      const cardContainerId = 'img_edit_card_' + (reqId || Math.random().toString(36).substring(2, 9));

      let resultImgHtml = '';
      let statusBadge = `<span id="status_${cardContainerId}" style="background:#8b5cf6; color:#fff; font-size:10px; font-weight:800; padding:2px 8px; border-radius:10px;">Procesando</span>`;

      if (data.job && data.job.result_data) {
        let resObj = data.job.result_data;
        if (typeof resObj === 'string') {
          try { resObj = JSON.parse(resObj); } catch(e){}
        }
        const imgUrl = resObj?.image_url || resObj?.edited_image_url || resObj?.url || resObj?.result_base64 || '';
        if (imgUrl) {
          resultImgHtml = `<div style="margin-top:8px;"><img src="${meEscapar(imgUrl)}" style="width:100%; border-radius:10px; cursor:pointer;" onclick="window.abrirVisorImagen('${meEscapar(imgUrl)}')"></div>`;
          statusBadge = `<span style="background:#10b981; color:#fff; font-size:10px; font-weight:800; padding:2px 8px; border-radius:10px;">Completado ✓</span>`;
        }
      }

      // Iniciar sondeo si el estado es inicial o procesando
      if (reqId && (!resultImgHtml || initialStatus === 'queued' || initialStatus === 'processing')) {
        setTimeout(() => {
          let intentos = 0;
          const pollInterval = setInterval(async () => {
            intentos++;
            if (intentos > 20) { clearInterval(pollInterval); return; }
            try {
              const res = await api(`/image-editor/jobs/${reqId}/result`);
              if (res && res.job && res.job.status === 'completed') {
                clearInterval(pollInterval);
                let resObj = res.result || res.job.result_data;
                if (typeof resObj === 'string') {
                  try { resObj = JSON.parse(resObj); } catch(e){}
                }
                const imgUrl = resObj?.image_url || resObj?.edited_image_url || resObj?.url || resObj?.result_base64 || (typeof resObj === 'string' && resObj.startsWith('http') ? resObj : '');
                const targetCont = document.getElementById(cardContainerId);
                if (targetCont) {
                  const badgeEl = document.getElementById(`status_${cardContainerId}`);
                  if (badgeEl) {
                    badgeEl.style.background = '#10b981';
                    badgeEl.textContent = 'Completado ✓';
                  }
                  const imgBox = document.getElementById(`img_box_${cardContainerId}`);
                  if (imgBox && imgUrl) {
                    imgBox.innerHTML = `<img src="${imgUrl}" style="width:100%; border-radius:10px; cursor:pointer; margin-top:8px;" onclick="window.abrirVisorImagen('${imgUrl.replace(/'/g, "\\'")}')">`;
                  }
                }
              }
            } catch (e) {}
          }, 3000);
        }, 1000);
      }

      return `<div id="${cardContainerId}" style="margin-top:8px; padding:12px; background:var(--fondo-tarjeta, #fff); border:1.5px solid var(--morado-500, #8b5cf6); border-radius:14px; max-width:300px; font-size:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-weight:800; color:var(--morado-600, #7c3aed); font-size:13px;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:4px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>Edición de Foto</span>
          ${statusBadge}
        </div>
        <div style="font-size:11.5px; opacity:0.85; margin-bottom:4px; font-style:italic;">"${meEscapar(promptTxt)}"</div>
        <div id="img_box_${cardContainerId}">${resultImgHtml || '<div style="font-size:11px; opacity:0.75; padding:8px 0; text-align:center;">🪄 Aplicando retoque/edición a la foto...</div>'}</div>
      </div>`;
    }

    if (toolRes) {
      return `<div style="margin-top:8px; padding:12px; background:var(--fondo-tarjeta, #fff); border:1.5px solid var(--morado-500, #8b5cf6); border-radius:14px; max-width:310px; font-size:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-weight:800; color:var(--morado-700); font-size:13px;">🛠️ Resultado de Herramienta</span>
          <span style="font-size:10px; font-weight:800; color:#10b981; background:rgba(16,185,129,0.1); padding:2px 6px; border-radius:6px;">✓ Completado</span>
        </div>
        <pre style="font-size:11px; white-space:pre-wrap; word-break:break-word; background:var(--hueso); padding:8px; border-radius:8px; margin:0;">${meEscapar(typeof data === 'string' ? data : JSON.stringify(data || toolRes, null, 2))}</pre>
      </div>`;
    }

    return '';
  }

  function pintarBurbuja(msg, yoId) {
    const esMia = msg.senderId === yoId;
    const cont = document.createElement('div');
    cont.className = `burbuja ${esMia ? 'mia' : 'suya'}`;
    cont.dataset.id = msg.id;

    if (msg.deletedForAll) {
      cont.innerHTML = `<div style="font-style:italic; opacity:0.7; font-size:12px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:4px;"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>Este mensaje fue eliminado</div>`;
      return cont;
    }

    let html = '';

    if (msg.replyTo) {
      html += `<div class="burbuja-reply-box" style="border-left:3px solid var(--morado-600); padding:3px 6px; margin-bottom:4px; font-size:11.5px; opacity:0.85; background:rgba(0,0,0,0.05); border-radius:4px;">
        <div style="font-weight:700;">${msg.replyTo.senderId === yoId ? 'Tú' : (conversacionAbiertaCon?.name || 'Contacto')}</div>
        <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapar(msg.replyTo.text || (msg.replyTo.imageData ? 'Foto' : msg.replyTo.audioData ? 'Nota de voz' : ''))}</div>
      </div>`;
    }

    let textoAMostrar = msg.text || '';
    if (textoAMostrar.includes('[EMOTION:')) {
      const matchEmotion = textoAMostrar.match(/\[EMOTION:\s*([a-z_]+)\]/i);
      if (matchEmotion) {
        const emocionClase = matchEmotion[1].toLowerCase();
        cont.classList.add(`msg-emocion-${emocionClase}`);
        textoAMostrar = textoAMostrar.replace(/\[EMOTION:\s*[a-z_]+\]/gi, '').trim();
      }
    }

    if (textoAMostrar && textoAMostrar.includes('[INVITACION_CITA:')) {
      const match = textoAMostrar.match(/\[INVITACION_CITA:([a-f0-9\-]+)\]/i);
      const apptId = match ? match[1] : '';
      const textoLimpio = textoAMostrar.replace(/\[INVITACION_CITA:[a-f0-9\-]+\]/gi, '').trim();

      html += `<div class="tarjeta-cita-interactive">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <div>
            <div style="font-weight:800; font-size:13.5px; color:var(--morado-700);">Invitación de Cita / Plan</div>
            <div style="font-size:11px; opacity:0.8;">${msg.senderId === yoId ? 'Enviada por ti' : 'Recibida de ' + (conversacionAbiertaCon?.name || 'Usuario')}</div>
          </div>
        </div>
        <div style="font-size:12.5px; line-height:1.4; margin-bottom:10px;">${formatearUrlsTexto(escapar(textoLimpio))}</div>
        ${!esMia && apptId ? `<div id="acciones_cita_${apptId}" style="display:flex; gap:8px; margin-top:8px;">
          <button class="mini-btn primario" style="flex:1; padding:6px; font-size:11.5px; border-radius:8px;" onclick="Chat.responderCita('${apptId}', 'accept')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:2px;"><polyline points="20 6 9 17 4 12"/></svg>Aceptar</button>
          <button class="mini-btn secundario" style="flex:1; padding:6px; font-size:11.5px; border-radius:8px; color:var(--peligro);" onclick="Chat.responderCita('${apptId}', 'reject')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:2px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Rechazar</button>
        </div>` : ''}
      </div>`;
    } else if (msg.isAiMentionCard || msg.senderId === '00000000-0000-0000-0000-0000000000a1') {
      html += `<div class="cuadro-link-ai-expandible" style="background:linear-gradient(135deg, rgba(139,92,246,0.12), rgba(168,85,247,0.06)); border:1px solid var(--morado-500, #8b5cf6); border-radius:10px; padding:10px; margin-bottom:4px;">
        <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px; border-bottom:1px solid rgba(139,92,246,0.2); padding-bottom:4px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><rect x="4" y="8" width="16" height="12" rx="2"/><line x1="9" y1="13" x2="9.01" y2="13"/><line x1="15" y1="13" x2="15.01" y2="13"/></svg>
          <span style="font-weight:700; font-size:12px; color:var(--morado-600, #7c3aed);">Link AI en el chat</span>
        </div>
        <div style="font-size:12.5px; line-height:1.4;">${formatearUrlsTexto(escapar(textoAMostrar))}</div>
      </div>`;
    } else if (textoAMostrar) {
      html += `<div>${formatearUrlsTexto(escapar(textoAMostrar))}</div>`;
    }

    if (msg.tool_result) {
      const cardHtml = renderizarTarjetaResultadoHerramienta(msg.tool_result);
      if (cardHtml) {
        html += cardHtml;
      }
    }

    if (msg.imageData) {
      if (window.renderizarLivePhotoHTML) {
        html += window.renderizarLivePhotoHTML(msg.imageData, !!msg.isLivePhoto);
      } else {
        html += `<img src="${msg.imageData}" alt="" style="cursor:pointer; max-width:100%; border-radius:8px; margin-top:4px;" onclick="window.abrirVisorImagen('${msg.imageData.replace(/'/g, "\\'")}')">`;
      }
    }

    if (msg.audioData) {
      html += `<div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
        <audio controls src="${msg.audioData}" style="max-width:180px; height:36px;"></audio>
        <div class="mini-btn secundario" style="padding:4px 7px; font-size:11px; cursor:pointer;" onclick="Chat.alternarVelocidadAudio(this)">1x</div>
      </div>`;
    }

    // Reacciones
    const reacKeys = msg.reactions ? Object.keys(msg.reactions) : [];
    if (reacKeys.length) {
      const emojiCounts = {};
      reacKeys.forEach((uid) => {
        const em = msg.reactions[uid];
        emojiCounts[em] = (emojiCounts[em] || 0) + 1;
      });
      const reacStr = Object.entries(emojiCounts).map(([em, cnt]) => `${em}${cnt > 1 ? cnt : ''}`).join(' ');
      html += `<div class="burbuja-reacciones" style="position:absolute; bottom:-10px; right:8px; background:var(--fondo-tarjeta); border:1px solid var(--borde); border-radius:10px; padding:1px 5px; font-size:11px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">${reacStr}</div>`;
    }

    // Vistos y Hora
    let checkHtml = '';
    if (esMia) {
      if (msg.read) {
        checkHtml = `<span style="color:#60a5fa; font-size:12px; margin-left:4px; display:inline-flex; align-items:center;" title="Leído (${horaCorta(msg.readAt)})"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 6 9 17 4 12"/><polyline points="22 10 13 21 10 18"/></svg></span>`;
      } else if (msg.delivered) {
        checkHtml = `<span style="color:var(--texto-500); font-size:12px; margin-left:4px; display:inline-flex; align-items:center;" title="Entregado"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 6 9 17 4 12"/><polyline points="22 10 13 21 10 18"/></svg></span>`;
      } else {
        checkHtml = `<span style="color:var(--texto-500); font-size:12px; margin-left:4px; display:inline-flex; align-items:center;" title="Enviado"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></span>`;
      }
    }

    html += `<div style="display:flex; justify-content:flex-end; align-items:center; font-size:10px; opacity:0.75; margin-top:3px;">
      <span>${horaCorta(msg.createdAt)}</span>${checkHtml}
    </div>`;

    cont.innerHTML = html;

    cont.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      abrirMenuMensaje(msg);
    });

    return cont;
  }

  function abrirMenuMensaje(msg) {
    mensajeSeleccionado = msg;
    const yo = Sesion.usuario();
    $('opMsgEliminar').classList.toggle('oculto', msg.senderId !== yo.id);
    $('veloMensajeOp').classList.add('activo');
    $('hojaMensajeOp').classList.add('activo');
  }
  function cerrarMenuMensaje() {
    $('veloMensajeOp').classList.remove('activo');
    $('hojaMensajeOp').classList.remove('activo');
  }

  function escapar(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  async function abrirConversacion(persona) {
    if (persona.id === 'link_ai' || persona.id === '00000000-0000-0000-0000-0000000000a1' || persona.is_ai) {
      persona = {
        ...persona,
        id: '00000000-0000-0000-0000-0000000000a1',
        name: persona.name || 'Link AI',
        is_ai: true
      };
    }
    conversacionAbiertaCon = persona;
    $('chatAvatar').src = persona.avatar_data || iconoDefecto();
    $('chatNombre').textContent = persona.name;

    if (persona.is_ai) {
      $('chatEstadoLinea').textContent = 'Asistente de IA';
    } else {
      $('chatEstadoLinea').textContent = persona.is_online ? 'En línea' : formatearUltimaVez(persona.last_seen);
    }

    $('vistaChat').classList.add('activo');

    const yo = Sesion.usuario();
    const cacheKey = conversationId(yo.id, persona.id);

    cancelarRespuesta();

    const cachedMsgs = await LocalStore.obtenerLista('mensajes', cacheKey);
    if (cachedMsgs && cachedMsgs.length) {
      $('chatMensajes').innerHTML = '';
      cachedMsgs.forEach((m) => $('chatMensajes').appendChild(pintarBurbuja(m, yo.id)));
      $('chatMensajes').scrollTop = $('chatMensajes').scrollHeight;
    } else {
      $('chatMensajes').innerHTML = '<div class="aviso-vacio">Cargando conversación…</div>';
    }

    try {
      const { mensajes } = await api(`/mensajes/${persona.id}`);
      $('chatMensajes').innerHTML = '';
      if (!mensajes.length) {
        if (persona.is_ai) {
          $('chatMensajes').innerHTML = `
            <div class="burbuja suya" style="max-width:85%;">
              <div>¡Hola! Soy <b>Link AI</b>. ¿En qué te puedo ayudar hoy?</div>
              <div style="font-size:10px; opacity:0.7; margin-top:4px;">Justo ahora</div>
            </div>
          `;
        } else {
          $('chatMensajes').innerHTML = '<div class="aviso-vacio">Todavía no tienen mensajes. ¡Saluda!</div>';
        }
      } else {
        mensajes.forEach((m) => $('chatMensajes').appendChild(pintarBurbuja(m, yo.id)));
        $('chatMensajes').scrollTop = $('chatMensajes').scrollHeight;

        if (!persona.is_ai) {
          const unreadIds = mensajes.filter(m => m.receiverId === yo.id && !m.read).map(m => m.id);
          if (unreadIds.length && window.socket) {
            window.socket.emit('mensaje:leido', { messageIds: unreadIds, senderId: persona.id });
          }
        }
      }
      LocalStore.guardarLista('mensajes', cacheKey, mensajes);
    } catch (e) {
      if (!cachedMsgs || !cachedMsgs.length) {
        $('chatMensajes').innerHTML = `<div class="aviso-vacio">${e.message} (Modo sin conexión)</div>`;
      }
    }
  }

  function cerrarConversacion() {
    conversacionAbiertaCon = null;
    $('vistaChat').classList.remove('activo');
  }

  function iconoDefecto() {
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#efe3fe"/></svg>`
    );
  }

  function solicitarUbicacionYEnviar(texto, imagenBase64, audioBase64, audioDur) {
    const lowerTxt = (texto || '').toLowerCase();
    const pideUbicacion = lowerTxt.includes('clima') || lowerTxt.includes('tiempo') || lowerTxt.includes('temperatura') || lowerTxt.includes('dónde estoy') || lowerTxt.includes('donde estoy') || lowerTxt.includes('mi ubicación') || lowerTxt.includes('mi ubicacion') || lowerTxt.includes('mi posicion') || lowerTxt.includes('mi posición');

    if (pideUbicacion && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const textoConUbicacion = `${texto} [Ubicación GPS: Lat ${lat.toFixed(4)}, Lon ${lon.toFixed(4)}]`;
          enviarMensaje(textoConUbicacion, imagenBase64, audioBase64, audioDur);
        },
        (err) => {
          console.warn('[Geolocalización Web] Permiso denegado o no disponible:', err.message);
          enviarMensaje(texto, imagenBase64, audioBase64, audioDur);
        },
        { timeout: 6000, enableHighAccuracy: false }
      );
      return;
    }

    enviarMensaje(texto, imagenBase64, audioBase64, audioDur);
  }

  function enviarMensaje(texto, imagenBase64, audioBase64, audioDur) {
    if (!conversacionAbiertaCon) return;
    if (!texto && !imagenBase64 && !audioBase64) return;

    if (conversacionAbiertaCon.is_ai) {
      const msgUser = {
        id: 'ai_user_' + Date.now(),
        senderId: Sesion.usuario().id,
        text: texto || '',
        createdAt: new Date().toISOString(),
      };
      $('chatMensajes').appendChild(pintarBurbuja(msgUser, Sesion.usuario().id));
      $('chatMensajes').scrollTop = $('chatMensajes').scrollHeight;

      // Crear frase cortés dinámica según contexto de la pregunta
      const frasesGenerales = ["Espere un momento...", "Enseguida...", "Un segundo...", "Procesando respuesta..."];
      const frasesClima = ["Consultando el cielo y el tiempo...", "Un segundo, revisando el clima...", "Verificando el pronóstico..."];
      const frasesPersonas = ["Explorando perfiles...", "Buscando en la red...", "Un instante, localizando usuarios..."];

      const lowerTxt = (texto || '').toLowerCase();
      let listaFrases = frasesGenerales;
      if (lowerTxt.includes('clima') || lowerTxt.includes('tiempo') || lowerTxt.includes('temperatura')) listaFrases = frasesClima;
      else if (lowerTxt.includes('persona') || lowerTxt.includes('perfil') || lowerTxt.includes('usuario') || lowerTxt.includes('chat')) listaFrases = frasesPersonas;

      const fraseEscogida = listaFrases[Math.floor(Math.random() * listaFrases.length)];

      const loadingId = 'ai_loading_' + Date.now();
      const loadingEl = document.createElement('div');
      loadingEl.className = 'burbuja suya';
      loadingEl.id = loadingId;
      loadingEl.innerHTML = `
        <div class="burbuja-loading-ai">
          <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:4px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${fraseEscogida}</span>
          <div class="burbuja-loading-dots"><span></span><span></span><span></span></div>
        </div>
      `;
      $('chatMensajes').appendChild(loadingEl);
      $('chatMensajes').scrollTop = $('chatMensajes').scrollHeight;

      api('/ai/chat', { method: 'POST', body: { prompt: texto || (imagenBase64 ? 'edita esta foto' : ''), image_base64: imagenBase64 || null } })
        .then((res) => {
          const elWait = document.getElementById(loadingId);
          if (elWait) elWait.remove();

          const aiReplyText = res.reply || res.message || (res.error && res.error.message) || 'No se pudo obtener respuesta de la IA.';
          const msgAi = res.ai_message || {
            id: 'ai_bot_' + Date.now(),
            senderId: '00000000-0000-0000-0000-0000000000a1',
            text: aiReplyText,
            createdAt: new Date().toISOString(),
          };
          const burbujaEl = pintarBurbuja(msgAi, Sesion.usuario().id);
          if (res.tool_result) {
            const cardHtml = renderizarTarjetaResultadoHerramienta(res.tool_result);
            if (cardHtml) {
              burbujaEl.insertAdjacentHTML('beforeend', cardHtml);
            }
          }
          $('chatMensajes').appendChild(burbujaEl);
          $('chatMensajes').scrollTop = $('chatMensajes').scrollHeight;
          if (typeof cargarConversaciones === 'function') cargarConversaciones();
        })
        .catch((err) => {
          const elWait = document.getElementById(loadingId);
          if (elWait) elWait.remove();

          const errText = err.message || 'Error al comunicarse con la IA.';
          const retryMsgId = 'ai_bot_err_' + Date.now();
          const msgError = {
            id: retryMsgId,
            senderId: '00000000-0000-0000-0000-0000000000a1',
            text: `⚠️ ${errText}`,
            createdAt: new Date().toISOString(),
          };

          const burbujaErr = pintarBurbuja(msgError, Sesion.usuario().id);
          const retryBtnHtml = `
            <div style="margin-top:6px; font-size:11px; color:#ef4444; font-weight:700; cursor:pointer; text-decoration:underline; display:inline-flex; align-items:center; gap:4px;" class="btn-reintentar-mensaje-ai">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              Toca aquí para reintentar
            </div>
          `;
          burbujaErr.insertAdjacentHTML('beforeend', retryBtnHtml);

          const btnRetry = burbujaErr.querySelector('.btn-reintentar-mensaje-ai');
          if (btnRetry) {
            btnRetry.addEventListener('click', () => {
              burbujaErr.remove();
              enviarMensaje(texto, imagenBase64);
            });
          }

          $('chatMensajes').appendChild(burbujaErr);
          $('chatMensajes').scrollTop = $('chatMensajes').scrollHeight;
          mostrarToast(errText);
        });

      cancelarRespuesta();
      return;
    }

    window.socket.emit('mensaje:enviar', {
      receiverId: conversacionAbiertaCon.id,
      text: texto || '',
      imageData: imagenBase64 || null,
      audioData: audioBase64 || null,
      audioDuration: audioDur || 0,
      replyToId: mensajeRespondiendo ? mensajeRespondiendo.id : null,
    }, async (respuesta) => {
      if (!respuesta.ok) { mostrarToast(respuesta.error || 'No se pudo enviar.'); return; }
      const yo = Sesion.usuario();
      $('chatMensajes').appendChild(pintarBurbuja(respuesta.mensaje, yo.id));
      $('chatMensajes').scrollTop = $('chatMensajes').scrollHeight;

      cancelarRespuesta();

      const cacheKey = conversationId(yo.id, conversacionAbiertaCon.id);
      const prev = (await LocalStore.obtenerLista('mensajes', cacheKey)) || [];
      LocalStore.guardarLista('mensajes', cacheKey, [...prev, respuesta.mensaje]);
    });
  }

  function cancelarRespuesta() {
    mensajeRespondiendo = null;
    $('chatReplyPreview').classList.add('oculto');
  }

  function iniciarRespuesta(msg) {
    mensajeRespondiendo = msg;
    const yo = Sesion.usuario();
    $('chatReplyNombre').textContent = `Respondiendo a ${msg.senderId === yo.id ? 'ti mismo' : conversacionAbiertaCon.name}`;
    $('chatReplyTexto').textContent = msg.text || (msg.imageData ? 'Foto' : msg.audioData ? 'Nota de voz' : '');
    $('chatReplyPreview').classList.remove('oculto');
    $('chatInputTexto').focus();
  }

  async function onMensajeEntrante(msg) {
    const yo = Sesion.usuario();
    if (conversacionAbiertaCon && conversationId(yo.id, conversacionAbiertaCon.id) === msg.conversationId) {
      $('chatMensajes').appendChild(pintarBurbuja(msg, yo.id));
      $('chatMensajes').scrollTop = $('chatMensajes').scrollHeight;

      if (window.socket) {
        window.socket.emit('mensaje:leido', { messageIds: [msg.id], senderId: msg.senderId });
      }
    } else {
      const senderAvatar = msg.senderAvatar || iconoDefecto();
      const senderName = msg.senderName || 'Mensaje';
      mostrarToast(`<div style="display:flex; align-items:center; gap:8px;">
        <img src="${senderAvatar}" style="width:24px; height:24px; border-radius:50%; object-fit:cover;">
        <span><b>${escapar(senderName)}:</b> ${escapar((msg.text || 'Nuevo mensaje').slice(0, 40))}</span>
      </div>`);
      if (window.SonidosYVibracion) {
        window.SonidosYVibracion.reproducirMensaje();
      }
      actualizarBadgeMensajes(true);
    }

    if (msg.conversationId) {
      const prev = (await LocalStore.obtenerLista('mensajes', msg.conversationId)) || [];
      LocalStore.guardarLista('mensajes', msg.conversationId, [...prev, msg]);
    }
    if (typeof cargarConversaciones === 'function') cargarConversaciones();
  }

  function actualizarBadgeMensajes(incrementar) {
    const badge = $('badgeMensajes');
    const actual = parseInt(badge.textContent) || 0;
    const nuevo = incrementar ? actual + 1 : 0;
    badge.textContent = nuevo;
    badge.classList.toggle('activa', nuevo > 0);
  }

  // ---- NOTAS DE VOZ ----
  async function iniciarGrabacionVoz() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
      mediaRecorder.start();
      tiempoGrabacionSeg = 0;
      $('chatGrabacionTiempo').textContent = '00:00';
      $('chatGrabacionBar').classList.remove('oculto');
      temporizadorGrabacion = setInterval(() => {
        tiempoGrabacionSeg++;
        $('chatGrabacionTiempo').textContent = formatoTiempo(tiempoGrabacionSeg);
      }, 1000);
    } catch (err) {
      mostrarToast('No se pudo acceder al micrófono.');
    }
  }

  function detenerGrabacionVoz(enviar) {
    if (!mediaRecorder) return;
    clearInterval(temporizadorGrabacion);
    mediaRecorder.onstop = () => {
      if (enviar && audioChunks.length) {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          enviarMensaje('', null, reader.result, tiempoGrabacionSeg);
        };
      }
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
      mediaRecorder = null;
    };
    mediaRecorder.stop();
    $('chatGrabacionBar').classList.add('oculto');
  }

  function buscarMensajesEnChat(query) {
    const q = query.toLowerCase();
    const burbujas = $('chatMensajes').querySelectorAll('.burbuja');
    burbujas.forEach((b) => {
      const texto = b.textContent.toLowerCase();
      b.style.display = texto.includes(q) ? '' : 'none';
    });
  }

  async function abrirGaleriaChat() {
    if (!conversacionAbiertaCon) return;
    const yo = Sesion.usuario();
    const cacheKey = conversationId(yo.id, conversacionAbiertaCon.id);
    const msgs = (await LocalStore.obtenerLista('mensajes', cacheKey)) || [];
    const fotos = msgs.filter(m => m.imageData);
    const grid = $('gridGaleriaChat');
    grid.innerHTML = fotos.length ? fotos.map(f => `
      <img src="${f.imageData}" style="width:100%; height:80px; object-fit:cover; border-radius:8px; cursor:pointer;" onclick="window.abrirVisorImagen('${f.imageData.replace(/'/g, "\\'")}')">
    `).join('') : '<div style="grid-column:1/-1; color:var(--texto-500); text-align:center;">No hay fotos compartidas.</div>';
    $('veloGaleria').classList.add('activo');
    $('hojaGaleria').classList.add('activo');
  }

  async function exportarConversacionTxt() {
    if (!conversacionAbiertaCon) return;
    const yo = Sesion.usuario();
    const cacheKey = conversationId(yo.id, conversacionAbiertaCon.id);
    const msgs = (await LocalStore.obtenerLista('mensajes', cacheKey)) || [];
    if (!msgs.length) return mostrarToast('No hay historial para exportar.');

    const contenido = msgs.map(m => {
      const remitente = m.senderId === yo.id ? yo.name : conversacionAbiertaCon.name;
      const fecha = new Date(m.createdAt).toLocaleString('es');
      const txt = m.text || (m.imageData ? '[Foto]' : m.audioData ? '[Audio]' : '');
      return `[${fecha}] ${remitente}: ${txt}`;
    }).join('\n');

    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_${conversacionAbiertaCon.name.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    mostrarToast('Historial exportado');
  }

  function enviarRespuestaDirectaEnChatCard(targetId, cardId) {
    const input = document.getElementById(`input_reply_${targetId}_${cardId}`);
    if (!input) return;
    const txt = input.value.trim();
    if (!txt) return mostrarToast('Escribe un mensaje para responder.');

    if (window.socket) {
      window.socket.emit('mensaje:enviar', { receiverId: targetId, text: txt }, (res) => {
        if (res && res.ok) {
          input.value = '';
          const replyBox = document.getElementById(`reply_box_${cardId}`);
          if (replyBox) {
            replyBox.innerHTML = `<div style="font-size:11.5px; font-weight:700; color:#10b981;">Respuesta enviada ✓</div>`;
          }
          mostrarToast('Mensaje enviado al chat privado');
        } else {
          mostrarToast(res?.error || 'No se pudo enviar.');
        }
      });
    } else {
      mostrarToast('Conexión no disponible.');
    }
  }

  function enviarSolicitudAmistadDirecta(targetId, targetName) {
    api(`/amigos/${targetId}/solicitar`, { method: 'POST' })
      .then(res => {
        mostrarToast(`Solicitud de amistad enviada a ${targetName}`);
      })
      .catch(err => {
        mostrarToast(err.message || 'No se pudo enviar la solicitud.');
      });
  }

  function enlazarUI() {
    $('chatVolver').addEventListener('click', cerrarConversacion);
    $('chatCerrarReply')?.addEventListener('click', cancelarRespuesta);

    $('chatBtnEnviar').addEventListener('click', () => {
      const input = $('chatInputTexto');
      const texto = input.value.trim();
      if (!texto) return;
      solicitarUbicacionYEnviar(texto, null, null, 0);
      input.value = '';
      if (window.socket && conversacionAbiertaCon) {
        window.socket.emit('mensaje:detener_escribiendo', { receiverId: conversacionAbiertaCon.id });
      }
    });

    $('chatInputTexto').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('chatBtnEnviar').click();
    });

    $('chatInputTexto').addEventListener('input', () => {
      if (!window.socket || !conversacionAbiertaCon) return;
      window.socket.emit('mensaje:escribiendo', { receiverId: conversacionAbiertaCon.id });
      clearTimeout(temporizadorEscribiendo);
      temporizadorEscribiendo = setTimeout(() => {
        window.socket.emit('mensaje:detener_escribiendo', { receiverId: conversacionAbiertaCon.id });
      }, 2000);
    });

    $('chatImagenInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const base64 = await archivoABase64(file, 1000, 0.7);
        enviarMensaje('', base64, null, 0);
      } catch (err) { mostrarToast('No se pudo procesar la imagen.'); }
      e.target.value = '';
    });

    $('chatLivePhotoInput')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const base64 = await archivoABase64(file, 1000, 0.7);
        window.socket.emit('mensaje:enviar', {
          receiverId: conversacionAbiertaCon.id,
          text: '',
          imageData: base64,
          isLivePhoto: true,
        }, (respuesta) => {
          if (respuesta && respuesta.ok) {
            const yo = Sesion.usuario();
            $('chatMensajes').appendChild(pintarBurbuja(respuesta.mensaje, yo.id));
            $('chatMensajes').scrollTop = $('chatMensajes').scrollHeight;
          }
        });
      } catch (err) { mostrarToast('No se pudo procesar la Foto Live.'); }
      e.target.value = '';
    });

    $('chatBtnGravaVoz')?.addEventListener('click', iniciarGrabacionVoz);
    $('chatBtnCancelarVoz')?.addEventListener('click', () => detenerGrabacionVoz(false));
    $('chatBtnEnviarVoz')?.addEventListener('click', () => detenerGrabacionVoz(true));

    $('chatBtnBuscarMsg')?.addEventListener('click', () => {
      $('chatBusquedaBar').classList.toggle('oculto');
      $('inputBuscarMsgChat').value = '';
      buscarMensajesEnChat('');
    });
    $('cerrarBuscarMsgChat')?.addEventListener('click', () => {
      $('chatBusquedaBar').classList.add('oculto');
      $('inputBuscarMsgChat').value = '';
      buscarMensajesEnChat('');
    });
    $('inputBuscarMsgChat')?.addEventListener('input', (e) => buscarMensajesEnChat(e.target.value));
    $('chatBtnGaleria')?.addEventListener('click', abrirGaleriaChat);
    $('cerrarGaleria')?.addEventListener('click', () => {
      $('veloGaleria').classList.remove('activo');
      $('hojaGaleria').classList.remove('activo');
    });
    $('chatBtnExportar')?.addEventListener('click', exportarConversacionTxt);

    $('cerrarMensajeOp')?.addEventListener('click', cerrarMenuMensaje);
    $('opMsgFijar')?.addEventListener('click', async () => {
      cerrarMenuMensaje();
      if (mensajeSeleccionado) {
        try {
          const res = await api(`/mensajes/fijar/${mensajeSeleccionado.id}`, { method: 'POST' });
          mostrarToast(res.fijado ? 'Mensaje fijado' : 'Mensaje desfijado');
        } catch (e) { mostrarToast(e.message); }
      }
    });
    $('veloMensajeOp')?.addEventListener('click', cerrarMenuMensaje);
    $('opMsgResponder')?.addEventListener('click', () => {
      cerrarMenuMensaje();
      if (mensajeSeleccionado) iniciarRespuesta(mensajeSeleccionado);
    });
    $('opMsgCopiar')?.addEventListener('click', () => {
      cerrarMenuMensaje();
      if (mensajeSeleccionado && mensajeSeleccionado.text) {
        navigator.clipboard.writeText(mensajeSeleccionado.text);
        mostrarToast('Texto copiado al portapapeles');
      }
    });
    $('opMsgEliminar')?.addEventListener('click', () => {
      cerrarMenuMensaje();
      if (mensajeSeleccionado && window.socket && conversacionAbiertaCon) {
        window.socket.emit('mensaje:eliminar', { messageId: mensajeSeleccionado.id, receiverId: conversacionAbiertaCon.id }, (res) => {
          if (res.ok) mostrarToast('Mensaje eliminado');
        });
      }
    });

    document.querySelectorAll('#pickerReaccionesEmoji [data-emoji]').forEach((el) => {
      el.addEventListener('click', () => {
        const emoji = el.dataset.emoji;
        cerrarMenuMensaje();
        if (mensajeSeleccionado && window.socket && conversacionAbiertaCon) {
          window.socket.emit('mensaje:reaccionar', { messageId: mensajeSeleccionado.id, receiverId: conversacionAbiertaCon.id, emoji }, (res) => {
            if (res.ok) mostrarToast(`Reaccionaste con ${emoji}`);
          });
        }
      });
    });

    const abrirMenuAdjuntos = () => {
      $('veloChatAdjuntos')?.classList.add('activo');
      $('hojaChatAdjuntos')?.classList.add('activo');
    };
    const cerrarMenuAdjuntos = () => {
      $('veloChatAdjuntos')?.classList.remove('activo');
      $('hojaChatAdjuntos')?.classList.remove('activo');
    };

    $('chatBtnAdjuntarFotoDirecto')?.addEventListener('click', () => {
      $('chatImagenInput')?.click();
    });
    $('chatBtnMasOpciones')?.addEventListener('click', abrirMenuAdjuntos);
    $('cerrarChatAdjuntos')?.addEventListener('click', cerrarMenuAdjuntos);
    $('veloChatAdjuntos')?.addEventListener('click', cerrarMenuAdjuntos);

    $('opChatFoto')?.addEventListener('click', () => {
      cerrarMenuAdjuntos();
      $('chatImagenInput')?.click();
    });
    $('opChatLivePhoto')?.addEventListener('click', () => {
      cerrarMenuAdjuntos();
      $('chatLivePhotoInput')?.click();
    });
    $('opChatVoz')?.addEventListener('click', () => {
      cerrarMenuAdjuntos();
      iniciarGrabacionVoz();
    });
    $('opChatBuscar')?.addEventListener('click', () => {
      cerrarMenuAdjuntos();
      $('chatBusquedaBar')?.classList.remove('oculto');
      $('inputBuscarMsgChat')?.focus();
    });
    $('opChatGaleria')?.addEventListener('click', () => {
      cerrarMenuAdjuntos();
      abrirGaleriaChat();
    });
    $('opChatExportar')?.addEventListener('click', () => {
      cerrarMenuAdjuntos();
      exportarConversacionTxt();
    });

    $('chatBtnAudio')?.addEventListener('click', () => {
      if (conversacionAbiertaCon) Llamada.iniciar(conversacionAbiertaCon, 'audio');
    });
    $('chatBtnVideo')?.addEventListener('click', () => {
      if (conversacionAbiertaCon) Llamada.iniciar(conversacionAbiertaCon, 'video');
    });
    $('chatBtnAudioInput')?.addEventListener('click', () => {
      if (conversacionAbiertaCon) Llamada.iniciar(conversacionAbiertaCon, 'audio');
    });
    $('chatBtnVideoInput')?.addEventListener('click', () => {
      if (conversacionAbiertaCon) Llamada.iniciar(conversacionAbiertaCon, 'video');
    });

    // Eventos del Panel de Herramientas e Inicio Directo
    $('chatBtnHerramientas')?.addEventListener('click', abrirPanelHerramientas);
    $('cerrarPanelHerramientas')?.addEventListener('click', cerrarPanelHerramientas);
    $('veloHerramientas')?.addEventListener('click', cerrarPanelHerramientas);
    $('cerrarDetalleHerramienta')?.addEventListener('click', cerrarHojaDetalleHerramienta);
    $('btnCancelarDetailTool')?.addEventListener('click', cerrarHojaDetalleHerramienta);

    $('btnIniciarTool')?.addEventListener('click', () => {
      if (!herramientaSeleccionada) return;
      const extraParams = {};
      (herramientaSeleccionada.inputs || []).forEach(inp => {
        const val = document.getElementById(`input_tool_param_${inp}`)?.value;
        if (val !== undefined && val !== null) {
          extraParams[inp] = val.trim();
        }
      });
      iniciarHerramientaDirecto(herramientaSeleccionada, extraParams);
    });
  }

  // ---------------- NUEVO SISTEMA DE HERRAMIENTAS INDEPENDIENTE ----------------
  let listaHerramientasGlobal = [];
  let listaCategoriasGlobal = [];
  let herramientaSeleccionada = null;
  let categoriaFiltroActual = 'todas';
  let tapTimersMap = {};

  async function abrirPanelHerramientas() {
    $('veloHerramientas')?.classList.add('activo');
    $('panelHerramientas')?.classList.add('activo');
    await cargarHerramientasPanel();
  }

  function cerrarPanelHerramientas() {
    $('veloHerramientas')?.classList.remove('activo');
    $('panelHerramientas')?.classList.remove('activo');
  }

  function cerrarHojaDetalleHerramienta() {
    $('hojaDetalleHerramienta')?.classList.remove('activo');
    herramientaSeleccionada = null;
  }

  function obtenerIconoToolSVG(toolId = '', categoryId = '', fallbackIcon = '') {
    const id = (toolId || '').toLowerCase();
    const cat = (categoryId || '').toLowerCase();

    // Categorías y Chips
    if (id === 'cat_todas' || cat === 'todas') {
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 6.8 7.2.4-5.4 4.8 1.8 7-6-3.8-6 3.8 1.8-7-5.4-4.8 7.2-.4z"/></svg>`;
    }
    if (id === 'cat_conexiones' || cat === 'conexiones') {
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`;
    }
    if (id === 'cat_multimedia' || cat === 'multimedia') {
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>`;
    }
    if (id === 'cat_juegos' || cat === 'juegos' || id.startsWith('game_') || id.includes('game.')) {
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="15" cy="13" r="1"/><circle cx="18" cy="11" r="1"/><rect x="2" y="6" width="20" height="12" rx="6"/></svg>`;
    }

    // Herramientas Específicas
    if (id.includes('weather')) {
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;
    }
    if (id.includes('wikipedia')) {
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`;
    }
    if (id.includes('github')) {
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>`;
    }
    if (id.includes('convert') || id.includes('currency') || id.includes('frankfurter')) {
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;
    }
    if (id.includes('coingecko') || id.includes('crypto')) {
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M15 9.5H9.5a2.5 2.5 0 0 0 0 5H15"/></svg>`;
    }
    if (id.includes('osm') || id.includes('map')) {
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
    }
    if (id.includes('appointment') || id.includes('cita')) {
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
    }
    if (id.includes('reminder') || id.includes('recordatorio')) {
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    }
    if (id.includes('profile') || id.includes('user')) {
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    }
    if (id.includes('translate')) {
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
    }
    if (id.includes('math') || id.includes('calculat')) {
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><line x1="8" y1="12" x2="8" y2="12.01"/><line x1="12" y1="12" x2="12" y2="12.01"/><line x1="16" y1="12" x2="16" y2="12.01"/><line x1="8" y1="16" x2="8" y2="16.01"/><line x1="12" y1="16" x2="12" y2="16.01"/></svg>`;
    }
    if (id.includes('payment') || id.includes('qvapay')) {
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`;
    }

    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>`;
  }

  async function cargarHerramientasPanel() {
    const grid = $('panelGridHerramientas');
    const catContainer = $('panelCategoriasHerramientas');
    if (!grid) return;

    try {
      if (listaHerramientasGlobal.length === 0) {
        const [toolsRes, catRes] = await Promise.all([
          api('/tools'),
          api('/tools/categories')
        ]);
        listaHerramientasGlobal = toolsRes.tools || [];
        listaCategoriasGlobal = catRes.categories || [];
      }

      // Renderizar chips de categorías
      if (catContainer) {
        let catHtml = `<div class="cat-chip ${categoriaFiltroActual === 'todas' ? 'activo' : ''}" data-cat="todas" style="display:inline-flex; align-items:center; gap:6px;">${obtenerIconoToolSVG('cat_todas')} Todas</div>`;
        listaCategoriasGlobal.forEach(c => {
          catHtml += `<div class="cat-chip ${categoriaFiltroActual === c.id ? 'activo' : ''}" data-cat="${c.id}" style="display:inline-flex; align-items:center; gap:6px;">${obtenerIconoToolSVG('cat_' + c.id, c.id)} ${c.name}</div>`;
        });
        catContainer.innerHTML = catHtml;

        catContainer.querySelectorAll('.cat-chip').forEach(chip => {
          chip.addEventListener('click', () => {
            catContainer.querySelectorAll('.cat-chip').forEach(ch => ch.classList.remove('activo'));
            chip.classList.add('activo');
            categoriaFiltroActual = chip.dataset.cat;
            renderizarGridHerramientas();
          });
        });
      }

      renderizarGridHerramientas();
    } catch (e) {
      grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--peligro);">${e.message || 'Error al cargar herramientas.'}</div>`;
    }
  }

  function renderizarGridHerramientas() {
    const grid = $('panelGridHerramientas');
    if (!grid) return;

    const filtradas = categoriaFiltroActual === 'todas'
      ? listaHerramientasGlobal
      : listaHerramientasGlobal.filter(t => t.category === categoriaFiltroActual);

    if (filtradas.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--texto-500);">No hay elementos en esta categoría.</div>`;
      return;
    }

    grid.innerHTML = filtradas.map(t => {
      const svgIcon = obtenerIconoToolSVG(t.id || t.tool, t.category, t.icon);
      return `
        <div class="tool-card-square anim-pulse" id="card_tool_${t.id}" data-id="${t.id}">
          <div class="tool-status-badge"></div>
          <div class="tool-icon">${svgIcon}</div>
          <div class="tool-name">${meEscapar(t.name)}</div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.tool-card-square').forEach(card => {
      const toolId = card.dataset.id;
      const toolObj = listaHerramientasGlobal.find(t => t.id === toolId);

      card.addEventListener('click', (e) => {
        if (tapTimersMap[toolId]) {
          // Doble Toque
          clearTimeout(tapTimersMap[toolId]);
          delete tapTimersMap[toolId];
          if (toolObj && toolObj.supportsDoubleTap) {
            iniciarHerramientaDirecto(toolObj, {});
          } else {
            mostrarDetalleHerramienta(toolObj);
          }
        } else {
          // Toque simple con retardo para detectar doble toque
          tapTimersMap[toolId] = setTimeout(() => {
            delete tapTimersMap[toolId];
            mostrarDetalleHerramienta(toolObj);
          }, 250);
        }
      });
    });
  }

  function mostrarDetalleHerramienta(tool) {
    if (!tool) return;
    herramientaSeleccionada = tool;

    const svgIcon = obtenerIconoToolSVG(tool.id || tool.tool, tool.category, tool.icon);
    if ($('toolDetailIcon')) $('toolDetailIcon').innerHTML = svgIcon;
    if ($('toolDetailName')) $('toolDetailName').textContent = tool.name;
    if ($('toolDetailCategory')) $('toolDetailCategory').textContent = tool.category_name || tool.category || 'Herramienta';
    if ($('toolDetailDesc')) $('toolDetailDesc').textContent = tool.description || 'Herramienta interactiva de Link.';

    const inputsContainer = $('toolInputsContainer');
    if (inputsContainer) {
      if (tool.inputs && tool.inputs.length > 0) {
        inputsContainer.innerHTML = tool.inputs.map(inp => `
          <div class="campo" style="margin-bottom:10px;">
            <label style="font-size:12px; font-weight:700; color:var(--texto-800); text-transform:capitalize;">${inp}</label>
            <input type="text" id="input_tool_param_${inp}" value="${meEscapar(tool.params?.[inp] || '')}" placeholder="Ingresa ${inp}..." style="width:100%; padding:8px 12px; border:1px solid var(--borde); border-radius:10px; font-size:13px;">
          </div>
        `).join('');
      } else {
        inputsContainer.innerHTML = `<div style="font-size:12px; color:var(--texto-500); font-style:italic;">No requiere parámetros adicionales.</div>`;
      }
    }

    $('hojaDetalleHerramienta')?.classList.add('activo');
  }

  async function iniciarHerramientaDirecto(tool, extraParams = {}) {
    if (!tool) return;

    // Manejo especial de ubicación para Clima
    const toolKey = tool.tool || tool.id;
    if (toolKey === 'weather.get') {
      let loc = extraParams.location || tool.params?.location || 'auto';
      if (!loc || loc === 'auto') {
        let coords = null;
        if (navigator.geolocation) {
          mostrarToast('📍 Obteniendo ubicación GPS...');
          try {
            const pos = await new Promise((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, enableHighAccuracy: true });
            });
            coords = `Lat ${pos.coords.latitude.toFixed(4)}, Lon ${pos.coords.longitude.toFixed(4)}`;
          } catch (geoErr) {
            console.warn('[Geolocation] GPS no disponible o permiso denegado:', geoErr.message);
          }
        }
        if (coords) {
          extraParams.location = coords;
        } else {
          const city = prompt('📍 Permiso de GPS no disponible o denegado. Ingresa el nombre de tu ciudad para consultar el clima:', 'La Habana');
          if (!city || !city.trim()) return;
          extraParams.location = city.trim();
        }
      }
    }

    cerrarHojaDetalleHerramienta();
    cerrarPanelHerramientas();

    const toolCardElem = document.getElementById(`card_tool_${tool.id}`);
    if (toolCardElem) {
      toolCardElem.classList.add('cargando');
    }

    mostrarToast(`🚀 Ejecutando ${tool.name}...`);

    try {
      const finalParams = { ...(tool.params || {}), ...extraParams };
      const res = await api('/tools/execute', {
        method: 'POST',
        body: { tool_id: tool.tool || tool.id, params: finalParams }
      });

      if (toolCardElem) {
        toolCardElem.classList.remove('cargando');
        if (res.success && res.status === 'completed') {
          toolCardElem.classList.add('completado');
        } else {
          toolCardElem.classList.add('error');
        }
      }

      if (res.status === 'waiting_for_input') {
        const userInput = prompt(res.message || 'Por favor ingresa los datos requeridos:');
        if (userInput) {
          const inputKey = res.missing_inputs?.[0] || 'query';
          return await iniciarHerramientaDirecto(tool, { [inputKey]: userInput });
        }
        return;
      }

      if (!res.success || res.status === 'error') {
        mostrarToast(`⚠️ Error en ${tool.name}: ${res.error || 'Fallo de ejecución'}`);
        return;
      }

      // Renderizar tarjeta de resultado de herramienta directamente en el chat
      insertarTarjetaResultadoDirectoChat(tool, res.result);
    } catch (err) {
      if (toolCardElem) {
        toolCardElem.classList.remove('cargando');
        toolCardElem.classList.add('error');
      }
      mostrarToast(`⚠️ Error al ejecutar ${tool.name}: ${err.message}`);
    }
  }

  function insertarTarjetaResultadoDirectoChat(tool, resultData) {
    const chatMsgs = $('chatMensajes');
    if (!chatMsgs) return;

    const cardHtml = renderizarTarjetaResultadoHerramienta(resultData) || `
      <div style="margin-top:8px; padding:12px; background:var(--fondo-tarjeta, #fff); border:1.5px solid var(--morado-500, #8b5cf6); border-radius:14px; max-width:310px; font-size:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-weight:800; color:var(--morado-700); font-size:13px;">${tool.icon || '🛠️'} ${meEscapar(tool.name)}</span>
          <span style="font-size:10px; font-weight:800; color:#10b981; background:rgba(16,185,129,0.1); padding:2px 6px; border-radius:6px;">✓ Completado</span>
        </div>
        <pre style="font-size:11px; white-space:pre-wrap; word-break:break-word; background:var(--hueso); padding:8px; border-radius:8px; margin:0;">${meEscapar(JSON.stringify(resultData, null, 2))}</pre>
      </div>
    `;

    const msgBox = document.createElement('div');
    msgBox.className = 'mensaje entrante';
    msgBox.style.maxWidth = '88%';
    msgBox.innerHTML = `
      <div class="burbuja" style="background:var(--blanco); border:1px solid var(--borde);">
        <div style="font-weight:700; font-size:12px; color:var(--morado-700); margin-bottom:4px;">Herramienta Ejecutada (${tool.name})</div>
        ${cardHtml}
        <div class="meta"><span class="hora">${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span></div>
      </div>
    `;

    chatMsgs.appendChild(msgBox);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
  }

  function enlazarSocket(socket) {
    socket.on('mensaje:nuevo', onMensajeEntrante);
    socket.on('cita:nueva', ({ hostName, appointment }) => {
      mostrarToast(`📅 Nueva invitación de cita/plan recibida de ${hostName}`);
    });
    socket.on('cita:respuesta', ({ appointment, action, status, reject_reason }) => {
      const el = document.getElementById(`acciones_cita_${appointment.id}`);
      if (el) {
        el.innerHTML = `<div style="font-size:11.5px; font-weight:700; color:${action === 'accept' ? '#10b981' : '#ef4444'};">
          ${action === 'accept' ? 'Cita Aceptada ✓' : `Cita Rechazada ${reject_reason ? `(${escapar(reject_reason)})` : ''}`}
        </div>`;
      }
      mostrarToast(action === 'accept' ? '¡Tu invitación de cita fue aceptada! 🎉' : 'La invitación de cita fue rechazada.');
    });
    socket.on('mensaje:escribiendo', ({ de }) => {
      if (conversacionAbiertaCon && conversacionAbiertaCon.id === de) {
        $('chatEstadoEscribiendo').classList.remove('oculto');
      }
    });
    socket.on('mensaje:detener_escribiendo', ({ de }) => {
      if (conversacionAbiertaCon && conversacionAbiertaCon.id === de) {
        $('chatEstadoEscribiendo').classList.add('oculto');
      }
    });
    socket.on('mensaje:leido_confirmacion', ({ messageIds, readAt }) => {
      messageIds.forEach((id) => {
        const burbuja = $('chatMensajes').querySelector(`.burbuja[data-id="${id}"]`);
        if (burbuja) {
          const check = burbuja.querySelector('span[title^="Enviado"], span[title^="Entregado"]');
          if (check) {
            check.style.color = '#60a5fa';
            check.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 6 9 17 4 12"/><polyline points="22 10 13 21 10 18"/></svg>';
            check.title = `Leído (${horaCorta(readAt)})`;
          }
        }
      });
    });
    socket.on('mensaje:reaccion', async ({ messageId, reactions }) => {
      const yo = Sesion.usuario();
      if (conversacionAbiertaCon) {
        const cacheKey = conversationId(yo.id, conversacionAbiertaCon.id);
        const msgs = (await LocalStore.obtenerLista('mensajes', cacheKey)) || [];
        const target = msgs.find(m => m.id === messageId);
        if (target) {
          target.reactions = reactions;
          LocalStore.guardarLista('mensajes', cacheKey, msgs);
          abrirConversacion(conversacionAbiertaCon);
        }
      }
    });
    socket.on('mensaje:eliminado', async ({ messageId }) => {
      const yo = Sesion.usuario();
      if (conversacionAbiertaCon) {
        const cacheKey = conversationId(yo.id, conversacionAbiertaCon.id);
        const msgs = (await LocalStore.obtenerLista('mensajes', cacheKey)) || [];
        const target = msgs.find(m => m.id === messageId);
        if (target) {
          target.deletedForAll = true;
          LocalStore.guardarLista('mensajes', cacheKey, msgs);
          abrirConversacion(conversacionAbiertaCon);
        }
      }
    });
    socket.on('presencia:cambio', ({ userId, online }) => {
      if (conversacionAbiertaCon && conversacionAbiertaCon.id === userId) {
        conversacionAbiertaCon.is_online = online;
        $('chatEstadoLinea').textContent = online ? 'En línea' : 'Desconectado';
      }
    });
  }

  function alternarVelocidadAudio(btn) {
    const parent = btn.parentElement;
    const audio = parent ? parent.querySelector('audio') : null;
    if (!audio) return;
    if (!audio.playbackRate || audio.playbackRate === 1) { audio.playbackRate = 1.5; btn.textContent = '1.5x'; }
    else if (audio.playbackRate === 1.5) { audio.playbackRate = 2; btn.textContent = '2x'; }
    else { audio.playbackRate = 1; btn.textContent = '1x'; }
  }

  function enviarInvitacionCita(guestId, guestName) {
    const targetGuestId = guestId || (conversacionAbiertaCon ? conversacionAbiertaCon.id : null);
    const targetGuestName = guestName || (conversacionAbiertaCon ? conversacionAbiertaCon.name : 'Contacto');
    if (!targetGuestId) return mostrarToast('Abre un chat o selecciona un usuario para agendar cita.');

    const fechaHora = prompt(`Programa la fecha y hora para la cita con ${targetGuestName}:`, 'Mañana a las 5:00 PM');
    if (!fechaHora) return;
    const planes = prompt(`¿Qué planean hacer, plan o compromiso con ${targetGuestName}?`, 'Ir a tomar un café y conversar');
    if (!planes) return;
    const destino = prompt(`¿Destino o lugar propuesto?`, 'Cafetería Central / Lugar acordado') || 'Lugar acordado';

    api('/appointments', {
      method: 'POST',
      body: {
        guest_id: targetGuestId,
        title: `Cita con ${targetGuestName}`,
        description: `Plan: ${planes} | Destino: ${destino}`,
        location: destino,
        scheduled_at: new Date(Date.now() + 86400000).toISOString()
      }
    }).then(res => {
      if (res.success && res.appointment) {
        const appt = res.appointment;
        const citaCardTxt = `[INVITACION_CITA:${appt.id}] Cita/Compromiso: ${planes}\nFecha: ${fechaHora}\nDestino: ${destino}`;
        enviarMensaje(citaCardTxt, null, null, 0);
        mostrarToast('Invitación de cita agendada y enviada');
      }
    }).catch(err => mostrarToast(err.message || 'Error al agendar cita.'));
  }

  function responderCita(apptId, accion) {
    let motivo = null;
    if (accion === 'reject') {
      motivo = prompt('Por favor ingresa el motivo del rechazo:', 'No podré asistir a esa hora');
    }
    api(`/appointments/${apptId}/respond`, {
      method: 'POST',
      body: { action: accion, reject_reason: motivo }
    }).then(res => {
      if (res.success) {
        const contenedor = document.getElementById(`acciones_cita_${apptId}`);
        if (contenedor) {
          contenedor.innerHTML = `<div style="font-size:11.5px; font-weight:700; color:${accion === 'accept' ? '#10b981' : '#ef4444'};">
            ${accion === 'accept' ? 'Cita Aceptada' : `Cita Rechazada ${motivo ? `(${escapar(motivo)})` : ''}`}
          </div>`;
        }
        mostrarToast(accion === 'accept' ? '¡Cita aceptada!' : 'Cita rechazada');
      }
    }).catch(err => mostrarToast(err.message || 'Error al responder.'));
  }

  function alternarPanelUsuario(userId, groupId) {
    const panel = document.getElementById(`user_panel_${userId}_${groupId}`);
    if (panel) {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
  }

  function seleccionarEsteUsuario(userId, groupId) {
    const contenedorGrupo = document.getElementById(`contenedor_grupo_${groupId}`);
    if (!contenedorGrupo) return;
    const items = contenedorGrupo.querySelectorAll('.tarjeta-usuario-item');
    items.forEach(item => {
      if (item.id === `user_card_${userId}_${groupId}`) {
        item.style.border = '2px solid var(--morado-500, #8b5cf6)';
        item.style.background = 'rgba(139, 92, 246, 0.08)';
        const panel = item.querySelector('.panel-usuario-desplegable');
        if (panel) panel.style.display = 'block';
      } else {
        item.remove();
      }
    });
  }

  function cambiarCalidadVideo(iframeId, calidad) {
    const iframe = document.getElementById(iframeId);
    if (!iframe) return;
    try {
      let src = iframe.src;
      if (src.includes('vq=')) {
        src = src.replace(/vq=[^&]+/, 'vq=' + calidad);
      } else {
        src += (src.includes('?') ? '&' : '?') + 'vq=' + calidad;
      }
      iframe.src = src;
    } catch (e) {}
  }

  function abrirConversacionConId(userId, userName) {
    abrirConversacion({ id: userId, name: userName });
  }

  return { abrirConversacion, cerrarConversacion, enlazarUI, enlazarSocket, actualizarBadgeMensajes, alternarVelocidadAudio, alternarPanelUsuario, seleccionarEsteUsuario, abrirConversacionConId, cambiarCalidadVideo, enviarInvitacionCita, responderCita, enviarRespuestaDirectaEnChatCard, enviarSolicitudAmistadDirecta, abrirCategoriaCapabilities, volverACategoriasCapabilities, ejecutarHerramientaDesdeCard, renderCapabilitiesCard };
})();

document.addEventListener('DOMContentLoaded', () => Chat.enlazarUI());

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
          <!-- Barra superior de control de video y calidad -->
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
          <!-- Reproductor de video grande con recorte elegante -->
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
        return `<a href="${url}" target="_blank" class="chip-link-url" onclick="event.stopPropagation()">🔗 ${domain}</a>`;
      } catch (e) {
        return `<a href="${url}" target="_blank" class="chip-link-url" onclick="event.stopPropagation()">${url}</a>`;
      }
    });

    return textoFormateado + ytEmbeds;
  }

  function renderizarTarjetaResultadoHerramienta(toolResult) {
    if (!toolResult || !toolResult.type) return '';
    const t = toolResult.type;
    const data = toolResult.data || {};

    // 1. Tarjeta de Perfil Social / Usuario con animación de pulso y latido
    if (t === 'social_profile_card') {
      const avatarSrc = data.avatar || iconoDefecto();
      const esAdmin = data.is_admin || data.role === 'admin';
      const esVerificado = !!data.verified;

      let badgeAdmin = esAdmin ? `<span style="background:#ef4444; color:#fff; font-size:10px; font-weight:700; padding:2px 6px; border-radius:10px; margin-left:4px;">ADMIN 👑</span>` : '';
      let badgeVerif = esVerificado ? `<span style="color:#3b82f6; font-size:13px; margin-left:2px;" title="Verificado">✓</span>` : '';

      let linksHtml = '';
      if (data.instagram) linksHtml += `<a href="https://instagram.com/${escapar(data.instagram.replace(/^@/,''))}" target="_blank" style="color:#e1306c; text-decoration:none; font-size:12px; font-weight:600; display:inline-flex; align-items:center; gap:4px;"><img src="https://cdn-icons-png.flaticon.com/512/174/174855.png" style="width:14px; height:14px;"> Instagram</a> `;
      if (data.telegram) linksHtml += `<a href="https://t.me/${escapar(data.telegram.replace(/^@/,''))}" target="_blank" style="color:#0088cc; text-decoration:none; font-size:12px; font-weight:600; display:inline-flex; align-items:center; gap:4px;"><img src="https://cdn-icons-png.flaticon.com/512/2111/2111646.png" style="width:14px; height:14px;"> Telegram</a> `;
      if (data.whatsapp) linksHtml += `<a href="https://wa.me/${escapar(data.whatsapp.replace(/\+/g,''))}" target="_blank" style="color:#25d366; text-decoration:none; font-size:12px; font-weight:600; display:inline-flex; align-items:center; gap:4px;"><img src="https://cdn-icons-png.flaticon.com/512/733/733585.png" style="width:14px; height:14px;"> WhatsApp</a> `;

      return `<div class="tarjeta-contacto-pulsante">
        <div style="display:flex; align-items:center; gap:10px;">
          <img src="${escapar(avatarSrc)}" alt="" style="width:48px; height:48px; border-radius:50%; object-fit:cover; border:2px solid var(--morado-500, #8b5cf6);">
          <div style="flex:1; min-width:0;">
            <div style="font-weight:700; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapar(data.name || data.username)}${badgeVerif}${badgeAdmin}</div>
            <div style="font-size:12px; opacity:0.75;">@${escapar(data.username)}</div>
            <div style="font-size:11px; opacity:0.85; color:var(--morado-600, #7c3aed); font-weight:600;">${escapar(data.profession || 'Miembro de Link')}</div>
          </div>
        </div>
        ${data.bio ? `<div style="margin-top:8px; font-size:12px; line-height:1.3; opacity:0.9; max-height:45px; overflow:hidden;">${escapar(data.bio)}</div>` : ''}
        ${linksHtml ? `<div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">${linksHtml}</div>` : ''}
        <div style="margin-top:10px; display:flex; gap:6px;">
          ${data.url ? `<a href="${escapar(data.url)}" class="mini-btn primario" style="flex:1; text-align:center; padding:6px 8px; font-size:11.5px; border-radius:8px; text-decoration:none;">Ver Perfil 👤</a>` : ''}
          <button class="mini-btn secundario" style="flex:1; padding:6px 8px; font-size:11.5px; border-radius:8px;" onclick="Chat.enviarInvitacionCita('${escapar(data.id || '')}', '${escapar(data.name || data.username)}')">📅 Agendar Cita</button>
        </div>
      </div>`;
    }

    // 2. Resultados de Personas por Interés / Filtros con tarjetas agrupables y panel interactivo
    if (t === 'user_search_results' && Array.isArray(data.users) && data.users.length) {
      const cardGroupId = 'group_' + Math.random().toString(36).substring(2, 9);
      const items = data.users.map(u => `
        <div class="tarjeta-usuario-item" id="user_card_${u.id}_${cardGroupId}" style="padding:8px; margin-bottom:6px; background:var(--fondo-pagina, #f9fafb); border:1px solid var(--borde, #e5e7eb); border-radius:10px; transition:all 0.2s ease;">
          <div style="display:flex; align-items:center; gap:10px; cursor:pointer;" onclick="Chat.alternarPanelUsuario('${u.id}', '${cardGroupId}')">
            <img src="${u.avatar || iconoDefecto()}" style="width:38px; height:38px; border-radius:50%; object-fit:cover; border:1px solid var(--morado-500, #8b5cf6);">
            <div style="flex:1; min-width:0;">
              <div style="font-weight:700; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapar(u.name)} ${u.verified ? '<span style="color:#3b82f6;">✓</span>' : ''}</div>
              <div style="font-size:11px; opacity:0.75;">@${escapar(u.username)} • ${escapar(u.profession || 'Link')}</div>
            </div>
            <span style="font-size:12px; opacity:0.6;">▼</span>
          </div>
          <!-- Panel interactivo desplegable -->
          <div id="user_panel_${u.id}_${cardGroupId}" class="panel-usuario-desplegable" style="display:none; margin-top:8px; padding-top:8px; border-top:1px dashed var(--borde, #e5e7eb); font-size:11.5px;">
            ${u.bio ? `<div style="margin-bottom:6px; opacity:0.85;">${escapar(u.bio)}</div>` : ''}
            <div style="display:flex; gap:6px; margin-top:6px;">
              <a href="/perfil/${u.id}" target="_blank" class="mini-btn primario" style="flex:1; text-align:center; padding:4px 6px; font-size:11px; border-radius:6px; text-decoration:none;">👤 Ver perfil</a>
              <button class="mini-btn secundario" style="flex:1; padding:4px 6px; font-size:11px; border-radius:6px;" onclick="Chat.seleccionarEsteUsuario('${u.id}', '${cardGroupId}')">🎯 Era este</button>
              <button class="mini-btn secundario" style="padding:4px 6px; font-size:11px; border-radius:6px;" onclick="Chat.abrirConversacionConId('${u.id}', '${escapar(u.name)}')">💬 Mensaje</button>
            </div>
          </div>
        </div>
      `).join('');

      return `<div id="contenedor_grupo_${cardGroupId}" style="margin-top:8px; padding:10px; background:var(--fondo-tarjeta, #fff); border:1px solid var(--borde, #e5e7eb); border-radius:12px; max-width:310px;">
        <div style="font-weight:700; font-size:12px; margin-bottom:8px; color:var(--morado-600, #7c3aed); display:flex; justify-space-between; align-items:center;">
          <span>🔍 Encontré ${data.count || data.users.length} persona(s) (${escapar(data.interest)}):</span>
        </div>
        <div class="contenedor-usuarios-lista">${items}</div>
      </div>`;
    }

    // 3. Resultados de Publicaciones Encontradas
    if (t === 'posts_search_results' && Array.isArray(data.posts) && data.posts.length) {
      const postItems = data.posts.map(p => `
        <div style="padding:8px; background:rgba(0,0,0,0.03); border-radius:8px; margin-bottom:6px;">
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
            <img src="${p.autor_avatar || iconoDefecto()}" style="width:24px; height:24px; border-radius:50%;">
            <span style="font-weight:600; font-size:12px;">${escapar(p.autor_nombre)}</span>
          </div>
          <div style="font-size:12px; opacity:0.9; margin-bottom:4px;">${escapar(p.text || 'Sin texto')}</div>
          ${p.media_url ? `<img src="${p.media_url}" style="width:100%; max-height:120px; object-fit:cover; border-radius:6px; margin-bottom:4px;">` : ''}
          <div style="font-size:10px; opacity:0.65;">❤️ ${p.total_likes || 0} • 💬 ${p.total_comentarios || 0}</div>
        </div>
      `).join('');

      return `<div style="margin-top:8px; padding:10px; background:var(--fondo-tarjeta, #fff); border:1px solid var(--borde, #e5e7eb); border-radius:10px; max-width:300px;">
        <div style="font-weight:700; font-size:12px; margin-bottom:6px; color:var(--morado-600, #7c3aed);">📝 Publicaciones encontradas:</div>
        ${postItems}
      </div>`;
    }

    // 4. Geolocalización por IP
    if (t === 'ip_geolocation' && data) {
      return `<div style="margin-top:8px; padding:10px; background:var(--fondo-tarjeta, #fff); border:1px solid var(--borde, #e5e7eb); border-radius:10px; max-width:280px; font-size:12px;">
        <div style="font-weight:700; color:var(--morado-600, #7c3aed); margin-bottom:4px;">🌐 Geolocalización IP (${escapar(data.ip)})</div>
        <div><b>País:</b> ${escapar(data.country || 'Desconocido')}</div>
        <div><b>Ciudad / Región:</b> ${escapar(data.city || '')}, ${escapar(data.regionName || '')}</div>
        <div><b>Proveedor (ISP):</b> ${escapar(data.isp || 'N/A')}</div>
        <div><b>Zona horaria:</b> ${escapar(data.timezone || 'N/A')}</div>
      </div>`;
    }

    // 5. Archivo ZIP Descargable
    if (t === 'zip_download' && data) {
      return `<div style="margin-top:8px; padding:12px; background:var(--fondo-tarjeta, #fff); border:1px solid var(--morado-500, #8b5cf6); border-radius:12px; max-width:290px; font-size:12.5px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
          <span style="font-size:20px;">📦</span>
          <div>
            <div style="font-weight:700; color:var(--morado-700);">${escapar(data.filename || 'archivo.zip')}</div>
            <div style="font-size:11px; opacity:0.75;">${data.file_count || 1} archivo(s) comprimido(s)</div>
          </div>
        </div>
        <a href="${escapar(data.download_url || '#')}" download="${escapar(data.filename || 'archivo.zip')}" class="mini-btn primario" style="display:block; text-align:center; padding:6px 10px; font-size:12px; border-radius:8px; text-decoration:none; margin-top:8px;">Descargar Archivo ZIP ⬇️</a>
      </div>`;
    }

    // 6. NASA APOD / Astronomía
    if (t === 'nasa_apod' || toolResult.type === 'nasa_apod') {
      const title = toolResult.title || data.title || 'Foto Astronómica de la NASA';
      const url = toolResult.url || data.url;
      const date = toolResult.date || data.date || '';
      const explanation = toolResult.explanation || data.explanation || '';
      const isVideo = toolResult.media_type === 'video' || data.media_type === 'video';

      const imgCardId = 'img_loader_' + Math.random().toString(36).substring(2, 9);

      let mediaContent = '';
      if (isVideo && url) {
        mediaContent = `<div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:8px; margin-top:6px;">
          <iframe src="${escapar(url)}" frameborder="0" allowfullscreen style="position:absolute; top:0; left:0; width:100%; height:100%;"></iframe>
        </div>`;
      } else if (url) {
        mediaContent = `<div style="position:relative; margin-top:6px; min-height:160px; background:rgba(0,0,0,0.05); border-radius:10px; overflow:hidden;">
          <div id="${imgCardId}_bar" style="position:absolute; top:0; left:0; width:100%; height:3px; background:linear-gradient(90deg, #8b5cf6, #3b82f6, #8b5cf6); background-size:200% 100%; animation:animCargaBarra 1.5s infinite linear;"></div>
          <div id="${imgCardId}_spin" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); font-size:12px; opacity:0.8; display:flex; align-items:center; gap:6px;">
            <span>🚀 Cargando imagen NASA...</span>
          </div>
          <img src="${escapar(url)}" alt="${escapar(title)}" style="width:100%; max-height:300px; object-fit:cover; border-radius:10px; display:block; cursor:pointer; opacity:0; transition:opacity 0.4s ease;"
            onload="this.style.opacity='1'; document.getElementById('${imgCardId}_spin').style.display='none'; document.getElementById('${imgCardId}_bar').style.display='none';"
            onerror="document.getElementById('${imgCardId}_spin').innerHTML='⚠️ Error al cargar imagen'; document.getElementById('${imgCardId}_bar').style.display='none';"
            onclick="window.abrirVisorImagen('${url.replace(/'/g, "\\'")}')">
        </div>`;
      }

      return `<div style="margin-top:8px; padding:12px; background:var(--fondo-tarjeta, #fff); border:1px solid rgba(139,92,246,0.3); border-radius:12px; max-width:320px; font-size:12px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
          <span style="font-weight:700; color:#8b5cf6;">🚀 NASA APOD ${date ? `(${escapar(date)})` : ''}</span>
          <span style="font-size:10px; opacity:0.6;">api.nasa.gov</span>
        </div>
        <div style="font-weight:600; font-size:13px; margin-bottom:4px;">${escapar(title)}</div>
        ${mediaContent}
        ${explanation ? `<div style="margin-top:8px; font-size:11px; opacity:0.85; line-height:1.35; max-height:60px; overflow-y:auto;">${escapar(explanation)}</div>` : ''}
      </div>`;
    }

    // 7. Tarjeta Generada de Imagen (image_card / satélite / DALL-E / Pollinations)
    if (t === 'image_card' || (data && data.image_url)) {
      const promptTxt = data.prompt || 'Imagen generada';
      const imgUrl = data.image_url || toolResult.url;
      const provider = data.provider || 'AI Engine';

      const imgCardId = 'img_gen_' + Math.random().toString(36).substring(2, 9);

      return `<div style="margin-top:8px; padding:10px; background:var(--fondo-tarjeta, #fff); border:1px solid var(--morado-500, #8b5cf6); border-radius:12px; max-width:320px; font-size:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-weight:700; color:var(--morado-600, #7c3aed); font-size:12px;">🎨 Imagen Generada</span>
          <span style="font-size:10px; opacity:0.6;">${escapar(provider)}</span>
        </div>
        <div style="position:relative; min-height:180px; background:rgba(0,0,0,0.05); border-radius:10px; overflow:hidden; margin-bottom:6px;">
          <div id="${imgCardId}_bar" style="position:absolute; top:0; left:0; width:100%; height:3px; background:linear-gradient(90deg, #ec4899, #8b5cf6, #3b82f6); background-size:200% 100%; animation:animCargaBarra 1.5s infinite linear;"></div>
          <div id="${imgCardId}_spin" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); font-size:12px; opacity:0.8; display:flex; flex-direction:column; align-items:center; gap:6px; text-align:center;">
            <span>⏳ Renderizando imagen...</span>
            <span style="font-size:10px; opacity:0.6;">Esperando entrega del servidor...</span>
          </div>
          <img src="${escapar(imgUrl)}" alt="${escapar(promptTxt)}" style="width:100%; max-height:300px; object-fit:cover; border-radius:10px; display:block; cursor:pointer; opacity:0; transition:opacity 0.4s ease;"
            onload="this.style.opacity='1'; document.getElementById('${imgCardId}_spin').style.display='none'; document.getElementById('${imgCardId}_bar').style.display='none';"
            onerror="document.getElementById('${imgCardId}_spin').innerHTML='⚠️ No se pudo obtener la imagen'; document.getElementById('${imgCardId}_bar').style.display='none';"
            onclick="window.abrirVisorImagen('${imgUrl.replace(/'/g, "\\'")}')">
        </div>
        <div style="font-size:11px; opacity:0.8; line-height:1.3; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;"><b>Prompt:</b> ${escapar(promptTxt)}</div>
      </div>`;
    }

    // 8. Cámaras Web
    if (t === 'webcam_card' && data) {
      const camId = 'cam_' + Math.random().toString(36).substring(2, 9);
      return `<div style="margin-top:8px; padding:10px; background:var(--fondo-tarjeta, #fff); border:1px solid var(--borde, #e5e7eb); border-radius:12px; max-width:310px; font-size:12px;">
        <div style="font-weight:700; color:var(--morado-600, #7c3aed); margin-bottom:4px; display:flex; align-items:center; gap:4px;">
          <span>📹 Cámara en Vivo:</span> ${escapar(data.title || data.location)}
        </div>
        ${data.preview ? `
        <div style="position:relative; margin-top:6px; border-radius:8px; overflow:hidden;">
          <img src="${escapar(data.preview)}" style="width:100%; height:160px; object-fit:cover; border-radius:8px; cursor:pointer;" onclick="window.abrirVisorImagen('${data.preview.replace(/'/g, "\\'")}')">
          <span style="position:absolute; bottom:6px; right:6px; background:rgba(0,0,0,0.7); color:#fff; font-size:10px; padding:2px 6px; border-radius:4px;">🔴 En Vivo / Transmisión</span>
        </div>` : ''}
        ${data.official_url ? `<a href="${escapar(data.official_url)}" target="_blank" class="mini-btn primario" style="display:block; text-align:center; padding:6px; font-size:11px; border-radius:6px; margin-top:8px; text-decoration:none;">Ver Transmisión Directa 🌐</a>` : ''}
      </div>`;
    }

    // 9. Met Museum (Obras de arte)
    if (t === 'met_museum' && Array.isArray(toolResult.artworks) && toolResult.artworks.length) {
      const items = toolResult.artworks.map(art => `
        <div style="padding:6px; background:rgba(0,0,0,0.02); border-radius:8px; margin-bottom:6px;">
          ${art.primaryImage ? `<img src="${escapar(art.primaryImage)}" style="width:100%; max-height:160px; object-fit:cover; border-radius:6px; margin-bottom:4px; cursor:pointer;" onclick="window.abrirVisorImagen('${art.primaryImage.replace(/'/g, "\\'")}')">` : ''}
          <div style="font-weight:700; font-size:12px;">${escapar(art.title)}</div>
          <div style="font-size:11px; opacity:0.8;">${escapar(art.artist)} (${escapar(art.date || 'N/A')})</div>
        </div>
      `).join('');

      return `<div style="margin-top:8px; padding:10px; background:var(--fondo-tarjeta, #fff); border:1px solid var(--borde, #e5e7eb); border-radius:12px; max-width:300px;">
        <div style="font-weight:700; font-size:12px; margin-bottom:6px; color:#8b5cf6;">🖼️ Metropolitan Museum of Art:</div>
        ${items}
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
      cont.innerHTML = `<div style="font-style:italic; opacity:0.7; font-size:12px;">🚫 Este mensaje fue eliminado</div>`;
      return cont;
    }

    let html = '';

    // Citar/Respuesta preview
    if (msg.replyTo) {
      html += `<div class="burbuja-reply-box" style="border-left:3px solid var(--morado-600); padding:3px 6px; margin-bottom:4px; font-size:11.5px; opacity:0.85; background:rgba(0,0,0,0.05); border-radius:4px;">
        <div style="font-weight:700;">${msg.replyTo.senderId === yoId ? 'Tú' : (conversacionAbiertaCon?.name || 'Contacto')}</div>
        <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapar(msg.replyTo.text || (msg.replyTo.imageData ? '📷 Foto' : msg.replyTo.audioData ? '🎤 Nota de voz' : ''))}</div>
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
          <span style="font-size:20px;">📅</span>
          <div>
            <div style="font-weight:800; font-size:13.5px; color:var(--morado-700);">Invitación de Cita / Plan</div>
            <div style="font-size:11px; opacity:0.8;">${msg.senderId === yoId ? 'Enviada por ti' : 'Recibida de ' + (conversacionAbiertaCon?.name || 'Usuario')}</div>
          </div>
        </div>
        <div style="font-size:12.5px; line-height:1.4; margin-bottom:10px;">${formatearUrlsTexto(escapar(textoLimpio))}</div>
        ${!esMia && apptId ? `<div id="acciones_cita_${apptId}" style="display:flex; gap:8px; margin-top:8px;">
          <button class="mini-btn primario" style="flex:1; padding:6px; font-size:11.5px; border-radius:8px;" onclick="Chat.responderCita('${apptId}', 'accept')">Aceptar ✅</button>
          <button class="mini-btn secundario" style="flex:1; padding:6px; font-size:11.5px; border-radius:8px; color:var(--peligro);" onclick="Chat.responderCita('${apptId}', 'reject')">Rechazar ❌</button>
        </div>` : ''}
      </div>`;
    } else if (msg.isAiMentionCard || msg.senderId === '00000000-0000-0000-0000-0000000000a1') {
      html += `<div class="cuadro-link-ai-expandible" style="background:linear-gradient(135deg, rgba(139,92,246,0.12), rgba(168,85,247,0.06)); border:1px solid var(--morado-500, #8b5cf6); border-radius:10px; padding:10px; margin-bottom:4px;">
        <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px; border-bottom:1px solid rgba(139,92,246,0.2); padding-bottom:4px;">
          <span style="font-size:14px;">🤖</span>
          <span style="font-weight:700; font-size:12px; color:var(--morado-600, #7c3aed);">Link AI en el chat</span>
        </div>
        <div style="font-size:12.5px; line-height:1.4;">${formatearUrlsTexto(escapar(textoAMostrar))}</div>
      </div>`;
    } else if (textoAMostrar) {
      html += `<div>${formatearUrlsTexto(escapar(textoAMostrar))}</div>`;
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
        checkHtml = `<span style="color:#60a5fa; font-size:13px; margin-left:4px;" title="Leído (${horaCorta(msg.readAt)})">✓✓</span>`;
      } else if (msg.delivered) {
        checkHtml = `<span style="color:var(--texto-500); font-size:13px; margin-left:4px;" title="Entregado">✓✓</span>`;
      } else {
        checkHtml = `<span style="color:var(--texto-500); font-size:13px; margin-left:4px;" title="Enviado">✓</span>`;
      }
    }

    html += `<div style="display:flex; justify-content:flex-end; align-items:center; font-size:10px; opacity:0.75; margin-top:3px;">
      <span>${horaCorta(msg.createdAt)}</span>${checkHtml}
    </div>`;

    cont.innerHTML = html;

    // Abrir menú de opciones al presionar/clic en burbuja
    cont.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      abrirMenuMensaje(msg);
    });
    cont.addEventListener('click', () => {
      if (msg.text || msg.imageData || msg.audioData) {
        // En móvil toque suave también abre menú si no es imagen
      }
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
        name: persona.name || '🤖 Link AI',
        is_ai: true
      };
    }
    conversacionAbiertaCon = persona;
    $('chatAvatar').src = persona.avatar_data || iconoDefecto();
    $('chatNombre').textContent = persona.name;

    if (persona.is_ai) {
      $('chatEstadoLinea').textContent = '🤖 Asistente de IA';
    } else {
      $('chatEstadoLinea').textContent = persona.is_online ? 'En línea' : formatearUltimaVez(persona.last_seen);
    }

    $('vistaChat').classList.add('activo');

    const yo = Sesion.usuario();
    const cacheKey = conversationId(yo.id, persona.id);

    // Reset reply
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
          $('chatMensajes').innerHTML = '<div class="aviso-vacio">Todavía no tienen mensajes. ¡Saluda! 👋</div>';
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

      // Crear burbuja de espera / pensándolo en el chat mientras se consulta la API
      const loadingId = 'ai_loading_' + Date.now();
      const loadingEl = document.createElement('div');
      loadingEl.className = 'burbuja suya';
      loadingEl.id = loadingId;
      loadingEl.innerHTML = `
        <div class="burbuja-loading-ai">
          <span>🤖 Consultando API y procesando respuesta</span>
          <div class="burbuja-loading-dots"><span></span><span></span><span></span></div>
        </div>
      `;
      $('chatMensajes').appendChild(loadingEl);
      $('chatMensajes').scrollTop = $('chatMensajes').scrollHeight;

      api('/ai/chat', { method: 'POST', body: { prompt: texto } })
        .then((res) => {
          const elWait = document.getElementById(loadingId);
          if (elWait) elWait.remove();

          const aiReplyText = res.reply || res.message || (res.error && res.error.message) || '⚠️ No se pudo obtener respuesta de la IA.';
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

          const msgError = {
            id: 'ai_bot_err_' + Date.now(),
            senderId: '00000000-0000-0000-0000-0000000000a1',
            text: `⚠️ ${err.message || 'Error al comunicarse con el asistente de IA.'}`,
            createdAt: new Date().toISOString(),
          };
          $('chatMensajes').appendChild(pintarBurbuja(msgError, Sesion.usuario().id));
          $('chatMensajes').scrollTop = $('chatMensajes').scrollHeight;
          mostrarToast(err.message || 'Error en IA');
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
    $('chatReplyTexto').textContent = msg.text || (msg.imageData ? '📷 Foto' : msg.audioData ? '🎤 Nota de voz' : '');
    $('chatReplyPreview').classList.remove('oculto');
    $('chatInputTexto').focus();
  }

  async function onMensajeEntrante(msg) {
    const yo = Sesion.usuario();
    if (conversacionAbiertaCon && conversationId(yo.id, conversacionAbiertaCon.id) === msg.conversationId) {
      $('chatMensajes').appendChild(pintarBurbuja(msg, yo.id));
      $('chatMensajes').scrollTop = $('chatMensajes').scrollHeight;

      // Marcar leido
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

    if (document.hidden || !document.hasFocus()) {
      if (window.mostrarNotificacionNativa) {
        const remitenteNombre = msg.senderName || 'Nuevo mensaje';
        window.mostrarNotificacionNativa(`Mensaje de ${remitenteNombre}`, {
          body: msg.text || (msg.imageData ? '📷 Foto' : msg.audioData ? '🎤 Nota de voz' : 'Nuevo mensaje'),
          tag: 'msg-' + msg.conversationId,
          data: { url: '/?chat=' + msg.senderId }
        });
      }
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

  // ---- NOTAS DE VOZ (MediaRecorder API) ----
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

  // ---- BÚSQUEDA INTERNA Y GALERÍA DE CHAT ----
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

  function enlazarUI() {
    $('chatVolver').addEventListener('click', cerrarConversacion);
    $('chatCerrarReply')?.addEventListener('click', cancelarRespuesta);

    $('chatBtnEnviar').addEventListener('click', () => {
      const input = $('chatInputTexto');
      const texto = input.value.trim();
      if (!texto) return;
      enviarMensaje(texto, null, null, 0);
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

    // Micrófono grabador audio
    $('chatBtnGravaVoz')?.addEventListener('click', iniciarGrabacionVoz);
    $('chatBtnCancelarVoz')?.addEventListener('click', () => detenerGrabacionVoz(false));
    $('chatBtnEnviarVoz')?.addEventListener('click', () => detenerGrabacionVoz(true));

    // Búsqueda y Galería y Exportar
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

    // Opciones del Menú Mensaje
    $('cerrarMensajeOp')?.addEventListener('click', cerrarMenuMensaje);
    $('opMsgFijar')?.addEventListener('click', async () => {
      cerrarMenuMensaje();
      if (mensajeSeleccionado) {
        try {
          const res = await api(`/mensajes/fijar/${mensajeSeleccionado.id}`, { method: 'POST' });
          mostrarToast(res.fijado ? 'Mensaje fijado 📌' : 'Mensaje desfijado');
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
        mostrarToast('Texto copiado al portapapeles 📋');
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

    // Emoji Reacciones Picker
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
  }

  function enlazarSocket(socket) {
    socket.on('mensaje:nuevo', onMensajeEntrante);
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
            check.textContent = '✓✓';
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
        const citaCardTxt = `📅 [INVITACION_CITA:${appt.id}] Cita/Compromiso: ${planes}\nFecha: ${fechaHora}\nDestino: ${destino}`;
        enviarMensaje(citaCardTxt, null, null, 0);
        mostrarToast('Invitación de cita agendada y enviada 📅');
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
            ${accion === 'accept' ? '✅ Cita Aceptada' : `❌ Cita Rechazada ${motivo ? `(${escapar(motivo)})` : ''}`}
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

  return { abrirConversacion, cerrarConversacion, enlazarUI, enlazarSocket, actualizarBadgeMensajes, alternarVelocidadAudio, alternarPanelUsuario, seleccionarEsteUsuario, abrirConversacionConId, cambiarCalidadVideo, enviarInvitacionCita, responderCita };
})();

document.addEventListener('DOMContentLoaded', () => Chat.enlazarUI());

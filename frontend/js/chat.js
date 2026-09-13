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

  function formatearUrlsTexto(texto) {
    if (!texto) return '';
    if (window.procesarTextosYDriveLinks) {
      return window.procesarTextosYDriveLinks(texto);
    }
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return texto.replace(urlRegex, (url) => {
      try {
        const domain = new URL(url).hostname;
        return `<a href="${url}" target="_blank" class="chip-link-url" onclick="event.stopPropagation()">🔗 ${domain}</a>`;
      } catch (e) {
        return `<a href="${url}" target="_blank" class="chip-link-url" onclick="event.stopPropagation()">${url}</a>`;
      }
    });
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

    if (msg.text) html += `<div>${formatearUrlsTexto(escapar(msg.text))}</div>`;

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
    conversacionAbiertaCon = persona;
    $('chatAvatar').src = persona.avatar_data || iconoDefecto();
    $('chatNombre').textContent = persona.name;

    if (persona.is_ai) {
      $('chatEstadoLinea').textContent = '🤖 Asistente de IA (OpenRouter)';
      $('vistaChat').classList.add('activo');
      $('chatMensajes').innerHTML = `
        <div class="burbuja suya" style="max-width:85%;">
          <div>¡Hola! Soy <b>Link AI</b>. ¿En qué te puedo ayudar hoy? Si tu administrador configuró la clave de OpenRouter responderé tus preguntas inmediatamente.</div>
          <div style="font-size:10px; opacity:0.7; margin-top:4px;">Justo ahora</div>
        </div>
      `;
      return;
    }

    $('chatEstadoLinea').textContent = persona.is_online ? 'En línea' : formatearUltimaVez(persona.last_seen);
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
        $('chatMensajes').innerHTML = '<div class="aviso-vacio">Todavía no tienen mensajes. ¡Saluda! 👋</div>';
      } else {
        mensajes.forEach((m) => $('chatMensajes').appendChild(pintarBurbuja(m, yo.id)));
        $('chatMensajes').scrollTop = $('chatMensajes').scrollHeight;

        // Marcar mensajes no leídos como leídos
        const unreadIds = mensajes.filter(m => m.receiverId === yo.id && !m.read).map(m => m.id);
        if (unreadIds.length && window.socket) {
          window.socket.emit('mensaje:leido', { messageIds: unreadIds, senderId: persona.id });
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

      api('/ai/chat', { method: 'POST', body: { prompt: texto } })
        .then((res) => {
          const aiReplyText = res.available ? res.reply : (res.message || 'Inteligencia artificial no configurada.');
          const msgAi = {
            id: 'ai_bot_' + Date.now(),
            senderId: 'link_ai_bot',
            text: aiReplyText,
            createdAt: new Date().toISOString(),
          };
          $('chatMensajes').appendChild(pintarBurbuja(msgAi, Sesion.usuario().id));
          $('chatMensajes').scrollTop = $('chatMensajes').scrollHeight;
        })
        .catch((err) => {
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
      mostrarToast('Nuevo mensaje recibido 💬');
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

  return { abrirConversacion, cerrarConversacion, enlazarUI, enlazarSocket, actualizarBadgeMensajes, alternarVelocidadAudio };
})();

document.addEventListener('DOMContentLoaded', () => Chat.enlazarUI());

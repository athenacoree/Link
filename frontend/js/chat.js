/* =========================================================
   MENSAJERÍA EN TIEMPO REAL
   - Los mensajes viajan por Socket.io y se guardan de verdad en
     MongoDB Atlas (ver backend/models/Message.js).
   - Esta capa solo pinta la conversación abierta y mantiene la
     lista de conversaciones actualizada cuando llega algo nuevo.
   ========================================================= */
const Chat = (() => {
  const $ = (id) => document.getElementById(id);
  let conversacionAbiertaCon = null; // {id, name, avatar_data, is_online}
  let cargandoMas = false;

  function conversationId(a, b) { return [a, b].sort().join('_'); }

  function horaCorta(fecha) {
    const d = new Date(fecha);
    return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  }

  function pintarBurbuja(msg, yoId) {
    const esMia = msg.senderId === yoId;
    const cont = document.createElement('div');
    cont.className = `burbuja ${esMia ? 'mia' : 'suya'}`;
    let html = '';
    if (msg.text) html += escapar(msg.text);
    if (msg.imageData) html += `<img src="${msg.imageData}" alt="">`;
    cont.innerHTML = html;
    return cont;
  }

  function escapar(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  async function abrirConversacion(persona) {
    conversacionAbiertaCon = persona;
    $('chatAvatar').src = persona.avatar_data || iconoDefecto();
    $('chatNombre').textContent = persona.name;
    $('chatEstadoLinea').textContent = persona.is_online ? 'En línea' : 'Desconectado';
    $('chatMensajes').innerHTML = '<div class="aviso-vacio">Cargando conversación…</div>';
    $('vistaChat').classList.add('activo');

    const yo = Sesion.usuario();
    try {
      const { mensajes } = await api(`/mensajes/${persona.id}`);
      $('chatMensajes').innerHTML = '';
      if (!mensajes.length) {
        $('chatMensajes').innerHTML = '<div class="aviso-vacio">Todavía no tienen mensajes. ¡Saluda! 👋</div>';
      } else {
        mensajes.forEach((m) => $('chatMensajes').appendChild(pintarBurbuja(m, yo.id)));
        $('chatMensajes').scrollTop = $('chatMensajes').scrollHeight;
      }
    } catch (e) {
      $('chatMensajes').innerHTML = `<div class="aviso-vacio">${e.message}</div>`;
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

  function enviarMensaje(texto, imagenBase64) {
    if (!conversacionAbiertaCon) return;
    if (!texto && !imagenBase64) return;
    window.socket.emit('mensaje:enviar', {
      receiverId: conversacionAbiertaCon.id,
      text: texto || '',
      imageData: imagenBase64 || null,
    }, (respuesta) => {
      if (!respuesta.ok) { mostrarToast(respuesta.error || 'No se pudo enviar.'); return; }
      const yo = Sesion.usuario();
      $('chatMensajes').appendChild(pintarBurbuja(respuesta.mensaje, yo.id));
      $('chatMensajes').scrollTop = $('chatMensajes').scrollHeight;
    });
  }

  function onMensajeEntrante(msg) {
    const yo = Sesion.usuario();
    if (conversacionAbiertaCon && conversationId(yo.id, conversacionAbiertaCon.id) === msg.conversationId) {
      $('chatMensajes').appendChild(pintarBurbuja(msg, yo.id));
      $('chatMensajes').scrollTop = $('chatMensajes').scrollHeight;
    } else {
      mostrarToast('Nuevo mensaje recibido 💬');
      actualizarBadgeMensajes(true);
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

  function enlazarUI() {
    $('chatVolver').addEventListener('click', cerrarConversacion);
    $('chatBtnEnviar').addEventListener('click', () => {
      const input = $('chatInputTexto');
      const texto = input.value.trim();
      if (!texto) return;
      enviarMensaje(texto, null);
      input.value = '';
    });
    $('chatInputTexto').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('chatBtnEnviar').click();
    });
    $('chatImagenInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const base64 = await archivoABase64(file, 1000, 0.7);
        enviarMensaje('', base64);
      } catch (err) { mostrarToast('No se pudo procesar la imagen.'); }
      e.target.value = '';
    });
    $('chatBtnAudio').addEventListener('click', () => {
      if (conversacionAbiertaCon) Llamada.iniciar(conversacionAbiertaCon, 'audio');
    });
    $('chatBtnVideo').addEventListener('click', () => {
      if (conversacionAbiertaCon) Llamada.iniciar(conversacionAbiertaCon, 'video');
    });
  }

  function enlazarSocket(socket) {
    socket.on('mensaje:nuevo', onMensajeEntrante);
    socket.on('presencia:cambio', ({ userId, online }) => {
      if (conversacionAbiertaCon && conversacionAbiertaCon.id === userId) {
        conversacionAbiertaCon.is_online = online;
        $('chatEstadoLinea').textContent = online ? 'En línea' : 'Desconectado';
      }
    });
  }

  return { abrirConversacion, cerrarConversacion, enlazarUI, enlazarSocket, actualizarBadgeMensajes };
})();

document.addEventListener('DOMContentLoaded', () => Chat.enlazarUI());

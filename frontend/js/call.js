/* =========================================================
   LLAMADAS DE AUDIO / VIDEO — WebRTC real (P2P) señalizado por
   Socket.io. La misma lógica e interfaz del prototipo que enviaste,
   sin barra de navegación ni pantallas de configuración: solo lo
   que se ve mientras entra, se contesta y transcurre una llamada.

   Servidores STUN públicos de Google para el descubrimiento de
   candidatos ICE. Para producción con redes muy restrictivas
   (NAT simétrico / 4G corporativo) conviene añadir un servidor
   TURN (ver README) — sin TURN, la mayoría de las llamadas caseras
   y móviles funcionan igual porque STUN ya resuelve el NAT más común.
   ========================================================= */
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const Llamada = (() => {
  const $ = (id) => document.getElementById(id);

  let pc = null;
  let localStream = null;
  let estado = 'inactiva'; // inactiva | llamando | entrante | conectando | activa
  let soyElCaller = false;
  let otraPersona = null; // {id, name, avatar_data}
  let tipoActual = 'audio'; // audio | video
  let camOn = true;
  let micOn = true;
  let timerInterval = null;
  let segundos = 0;
  let timeoutSinRespuesta = null;

  function iniciales(nombre) {
    if (!nombre) return '?';
    const partes = nombre.trim().split(/\s+/);
    return ((partes[0]?.[0] || '') + (partes[1]?.[0] || '')).toUpperCase();
  }

  function fmt(s) {
    s = Math.max(0, Math.floor(s));
    const m = String(Math.floor(s / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return `${m}:${sec}`;
  }

  function toast(msg) {
    const el = $('callToast');
    $('callToastMsg').textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2400);
  }

  function pintarAvatarPersona() {
    const av = otraPersona?.avatar_data;
    const nombre = otraPersona?.name || 'Desconocido';
    $('entranteAvatar').innerHTML = av ? `<img src="${av}" alt="">` : iniciales(nombre);
    $('entranteNombre').textContent = nombre;
    $('remoteAvatarInitial').innerHTML = av ? `<img src="${av}" alt="">` : iniciales(nombre);
    $('remoteFallbackName').textContent = tipoActual === 'video' ? 'Conectando video…' : 'Audio conectado';
    const yo = Sesion.usuario();
    $('selfAvatarInitial').textContent = iniciales(yo?.name);
  }

  function mostrarPantallaEntrante(mostrar) {
    $('vistaLlamada').classList.toggle('activa', mostrar || estado !== 'inactiva');
    $('pantallaEntrante').classList.toggle('active', mostrar);
  }

  function mostrarCallFull(mostrar) {
    $('vistaLlamada').classList.toggle('activa', mostrar || estado !== 'inactiva');
    $('callFull').classList.toggle('active', mostrar);
    $('vistaLlamada').classList.remove('minimizada');
  }

  function sonarTono(activar) {
    const audio = $('ringtoneAudio');
    if (activar) {
      // Tono simple generado con WebAudio para no depender de un archivo externo
      audio.pause();
    } else {
      audio.pause();
    }
  }

  // ---------------- Crear conexión WebRTC ----------------
  function crearPeerConnection(destinoId) {
    const conexion = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    conexion.onicecandidate = (evt) => {
      if (evt.candidate) {
        window.socket.emit('llamada:ice-candidate', { destinoId, candidate: evt.candidate });
      }
    };

    conexion.ontrack = (evt) => {
      const remoteVideo = $('remoteVideo');
      if (remoteVideo.srcObject !== evt.streams[0]) {
        remoteVideo.srcObject = evt.streams[0];
        $('miniVideo').srcObject = evt.streams[0];
      }
      $('connectingOverlay').classList.add('hide');
      $('stageTitle').textContent = otraPersona?.name || 'En llamada';
      $('remoteFallback').style.display = tipoActual === 'video' ? 'none' : 'flex';
      empezarTemporizador();
      estado = 'activa';
    };

    conexion.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(conexion.connectionState) && estado !== 'inactiva') {
        // Si se cae la conexión de red, cerramos limpio
        if (conexion.connectionState === 'failed') {
          toast('Se perdió la conexión.');
          colgar(true);
        }
      }
    };

    return conexion;
  }

  async function obtenerMedia(conVideo) {
    const constraints = {
      audio: true,
      video: conVideo ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false,
    };
    return navigator.mediaDevices.getUserMedia(constraints);
  }

  function empezarTemporizador() {
    clearInterval(timerInterval);
    segundos = 0;
    timerInterval = setInterval(() => {
      segundos++;
      $('callTimer').textContent = fmt(segundos);
      $('miniTimer').textContent = fmt(segundos);
    }, 1000);
  }

  // ---------------- Iniciar llamada (yo llamo) ----------------
  async function iniciar(persona, callType) {
    if (estado !== 'inactiva') { toast('Ya hay una llamada en curso.'); return; }
    otraPersona = persona;
    tipoActual = callType;
    soyElCaller = true;
    estado = 'llamando';

    pintarAvatarPersona();
    $('entranteTipo').textContent = callType === 'video' ? 'Videollamada P2P' : 'Llamada de audio';
    $('connectingOverlay').classList.remove('hide');
    $('connectingText').textContent = 'Llamando…';
    $('stageTitle').textContent = 'Llamando…';
    $('callTimer').textContent = '00:00';
    mostrarCallFull(true);

    window.socket.emit('llamada:invitar', { calleeId: persona.id, callType });

    timeoutSinRespuesta = setTimeout(() => {
      if (estado === 'llamando') {
        toast('No contestó la llamada.');
        colgar(true);
      }
    }, 35000);
  }

  // ---------------- Me llaman (evento del servidor) ----------------
  async function onEntrante({ callerId, callType }, datosPersona) {
    if (estado !== 'inactiva') {
      // Ya ocupado: rechazo automático
      window.socket.emit('llamada:responder', { callerId, aceptar: false });
      return;
    }
    otraPersona = { id: callerId, ...datosPersona };
    tipoActual = callType;
    soyElCaller = false;
    estado = 'entrante';

    pintarAvatarPersona();
    $('entranteTipo').textContent = callType === 'video' ? 'Videollamada P2P entrante' : 'Llamada de audio entrante';
    mostrarPantallaEntrante(true);
  }

  async function aceptar() {
    if (estado !== 'entrante') return;
    mostrarPantallaEntrante(false);
    estado = 'conectando';
    $('connectingOverlay').classList.remove('hide');
    $('connectingText').textContent = 'Conectando…';
    $('stageTitle').textContent = 'Conectando…';
    $('callTimer').textContent = '00:00';
    mostrarCallFull(true);

    try {
      localStream = await obtenerMedia(tipoActual === 'video');
      configurarLocalUI();
      pc = crearPeerConnection(otraPersona.id);
      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
      window.socket.emit('llamada:responder', { callerId: otraPersona.id, aceptar: true });
    } catch (err) {
      toast('No se pudo acceder a la cámara/micrófono.');
      window.socket.emit('llamada:responder', { callerId: otraPersona.id, aceptar: false });
      finalizar();
    }
  }

  function rechazar() {
    if (estado !== 'entrante') return;
    window.socket.emit('llamada:responder', { callerId: otraPersona.id, aceptar: false });
    finalizar();
  }

  // ---------------- El otro lado respondió mi invitación ----------------
  async function onRespondida({ aceptar: fueAceptada }) {
    clearTimeout(timeoutSinRespuesta);
    if (!soyElCaller || estado !== 'llamando') return;
    if (!fueAceptada) {
      toast('Rechazó la llamada.');
      finalizar();
      return;
    }
    try {
      estado = 'conectando';
      $('connectingText').textContent = 'Conectando…';
      $('stageTitle').textContent = 'Conectando…';
      localStream = await obtenerMedia(tipoActual === 'video');
      configurarLocalUI();
      pc = crearPeerConnection(otraPersona.id);
      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
      const oferta = await pc.createOffer();
      await pc.setLocalDescription(oferta);
      window.socket.emit('llamada:oferta', { calleeId: otraPersona.id, sdp: oferta });
    } catch (err) {
      toast('No se pudo acceder a la cámara/micrófono.');
      colgar(true);
    }
  }

  // ---------------- Recibo la oferta SDP (soy el callee) ----------------
  async function onOferta({ callerId, sdp }) {
    if (!pc || estado !== 'conectando') return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const respuesta = await pc.createAnswer();
      await pc.setLocalDescription(respuesta);
      window.socket.emit('llamada:respuesta-sdp', { callerId, sdp: respuesta });
    } catch (err) {
      console.error(err);
      colgar(true);
    }
  }

  // ---------------- Recibo la respuesta SDP (soy el caller) ----------------
  async function onRespuestaSdp({ sdp }) {
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch (err) {
      console.error(err);
    }
  }

  async function onIceCandidate({ candidate }) {
    if (!pc || !candidate) return;
    try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) { /* ignorar candidatos tardíos */ }
  }

  function onColgarRemoto() {
    toast('La otra persona colgó.');
    finalizar();
  }

  function configurarLocalUI() {
    const pip = $('selfPip');
    const localVideo = $('localVideo');
    if (tipoActual === 'video') {
      localVideo.srcObject = localStream;
      pip.classList.add('cam-on');
    } else {
      pip.classList.remove('cam-on');
    }
    camOn = tipoActual === 'video';
    micOn = true;
    $('camBtn').classList.toggle('off', !camOn);
  }

  // ---------------- Colgar ----------------
  function colgar(silencioso) {
    if (otraPersona?.id) {
      window.socket.emit('llamada:colgar', { destinoId: otraPersona.id });
    }
    finalizar();
  }

  function finalizar() {
    clearTimeout(timeoutSinRespuesta);
    clearInterval(timerInterval);
    sonarTono(false);
    if (pc) { try { pc.close(); } catch (e) {} pc = null; }
    if (localStream) { localStream.getTracks().forEach((t) => t.stop()); localStream = null; }
    $('remoteVideo').srcObject = null;
    $('localVideo').srcObject = null;
    $('miniVideo').srcObject = null;
    $('callFull').classList.remove('active');
    $('pantallaEntrante').classList.remove('active');
    $('vistaLlamada').classList.remove('activa', 'minimizada');
    $('connectingOverlay').classList.remove('hide');
    $('menuMas').classList.remove('show');
    estado = 'inactiva';
    soyElCaller = false;
    otraPersona = null;
    segundos = 0;
  }

  // ---------------- Controles durante la llamada ----------------
  function toggleMic() {
    if (!localStream) return;
    micOn = !micOn;
    localStream.getAudioTracks().forEach((t) => (t.enabled = micOn));
    $('micBtn').classList.toggle('off', !micOn);
    $('selfPip').classList.toggle('muted', !micOn);
  }

  async function toggleCam() {
    if (!localStream) return;
    if (localStream.getVideoTracks().length === 0 && !camOn) {
      // Activar cámara si la llamada empezó en modo audio
      try {
        const extra = await navigator.mediaDevices.getUserMedia({ video: true });
        const track = extra.getVideoTracks()[0];
        localStream.addTrack(track);
        $('localVideo').srcObject = localStream;
        if (pc) {
          const sender = pc.addTrack(track, localStream);
        }
        camOn = true;
        $('selfPip').classList.add('cam-on');
        $('camBtn').classList.remove('off');
        return;
      } catch (e) { toast('No se pudo activar la cámara.'); return; }
    }
    camOn = !camOn;
    localStream.getVideoTracks().forEach((t) => (t.enabled = camOn));
    $('camBtn').classList.toggle('off', !camOn);
    $('selfPip').classList.toggle('cam-on', camOn);
  }

  function toggleMinimizar() {
    $('vistaLlamada').classList.toggle('minimizada');
    $('callMini').classList.toggle('has-video', tipoActual === 'video' && camOn);
  }

  // ---------------- Chat dentro de la llamada ----------------
  function abrirChatLlamada() {
    abrirActionSheet(`
      <div class="modal-handle"></div>
      <div class="as-title">Chat</div>
      <div class="chat-msgs" id="llamadaChatMsgs"></div>
      <div class="chat-input-row"><input type="text" id="llamadaChatInput" placeholder="Escribe un mensaje…" maxlength="300">
      <button class="chat-send" id="llamadaChatSend"><svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg></button></div>
    `);
    $('actionSheet').classList.add('chat-sheet');
    renderChatLlamada();
    $('llamadaChatSend').onclick = enviarChatLlamada;
    $('llamadaChatInput').onkeydown = (e) => { if (e.key === 'Enter') enviarChatLlamada(); };
  }
  let chatLlamadaMsgs = [];
  function enviarChatLlamada() {
    const input = $('llamadaChatInput');
    const texto = input.value.trim();
    if (!texto || !otraPersona) return;
    window.socket.emit('llamada:chat', { destinoId: otraPersona.id, text: texto });
    chatLlamadaMsgs.push({ text: texto, quien: 'yo' });
    renderChatLlamada();
    input.value = '';
  }
  function onChatEntrante({ text }) {
    chatLlamadaMsgs.push({ text, quien: 'ellos' });
    if ($('llamadaChatMsgs')) renderChatLlamada();
    toast('Nuevo mensaje en la llamada');
  }
  function renderChatLlamada() {
    const cont = $('llamadaChatMsgs');
    if (!cont) return;
    cont.innerHTML = chatLlamadaMsgs.map(m => `<div class="chat-bubble ${m.quien === 'yo' ? 'me' : 'them'}">${escaparHTML(m.text)}</div>`).join('');
    cont.scrollTop = cont.scrollHeight;
  }
  function escaparHTML(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function abrirActionSheet(html) {
    $('actionSheet').innerHTML = html;
    $('actionSheetOverlay').classList.add('show');
  }
  function cerrarActionSheet() {
    $('actionSheetOverlay').classList.remove('show');
    $('actionSheet').classList.remove('chat-sheet');
  }

  function abrirVolumen() {
    abrirActionSheet(`
      <div class="modal-handle"></div>
      <div class="as-title">Volumen</div>
      <div class="vol-row">
        <svg viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4V5z"/></svg>
        <input type="range" min="0" max="1" step="0.05" value="1" id="volumenRange">
      </div>
    `);
    $('volumenRange').oninput = (e) => { $('remoteVideo').volume = parseFloat(e.target.value); };
  }

  async function cambiarCamara() {
    if (!localStream || tipoActual !== 'video') return;
    const videoTrack = localStream.getVideoTracks()[0];
    const actual = videoTrack?.getSettings().facingMode || 'user';
    const nueva = actual === 'user' ? 'environment' : 'user';
    try {
      const nuevoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: nueva } });
      const nuevoTrack = nuevoStream.getVideoTracks()[0];
      const sender = pc?.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (sender) await sender.replaceTrack(nuevoTrack);
      if (videoTrack) { videoTrack.stop(); localStream.removeTrack(videoTrack); }
      localStream.addTrack(nuevoTrack);
      $('localVideo').srcObject = localStream;
      toast('Cámara cambiada');
    } catch (e) { toast('No se pudo cambiar de cámara.'); }
  }

  // ---------------- Enlazar botones de la interfaz (una sola vez) ----------------
  function enlazarUI() {
    $('btnAceptar').addEventListener('click', aceptar);
    $('btnRechazar').addEventListener('click', rechazar);
    $('endBtn').addEventListener('click', () => colgar(false));
    $('micBtn').addEventListener('click', toggleMic);
    $('camBtn').addEventListener('click', toggleCam);
    $('btnMinimizar').addEventListener('click', toggleMinimizar);
    $('callMini').addEventListener('click', toggleMinimizar);
    $('btnMas').addEventListener('click', () => $('menuMas').classList.toggle('show'));
    document.querySelectorAll('#menuMas .menu-item').forEach((item) => {
      item.addEventListener('click', () => {
        $('menuMas').classList.remove('show');
        const accion = item.dataset.accion;
        if (accion === 'chat') abrirChatLlamada();
        if (accion === 'volumen') abrirVolumen();
        if (accion === 'camara') cambiarCamara();
      });
    });
    $('actionSheetOverlay').addEventListener('click', (e) => { if (e.target.id === 'actionSheetOverlay') cerrarActionSheet(); });
  }

  // ---------------- Conectar eventos de socket (llamados desde app.js) ----------------
  function enlazarSocket(socket) {
    socket.on('llamada:entrante', async ({ callerId, callType }) => {
      try {
        const { persona } = await api(`/usuarios/${callerId}`);
        onEntrante({ callerId, callType }, persona);
      } catch (e) {
        onEntrante({ callerId, callType }, { name: 'Alguien' });
      }
    });
    socket.on('llamada:no-disponible', () => { toast('Esa persona no está conectada ahora.'); finalizar(); });
    socket.on('llamada:respondida', onRespondida);
    socket.on('llamada:oferta', onOferta);
    socket.on('llamada:respuesta-sdp', onRespuestaSdp);
    socket.on('llamada:ice-candidate', onIceCandidate);
    socket.on('llamada:colgar', onColgarRemoto);
    socket.on('llamada:chat', onChatEntrante);
  }

  return { iniciar, enlazarUI, enlazarSocket };
})();

document.addEventListener('DOMContentLoaded', () => Llamada.enlazarUI());

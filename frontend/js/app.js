/* =========================================================
   ENLACE — lógica principal de la app (100% conectada al backend real)
   ========================================================= */
const $ = (id) => document.getElementById(id);

function mostrarToast(texto) {
  const t = $('toast');
  $('toast-texto').textContent = texto;
  t.classList.add('activo');
  clearTimeout(mostrarToast._t);
  mostrarToast._t = setTimeout(() => t.classList.remove('activo'), 2600);
}

function abrirVisorImagen(src) {
  if (!src) return;
  const visor = $('modalVisorImagen');
  const velo = $('veloVisorImagen');
  const img = $('imgVisorAgrandada');
  if (visor && img && velo) {
    img.src = src;
    velo.classList.add('activo');
    visor.style.display = 'flex';
  }
}

function cerrarVisorImagen() {
  const visor = $('modalVisorImagen');
  const velo = $('veloVisorImagen');
  if (visor && velo) {
    velo.classList.remove('activo');
    visor.style.display = 'none';
  }
}
window.abrirVisorImagen = abrirVisorImagen;

function abrirVisorPDF(fileId, driveUrl, titulo) {
  const visor = $('modalVisorPDF');
  const velo = $('veloVisorPDF');
  const iframe = $('iframePDFVisor');
  const tituloEl = $('tituloPDFVisor');
  const btnDownload = $('btnDescargarPDFModal');

  const embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
  const downloadUrl = `https://docs.google.com/uc?export=download&id=${fileId}`;

  if (visor && velo && iframe) {
    if (tituloEl) tituloEl.textContent = titulo || 'Documento PDF / Libro';
    iframe.src = embedUrl;
    if (btnDownload) {
      btnDownload.href = downloadUrl;
    }
    velo.classList.add('activo');
    visor.style.display = 'flex';
  }
}
window.abrirVisorPDF = abrirVisorPDF;

function cerrarVisorPDF() {
  const visor = $('modalVisorPDF');
  const velo = $('veloVisorPDF');
  const iframe = $('iframePDFVisor');
  if (visor && velo) {
    velo.classList.remove('activo');
    visor.style.display = 'none';
    if (iframe) iframe.src = '';
  }
}
window.cerrarVisorPDF = cerrarVisorPDF;

function cerrarTodosLosModales() {
  document.querySelectorAll('.velo.activo').forEach((el) => el.classList.remove('activo'));
  document.querySelectorAll('.hoja.activo').forEach((el) => el.classList.remove('activo'));
}
window.cerrarTodosLosModales = cerrarTodosLosModales;

document.addEventListener('DOMContentLoaded', () => {
  $('cerrarVisorImagen')?.addEventListener('click', cerrarVisorImagen);
  $('veloVisorImagen')?.addEventListener('click', cerrarVisorImagen);
  $('modalVisorImagen')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalVisorImagen' || e.target.id === 'imgVisorAgrandada') cerrarVisorImagen();
  });

  $('cerrarVisorPDF')?.addEventListener('click', cerrarVisorPDF);
  $('veloVisorPDF')?.addEventListener('click', cerrarVisorPDF);

  // Habilitar la amplificación de fotos al tocar fotos de perfil
  $('ajustesAvatar')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if ($('ajustesAvatar').src) abrirVisorImagen($('ajustesAvatar').src);
  });
  $('p-avatar')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if ($('p-avatar').src) abrirVisorImagen($('p-avatar').src);
  });
  $('chatAvatar')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if ($('chatAvatar').src) abrirVisorImagen($('chatAvatar').src);
  });

  // Atajo de teclado Escape (Esc)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      cerrarVisorImagen();
      cerrarTodosLosModales();
    }
  });
});

function iniciales(nombre) {
  if (!nombre) return '?';
  const p = nombre.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase();
}

function avatarDe(persona) {
  return persona?.avatar_data || 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#efe3fe"/><text x="50%" y="55%" font-size="42" text-anchor="middle" fill="#5b21b6" font-family="sans-serif">${iniciales(persona?.name)}</text></svg>`
  );
}

function tiempoRelativo(fechaISO) {
  const diff = (Date.now() - new Date(fechaISO).getTime()) / 1000;
  if (diff < 60) return 'Justo ahora';
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
  return new Date(fechaISO).toLocaleDateString('es');
}

/* ================= ESTADO GLOBAL DE LA SESIÓN ================= */
let MI_ES_ADMIN = false;

/* ================= ENCUESTA INICIAL DE INTERESES (opcional) ================= */
const LISTA_INTERESES = [
  'Música', 'Cine y series', 'Deportes', 'Viajes', 'Tecnología', 'Arte',
  'Lectura', 'Moda', 'Gastronomía', 'Naturaleza', 'Fotografía', 'Baile',
  'Espiritualidad', 'Negocios', 'Educación', 'Videojuegos', 'Salud y bienestar',
  'Mascotas', 'Política', 'Humor',
];
const LISTA_HOBBIES = [
  'Cocinar', 'Hacer ejercicio', 'Cantar', 'Tocar un instrumento', 'Pintar/dibujar',
  'Jugar videojuegos', 'Leer', 'Ver películas', 'Salir a caminar', 'Pescar',
  'Jardinería', 'Escribir', 'Bailar', 'Nadar', 'Ciclismo', 'Manualidades',
];

let encuestaSeleccion = { intereses: new Set(), hobbies: new Set() };

function pintarChipsSelector(contenedorId, lista, seleccionSet) {
  const cont = $(contenedorId);
  cont.innerHTML = lista.map((etiqueta) => `<div class="chip-toggle ${seleccionSet.has(etiqueta) ? 'seleccionado' : ''}" data-valor="${etiqueta}">${etiqueta}</div>`).join('');
  cont.querySelectorAll('.chip-toggle').forEach((chip) => {
    chip.addEventListener('click', () => {
      const valor = chip.dataset.valor;
      if (seleccionSet.has(valor)) seleccionSet.delete(valor); else seleccionSet.add(valor);
      chip.classList.toggle('seleccionado', seleccionSet.has(valor));
    });
  });
}

function abrirEncuesta() {
  const u = Sesion.usuario();
  encuestaSeleccion = {
    intereses: new Set(Array.isArray(u.interests) ? u.interests : []),
    hobbies: new Set(Array.isArray(u.hobbies) ? u.hobbies : []),
  };
  pintarChipsSelector('encuestaIntereses', LISTA_INTERESES, encuestaSeleccion.intereses);
  pintarChipsSelector('encuestaHobbies', LISTA_HOBBIES, encuestaSeleccion.hobbies);
  $('encuestaProfesion').value = u.profession || '';
  $('encuestaCiudad').value = u.city || '';
  $('encuestaBuscando').value = (u.discovery_prefs && u.discovery_prefs.buscando) || '';
  $('veloEncuesta').classList.add('activo'); $('hojaEncuesta').classList.add('activo');
}
function cerrarEncuesta() { $('veloEncuesta').classList.remove('activo'); $('hojaEncuesta').classList.remove('activo'); }

$('btnGuardarEncuesta').addEventListener('click', async () => {
  try {
    const { user } = await api('/usuarios/me/encuesta', {
      method: 'PUT',
      body: {
        interests: [...encuestaSeleccion.intereses],
        hobbies: [...encuestaSeleccion.hobbies],
        profession: $('encuestaProfesion').value.trim(),
        city: $('encuestaCiudad').value.trim(),
        discovery_prefs: { buscando: $('encuestaBuscando').value || undefined },
      },
    });
    Sesion.actualizarUsuario(user);
    cerrarEncuesta();
    mostrarToast('¡Gracias! Ya estamos afinando tus recomendaciones ✨');
    if ($('vistaFeed').classList.contains('activo')) cargarDescubrir();
  } catch (e) { mostrarToast(e.message); }
});
$('btnOmitirEncuesta').addEventListener('click', async () => {
  cerrarEncuesta();
  try { const { user } = await api('/usuarios/me/encuesta', { method: 'PUT', body: { omitir: true } }); Sesion.actualizarUsuario(user); } catch (e) { /* silencioso */ }
});
$('btnEditarIntereses').addEventListener('click', abrirEncuesta);

/* ================= "¿POR QUÉ SE RECOMIENDA?" ================= */
async function abrirPorqueRecomendado(personaId) {
  $('porque-nivel-texto').textContent = '—';
  $('porque-resumen').textContent = 'Calculando…';
  $('porque-lista').innerHTML = '';
  $('porque-aviso-no-algoritmo').classList.add('oculto');
  $('porque-aviso-no-algoritmo').innerHTML = '';
  $('porque-anillo-relleno').style.strokeDashoffset = '314';
  $('veloPorque').classList.add('activo'); $('hojaPorque').classList.add('activo');
  try {
    const data = await api(`/usuarios/${personaId}/porque-recomendado`);
    pintarExplicacionRecomendacion(data);
  } catch (e) {
    $('porque-resumen').textContent = e.message;
  }
}
function cerrarPorqueRecomendado() { $('veloPorque').classList.remove('activo'); $('hojaPorque').classList.remove('activo'); }
$('cerrarPorque').addEventListener('click', cerrarPorqueRecomendado);
$('veloPorque').addEventListener('click', cerrarPorqueRecomendado);
$('p-porque-btn').addEventListener('click', () => { if (perfilActualId) abrirPorqueRecomendado(perfilActualId); });

const COLORES_NIVEL = { alta: '#22c55e', media: '#9d5cf5', baja: '#a79ac0' };
const TITULOS_NO_ALGORITMO = {
  null: '🔎 No vino de tu feed',
  exploracion_aleatoria: '🎲 Cupo de exploración al azar',
  cuenta_nueva: '🌱 Cupo fijo de cuenta nueva',
};

function pintarExplicacionRecomendacion(data) {
  const { total, nivel, resumen, factores, recomendado_por_algoritmo, origen, nota } = data;
  $('porque-nivel-texto').textContent = recomendado_por_algoritmo === false ? 'n/a' : nivel;
  $('porque-resumen').textContent = recomendado_por_algoritmo === false
    ? resumen
    : `${resumen} (puntaje total: ${total > 0 ? '+' : ''}${total})`;

  const avisoEl = $('porque-aviso-no-algoritmo');
  if (recomendado_por_algoritmo === false) {
    const titulo = TITULOS_NO_ALGORITMO[origen] || TITULOS_NO_ALGORITMO.null;
    avisoEl.innerHTML = `<b>${titulo}</b>${nota || ''}`;
    avisoEl.classList.remove('oculto');
  } else {
    avisoEl.classList.add('oculto');
    avisoEl.innerHTML = '';
  }

  const circunferencia = 314;
  const anillo = $('porque-anillo-relleno');
  if (recomendado_por_algoritmo === false) {
    anillo.style.stroke = 'var(--texto-400)';
    requestAnimationFrame(() => { anillo.style.strokeDashoffset = String(circunferencia); });
  } else {
    const pct = Math.max(4, Math.min(100, Math.round(((total + 40) / 120) * 100)));
    anillo.style.stroke = COLORES_NIVEL[nivel] || 'var(--morado-600)';
    requestAnimationFrame(() => { anillo.style.strokeDashoffset = String(circunferencia - (circunferencia * pct) / 100); });
  }

  if (!factores.length) {
    $('porque-lista').innerHTML = '<div class="aviso-vacio">Todavía no hay suficientes señales para calcular esto.</div>';
    return;
  }
  const maxAbs = Math.max(...factores.map((f) => Math.abs(f.puntos)), 1);
  $('porque-lista').innerHTML = factores.map((f) => `
    <div class="factor-fila">
      <div class="factor-fila-top">
        <div>
          <div class="factor-etiqueta">${f.etiqueta}</div>
          ${f.detalle ? `<div class="factor-detalle">${f.detalle}</div>` : ''}
        </div>
        <div class="factor-punto ${f.tipo}">${f.puntos > 0 ? '+' : ''}${f.puntos}</div>
      </div>
      <div class="factor-barra-fondo"><div class="factor-barra ${f.tipo}" data-ancho="${Math.round((Math.abs(f.puntos) / maxAbs) * 100)}"></div></div>
    </div>`).join('');
  requestAnimationFrame(() => {
    document.querySelectorAll('#porque-lista .factor-barra').forEach((b) => { b.style.width = `${b.dataset.ancho}%`; });
  });
}

/* ================= MODO OSCURO / CLARO ================= */
const CLAVE_TEMA = 'enlace_tema';
function aplicarTema(tema) {
  document.documentElement.setAttribute('data-tema', tema);
  const interruptor = $('interruptorTema');
  if (interruptor) interruptor.classList.toggle('activo', tema === 'oscuro');
}
function iniciarTema() {
  const guardado = localStorage.getItem(CLAVE_TEMA);
  const preferido = guardado || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro');
  aplicarTema(preferido);
}
iniciarTema();
$('interruptorTema')?.addEventListener('click', () => {
  const actual = document.documentElement.getAttribute('data-tema') === 'oscuro' ? 'claro' : 'oscuro';
  localStorage.setItem(CLAVE_TEMA, actual);
  aplicarTema(actual);
});

/* ================= BADGES: verificado y reputación ================= */
const SVG_CHECK_VERIFICADO = '<svg viewBox="0 0 24 24" fill="#3897f0" style="width:16px; height:16px; vertical-align:middle; margin-left:3px;"><circle cx="12" cy="12" r="11"/><path d="M8.2 12.3l2.6 2.6 5.4-5.6" stroke="#fff" stroke-width="2.1" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function badgeVerificado(persona) {
  let extra = '';
  if (persona?.is_creador || persona?.is_admin) {
    extra += `<span class="badge-creador" title="Creador" style="margin-left:4px; font-size:14px;">👑 <span style="font-size:11px; font-weight:700; color:var(--morado-700);">Creador</span></span>`;
  }
  if (persona?.verified) {
    extra += `<span class="badge-verificado" title="Cuenta verificada">${SVG_CHECK_VERIFICADO}</span>`;
  }
  return extra;
}
function nombreConBadge(persona) {
  return `<span class="nombre-con-badge">${persona?.name || ''}${badgeVerificado(persona)}</span>`;
}
function chipReputacion(rep) {
  if (!rep) return '';
  return `<div class="chip-reputacion ${rep.color}"><span class="punto"></span>${rep.nivel}</div>`;
}

/* ================= AUTENTICACIÓN ================= */
$('tabLogin').addEventListener('click', () => cambiarTabAuth('login'));
$('tabRegistro').addEventListener('click', () => cambiarTabAuth('registro'));
function cambiarTabAuth(cual) {
  $('tabLogin').classList.toggle('activo', cual === 'login');
  $('tabRegistro').classList.toggle('activo', cual === 'registro');
  $('vistaLogin').classList.toggle('activo', cual === 'login');
  $('vistaRegistro').classList.toggle('activo', cual === 'registro');
}

$('btnLogin').addEventListener('click', async () => {
  $('loginError').textContent = '';
  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value;
  if (!email || !password) { $('loginError').textContent = 'Completa correo y contraseña.'; return; }
  try {
    const { token, user } = await api('/auth/login', { method: 'POST', body: { email, password }, sinAuth: true });
    Sesion.guardar(token, user);
    iniciarApp();
  } catch (e) { $('loginError').textContent = e.message; }
});

$('btnRegistro').addEventListener('click', async () => {
  $('regError').textContent = '';
  const body = {
    name: $('regNombre').value.trim(),
    username: $('regUsername').value.trim(),
    email: $('regEmail').value.trim(),
    password: $('regPassword').value,
    birthdate: $('regNacimiento').value || null,
    gender: $('regGenero').value,
    city: $('regCiudad').value.trim(),
  };
  if (!body.name || !body.username || !body.email || !body.password) { $('regError').textContent = 'Completa nombre, usuario, correo y contraseña.'; return; }
  try {
    const { token, user } = await api('/auth/registro', { method: 'POST', body, sinAuth: true });
    Sesion.guardar(token, user);
    iniciarApp();
  } catch (e) { $('regError').textContent = e.message; }
});

/* ================= CONFIGURACIÓN Y DISPONIBILIDAD DE IA ================= */
let AI_CONFIG = { available: false, name: 'Link AI', avatar: '' };

async function comprobarAIConfig() {
  try {
    const res = await api('/ai/config');
    window.AI_CONFIG = res;
  } catch (e) {
    window.AI_CONFIG = { available: false, name: 'Link AI', avatar: '' };
  }
}

/* ================= ARRANQUE DE LA APP ================= */
async function iniciarApp() {
  $('authScreen').classList.add('oculto');
  $('appShell').classList.remove('oculto');

  conectarSocket();
  await refrescarMiPerfil();
  await comprobarAIConfig();
  cargarDescubrir();
  cargarEstados();
  cargarNotificaciones();
  cargarSolicitudesBadge();
  comprobarAnuncioActivo();

  // Escuchar estado de conexión a internet
  window.addEventListener('online', () => $('bannerRed').classList.add('oculto'));
  window.addEventListener('offline', () => $('bannerRed').classList.remove('oculto'));

  const u = Sesion.usuario();
  if (u && !u.encuesta_completada_at && !u.encuesta_omitida) {
    setTimeout(abrirEncuesta, 500);
  }
}

/* ================= AUDIO SINTETIZADOR Y VIBRACIÓN ================= */
class SonidosYVibracion {
  static ctx = null;

  static initContext() {
    if (!SonidosYVibracion.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) SonidosYVibracion.ctx = new AudioCtx();
    }
    if (SonidosYVibracion.ctx && SonidosYVibracion.ctx.state === 'suspended') {
      SonidosYVibracion.ctx.resume().catch(() => {});
    }
  }

  static reproducirNotificacion() {
    SonidosYVibracion.initContext();
    SonidosYVibracion.vibrar([150, 80, 150]);
    if (!SonidosYVibracion.ctx) return;

    try {
      const now = SonidosYVibracion.ctx.currentTime;
      const osc = SonidosYVibracion.ctx.createOscillator();
      const gain = SonidosYVibracion.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(SonidosYVibracion.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) { /* silencioso */ }
  }

  static reproducirMensaje() {
    SonidosYVibracion.initContext();
    SonidosYVibracion.vibrar([100]);
    if (!SonidosYVibracion.ctx) return;

    try {
      const now = SonidosYVibracion.ctx.currentTime;
      const osc = SonidosYVibracion.ctx.createOscillator();
      const gain = SonidosYVibracion.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(SonidosYVibracion.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) { /* silencioso */ }
  }

  static reproducirLlamadaEntrante() {
    SonidosYVibracion.initContext();
    SonidosYVibracion.vibrar([400, 200, 400, 200, 400]);
    if (!SonidosYVibracion.ctx) return;

    try {
      const now = SonidosYVibracion.ctx.currentTime;
      const osc = SonidosYVibracion.ctx.createOscillator();
      const gain = SonidosYVibracion.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(480, now + 0.2);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain);
      gain.connect(SonidosYVibracion.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.6);
    } catch (e) { /* silencioso */ }
  }

  static vibrar(patron) {
    if ('vibrate' in navigator) {
      try { navigator.vibrate(patron); } catch (e) {}
    }
  }
}

window.SonidosYVibracion = SonidosYVibracion;

// Desbloquear AudioContext en la primera interacción del usuario
document.addEventListener('click', () => SonidosYVibracion.initContext(), { once: true });
document.addEventListener('touchstart', () => SonidosYVibracion.initContext(), { once: true });

function solicitarPermisoNotificaciones() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}
window.solicitarPermisoNotificaciones = solicitarPermisoNotificaciones;

async function mostrarNotificacionNativa(titulo, opciones) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const defaultOpts = {
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    renotify: true,
    tag: 'enlace-notification',
    data: { url: '/' },
    ...opciones,
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(titulo, defaultOpts);
        return;
      }
    }
    new Notification(titulo, defaultOpts);
  } catch (e) {
    try {
      new Notification(titulo, { body: defaultOpts.body, icon: defaultOpts.icon });
    } catch (err) {
      console.warn('No se pudo mostrar la notificación nativa:', err);
    }
  }
}
window.mostrarNotificacionNativa = mostrarNotificacionNativa;

function conectarSocket() {
  if (window.socket) {
    try { window.socket.disconnect(); } catch (e) {}
  }
  window.socket = io({ auth: { token: Sesion.token() } });
  Chat.enlazarSocket(window.socket);
  Llamada.enlazarSocket(window.socket);
  solicitarPermisoNotificaciones();

  window.socket.on('notificacion:nueva', (n) => {
    mostrarToast(n.text);
    SonidosYVibracion.reproducirNotificacion();
    pintarBadgeCampana(true);
    if ($('vistaContactos').classList.contains('activo')) cargarAmigosYSolicitudes();

    if (document.hidden || !document.hasFocus()) {
      mostrarNotificacionNativa('Link', {
        body: n.text,
        tag: 'notificacion-' + (n.id || Date.now()),
        data: { url: '/' }
      });
    }
  });
  window.socket.on('connect_error', (err) => {
    console.warn('Socket no pudo conectar:', err.message);
  });
}

async function refrescarMiPerfil() {
  try {
    const { user } = await api('/auth/yo');
    Sesion.actualizarUsuario(user);
    $('ajustesAvatar').src = avatarDe(user);
    $('ajustesNombre').innerHTML = nombreConBadge(user);
    MI_ES_ADMIN = !!user.is_admin;
    $('btnPanelAdmin').classList.toggle('oculto', !MI_ES_ADMIN);
  } catch (e) { /* token vencido ya redirige */ }
}

/* ================= ANUNCIO GLOBAL ACTIVO (popup para usuarios) ================= */
async function comprobarAnuncioActivo() {
  try {
    const { anuncio } = await api('/anuncios/activo');
    if (anuncio) {
      $('anuncioTitulo').textContent = anuncio.title || 'Anuncio oficial';
      $('anuncioTexto').textContent = anuncio.content || '';
      $('btnCerrarAnuncio').onclick = async () => {
        $('veloAnuncio').classList.remove('activo');
        $('hojaAnuncio').classList.remove('activo');
        await api(`/anuncios/${anuncio.id}/visto`, { method: 'POST' }).catch(() => {});
      };
      $('veloAnuncio').classList.add('activo');
      $('hojaAnuncio').classList.add('activo');
    }
  } catch (e) { /* silencioso */ }
}

/* ================= NAVEGACIÓN POR PESTAÑAS ================= */
document.querySelectorAll('nav.tabbar .tab').forEach((tab) => {
  tab.addEventListener('click', () => cambiarVista(tab.dataset.tab));
});

function cambiarVista(nombre) {
  cerrarTodosLosModales();
  if (typeof finalizarConteoPerfil === 'function') finalizarConteoPerfil();
  document.querySelectorAll('nav.tabbar .tab').forEach((t) => t.classList.toggle('activo', t.dataset.tab === nombre));
  document.querySelectorAll('.vista-app').forEach((v) => v.classList.toggle('activo', v.dataset.vista === nombre));

  // Refrescar siempre desde la API al cambiar de pestaña
  if (nombre === 'feed') {
    if (!$('inputBuscar').value.trim()) {
      cargarDescubrir();
    }
  }
  if (nombre === 'contactos') {
    cargarAmigosYSolicitudes();
  }
  if (nombre === 'mensajes') {
    cargarConversaciones();
  }
  if (nombre === 'ailab') {
    if (window.AILab) window.AILab.loadCharacters();
  }
}

/* ================= PUBLICACIONES ================= */
let imagenCompositorBase64 = null;
$('pCompImagenInput')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    imagenCompositorBase64 = await archivoABase64(file, 1000, 0.72);
    $('pCompPreview').src = imagenCompositorBase64;
    $('pCompPreview').classList.add('activo');
  } catch (err) { mostrarToast('No se pudo procesar la imagen.'); }
});

$('pBtnPublicar')?.addEventListener('click', async () => {
  const texto = $('pCompTexto').value.trim();
  const visibilidad = $('pCompVisibilidad') ? $('pCompVisibilidad').value : 'public';
  if (!texto && !imagenCompositorBase64) { mostrarToast('Escribe algo o añade una foto.'); return; }
  try {
    await api('/publicaciones', { method: 'POST', body: { text: texto, image_base64: imagenCompositorBase64, visibility: visibilidad } });
    $('pCompTexto').value = '';
    imagenCompositorBase64 = null;
    $('pCompPreview').classList.remove('activo');
    $('pCompPreview').src = '';
    mostrarToast('Publicado ✅ — ya aparece en tu perfil');
    abrirPerfil(perfilActualId);
  } catch (e) { mostrarToast(e.message); }
});

function renderizarPublicacionesPerfil(publicaciones, contenedorId) {
  const cont = $(contenedorId);
  if (!publicaciones.length) {
    cont.innerHTML = '<div class="aviso-vacio">Todavía no ha publicado nada.</div>';
    return;
  }
  cont.innerHTML = publicaciones.map(pintarPublicacion).join('');
  cont.querySelectorAll('.publicacion-accion[data-accion="like"]').forEach((btn) => {
    btn.addEventListener('click', () => alternarLike(btn.dataset.id));
  });
  cont.querySelectorAll('.btn-emoji-reaccionar').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      alternarEmojiPost(btn.dataset.id, btn.dataset.emoji);
    });
  });
  cont.querySelectorAll('.publicacion-accion[data-accion="comentar"]').forEach((btn) => {
    btn.addEventListener('click', () => alternarComentarios(btn.dataset.id));
  });
  cont.querySelectorAll('.publicacion-accion[data-accion="guardar"]').forEach((btn) => {
    btn.addEventListener('click', () => alternarGuardarPost(btn.dataset.id));
  });
  cont.querySelectorAll('.publicacion-accion[data-accion="compartir"]').forEach((btn) => {
    btn.addEventListener('click', () => compartirPost(btn.dataset.id));
  });
}

function pintarPublicacion(p) {
  const yo = Sesion.usuario();
  const esDueno = yo && p.user_id === yo.id;
  const puedeModerar = esDueno || MI_ES_ADMIN;
  return `
    <div class="publicacion" id="post-${p.id}">
      <div class="publicacion-header">
        <img src="${avatarDe({ avatar_data: p.autor_avatar, name: p.autor_nombre })}" alt="">
        <div>
          <div class="nombre">${p.autor_nombre}</div>
          <div class="fecha">${tiempoRelativo(p.created_at)} ${p.visibility === 'friends' ? '🔒 Solo amigos' : '🌐 Público'}</div>
        </div>
      </div>
      ${p.text ? `<div class="publicacion-texto">${procesarTextosYDriveLinks(p.text)}</div>` : ''}
      ${p.image_data ? `<img class="publicacion-img" src="${p.image_data}" alt="" style="cursor:pointer;" onclick="window.abrirVisorImagen('${p.image_data.replace(/'/g, "\\'")}')">` : ''}
      ${p.edited_at ? `<div class="etiqueta-editado">Editada por un administrador</div>` : ''}
      ${puedeModerar ? `
        <div class="publicacion-mod">
          <div class="mini-btn secundario" onclick="editarPublicacionAccion('${p.id}', ${JSON.stringify(p.text || '').replace(/"/g, '&quot;')})">Editar</div>
          <div class="mini-btn peligro" onclick="borrarPublicacionAccion('${p.id}')">Borrar</div>
        </div>` : ''}
      <div style="display:flex; justify-content:space-around; padding:6px 10px; background:var(--hueso); border-top:1px solid var(--linea); font-size:16px;">
        <span class="btn-emoji-reaccionar" data-id="${p.id}" data-emoji="👍" style="cursor:pointer;" title="Me gusta">👍</span>
        <span class="btn-emoji-reaccionar" data-id="${p.id}" data-emoji="❤️" style="cursor:pointer;" title="Me encanta">❤️</span>
        <span class="btn-emoji-reaccionar" data-id="${p.id}" data-emoji="😂" style="cursor:pointer;" title="Me meo de risa">😂</span>
        <span class="btn-emoji-reaccionar" data-id="${p.id}" data-emoji="😮" style="cursor:pointer;" title="Me asombra">😮</span>
        <span class="btn-emoji-reaccionar" data-id="${p.id}" data-emoji="😢" style="cursor:pointer;" title="Me entristece">😢</span>
        <span class="btn-emoji-reaccionar" data-id="${p.id}" data-emoji="🔥" style="cursor:pointer;" title="Fuego">🔥</span>
      </div>
      <div class="publicacion-acciones">
        <div class="publicacion-accion ${p.me_gusta ? 'activo' : ''}" data-accion="like" data-id="${p.id}">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="${p.me_gusta ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg>
          <span id="likes-${p.id}">${p.total_likes}</span>
        </div>
        <div class="publicacion-accion" data-accion="comentar" data-id="${p.id}">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5Z"/></svg>
          <span>${p.total_comentarios}</span>
        </div>
        <div class="publicacion-accion ${p.guardada ? 'activo' : ''}" data-accion="guardar" data-id="${p.id}" title="Guardar">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="${p.guardada ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div class="publicacion-accion" data-accion="compartir" data-id="${p.id}" title="Compartir">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        </div>
      </div>
      <div class="comentarios-caja" id="comentarios-${p.id}">
        <div class="lista-comentarios" id="lista-comentarios-${p.id}"></div>
        <div class="comentario-input-fila">
          <input type="text" placeholder="Escribe un comentario…" id="input-comentario-${p.id}">
          <div class="mini-btn primario" onclick="enviarComentario('${p.id}')">Enviar</div>
        </div>
      </div>
    </div>`;
}

function escaparHTMLGlobal(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function procesarTextosYDriveLinks(texto) {
  if (!texto) return '';
  const driveRegex = /https?:\/\/(?:drive|docs)\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?id=([a-zA-Z0-9_-]+)|uc\?(?:[^&]+&)*id=([a-zA-Z0-9_-]+))[^\s]*/gi;

  let html = escapingTextAndUrls(texto);
  const matches = [...texto.matchAll(driveRegex)];

  if (matches.length > 0) {
    matches.forEach((match) => {
      const fullUrl = match[0];
      const fileId = match[1] || match[2] || match[3];
      if (!fileId) return;

      const isVideo = /video|\.mp4|\.mov|\.avi|\.mkv|\.webm/i.test(fullUrl);
      const isPdf = /pdf|book|libro|\.pdf/i.test(fullUrl);
      const isAudio = /audio|\.mp3|\.wav|\.m4a|\.ogg/i.test(fullUrl);

      const imgPreviewUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
      const videoEmbedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
      const downloadUrl = `https://docs.google.com/uc?export=download&id=${fileId}`;

      let replacement = '';
      if (isPdf) {
        replacement = `
          <div class="drive-media-card pdf-card" style="margin-top:8px; padding:12px; background:var(--morado-50); border:1px solid var(--borde); border-radius:14px;">
            <div style="font-weight:700; font-size:13px; display:flex; align-items:center; gap:6px; color:var(--morado-700);">
              📄 Documento / Libro PDF (Google Drive)
            </div>
            <div style="font-size:11.5px; color:var(--texto-600); margin:6px 0;">Visualiza hoja por hoja o descárgalo a tu dispositivo.</div>
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">
              <button class="btn btn-primario mini-btn" style="padding:6px 12px; font-size:12px; border-radius:8px;" onclick="window.abrirVisorPDF('${fileId}', '${fullUrl.replace(/'/g, "\\'")}', 'Libro / PDF')">
                📖 Abrir libro (Hoja por hoja)
              </button>
              <a href="${downloadUrl}" target="_blank" download class="btn btn-secundario mini-btn" style="padding:6px 12px; font-size:12px; border-radius:8px; text-decoration:none;">
                📥 Descargar
              </a>
            </div>
          </div>
        `;
      } else if (isVideo) {
        replacement = `
          <div class="drive-media-card video-card" style="margin-top:8px; padding:12px; background:rgba(0,0,0,0.05); border:1px solid var(--linea); border-radius:14px;">
            <div style="font-weight:700; font-size:13px; display:flex; align-items:center; gap:6px; color:var(--morado-700);">
              🎬 Video de Google Drive
            </div>
            <div style="font-size:11.5px; color:var(--texto-600); margin:4px 0 8px;">Reproduce online o descárgalo directamente.</div>
            <div id="drive-video-container-${fileId}" style="margin-bottom:6px;">
              <button class="btn btn-primario mini-btn" style="padding:6px 12px; font-size:12px; border-radius:8px;" onclick="window.reproducirVideoDrive(event, '${fileId}', '${videoEmbedUrl.replace(/'/g, "\\'")}')">
                ▶ Reproducir video
              </button>
            </div>
            <a href="${downloadUrl}" target="_blank" download class="btn btn-secundario mini-btn" style="padding:6px 12px; font-size:12px; border-radius:8px; text-decoration:none; display:inline-block;">
              📥 Descargar video
            </a>
          </div>
        `;
      } else if (isAudio) {
        replacement = `
          <div class="drive-media-card audio-card" style="margin-top:8px; padding:12px; background:var(--hueso); border:1px solid var(--borde); border-radius:14px;">
            <div style="font-weight:700; font-size:13px; color:var(--morado-700); margin-bottom:6px;">
              🎵 Audio de Google Drive
            </div>
            <audio controls src="${downloadUrl}" style="width:100%; height:36px; margin-bottom:6px;"></audio>
            <a href="${downloadUrl}" target="_blank" download class="btn btn-secundario mini-btn" style="padding:6px 12px; font-size:12px; border-radius:8px; text-decoration:none; display:inline-block;">
              📥 Descargar audio
            </a>
          </div>
        `;
      } else {
        replacement = `
          <div class="drive-media-card photo-card" style="margin-top:8px; padding:8px; background:var(--blanco); border:1px solid var(--borde); border-radius:14px;">
            <div style="font-size:11.5px; font-weight:700; color:var(--morado-700); margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
              <span>🖼️ Foto de Google Drive</span>
              <a href="${downloadUrl}" target="_blank" download style="color:var(--morado-600); text-decoration:none; font-size:11px;">📥 Descargar</a>
            </div>
            <img src="${imgPreviewUrl}" alt="Foto de Google Drive" style="max-width:100%; max-height:280px; object-fit:cover; border-radius:10px; cursor:pointer;" onclick="window.abrirVisorImagen('${imgPreviewUrl.replace(/'/g, "\\'")}')" onerror="this.onerror=null; this.src='https://docs.google.com/uc?export=view&id=${fileId}'">
          </div>
        `;
      }

      // Reemplazar la URL completa directamente por el elemento o tarjeta multimedia, sin forzar al usuario a ver la URL ni el enlace chip
      html = html.replace(fullUrl, replacement);
    });
  }
  return html;
}

function escapingTextAndUrls(texto) {
  const d = document.createElement('div');
  d.textContent = texto;
  const safe = d.innerHTML;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return safe.replace(urlRegex, (url) => {
    try {
      const domain = new URL(url).hostname;
      return `<a href="${url}" target="_blank" class="chip-link-url" onclick="event.stopPropagation()">🔗 ${domain}</a>`;
    } catch (e) {
      return `<a href="${url}" target="_blank" class="chip-link-url" onclick="event.stopPropagation()">${url}</a>`;
    }
  });
}

window.procesarTextosYDriveLinks = procesarTextosYDriveLinks;

function renderizarLivePhotoHTML(imgUrl, isLive) {
  if (!imgUrl) return '';
  if (!isLive) {
    return `<img src="${imgUrl}" alt="" style="cursor:pointer; max-width:100%; border-radius:10px; margin-top:4px;" onclick="window.abrirVisorImagen('${imgUrl.replace(/'/g, "\\'")}')">`;
  }
  return `
    <div class="live-photo-container" ontouchstart="window.iniciarAnimacionLive(this)" ontouchend="window.detenerAnimacionLive(this)" onmouseenter="window.iniciarAnimacionLive(this)" onmouseleave="window.detenerAnimacionLive(this)">
      <div class="live-photo-badge" onclick="window.toggleAnimacionLive(this)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>
        <span>LIVE</span>
      </div>
      <img src="${imgUrl}" alt="Live Photo" class="live-photo-img" style="cursor:pointer; max-width:100%; border-radius:10px;" onclick="window.abrirVisorImagen('${imgUrl.replace(/'/g, "\\'")}')">
    </div>
  `;
}
window.renderizarLivePhotoHTML = renderizarLivePhotoHTML;

window.iniciarAnimacionLive = function(container) {
  if (container) container.classList.add('live-photo-animating');
};
window.detenerAnimacionLive = function(container) {
  if (container) setTimeout(() => container.classList.remove('live-photo-animating'), 300);
};
window.toggleAnimacionLive = function(badge) {
  const container = badge ? badge.closest('.live-photo-container') : null;
  if (container) {
    container.classList.add('live-photo-animating');
    setTimeout(() => container.classList.remove('live-photo-animating'), 1200);
  }
};

window.reproducirVideoDrive = function(e, fileId, embedUrl) {
  e.stopPropagation();
  if (confirm('¿Deseas dar permiso para reproducir este video de Google Drive?')) {
    const cont = document.getElementById(`drive-video-container-${fileId}`);
    if (cont) {
      cont.innerHTML = `<iframe src="${embedUrl}" width="100%" height="220" style="border:none; border-radius:10px; margin-top:6px;" allow="autoplay" allowfullscreen></iframe>`;
    }
  }
};

async function alternarLike(postId) {
  try {
    const { me_gusta } = await api(`/publicaciones/${postId}/like`, { method: 'POST' });
    const btn = document.querySelector(`.publicacion-accion[data-id="${postId}"][data-accion="like"]`);
    if (btn) btn.classList.toggle('activo', me_gusta);
    const span = $(`likes-${postId}`);
    if (span) span.textContent = parseInt(span.textContent || '0') + (me_gusta ? 1 : -1);
  } catch (e) { mostrarToast(e.message); }
}

async function alternarEmojiPost(postId, emoji) {
  try {
    const res = await api(`/publicaciones/${postId}/reaccion-emoji`, { method: 'POST', body: { emoji } });
    mostrarToast(res.reaccion ? `Reaccionaste con ${res.reaccion}` : 'Reacción quitada');
  } catch (e) { mostrarToast(e.message); }
}

async function alternarGuardarPost(postId) {
  try {
    const { guardada } = await api(`/publicaciones/${postId}/guardar`, { method: 'POST' });
    const btn = document.querySelector(`.publicacion-accion[data-id="${postId}"][data-accion="guardar"]`);
    if (btn) btn.classList.toggle('activo', guardada);
    mostrarToast(guardada ? 'Publicación guardada' : 'Quitada de guardados');
  } catch (e) { mostrarToast(e.message); }
}

function compartirPost(postId) {
  const url = `${window.location.origin}/#post-${postId}`;
  if (navigator.share) {
    navigator.share({ title: 'Publicación en Link', url });
  } else {
    navigator.clipboard.writeText(url);
    mostrarToast('Enlace de la publicación copiado 🔗');
  }
}

async function cargarGuardados() {
  try {
    const { publicaciones } = await api('/publicaciones/guardadas');
    const cont = $('listaGuardados');
    if (!publicaciones.length) {
      cont.innerHTML = '<div class="aviso-vacio">No tienes publicaciones guardadas.</div>';
      return;
    }
    renderizarPublicacionesPerfil(publicaciones, 'listaGuardados');
  } catch (e) { $('listaGuardados').innerHTML = `<div class="aviso-vacio">${e.message}</div>`; }
}
$('btnGuardados')?.addEventListener('click', () => {
  cargarGuardados();
  $('veloGuardados').classList.add('activo'); $('hojaGuardados').classList.add('activo');
});
$('cerrarGuardados')?.addEventListener('click', () => { $('veloGuardados').classList.remove('activo'); $('hojaGuardados').classList.remove('activo'); });
$('veloGuardados')?.addEventListener('click', () => { $('veloGuardados').classList.remove('activo'); $('hojaGuardados').classList.remove('activo'); });

async function alternarComentarios(postId) {
  const caja = $(`comentarios-${postId}`);
  const activo = caja.classList.toggle('activo');
  if (activo) await cargarComentarios(postId);
}

async function cargarComentarios(postId) {
  try {
    const { comentarios } = await api(`/publicaciones/${postId}/comentarios`);
    $(`lista-comentarios-${postId}`).innerHTML = comentarios.map((c) => `
      <div class="comentario-item">
        <img src="${avatarDe({ avatar_data: c.autor_avatar, name: c.autor_nombre })}" alt="">
        <div><b>${c.autor_nombre}</b>${escaparHTMLGlobal(c.text)}</div>
      </div>`).join('') || '<div style="color:var(--texto-500); font-size:12.5px; padding:6px 0;">Sé el primero en comentar.</div>';
  } catch (e) { mostrarToast(e.message); }
}

async function enviarComentario(postId) {
  const input = $(`input-comentario-${postId}`);
  const texto = input.value.trim();
  if (!texto) return;
  try {
    await api(`/publicaciones/${postId}/comentarios`, { method: 'POST', body: { text: texto } });
    input.value = '';
    cargarComentarios(postId);
    const contador = document.querySelector(`.publicacion-accion[data-id="${postId}"][data-accion="comentar"] span`);
    if (contador) contador.textContent = parseInt(contador.textContent || '0') + 1;
  } catch (e) { mostrarToast(e.message); }
}
window.enviarComentario = enviarComentario;

/* ================= MODERAR PUBLICACIONES ================= */
async function editarPublicacionAccion(postId, textoActual) {
  const nuevo = prompt('Editar publicación:', textoActual || '');
  if (nuevo === null || !nuevo.trim()) return;
  try {
    const { editado_por_admin } = await api(`/publicaciones/${postId}`, { method: 'PUT', body: { text: nuevo.trim() } });
    mostrarToast(editado_por_admin ? 'Publicación editada por un administrador' : 'Publicación actualizada');
    if (perfilActualId) abrirPerfil(perfilActualId);
  } catch (e) { mostrarToast(e.message); }
}
async function borrarPublicacionAccion(postId) {
  if (!confirm('¿Seguro que quieres borrar esta publicación? No se puede deshacer.')) return;
  try {
    const { borrado_por_admin } = await api(`/publicaciones/${postId}`, { method: 'DELETE' });
    mostrarToast(borrado_por_admin ? 'Publicación borrada por un administrador' : 'Publicación borrada');
    if (perfilActualId) abrirPerfil(perfilActualId);
  } catch (e) { mostrarToast(e.message); }
}
window.editarPublicacionAccion = editarPublicacionAccion;
window.borrarPublicacionAccion = borrarPublicacionAccion;

/* ================= ESTADOS (historias 24h) ================= */
async function cargarEstados() {
  try {
    const { estados } = await api('/estados');
    const yo = Sesion.usuario();
    const propios = estados.filter((e) => e.user_id === yo.id);
    const ajenos = estados.filter((e) => e.user_id !== yo.id);

    let html = `
      <div class="item-estado" id="miEstadoItem">
        <div class="anillo-estado ${propios.length ? '' : 'mio'} plus">
          <img src="${avatarDe(yo)}" alt="">
          <div class="signo">+</div>
        </div>
        <span>Tu estado</span>
      </div>`;
    html += ajenos.map((e) => `
      <div class="item-estado" data-estado='${JSON.stringify({ id: e.id, user_id: e.user_id, autor_nombre: e.autor_nombre, autor_avatar: e.autor_avatar, text: e.text, image_data: e.image_data }).replace(/'/g, '&apos;')}'>
        <div class="anillo-estado"><img src="${avatarDe({ avatar_data: e.autor_avatar, name: e.autor_nombre })}" alt=""></div>
        <span>${e.autor_nombre.split(' ')[0]}</span>
      </div>`).join('');
    $('barraEstados').innerHTML = html;

    $('miEstadoItem').addEventListener('click', () => {
      if (propios.length) {
        verEstado(propios[0]);
      } else {
        $('veloEstado').classList.add('activo'); $('hojaEstado').classList.add('activo');
      }
    });
    document.querySelectorAll('.item-estado[data-estado]').forEach((el) => {
      el.addEventListener('click', () => {
        const data = JSON.parse(el.dataset.estado.replace(/&apos;/g, "'"));
        verEstado(data);
      });
    });
  } catch (e) { console.error(e); }
}

function verEstado(data) {
  const yo = Sesion.usuario();
  $('ve-avatar').src = avatarDe({ avatar_data: data.autor_avatar, name: data.autor_nombre });
  $('ve-nombre').textContent = data.autor_nombre;
  $('ve-texto').textContent = data.text || '';
  if (data.image_data) { $('ve-imagen').src = data.image_data; $('ve-imagen').style.display = 'block'; }
  else { $('ve-imagen').style.display = 'none'; }

  const esDuenoOAdmin = (data.user_id === yo?.id) || MI_ES_ADMIN;
  $('ve-acciones').style.display = esDuenoOAdmin ? 'block' : 'none';
  if (esDuenoOAdmin) {
    $('btnBorrarEstado').onclick = async () => {
      if (!confirm('¿Quieres borrar este estado?')) return;
      try {
        await api(`/estados/${data.id}`, { method: 'DELETE' });
        mostrarToast('Estado borrado');
        $('veloVerEstado').classList.remove('activo'); $('hojaVerEstado').classList.remove('activo');
        cargarEstados();
        if (perfilActualId) abrirPerfil(perfilActualId);
      } catch (e) { mostrarToast(e.message); }
    };
  }

  api(`/estados/${data.id}/visto`, { method: 'POST' }).catch(() => {});
  $('veloVerEstado').classList.add('activo'); $('hojaVerEstado').classList.add('activo');
}
$('cerrarVerEstado').addEventListener('click', () => { $('veloVerEstado').classList.remove('activo'); $('hojaVerEstado').classList.remove('activo'); });
$('veloVerEstado').addEventListener('click', () => { $('veloVerEstado').classList.remove('activo'); $('hojaVerEstado').classList.remove('activo'); });

let estadoImagenBase64 = null;
$('estadoImagenInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  estadoImagenBase64 = await archivoABase64(file, 900, 0.7);
  $('estadoPreview').src = estadoImagenBase64;
  $('estadoPreview').classList.add('activo');
});
$('btnPublicarEstado').addEventListener('click', async () => {
  const texto = $('nuevoEstadoTexto').value.trim();
  const duration_hours = parseInt($('nuevoEstadoDuracion')?.value || '24');
  if (!texto && !estadoImagenBase64) { mostrarToast('Escribe algo para tu estado.'); return; }
  try {
    await api('/estados', { method: 'POST', body: { text: texto, image_base64: estadoImagenBase64, duration_hours } });
    $('nuevoEstadoTexto').value = ''; estadoImagenBase64 = null;
    $('estadoPreview').classList.remove('activo'); $('estadoPreview').src = '';
    $('veloEstado').classList.remove('activo'); $('hojaEstado').classList.remove('activo');
    mostrarToast('Estado publicado, estará visible 24h');
    cargarEstados();
    if (perfilActualId) abrirPerfil(perfilActualId);
  } catch (e) { mostrarToast(e.message); }
});
$('cerrarEstado').addEventListener('click', () => { $('veloEstado').classList.remove('activo'); $('hojaEstado').classList.remove('activo'); });
$('veloEstado').addEventListener('click', () => { $('veloEstado').classList.remove('activo'); $('hojaEstado').classList.remove('activo'); });

/* ================= DESCUBRIR / BUSCAR PERSONAS ================= */
let temporizadorBusqueda = null;
$('inputBuscar').addEventListener('input', () => {
  clearTimeout(temporizadorBusqueda);
  temporizadorBusqueda = setTimeout(() => {
    const q = $('inputBuscar').value.trim();
    q ? buscarPersonas(q) : cargarDescubrir();
  }, 350);
});

$('filtroGenero')?.addEventListener('change', () => cargarDescubrir());
$('filtroOnline')?.addEventListener('change', () => cargarDescubrir());

let reqIdDescubrir = 0;
async function cargarDescubrir() {
  const currentReq = ++reqIdDescubrir;
  const genero = $('filtroGenero') ? $('filtroGenero').value : '';
  const soloOnline = $('filtroOnline') ? ($('filtroOnline').value === 'online') : false;

  const cachedFeed = await LocalStore.obtenerLista('feed', 'descubrir_feed');
  let renderizadoCache = false;

  if (cachedFeed && cachedFeed.length && currentReq === reqIdDescubrir) {
    let filtradas = cachedFeed;
    if (genero) filtradas = filtradas.filter(p => p.gender === genero);
    if (soloOnline) filtradas = filtradas.filter(p => p.is_online);
    if ($('listaBuscar').children.length === 0 || $('listaBuscar').querySelector('.aviso-vacio')) {
      pintarListaPersonas(filtradas, 'listaBuscar');
      renderizadoCache = true;
    }
  }

  try {
    const { personas } = await api('/usuarios');
    if (currentReq !== reqIdDescubrir) return;

    LocalStore.guardarLista('feed', 'descubrir_feed', personas);
    let filtradas = personas;
    if (genero) filtradas = filtradas.filter(p => p.gender === genero);
    if (soloOnline) filtradas = filtradas.filter(p => p.is_online);

    const nuevoJson = JSON.stringify(filtradas.map(p => ({ id: p.id, v: p.verified, o: p.is_online, n: p.name, a: p.avatar_data })));
    const actualJson = $('listaBuscar').dataset.cacheState;
    if (!renderizadoCache || actualJson !== nuevoJson) {
      pintarListaPersonas(filtradas, 'listaBuscar');
      $('listaBuscar').dataset.cacheState = nuevoJson;
    }
  } catch (e) {
    if (currentReq !== reqIdDescubrir) return;
    if (!cachedFeed || !cachedFeed.length) {
      $('listaBuscar').innerHTML = `<div class="aviso-vacio">${e.message} (Modo sin conexión)</div>`;
    }
  }
}
async function buscarPersonas(q) {
  try {
    const { personas } = await api(`/usuarios/buscar?q=${encodeURIComponent(q)}`);
    pintarListaPersonas(personas, 'listaBuscar', true);
  } catch (e) { $('listaBuscar').innerHTML = `<div class="aviso-vacio">${e.message}</div>`; }
}

const ETIQUETAS_ORIGEN_FEED = {
  local: '📍 Tu localidad',
  afinidad_otra_localidad: '🧭 Afinidad de localidad',
  exploracion_aleatoria: '🎲 Descubrimiento al azar',
  cuenta_nueva: '🌱 Cuenta nueva',
};

const OPCIONES_REACCION = [
  { tipo: 'atrae', emoji: '😍', texto: 'Me atrae/interesa' },
  { tipo: 'cae_bien', emoji: '😊', texto: 'Me cae bien' },
  { tipo: 'interesante', emoji: '🧠', texto: 'Interesante' },
  { tipo: 'estilo', emoji: '🎨', texto: 'Me gusta su estilo' },
  { tipo: 'divertido', emoji: '😂', texto: 'Divertido' },
  { tipo: 'quiero_hablarle', emoji: '💬', texto: 'Quiero hablarle' },
  { tipo: 'buena_persona', emoji: '🤝', texto: 'Parece buena persona' },
  { tipo: 'desconfianza', emoji: '⚠️', texto: 'Me genera desconfianza', negativa: true },
  { tipo: 'no_interesa', emoji: '👎', texto: 'No me interesa', negativa: true },
];
const EMOJI_POR_TIPO_REACCION = Object.fromEntries(
  [{ tipo: 'me_interesa', emoji: '💗' }, ...OPCIONES_REACCION].map((o) => [o.tipo, o.emoji])
);

function pintarListaPersonas(personas, contenedorId) {
  const cont = $(contenedorId);
  if (!personas.length) { cont.innerHTML = '<div class="aviso-vacio">No hay nadie que mostrar por ahora.</div>'; return; }
  cont.innerHTML = personas.map((p) => `
    <div class="tarjeta" data-persona='${encodeURIComponent(JSON.stringify(p))}'>
      ${p.mi_reaccion ? `<div class="tarjeta-reaccionada" title="Ya reaccionaste (privado)">${EMOJI_POR_TIPO_REACCION[p.mi_reaccion] || '💗'}</div>` : ''}
      <div class="avatar-wrap">
        <img class="avatar-circulo" src="${avatarDe(p)}" alt="">
        <div class="punto-online ${p.is_online ? 'en-linea' : ''}"></div>
        <div class="check-amigo ${p.estado_amistad === 'amigos' ? 'activo' : ''}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>
        </div>
      </div>
      <div class="id-persona">
        <div class="nombre">${nombreConBadge(p)}</div>
        <div class="detalle"><span>${p.flag_emoji || '🇨🇺'}</span> ${p.city || 'Cuba'}${p.profession ? ` <span class="sep"></span> ${p.profession}` : ''}</div>
        ${p.origen ? `<div class="tarjeta-origen ${p.origen}">${ETIQUETAS_ORIGEN_FEED[p.origen] || ''}</div>` : ''}
      </div>
      <div class="chevron"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m9 6 6 6-6 6"/></svg></div>
    </div>`).join('');

  cont.querySelectorAll('.tarjeta').forEach((tarjeta) => {
    const persona = JSON.parse(decodeURIComponent(tarjeta.dataset.persona));
    adjuntarInteraccionTarjeta(tarjeta, persona);
  });
}

const VENTANA_DOBLE_TOQUE_MS = 320;
function adjuntarInteraccionTarjeta(tarjeta, persona) {
  let ultimoToque = 0;
  let temporizador = null;
  tarjeta.addEventListener('click', () => {
    const ahora = Date.now();
    if (ahora - ultimoToque < VENTANA_DOBLE_TOQUE_MS) {
      clearTimeout(temporizador);
      ultimoToque = 0;
      manejarDobleToquePersona(persona, tarjeta);
    } else {
      ultimoToque = ahora;
      temporizador = setTimeout(() => abrirHojaPersona(persona), VENTANA_DOBLE_TOQUE_MS);
    }
  });
}

async function manejarDobleToquePersona(persona, tarjeta) {
  animarCorazonToque(tarjeta);
  abrirMiniEncuestaReaccion(persona);
}

function animarCorazonToque(tarjeta) {
  tarjeta.querySelectorAll('.corazon-doble-toque').forEach((el) => el.remove());
  const corazon = document.createElement('div');
  corazon.className = 'corazon-doble-toque';
  corazon.textContent = '💗';
  tarjeta.appendChild(corazon);
  setTimeout(() => corazon.remove(), 750);
}

let reaccionPersonaActual = null;
function abrirMiniEncuestaReaccion(persona) {
  reaccionPersonaActual = persona;
  $('reaccion-titulo').textContent = `Tocaste dos veces a ${(persona.name || 'esta persona').split(' ')[0]} — ¿qué te pareció? (opcional)`;
  const tipoActual = persona.mi_reaccion || 'me_interesa';
  $('reaccionOpciones').innerHTML = OPCIONES_REACCION.map((o) => `
    <div class="chip-toggle chip-reaccion ${o.negativa ? 'negativa' : ''} ${tipoActual === o.tipo ? 'seleccionado' : ''}" data-tipo="${o.tipo}">${o.emoji} ${o.texto}</div>
  `).join('');

  // Si aún no tiene reacción guardada en esta interacción, guardamos 'me_interesa' por defecto al abrir o interactuar
  if (!persona.mi_reaccion) {
    api(`/usuarios/${persona.id}/reaccion`, { method: 'PUT', body: { tipo: 'me_interesa' } })
      .then(({ reaccion }) => { persona.mi_reaccion = reaccion?.tipo || 'me_interesa'; })
      .catch((e) => console.warn('Error guardando reacción por defecto:', e.message));
  }

  $('reaccionOpciones').querySelectorAll('.chip-reaccion').forEach((chip) => {
    chip.addEventListener('click', async () => {
      $('reaccionOpciones').querySelectorAll('.chip-reaccion').forEach((c) => c.classList.remove('seleccionado'));
      chip.classList.add('seleccionado');
      try {
        const { reaccion } = await api(`/usuarios/${reaccionPersonaActual.id}/reaccion`, { method: 'PUT', body: { tipo: chip.dataset.tipo } });
        reaccionPersonaActual.mi_reaccion = reaccion?.tipo || chip.dataset.tipo;
        mostrarToast('Guardado — esto es privado, solo tú lo ves 🔒');
      } catch (e) { mostrarToast(e.message); return; }
      setTimeout(cerrarMiniEncuestaReaccion, 500);
    });
  });
  $('veloReaccion').classList.add('activo'); $('hojaReaccion').classList.add('activo');
}
function cerrarMiniEncuestaReaccion() { $('veloReaccion').classList.remove('activo'); $('hojaReaccion').classList.remove('activo'); }
$('veloReaccion').addEventListener('click', cerrarMiniEncuestaReaccion);
$('cerrarReaccion').addEventListener('click', cerrarMiniEncuestaReaccion);

/* ================= HOJA DE ACCIONES SOBRE UNA PERSONA ================= */
let personaSeleccionada = null;
function abrirHojaPersona(persona) {
  personaSeleccionada = persona;
  $('hoja-avatar').src = avatarDe(persona);
  $('hoja-nombre').innerHTML = `${nombreConBadge(persona)} · ${persona.city || 'Cuba'}`;
  $('op-eliminar-amigo').classList.toggle('oculto', persona.estado_amistad !== 'amigos');
  $('op-bloquear').classList.remove('oculto');
  $('op-desbloquear').classList.add('oculto');
  $('velo').classList.add('activo'); $('hoja').classList.add('activo');
}
function cerrarHojaPersona() { $('velo').classList.remove('activo'); $('hoja').classList.remove('activo'); }
$('velo').addEventListener('click', cerrarHojaPersona);
$('op-cancelar').addEventListener('click', cerrarHojaPersona);
$('op-ver-perfil').addEventListener('click', () => { cerrarHojaPersona(); abrirPerfil(personaSeleccionada.id); });
$('op-compartir-perfil')?.addEventListener('click', () => {
  cerrarHojaPersona();
  const url = `${window.location.origin}/#perfil-${personaSeleccionada.id}`;
  if (navigator.share) {
    navigator.share({ title: personaSeleccionada.name, url });
  } else {
    navigator.clipboard.writeText(url);
    mostrarToast('Enlace de perfil copiado 🔗');
  }
});
function abrirSocialLinksModal(persona) {
  if (!persona) return;
  const sl = persona.social_links || {};
  const links = [];

  if (persona.phone) {
    const numLimpio = `${persona.country_code || '+53'}${persona.phone.replace(/\D/g, '')}`.replace(/^\+/, '');
    links.push({
      red: 'WhatsApp',
      icono: '💬',
      color: '#25D366',
      valor: `${persona.country_code || '+53'} ${persona.phone}`,
      url: `https://wa.me/${numLimpio}`
    });
  }

  if (sl.telegram || persona.telegram) {
    const tg = (sl.telegram || persona.telegram || '').replace(/^@/, '');
    links.push({
      red: 'Telegram',
      icono: '✈️',
      color: '#229ED9',
      valor: `@${tg}`,
      url: `https://t.me/${tg}`
    });
  }

  if (persona.instagram || sl.instagram) {
    const ig = (persona.instagram || sl.instagram || '').replace(/^@/, '');
    links.push({
      red: 'Instagram',
      icono: '📸',
      color: '#E1306C',
      valor: `@${ig}`,
      url: `https://instagram.com/${ig}`
    });
  }

  if (sl.discord) {
    links.push({
      red: 'Discord',
      icono: '🎮',
      color: '#5865F2',
      valor: sl.discord,
      copiar: sl.discord
    });
  }

  if (sl.freefire) {
    links.push({
      red: 'Free Fire ID',
      icono: '🔥',
      color: '#FF6B00',
      valor: sl.freefire,
      copiar: sl.freefire
    });
  }

  if (sl.clashofclans) {
    links.push({
      red: 'Clash of Clans Tag',
      icono: '⚔️',
      color: '#F1C40F',
      valor: sl.clashofclans,
      copiar: sl.clashofclans
    });
  }

  if (sl.callofduty) {
    links.push({
      red: 'Call of Duty ID',
      icono: '🎯',
      color: '#2C3E50',
      valor: sl.callofduty,
      copiar: sl.callofduty
    });
  }

  if (sl.otros) {
    const url = sl.otros.startsWith('http') ? sl.otros : `https://${sl.otros}`;
    links.push({
      red: 'Sitio Web / Enlace',
      icono: '🌐',
      color: '#5b21b6',
      valor: sl.otros,
      url
    });
  }

  const modalNombre = $('socialModalNombre');
  if (modalNombre) modalNombre.textContent = `Redes de ${persona.name}`;

  const container = $('listaSocialLinks');
  if (container) {
    if (!links.length) {
      container.innerHTML = '<div class="aviso-vacio">Esta persona aún no ha configurado sus redes sociales o juegos.</div>';
    } else {
      container.innerHTML = links.map(l => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:var(--hueso); border:1px solid var(--borde); border-radius:12px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:20px;">${l.icono}</span>
            <div>
              <div style="font-size:13px; font-weight:700; color:${l.color};">${l.red}</div>
              <div style="font-size:12px; color:var(--texto-700);">${escaparHTMLGlobal(l.valor)}</div>
            </div>
          </div>
          ${l.url ? `<a href="${l.url}" target="_blank" class="mini-btn primario" style="text-decoration:none;">Abrir ↗</a>` : ''}
          ${l.copiar ? `<button class="mini-btn secundario" onclick="navigator.clipboard.writeText('${escaparHTMLGlobal(l.copiar)}'); mostrarToast('ID/Tag copiado');">Copiar 📋</button>` : ''}
        </div>
      `).join('');
    }

    // Botón para solicitar intercambio de datos
    const yo = Sesion.usuario();
    if (yo && persona.id !== yo.id) {
      container.innerHTML += `
        <div style="border-top:1px solid var(--borde); margin-top:10px; padding-top:12px;">
          <button class="btn btn-secundario" style="width:100%; font-size:12.5px;" onclick="solicitarContactoAccion('${persona.id}')">
            📩 Solicitar datos / Mandar mi contacto
          </button>
        </div>
      `;
    }
  }

  $('veloSocialLinks')?.classList.add('activo');
  $('hojaSocialLinks')?.classList.add('activo');
}

async function solicitarContactoAccion(targetId) {
  try {
    await api('/notificaciones/solicitar-contacto', { method: 'POST', body: { target_id: targetId } });
    mostrarToast('Se le envió una notificación expresando tu interés en agregar su contacto ✓');
    $('veloSocialLinks')?.classList.remove('activo');
    $('hojaSocialLinks')?.classList.remove('activo');
  } catch (e) {
    mostrarToast(e.message);
  }
}
window.solicitarContactoAccion = solicitarContactoAccion;

$('cerrarSocialLinks')?.addEventListener('click', () => {
  $('veloSocialLinks')?.classList.remove('activo');
  $('hojaSocialLinks')?.classList.remove('activo');
});
$('veloSocialLinks')?.addEventListener('click', () => {
  $('veloSocialLinks')?.classList.remove('activo');
  $('hojaSocialLinks')?.classList.remove('activo');
});

$('op-link-whatsapp').addEventListener('click', () => {
  cerrarHojaPersona();
  if (personaSeleccionada) {
    abrirSocialLinksModal(personaSeleccionada);
  }
});
$('op-mensaje').addEventListener('click', () => { cerrarHojaPersona(); Chat.abrirConversacion(personaSeleccionada); });
$('op-llamar-audio').addEventListener('click', () => { cerrarHojaPersona(); Llamada.iniciar(personaSeleccionada, 'audio'); });
$('op-llamar-video').addEventListener('click', () => { cerrarHojaPersona(); Llamada.iniciar(personaSeleccionada, 'video'); });
$('op-agregar').addEventListener('click', () => { importarContactoVCard(personaSeleccionada); cerrarHojaPersona(); });
$('op-eliminar-amigo').addEventListener('click', () => { cerrarHojaPersona(); eliminarAmigoAccion(personaSeleccionada.id); });
$('op-bloquear').addEventListener('click', () => { cerrarHojaPersona(); bloquearPersonaAccion(personaSeleccionada.id); });
$('op-reportar').addEventListener('click', () => { cerrarHojaPersona(); abrirReportar({ target_user_id: personaSeleccionada.id }); });

/* ================= AMISTAD / BLOQUEOS / REPORTES ================= */
async function eliminarAmigoAccion(personaId) {
  if (!confirm('¿Seguro que quieres eliminar a esta persona de tus amigos?')) return;
  try {
    await api(`/amigos/${personaId}`, { method: 'DELETE' });
    mostrarToast('Eliminado de tus amigos');
    cargarAmigosYSolicitudes();
    if (perfilActualId === personaId) abrirPerfil(personaId);
  } catch (e) { mostrarToast(e.message); }
}

async function bloquearPersonaAccion(personaId) {
  if (!confirm('¿Bloquear a esta persona? Ya no podrán verse, escribirse ni llamarse.')) return;
  try {
    await api(`/moderacion/${personaId}/bloquear`, { method: 'POST' });
    mostrarToast('Persona bloqueada');
    cargarDescubrir();
    cargarAmigosYSolicitudes();
    if (perfilActualId === personaId) abrirPerfil(personaId);
  } catch (e) { mostrarToast(e.message); }
}

async function desbloquearPersonaAccion(personaId) {
  try {
    await api(`/moderacion/${personaId}/desbloquear`, { method: 'POST' });
    mostrarToast('Persona desbloqueada');
    if (perfilActualId === personaId) abrirPerfil(personaId);
    cargarBloqueados();
  } catch (e) { mostrarToast(e.message); }
}
window.desbloquearPersonaAccion = desbloquearPersonaAccion;

let reportarObjetivo = null;
function abrirReportar(objetivo) {
  reportarObjetivo = objetivo;
  $('reportarMotivo').value = 'spam';
  $('reportarDetalles').value = '';
  $('veloReportar').classList.add('activo'); $('hojaReportar').classList.add('activo');
}
function cerrarReportar() { $('veloReportar').classList.remove('activo'); $('hojaReportar').classList.remove('activo'); }
$('cerrarReportar').addEventListener('click', cerrarReportar);
$('veloReportar').addEventListener('click', cerrarReportar);
$('btnEnviarReporte').addEventListener('click', async () => {
  if (!reportarObjetivo) return;
  try {
    await api('/moderacion/reportar', {
      method: 'POST',
      body: {
        ...reportarObjetivo,
        reason: $('reportarMotivo').value,
        details: $('reportarDetalles').value.trim(),
      },
    });
    mostrarToast('Gracias, revisaremos tu reporte');
    cerrarReportar();
  } catch (e) { mostrarToast(e.message); }
});

/* ================= CUENTAS BLOQUEADAS ================= */
async function cargarBloqueados() {
  try {
    const { bloqueados } = await api('/usuarios/bloqueados');
    $('listaBloqueados').innerHTML = bloqueados.length ? bloqueados.map((p) => `
      <div class="notif-item">
        <div class="notif-icono"><img src="${avatarDe(p)}" alt=""></div>
        <div style="flex:1; min-width:0;"><div class="notif-texto"><b>${p.name}</b></div><div class="notif-hora">${p.city || ''}</div></div>
        <div class="mini-btn secundario" onclick="desbloquearPersonaAccion('${p.id}')">Desbloquear</div>
      </div>`).join('') : '<div class="notif-vacio">No tienes a nadie bloqueado.</div>';
  } catch (e) { $('listaBloqueados').innerHTML = `<div class="notif-vacio">${e.message}</div>`; }
}
$('btnVerBloqueados').addEventListener('click', () => {
  cargarBloqueados();
  $('veloBloqueados').classList.add('activo'); $('hojaBloqueados').classList.add('activo');
});
$('cerrarBloqueados').addEventListener('click', () => { $('veloBloqueados').classList.remove('activo'); $('hojaBloqueados').classList.remove('activo'); });
$('veloBloqueados').addEventListener('click', () => { $('veloBloqueados').classList.remove('activo'); $('hojaBloqueados').classList.remove('activo'); });

function importarContactoVCard(persona) {
  if (persona && persona.id) {
    api('/notificaciones/descarga-contacto', { method: 'POST', body: { target_id: persona.id } }).catch(() => {});
  }
  const vcard = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${persona.name}`, persona.phone ? `TEL;TYPE=CELL:${persona.phone}` : '', `NOTE:Contacto de Enlace — ${persona.city || ''}`, 'END:VCARD'].filter(Boolean).join('\n');
  const blob = new Blob([vcard], { type: 'text/vcard' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${persona.name.replace(/\s+/g, '_')}.vcf`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  mostrarToast('Contacto listo para guardar en tu teléfono');
}

/* ================= PERFIL DE UNA PERSONA ================= */
let perfilVistoId = null;
let perfilVistoDesde = null;
function finalizarConteoPerfil() {
  if (perfilVistoId && perfilVistoDesde) {
    const segundos = Math.round((Date.now() - perfilVistoDesde) / 1000);
    if (segundos >= 3) {
      api(`/usuarios/${perfilVistoId}/tiempo-perfil`, { method: 'POST', body: { segundos } }).catch(() => {});
    }
  }
  perfilVistoId = null; perfilVistoDesde = null;
}
function iniciarConteoPerfil(personaId, esMiPerfil) {
  finalizarConteoPerfil();
  if (!esMiPerfil) { perfilVistoId = personaId; perfilVistoDesde = Date.now(); }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) finalizarConteoPerfil(); });
window.addEventListener('pagehide', finalizarConteoPerfil);

let perfilActualId = null;
let personaActualGlobal = null;
async function abrirPerfil(personaId) {
  perfilActualId = personaId;
  try {
    const { persona, estado_amistad, solicitud_de_mi, contacto_verificado, yo_la_bloquee, ella_me_bloqueo, reputacion, publicaciones } = await api(`/usuarios/${personaId}`);
    personaActualGlobal = persona;
    const yo = Sesion.usuario();
    const esMiPerfil = personaId === yo.id;
    iniciarConteoPerfil(personaId, esMiPerfil);

    $('p-cover').src = persona.cover_data || avatarDe(persona);
    $('p-avatar').src = avatarDe(persona);
    $('p-anillo').classList.toggle('sin-estado', !persona.status_text);
    $('p-estado').textContent = persona.status_text || 'Sin estado activo';
    $('p-estado').style.display = persona.status_text ? 'block' : 'none';
    $('p-nombre').innerHTML = nombreConBadge(persona);
    $('p-profesion').textContent = persona.profession || '';
    $('p-ubicacion').textContent = `${persona.flag_emoji || '🇨🇺'} ${persona.country || 'Cuba'} · ${persona.city || ''}`;
    $('p-descripcion').textContent = persona.bio || '';
    $('p-chips').innerHTML = [persona.gender, persona.skin_color, persona.relationship_status].filter(Boolean).map((c) => `<div class="chip">${c}</div>`).join('');
    $('p-reputacion').innerHTML = chipReputacion(reputacion);

    if ($('p-stat-visitas')) $('p-stat-visitas').textContent = persona.views_count || 0;

    const abrirEstadoDePerfil = async () => {
      try {
        const { estados } = await api(`/estados/usuario/${personaId}`);
        if (estados && estados.length) {
          verEstado(estados[0]);
        } else if (esMiPerfil) {
          $('veloEstado').classList.add('activo'); $('hojaEstado').classList.add('activo');
        } else {
          mostrarToast('Sin estado activo');
        }
      } catch (e) { mostrarToast('Sin estado activo'); }
    };
    $('p-avatar').onclick = abrirEstadoDePerfil;
    $('p-anillo').onclick = abrirEstadoDePerfil;
    $('p-estado').onclick = abrirEstadoDePerfil;

    renderizarPublicacionesPerfil(publicaciones, 'p-publicaciones');

    $('p-acciones-otros').classList.toggle('oculto', esMiPerfil);
    $('p-porque-wrap').classList.toggle('oculto', esMiPerfil);
    $('p-compositor').classList.toggle('oculto', !esMiPerfil);
    $('p-verificar').style.display = esMiPerfil ? 'none' : '';

    if (!esMiPerfil) {
      pintarBotonAmistad(estado_amistad, solicitud_de_mi);
      $('p-amistad').onclick = () => accionAmistad(estado_amistad);

      const btnMas = $('p-btn-mas-opciones');
      const menuFlotante = $('p-menu-flotante');
      if (menuFlotante) menuFlotante.classList.add('oculto');

      if (btnMas && menuFlotante) {
        btnMas.onclick = (ev) => {
          ev.stopPropagation();
          menuFlotante.classList.toggle('oculto');
        };
        document.onclick = (e) => {
          if (menuFlotante && !menuFlotante.contains(e.target) && e.target !== btnMas) {
            menuFlotante.classList.add('oculto');
          }
        };
      }

      const linkContainer = $('p-link-desplegable');
      if (linkContainer) {
        linkContainer.innerHTML = `<button class="btn btn-secundario" style="width:100%; font-size:12.5px; padding:8px;" onclick="abrirSocialLinksModal(personaActualGlobal)">🔗 Ver Redes Sociales y Juegos</button>`;
      }

      const btnExportarVCard = $('p-exportar-vcard');
      if (btnExportarVCard) {
        btnExportarVCard.onclick = () => {
          api('/notificaciones/descarga-contacto', { method: 'POST', body: { target_id: personaId } }).catch(() => {});
          const token = Sesion.token();
          window.open(`/api/usuarios/${personaId}/vcard?token=${encodeURIComponent(token)}`, '_blank');
        };
      }

      $('p-verificar').onclick = () => { if (menuFlotante) menuFlotante.classList.add('oculto'); verificarContactoReal(persona); };
      $('p-mensaje').onclick = () => { if (menuFlotante) menuFlotante.classList.add('oculto'); finalizarConteoPerfil(); $('vistaPerfil').classList.remove('activo'); Chat.abrirConversacion(persona); };
      $('p-audio').onclick = () => { if (menuFlotante) menuFlotante.classList.add('oculto'); Llamada.iniciar(persona, 'audio'); };
      $('p-video').onclick = () => { if (menuFlotante) menuFlotante.classList.add('oculto'); Llamada.iniciar(persona, 'video'); };

      $('p-eliminar-amigo').classList.toggle('oculto', estado_amistad !== 'amigos');
      $('p-eliminar-amigo').onclick = () => { if (menuFlotante) menuFlotante.classList.add('oculto'); eliminarAmigoAccion(personaId); };
      $('p-bloquear').textContent = yo_la_bloquee ? 'Desbloquear' : 'Bloquear';
      $('p-bloquear').onclick = () => { if (menuFlotante) menuFlotante.classList.add('oculto'); (yo_la_bloquee ? desbloquearPersonaAccion(personaId) : bloquearPersonaAccion(personaId)); };
      $('p-reportar').onclick = () => { if (menuFlotante) menuFlotante.classList.add('oculto'); abrirReportar({ target_user_id: personaId }); };

      const bloqueadoPorEllos = !!ella_me_bloqueo;
      $('p-amistad').classList.toggle('oculto', bloqueadoPorEllos);
      $('p-mensaje').classList.toggle('oculto', bloqueadoPorEllos);
      $('p-audio').classList.toggle('oculto', bloqueadoPorEllos);
      $('p-video').classList.toggle('oculto', bloqueadoPorEllos);
      $('p-verificar').style.display = bloqueadoPorEllos ? 'none' : (esMiPerfil ? 'none' : '');
      $('p-eliminar-amigo').classList.toggle('oculto', bloqueadoPorEllos || estado_amistad !== 'amigos');
    }

    $('vistaPerfil').classList.add('activo');
  } catch (e) { mostrarToast(e.message); }
}
$('p-volver').addEventListener('click', () => { cerrarTodosLosModales(); finalizarConteoPerfil(); $('vistaPerfil').classList.remove('activo'); });
$('btnVerMiPerfil').addEventListener('click', () => abrirPerfil(Sesion.usuario().id));

function pintarBotonAmistad(estado, deMi) {
  const btn = $('p-amistad'); const txt = $('p-amistad-texto');
  $('p-stat-amigos').textContent = estado === 'amigos' ? 'Amigos' : estado === 'pendiente' ? 'Pendiente' : 'Ninguna';
  btn.classList.remove('es-amigo'); btn.removeAttribute('disabled');
  if (estado === 'amigos') { btn.classList.add('es-amigo'); txt.textContent = 'Ya son amigos ✓'; btn.setAttribute('disabled', 'true'); }
  else if (estado === 'pendiente' && deMi) { txt.textContent = 'Solicitud enviada…'; btn.setAttribute('disabled', 'true'); }
  else if (estado === 'pendiente' && !deMi) { txt.textContent = 'Aceptar solicitud'; }
  else { txt.textContent = 'Hacerse amigos'; }
}

async function accionAmistad(estadoActual) {
  try {
    if (estadoActual === 'ninguno' || !estadoActual) {
      await api(`/amigos/${perfilActualId}/solicitar`, { method: 'POST' });
      mostrarToast('Solicitud enviada');
    } else if (estadoActual === 'pendiente') {
      await api(`/amigos/${perfilActualId}/responder`, { method: 'POST', body: { aceptar: true } });
      mostrarToast('¡Ahora son amigos!');
    }
    abrirPerfil(perfilActualId);
    cargarSolicitudesBadge();
  } catch (e) { mostrarToast(e.message); }
}

async function verificarContactoReal(persona) {
  if (!('contacts' in navigator && 'ContactsManager' in window)) {
    mostrarToast('Tu navegador no permite leer contactos (usa Chrome en Android)');
    return;
  }
  try {
    const seleccion = await navigator.contacts.select(['tel', 'name'], { multiple: false });
    if (!seleccion || !seleccion.length) { mostrarToast('No se eligió ningún contacto'); return; }
    const telefonos = (seleccion[0].tel || []).map((t) => t.replace(/\D/g, ''));
    const miTel = (persona.phone || '').replace(/\D/g, '');
    const coincide = miTel && telefonos.some((t) => t.endsWith(miTel.slice(-8)));
    await api(`/usuarios/${persona.id}/verificar-contacto`, { method: 'POST', body: { coincide } });
    mostrarToast(coincide ? 'Coincide: ya la tienes guardada' : 'Ese contacto no coincide con este perfil');
    abrirPerfil(persona.id);
  } catch (e) { mostrarToast('No se pudo acceder a tus contactos'); }
}

/* ================= CONTACTOS ================= */
let listaAmigosGlobal = [];
document.querySelectorAll('#vistaContactos .sub-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#vistaContactos .sub-tab').forEach((t) => t.classList.toggle('activo', t === tab));
    const sub = tab.dataset.sub;
    $('listaAmigos').classList.toggle('oculto', sub !== 'amigos');
    $('listaFavoritos').classList.toggle('oculto', sub !== 'favoritos');
    $('listaSolicitudes').classList.toggle('oculto', sub !== 'solicitudes');
  });
});

$('inputBuscarContactos')?.addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  const filtrados = listaAmigosGlobal.filter(a =>
    (a.name || '').toLowerCase().includes(q) || (a.city || '').toLowerCase().includes(q)
  );
  pintarListaPersonas(filtrados.map((a) => ({ ...a, estado_amistad: 'amigos' })), 'listaAmigos');
});

async function alternarFavoritoAmigo(personaId) {
  try {
    const res = await api(`/amigos/${personaId}/favorito`, { method: 'POST' });
    mostrarToast(res.es_favorito ? 'Añadido a favoritos ⭐' : 'Quitado de favoritos');
    cargarAmigosYSolicitudes();
  } catch (e) { mostrarToast(e.message); }
}
window.alternarFavoritoAmigo = alternarFavoritoAmigo;

async function cargarAmigosYSolicitudes() {
  try {
    const { amigos } = await api('/amigos');
    listaAmigosGlobal = amigos || [];
    if (!amigos.length) {
      $('listaAmigos').innerHTML = '<div class="aviso-vacio">Todavía no tienes amigos agregados. Ve a "Buscar" para encontrar personas.</div>';
      $('listaFavoritos').innerHTML = '<div class="aviso-vacio">No tienes amigos marcados como favoritos.</div>';
    } else {
      pintarListaPersonas(amigos.map((a) => ({ ...a, estado_amistad: 'amigos' })), 'listaAmigos');
      const favs = amigos.filter(a => a.is_favorite);
      if (favs.length) {
        pintarListaPersonas(favs.map((a) => ({ ...a, estado_amistad: 'amigos' })), 'listaFavoritos');
      } else {
        $('listaFavoritos').innerHTML = '<div class="aviso-vacio">No tienes amigos marcados como favoritos ⭐</div>';
      }
    }
  } catch (e) { $('listaAmigos').innerHTML = `<div class="aviso-vacio">${e.message}</div>`; }

  try {
    const { solicitudes } = await api('/amigos/solicitudes');
    if (!solicitudes.length) { $('listaSolicitudes').innerHTML = '<div class="aviso-vacio">No tienes solicitudes pendientes.</div>'; }
    else {
      $('listaSolicitudes').innerHTML = solicitudes.map((s) => `
        <div class="tarjeta">
          <div class="avatar-wrap"><img class="avatar-circulo" src="${avatarDe(s)}" alt=""></div>
          <div class="id-persona"><div class="nombre">${nombreConBadge(s)}</div><div class="detalle">${s.city || 'Cuba'}</div></div>
          <div class="acciones-tarjeta">
            <div class="mini-btn primario" onclick="responderSolicitud('${s.id}', true)">Aceptar</div>
            <div class="mini-btn secundario" onclick="responderSolicitud('${s.id}', false)">Rechazar</div>
          </div>
        </div>`).join('');
    }
    $('badgeSolicitudes').textContent = solicitudes.length;
    $('badgeSolicitudes').classList.toggle('activa', solicitudes.length > 0);
  } catch (e) { console.error(e); }
}

async function responderSolicitud(userId, aceptar) {
  try {
    await api(`/amigos/${userId}/responder`, { method: 'POST', body: { aceptar } });
    mostrarToast(aceptar ? 'Ahora son amigos 🎉' : 'Solicitud rechazada');
    cargarAmigosYSolicitudes();
  } catch (e) { mostrarToast(e.message); }
}
window.responderSolicitud = responderSolicitud;

async function cargarSolicitudesBadge() {
  try {
    const { solicitudes } = await api('/amigos/solicitudes');
    $('badgeSolicitudes').textContent = solicitudes.length;
    $('badgeSolicitudes').classList.toggle('activa', solicitudes.length > 0);
  } catch (e) { /* silencioso */ }
}

/* ================= MENSAJES ================= */
function renderizarConversacionesHTML(conversaciones) {
  const aiAvailable = window.AI_CONFIG && window.AI_CONFIG.available;
  const aiName = (window.AI_CONFIG && window.AI_CONFIG.name) || 'Link AI Assistant';
  const aiAvatar = (window.AI_CONFIG && window.AI_CONFIG.avatar) || '';

  const itemAi = aiAvailable ? `
    <div class="conversacion-item" data-persona='${encodeURIComponent(JSON.stringify({ id: 'link_ai', name: `🤖 ${aiName}`, avatar_data: aiAvatar, is_online: true, is_ai: true }))}' style="border-left:4px solid var(--morado-600); background:var(--morado-50);">
      <div style="width:48px; height:48px; border-radius:50%; background:var(--morado-600); color:#fff; display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:700; overflow:hidden;">
        ${aiAvatar ? `<img src="${aiAvatar}" style="width:100%; height:100%; object-fit:cover;">` : '🤖'}
      </div>
      <div class="conversacion-info">
        <div class="nombre" style="color:var(--morado-700);">${escaparHTMLGlobal(aiName)}</div>
        <div class="preview">Asistente Inteligente (OpenRouter)</div>
      </div>
      <div class="conversacion-hora">En línea</div>
    </div>` : '';

  if (!conversaciones || !conversaciones.length) {
    return (itemAi || '') + '<div class="aviso-vacio">Aún no tienes conversaciones con amigos. Escríbele a un amigo desde su perfil.</div>';
  }
  return (itemAi || '') + conversaciones.map((c) => `
    <div class="conversacion-item" data-persona='${encodeURIComponent(JSON.stringify({ id: c.otro_id, name: c.otro_nombre, avatar_data: c.otro_avatar, is_online: c.is_online }))}'>
      <img src="${avatarDe({ avatar_data: c.otro_avatar, name: c.otro_nombre })}" alt="">
      <div class="conversacion-info">
        <div class="nombre">${c.otro_nombre}</div>
        <div class="preview">${c.last_message_preview || ''}</div>
      </div>
      <div class="conversacion-hora">${c.last_message_at ? tiempoRelativo(c.last_message_at) : ''}</div>
    </div>`).join('');
}

function adjuntarListenersConversaciones() {
  document.querySelectorAll('.conversacion-item').forEach((item) => {
    item.addEventListener('click', () => Chat.abrirConversacion(JSON.parse(decodeURIComponent(item.dataset.persona))));
  });
}

let listaConversacionesGlobal = [];

$('inputBuscarChats')?.addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  const filtradas = listaConversacionesGlobal.filter(c =>
    (c.otro_nombre || '').toLowerCase().includes(q) || (c.last_message_preview || '').toLowerCase().includes(q)
  );
  $('listaConversaciones').innerHTML = renderizarConversacionesHTML(filtradas);
  adjuntarListenersConversaciones();
});

let reqIdConversaciones = 0;
async function cargarConversaciones() {
  const currentReq = ++reqIdConversaciones;
  const cachedConvs = await LocalStore.obtenerLista('conversaciones', 'mis_conversaciones');
  let renderizadoCache = false;

  if (cachedConvs && cachedConvs.length && currentReq === reqIdConversaciones) {
    listaConversacionesGlobal = cachedConvs;
    if ($('listaConversaciones').children.length === 0 || $('listaConversaciones').querySelector('.aviso-vacio')) {
      $('listaConversaciones').innerHTML = renderizarConversacionesHTML(cachedConvs);
      adjuntarListenersConversaciones();
      renderizadoCache = true;
    }
  }

  try {
    const { conversaciones } = await api('/mensajes');
    if (currentReq !== reqIdConversaciones) return;

    listaConversacionesGlobal = conversaciones || [];
    Chat.actualizarBadgeMensajes(false);

    const nuevoJson = JSON.stringify((conversaciones || []).map(c => ({ id: c.id, last: c.last_message, unread: c.unread_count })));
    const actualJson = $('listaConversaciones').dataset.cacheState;
    if (!renderizadoCache || actualJson !== nuevoJson) {
      $('listaConversaciones').innerHTML = renderizarConversacionesHTML(conversaciones);
      adjuntarListenersConversaciones();
      $('listaConversaciones').dataset.cacheState = nuevoJson;
    }
    LocalStore.guardarLista('conversaciones', 'mis_conversaciones', conversaciones);
  } catch (e) {
    if (currentReq !== reqIdConversaciones) return;
    if (!cachedConvs || !cachedConvs.length) {
      $('listaConversaciones').innerHTML = `<div class="aviso-vacio">${e.message} (Modo sin conexión)</div>`;
    }
  }
}

/* ================= NOTIFICACIONES ================= */
function pintarBadgeCampana(hay) { $('campana').classList.toggle('hay-notif', hay); }

async function cargarNotificaciones() {
  try {
    const { notificaciones } = await api('/notificaciones');
    pintarBadgeCampana(notificaciones.some((n) => !n.read));
  } catch (e) { /* silencioso */ }
}

function cerrarNotificacionesHoja() {
  $('veloNotif')?.classList.remove('activo');
  $('hojaNotif')?.classList.remove('activo');
}
window.cerrarNotificacionesHoja = cerrarNotificacionesHoja;

$('campana').addEventListener('click', async () => {
  try {
    const { notificaciones } = await api('/notificaciones');
    const cont = $('lista-notif');
    cont.innerHTML = notificaciones.length ? notificaciones.map((n) => {
      let dataJson = {};
      try { dataJson = typeof n.data === 'string' ? JSON.parse(n.data || '{}') : (n.data || {}); } catch(e){}
      const targetActor = n.actor_id || dataJson.actor_id;
      return `
      <div class="notif-item ${n.read ? '' : 'no-leida'}" style="cursor:pointer;" onclick="cerrarNotificacionesHoja(); ${targetActor ? `abrirPerfil('${targetActor}')` : ''}">
        <div class="notif-icono">${n.actor_avatar ? `<img src="${n.actor_avatar}" alt="">` : '👋'}</div>
        <div><div class="notif-texto">${escaparHTMLGlobal(n.text)}</div><div class="notif-hora">${tiempoRelativo(n.created_at)}</div></div>
      </div>`;
    }).join('') : '<div class="notif-vacio">Todavía no tienes notificaciones</div>';
    await api('/notificaciones/marcar-leidas', { method: 'POST' });
    pintarBadgeCampana(false);
  } catch (e) { mostrarToast(e.message); }
  $('veloNotif').classList.add('activo'); $('hojaNotif').classList.add('activo');
});
$('veloNotif').addEventListener('click', () => { $('veloNotif').classList.remove('activo'); $('hojaNotif').classList.remove('activo'); });
$('cerrarNotif').addEventListener('click', () => { $('veloNotif').classList.remove('activo'); $('hojaNotif').classList.remove('activo'); });

/* ================= AJUSTES / EDITAR PERFIL ================= */
$('btnCambiarAvatar').addEventListener('click', () => $('inputAvatar').click());
$('inputAvatar').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const base64 = await archivoABase64(file, 500, 0.75);
    const { user } = await api('/usuarios/me/avatar', { method: 'PUT', body: { image_base64: base64 } });
    Sesion.actualizarUsuario(user);
    $('ajustesAvatar').src = avatarDe(user);
    if ($('vistaPerfil').classList.contains('activo') && perfilActualId === user.id) $('p-avatar').src = avatarDe(user);
    mostrarToast('Foto de perfil actualizada');
  } catch (err) { mostrarToast(err.message); }
});

$('btnEditarPerfil').addEventListener('click', abrirEditarPerfil);
function abrirEditarPerfil() {
  const u = Sesion.usuario();
  const sl = u.social_links || {};
  $('edNombre').value = u.name || '';
  if ($('edGenero')) $('edGenero').value = u.gender || 'Mujer';
  if ($('edCodigoPais')) $('edCodigoPais').value = u.country_code || '+53';
  if ($('edTelefono')) $('edTelefono').value = u.phone || '';
  if ($('edTelegram')) $('edTelegram').value = sl.telegram || u.telegram || '';
  if ($('edInstagram')) $('edInstagram').value = sl.instagram || u.instagram || '';
  if ($('edDiscord')) $('edDiscord').value = sl.discord || '';
  if ($('edFreeFire')) $('edFreeFire').value = sl.freefire || '';
  if ($('edClashOfClans')) $('edClashOfClans').value = sl.clashofclans || '';
  if ($('edCallOfDuty')) $('edCallOfDuty').value = sl.callofduty || '';
  if ($('edOtrosLinks')) $('edOtrosLinks').value = sl.otros || '';

  $('edProfesion').value = u.profession || '';
  $('edCiudad').value = u.city || '';
  $('edPiel').value = u.skin_color || '';
  $('edSituacion').value = u.relationship_status || '';
  $('edBio').value = u.bio || '';
  $('edEstado').value = u.status_text || '';
  $('veloEditar').classList.add('activo'); $('hojaEditar').classList.add('activo');
}
$('cerrarEditar').addEventListener('click', () => { $('veloEditar').classList.remove('activo'); $('hojaEditar').classList.remove('activo'); });
$('veloEditar').addEventListener('click', () => { $('veloEditar').classList.remove('activo'); $('hojaEditar').classList.remove('activo'); });

$('btnGuardarPerfil').addEventListener('click', async () => {
  try {
    const social_links = {
      telegram: $('edTelegram')?.value.trim().replace(/^@/, '') || '',
      instagram: $('edInstagram')?.value.trim().replace(/^@/, '') || '',
      discord: $('edDiscord')?.value.trim() || '',
      freefire: $('edFreeFire')?.value.trim() || '',
      clashofclans: $('edClashOfClans')?.value.trim() || '',
      callofduty: $('edCallOfDuty')?.value.trim() || '',
      otros: $('edOtrosLinks')?.value.trim() || '',
    };

    const { user } = await api('/usuarios/me/perfil', {
      method: 'PUT',
      body: {
        name: $('edNombre').value.trim(),
        gender: $('edGenero') ? $('edGenero').value : undefined,
        country_code: $('edCodigoPais') ? $('edCodigoPais').value : '+53',
        phone: $('edTelefono') ? $('edTelefono').value.trim() : '',
        instagram: $('edInstagram') ? $('edInstagram').value.trim().replace(/^@/, '') : '',
        social_links,
        profession: $('edProfesion').value.trim(),
        city: $('edCiudad').value.trim(),
        skin_color: $('edPiel').value.trim(),
        relationship_status: $('edSituacion').value.trim(),
        bio: $('edBio').value.trim(),
        status_text: $('edEstado').value.trim(),
      },
    });
    Sesion.actualizarUsuario(user);
    $('ajustesNombre').innerHTML = nombreConBadge(user);
    mostrarToast('Perfil actualizado');
    $('veloEditar').classList.remove('activo'); $('hojaEditar').classList.remove('activo');
    cargarEstados();
    if (perfilActualId === user.id) abrirPerfil(user.id);
  } catch (e) { mostrarToast(e.message); }
});

/* ================= MODAL DE 10 CONFIGURACIONES ================= */
function alternarSwitch(id, activo) {
  const el = $(id);
  if (!el) return;
  if (activo !== undefined) el.classList.toggle('activo', !!activo);
  else el.classList.toggle('activo');
}

function esSwitchActivo(id) {
  return $(id)?.classList.contains('activo') || false;
}

$('swShowOnline')?.addEventListener('click', () => alternarSwitch('swShowOnline'));
$('swNotifSounds')?.addEventListener('click', () => alternarSwitch('swNotifSounds'));
$('swReadReceipts')?.addEventListener('click', () => alternarSwitch('swReadReceipts'));
$('swAutoplayVoice')?.addEventListener('click', () => alternarSwitch('swAutoplayVoice'));

$('btnAbrirConfiguraciones')?.addEventListener('click', () => {
  const u = Sesion.usuario();
  const cfg = u.settings || {};
  if ($('cfgPrivacyProfile')) $('cfgPrivacyProfile').value = cfg.privacy_profile || 'public';
  if ($('cfgPrivacyRequests')) $('cfgPrivacyRequests').value = cfg.privacy_requests || 'everyone';
  alternarSwitch('swShowOnline', cfg.show_online_status !== false);
  alternarSwitch('swNotifSounds', cfg.notification_sounds !== false);
  alternarSwitch('swReadReceipts', cfg.read_receipts !== false);
  alternarSwitch('swAutoplayVoice', cfg.autoplay_voice_notes === true);
  if ($('cfgVisualDensity')) $('cfgVisualDensity').value = cfg.visual_density || 'normal';
  if ($('cfgDefaultStoryDur')) $('cfgDefaultStoryDur').value = cfg.default_story_duration || 24;

  $('veloConfiguraciones').classList.add('activo');
  $('hojaConfiguraciones').classList.add('activo');
});

$('cerrarConfiguraciones')?.addEventListener('click', () => {
  $('veloConfiguraciones').classList.remove('activo');
  $('hojaConfiguraciones').classList.remove('activo');
});
$('veloConfiguraciones')?.addEventListener('click', () => {
  $('veloConfiguraciones').classList.remove('activo');
  $('hojaConfiguraciones').classList.remove('activo');
});

$('btnGuardarConfiguraciones')?.addEventListener('click', async () => {
  try {
    const settings = {
      privacy_profile: $('cfgPrivacyProfile')?.value || 'public',
      privacy_requests: $('cfgPrivacyRequests')?.value || 'everyone',
      show_online_status: esSwitchActivo('swShowOnline'),
      notification_sounds: esSwitchActivo('swNotifSounds'),
      read_receipts: esSwitchActivo('swReadReceipts'),
      autoplay_voice_notes: esSwitchActivo('swAutoplayVoice'),
      visual_density: $('cfgVisualDensity')?.value || 'normal',
      default_story_duration: parseInt($('cfgDefaultStoryDur')?.value || '24'),
    };
    const { user } = await api('/usuarios/me/configuraciones', { method: 'PUT', body: settings });
    Sesion.actualizarUsuario(user);
    mostrarToast('Configuraciones guardadas correctamente');
    $('veloConfiguraciones').classList.remove('activo');
    $('hojaConfiguraciones').classList.remove('activo');
  } catch (e) { mostrarToast(e.message); }
});

// Limpieza de caché local
$('btnLimpiarCache')?.addEventListener('click', async () => {
  if (!confirm('¿Limpiar la memoria caché local de la aplicación?')) return;
  try {
    const token = Sesion.token();
    const user = Sesion.usuario();
    localStorage.clear();
    if (token && user) {
      Sesion.guardar(token, user);
    }
    mostrarToast('Caché local de la app limpiada ✓');
  } catch (e) { mostrarToast('Error al limpiar caché.'); }
});

// Exportación de datos personales (.json)
$('btnExportarMisDatos')?.addEventListener('click', () => {
  const token = Sesion.token();
  window.open(`/api/usuarios/me/exportar-datos?token=${encodeURIComponent(token)}`, '_blank');
});

/* ================= MODAL CÓDIGO QR ================= */
$('btnCodigoQR')?.addEventListener('click', () => {
  const u = Sesion.usuario();
  if ($('qrUsername')) $('qrUsername').textContent = `@${u.username || u.name}`;
  if ($('qrTitulo')) $('qrTitulo').textContent = `Código QR de ${u.name}`;
  $('veloQR').classList.add('activo');
  $('hojaQR').classList.add('activo');
});
$('cerrarQR')?.addEventListener('click', () => {
  $('veloQR').classList.remove('activo');
  $('hojaQR').classList.remove('activo');
});
$('veloQR')?.addEventListener('click', () => {
  $('veloQR').classList.remove('activo');
  $('hojaQR').classList.remove('activo');
});

// Contador de caracteres y Borrador en Compositor
$('pCompTexto')?.addEventListener('input', (e) => {
  const txt = e.target.value;
  if ($('pCompCount')) $('pCompCount').textContent = `${txt.length} / 280`;
  localStorage.setItem('enlace_draft_post', txt);
});

// Restaurar borrador si existe
document.addEventListener('DOMContentLoaded', () => {
  const draft = localStorage.getItem('enlace_draft_post');
  if (draft && $('pCompTexto')) {
    $('pCompTexto').value = draft;
    if ($('pCompCount')) $('pCompCount').textContent = `${draft.length} / 280`;
  }
});

$('btnCerrarSesion').addEventListener('click', () => {
  Sesion.cerrar();
  if (window.socket) window.socket.disconnect();
  window.location.reload();
});

/* ================= PANEL DE ADMINISTRADOR ================= */
$('btnPanelAdmin').addEventListener('click', () => {
  $('vistaAdmin').classList.add('activo');
  cargarAdminUsuarios('');
});
$('admin-volver').addEventListener('click', () => $('vistaAdmin').classList.remove('activo'));

document.querySelectorAll('#vistaAdmin > .admin-body > .sub-tabs > .sub-tab[data-admintab]').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#vistaAdmin > .admin-body > .sub-tabs > .sub-tab[data-admintab]').forEach((t) => t.classList.toggle('activo', t === tab));
    const target = tab.dataset.admintab;
    $('adminVistaUsuarios')?.classList.toggle('oculto', target !== 'usuarios');
    $('adminVistaReportes')?.classList.toggle('oculto', target !== 'reportes');
    $('adminVistaAnuncios')?.classList.toggle('oculto', target !== 'anuncios');
    $('adminVistaAIConfig')?.classList.toggle('oculto', target !== 'ai-config');
    $('adminVistaBaseDatos')?.classList.toggle('oculto', target !== 'base-datos');
    $('adminVistaEditorDB')?.classList.toggle('oculto', target !== 'editor-db');
    if (target === 'reportes') cargarAdminReportes('pendiente');
    if (target === 'anuncios') cargarAdminAnuncios();
    if (target === 'ai-config') cargarAdminAIConfig();
    if (target === 'editor-db') cargarAdminEditorDB();
  });
});

// Admin AI Config
$('adminAIProvider')?.addEventListener('change', (e) => {
  const val = e.target.value;
  if ($('boxConfigOpenRouter')) $('boxConfigOpenRouter').style.display = val === 'openrouter' ? 'block' : 'none';
  if ($('boxConfigHuggingFace')) $('boxConfigHuggingFace').style.display = val === 'huggingface' ? 'block' : 'none';
});

$('adminBtnUploadAvatar')?.addEventListener('click', () => {
  $('adminAIAvatarFileInput')?.click();
});

$('adminAIAvatarFileInput')?.addEventListener('change', async (e) => {
  if (e.target.files && e.target.files[0]) {
    try {
      const base64 = await archivoABase64(e.target.files[0], 400, 0.8);
      if ($('adminAIAvatar')) $('adminAIAvatar').value = base64;
      mostrarToast('Foto de avatar cargada ✓');
    } catch (err) {
      mostrarToast('Error al procesar la foto.');
    }
  }
});

async function cargarAdminAIConfig() {
  try {
    const { settings } = await api('/admin/system-settings');
    const provider = settings.ai_provider || 'openrouter';
    if ($('adminAIProvider')) $('adminAIProvider').value = provider;
    if ($('boxConfigOpenRouter')) $('boxConfigOpenRouter').style.display = provider === 'openrouter' ? 'block' : 'none';
    if ($('boxConfigHuggingFace')) $('boxConfigHuggingFace').style.display = provider === 'huggingface' ? 'block' : 'none';

    if ($('adminOpenRouterKey')) $('adminOpenRouterKey').value = settings.openrouter_api_key || '';
    if ($('adminOpenRouterModel')) $('adminOpenRouterModel').value = settings.openrouter_model || 'meta-llama/llama-3.1-8b-instruct:free';
    if ($('adminHFToken')) $('adminHFToken').value = settings.hf_token || '';
    if ($('adminHFModel')) $('adminHFModel').value = settings.hf_model || 'meta-llama/Llama-3.2-3B-Instruct';

    if ($('adminAIName')) $('adminAIName').value = settings.ai_name || 'Link AI';
    if ($('adminAIAvatar')) $('adminAIAvatar').value = settings.ai_avatar || '';
    if ($('adminAIPersonality')) $('adminAIPersonality').value = settings.ai_personality || 'Eres Link AI, un asistente inteligente integrado en la plataforma social Link. Responde siempre en español, con amabilidad y precisión.';
    if ($('adminAIMaxTokens')) $('adminAIMaxTokens').value = settings.ai_max_tokens || 1000;
    if ($('adminAIContextTokens')) $('adminAIContextTokens').value = settings.ai_context_tokens || 4000;

    if ($('adminAILabMaxMsgLen')) $('adminAILabMaxMsgLen').value = settings.ailab_max_msg_length || 2000;
    if ($('adminAILabMaxPersLen')) $('adminAILabMaxPersLen').value = settings.ailab_max_personality_length || 1000;
    if ($('adminAILabMaxHistory')) $('adminAILabMaxHistory').value = settings.ailab_max_history || 10;
    if ($('adminAILabTimeoutMs')) $('adminAILabTimeoutMs').value = settings.ailab_timeout_ms || 30000;
  } catch (e) {
    mostrarToast('Error al cargar configuración de IA.');
  }
}

$('adminBtnTestAI')?.addEventListener('click', async () => {
  const resultEl = $('adminAITestResult');
  if (!resultEl) return;
  resultEl.style.color = 'var(--texto-800)';
  resultEl.textContent = 'Probando conexión con el proveedor de IA...';

  try {
    const res = await api('/admin/test-openrouter', {
      method: 'POST',
      body: {
        ai_provider: $('adminAIProvider').value,
        openrouter_api_key: $('adminOpenRouterKey').value,
        openrouter_model: $('adminOpenRouterModel').value,
        hf_token: $('adminHFToken').value,
        hf_model: $('adminHFModel').value,
        ai_personality: $('adminAIPersonality').value,
      }
    });

    if (res.success) {
      resultEl.style.color = 'var(--verde)';
      resultEl.textContent = `✅ ${res.message} Respuesta de prueba: "${res.reply}"`;
    } else {
      resultEl.style.color = 'var(--rojo)';
      resultEl.textContent = res.error || 'Falló la prueba.';
    }
  } catch (e) {
    resultEl.style.color = 'var(--rojo)';
    resultEl.textContent = `❌ Error de prueba: ${e.message}`;
  }
});

$('adminBtnSaveAI')?.addEventListener('click', async () => {
  try {
    const payload = {
      ai_provider: $('adminAIProvider').value,
      openrouter_api_key: $('adminOpenRouterKey').value.trim(),
      openrouter_model: $('adminOpenRouterModel').value.trim() || 'meta-llama/llama-3.1-8b-instruct:free',
      hf_token: $('adminHFToken').value.trim(),
      hf_model: $('adminHFModel').value.trim() || 'meta-llama/Llama-3.2-3B-Instruct',
      ai_name: $('adminAIName').value.trim() || 'Link AI',
      ai_avatar: $('adminAIAvatar').value.trim(),
      ai_personality: $('adminAIPersonality').value.trim(),
      ai_max_tokens: $('adminAIMaxTokens').value || '1000',
      ai_context_tokens: $('adminAIContextTokens').value || '4000',
      ailab_max_msg_length: $('adminAILabMaxMsgLen').value || '2000',
      ailab_max_personality_length: $('adminAILabMaxPersLen').value || '1000',
      ailab_max_history: $('adminAILabMaxHistory').value || '10',
      ailab_timeout_ms: $('adminAILabTimeoutMs').value || '30000',
    };

    await api('/admin/system-settings', { method: 'POST', body: { settings: payload } });
    mostrarToast('Configuración de IA guardada correctamente ✓');
    await comprobarAIConfig();
    cargarConversaciones();
  } catch (e) {
    mostrarToast(e.message);
  }
});

// Admin DB Direct Editor
async function cargarAdminEditorDB() {
  try {
    const { tables } = await api('/admin/db/tables');
    const select = $('adminSelectTable');
    if (!select) return;
    select.innerHTML = '<option value="">-- Selecciona una tabla --</option>' +
      tables.map(t => `<option value="${t.name}">${t.name} (${t.total} filas)</option>`).join('');
  } catch (e) {
    mostrarToast('Error al obtener lista de tablas.');
  }
}

$('adminSelectTable')?.addEventListener('change', async (e) => {
  const table = e.target.value;
  if (!table) {
    $('adminTableContent').innerHTML = '<div style="font-size:12.5px; color:var(--texto-500);">Selecciona una tabla para explorar o modificar sus registros.</div>';
    return;
  }
  cargarTablaAdmin(table);
});

async function cargarTablaAdmin(table) {
  try {
    const data = await api(`/admin/db/tables/${table}`);
    const cols = data.columns.map(c => c.column_name);
    const primaryKey = cols.includes('id') ? 'id' : (cols.includes('key') ? 'key' : cols[0]);

    let html = `<div style="font-size:12px; font-weight:bold; margin-bottom:8px;">Tabla: ${data.table} (${data.total} filas)</div>`;
    html += '<table style="width:100%; border-collapse:collapse; font-size:11.5px; text-align:left;">';
    html += '<tr style="background:var(--hueso); border-bottom:1px solid var(--borde);">';
    cols.forEach(c => { html += `<th style="padding:6px 8px; border:1px solid var(--borde);">${c}</th>`; });
    html += '<th style="padding:6px 8px; border:1px solid var(--borde);">Acciones</th></tr>';

    data.rows.forEach(r => {
      html += '<tr style="border-bottom:1px solid var(--borde);">';
      cols.forEach(c => {
        const val = typeof r[c] === 'object' ? JSON.stringify(r[c]) : (r[c] ?? '');
        html += `<td style="padding:6px 8px; border:1px solid var(--borde); max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escaparHTMLGlobal(String(val))}">${escaparHTMLGlobal(String(val))}</td>`;
      });
      const pkVal = r[primaryKey];
      html += `<td style="padding:6px 8px; border:1px solid var(--borde); white-space:nowrap;">
        <button class="mini-btn secundario" onclick="adminEditarFilaDB('${table}', '${primaryKey}', ${JSON.stringify(pkVal).replace(/"/g, '&quot;')})">Editar</button>
        <button class="mini-btn peligro" onclick="adminBorrarFilaDB('${table}', '${primaryKey}', ${JSON.stringify(pkVal).replace(/"/g, '&quot;')})">Borrar</button>
      </td></tr>`;
    });

    html += '</table>';
    $('adminTableContent').innerHTML = html;
  } catch (e) {
    $('adminTableContent').innerHTML = `<div class="aviso-vacio">${e.message}</div>`;
  }
}

async function adminEditarFilaDB(table, pkField, pkVal) {
  const nuevoJSON = prompt(`Editar datos para ${pkField} = ${pkVal} (formato JSON):`, '{}');
  if (!nuevoJSON) return;
  try {
    const data = JSON.parse(nuevoJSON);
    await api(`/admin/db/tables/${table}/row`, {
      method: 'PUT',
      body: { primaryKeyField: pkField, primaryKeyValue: pkVal, data }
    });
    mostrarToast('Fila actualizada ✓');
    cargarTablaAdmin(table);
  } catch (e) {
    mostrarToast(`Error: ${e.message}`);
  }
}
window.adminEditarFilaDB = adminEditarFilaDB;

async function adminBorrarFilaDB(table, pkField, pkVal) {
  if (!confirm(`¿Borrar la fila con ${pkField} = ${pkVal}?`)) return;
  try {
    await api(`/admin/db/tables/${table}/row`, {
      method: 'DELETE',
      body: { primaryKeyField: pkField, primaryKeyValue: pkVal }
    });
    mostrarToast('Fila borrada ✓');
    cargarTablaAdmin(table);
  } catch (e) {
    mostrarToast(`Error: ${e.message}`);
  }
}
window.adminBorrarFilaDB = adminBorrarFilaDB;

$('adminBtnRunSQL')?.addEventListener('click', async () => {
  const sql = $('adminSQLConsole')?.value.trim();
  const resEl = $('adminSQLResult');
  if (!sql || !resEl) return;
  resEl.textContent = 'Ejecutando consulta SQL...';

  try {
    const res = await api('/admin/db/query', { method: 'POST', body: { sql } });
    let text = `Comando: ${res.command}\nFilas afectadas / devueltas: ${res.rowCount || 0}\n\n`;
    if (res.rows && res.rows.length) {
      text += JSON.stringify(res.rows, null, 2);
    } else {
      text += 'Consulta ejecutada exitosamente sin filas devueltas.';
    }
    resEl.textContent = text;
  } catch (e) {
    resEl.textContent = `Error SQL: ${e.message}`;
  }
});

// Admin Anuncios
async function cargarAdminAnuncios() {
  try {
    const { anuncios } = await api('/admin/anuncios');
    const cont = $('adminListaAnuncios');
    if (!anuncios.length) { cont.innerHTML = '<div class="aviso-vacio">No hay anuncios publicados.</div>'; return; }
    cont.innerHTML = anuncios.map((a) => `
      <div class="admin-fila" style="flex-direction:column; align-items:stretch; gap:6px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <b>${escaparHTMLGlobal(a.title)}</b>
          <div class="mini-btn peligro" onclick="adminBorrarAnuncio('${a.id}')">Eliminar</div>
        </div>
        <div style="font-size:13px; color:var(--texto-700); white-space:pre-wrap;">${escaparHTMLGlobal(a.content)}</div>
        <div style="font-size:11.5px; color:var(--texto-500);">Expira: ${new Date(a.expires_at).toLocaleString()}</div>
      </div>`).join('');
  } catch (e) { $('adminListaAnuncios').innerHTML = `<div class="aviso-vacio">${e.message}</div>`; }
}

$('adminBtnPublicarAnuncio')?.addEventListener('click', async () => {
  const title = $('adminAnuncioTitulo').value.trim();
  const content = $('adminAnuncioTexto').value.trim();
  const expires_in_hours = parseInt($('adminAnuncioHoras').value) || 24;
  if (!title || !content) { mostrarToast('Ingresa título y contenido.'); return; }
  try {
    await api('/admin/anuncios', { method: 'POST', body: { title, content, expires_in_hours } });
    $('adminAnuncioTitulo').value = '';
    $('adminAnuncioTexto').value = '';
    mostrarToast('Anuncio publicado correctamente');
    cargarAdminAnuncios();
  } catch (e) { mostrarToast(e.message); }
});

async function adminBorrarAnuncio(id) {
  if (!confirm('¿Borrar este anuncio?')) return;
  try {
    await api(`/admin/anuncios/${id}`, { method: 'DELETE' });
    mostrarToast('Anuncio borrado');
    cargarAdminAnuncios();
  } catch (e) { mostrarToast(e.message); }
}
window.adminBorrarAnuncio = adminBorrarAnuncio;

// Admin DB Export
if ($('adminBtnExportarDB')) {
  $('adminBtnExportarDB').addEventListener('click', async () => {
    const statusEl = $('adminDBStatus');
    statusEl.style.color = 'var(--texto-800)';
    statusEl.textContent = 'Generando respaldo .zip y manifest.json...';
    try {
      const token = Sesion.token();
      const res = await fetch('/api/admin/exportar-db', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al exportar la base de datos.');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `enlace_db_backup_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      statusEl.style.color = 'var(--verde)';
      statusEl.textContent = 'Exportación completada exitosamente.';
    } catch (e) {
      statusEl.style.color = 'var(--rojo)';
      statusEl.textContent = e.message;
    }
  });
}

// Admin DB Import
if ($('adminBtnImportarDB')) {
  $('adminBtnImportarDB').addEventListener('click', async () => {
    const statusEl = $('adminDBStatus');
    const input = $('adminInputImportarDB');
    if (!input.files || !input.files[0]) {
      statusEl.style.color = 'var(--rojo)';
      statusEl.textContent = 'Por favor selecciona un archivo .zip para importar.';
      return;
    }
    statusEl.style.color = 'var(--texto-800)';
    statusEl.textContent = 'Importando respaldo y procesando manifest.json...';
    const formData = new FormData();
    formData.append('archivo', input.files[0]);
    try {
      const token = Sesion.token();
      const res = await fetch('/api/admin/importar-db', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al importar respaldo.');
      statusEl.style.color = 'var(--verde)';
      statusEl.textContent = `${data.mensaje} Versión: ${data.manifest.version}, Creado: ${new Date(data.manifest.exported_at).toLocaleString()}`;
    } catch (e) {
      statusEl.style.color = 'var(--rojo)';
      statusEl.textContent = e.message;
    }
  });
}

let temporizadorAdminBuscar = null;
$('adminBuscarUsuario').addEventListener('input', () => {
  clearTimeout(temporizadorAdminBuscar);
  temporizadorAdminBuscar = setTimeout(() => cargarAdminUsuarios($('adminBuscarUsuario').value.trim()), 300);
});

async function cargarAdminUsuarios(q) {
  try {
    const { personas } = await api(`/admin/usuarios?q=${encodeURIComponent(q || '')}`);
    if (!personas.length) { $('adminListaUsuarios').innerHTML = '<div class="aviso-vacio">No hay resultados.</div>'; return; }
    $('adminListaUsuarios').innerHTML = personas.map((p) => `
      <div class="admin-fila" id="admin-user-${p.id}">
        <img src="${avatarDe(p)}" alt="">
        <div class="info">
          <div class="n">${p.name}${badgeVerificado(p)}${p.banned ? '<span class="etiqueta-baneado">Baneado</span>' : ''}</div>
          <div class="s">${p.email}</div>
        </div>
        <div class="admin-acciones">
          <div class="admin-btn verificar ${p.verified ? 'activo' : ''}" onclick="adminAlternarVerificado('${p.id}', ${!p.verified})">${p.verified ? 'Verificado ✓' : 'Verificar'}</div>
          <div class="admin-btn banear ${p.banned ? 'activo' : ''}" onclick="adminAlternarBaneo('${p.id}', ${!p.banned})">${p.banned ? 'Desbanear' : 'Banear'}</div>
        </div>
      </div>`).join('');
  } catch (e) { $('adminListaUsuarios').innerHTML = `<div class="aviso-vacio">${e.message}</div>`; }
}

async function adminAlternarVerificado(userId, ponerVerificado) {
  try {
    await api(`/admin/usuarios/${userId}/verificado`, { method: 'PUT', body: { verificado: ponerVerificado } });
    mostrarToast(ponerVerificado ? 'Cuenta verificada ✓' : 'Verificación retirada');
    await LocalStore.borrarStore('feed');
    cargarAdminUsuarios($('adminBuscarUsuario').value.trim());
    if (perfilActualId === userId) abrirPerfil(userId);
    if ($('vistaFeed').classList.contains('activo')) cargarDescubrir();
  } catch (e) { mostrarToast(e.message); }
}
window.adminAlternarVerificado = adminAlternarVerificado;

async function adminAlternarBaneo(userId, ponerBaneado) {
  let motivo = '';
  if (ponerBaneado) {
    motivo = prompt('Motivo del baneo (se le mostrará a la persona):', '') || '';
    if (motivo === null) return;
  } else if (!confirm('¿Quitarle el baneo a esta cuenta?')) return;
  try {
    await api(`/admin/usuarios/${userId}/baneo`, { method: 'PUT', body: { baneado: ponerBaneado, motivo } });
    mostrarToast(ponerBaneado ? 'Cuenta baneada' : 'Baneo retirado');
    cargarAdminUsuarios($('adminBuscarUsuario').value.trim());
  } catch (e) { mostrarToast(e.message); }
}
window.adminAlternarBaneo = adminAlternarBaneo;

document.querySelectorAll('.sub-tab[data-estadorep]').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.sub-tab[data-estadorep]').forEach((t) => t.classList.toggle('activo', t === tab));
    cargarAdminReportes(tab.dataset.estadorep);
  });
});

const MOTIVOS_REPORTE = { spam: 'Spam o publicidad', acoso: 'Acoso', contenido_inapropiado: 'Contenido inapropiado', suplantacion: 'Suplantación', estafa: 'Estafa', otro: 'Otro' };

async function cargarAdminReportes(estado) {
  try {
    const { reportes } = await api(`/admin/reportes?estado=${estado}`);
    if (!reportes.length) { $('adminListaReportes').innerHTML = '<div class="aviso-vacio">No hay reportes aquí.</div>'; return; }
    $('adminListaReportes').innerHTML = reportes.map((r) => `
      <div class="admin-fila" style="flex-direction:column; align-items:stretch;">
        <div style="display:flex; align-items:center; gap:11px;">
          <img src="${avatarDe({ avatar_data: r.objetivo_avatar, name: r.objetivo_nombre || '?' })}" alt="">
          <div class="info">
            <div class="n">${r.objetivo_nombre || 'Publicación'}</div>
            <div class="s">Reportado por ${r.reportante_nombre} · ${tiempoRelativo(r.created_at)}</div>
          </div>
        </div>
        <div><span class="admin-reporte-motivo">${MOTIVOS_REPORTE[r.reason] || r.reason}</span></div>
        ${r.publicacion_texto ? `<div class="admin-reporte-detalle">📝 "${escaparHTMLGlobal(r.publicacion_texto).slice(0,140)}"</div>` : ''}
        ${r.details ? `<div class="admin-reporte-detalle">${escaparHTMLGlobal(r.details)}</div>` : ''}
        ${r.status === 'pendiente' ? `
          <div class="admin-acciones" style="margin-top:8px;">
            <div class="admin-btn verificar" onclick="adminResolverReporte('${r.id}', 'resuelto')">Marcar resuelto</div>
            <div class="admin-btn banear" onclick="adminResolverReporte('${r.id}', 'descartado')">Descartar</div>
            ${r.target_user_id ? `<div class="admin-btn banear" onclick="adminAlternarBaneo('${r.target_user_id}', true)">Banear</div>` : ''}
            ${r.target_post_id ? `<div class="admin-btn banear" onclick="borrarPublicacionAccion('${r.target_post_id}')">Borrar publicación</div>` : ''}
          </div>` : ''}
      </div>`).join('');
  } catch (e) { $('adminListaReportes').innerHTML = `<div class="aviso-vacio">${e.message}</div>`; }
}

async function adminResolverReporte(reporteId, status) {
  try {
    await api(`/admin/reportes/${reporteId}`, { method: 'PUT', body: { status } });
    mostrarToast(status === 'resuelto' ? 'Reporte marcado como resuelto' : 'Reporte descartado');
    const tabActiva = document.querySelector('.sub-tab[data-estadorep].activo');
    cargarAdminReportes(tabActiva ? tabActiva.dataset.estadorep : 'pendiente');
  } catch (e) { mostrarToast(e.message); }
}
window.adminResolverReporte = adminResolverReporte;

function toggleAcordeon(headerElem) {
  const panel = headerElem.closest('.panel-acordeon');
  if (panel) {
    panel.classList.toggle('abierto');
  }
}
window.toggleAcordeon = toggleAcordeon;

/* ================= ARRANQUE ================= */
if (Sesion.activa()) { iniciarApp(); } else { $('authScreen').classList.remove('oculto'); }

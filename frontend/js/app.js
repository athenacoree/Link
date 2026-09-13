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

/* ================= ARRANQUE DE LA APP ================= */
async function iniciarApp() {
  $('authScreen').classList.add('oculto');
  $('appShell').classList.remove('oculto');

  conectarSocket();
  await refrescarMiPerfil();
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

function conectarSocket() {
  window.socket = io({ auth: { token: Sesion.token() } });
  Chat.enlazarSocket(window.socket);
  Llamada.enlazarSocket(window.socket);
  window.socket.on('notificacion:nueva', (n) => {
    mostrarToast(n.text);
    pintarBadgeCampana(true);
    if ($('vistaContactos').classList.contains('activo')) cargarAmigosYSolicitudes();
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
const VISTAS_CARGADAS = new Set();
function cambiarVista(nombre) {
  cerrarTodosLosModales();
  if (typeof finalizarConteoPerfil === 'function') finalizarConteoPerfil();
  document.querySelectorAll('nav.tabbar .tab').forEach((t) => t.classList.toggle('activo', t.dataset.tab === nombre));
  document.querySelectorAll('.vista-app').forEach((v) => v.classList.toggle('activo', v.dataset.vista === nombre));

  // Carga instantánea si ya fue cargado recientemente, refresco en background
  if (nombre === 'feed') {
    if (!VISTAS_CARGADAS.has('feed') || !$('inputBuscar').value.trim()) {
      cargarDescubrir();
      VISTAS_CARGADAS.add('feed');
    }
  }
  if (nombre === 'contactos') {
    if (!VISTAS_CARGADAS.has('contactos')) {
      cargarAmigosYSolicitudes();
      VISTAS_CARGADAS.add('contactos');
    } else {
      setTimeout(cargarAmigosYSolicitudes, 100);
    }
  }
  if (nombre === 'mensajes') {
    if (!VISTAS_CARGADAS.has('mensajes')) {
      cargarConversaciones();
      VISTAS_CARGADAS.add('mensajes');
    } else {
      setTimeout(cargarConversaciones, 100);
    }
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
      const imgPreviewUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
      const videoEmbedUrl = `https://drive.google.com/file/d/${fileId}/preview`;

      let replacement = '';
      if (isVideo) {
        replacement = `
          <div class="drive-media-card video-card" style="margin-top:8px; padding:10px; background:rgba(0,0,0,0.05); border:1px solid var(--linea); border-radius:12px;">
            <div style="font-weight:700; font-size:12.5px; display:flex; align-items:center; gap:6px; color:var(--morado-700);">
              🎬 Video de Google Drive
            </div>
            <div style="font-size:11.5px; color:var(--texto-600); margin:4px 0;">Tamaño estimado: ~15 MB — Permiso requerido</div>
            <div id="drive-video-container-${fileId}">
              <button class="btn btn-primario mini-btn" style="padding:6px 12px; font-size:12px; border-radius:8px;" onclick="window.reproducirVideoDrive(event, '${fileId}', '${videoEmbedUrl.replace(/'/g, "\\'")}')">
                ▶ Reproducir video (Pedir permiso)
              </button>
            </div>
          </div>
        `;
      } else {
        replacement = `
          <div class="drive-media-card photo-card" style="margin-top:8px;">
            <div style="font-size:11px; font-weight:600; color:var(--morado-700); margin-bottom:4px;">🖼️ Foto de Google Drive</div>
            <img src="${imgPreviewUrl}" alt="Foto de Google Drive" style="max-width:100%; max-height:260px; object-fit:cover; border-radius:10px; cursor:pointer;" onclick="window.abrirVisorImagen('${imgPreviewUrl.replace(/'/g, "\\'")}')" onerror="this.onerror=null; this.src='https://docs.google.com/uc?export=view&id=${fileId}'">
          </div>
        `;
      }

      html = html.replace(fullUrl, `<a href="${fullUrl}" target="_blank" class="chip-link-url" onclick="event.stopPropagation()">🔗 Google Drive</a>${replacement}`);
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

async function cargarDescubrir() {
  const genero = $('filtroGenero') ? $('filtroGenero').value : '';
  const soloOnline = $('filtroOnline') ? ($('filtroOnline').value === 'online') : false;

  const cachedFeed = await LocalStore.obtenerLista('feed', 'descubrir_feed');
  if (cachedFeed && cachedFeed.length) {
    let filtradas = cachedFeed;
    if (genero) filtradas = filtradas.filter(p => p.gender === genero);
    if (soloOnline) filtradas = filtradas.filter(p => p.is_online);
    pintarListaPersonas(filtradas, 'listaBuscar');
  }
  try {
    const { personas } = await api('/usuarios');
    LocalStore.guardarLista('feed', 'descubrir_feed', personas);
    let filtradas = personas;
    if (genero) filtradas = filtradas.filter(p => p.gender === genero);
    if (soloOnline) filtradas = filtradas.filter(p => p.is_online);
    pintarListaPersonas(filtradas, 'listaBuscar');
  } catch (e) {
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
  try {
    const { reaccion } = await api(`/usuarios/${persona.id}/reaccion`, { method: 'PUT', body: { tipo: 'me_interesa' } });
    persona.mi_reaccion = reaccion?.tipo || 'me_interesa';
  } catch (e) {
    mostrarToast(e.message);
    return;
  }
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
  $('reaccionOpciones').innerHTML = OPCIONES_REACCION.map((o) => `
    <div class="chip-toggle chip-reaccion ${o.negativa ? 'negativa' : ''} ${persona.mi_reaccion === o.tipo ? 'seleccionado' : ''}" data-tipo="${o.tipo}">${o.emoji} ${o.texto}</div>
  `).join('');
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
$('op-link-whatsapp').addEventListener('click', () => {
  cerrarHojaPersona();
  if (personaSeleccionada && personaSeleccionada.phone) {
    const numLimpio = `${personaSeleccionada.country_code || '+53'}${personaSeleccionada.phone.replace(/\D/g, '')}`.replace(/^\+/, '');
    window.open(`https://wa.me/${numLimpio}`, '_blank');
  } else {
    mostrarToast('Esta persona no ha configurado número de WhatsApp.');
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
async function abrirPerfil(personaId) {
  perfilActualId = personaId;
  try {
    const { persona, estado_amistad, solicitud_de_mi, contacto_verificado, yo_la_bloquee, ella_me_bloqueo, reputacion, publicaciones } = await api(`/usuarios/${personaId}`);
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
        linkContainer.innerHTML = '';
        const links = [];
        if (persona.phone) {
          const numLimpio = `${persona.country_code || '+53'}${persona.phone.replace(/\D/g, '')}`.replace(/^\+/, '');
          links.push(`<a href="https://wa.me/${numLimpio}" target="_blank" style="display:flex; align-items:center; gap:8px; padding:6px 0; color:#25D366; text-decoration:none; font-weight:600; font-size:13px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> WhatsApp (${persona.country_code || '+53'})</a>`);
        }
        if (persona.instagram) {
          const igUser = persona.instagram.replace(/^@/, '');
          links.push(`<a href="https://instagram.com/${igUser}" target="_blank" style="display:flex; align-items:center; gap:8px; padding:6px 0; color:#E1306C; text-decoration:none; font-weight:600; font-size:13px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg> @${igUser}</a>`);
        }
        if (links.length) {
          linkContainer.innerHTML = links.join('');
        } else {
          linkContainer.innerHTML = '<span style="font-size:12px; color:var(--texto-500);">Sin enlaces configurados</span>';
        }
      }

      const btnExportarVCard = $('p-exportar-vcard');
      if (btnExportarVCard) {
        btnExportarVCard.onclick = () => {
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
  if (!conversaciones || !conversaciones.length) {
    return '<div class="aviso-vacio">Aún no tienes conversaciones. Escríbele a un amigo desde su perfil.</div>';
  }
  return conversaciones.map((c) => `
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

async function cargarConversaciones() {
  const cachedConvs = await LocalStore.obtenerLista('conversaciones', 'mis_conversaciones');
  if (cachedConvs && cachedConvs.length) {
    listaConversacionesGlobal = cachedConvs;
    $('listaConversaciones').innerHTML = renderizarConversacionesHTML(cachedConvs);
    adjuntarListenersConversaciones();
  }

  try {
    const { conversaciones } = await api('/mensajes');
    listaConversacionesGlobal = conversaciones || [];
    Chat.actualizarBadgeMensajes(false);
    $('listaConversaciones').innerHTML = renderizarConversacionesHTML(conversaciones);
    adjuntarListenersConversaciones();
    LocalStore.guardarLista('conversaciones', 'mis_conversaciones', conversaciones);
  } catch (e) {
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

$('campana').addEventListener('click', async () => {
  try {
    const { notificaciones } = await api('/notificaciones');
    const cont = $('lista-notif');
    cont.innerHTML = notificaciones.length ? notificaciones.map((n) => `
      <div class="notif-item ${n.read ? '' : 'no-leida'}">
        <div class="notif-icono">${n.actor_avatar ? `<img src="${n.actor_avatar}" alt="">` : '👋'}</div>
        <div><div class="notif-texto">${n.text}</div><div class="notif-hora">${tiempoRelativo(n.created_at)}</div></div>
      </div>`).join('') : '<div class="notif-vacio">Todavía no tienes notificaciones</div>';
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
  $('edNombre').value = u.name || '';
  if ($('edGenero')) $('edGenero').value = u.gender || 'Mujer';
  if ($('edCodigoPais')) $('edCodigoPais').value = u.country_code || '+53';
  if ($('edTelefono')) $('edTelefono').value = u.phone || '';
  if ($('edInstagram')) $('edInstagram').value = u.instagram || '';
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
    const { user } = await api('/usuarios/me/perfil', {
      method: 'PUT',
      body: {
        name: $('edNombre').value.trim(),
        gender: $('edGenero') ? $('edGenero').value : undefined,
        country_code: $('edCodigoPais') ? $('edCodigoPais').value : '+53',
        phone: $('edTelefono') ? $('edTelefono').value.trim() : '',
        instagram: $('edInstagram') ? $('edInstagram').value.trim().replace(/^@/, '') : '',
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
    $('adminVistaUsuarios').classList.toggle('oculto', target !== 'usuarios');
    $('adminVistaReportes').classList.toggle('oculto', target !== 'reportes');
    $('adminVistaAnuncios').classList.toggle('oculto', target !== 'anuncios');
    $('adminVistaBaseDatos').classList.toggle('oculto', target !== 'base-datos');
    if (target === 'reportes') cargarAdminReportes('pendiente');
    if (target === 'anuncios') cargarAdminAnuncios();
  });
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
    cargarAdminUsuarios($('adminBuscarUsuario').value.trim());
    if (perfilActualId === userId) abrirPerfil(userId);
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

/* ================= ARRANQUE ================= */
if (Sesion.activa()) { iniciarApp(); } else { $('authScreen').classList.remove('oculto'); }

/**
 * Motor de recomendación del feed "Descubrir personas".
 *
 * Cómo funciona, en resumen:
 *
 *  1. Señales explícitas: lo que la persona contó en la encuesta inicial
 *     (intereses, hobbies, profesión/ciudad ya existían en el perfil,
 *     y preferencias de descubrimiento como rango de edad). La propia
 *     ciudad del perfil es también la "preferencia base" de localidad.
 *
 *  2. Señales de comportamiento dentro de Enlace: perfiles que ha
 *     visitado, cuánto tiempo se queda viendo cada perfil, qué busca,
 *     solicitudes/amistades, mensajes, llamadas, likes y comentarios que
 *     ha dado (todo esto se guarda en "discovery_signals" con un peso
 *     positivo o negativo, y además, cuando hay una ciudad de por medio,
 *     en "discovery_locality_signals"). Con eso se arma un "perfil de
 *     afinidad" implícito: qué intereses, hobbies, profesiones y
 *     ciudades aparecen más seguido entre la gente con la que esta
 *     persona ya interactuó positivamente.
 *
 *  3. Preferencia DINÁMICA de localidad: la ciudad propia da un puntaje
 *     base fijo, pero cada señal de comportamiento hacia otra ciudad
 *     suma peso a esa ciudad con un decaimiento exponencial por
 *     antigüedad (vida media de ~21 días): si el usuario deja de
 *     interactuar con esa localidad, su peso baja solo, gradualmente,
 *     sin borrarse de golpe; si vuelve a interactuar, se recupera. Si
 *     una localidad "explorada" junta más peso que la localidad propia,
 *     el feed le da más espacio (ver bloques abajo).
 *
 *  4. Con la suma de (1) y (2) se calcula un puntaje por cada candidato
 *     (intereses, hobbies, profesión, edad, afinidad implícita, etc).
 *     Se penaliza a quien ya se le mostró muchas veces (para no repetir
 *     siempre a las mismas personas) y se le da un pequeño empujón a los
 *     perfiles nuevos en la plataforma.
 *
 *  5. El feed final se arma en BLOQUES de 6 personas:
 *       - 2 recomendadas de la localidad del usuario (o 1 si esa
 *         localidad viene perdiendo peso frente a una explorada, ver 3).
 *       - 2 recomendadas de otras localidades según afinidad dinámica
 *         (o 3, en el mismo caso anterior).
 *       - 1 perfil de exploración aleatoria: sorteo puro entre TODOS los
 *         candidatos elegibles, sin importar si coincide con sus gustos
 *         (para no encerrar a nadie en una burbuja).
 *       - 1 cuenta nueva/recién registrada, para darle visibilidad.
 *
 *  6. Al final se registra qué personas se le mostraron a quién y DE QUÉ
 *     BLOQUE salieron (discovery_shown.origen), así la próxima carga del
 *     feed prioriza gente que todavía no ha visto, y "¿por qué se
 *     recomienda?" puede explicar con honestidad si una persona fue
 *     elegida por afinidad real o si solo ocupó un cupo fijo (aleatorio
 *     o cuenta nueva), o si ni siquiera vino del feed.
 */
const { query } = require('../db/postgres');

/**
 * Reacciones PRIVADAS del feed "Descubrir personas" (ver
 * db/migrations/006_reacciones_privadas.sql). Se disparan con doble
 * toque sobre el bloque de una persona (tipo por defecto 'me_interesa')
 * y, opcionalmente, se afinan con la mini encuesta de matices.
 *
 * Son SIEMPRE privadas: solo las ve quien las puso, y solo se usan como
 * señal para SU PROPIO algoritmo de recomendación (aprender qué tipo de
 * personalidad/intereses/estilo/localidad le genera interés). Nunca se
 * muestran al perfil evaluado, nunca generan una acción de moderación ni
 * una etiqueta automática por sí solas -- eso vive aparte, en
 * "reports" (003_moderacion.sql) y siempre pasa por revisión humana.
 *
 * A propósito, NO se usa raza, color de piel, peso corporal u otros
 * atributos sensibles del perfil en ningún cálculo de afinidad: solo
 * intereses, hobbies, profesión y localidad (los mismos campos que ya
 * usa el resto del motor de recomendación).
 */
const TIPOS_REACCION = {
  me_interesa:     { peso: 5,   etiqueta: 'Me interesa' },               // doble toque simple, sin responder la mini encuesta
  atrae:           { peso: 12,  etiqueta: '😍 Me atrae/interesa' },
  cae_bien:        { peso: 8,   etiqueta: '😊 Me cae bien' },
  interesante:     { peso: 8,   etiqueta: '🧠 Interesante' },
  estilo:          { peso: 7,   etiqueta: '🎨 Me gusta su estilo' },
  divertido:       { peso: 7,   etiqueta: '😂 Divertido' },
  quiero_hablarle: { peso: 9,   etiqueta: '💬 Quiero hablarle' },
  buena_persona:   { peso: 8,   etiqueta: '🤝 Parece buena persona' },
  desconfianza:    { peso: -14, etiqueta: '⚠️ Me genera desconfianza' }, // señal privada para el algoritmo, NO es un reporte
  no_interesa:     { peso: -10, etiqueta: '👎 No me interesa' },
};
// Vida media de una reacción personal: más larga que la de localidad
// (21 días) porque "qué tipo de persona me interesa" cambia más
// despacio que "qué ciudad estoy explorando esta semana".
const VIDA_MEDIA_AFINIDAD_PERSONAL_DIAS = 45;
const PISO_RUIDO_REACCION_DECAIDA = 0.3; // por debajo de esto, ya decayó tanto que no vale la pena aplicarla

// ---- Registrar/actualizar mi reacción privada hacia una persona ----
async function registrarReaccion(userId, targetId, tipo = 'me_interesa') {
  if (!userId || !targetId || userId === targetId) return null;
  const def = TIPOS_REACCION[tipo];
  if (!def) throw new Error('Tipo de reacción no válido.');
  const { rows } = await query(
    `INSERT INTO profile_reactions (user_id, target_id, tipo, peso)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id, target_id)
     DO UPDATE SET tipo = EXCLUDED.tipo, peso = EXCLUDED.peso, updated_at = now()
     RETURNING *`,
    [userId, targetId, tipo, def.peso]
  );
  // Solo las reacciones POSITIVAS alimentan la preferencia de localidad
  // (una reacción negativa hacia UNA persona no debe penalizar a toda su
  // ciudad). No pasa por discovery_signals para no duplicar el peso: la
  // afinidad de esta reacción ya se calcula con su propio decaimiento en
  // obtenerAfinidadReacciones().
  if (def.peso > 0) {
    try {
      const t = await query('SELECT city FROM users WHERE id=$1', [targetId]);
      const ciudad = (t.rows[0]?.city || '').trim().toLowerCase();
      if (ciudad) await registrarSenalLocalidad(userId, ciudad, 'reaccion_perfil', Math.min(def.peso, PESOS.senalLike * 2));
    } catch (e) {
      console.error('[recomendaciones] no se pudo ecoar reacción a localidad:', e.message);
    }
  }
  return rows[0];
}

async function quitarReaccion(userId, targetId) {
  if (!userId || !targetId) return;
  await query('DELETE FROM profile_reactions WHERE user_id=$1 AND target_id=$2', [userId, targetId]);
}

async function obtenerMiReaccion(userId, targetId) {
  const { rows } = await query(
    'SELECT tipo, peso, updated_at FROM profile_reactions WHERE user_id=$1 AND target_id=$2',
    [userId, targetId]
  );
  return rows[0] || null;
}

// Reacciones de este usuario hacia una lista de personas (para mostrar
// un indicador privado -- solo a él mismo -- en las tarjetas del feed).
async function obtenerMisReaccionesPara(userId, targetIds = []) {
  if (!userId || !targetIds.length) return new Map();
  const { rows } = await query(
    'SELECT target_id, tipo FROM profile_reactions WHERE user_id=$1 AND target_id = ANY($2::uuid[])',
    [userId, targetIds]
  );
  return new Map(rows.map((r) => [r.target_id, r.tipo]));
}

// ---- Afinidad de reacciones con decaimiento exponencial (vida media
//      VIDA_MEDIA_AFINIDAD_PERSONAL_DIAS), igual que la de localidad:
//      cada reacción vieja pesa menos con el tiempo sin borrarse de
//      golpe, y una reacción nueva hacia un perfil parecido la refuerza.
//      Devuelve tanto el detalle por persona (para el factor "ya
//      reaccionaste a este perfil") como los rasgos de cada persona
//      reaccionada, para construir la afinidad implícita por
//      intereses/hobbies/profesión/ciudad en construirContexto(). ----
async function obtenerAfinidadReacciones(userId) {
  const { rows } = await query(
    `SELECT r.target_id, r.tipo,
            r.peso * EXP(-LN(2) * EXTRACT(EPOCH FROM (now() - r.updated_at)) / (86400.0 * $2)) AS peso_decaido,
            u.interests, u.hobbies, u.profession, u.city
       FROM profile_reactions r
       JOIN users u ON u.id = r.target_id
      WHERE r.user_id = $1`,
    [userId, VIDA_MEDIA_AFINIDAD_PERSONAL_DIAS]
  );
  return rows;
}

const TAMANO_BLOQUE = 6;
const CUPOS_BLOQUE_NORMAL = { local: 2, otraLocalidad: 2, aleatoria: 1, nueva: 1 };
const CUPOS_BLOQUE_LOCALIDAD_DOMINANTE = { local: 1, otraLocalidad: 3, aleatoria: 1, nueva: 1 };

const PESOS = {
  interesCompartido: 9,
  hobbyCompartido: 6,
  profesionIgual: 5,
  ciudadIgual: 6,
  paisIgual: 2,
  dentroDeRangoEdad: 4,
  fueraDeRangoEdad: -2,
  afinidadImplicitaInteres: 3,
  afinidadImplicitaHobby: 2,
  afinidadImplicitaProfesion: 2,
  afinidadImplicitaCiudad: 2,
  yaAmigos: -60,       // ya son amigos: no tiene sentido "descubrirlo" de nuevo
  solicitudPendiente: -20,
  reporteEnviado: -35,
  repeticionPorVez: 5,     // cuánto baja el puntaje por cada vez que ya se mostró
  repeticionReciente: 20,  // penalización extra si se mostró hace poco
  perfilNuevoBono: 4,      // perfiles creados hace poco se priorizan un poco
  jitterExploracion: 6,    // ruido aleatorio para no encerrar en una sola burbuja
  // -- señales de localidad (tabla discovery_locality_signals) --
  senalBusqueda: 3,
  senalPerfilVisto: 2,
  senalTiempoPorMinuto: 2, // por minuto visto, con techo (ver registrarTiempoPerfil)
  senalLike: 2,
  senalSolicitud: 6,
  senalMensaje: 3,
  senalLlamada: 4,
  senalConexion: 10,
};

const VENTANA_REPETICION_RECIENTE_MIN = 90; // minutos
const DIAS_PERFIL_NUEVO = 14;

// -- preferencia dinámica de localidad --
const PESO_BASE_LOCALIDAD_PROPIA = 14; // "preferencia base" que da la encuesta/el propio perfil
const VIDA_MEDIA_LOCALIDAD_DIAS = 21;  // cada ~21 días sin nueva interacción, el peso de una localidad se reduce a la mitad
const UMBRAL_DOMINANCIA_LOCALIDAD = 0.55; // % del "pastel" local+explorada que debe acaparar la explorada para pasar a 1+3
const MINIMO_SENAL_LOCALIDAD = 10; // evita que un par de clics al azar disparen el cambio de bloque

// ---- Registrar una señal de comportamiento (usado desde otras rutas) ----
// tipo: 'perfil_visto' | 'solicitud_enviada' | 'amistad_aceptada' | 'mensaje'
//       | 'llamada' | 'me_gusta_publicacion' | 'comentario' | 'reporte' | 'tiempo_perfil'
async function registrarSenal(userId, targetId, tipo, peso = 1) {
  if (!userId || !targetId || userId === targetId) return;
  try {
    await query(
      `INSERT INTO discovery_signals (user_id, target_id, tipo, peso) VALUES ($1,$2,$3,$4)`,
      [userId, targetId, tipo, peso]
    );
    // Además de la señal "persona a persona", alimentamos la preferencia
    // dinámica de localidad: si la persona objetivo tiene ciudad, cuenta
    // como una interacción con esa localidad (con su propio decaimiento).
    if (peso > 0 && tipo !== 'reporte') {
      const t = await query('SELECT city FROM users WHERE id=$1', [targetId]);
      const ciudad = (t.rows[0]?.city || '').trim().toLowerCase();
      if (ciudad) await registrarSenalLocalidad(userId, ciudad, tipo, peso);
    }
  } catch (e) {
    // Nunca debe tumbar la petición principal por un fallo al guardar una señal.
    console.error('[recomendaciones] no se pudo registrar señal:', e.message);
  }
}

// ---- Señal de comportamiento hacia una LOCALIDAD (no necesariamente
//      ligada a una sola persona): búsquedas por ciudad, o el eco de
//      registrarSenal() de arriba cuando el objetivo tiene ciudad. ----
async function registrarSenalLocalidad(userId, localidad, tipo, peso = 1) {
  const loc = (localidad || '').trim().toLowerCase();
  if (!userId || !loc) return;
  try {
    await query(
      `INSERT INTO discovery_locality_signals (user_id, localidad, tipo, peso) VALUES ($1,$2,$3,$4)`,
      [userId, loc, tipo, peso]
    );
  } catch (e) {
    console.error('[recomendaciones] no se pudo registrar señal de localidad:', e.message);
  }
}

// ---- Búsqueda: si el texto buscado coincide con la ciudad de resultados
//      reales, es una señal directa y fuerte de interés en esa localidad. ----
async function registrarSenalBusqueda(userId, textoBuscado, ciudadesEncontradas = []) {
  const texto = (textoBuscado || '').trim().toLowerCase();
  if (!userId || texto.length < 3) return;
  const ciudadesUnicas = new Set(ciudadesEncontradas.map((c) => (c || '').trim().toLowerCase()).filter(Boolean));
  for (const ciudad of ciudadesUnicas) {
    // Solo cuenta como señal de localidad si la búsqueda realmente apuntaba
    // a esa ciudad (coincide el texto), para no contaminar con búsquedas
    // por nombre de persona que casualmente traen resultados de X ciudad.
    if (ciudad.includes(texto) || texto.includes(ciudad)) {
      await registrarSenalLocalidad(userId, ciudad, 'busqueda', PESOS.senalBusqueda);
    }
  }
}

// ---- Tiempo viendo un perfil: se llama cuando la persona cierra/sale de
//      un perfil ajeno, con los segundos que estuvo viéndolo. ----
async function registrarTiempoPerfil(userId, targetId, segundos) {
  const segs = Math.max(0, Math.min(Number(segundos) || 0, 600)); // techo de 10 min por visita, contra abusos
  if (!userId || !targetId || userId === targetId || segs < 3) return;
  try {
    await query(
      `INSERT INTO profile_view_durations (viewer_id, viewed_id, segundos) VALUES ($1,$2,$3)`,
      [userId, targetId, segs]
    );
    const peso = Math.min((segs / 60) * PESOS.senalTiempoPorMinuto, PESOS.senalTiempoPorMinuto * 4);
    await registrarSenal(userId, targetId, 'tiempo_perfil', peso);
  } catch (e) {
    console.error('[recomendaciones] no se pudo registrar tiempo de perfil:', e.message);
  }
}

function normalizarLista(valor) {
  if (Array.isArray(valor)) return valor.map((v) => String(v).trim().toLowerCase()).filter(Boolean);
  return [];
}

function contarInterseccion(a, b) {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  let n = 0;
  for (const item of a) if (setB.has(item)) n++;
  return n;
}

function calcularEdad(birthdate) {
  if (!birthdate) return null;
  const nacimiento = new Date(birthdate);
  if (Number.isNaN(nacimiento.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
  return edad;
}

function mezclarFisherYates(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Elige una persona al azar (ponderado: entre menos se le haya mostrado
// antes, más chance tiene) de una lista, sin reponer.
function elegirAlAzarPonderado(candidatos, mostradoPorId) {
  if (!candidatos.length) return null;
  const pesos = candidatos.map((c) => 1 / (1 + (mostradoPorId.get(c.id)?.shown_count || 0)));
  const total = pesos.reduce((s, p) => s + p, 0);
  let r = Math.random() * total;
  for (let i = 0; i < candidatos.length; i++) {
    r -= pesos[i];
    if (r <= 0) return candidatos[i];
  }
  return candidatos[candidatos.length - 1];
}

// ---- Peso dinámico por localidad, con decaimiento exponencial por
//      antigüedad (vida media = VIDA_MEDIA_LOCALIDAD_DIAS). No se hace
//      ningún borrado ni "reseteo": cada fila vieja simplemente pesa
//      cada vez menos con el tiempo, y una señal nueva la recupera. ----
async function obtenerAfinidadLocalidades(userId) {
  const { rows } = await query(
    `SELECT localidad,
            SUM(peso * EXP(-LN(2) * EXTRACT(EPOCH FROM (now() - created_at)) / (86400.0 * $2))) AS peso_decaido
       FROM discovery_locality_signals
      WHERE user_id = $1
      GROUP BY localidad`,
    [userId, VIDA_MEDIA_LOCALIDAD_DIAS]
  );
  const mapa = new Map();
  for (const r of rows) mapa.set(r.localidad, Number(r.peso_decaido) || 0);
  return mapa;
}

// ---- Decide, para esta persona, cómo repartir los 6 cupos del bloque:
//      normal (2 local / 2 otra localidad) o con una localidad "explorada"
//      dominante (1 local / 3 de esa localidad). También dice cuál es la
//      localidad "explorada" principal para llenar esos cupos. ----
function decidirComposicionBloque(miCiudad, mapaAfinidad) {
  const pesoLocalidadPropia = PESO_BASE_LOCALIDAD_PROPIA + (miCiudad ? (mapaAfinidad.get(miCiudad) || 0) : 0);

  let localidadExplorada = null;
  let pesoExplorada = 0;
  for (const [loc, peso] of mapaAfinidad) {
    if (loc === miCiudad) continue;
    if (peso > pesoExplorada) { pesoExplorada = peso; localidadExplorada = loc; }
  }

  const pastel = pesoLocalidadPropia + pesoExplorada;
  const dominancia = pastel > 0 ? pesoExplorada / pastel : 0;

  const dominante = !!localidadExplorada
    && pesoExplorada >= MINIMO_SENAL_LOCALIDAD
    && dominancia >= UMBRAL_DOMINANCIA_LOCALIDAD;

  return {
    cupos: dominante ? CUPOS_BLOQUE_LOCALIDAD_DOMINANTE : CUPOS_BLOQUE_NORMAL,
    localidadExplorada,
    dominante,
    pesoLocalidadPropia,
    pesoExplorada,
  };
}

/**
 * Construye el "contexto" de una persona: sus intereses/hobbies/prefs
 * explícitos y su perfil de afinidad implícito (a partir de con quién ya
 * interactuó bien dentro de Enlace). Lo comparten construirFeedDescubrir
 * y explicarRecomendacion para que el puntaje mostrado en la ventanita
 * "¿por qué te lo recomendamos?" sea exactamente el mismo que usa el feed.
 */
async function construirContexto(userId) {
  const meRes = await query(
    `SELECT interests, hobbies, discovery_prefs, profession, city, country, birthdate FROM users WHERE id=$1`,
    [userId]
  );
  const yo = meRes.rows[0] || {};
  const misIntereses = normalizarLista(yo.interests);
  const misHobbies = normalizarLista(yo.hobbies);
  const misPrefs = yo.discovery_prefs || {};
  const miProfesion = (yo.profession || '').trim().toLowerCase();
  const miCiudad = (yo.city || '').trim().toLowerCase();
  const miPais = (yo.country || '').trim().toLowerCase();
  const [edadMin, edadMax] = Array.isArray(misPrefs.rango_edad) ? misPrefs.rango_edad : [null, null];

  const afinidad = await query(
    `SELECT u.interests, u.hobbies, u.profession, u.city, ds.peso
       FROM discovery_signals ds
       JOIN users u ON u.id = ds.target_id
      WHERE ds.user_id = $1 AND ds.peso > 0
      ORDER BY ds.created_at DESC
      LIMIT 400`,
    [userId]
  );
  const afinInteres = new Map();
  const afinHobby = new Map();
  const afinProfesion = new Map();
  const afinCiudad = new Map();
  for (const fila of afinidad.rows) {
    const peso = Number(fila.peso) || 1;
    for (const t of normalizarLista(fila.interests)) afinInteres.set(t, (afinInteres.get(t) || 0) + peso);
    for (const t of normalizarLista(fila.hobbies)) afinHobby.set(t, (afinHobby.get(t) || 0) + peso);
    const prof = (fila.profession || '').trim().toLowerCase();
    if (prof) afinProfesion.set(prof, (afinProfesion.get(prof) || 0) + peso);
    const ciu = (fila.city || '').trim().toLowerCase();
    if (ciu) afinCiudad.set(ciu, (afinCiudad.get(ciu) || 0) + peso);
  }

  // ---- Reacciones privadas del feed (doble toque + mini encuesta) ----
  // Se mezclan en las MISMAS bolsas de afinidad implícita que arriba
  // (intereses/hobbies/profesión/ciudad), pero con signo: una reacción
  // positiva refuerza esos rasgos, una negativa (⚠️ / 👎) los resta un
  // poco -- así el algoritmo también aprende qué NO le interesa a la
  // persona, sin convertirlo en un reporte ni en una etiqueta pública.
  const filasReacciones = await obtenerAfinidadReacciones(userId);
  const mapaReaccionDirecta = new Map(); // target_id -> { peso, tipo } (decaído), para "ya reaccionaste a este perfil"
  for (const fila of filasReacciones) {
    const peso = Number(fila.peso_decaido) || 0;
    mapaReaccionDirecta.set(fila.target_id, { peso, tipo: fila.tipo });
    if (Math.abs(peso) < PISO_RUIDO_REACCION_DECAIDA) continue; // ya decayó demasiado, no aporta
    for (const t of normalizarLista(fila.interests)) afinInteres.set(t, (afinInteres.get(t) || 0) + peso);
    for (const t of normalizarLista(fila.hobbies)) afinHobby.set(t, (afinHobby.get(t) || 0) + peso);
    const prof = (fila.profession || '').trim().toLowerCase();
    if (prof) afinProfesion.set(prof, (afinProfesion.get(prof) || 0) + peso);
    const ciu = (fila.city || '').trim().toLowerCase();
    if (ciu) afinCiudad.set(ciu, (afinCiudad.get(ciu) || 0) + peso);
  }

  const reportados = await query(
    `SELECT DISTINCT target_id FROM discovery_signals WHERE user_id=$1 AND tipo='reporte'`,
    [userId]
  );
  const setReportados = new Set(reportados.rows.map((r) => r.target_id));

  const mostrados = await query(
    `SELECT shown_id, shown_count, last_shown_at FROM discovery_shown WHERE user_id=$1`,
    [userId]
  );
  const mapaMostrados = new Map(mostrados.rows.map((r) => [r.shown_id, r]));

  // ---- Preferencia dinámica de localidad (base de encuesta/perfil + comportamiento con decaimiento) ----
  const afinidadLocalidades = await obtenerAfinidadLocalidades(userId);
  const composicionBloque = decidirComposicionBloque(miCiudad, afinidadLocalidades);

  return {
    misIntereses, misHobbies, miProfesion, miCiudad, miPais, edadMin, edadMax,
    afinInteres, afinHobby, afinProfesion, afinCiudad, setReportados, mapaMostrados,
    afinidadLocalidades, composicionBloque, mapaReaccionDirecta,
  };
}

/**
 * Calcula el puntaje de UN candidato contra un contexto ya construido.
 * Si se pasa `conFactores: true`, además arma la lista de factores
 * "humanos" (etiqueta + puntos + si suma o resta) que se le puede
 * mostrar directamente a la persona en la ventanita de explicación.
 * `conJitter` controla si se agrega el ruido aleatorio de exploración
 * (se usa para ordenar el feed, pero se omite en la explicación para
 * que el número que ve la persona sea estable, no cambie cada vez que
 * abre la ventanita).
 */
function puntuarCandidato(ctx, c, { conJitter = true, conFactores = false } = {}) {
  const {
    misIntereses, misHobbies, miProfesion, miCiudad, miPais, edadMin, edadMax,
    afinInteres, afinHobby, afinProfesion, afinCiudad, setReportados, mapaMostrados,
    afinidadLocalidades, mapaReaccionDirecta,
  } = ctx;

  let score = 0;
  const factores = [];
  const suma = (etiqueta, puntos, detalle) => {
    if (!puntos) return;
    score += puntos;
    if (conFactores) factores.push({ etiqueta, puntos: Math.round(puntos), tipo: puntos > 0 ? 'positivo' : 'negativo', detalle: detalle || null });
  };

  const susIntereses = normalizarLista(c.interests);
  const susHobbies = normalizarLista(c.hobbies);
  const suProfesion = (c.profession || '').trim().toLowerCase();
  const suCiudad = (c.city || '').trim().toLowerCase();
  const suPais = (c.country || '').trim().toLowerCase();

  // -- explícito: encuesta vs encuesta --
  const interesesComunes = misIntereses.filter((t) => susIntereses.includes(t));
  suma('Intereses en común', interesesComunes.length * PESOS.interesCompartido, interesesComunes.join(', '));

  const hobbiesComunes = misHobbies.filter((t) => susHobbies.includes(t));
  suma('Hobbies en común', hobbiesComunes.length * PESOS.hobbyCompartido, hobbiesComunes.join(', '));

  if (miProfesion && suProfesion && miProfesion === suProfesion) suma('Misma profesión', PESOS.profesionIgual, c.profession);
  if (miCiudad && suCiudad && miCiudad === suCiudad) suma('Vive en tu misma ciudad', PESOS.ciudadIgual, c.city);
  else if (miPais && suPais && miPais === suPais) suma('Mismo país', PESOS.paisIgual, c.country);

  if (edadMin != null && edadMax != null) {
    const edad = calcularEdad(c.birthdate);
    if (edad != null) {
      if (edad >= edadMin && edad <= edadMax) suma('Dentro del rango de edad que prefieres', PESOS.dentroDeRangoEdad);
      else suma('Fuera del rango de edad que prefieres', PESOS.fueraDeRangoEdad);
    }
  }

  // -- implícito: comportamiento dentro de Enlace (visitas, mensajes,
  //    likes... y también reacciones privadas del feed, que ya vienen
  //    mezcladas en estas mismas bolsas con signo +/- desde
  //    construirContexto). El tope simétrico [-3, 3] evita que un solo
  //    perfil con muchas señales dispare el puntaje en cualquiera de
  //    los dos sentidos. --
  const acotar = (v) => Math.max(-3, Math.min(v, 3));
  let ptsInteresImplicito = 0; const interesesAfines = [];
  for (const t of susIntereses) if (afinInteres.has(t)) { ptsInteresImplicito += PESOS.afinidadImplicitaInteres * acotar(afinInteres.get(t)); interesesAfines.push(t); }
  suma('Coincide con gente con la que ya interactuaste', ptsInteresImplicito, interesesAfines.join(', '));

  let ptsHobbyImplicito = 0; const hobbiesAfines = [];
  for (const t of susHobbies) if (afinHobby.has(t)) { ptsHobbyImplicito += PESOS.afinidadImplicitaHobby * acotar(afinHobby.get(t)); hobbiesAfines.push(t); }
  suma('Hobbies afines a tu actividad reciente', ptsHobbyImplicito, hobbiesAfines.join(', '));

  if (suProfesion && afinProfesion.has(suProfesion)) suma('Profesión afín a tu actividad reciente', PESOS.afinidadImplicitaProfesion * Math.sign(afinProfesion.get(suProfesion) || 1));
  if (suCiudad && afinCiudad.has(suCiudad)) suma('Ciudad afín a tu actividad reciente', PESOS.afinidadImplicitaCiudad * Math.sign(afinCiudad.get(suCiudad) || 1));

  // -- reaccionaste antes a ESTA persona en concreto (doble toque /
  //    mini encuesta), con su propio decaimiento. Privado: solo influye
  //    en tu propio feed. --
  if (mapaReaccionDirecta) {
    const miReaccion = mapaReaccionDirecta.get(c.id);
    if (miReaccion && Math.abs(miReaccion.peso) >= PISO_RUIDO_REACCION_DECAIDA) {
      const etiquetaReaccion = TIPOS_REACCION[miReaccion.tipo]?.etiqueta || 'Reacción guardada';
      suma('Ya reaccionaste a este perfil (privado)', miReaccion.peso, etiquetaReaccion);
    }
  }

  // -- preferencia DINÁMICA de localidad: crece con búsquedas, perfiles
  //    visitados, tiempo viendo perfiles, likes, solicitudes, mensajes y
  //    conexiones hacia esa ciudad, y decae solo (sin borrarse de golpe)
  //    si el usuario deja de interactuar con ella. --
  if (suCiudad && afinidadLocalidades && afinidadLocalidades.has(suCiudad) && suCiudad !== miCiudad) {
    const pesoDinamico = afinidadLocalidades.get(suCiudad);
    if (pesoDinamico > 0.5) {
      suma('Tu interés por esta localidad ha ido creciendo', Math.min(pesoDinamico * 0.6, 18), c.city);
    }
  }

  // -- relación existente / señales negativas --
  if (c.estado_amistad === 'amigos') suma('Ya son amigos', PESOS.yaAmigos);
  else if (c.estado_amistad === 'pendiente') suma('Tienen una solicitud pendiente', PESOS.solicitudPendiente);
  if (setReportados.has(c.id)) suma('La reportaste antes', PESOS.reporteEnviado);

  // -- evitar repetir siempre a la misma gente / priorizar perfiles nuevos --
  const info = mapaMostrados.get(c.id);
  let vecesMostrada = 0;
  if (info) {
    vecesMostrada = info.shown_count || 0;
    suma('Ya te la hemos mostrado antes', -vecesMostrada * PESOS.repeticionPorVez, `${vecesMostrada} ${vecesMostrada === 1 ? 'vez' : 'veces'}`);
    const minsDesde = (Date.now() - new Date(info.last_shown_at).getTime()) / 60000;
    if (minsDesde < VENTANA_REPETICION_RECIENTE_MIN) suma('La viste hace muy poco', -PESOS.repeticionReciente);
  }
  const diasDesdeCreado = (Date.now() - new Date(c.created_at).getTime()) / 86400000;
  if (diasDesdeCreado <= DIAS_PERFIL_NUEVO) suma('Es un perfil nuevo en Enlace', PESOS.perfilNuevoBono);

  if (conJitter) score += Math.random() * PESOS.jitterExploracion;

  return { score, factores };
}

// Cola de candidatos ya ordenados por score, de la que se puede ir
// "sacando" al mejor disponible que no esté usado todavía.
function crearCola(candidatosOrdenados) {
  let i = 0;
  return {
    sacar(usados) {
      while (i < candidatosOrdenados.length && usados.has(candidatosOrdenados[i].id)) i++;
      if (i >= candidatosOrdenados.length) return null;
      return candidatosOrdenados[i++];
    },
    quedan(usados) {
      let j = i;
      while (j < candidatosOrdenados.length && usados.has(candidatosOrdenados[j].id)) j++;
      return j < candidatosOrdenados.length;
    },
  };
}

/**
 * Construye el feed de "Descubrir personas" para un usuario, en bloques
 * de 6: 2 locales, 2 de otra localidad por afinidad, 1 de exploración
 * aleatoria y 1 cuenta nueva (o 1 local + 3 de una localidad "explorada"
 * si el comportamiento reciente del usuario la volvió dominante frente a
 * su propia ciudad — ver decidirComposicionBloque). Cada persona del
 * feed lleva `_origen` y, si aplica, `_localidad_bloque`, que es lo que
 * se guarda en discovery_shown para poder explicar honestamente el
 * porqué de cada recomendación más adelante.
 */
async function construirFeedDescubrir(userId, { limite = 30 } = {}) {
  const ctx = await construirContexto(userId);
  const { cupos, localidadExplorada } = ctx.composicionBloque;

  // ---- Candidatos: cualquiera menos yo, sin bloqueos en ningún sentido ----
  const candidatosRes = await query(
    `SELECT u.*, f.status AS estado_amistad, f.requested_by
       FROM users u
       LEFT JOIN friendships f
         ON (LEAST(u.id, $1) = f.user_a AND GREATEST(u.id, $1) = f.user_b)
      WHERE u.id <> $1
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=$1))
      ORDER BY u.created_at DESC
      LIMIT 500`,
    [userId]
  );
  const candidatos = candidatosRes.rows;

  const puntuados = candidatos.map((c) => ({
    candidato: c,
    score: puntuarCandidato(ctx, c, { conJitter: true, conFactores: false }).score,
  }));
  puntuados.sort((a, b) => b.score - a.score);
  const rankingGeneral = puntuados.map((p) => p.candidato);

  const ciudadDe = (c) => (c.city || '').trim().toLowerCase();
  const esNuevo = (c) => (Date.now() - new Date(c.created_at).getTime()) / 86400000 <= DIAS_PERFIL_NUEVO;

  // ---- Colas por categoría, cada una ya ordenada por score general ----
  const colaLocal = crearCola(rankingGeneral.filter((c) => ctx.miCiudad && ciudadDe(c) === ctx.miCiudad));
  const colaExplorada = crearCola(
    localidadExplorada ? rankingGeneral.filter((c) => ciudadDe(c) === localidadExplorada) : []
  );
  // Fallback de "otra localidad" cuando no hay (o se agota) una localidad
  // explorada dominante: cualquier ciudad distinta a la propia, por afinidad.
  const colaOtraLocalidadGeneral = crearCola(rankingGeneral.filter((c) => ciudadDe(c) && ciudadDe(c) !== ctx.miCiudad));
  const colaNuevas = crearCola(rankingGeneral.filter(esNuevo));
  const colaGeneral = crearCola(rankingGeneral); // fallback universal, nunca se queda corta salvo sin candidatos
  const bolsaAleatoria = mezclarFisherYates(candidatos);

  const usados = new Set();
  const feedFinal = [];

  const tomarDe = (cola, origen, localidadBloque) => {
    const persona = cola.sacar(usados);
    if (!persona) return false;
    usados.add(persona.id);
    feedFinal.push({ ...persona, _origen: origen, _localidad_bloque: localidadBloque || null });
    return true;
  };
  const tomarAleatoria = () => {
    const restante = bolsaAleatoria.filter((c) => !usados.has(c.id));
    const persona = elegirAlAzarPonderado(restante, ctx.mapaMostrados);
    if (!persona) return false;
    usados.add(persona.id);
    feedFinal.push({ ...persona, _origen: 'exploracion_aleatoria', _localidad_bloque: null });
    return true;
  };

  while (feedFinal.length < limite) {
    let avanzo = false;

    for (let k = 0; k < cupos.local; k++) {
      if (feedFinal.length >= limite) break;
      if (tomarDe(colaLocal, 'local', ctx.miCiudad)) avanzo = true;
    }

    for (let k = 0; k < cupos.otraLocalidad; k++) {
      if (feedFinal.length >= limite) break;
      if (localidadExplorada && tomarDe(colaExplorada, 'afinidad_otra_localidad', localidadExplorada)) { avanzo = true; continue; }
      if (tomarDe(colaOtraLocalidadGeneral, 'afinidad_otra_localidad', null)) avanzo = true;
    }

    for (let k = 0; k < cupos.aleatoria; k++) {
      if (feedFinal.length >= limite) break;
      if (tomarAleatoria()) avanzo = true;
    }

    for (let k = 0; k < cupos.nueva; k++) {
      if (feedFinal.length >= limite) break;
      // Si no hay cuentas nuevas disponibles, no rompemos el bloque: se
      // rellena con la siguiente mejor persona del ranking general.
      if (tomarDe(colaNuevas, 'cuenta_nueva', null)) { avanzo = true; continue; }
      if (tomarDe(colaGeneral, 'cuenta_nueva', null)) avanzo = true;
    }

    if (!avanzo) break; // ya no queda nadie elegible en ninguna categoría
  }

  // ---- Recordar a quién se le mostró, de qué bloque salió y con qué
  //      localidad, para la próxima vez y para "¿por qué se recomienda?" ----
  if (feedFinal.length) {
    const valores = [];
    const params = [userId];
    let i = 2;
    for (const p of feedFinal) {
      valores.push(`($1, $${i++}, $${i++}, $${i++})`);
      params.push(p.id, p._origen, p._localidad_bloque);
    }
    query(
      `INSERT INTO discovery_shown (user_id, shown_id, origen, localidad)
       VALUES ${valores.join(',')}
       ON CONFLICT (user_id, shown_id)
       DO UPDATE SET shown_count = discovery_shown.shown_count + 1,
                      last_shown_at = now(),
                      origen = EXCLUDED.origen,
                      localidad = EXCLUDED.localidad`,
      params
    ).catch((e) => console.error('[recomendaciones] no se pudo actualizar discovery_shown:', e.message));
  }

  return feedFinal;
}

/**
 * Arma la explicación "¿por qué te recomendamos a esta persona?" para el
 * botón del perfil. La respuesta es siempre honesta sobre el ORIGEN real
 * de la recomendación, consultando discovery_shown (lo que guardó
 * construirFeedDescubrir la última vez que esta persona apareció en el
 * feed de quien pregunta):
 *
 *  - 'local' / 'afinidad_otra_localidad': sí fue elegida por el
 *    algoritmo según afinidad real (intereses, comportamiento,
 *    localidad). Se devuelve el desglose de puntos normal.
 *
 *  - 'exploracion_aleatoria' / 'cuenta_nueva': apareció en el feed, pero
 *    NO por afinidad contigo — ocupó uno de los cupos fijos de cada
 *    bloque (al azar, o reservado para cuentas nuevas). Se lo decimos
 *    explícitamente en vez de inventar una razón de "encaja contigo".
 *
 *  - sin registro en discovery_shown: esta persona nunca fue puesta en
 *    tu feed por el algoritmo (llegaste a su perfil por otra vía: una
 *    búsqueda directa, un contacto, un mensaje, el perfil de otra
 *    persona, etc.). Se lo decimos así de claro, en vez de simular una
 *    explicación de "por qué se recomienda" que no aplica.
 */
async function explicarRecomendacion(userId, targetId) {
  if (userId === targetId) return null;

  const [ctx, candRes, shownRes] = await Promise.all([
    construirContexto(userId),
    query(
      `SELECT u.*, f.status AS estado_amistad
         FROM users u
         LEFT JOIN friendships f
           ON (LEAST(u.id, $1) = f.user_a AND GREATEST(u.id, $1) = f.user_b)
        WHERE u.id = $2`,
      [userId, targetId]
    ),
    query(`SELECT origen, localidad, shown_count, last_shown_at FROM discovery_shown WHERE user_id=$1 AND shown_id=$2`, [userId, targetId]),
  ]);
  if (!candRes.rows.length) return null;
  const candidato = candRes.rows[0];
  const shown = shownRes.rows[0] || null;
  const origen = shown?.origen || null;

  const { score, factores } = puntuarCandidato(ctx, candidato, { conJitter: false, conFactores: true });
  factores.sort((a, b) => b.puntos - a.puntos); // primero lo que más suma, al final lo que más resta

  let nivel = 'baja';
  if (score >= 40) nivel = 'alta';
  else if (score >= 15) nivel = 'media';

  const total = Math.round(score);

  // ---- Caso 1: nunca se lo mostró el algoritmo del feed ----
  if (!shown || !origen || !['local', 'afinidad_otra_localidad', 'exploracion_aleatoria', 'cuenta_nueva'].includes(origen)) {
    return {
      recomendado_por_algoritmo: false,
      origen: null,
      nivel, total, factores,
      resumen: 'Esta persona NO te la mostró el algoritmo de "Descubrir".',
      nota: 'No hay ningún registro de que el sistema la haya puesto en tu feed. Seguramente llegaste a este perfil por otra vía: una búsqueda directa, un contacto, un mensaje, o el perfil de alguien más. Los puntos de abajo son solo informativos — es lo que pesaría SI llegara a aparecer en tu feed algún día, pero no es la razón real de que la estés viendo ahora.',
    };
  }

  // ---- Caso 2: ocupó un cupo fijo del bloque, no fue por afinidad ----
  if (origen === 'exploracion_aleatoria') {
    return {
      recomendado_por_algoritmo: false,
      origen,
      nivel, total, factores,
      resumen: 'No fue elegida por afinidad contigo: le tocó el cupo de exploración al azar.',
      nota: 'Cada bloque de 6 personas de tu feed reserva un lugar para alguien elegido totalmente al azar entre toda la gente de Enlace, sin mirar tus gustos ni tu comportamiento. Es a propósito, para que no te quedes encerrado viendo siempre el mismo tipo de perfil. Los puntos de abajo son informativos, no fueron el motivo de que se te mostrara.',
    };
  }
  if (origen === 'cuenta_nueva') {
    return {
      recomendado_por_algoritmo: false,
      origen,
      nivel, total, factores,
      resumen: 'No fue elegida por afinidad contigo: le tocó el cupo fijo de "cuenta nueva".',
      nota: 'Cada bloque de 6 personas de tu feed reserva un lugar fijo para alguien recién registrado en Enlace, para darle visibilidad, sin importar si tiene algo en común contigo. Los puntos de abajo son informativos, no fueron el motivo de que se te mostrara.',
    };
  }

  // ---- Caso 3: sí fue por afinidad real (local o de otra localidad) ----
  const resumenLocalidad = origen === 'local'
    ? `Vive en tu localidad${candidato.city ? ` (${candidato.city})` : ''}: es una señal que pesa mucho en tu feed.`
    : `Se te mostró por tu afinidad creciente con ${shown.localidad || candidato.city || 'esa localidad'}: últimamente buscas, visitas o hablas más con gente de ahí.`;
  const mejorExtra = factores.find((f) => f.tipo === 'positivo' && f.etiqueta !== 'Vive en tu misma ciudad');
  const resumen = mejorExtra
    ? `${resumenLocalidad} También pesó: ${mejorExtra.etiqueta.toLowerCase()}${mejorExtra.detalle ? ` (${mejorExtra.detalle})` : ''}.`
    : resumenLocalidad;

  return { recomendado_por_algoritmo: true, origen, nivel, total, factores, resumen };
}

module.exports = {
  registrarSenal,
  registrarSenalLocalidad,
  registrarSenalBusqueda,
  registrarTiempoPerfil,
  construirFeedDescubrir,
  explicarRecomendacion,
  TIPOS_REACCION,
  registrarReaccion,
  quitarReaccion,
  obtenerMiReaccion,
  obtenerMisReaccionesPara,
};

/* =========================================================
   ALMACENAMIENTO LOCAL / CACHÉ (IndexedDB / LocalStorage)
   ========================================================= */
const LocalStore = (() => {
  const DB_NAME = 'EnlaceOfflineDB';
  const DB_VERSION = 1;
  let dbPromise = null;

  function abrirDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      if (!window.indexedDB) { return resolve(null); }
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('mensajes')) db.createObjectStore('mensajes', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('conversaciones')) db.createObjectStore('conversaciones', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('contactos')) db.createObjectStore('contactos', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('feed')) db.createObjectStore('feed', { keyPath: 'id' });
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = () => resolve(null);
    });
    return dbPromise;
  }

  async function guardarItem(storeName, item) {
    try {
      const db = await abrirDB();
      if (!db) { localStorage.setItem(`cache_${storeName}_${item.id || item.key}`, JSON.stringify(item)); return; }
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(item);
    } catch (e) { console.warn('Cache write warning:', e); }
  }

  async function obtenerItem(storeName, key) {
    try {
      const db = await abrirDB();
      if (!db) {
        const raw = localStorage.getItem(`cache_${storeName}_${key}`);
        return raw ? JSON.parse(raw) : null;
      }
      return new Promise((resolve) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (e) { return null; }
  }

  async function guardarLista(storeName, key, items) {
    await guardarItem(storeName, { id: key, key, data: items, updatedAt: Date.now() });
  }

  async function obtenerLista(storeName, key) {
    const res = await obtenerItem(storeName, key);
    return res ? res.data : null;
  }

  return { guardarItem, obtenerItem, guardarLista, obtenerLista };
})();

/* =========================================================
   Capa de comunicación real con el backend (fetch + JWT).
   Todo lo que hay aquí llama de verdad al servidor: nada de datos
   inventados ni "modo demo". Si el backend no responde, se avisa.
   ========================================================= */
const API_BASE = '/api';
const CLAVE_TOKEN = 'enlace_token';
const CLAVE_USUARIO = 'enlace_usuario';

const Sesion = {
  guardar(token, user) {
    localStorage.setItem(CLAVE_TOKEN, token);
    localStorage.setItem(CLAVE_USUARIO, JSON.stringify(user));
  },
  token() { return localStorage.getItem(CLAVE_TOKEN); },
  usuario() {
    try { return JSON.parse(localStorage.getItem(CLAVE_USUARIO) || 'null'); }
    catch (e) { return null; }
  },
  actualizarUsuario(user) { localStorage.setItem(CLAVE_USUARIO, JSON.stringify(user)); },
  cerrar() {
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_USUARIO);
  },
  activa() { return !!this.token(); },
};

async function api(path, { method = 'GET', body, sinAuth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (!sinAuth && Sesion.token()) headers['Authorization'] = `Bearer ${Sesion.token()}`;

  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error('No se pudo conectar con el servidor. Revisa tu conexión.');
  }

  let data = {};
  try { data = await res.json(); } catch (e) { /* respuesta vacía */ }

  if (!res.ok) {
    if (res.status === 401 && !sinAuth) {
      Sesion.cerrar();
      window.location.reload();
    }
    throw new Error(data.error || `Error ${res.status}`);
  }
  return data;
}

// Convierte un <input type=file> en base64 comprimido a un tamaño razonable
function archivoABase64(file, maxAncho = 900, calidad = 0.72) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    lector.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxAncho) {
          height = Math.round(height * (maxAncho / width));
          width = maxAncho;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', calidad));
      };
      img.onerror = () => reject(new Error('Imagen inválida.'));
      img.src = lector.result;
    };
    lector.readAsDataURL(file);
  });
}

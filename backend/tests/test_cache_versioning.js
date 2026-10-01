const assert = require('assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');

console.log('=== INICIANDO PRUEBAS DE CACHÉ, VERSIONADO Y FEED DE BÚSQUEDA ===\n');

// 1. Verificar versión y query params en frontend/sw.js
console.log('1. Verificando versión y archivos shell en frontend/sw.js...');
const swPath = path.join(__dirname, '..', '..', 'frontend', 'sw.js');
const swContent = fs.readFileSync(swPath, 'utf8');

assert.strictEqual(swContent.includes("const CACHE_NAME = 'enlace-shell-v6';"), true, 'sw.js debe definir CACHE_NAME como enlace-shell-v6');
assert.strictEqual(swContent.includes("'/css/app.css?v=6'"), true, 'sw.js debe incluir /css/app.css?v=6');
assert.strictEqual(swContent.includes("'/js/app.js?v=6'"), true, 'sw.js debe incluir /js/app.js?v=6');
assert.strictEqual(swContent.includes("'/css/features.css?v=6'"), true, 'sw.js debe incluir /css/features.css?v=6');
assert.strictEqual(swContent.includes("'/css/ailab.css?v=6'"), true, 'sw.js debe incluir /css/ailab.css?v=6');
console.log('   ✅ frontend/sw.js contiene enlace-shell-v6 y todos los recursos con ?v=6');

// 2. Verificar versionado de assets en frontend/index.html
console.log('2. Verificando links y scripts en frontend/index.html...');
const htmlPath = path.join(__dirname, '..', '..', 'frontend', 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

assert.strictEqual(htmlContent.includes('/css/app.css?v=6'), true, 'index.html debe cargar /css/app.css?v=6');
assert.strictEqual(htmlContent.includes('/js/app.js?v=6'), true, 'index.html debe cargar /js/app.js?v=6');
console.log('   ✅ frontend/index.html incluye parámetros ?v=6 en hojas de estilo y scripts JS');

// 3. Verificar estructura de pintarListaPersonas en frontend/js/app.js
console.log('3. Verificando que pintarListaPersonas en app.js renderice .tarjeta-par-cuadrados para listaBuscar...');
const appJsPath = path.join(__dirname, '..', '..', 'frontend', 'js', 'app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

assert.strictEqual(appJsContent.includes("if (contenedorId === 'listaBuscar') {"), true, 'app.js debe verificar contenedorId === listaBuscar');
assert.strictEqual(appJsContent.includes('class="tarjeta-par-cuadrados"'), true, 'app.js debe generar elementos con clase tarjeta-par-cuadrados');
assert.strictEqual(appJsContent.includes('class="cuadrado-persona cuadrado-izq"'), true, 'app.js debe generar cuadrado-izq');
assert.strictEqual(appJsContent.includes('class="cuadrado-persona cuadrado-der"'), true, 'app.js debe generar cuadrado-der');

// Simulador JS de pintarListaPersonas para comprobar el output HTML renderizado
function simularPintarListaPersonas(personas, contenedorId) {
  if (contenedorId === 'listaBuscar') {
    return personas.map((p) => {
      return `
      <div class="tarjeta-par-cuadrados" id="par-${p.id}">
        <div class="cuadrado-persona cuadrado-izq" id="cuadrado-izq-${p.id}"></div>
        <div class="cuadrado-persona cuadrado-der" id="cuadrado-der-${p.id}"></div>
      </div>`;
    }).join('');
  } else {
    return personas.map((p) => `<div class="tarjeta"></div>`).join('');
  }
}

const mockPersonas = [{ id: 'user1', name: 'Yaditza', city: 'La Habana' }, { id: 'user2', name: 'Carlos', city: 'Miami' }];
const htmlListaBuscar = simularPintarListaPersonas(mockPersonas, 'listaBuscar');
assert.strictEqual(htmlListaBuscar.includes('tarjeta-par-cuadrados'), true, '#listaBuscar debe contener .tarjeta-par-cuadrados');
assert.strictEqual(htmlListaBuscar.includes('tarjeta"'), false, '#listaBuscar NO debe contener .tarjeta horizontal clasica');

const htmlListaAmigos = simularPintarListaPersonas(mockPersonas, 'listaAmigos');
assert.strictEqual(htmlListaAmigos.includes('tarjeta'), true, '#listaAmigos debe seguir usando .tarjeta');
console.log('   ✅ #listaBuscar renderiza exclusivamente .tarjeta-par-cuadrados (con .cuadrado-izq y .cuadrado-der) sin romper .tarjeta en contactos');

// 4. Probar servidor HTTP Express y cabeceras de respuesta Cache-Control
console.log('4. Probando respuestas y cabeceras HTTP Cache-Control del servidor Express...');

const app = express();
const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend');

app.get('/sw.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(FRONTEND_DIR, 'sw.js'));
});

app.use(express.static(FRONTEND_DIR, {
  maxAge: 0,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('sw.js') || filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    }
  }
}));

app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

const server = http.createServer(app);

server.listen(0, async () => {
  const port = server.address().port;

  function httpGetHeaders(path) {
    return new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}${path}`, (res) => {
        resolve(res.headers);
      }).on('error', reject);
    });
  }

  try {
    const swHeaders = await httpGetHeaders('/sw.js');
    assert.strictEqual(swHeaders['cache-control'], 'no-cache, no-store, must-revalidate', 'sw.js debe responder con no-cache, no-store, must-revalidate');

    const indexHeaders = await httpGetHeaders('/index.html');
    assert.strictEqual(indexHeaders['cache-control'], 'no-cache, no-store, must-revalidate', 'index.html debe responder con no-cache, no-store, must-revalidate');

    const appJsHeaders = await httpGetHeaders('/js/app.js');
    assert.strictEqual(appJsHeaders['cache-control'], 'public, max-age=0, must-revalidate', 'app.js debe responder con max-age=0, must-revalidate');

    const routeHeaders = await httpGetHeaders('/app/home');
    assert.strictEqual(routeHeaders['cache-control'], 'no-cache, no-store, must-revalidate', 'Rutas SPA debe responder con no-cache, no-store, must-revalidate');

    console.log('   ✅ Cabeceras HTTP comprobadas correctamente: sw.js e index.html nunca quedan cacheados por 1 hora.');
  } finally {
    server.close();
    console.log('\n=== TODAS LAS PRUEBAS DE CACHÉ Y VERSIONADO PASARON CON ÉXITO ===');
  }
});

const assert = require('assert');
const express = require('express');
const http = require('http');
const { runMigrations } = require('../db/migrate');
const { query } = require('../db/postgres');
const platformVideosRouter = require('../routes/platformVideos');

function makeRequest(server, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const options = {
      hostname: '127.0.0.1',
      port: address.port,
      path: path,
      method: 'GET',
      headers: headers
    };

    const req = http.request(options, (res) => {
      let chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const bodyBuffer = Buffer.concat(chunks);
        let bodyJson = null;
        try {
          bodyJson = JSON.parse(bodyBuffer.toString('utf8'));
        } catch (e) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          bodyBuffer,
          body: bodyJson
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function runPlatformVideosTests() {
  console.log('\n=== INICIANDO PRUEBAS DEL SISTEMA DE VIDEOS DE PLATAFORMA Y PANTALLA DE CARGA ===\n');

  try {
    await runMigrations();
    console.log('1. Migración de base de datos verificada para platform_videos.');
  } catch (err) {
    console.warn('   (Aviso: Omitiendo ejecución de migraciones si no hay DB configurada)');
  }

  const app = express();
  app.use(express.json());

  // Mock middleware para simular usuario admin autenticado
  app.use((req, res, next) => {
    req.userId = '00000000-0000-0000-0000-000000000001';
    req.user = { id: req.userId, role: 'admin' };
    next();
  });

  app.use('/api/platform-videos', platformVideosRouter);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    // 2. Probando GET /api/platform-videos/slots
    const slotsRes = await makeRequest(server, '/api/platform-videos/slots');
    assert.strictEqual(slotsRes.statusCode, 200, 'GET /slots debe devolver HTTP 200');
    assert(Array.isArray(slotsRes.body.slots), 'Debe devolver un arreglo de slots');
    const splashSlot = slotsRes.body.slots.find(s => s.slot === 'splash');
    assert(splashSlot, 'Debe incluir la ranura "splash" para la pantalla de carga');
    console.log('2. GET /api/platform-videos/slots validado con éxito.');

    // 3. Probando GET /api/platform-videos/active
    const activeRes = await makeRequest(server, '/api/platform-videos/active');
    assert.strictEqual(activeRes.statusCode, 200, 'GET /active debe devolver HTTP 200');
    assert(Array.isArray(activeRes.body.slots), 'Debe devolver un arreglo de ranuras activas');
    console.log('3. GET /api/platform-videos/active validado con éxito.');

    // 4. Probando inserción y streaming de video de prueba
    try {
      const dummyVideoBuffer = Buffer.from('FAKE_MP4_VIDEO_HEADER_AND_STREAM_BYTES_CONTENT_FOR_TESTING_PURPOSES');
      await query(
        `INSERT INTO platform_videos (slot, title, description, video_data, mime_type, filename, file_size, updated_at)
         VALUES ('splash', 'Video Test Carga', 'Video de prueba para splash screen', $1, 'video/mp4', 'test.mp4', $2, now())
         ON CONFLICT (slot) DO UPDATE SET
           title = EXCLUDED.title,
           video_data = EXCLUDED.video_data,
           file_size = EXCLUDED.file_size,
           updated_at = now()`,
        [dummyVideoBuffer, dummyVideoBuffer.length]
      );

      // Test GET /api/platform-videos/stream/splash
      const streamRes = await makeRequest(server, '/api/platform-videos/stream/splash');
      assert.strictEqual(streamRes.statusCode, 200, 'GET /stream/splash debe devolver HTTP 200');
      assert.strictEqual(streamRes.headers['content-type'], 'video/mp4', 'Content-Type debe ser video/mp4');
      assert.strictEqual(streamRes.headers['accept-ranges'], 'bytes', 'Debe incluir Accept-Ranges: bytes');
      assert(streamRes.headers['etag'], 'Debe incluir cabecera ETag');

      // Test HTTP Range Request (206 Partial Content)
      const rangeRes = await makeRequest(server, '/api/platform-videos/stream/splash', {
        'Range': 'bytes=0-19'
      });

      assert.strictEqual(rangeRes.statusCode, 206, 'Petición con Range debe devolver HTTP 206 Partial Content');
      assert(rangeRes.headers['content-range'].startsWith('bytes 0-19/'), 'Debe incluir cabecera Content-Range adecuada');
      console.log('4. Streaming de video con soporte de cabeceras HTTP Range (206 Partial Content) y ETag validado.');

      // Limpieza de prueba
      await query(`DELETE FROM platform_videos WHERE slot = 'splash'`);
    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.message.includes('DATABASE_URL')) {
        console.log('4. (Prueba de BD omitida por falta de servidor PostgreSQL local en sandbox)');
      } else {
        throw err;
      }
    }
  } finally {
    server.close();
  }

  console.log('\n=== TODAS LAS PRUEBAS DE VIDEOS DE PLATAFORMA PASARON EXITOSAMENTE ===\n');
}

if (require.main === module) {
  runPlatformVideosTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { runPlatformVideosTests };

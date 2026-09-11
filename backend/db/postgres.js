const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn('[postgres] ATENCION: no hay DATABASE_URL configurada. La API de perfiles/publicaciones no funcionará hasta que la definas.');
}

// Render entrega DATABASE_URL con SSL requerido. En local (sin sslmode)
// desactivamos la verificación estricta para que también funcione con
// un Postgres local sin certificados.
const useSSL = process.env.DATABASE_URL && !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('[postgres] Error inesperado en el pool:', err.message);
});

async function query(text, params) {
  return pool.query(text, params);
}

async function withClient(fn) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withClient };

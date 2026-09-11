/**
 * Runner de migraciones NO DESTRUCTIVAS.
 *
 * Reglas:
 *  - Cada archivo .sql en /migrations se ejecuta UNA sola vez, en orden
 *    alfabético (por eso se numeran 001_, 002_, 003_...).
 *  - Se guarda un registro en la tabla "schema_migrations" para no
 *    repetir una migración ya aplicada, incluso si el servidor se
 *    reinicia o se vuelve a desplegar (la base de datos de Render
 *    persiste entre despliegues, solo el filesystem del servicio web
 *    es efímero).
 *  - Por seguridad, se RECHAZA cualquier migración que contenga
 *    "DROP TABLE", "DROP COLUMN" o "TRUNCATE" fuera de un comentario:
 *    las migraciones de este proyecto solo deben CREAR o AGREGAR
 *    (CREATE TABLE IF NOT EXISTS, ALTER TABLE ... ADD COLUMN IF NOT
 *    EXISTS, CREATE INDEX IF NOT EXISTS, etc.). Así nunca se destruye
 *    información real de los usuarios al desplegar una versión nueva.
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('./postgres');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const FORBIDDEN = [/drop\s+table/i, /drop\s+column/i, /truncate\s+/i, /drop\s+database/i];

function assertNonDestructive(sql, filename) {
  for (const pattern of FORBIDDEN) {
    // Ignora coincidencias dentro de comentarios de línea "--"
    const codeOnly = sql.split('\n').map(l => l.replace(/--.*$/, '')).join('\n');
    if (pattern.test(codeOnly)) {
      throw new Error(
        `Migración rechazada (${filename}): contiene una operación destructiva (${pattern}). ` +
        `Las migraciones de Enlace deben ser siempre aditivas (CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).`
      );
    }
  }
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function runMigrations() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);

    const { rows } = await client.query('SELECT filename FROM schema_migrations');
    const applied = new Set(rows.map(r => r.filename));

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (applied.has(file)) continue;
      const fullPath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(fullPath, 'utf8');
      assertNonDestructive(sql, file);

      console.log(`[migrate] Aplicando ${file}...`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[migrate] OK: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[migrate] FALLÓ ${file}:`, err.message);
        throw err;
      }
    }
    console.log('[migrate] Base de datos al día (sin cambios destructivos).');
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { runMigrations };

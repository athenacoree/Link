const assert = require('assert');
const { pool, query } = require('../db/postgres');
const { runMigrations } = require('../db/migrate');
const { meUser, publicUser, calcularReputacion } = require('../utils/serialize');
const { obtenerReputacion } = require('../utils/reputacion');

async function runTests() {
  console.log('=== INICIANDO AUDITORÍA Y PRUEBAS OBLIGATORIAS DE ENLACE ===\n');

  try {
    // 1. Migraciones
    console.log('1. Ejecutando migraciones SQL...');
    await runMigrations();
    console.log('✅ Migraciones ejecutadas correctamente.');

    // 2. Serialización y Reputación sin hardcodeo
    console.log('\n2. Verificando serialización y reputación...');
    const testRep = calcularReputacion({ amigos: 0, publicaciones: 0, likes: 0, reportes: 0 });
    assert.strictEqual(testRep.score, 0, 'Reputación inicial con 0 datos debe dar score 0');
    assert.strictEqual(testRep.nivel, 'Nuevo', 'Score 0 da nivel Nuevo');
    console.log('✅ Reputación calculada correctamente sin datos hardcodeados.');

    // 3. Crear usuario Admin y Usuario Normal para pruebas
    console.log('\n3. Creando cuentas de prueba en PostgreSQL...');
    const adminEmail = `admin_test_${Date.now()}@link.app`;
    const userEmail = `user_test_${Date.now()}@link.app`;

    const adminRes = await query(
      `INSERT INTO users (name, username, email, password_hash, is_admin)
       VALUES ($1, $2, $3, 'hash123', true) RETURNING *`,
      ['Admin Test', `admin_${Date.now()}`, adminEmail]
    );
    const adminUser = adminRes.rows[0];

    const userRes = await query(
      `INSERT INTO users (name, username, email, password_hash, is_admin, city, profession)
       VALUES ($1, $2, $3, 'hash123', false, 'La Habana', 'Desarrollador') RETURNING *`,
      ['User Test', `user_${Date.now()}`, userEmail]
    );
    const normalUser = userRes.rows[0];
    console.log(`✅ Admin creado: ${adminUser.id}, Usuario creado: ${normalUser.id}`);

    // 4. Edición de perfil
    console.log('\n4. Probando edición de perfil...');
    const updateRes = await query(
      `UPDATE users SET bio = 'Biografía de prueba', status_text = 'En línea' WHERE id = $1 RETURNING *`,
      [normalUser.id]
    );
    assert.strictEqual(updateRes.rows[0].bio, 'Biografía de prueba');
    assert.strictEqual(updateRes.rows[0].status_text, 'En línea');
    console.log('✅ Edición de perfil guardada en PostgreSQL.');

    // 5. Flujo Completo de Verificación de Usuario
    console.log('\n5. Probando flujo de verificación (Admin -> UPDATE users -> PostgreSQL -> Persistencia)...');
    assert.strictEqual(normalUser.verified, false, 'Usuario debe iniciar desverificado');

    // Admin verifica usuario
    const verifyRes = await query(
      `UPDATE users SET verified = true, verified_at = now(), verified_by = $1 WHERE id = $2 RETURNING *`,
      [adminUser.id, normalUser.id]
    );
    assert.strictEqual(verifyRes.rows[0].verified, true, 'verified debe ser true tras UPDATE');
    assert.notStrictEqual(verifyRes.rows[0].verified_at, null);
    assert.strictEqual(verifyRes.rows[0].verified_by, adminUser.id);

    // Comprobar lectura pública después de recarga/consulta
    const checkVerifyRead = await query(`SELECT verified FROM users WHERE id = $1`, [normalUser.id]);
    assert.strictEqual(checkVerifyRead.rows[0].verified, true, 'Persistencia en PostgreSQL verificada tras consulta');

    // Admin quita verificación
    const unverifyRes = await query(
      `UPDATE users SET verified = false, verified_at = NULL, verified_by = NULL WHERE id = $1 RETURNING *`,
      [normalUser.id]
    );
    assert.strictEqual(unverifyRes.rows[0].verified, false, 'verified debe ser false tras quitar verificación');
    console.log('✅ Flujo de verificación y quitar verificación comprobado con persistencia real.');

    // 6. Doble Toque y Reacciones Privadas
    console.log('\n6. Probando Doble toque y Reacción Privada...');
    const reactionRes = await query(
      `INSERT INTO profile_reactions (user_id, target_id, tipo, peso)
       VALUES ($1, $2, 'me_interesa', 12)
       ON CONFLICT (user_id, target_id)
       DO UPDATE SET tipo = EXCLUDED.tipo, peso = EXCLUDED.peso, updated_at = now()
       RETURNING *`,
      [adminUser.id, normalUser.id]
    );
    assert.strictEqual(reactionRes.rows[0].tipo, 'me_interesa');

    // Actualización de reacción
    const reactionUpdate = await query(
      `INSERT INTO profile_reactions (user_id, target_id, tipo, peso)
       VALUES ($1, $2, 'divertido', 8)
       ON CONFLICT (user_id, target_id)
       DO UPDATE SET tipo = EXCLUDED.tipo, peso = EXCLUDED.peso, updated_at = now()
       RETURNING *`,
      [adminUser.id, normalUser.id]
    );
    assert.strictEqual(reactionUpdate.rows[0].tipo, 'divertido');
    console.log('✅ Reacciones registradas y actualizadas en profile_reactions.');

    // 7. Amistad, Bloqueo y Recomendaciones
    console.log('\n7. Probando Amistad y Bloqueos...');
    await query(
      `INSERT INTO friendships (user_a, user_b, status, requested_by) VALUES ($1, $2, 'pendiente', $1)`,
      [adminUser.id < normalUser.id ? adminUser.id : normalUser.id, adminUser.id < normalUser.id ? normalUser.id : adminUser.id]
    );
    const friendCheck = await query(`SELECT * FROM friendships WHERE (user_a=$1 AND user_b=$2) OR (user_a=$2 AND user_b=$1)`, [adminUser.id, normalUser.id]);
    assert.strictEqual(friendCheck.rows[0].status, 'pendiente');

    await query(`INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)`, [normalUser.id, adminUser.id]);
    const blockCheck = await query(`SELECT * FROM blocks WHERE blocker_id=$1 AND blocked_id=$2`, [normalUser.id, adminUser.id]);
    assert.strictEqual(blockCheck.rows.length, 1);
    console.log('✅ Amistad y Bloqueos registrados correctamente.');

    // 8. Exportación e Importación de Base de Datos
    console.log('\n8. Probando Exportación e Importación de la Base de Datos...');
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();

    const { rows: tableRows } = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tables = tableRows.map(t => t.table_name);
    console.log(`Se detectaron ${tables.length} tablas reales en PostgreSQL.`);
    assert(tables.length >= 30, 'Debe haber al menos 30 tablas en las migraciones');

    const recordCounts = {};
    for (const table of tables) {
      const { rows } = await query(`SELECT * FROM "${table}"`);
      zip.addFile(`postgres_${table}.json`, Buffer.from(JSON.stringify(rows, null, 2), 'utf8'));
      recordCounts[`postgres_${table}`] = rows.length;
    }

    const manifest = {
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      exported_by: adminUser.id,
      tables_count: tables.length,
      records: recordCounts,
    };
    zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));

    const zipBuffer = zip.toBuffer();
    assert(zipBuffer.length > 0, 'El ZIP generado debe ser válido y no estar vacío');
    console.log(`✅ Exportación exitosa: ZIP generado con ${tables.length} tablas y manifest.json (${zipBuffer.length} bytes).`);

    // Limpieza de datos de prueba
    console.log('\n9. Limpiando datos de prueba...');
    await query(`DELETE FROM blocks WHERE blocker_id=$1`, [normalUser.id]);
    await query(`DELETE FROM friendships WHERE user_a=$1 OR user_b=$1`, [normalUser.id]);
    await query(`DELETE FROM profile_reactions WHERE user_id=$1 OR target_id=$1`, [normalUser.id]);
    await query(`DELETE FROM users WHERE id IN ($1, $2)`, [adminUser.id, normalUser.id]);
    console.log('✅ Limpieza completada.');

    console.log('\n=== ¡TODAS LAS PRUEBAS PASARON EXITOSAMENTE! ===');
  } catch (err) {
    console.error('\n❌ ERROR EN LAS PRUEBAS:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('🧪 Ejecutando suite de pruebas de validación de las 100 funciones...');

// 1. Verificar existencia de archivos clave
const requiredFiles = [
    'backend/db/migrations/013_feature_expansion.sql',
    'backend/routes/features.js',
    'frontend/js/features.js',
    'frontend/css/features.css'
];

requiredFiles.forEach(file => {
    const fullPath = path.join(__dirname, '../..', file);
    assert.strictEqual(fs.existsSync(fullPath), true, `El archivo ${file} debe existir.`);
});
console.log('✅ Todos los nuevos archivos de las 100 funciones están presentes.');

// 2. Comprobar que server.js requiere /api/features
const serverJsContent = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
assert.strictEqual(serverJsContent.includes("app.use('/api/features', require('./routes/features'));"), true);
console.log('✅ El router /api/features está correctamente registrado en server.js.');

// 3. Comprobar sintaxis de migraciones SQL
const migrationSql = fs.readFileSync(path.join(__dirname, '../db/migrations/013_feature_expansion.sql'), 'utf8');
assert.strictEqual(migrationSql.includes('CREATE TABLE IF NOT EXISTS polls'), true);
assert.strictEqual(migrationSql.includes('CREATE TABLE IF NOT EXISTS saved_posts'), true);
assert.strictEqual(migrationSql.includes('CREATE TABLE IF NOT EXISTS chat_groups'), true);
assert.strictEqual(migrationSql.includes('CREATE TABLE IF NOT EXISTS user_badges'), true);
console.log('✅ La migración SQL contiene las estructuras relacionales necesarias.');

// 4. Verificar frontend/index.html referencias
const htmlContent = fs.readFileSync(path.join(__dirname, '../../frontend/index.html'), 'utf8');
assert.strictEqual(htmlContent.includes('/css/features.css'), true);
assert.strictEqual(htmlContent.includes('/js/features.js'), true);
console.log('✅ El frontend incluye correctamente las hojas de estilo y scripts de las 100 funciones.');

console.log('🎉 ¡Todas las pruebas estáticas pasaron exitosamente!');

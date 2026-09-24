/**
 * PRUEBAS AUTOMATIZADAS: INTEGRACIÓN DE QVAPAY & MONETIZACIÓN
 */

const assert = require('assert');
const qvapayService = require('../services/qvapayService');

async function runQvaPayTests() {
  console.log('=== INICIANDO PRUEBAS DE INTEGRACIÓN DE QVAPAY ===\n');

  // 1. Creación de Invoice
  console.log('1. Probando qvapayService.createInvoice()...');
  const remoteId = `test_remote_${Date.now()}`;
  const invoice = await qvapayService.createInvoice({
    amount: 5.00,
    description: 'Prueba de Verificación de Perfil',
    remoteId,
  });

  assert.ok(invoice, 'createInvoice debe devolver un objeto');
  assert.ok(invoice.id || invoice.trans_id, 'Debe incluir un ID de transacción');
  assert.ok(invoice.url, 'Debe incluir la URL de pago');
  assert.strictEqual(invoice.amount, '5.00', 'Monto formateado correctamente');
  assert.strictEqual(invoice.remote_id, remoteId, 'remoteId preservado');
  console.log('   ✅ Creación de invoice validada correctamente.');

  // 2. Consulta de Estado de Transacción
  console.log('2. Probando qvapayService.getTransactionStatus()...');
  const statusRes = await qvapayService.getTransactionStatus(invoice.id);
  assert.ok(statusRes, 'getTransactionStatus debe devolver un objeto');
  assert.ok(statusRes.status, 'Debe incluir estado');
  console.log('   ✅ Consulta de estado de transacción ejecutada.');

  // 3. Verificación de Webhook
  console.log('3. Probando qvapayService.verifyWebhookPayload()...');
  const mockReq = {
    body: {
      remote_id: remoteId,
      id: invoice.id,
      amount: '5.00',
      status: 'paid',
      paid: 1,
    }
  };

  const webhookRes = await qvapayService.verifyWebhookPayload(mockReq);
  assert.ok(webhookRes, 'verifyWebhookPayload debe devolver un objeto');
  assert.strictEqual(webhookRes.remote_id, remoteId, 'remote_id validado en webhook');
  console.log('   ✅ Verificación de webhook validada.');

  // 4. Manejo de Errores
  console.log('4. Probando manejo de errores con monto o remoteId inválidos...');
  await assert.rejects(
    async () => {
      await qvapayService.createInvoice({ amount: -10, description: 'Test', remoteId: 'abc' });
    },
    /Monto de factura no válido/,
    'Debe rechazar montos negativos o inválidos'
  );

  await assert.rejects(
    async () => {
      await qvapayService.createInvoice({ amount: 5.00, description: 'Test', remoteId: '' });
    },
    /Identificador remoto \(remoteId\) requerido/,
    'Debe requerir remoteId'
  );

  await assert.rejects(
    async () => {
      await qvapayService.verifyWebhookPayload({ body: {} });
    },
    /Falta remote_id/,
    'Debe rechazar webhooks sin remote_id'
  );
  console.log('   ✅ Manejo de errores validado.');

  console.log('\n=== TODAS LAS PRUEBAS DE QVAPAY PASARON EXITOSAMENTE ===\n');
}

if (require.main === module) {
  runQvaPayTests().catch(err => {
    console.error('❌ FALLARON LAS PRUEBAS DE QVAPAY:', err);
    process.exit(1);
  });
}

module.exports = { runQvaPayTests };

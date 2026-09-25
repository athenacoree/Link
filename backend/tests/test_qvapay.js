/**
 * PRUEBAS AUTOMATIZADAS: INTEGRACIÓN DE QVAPAY & MONETIZACIÓN
 */

const assert = require('assert');

// Simular variables de entorno para pruebas unitarias de QvaPay
process.env.QVAPAY_APP_ID = process.env.QVAPAY_APP_ID || 'test_app_id_123';
process.env.QVAPAY_APP_SECRET = process.env.QVAPAY_APP_SECRET || 'test_app_secret_abc';

const qvapayService = require('../services/qvapayService');

async function runQvaPayTests() {
  console.log('=== INICIANDO PRUEBAS DE INTEGRACIÓN DE QVAPAY ===\n');

  // Interceptar la llamada fetch global para simular respuestas de la API de QvaPay en pruebas
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    const urlStr = String(url);

    // Verificación de headers de autenticación
    assert.strictEqual(options.headers?.['app-id'], process.env.QVAPAY_APP_ID, 'Debe enviar header app-id');
    assert.strictEqual(options.headers?.['app-secret'], process.env.QVAPAY_APP_SECRET, 'Debe enviar header app-secret');

    if (urlStr.includes('/create_invoice')) {
      assert.strictEqual(options.method, 'POST', 'create_invoice debe ser POST');
      const body = JSON.parse(options.body || '{}');

      if (parseFloat(body.amount) <= 0) {
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: { message: 'Monto de factura no válido.' } })
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          trans_id: `qv_tx_${Date.now()}`,
          transaction_uuid: `qv_tx_${Date.now()}`,
          url: `https://qvapay.com/pay/qv_tx_${Date.now()}`,
          amount: body.amount,
          remote_id: body.remote_id,
          status: 'pending'
        })
      };
    }

    if (urlStr.includes('/get_transaction/')) {
      assert.strictEqual(options.method, 'GET', 'get_transaction debe ser GET');
      const txId = urlStr.split('/get_transaction/')[1];

      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: txId,
          trans_id: txId,
          amount: '5.00',
          remote_id: 'test_remote_id',
          status: 'paid',
          paid: 1
        })
      };
    }

    return {
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' })
    };
  };

  try {
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
    assert.ok(invoice.url, 'Debe incluir la URL de pago real');
    assert.strictEqual(invoice.amount, '5.00', 'Monto formateado correctamente');
    assert.strictEqual(invoice.remote_id, remoteId, 'remoteId preservado');
    console.log('   ✅ Creación de invoice con POST y headers validada correctamente.');

    // 2. Consulta de Estado de Transacción
    console.log('2. Probando qvapayService.getTransactionStatus()...');
    const statusRes = await qvapayService.getTransactionStatus(invoice.id);
    assert.ok(statusRes, 'getTransactionStatus debe devolver un objeto');
    assert.strictEqual(statusRes.paid, true, 'Debe identificar estado pagado');
    console.log('   ✅ Consulta de estado de transacción ejecutada.');

    // 3. Verificación de Webhook
    console.log('3. Probando qvapayService.verifyWebhookPayload()...');
    const mockReq = {
      body: {
        remote_id: remoteId,
        id: invoice.id,
        amount: '5.00',
      }
    };

    const webhookRes = await qvapayService.verifyWebhookPayload(mockReq);
    assert.ok(webhookRes, 'verifyWebhookPayload debe devolver un objeto');
    assert.strictEqual(webhookRes.valid, true, 'Webhook validado mediante consulta API');
    console.log('   ✅ Verificación de webhook con consulta a la API validada.');

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
  } finally {
    global.fetch = originalFetch;
  }
}

if (require.main === module) {
  runQvaPayTests().catch(err => {
    console.error('❌ FALLARON LAS PRUEBAS DE QVAPAY:', err);
    process.exit(1);
  });
}

module.exports = { runQvaPayTests };

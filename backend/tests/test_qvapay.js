/**
 * PRUEBAS AUTOMATIZADAS: INTEGRACIÓN DE QVAPAY V2 & MONETIZACIÓN
 */

const assert = require('assert');

// Simular variables de entorno para pruebas unitarias de QvaPay
process.env.QVAPAY_APP_ID = process.env.QVAPAY_APP_ID || 'test_app_id_123';
process.env.QVAPAY_APP_SECRET = process.env.QVAPAY_APP_SECRET || 'test_app_secret_abc';

const qvapayService = require('../services/qvapayService');

async function runQvaPayTests() {
  console.log('=== INICIANDO PRUEBAS DE INTEGRACIÓN DE QVAPAY V2 ===\n');

  // Interceptar la llamada fetch global para simular respuestas de la API V2 de QvaPay en pruebas
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    const urlStr = String(url);

    // 1. Verificación de seguridad: app-secret NUNCA debe viajar en la query string ni en el body JSON
    assert.ok(!urlStr.includes('app_secret'), 'app_secret NUNCA debe estar en la query string');
    assert.ok(!urlStr.includes('app-secret'), 'app-secret NUNCA debe estar en la query string');

    if (options.body && typeof options.body === 'string') {
      assert.ok(!options.body.includes('app_secret'), 'app_secret NUNCA debe estar en el body JSON');
      assert.ok(!options.body.includes('app-secret'), 'app-secret NUNCA debe estar en el body JSON');
    }

    // 2. Verificación de headers de autenticación V2
    assert.strictEqual(options.headers?.['app-id'], process.env.QVAPAY_APP_ID, 'Debe enviar header app-id');
    assert.strictEqual(options.headers?.['app-secret'], process.env.QVAPAY_APP_SECRET, 'Debe enviar header app-secret');
    assert.strictEqual(options.headers?.['Content-Type'], 'application/json', 'Debe enviar Content-Type application/json');

    // Mocks de Endpoints V2

    // GET /v2/info
    if (urlStr.includes('/info')) {
      assert.strictEqual(options.method, 'GET', '/info debe ser GET');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          name: 'Link App Test',
          url: 'https://link.app',
          user_id: 'usr_12345'
        })
      };
    }

    // GET /v2/balance
    if (urlStr.includes('/balance')) {
      assert.strictEqual(options.method, 'GET', '/balance debe ser GET');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          balance: 150.75,
          currency: 'USD'
        })
      };
    }

    // GET /v2/transactions
    if (urlStr.includes('/transactions')) {
      assert.strictEqual(options.method, 'GET', '/transactions debe ser GET');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 'qv_tx_1', amount: 5.0, status: 'paid' },
            { id: 'qv_tx_2', amount: 10.0, status: 'pending' }
          ]
        })
      };
    }

    // POST /v2/create_invoice
    if (urlStr.includes('/create_invoice')) {
      assert.strictEqual(options.method, 'POST', 'create_invoice debe ser POST');
      const body = JSON.parse(options.body || '{}');

      if (parseFloat(body.amount) <= 0) {
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: { message: 'Monto de factura no válido.' }, code: 'INVALID_AMOUNT' })
        };
      }

      if (body.remote_id === 'simulated_401') {
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: { message: 'Unauthorized credentials.' }, code: 'UNAUTHORIZED' })
        };
      }

      if (body.remote_id === 'simulated_409') {
        return {
          ok: false,
          status: 409,
          json: async () => ({ error: { message: 'Invoice with remote_id already exists.' }, code: 'DUPLICATE_REMOTE_ID' })
        };
      }

      if (body.remote_id === 'simulated_429') {
        return {
          ok: false,
          status: 429,
          json: async () => ({ error: { message: 'Rate limit exceeded.' }, code: 'TOO_MANY_REQUESTS' })
        };
      }

      if (body.remote_id === 'simulated_500') {
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: { message: 'Internal Server Error in QvaPay.' }, code: 'SERVER_ERROR' })
        };
      }

      if (body.remote_id === 'simulated_invalid_json') {
        return {
          ok: true,
          status: 200,
          json: async () => { throw new SyntaxError('Unexpected token < in JSON'); }
        };
      }

      if (body.remote_id === 'simulated_no_url') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            trans_id: `qv_tx_${Date.now()}`,
            amount: body.amount,
            remote_id: body.remote_id
          })
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

    // POST /v2/modify_invoice
    if (urlStr.includes('/modify_invoice')) {
      assert.strictEqual(options.method, 'POST', 'modify_invoice debe ser POST');
      const body = JSON.parse(options.body || '{}');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: body.id,
          amount: body.amount || '5.00',
          status: 'modified'
        })
      };
    }

    // POST /v2/charge
    if (urlStr.includes('/charge')) {
      assert.strictEqual(options.method, 'POST', 'charge debe ser POST');
      const body = JSON.parse(options.body || '{}');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: `charge_${Date.now()}`,
          amount: body.amount,
          status: 'paid'
        })
      };
    }

    // GET /v2/get_transaction/:id
    if (urlStr.includes('/get_transaction/')) {
      assert.strictEqual(options.method, 'GET', 'get_transaction debe ser GET');
      const txId = urlStr.split('/get_transaction/')[1];

      if (txId === 'tx_unpaid_123') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: txId,
            trans_id: txId,
            amount: '5.00',
            remote_id: 'test_remote_unpaid',
            status: 'pending',
            paid: 0
          })
        };
      }

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
      json: async () => ({ error: 'Endpoint no encontrado en QvaPay V2' })
    };
  };

  try {
    // 1. Probando GET /v2/info
    console.log('1. Probando qvapayService.getInfo()...');
    const info = await qvapayService.getInfo();
    assert.strictEqual(info.name, 'Link App Test');
    console.log('   ✅ GET /v2/info validado.');

    // 2. Probando GET /v2/balance
    console.log('2. Probando qvapayService.getBalance()...');
    const balance = await qvapayService.getBalance();
    assert.strictEqual(balance.balance, 150.75);
    console.log('   ✅ GET /v2/balance validado.');

    // 3. Probando GET /v2/transactions
    console.log('3. Probando qvapayService.getTransactions()...');
    const txs = await qvapayService.getTransactions({ page: 1, page_size: 10 });
    assert.strictEqual(txs.data.length, 2);
    console.log('   ✅ GET /v2/transactions validado.');

    // 4. Probando POST /v2/create_invoice
    console.log('4. Probando qvapayService.createInvoice()...');
    const remoteId = `test_remote_${Date.now()}`;
    const invoice = await qvapayService.createInvoice({
      amount: 5.00,
      description: 'Prueba de Verificación de Perfil V2',
      remoteId,
    });

    assert.ok(invoice, 'createInvoice debe devolver un objeto');
    assert.ok(invoice.id || invoice.trans_id, 'Debe incluir un ID de transacción');
    assert.ok(invoice.url, 'Debe incluir la URL de pago real devuelta por QvaPay');
    assert.strictEqual(invoice.amount, '5.00', 'Monto formateado correctamente');
    assert.strictEqual(invoice.remote_id, remoteId, 'remoteId preservado');
    console.log('   ✅ POST /v2/create_invoice validado.');

    // 5. Probando POST /v2/modify_invoice
    console.log('5. Probando qvapayService.modifyInvoice()...');
    const modified = await qvapayService.modifyInvoice({ id: invoice.id, amount: 7.50 });
    assert.strictEqual(modified.status, 'modified');
    console.log('   ✅ POST /v2/modify_invoice validado.');

    // 6. Probando POST /v2/charge
    console.log('6. Probando qvapayService.charge()...');
    const chargeRes = await qvapayService.charge({ amount: 10.00, description: 'Direct Charge' });
    assert.strictEqual(chargeRes.status, 'paid');
    console.log('   ✅ POST /v2/charge validado.');

    // 7. Probando GET /v2/get_transaction/:id
    console.log('7. Probando qvapayService.getTransactionStatus()...');
    const statusRes = await qvapayService.getTransactionStatus(invoice.id);
    assert.ok(statusRes, 'getTransactionStatus debe devolver un objeto');
    assert.strictEqual(statusRes.paid, true, 'Debe identificar estado pagado');
    console.log('   ✅ GET /v2/get_transaction/:id validado.');

    // 8. Probando Verificación de Webhook
    console.log('8. Probando qvapayService.verifyWebhookPayload()...');
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
    assert.strictEqual(webhookRes.paid, true, 'Webhook no marca pagado sin verificación');
    console.log('   ✅ Verificación de webhook con consulta a la API V2 validada.');

    // 9. Probando Webhook no pagado
    console.log('9. Probando webhook rechazado cuando la API reporta no pagado...');
    const unpaidReq = {
      body: {
        remote_id: 'test_remote_unpaid',
        id: 'tx_unpaid_123',
        amount: '5.00',
      }
    };
    const unpaidRes = await qvapayService.verifyWebhookPayload(unpaidReq);
    assert.strictEqual(unpaidRes.valid, false, 'Debe marcar valid: false si la API no reporta pago');
    assert.strictEqual(unpaidRes.paid, false, 'Debe marcar paid: false si no está pagado');
    console.log('   ✅ Webhook no pagado rechazado correctamente.');

    // 10. Probando Manejo de Errores HTTP y Validación de Entradas
    console.log('10. Probando manejo de errores HTTP (400, 401, 409, 429, 500, no URL, invalid JSON)...');

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
        await qvapayService.createInvoice({ amount: 5.00, description: 'Test', remoteId: 'simulated_401' });
      },
      /Unauthorized credentials/,
      'Debe propagar error 401'
    );

    await assert.rejects(
      async () => {
        await qvapayService.createInvoice({ amount: 5.00, description: 'Test', remoteId: 'simulated_409' });
      },
      /Invoice with remote_id already exists/,
      'Debe propagar error 409'
    );

    await assert.rejects(
      async () => {
        await qvapayService.createInvoice({ amount: 5.00, description: 'Test', remoteId: 'simulated_429' });
      },
      /Rate limit exceeded/,
      'Debe propagar error 429'
    );

    await assert.rejects(
      async () => {
        await qvapayService.createInvoice({ amount: 5.00, description: 'Test', remoteId: 'simulated_500' });
      },
      /Internal Server Error in QvaPay/,
      'Debe propagar error 500'
    );

    await assert.rejects(
      async () => {
        await qvapayService.createInvoice({ amount: 5.00, description: 'Test', remoteId: 'simulated_no_url' });
      },
      /QvaPay no proporcionó una URL válida de pago/,
      'Debe fallar si QvaPay no devuelve URL'
    );

    await assert.rejects(
      async () => {
        await qvapayService.createInvoice({ amount: 5.00, description: 'Test', remoteId: 'simulated_invalid_json' });
      },
      /QvaPay devolvió una respuesta no válida/,
      'Debe manejar respuesta JSON no válida'
    );

    console.log('   ✅ Manejo de errores de API V2 validado.');

    console.log('\n=== TODAS LAS PRUEBAS DE QVAPAY V2 PASARON EXITOSAMENTE ===\n');
  } finally {
    global.fetch = originalFetch;
  }
}

if (require.main === module) {
  runQvaPayTests().catch(err => {
    console.error('❌ FALLARON LAS PRUEBAS DE QVAPAY V2:', err);
    process.exit(1);
  });
}

module.exports = { runQvaPayTests };

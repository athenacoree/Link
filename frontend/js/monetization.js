/* =========================================================
   MÓDULO DE MONETIZACIÓN Y SERVICIOS QVAPAY (FRONTEND)
   ========================================================= */

const Monetizacion = (() => {
  let subTabActual = 'verificacion';
  let adminSubTabActual = 'resumen';

  function init() {
    const btnMonetizacion = document.getElementById('btnMonetizacion');
    if (btnMonetizacion) {
      btnMonetizacion.addEventListener('click', abrirModalMonetizacion);
    }

    const cerrarMonetizacion = document.getElementById('cerrarMonetizacion');
    const veloMonetizacion = document.getElementById('veloMonetizacion');
    if (cerrarMonetizacion) cerrarMonetizacion.addEventListener('click', cerrarModalMonetizacion);
    if (veloMonetizacion) veloMonetizacion.addEventListener('click', cerrarModalMonetizacion);

    // Sub-tabs dentro de la hoja de monetización
    document.querySelectorAll('[data-montab]').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('[data-montab]').forEach(t => t.classList.remove('activo'));
        tab.classList.add('activo');
        subTabActual = tab.dataset.montab;
        renderSubTab();
      });
    });
  }

  function abrirModalMonetizacion() {
    document.getElementById('veloMonetizacion')?.classList.add('activo');
    document.getElementById('hojaMonetizacion')?.classList.add('activo');
    renderSubTab();
  }

  function cerrarModalMonetizacion() {
    document.getElementById('veloMonetizacion')?.classList.remove('activo');
    document.getElementById('hojaMonetizacion')?.classList.remove('activo');
  }

  async function renderSubTab() {
    const cont = document.getElementById('monetizacionContenido');
    if (!cont) return;

    cont.innerHTML = '<div style="text-align:center; padding:20px; color:var(--texto-500);">Cargando...</div>';

    try {
      if (subTabActual === 'verificacion') {
        await renderVerificacion(cont);
      } else if (subTabActual === 'username') {
        await renderUsername(cont);
      } else if (subTabActual === 'campanas') {
        await renderCampanas(cont);
      } else if (subTabActual === 'historial') {
        await renderHistorial(cont);
      }
    } catch (err) {
      cont.innerHTML = `<div class="campo-error" style="display:block;">${err.message}</div>`;
    }
  }

  async function getPreciosMonetizacion() {
    try {
      const res = await api('/monetizacion/precios');
      return {
        price_verification: res.price_verification || 5.00,
        price_username: res.price_username || 10.00
      };
    } catch (e) {
      return { price_verification: 5.00, price_username: 10.00 };
    }
  }

  // ---------------- 1. VERIFICACIÓN PAGADA ----------------
  async function renderVerificacion(cont) {
    const [data, precios] = await Promise.all([
      api('/monetizacion/verificacion/mi-solicitud'),
      getPreciosMonetizacion()
    ]);
    const sol = data.solicitud;
    const priceStr = parseFloat(precios.price_verification).toFixed(2);

    let estadoHTML = '';
    if (!sol) {
      estadoHTML = `
        <div style="background:var(--morado-50); border:1px solid var(--morado-200); border-radius:14px; padding:16px; margin-bottom:16px; text-align:center;">
          <div style="font-size:32px; margin-bottom:6px;">☑️</div>
          <div style="font-weight:800; font-size:16px; color:var(--morado-700);">Obtén la Insignia de Verificado</div>
          <p style="font-size:13px; color:var(--texto-600); margin:8px 0 14px; line-height:1.4;">
            Solicita la revisión oficial de tu perfil. Al abonar el costo del servicio de revisión ($${priceStr} USD mediante QvaPay), tu solicitud pasará directamente a la cola de revisión de nuestro equipo de administración.
          </p>
          <div style="font-size:11.5px; color:var(--texto-500); margin-bottom:14px; background:var(--blanco); padding:8px 12px; border-radius:10px;">
            ⚠️ <strong>Aviso importante:</strong> El pago cubre el servicio de revisión humana. No garantiza la aprobación automática de la verificación si el perfil incumple nuestras normas comunitarias.
          </div>
          <button class="btn btn-primario" id="btnSolicitarVerif" style="width:100%; border-radius:14px; padding:12px;">
            Solicitar Revisión ($${priceStr} USD) 🚀
          </button>
        </div>
      `;
    } else {
      const statusBadges = {
        'pending_payment': { label: 'Pendiente de Pago', color: 'var(--amarillo-700)', bg: 'var(--amarillo-100)' },
        'pending_review': { label: 'En Revisión por Administración ⏳', color: 'var(--morado-700)', bg: 'var(--morado-100)' },
        'approved': { label: 'Aprobado — Verificado ☑️', color: 'var(--verde-700)', bg: 'var(--verde-100)' },
        'rejected': { label: 'Rechazado', color: 'var(--rojo-700)', bg: 'var(--rojo-100)' },
        'failed': { label: 'Pago Fallido', color: 'var(--rojo-700)', bg: 'var(--rojo-100)' },
      };

      const b = statusBadges[sol.status] || { label: sol.status, color: 'var(--texto-700)', bg: 'var(--hueso)' };

      estadoHTML = `
        <div style="background:var(--blanco); border:1px solid var(--borde); border-radius:14px; padding:16px; margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <span style="font-weight:700; font-size:14px;">Solicitud de Verificación</span>
            <span style="font-size:12px; font-weight:700; color:${b.color}; background:${b.bg}; padding:4px 10px; border-radius:12px;">${b.label}</span>
          </div>
          <div style="font-size:13px; color:var(--texto-600); margin-bottom:10px;">
            <strong>Monto abonado:</strong> $${parseFloat(sol.amount).toFixed(2)} USD
          </div>
          <div style="font-size:12px; color:var(--texto-500);">
            Fecha: ${new Date(sol.created_at).toLocaleString('es-ES')}
          </div>

          ${sol.status === 'pending_payment' && sol.qvapay_url ? `
            <div style="margin-top:14px; display:flex; gap:8px;">
              <a href="${sol.qvapay_url}" target="_blank" class="btn btn-primario" style="flex:1; text-align:center; text-decoration:none;">Pagar en QvaPay 💳</a>
              <button class="btn btn-secundario" id="btnVerificarPagoVerif" data-tx="${sol.transaction_id}" style="font-size:12px;">Verificar Pago</button>
            </div>
          ` : ''}

          ${sol.status === 'rejected' && sol.rejection_reason ? `
            <div style="margin-top:12px; padding:10px; background:var(--rojo-100); color:var(--rojo-700); border-radius:10px; font-size:12.5px;">
              <strong>Motivo de rechazo:</strong> ${sol.rejection_reason}
            </div>
            <button class="btn btn-primario" id="btnSolicitarVerif" style="width:100%; margin-top:12px;">Volver a Solicitar ($${priceStr} USD)</button>
          ` : ''}
        </div>
      `;
    }

    cont.innerHTML = estadoHTML;

    const btnSol = document.getElementById('btnSolicitarVerif');
    if (btnSol) {
      btnSol.addEventListener('click', async () => {
        try {
          btnSol.disabled = true;
          btnSol.textContent = 'Generando factura QvaPay...';
          const res = await api('/monetizacion/verificacion/solicitar', { method: 'POST' });
          if (res.checkout_url) {
            window.open(res.checkout_url, '_blank');
          }
          await renderSubTab();
        } catch (e) {
          alert(e.message);
          btnSol.disabled = false;
          btnSol.textContent = `Solicitar Revisión ($${priceStr} USD)`;
        }
      });
    }

    const btnVerif = document.getElementById('btnVerificarPagoVerif');
    if (btnVerif) {
      btnVerif.addEventListener('click', async () => {
        try {
          const txId = btnVerif.dataset.tx;
          const res = await api(`/monetizacion/transacciones/${txId}/verificar`);
          if (res.pagado) {
            alert('¡Pago confirmado! Tu solicitud ha pasado a revisión.');
          } else {
            alert('El pago aún no ha sido confirmado por QvaPay.');
          }
          await renderSubTab();
        } catch (e) {
          alert(e.message);
        }
      });
    }
  }

  // ---------------- 2. USERNAMES CORTOS ----------------
  async function renderUsername(cont) {
    const precios = await getPreciosMonetizacion();
    const priceStr = parseFloat(precios.price_username).toFixed(2);

    cont.innerHTML = `
      <div style="background:var(--blanco); border:1px solid var(--borde); border-radius:14px; padding:16px; margin-bottom:16px;">
        <div style="font-weight:800; font-size:15px; color:var(--morado-700); margin-bottom:6px;">Adquiere un Username Corto (1 a 3 caracteres)</div>
        <p style="font-size:13px; color:var(--texto-600); margin-bottom:14px; line-height:1.4;">
          Destácate en Link con un nombre de usuario exclusivo y ultra corto como <code>@max</code>, <code>@al</code> o <code>@io</code>. Costo único: <strong>$${priceStr} USD</strong> vía QvaPay.
        </p>

        <div class="campo">
          <label>Username deseado (sin @)</label>

          <div style="display:flex; gap:8px;">
            <span style="padding:10px; background:var(--hueso); border:1px solid var(--borde); border-radius:12px; font-weight:700;">@</span>
            <input type="text" id="inputCheckUsername" maxlength="3" placeholder="abc" style="flex:1;">
            <button class="btn btn-secundario" id="btnCheckUsername" style="font-size:12px;">Comprobar</button>
          </div>
        </div>

        <div id="usernameStatusBox" style="margin-top:10px; font-size:13px;"></div>

        <button class="btn btn-primario" id="btnComprarUsername" style="width:100%; margin-top:14px; display:none;">
          Comprar Username ($${priceStr} USD) 🛒
        </button>
      </div>
    `;

    const inputName = document.getElementById('inputCheckUsername');
    const btnCheck = document.getElementById('btnCheckUsername');
    const boxStatus = document.getElementById('usernameStatusBox');
    const btnComprar = document.getElementById('btnComprarUsername');

    let usernameValido = null;

    btnCheck?.addEventListener('click', async () => {
      const uname = (inputName.value || '').trim().toLowerCase();
      if (!uname) {
        boxStatus.innerHTML = '<span style="color:var(--peligro);">Ingresa un username de 1 a 3 caracteres.</span>';
        btnComprar.style.display = 'none';
        return;
      }

      boxStatus.innerHTML = '<span style="color:var(--texto-500);">Verificando disponibilidad...</span>';

      try {
        const res = await api('/monetizacion/username/comprobar', {
          method: 'POST',
          body: { username: uname },
        });

        if (res.disponible) {
          usernameValido = res.username;
          boxStatus.innerHTML = `<span style="color:var(--verde-700); font-weight:700;">¡Disponible! El username @${res.username} está libre.</span>`;
          btnComprar.style.display = 'block';
        } else {
          usernameValido = null;
          boxStatus.innerHTML = `<span style="color:var(--peligro); font-weight:600;">No disponible: ${res.razon || 'Username ocupado o reservado.'}</span>`;
          btnComprar.style.display = 'none';
        }
      } catch (err) {
        usernameValido = null;
        boxStatus.innerHTML = `<span style="color:var(--peligro);">${err.message}</span>`;
        btnComprar.style.display = 'none';
      }
    });

    btnComprar?.addEventListener('click', async () => {
      if (!usernameValido) return;
      try {
        btnComprar.disabled = true;
        btnComprar.textContent = 'Generando factura QvaPay...';
        const res = await api('/monetizacion/username/comprar', {
          method: 'POST',
          body: { username: usernameValido },
        });

        if (res.checkout_url) {
          window.open(res.checkout_url, '_blank');
        }
        alert(`Iniciaste la compra de @${usernameValido}. Cuando el pago se confirme en QvaPay, tu usuario se actualizará automáticamente.`);
        await renderSubTab();
      } catch (err) {
        alert(err.message);
        btnComprar.disabled = false;
        btnComprar.textContent = `Comprar Username ($${priceStr} USD) 🛒`;
      }
    });
  }

  // ---------------- 3. CAMPAÑAS / PUBLICIDAD ----------------
  async function renderCampanas(cont) {
    const data = await api('/monetizacion/campanas/mis-campanas');
    const campanas = data.campanas || [];

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <span style="font-weight:800; font-size:15px; color:var(--morado-700);">Tus Campañas Publicitarias</span>
        <button class="btn btn-primario" id="btnCrearCampana" style="font-size:12px; padding:8px 14px;">+ Nueva Campaña</button>
      </div>

      <div id="formCrearCampanaBox" style="display:none; background:var(--blanco); border:1px solid var(--borde); border-radius:14px; padding:16px; margin-bottom:16px;">
        <div style="font-weight:700; margin-bottom:12px; color:var(--morado-700);">Configurar Nueva Campaña</div>
        <div class="campo"><label>Título del anuncio</label><input type="text" id="adTitle" placeholder="Ej. Mi Negocio / Servicio"></div>
        <div class="campo"><label>Descripción corta</label><textarea id="adDesc" rows="2" placeholder="Detalles de la oferta o promocion..."></textarea></div>
        <div class="grid-2">
          <div class="campo"><label>Texto del botón</label><input type="text" id="adBtnText" value="Ver más"></div>
          <div class="campo"><label>URL de destino</label><input type="url" id="adDestUrl" placeholder="https://..."></div>
        </div>
        <div class="campo"><label>Imagen URL (opcional)</label><input type="url" id="adImgUrl" placeholder="https://.../foto.jpg"></div>
        <div class="grid-2">
          <div class="campo"><label>Presupuesto USD ($)</label><input type="number" id="adBudget" min="2" value="5.00" step="0.50"></div>
          <div class="campo"><label>Duración (Días)</label><input type="number" id="adDays" min="1" value="7"></div>
        </div>
        <div style="display:flex; gap:8px; margin-top:12px;">
          <button class="btn btn-primario" id="btnGuardarCampana" style="flex:1;">Pagar y Publicar en QvaPay 🚀</button>
          <button class="btn btn-secundario" id="btnCancelarCampana">Cancelar</button>
        </div>
      </div>
    `;

    if (!campanas.length) {
      html += `
        <div style="text-align:center; padding:30px 10px; background:var(--blanco); border:1px dashed var(--borde); border-radius:14px;">
          <div style="font-size:32px; margin-bottom:6px;">📢</div>
          <div style="font-weight:700; font-size:14px; color:var(--texto-800);">No tienes campañas activas</div>
          <p style="font-size:12.5px; color:var(--texto-500); margin-top:4px;">Promociona tu negocio o contenido directamente en el feed de los usuarios de Link.</p>
        </div>
      `;
    } else {
      html += `<div style="display:flex; flex-direction:column; gap:12px;">`;
      campanas.forEach(c => {
        const statusMap = {
          'pending_payment': 'Pendiente de Pago',
          'pending_review': 'En Revisión Admin ⏳',
          'active': 'Activa 🟢',
          'paused': 'Pausada ⏸️',
          'completed': 'Completada 🏁',
          'rejected': 'Rechazada ❌',
        };

        html += `
          <div style="background:var(--blanco); border:1px solid var(--borde); border-radius:14px; padding:14px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
              <div>
                <div style="font-weight:700; font-size:14px;">${c.title}</div>
                <div style="font-size:11.5px; color:var(--texto-500);">${c.destination_url}</div>
              </div>
              <span style="font-size:11px; font-weight:700; background:var(--hueso); padding:3px 8px; border-radius:10px;">${statusMap[c.status] || c.status}</span>
            </div>

            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin:10px 0; background:var(--hueso); padding:8px; border-radius:10px; text-align:center; font-size:11.5px;">
              <div><strong>${c.impressions_count}</strong><br><span style="color:var(--texto-500);">Impresiones</span></div>
              <div><strong>${c.clicks_count}</strong><br><span style="color:var(--texto-500);">Clics</span></div>
              <div><strong>${c.ctr || 0}%</strong><br><span style="color:var(--texto-500);">CTR</span></div>
            </div>

            <div style="font-size:12px; color:var(--texto-600); display:flex; justify-content:space-between;">
              <span>Gasto: $${parseFloat(c.spent).toFixed(2)} / $${parseFloat(c.budget).toFixed(2)} USD</span>
              <span>Duración: ${c.duration_days} días</span>
            </div>

            ${c.status === 'active' ? `
              <button class="btn btn-secundario btnPausarCampana" data-id="${c.id}" data-st="paused" style="width:100%; margin-top:10px; font-size:12px;">Pausar Campaña ⏸️</button>
            ` : ''}
            ${c.status === 'paused' ? `
              <button class="btn btn-primario btnPausarCampana" data-id="${c.id}" data-st="active" style="width:100%; margin-top:10px; font-size:12px;">Reanudar Campaña ▶️</button>
            ` : ''}
          </div>
        `;
      });
      html += `</div>`;
    }

    cont.innerHTML = html;

    const btnCrear = document.getElementById('btnCrearCampana');
    const formBox = document.getElementById('formCrearCampanaBox');
    const btnCancelar = document.getElementById('btnCancelarCampana');
    const btnGuardar = document.getElementById('btnGuardarCampana');

    btnCrear?.addEventListener('click', () => formBox.style.display = 'block');
    btnCancelar?.addEventListener('click', () => formBox.style.display = 'none');

    btnGuardar?.addEventListener('click', async () => {
      const title = document.getElementById('adTitle').value.trim();
      const description = document.getElementById('adDesc').value.trim();
      const button_text = document.getElementById('adBtnText').value.trim();
      const destination_url = document.getElementById('adDestUrl').value.trim();
      const image_url = document.getElementById('adImgUrl').value.trim();
      const budget = document.getElementById('adBudget').value;
      const duration_days = document.getElementById('adDays').value;

      if (!title || !destination_url) {
        alert('Ingresa el título y la URL de destino.');
        return;
      }

      try {
        btnGuardar.disabled = true;
        btnGuardar.textContent = 'Creando factura QvaPay...';

        const res = await api('/monetizacion/campanas', {
          method: 'POST',
          body: { title, description, button_text, destination_url, image_url, budget, duration_days },
        });

        if (res.checkout_url) {
          window.open(res.checkout_url, '_blank');
        }
        await renderSubTab();
      } catch (e) {
        alert(e.message);
        btnGuardar.disabled = false;
        btnGuardar.textContent = 'Pagar y Publicar en QvaPay 🚀';
      }
    });

    document.querySelectorAll('.btnPausarCampana').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await api(`/monetizacion/campanas/${btn.dataset.id}/estado`, {
            method: 'PUT',
            body: { status: btn.dataset.st },
          });
          await renderSubTab();
        } catch (e) {
          alert(e.message);
        }
      });
    });
  }

  // ---------------- 4. HISTORIAL DE TRANSACCIONES ----------------
  async function renderHistorial(cont) {
    const data = await api('/monetizacion/transacciones');
    const transacciones = data.transacciones || [];

    if (!transacciones.length) {
      cont.innerHTML = `
        <div style="text-align:center; padding:30px; color:var(--texto-500);">
          No has realizado ninguna transacción todavía.
        </div>
      `;
      return;
    }

    let html = `<div style="display:flex; flex-direction:column; gap:10px;">`;
    transacciones.forEach(t => {
      const statusBadges = {
        'pending_payment': { label: 'Pendiente', color: 'var(--amarillo-700)', bg: 'var(--amarillo-100)' },
        'paid': { label: 'Pagado', color: 'var(--verde-700)', bg: 'var(--verde-100)' },
        'completed': { label: 'Completado', color: 'var(--verde-700)', bg: 'var(--verde-100)' },
        'failed': { label: 'Fallido', color: 'var(--rojo-700)', bg: 'var(--rojo-100)' },
        'refunded': { label: 'Reembolsado', color: 'var(--morado-700)', bg: 'var(--morado-100)' },
      };

      const b = statusBadges[t.status] || { label: t.status, color: 'var(--texto-700)', bg: 'var(--hueso)' };

      html += `
        <div style="background:var(--blanco); border:1px solid var(--borde); border-radius:12px; padding:12px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight:700; font-size:13.5px; text-transform:capitalize;">${t.service_type.replace('_', ' ')}</div>
            <div style="font-size:11.5px; color:var(--texto-500);">${new Date(t.created_at).toLocaleString('es-ES')}</div>
            <div style="font-size:11px; color:var(--texto-500); margin-top:2px;">Ref: ${t.remote_id}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:800; font-size:14px; color:var(--morado-700);">$${parseFloat(t.amount).toFixed(2)} USD</div>
            <span style="font-size:10.5px; font-weight:700; color:${b.color}; background:${b.bg}; padding:3px 8px; border-radius:8px;">${b.label}</span>
          </div>
        </div>
      `;
    });
    html += `</div>`;

    cont.innerHTML = html;
  }

  // ---------------- 5. RENDERIZADO DE ANUNCIOS PATROCINADOS EN EL FEED ----------------
  async function renderizarAnuncioPatrocinado(containerElem) {
    if (!containerElem) return;
    try {
      const data = await api('/monetizacion/anuncios/activo');
      if (!data.anuncio) return;

      const ad = data.anuncio;

      const adCard = document.createElement('div');
      adCard.className = 'tarjeta-post patrocinado';
      adCard.style.cssText = 'background:var(--blanco); border:1.5px solid var(--morado-200); border-radius:16px; padding:14px; margin-bottom:14px; box-shadow:0 4px 14px rgba(91,33,182,0.06);';

      adCard.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; background:var(--morado-100); color:var(--morado-700); padding:3px 8px; border-radius:8px;">
            📢 Patrocinado
          </span>
        </div>
        <div style="font-weight:800; font-size:15px; color:var(--texto-900); margin-bottom:4px;">${ad.title}</div>
        ${ad.description ? `<p style="font-size:13px; color:var(--texto-700); margin-bottom:10px; line-height:1.4;">${ad.description}</p>` : ''}
        ${ad.image_url ? `<img src="${ad.image_url}" style="width:100%; max-height:220px; object-fit:cover; border-radius:12px; margin-bottom:10px;">` : ''}
        <a href="${ad.destination_url}" target="_blank" class="btn btn-primario btnClickAd" style="display:block; text-align:center; text-decoration:none; padding:10px; border-radius:12px; font-weight:700;">
          ${ad.button_text || 'Ver más'} 🔗
        </a>
      `;

      containerElem.prepend(adCard);

      // Record impression metric
      api(`/monetizacion/anuncios/${ad.id}/metrica`, { method: 'POST', body: { event_type: 'impression' } }).catch(() => {});

      // Record click metric
      adCard.querySelector('.btnClickAd')?.addEventListener('click', () => {
        api(`/monetizacion/anuncios/${ad.id}/metrica`, { method: 'POST', body: { event_type: 'click' } }).catch(() => {});
      });
    } catch (e) {
      console.warn('No se pudo cargar anuncio patrocinado:', e);
    }
  }

  // ---------------- 6. SECCIÓN DE ADMINISTRACIÓN ----------------
  async function renderAdminMonetizacion(contElem) {
    if (!contElem) return;

    contElem.innerHTML = `
      <div class="sub-tabs" style="margin-bottom:14px;">
        <div class="sub-tab activo" data-adminmontab="resumen">Resumen</div>
        <div class="sub-tab" data-adminmontab="verificaciones">Verificaciones</div>
        <div class="sub-tab" data-adminmontab="campanas">Campañas</div>
        <div class="sub-tab" data-adminmontab="transacciones">Transacciones</div>
      </div>
      <div id="adminMonetizacionBody">Cargando...</div>
    `;

    document.querySelectorAll('[data-adminmontab]').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('[data-adminmontab]').forEach(t => t.classList.remove('activo'));
        tab.classList.add('activo');
        adminSubTabActual = tab.dataset.adminmontab;
        cargarAdminSubTab();
      });
    });

    await cargarAdminSubTab();
  }

  async function cargarAdminSubTab() {
    const body = document.getElementById('adminMonetizacionBody');
    if (!body) return;

    body.innerHTML = '<div style="text-align:center; padding:20px; color:var(--texto-500);">Cargando...</div>';

    try {
      if (adminSubTabActual === 'resumen') {
        const res = await api('/admin/monetizacion/resumen');
        body.innerHTML = `
          <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:10px; margin-bottom:16px;">
            <div style="background:var(--blanco); padding:14px; border-radius:12px; border:1px solid var(--borde);">
              <div style="font-size:11px; color:var(--texto-500); text-transform:uppercase;">Ingresos Totales</div>
              <div style="font-size:20px; font-weight:800; color:var(--morado-700);">$${res.ingresos_totales.toFixed(2)} USD</div>
            </div>
            <div style="background:var(--blanco); padding:14px; border-radius:12px; border:1px solid var(--borde);">
              <div style="font-size:11px; color:var(--texto-500); text-transform:uppercase;">Verificaciones Pendientes</div>
              <div style="font-size:20px; font-weight:800; color:var(--amarillo-700);">${res.verificaciones_pendientes}</div>
            </div>
            <div style="background:var(--blanco); padding:14px; border-radius:12px; border:1px solid var(--borde);">
              <div style="font-size:11px; color:var(--texto-500); text-transform:uppercase;">Campañas Activas</div>
              <div style="font-size:20px; font-weight:800; color:var(--verde-700);">${res.campanas_activas}</div>
            </div>
            <div style="background:var(--blanco); padding:14px; border-radius:12px; border:1px solid var(--borde);">
              <div style="font-size:11px; color:var(--texto-500); text-transform:uppercase;">Usernames Comprados</div>
              <div style="font-size:20px; font-weight:800; color:var(--morado-700);">${res.usernames_comprados}</div>
            </div>
          </div>
        `;
      } else if (adminSubTabActual === 'verificaciones') {
        const res = await api('/admin/monetizacion/verificaciones?estado=todos');
        const verifs = res.verificaciones || [];
        if (!verifs.length) {
          body.innerHTML = '<div style="text-align:center; padding:20px; color:var(--texto-500);">No hay solicitudes de verificación.</div>';
          return;
        }

        let html = '<div style="display:flex; flex-direction:column; gap:10px;">';
        verifs.forEach(v => {
          html += `
            <div style="background:var(--blanco); border:1px solid var(--borde); border-radius:12px; padding:12px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span style="font-weight:700;">${v.usuario_nombre} (@${v.usuario_username || 'usuario'})</span>
                <span style="font-size:11px; font-weight:700; background:var(--hueso); padding:2px 8px; border-radius:8px;">${v.status}</span>
              </div>
              <div style="font-size:12px; color:var(--texto-600); margin-bottom:8px;">Monto abonado: $${parseFloat(v.amount).toFixed(2)} USD</div>
              ${v.status === 'pending_review' ? `
                <div style="display:flex; gap:8px;">
                  <button class="btn btn-primario btnAprobarVerif" data-id="${v.id}" style="flex:1; font-size:12px; padding:6px;">Aprobar ☑️</button>
                  <button class="btn btn-secundario peligro btnRechazarVerif" data-id="${v.id}" style="flex:1; font-size:12px; padding:6px;">Rechazar ❌</button>
                </div>
              ` : ''}
            </div>
          `;
        });
        html += '</div>';
        body.innerHTML = html;

        document.querySelectorAll('.btnAprobarVerif').forEach(b => {
          b.addEventListener('click', async () => {
            await api(`/admin/monetizacion/verificaciones/${b.dataset.id}`, { method: 'PUT', body: { accion: 'aprobar' } });
            cargarAdminSubTab();
          });
        });

        document.querySelectorAll('.btnRechazarVerif').forEach(b => {
          b.addEventListener('click', async () => {
            const motivo = prompt('Motivo del rechazo:') || '';
            await api(`/admin/monetizacion/verificaciones/${b.dataset.id}`, { method: 'PUT', body: { accion: 'rechazar', motivo_rechazo: motivo } });
            cargarAdminSubTab();
          });
        });

      } else if (adminSubTabActual === 'campanas') {
        const res = await api('/admin/monetizacion/campanas?estado=todos');
        const campanas = res.campanas || [];
        if (!campanas.length) {
          body.innerHTML = '<div style="text-align:center; padding:20px; color:var(--texto-500);">No hay campañas registradas.</div>';
          return;
        }

        let html = '<div style="display:flex; flex-direction:column; gap:10px;">';
        campanas.forEach(c => {
          html += `
            <div style="background:var(--blanco); border:1px solid var(--borde); border-radius:12px; padding:12px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:700;">${c.title} (${c.usuario_nombre})</span>
                <span style="font-size:11px; font-weight:700; background:var(--hueso); padding:2px 8px; border-radius:8px;">${c.status}</span>
              </div>
              <div style="font-size:12px; color:var(--texto-600); margin:6px 0;">Presupuesto: $${parseFloat(c.budget).toFixed(2)} USD | Impresiones: ${c.impressions_count} | CTR: ${c.ctr || 0}%</div>
              ${c.status === 'pending_review' ? `
                <div style="display:flex; gap:8px; margin-top:8px;">
                  <button class="btn btn-primario btnAprobarCampana" data-id="${c.id}" style="flex:1; font-size:12px; padding:6px;">Aprobar y Activar 🚀</button>
                  <button class="btn btn-secundario peligro btnRechazarCampana" data-id="${c.id}" style="flex:1; font-size:12px; padding:6px;">Rechazar ❌</button>
                </div>
              ` : ''}
            </div>
          `;
        });
        html += '</div>';
        body.innerHTML = html;

        document.querySelectorAll('.btnAprobarCampana').forEach(b => {
          b.addEventListener('click', async () => {
            await api(`/admin/monetizacion/campanas/${b.dataset.id}`, { method: 'PUT', body: { accion: 'aprobar' } });
            cargarAdminSubTab();
          });
        });

        document.querySelectorAll('.btnRechazarCampana').forEach(b => {
          b.addEventListener('click', async () => {
            const motivo = prompt('Motivo del rechazo:') || '';
            await api(`/admin/monetizacion/campanas/${b.dataset.id}`, { method: 'PUT', body: { accion: 'rechazar', motivo_rechazo: motivo } });
            cargarAdminSubTab();
          });
        });

      } else if (adminSubTabActual === 'transacciones') {
        const res = await api('/admin/monetizacion/transacciones');
        const txs = res.transacciones || [];
        let html = '<div style="display:flex; flex-direction:column; gap:8px;">';
        txs.forEach(t => {
          html += `
            <div style="background:var(--blanco); border:1px solid var(--borde); border-radius:10px; padding:10px; font-size:12px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong>${t.usuario_nombre}</strong> (${t.service_type})
                <div style="color:var(--texto-500); font-size:11px;">${new Date(t.created_at).toLocaleString('es-ES')} | Ref: ${t.remote_id}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-weight:700;">$${parseFloat(t.amount).toFixed(2)} USD</div>
                <span style="font-size:10px; font-weight:700; background:var(--hueso); padding:2px 6px; border-radius:6px;">${t.status}</span>
              </div>
            </div>
          `;
        });
        html += '</div>';
        body.innerHTML = html;
      }
    } catch (e) {
      body.innerHTML = `<div style="color:var(--peligro);">${e.message}</div>`;
    }
  }

  return {
    init,
    abrirModalMonetizacion,
    cerrarModalMonetizacion,
    renderizarAnuncioPatrocinado,
    renderAdminMonetizacion,
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  Monetizacion.init();
});

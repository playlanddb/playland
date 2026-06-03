/**
 * contabilidad.js - Módulo de contabilidad
 * Maneja ingresos, egresos y balance por período.
 */

let movimientosCache = [];
let periodoActual = { año: new Date().getFullYear(), mes: new Date().getMonth() };

// ============================================================
// CARGA Y PERÍODO
// ============================================================

async function cargarContabilidad() {
  showLoader('Cargando movimientos...');
  try {
    const response = await apiRequest({ action: 'getMovimientos' });
    movimientosCache = response.data || [];
    aplicarFiltrosContabilidad();
    actualizarSaldoCuentas();
  } catch (error) {
    showToast('Error al cargar contabilidad: ' + error.message, 'error');
  } finally {
    hideLoader();
  }
}

function initContabilidad() {
  // Fecha de hoy por defecto en el formulario
  const hoy = new Date().toISOString().split('T')[0];
  const inputFecha = document.getElementById('cont-fecha');
  if (inputFecha) inputFecha.value = hoy;

  // Inicializar filtros con el mes actual
  actualizarPeriodoUI();

  // Botones de período
  document.getElementById('btn-periodo-anterior')?.addEventListener('click', () => {
    periodoActual.mes--;
    if (periodoActual.mes < 0) { periodoActual.mes = 11; periodoActual.año--; }
    actualizarPeriodoUI();
    aplicarFiltrosContabilidad();
  });

  document.getElementById('btn-periodo-siguiente')?.addEventListener('click', () => {
    periodoActual.mes++;
    if (periodoActual.mes > 11) { periodoActual.mes = 0; periodoActual.año++; }
    actualizarPeriodoUI();
    aplicarFiltrosContabilidad();
  });
}

function actualizarPeriodoUI() {
  const fecha = new Date(periodoActual.año, periodoActual.mes, 1);
  const nombreMes = fecha.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  const label = document.getElementById('periodo-label');
  if (label) label.textContent = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);

  // Sincronizar filtros de fecha con el período
  const primerDia = `${periodoActual.año}-${String(periodoActual.mes + 1).padStart(2, '0')}-01`;
  const ultimoDia = new Date(periodoActual.año, periodoActual.mes + 1, 0);
  const ultimoDiaStr = `${periodoActual.año}-${String(periodoActual.mes + 1).padStart(2, '0')}-${String(ultimoDia.getDate()).padStart(2, '0')}`;

  const desde = document.getElementById('cont-filtro-desde');
  const hasta = document.getElementById('cont-filtro-hasta');
  if (desde) desde.value = primerDia;
  if (hasta) hasta.value = ultimoDiaStr;
}

// ============================================================
// FILTROS Y RENDERIZADO
// ============================================================

function aplicarFiltrosContabilidad() {
  const desde = document.getElementById('cont-filtro-desde')?.value || '';
  const hasta = document.getElementById('cont-filtro-hasta')?.value || '';
  const tipo  = document.getElementById('cont-filtro-tipo')?.value || '';
  const cuenta = document.getElementById('cont-filtro-cuenta')?.value || '';

  let resultado = [...movimientosCache];

  if (desde) resultado = resultado.filter(m => m.fecha && m.fecha.substring(0, 10) >= desde);
  if (hasta) resultado = resultado.filter(m => m.fecha && m.fecha.substring(0, 10) <= hasta);
  if (tipo)  resultado = resultado.filter(m => m.tipo === tipo);
  if (cuenta) resultado = resultado.filter(m => m.cuenta === cuenta);

  // Ordenar por fecha descendente
  resultado.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

  renderizarMovimientos(resultado);
  actualizarResumenContabilidad(resultado);
}

function renderizarMovimientos(movimientos) {
  const tbody = document.getElementById('tabla-contabilidad-body');
  const tfoot = document.getElementById('cont-totales-footer');
  if (!tbody) return;

  if (!movimientos || movimientos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          <div class="empty-icon">📊</div>
          <p>Sin movimientos en este período</p>
          <span>Registra el primer movimiento con el formulario</span>
        </td>
      </tr>
    `;
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  tbody.innerHTML = movimientos.map(m => {
    const id = String(m.id_movimiento || '');
    const valor = parseFloat(m.valor) || 0;
    const esIngreso = m.tipo === 'Ingreso';
    const conceptoEsc = String(m.concepto || '').replace(/'/g, "\\'");

    return `
      <tr class="table-row">
        <td>${formatDate(m.fecha)}</td>
        <td><span class="badge ${esIngreso ? 'badge-ingreso' : 'badge-egreso'}">${m.tipo || '—'}</span></td>
        <td style="color:var(--text-primary); font-weight:500;">${m.concepto || '—'}</td>
        <td><span class="canal-badge">${m.cuenta || '—'}</span></td>
        <td>
          <span style="font-weight:700; font-variant-numeric:tabular-nums; color:${esIngreso ? 'var(--success)' : 'var(--error)'};">
            ${esIngreso ? '+' : '-'} ${formatCurrency(valor)}
          </span>
        </td>
        <td>
          <div class="action-buttons">
            <button class="btn-action btn-edit" onclick="editarMovimiento('${id}')" title="Editar">
              <i class="fa-solid fa-pen-to-square" style="color:white;"></i>
            </button>
            <button class="btn-action btn-delete" onclick="confirmarEliminarMovimiento('${id}', '${conceptoEsc}')" title="Eliminar">
              <i class="fa-solid fa-trash" style="color:white;"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Fila de totales
  const totalIngresos = movimientos.filter(m => m.tipo === 'Ingreso').reduce((a, m) => a + (parseFloat(m.valor) || 0), 0);
  const totalEgresos  = movimientos.filter(m => m.tipo === 'Egreso').reduce((a, m) => a + (parseFloat(m.valor) || 0), 0);

  if (tfoot) {
    tfoot.innerHTML = `
      <tr style="border-top: 2px solid var(--border-strong);">
        <td colspan="4" style="padding:12px 14px; font-weight:700; color:var(--text-secondary); font-size:12px; text-transform:uppercase; letter-spacing:0.08em;">Totales</td>
        <td style="padding:12px 14px;">
          <div style="display:flex; flex-direction:column; gap:2px;">
            <span style="font-weight:700; color:var(--success); font-variant-numeric:tabular-nums;">${formatCurrency(totalIngresos)}</span>
            <span style="font-weight:700; color:var(--error); font-variant-numeric:tabular-nums;">${formatCurrency(totalEgresos)}</span>
          </div>
        </td>
        <td></td>
      </tr>
    `;
  }
}

function actualizarResumenContabilidad(movimientos) {
  const ingresos = movimientos.filter(m => m.tipo === 'Ingreso');
  const egresos  = movimientos.filter(m => m.tipo === 'Egreso');
  const totalI   = ingresos.reduce((a, m) => a + (parseFloat(m.valor) || 0), 0);
  const totalE   = egresos.reduce((a, m) => a + (parseFloat(m.valor) || 0), 0);
  const balance  = totalI - totalE;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set('cont-total-ingresos', formatCurrency(totalI));
  set('cont-total-egresos',  formatCurrency(totalE));
  set('cont-balance',        formatCurrency(balance));
  set('cont-count-ingresos', `${ingresos.length} movimiento${ingresos.length !== 1 ? 's' : ''}`);
  set('cont-count-egresos',  `${egresos.length} movimiento${egresos.length !== 1 ? 's' : ''}`);

  const balanceEl = document.getElementById('cont-balance');
  if (balanceEl) {
    balanceEl.style.color = balance >= 0 ? 'var(--success)' : 'var(--error)';
  }
}

function actualizarSaldoCuentas() {
  const cuentas = ['Caja', 'Bancolombia', 'Nequi', 'Davivienda'];
  const saldos = {};
  cuentas.forEach(c => saldos[c] = 0);

  movimientosCache.forEach(m => {
    if (!saldos.hasOwnProperty(m.cuenta)) return;
    const val = parseFloat(m.valor) || 0;
    saldos[m.cuenta] += m.tipo === 'Ingreso' ? val : -val;
  });

  const container = document.getElementById('cont-saldo-cuentas');
  if (!container) return;

  container.innerHTML = cuentas.map(c => `
    <div class="cont-saldo-item">
      <span class="cont-saldo-cuenta">${c}</span>
      <span class="cont-saldo-valor" style="color:${saldos[c] >= 0 ? 'var(--success)' : 'var(--error)'};">
        ${formatCurrency(saldos[c])}
      </span>
    </div>
  `).join('');
}

// ============================================================
// GUARDAR MOVIMIENTO
// ============================================================

async function guardarMovimiento() {
  const idExistente = document.getElementById('cont-mov-id').value;
  const esEdicion = Boolean(idExistente);

  const fecha    = document.getElementById('cont-fecha').value;
  const tipo     = document.getElementById('cont-tipo').value;
  const concepto = document.getElementById('cont-concepto').value.trim();
  const cuenta   = document.getElementById('cont-cuenta').value;
  const valor    = document.getElementById('cont-valor').value;

  if (!fecha || !concepto || !valor || parseFloat(valor) <= 0) {
    showToast('Completa todos los campos requeridos', 'warning');
    return;
  }

  const datos = { fecha, tipo, concepto, cuenta, valor };
  if (esEdicion) datos.id_movimiento = idExistente;

  const action = esEdicion ? 'updateMovimiento' : 'createMovimiento';
  showLoader(esEdicion ? 'Actualizando movimiento...' : 'Guardando movimiento...');

  try {
    await apiRequest({ action, ...datos });
    showToast(esEdicion ? 'Movimiento actualizado ✓' : 'Movimiento registrado ✓', 'success');
    resetFormContabilidad();
    await cargarContabilidad();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  } finally {
    hideLoader();
  }
}

// ============================================================
// EDITAR / ELIMINAR
// ============================================================

function editarMovimiento(idMovimiento) {
  const mov = movimientosCache.find(m => String(m.id_movimiento) === String(idMovimiento));
  if (!mov) { showToast('Movimiento no encontrado', 'error'); return; }

  document.getElementById('cont-mov-id').value   = mov.id_movimiento;
  document.getElementById('cont-fecha').value    = mov.fecha || '';
  document.getElementById('cont-tipo').value     = mov.tipo || 'Ingreso';
  document.getElementById('cont-concepto').value = mov.concepto || '';
  document.getElementById('cont-cuenta').value   = mov.cuenta || 'Caja';
  document.getElementById('cont-valor').value    = mov.valor || '';

  document.getElementById('cont-form-titulo').textContent = 'Editar Movimiento';
  document.getElementById('cont-btn-texto').textContent   = 'Actualizar Movimiento';
  document.getElementById('cont-btn-cancelar-wrapper').style.display = 'block';

  // Scroll al formulario en móvil
  document.querySelector('.cont-form-wrapper')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelarEdicionMovimiento() {
  resetFormContabilidad();
}

function resetFormContabilidad() {
  document.getElementById('cont-mov-id').value   = '';
  document.getElementById('cont-fecha').value    = new Date().toISOString().split('T')[0];
  document.getElementById('cont-tipo').value     = 'Ingreso';
  document.getElementById('cont-concepto').value = '';
  document.getElementById('cont-cuenta').value   = 'Caja';
  document.getElementById('cont-valor').value    = '';

  document.getElementById('cont-form-titulo').textContent = 'Nuevo Movimiento';
  document.getElementById('cont-btn-texto').textContent   = 'Guardar Movimiento';
  document.getElementById('cont-btn-cancelar-wrapper').style.display = 'none';
}

async function confirmarEliminarMovimiento(id, concepto) {
  const confirmado = await showConfirm(
    'Eliminar Movimiento',
    `¿Eliminar el movimiento "${concepto}"? Esta acción no se puede deshacer.`,
    'Eliminar'
  );
  if (!confirmado) return;

  showLoader('Eliminando movimiento...');
  try {
    await apiRequest({ action: 'deleteMovimiento', id_movimiento: id });
    showToast('Movimiento eliminado ✓', 'success');
    await cargarContabilidad();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  } finally {
    hideLoader();
  }
}
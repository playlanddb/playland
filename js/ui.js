/**
 * ui.js - Módulo de utilidades de interfaz de usuario
 * 
 * Contiene funciones reutilizables para mostrar loaders,
 * notificaciones, confirmaciones y otros elementos visuales.
 */

// ============================================================
// SISTEMA DE NOTIFICACIONES (TOAST)
// ============================================================

/**
 * Muestra una notificación tipo toast en la esquina superior derecha.
 * Se elimina automáticamente después de 3.5 segundos.
 * 
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - 'success' | 'error' | 'warning' | 'info'
 */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);

  // Animación de entrada
  requestAnimationFrame(() => toast.classList.add('toast-show'));

  // Auto-eliminar después de 3.5s
  setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// ============================================================
// LOADER / SPINNER GLOBAL
// ============================================================

/**
 * Muestra el loader de pantalla completa con un mensaje opcional.
 * @param {string} message - Texto a mostrar durante la carga
 */
function showLoader(message = 'Procesando...') {
  const loader = document.getElementById('global-loader');
  const loaderText = document.getElementById('loader-text');
  if (loader) {
    if (loaderText) loaderText.textContent = message;
    loader.classList.add('loader-visible');
  }
}

/**
 * Oculta el loader de pantalla completa.
 */
function hideLoader() {
  const loader = document.getElementById('global-loader');
  if (loader) {
    loader.classList.remove('loader-visible');
  }
}

// ============================================================
// MODAL DE CONFIRMACIÓN
// ============================================================

/**
 * Muestra un modal de confirmación y retorna una promesa.
 * Resuelve con true si el usuario confirma, false si cancela.
 * 
 * @param {string} title - Título del modal
 * @param {string} message - Mensaje descriptivo
 * @param {string} confirmText - Texto del botón de confirmación
 * @returns {Promise<boolean>}
 */
function showConfirm(title, message, confirmText = 'Confirmar') {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-title');
    const messageEl = document.getElementById('confirm-message');
    const confirmBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');

    if (!modal) {
      resolve(window.confirm(message)); // Fallback nativo
      return;
    }

    titleEl.textContent = title;
    messageEl.textContent = message;
    confirmBtn.textContent = confirmText;

    modal.classList.add('modal-visible');

    // Limpiar listeners anteriores
    const newConfirm = confirmBtn.cloneNode(true);
    const newCancel = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    newConfirm.addEventListener('click', () => {
      modal.classList.remove('modal-visible');
      resolve(true);
    });

    newCancel.addEventListener('click', () => {
      modal.classList.remove('modal-visible');
      resolve(false);
    });
  });
}

// ============================================================
// MODAL DE PEDIDO (CREAR / EDITAR)
// ============================================================

/**
 * Abre el modal del formulario de pedido.
 * @param {Object|null} pedido - Si se pasa un pedido, se llena el formulario para editar
 */
function openPedidoModal(pedido = null) {
  const modal = document.getElementById('pedido-modal');
  const form = document.getElementById('pedido-form');
  const modalTitle = document.getElementById('modal-title');

  if (!modal || !form) return;

  // Resetear formulario
  form.reset();
  document.getElementById('pedido-id').value = '';

  // Limpiar el buscador de inventario
  const buscador = document.getElementById('f-buscar-producto');
  if (buscador) buscador.value = '';
  cerrarDropdown();

  if (pedido) {
    // Modo edición: llenar formulario con datos existentes
    modalTitle.textContent = 'Editar Pedido';
    document.getElementById('pedido-id').value = pedido.id_pedido || '';
    document.getElementById('f-numero-pedido').value = pedido.numero_pedido || '';
    document.getElementById('f-fecha').value = pedido.fecha || '';
    document.getElementById('f-artista').value = pedido.artista || '';
    document.getElementById('f-tipo-producto').value = pedido.tipo_producto || '';
    document.getElementById('f-nombre-producto').value = pedido.nombre_producto || '';
    document.getElementById('f-estado').value = pedido.estado_pedido || 'Pendiente de compra';
    document.getElementById('f-cliente').value = pedido.cliente || '';
    document.getElementById('f-contacto').value = pedido.numero_contacto || '';
    document.getElementById('f-instagram').value = pedido.usuario_instagram || '';
    document.getElementById('f-numero-pedido-web').value = pedido.numero_pedido_web || '';
    document.getElementById('f-canal').value = pedido.canal_venta || '';
    document.getElementById('f-precio-compra').value = pedido.precio_compra || '';
    document.getElementById('f-precio-venta').value = pedido.precio_venta || '';
    document.getElementById('f-envio').value = pedido.costo_envio || '';
    document.getElementById('f-abono').value = pedido.abono_cliente || '';
    document.getElementById('f-nota').value = pedido.nota || '';
    calcularTotales();
  } else {
    // Modo creación
    modalTitle.textContent = 'Nuevo Pedido';
    // Establecer fecha de hoy
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('f-fecha').value = today;
  }

  modal.classList.add('modal-visible');
}

/**
 * Cierra el modal del formulario de pedido.
 */
function closePedidoModal() {
  const modal = document.getElementById('pedido-modal');
  if (modal) modal.classList.remove('modal-visible');
}

// ============================================================
// CÁLCULO AUTOMÁTICO EN FORMULARIO
// ============================================================

/**
 * Calcula ganancia y restante por pagar en tiempo real
 * mientras el usuario escribe en el formulario.
 * Se llama desde los listeners de input de precios.
 */
function calcularTotales() {
  const precioCompra = parseFloat(document.getElementById('f-precio-compra')?.value) || 0;
  const precioVenta = parseFloat(document.getElementById('f-precio-venta')?.value) || 0;
  const costoEnvio = parseFloat(document.getElementById('f-envio')?.value) || 0;
  const abono = parseFloat(document.getElementById('f-abono')?.value) || 0;

  const ganancia = precioVenta - precioCompra - costoEnvio;
  const restante = precioVenta - abono;

  const gananciaEl = document.getElementById('calc-ganancia');
  const restanteEl = document.getElementById('calc-restante');

  if (gananciaEl) {
    gananciaEl.textContent = formatCurrency(ganancia);
    gananciaEl.className = `calc-value ${ganancia >= 0 ? 'positive' : 'negative'}`;
  }
  if (restanteEl) {
    restanteEl.textContent = formatCurrency(restante);
    restanteEl.className = `calc-value ${restante <= 0 ? 'positive' : 'pending'}`;
  }
}

// ============================================================
// UTILIDADES DE FORMATO
// ============================================================

/**
 * Formatea un número como moneda en pesos colombianos.
 * @param {number} amount - Cantidad a formatear
 * @returns {string} Ej: "$45.000"
 */
function formatCurrency(amount) {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
}

/**
 * Formatea una fecha YYYY-MM-DD a formato legible.
 * @param {string} dateStr - Fecha en formato ISO
 * @returns {string} Ej: "15 mar 2025"
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    // Sheets puede devolver fechas en varios formatos
    // Ej: "2025-03-12", "3/12/2025", o un número serial de Excel
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return '—';
  }
}

/**
 * Retorna el badge HTML para un estado de pedido dado.
 * Asigna colores semánticos según la etapa del estado.
 * @param {string} estado - Estado del pedido
 * @returns {string} HTML del badge
 */
function getEstadoBadge(estado) {
  const clases = {
    'Pendiente de compra': 'badge-pending',
    'Pedido realizado a la disquera': 'badge-ordered',
    'En proceso de compra': 'badge-processing',
    'Preventa': 'badge-presale',
    'Despachado': 'badge-shipped',
    'En aduanas': 'badge-customs',
    'En viaje internacional': 'badge-transit',
    'Entregado': 'badge-delivered',
    'Cancelado': 'badge-cancelled'
  };
  const clase = clases[estado] || 'badge-default';
  return `<span class="badge ${clase}">${estado || '—'}</span>`;
}

// ============================================================
// VALIDACIÓN DE FORMULARIOS
// ============================================================

/**
 * Valida los campos requeridos del formulario de pedido.
 * Muestra mensajes de error en los campos inválidos.
 * @returns {boolean} true si el formulario es válido
 */
function validarFormulario() {
  const camposRequeridos = [
    { id: 'f-numero-pedido', label: 'Número de pedido' },
    { id: 'f-artista', label: 'Artista' },
    { id: 'f-nombre-producto', label: 'Nombre del producto' },
    { id: 'f-cliente', label: 'Cliente' },
    { id: 'f-precio-venta', label: 'Precio de venta' }
  ];

  let valido = true;

  // Limpiar errores previos
  document.querySelectorAll('.field-error').forEach(el => el.remove());
  document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));

  camposRequeridos.forEach(campo => {
    const input = document.getElementById(campo.id);
    if (!input) return;

    const valor = input.value.trim();
    if (!valor) {
      valido = false;
      input.classList.add('input-error');

      // Mostrar mensaje de error debajo del campo
      const errorEl = document.createElement('span');
      errorEl.className = 'field-error';
      errorEl.textContent = `${campo.label} es requerido`;
      input.parentNode.appendChild(errorEl);
    }
  });

  if (!valido) {
    showToast('Por favor completa los campos requeridos', 'warning');
  }

  return valido;
}
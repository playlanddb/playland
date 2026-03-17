/**
 * app.js - Orquestador principal de la aplicación
 * 
 * Inicializa todos los módulos, maneja la navegación entre
 * secciones (Dashboard / Pedidos) y conecta los eventos
 * globales de la interfaz.
 */

// ============================================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ============================================================

/**
 * Punto de entrada principal. Se ejecuta cuando el DOM está listo.
 * Inicializa todos los módulos en el orden correcto.
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🎵 Playland System - Iniciando...');

  initNavegacion();
  initFiltros();
  initFormulario();
  initFiltrosInventario();
  initAutocompletadoProducto();

  await cargarPedidos();
  await actualizarDashboard();
  await cargarInventario();

  mostrarSeccion('dashboard');

  console.log('✅ Sistema iniciado correctamente');
});

// ============================================================
// NAVEGACIÓN ENTRE SECCIONES
// ============================================================

/**
 * Inicializa los listeners de navegación del menú lateral.
 * Conecta los botones de nav con la función mostrarSeccion.
 */
function initNavegacion() {
  document.querySelectorAll('[data-section]').forEach(btn => {
    btn.addEventListener('click', function () {
      const seccion = this.getAttribute('data-section');
      mostrarSeccion(seccion);
    });
  });

  // Botón hamburguesa en móvil
  const menuToggle = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      const isOpen = sidebar.classList.toggle('sidebar-open');
      const overlay = document.getElementById('sidebar-overlay');
      if (overlay) overlay.style.display = isOpen ? 'block' : 'none';
    });
  }
}

/**
 * Muestra la sección seleccionada y oculta las demás.
 * Actualiza el estado activo del menú de navegación.
 * @param {string} seccion - 'dashboard' | 'pedidos'
 */
function mostrarSeccion(seccion) {
  // Ocultar todas las secciones
  document.querySelectorAll('.section-content').forEach(el => {
    el.classList.remove('section-active');
  });

  // Mostrar la sección seleccionada
  const target = document.getElementById(`section-${seccion}`);
  if (target) target.classList.add('section-active');

  // Actualizar estado activo del nav
  document.querySelectorAll('[data-section]').forEach(btn => {
    btn.classList.toggle('nav-active', btn.getAttribute('data-section') === seccion);
  });

  // Cerrar sidebar en móvil al navegar
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('sidebar-open');
  if (overlay) overlay.style.display = 'none';
}

// ============================================================
// EVENTOS DEL FORMULARIO
// ============================================================

/**
 * Inicializa todos los eventos del modal de pedido.
 * Incluye el formulario, botones de cierre y recalculo en tiempo real.
 */
function initFormulario() {
  // Botón guardar pedido
  const btnGuardar = document.getElementById('btn-guardar-pedido');
  if (btnGuardar) {
    btnGuardar.addEventListener('click', guardarPedido);
  }

  // Botón cancelar / cerrar modal
  const btnCancelar = document.getElementById('btn-cancelar-modal');
  if (btnCancelar) {
    btnCancelar.addEventListener('click', closePedidoModal);
  }

  // Cerrar modal al hacer click en el backdrop
  const modal = document.getElementById('pedido-modal');
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === this) closePedidoModal();
    });
  }

  // Recalcular totales en tiempo real al cambiar precios
  const camposCalculo = ['f-precio-compra', 'f-precio-venta', 'f-envio', 'f-abono'];
  camposCalculo.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', calcularTotales);
  });

  // Botón nuevo pedido
  const btnNuevo = document.getElementById('btn-nuevo-pedido');
  if (btnNuevo) {
    btnNuevo.addEventListener('click', () => openPedidoModal(null));
  }
}
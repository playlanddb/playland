/**
 * filtros.js - Módulo de búsqueda y filtros avanzados
 * 
 * Maneja la búsqueda en tiempo real y los filtros combinables.
 * Los filtros se envían al BACKEND (no se aplican sobre un cache local),
 * porque la tabla ya no guarda todos los pedidos en memoria: solo guarda
 * la página actual. Cada cambio de filtro vuelve a pedir la página 1
 * con los nuevos criterios.
 */

// ============================================================
// ESTADO DE FILTROS ACTIVOS
// ============================================================

/**
 * Objeto que almacena el estado actual de todos los filtros.
 * Se actualiza con cada interacción del usuario.
 */
let filtrosActivos = {
  busqueda: '',
  estado: '',
  tipoProducto: '',
  canal: '',
  fechaDesde: '',
  fechaHasta: ''
};

// ============================================================
// INICIALIZACIÓN DE FILTROS
// ============================================================

/**
 * Inicializa todos los listeners de búsqueda y filtros.
 * Se llama una sola vez al cargar la aplicación.
 */
function initFiltros() {
  // Búsqueda en tiempo real
  const inputBusqueda = document.getElementById('search-input');
  if (inputBusqueda) {
    inputBusqueda.addEventListener('input', debounce(function () {
      filtrosActivos.busqueda = this.value.toLowerCase().trim();
      aplicarFiltros();
    }, 300));
  }

  // Filtro por estado
  const selectEstado = document.getElementById('filtro-estado');
  if (selectEstado) {
    selectEstado.addEventListener('change', function () {
      filtrosActivos.estado = this.value;
      aplicarFiltros();
    });
  }

  // Filtro por tipo de producto
  const selectTipo = document.getElementById('filtro-tipo');
  if (selectTipo) {
    selectTipo.addEventListener('change', function () {
      filtrosActivos.tipoProducto = this.value;
      aplicarFiltros();
    });
  }

  // Filtro por canal de venta
  const selectCanal = document.getElementById('filtro-canal');
  if (selectCanal) {
    selectCanal.addEventListener('change', function () {
      filtrosActivos.canal = this.value;
      aplicarFiltros();
    });
  }

  // Filtros de fecha
  const fechaDesde = document.getElementById('filtro-fecha-desde');
  if (fechaDesde) {
    fechaDesde.addEventListener('change', function () {
      filtrosActivos.fechaDesde = this.value;
      aplicarFiltros();
    });
  }

  const fechaHasta = document.getElementById('filtro-fecha-hasta');
  if (fechaHasta) {
    fechaHasta.addEventListener('change', function () {
      filtrosActivos.fechaHasta = this.value;
      aplicarFiltros();
    });
  }

  // Botón limpiar filtros
  const btnLimpiar = document.getElementById('btn-limpiar-filtros');
  if (btnLimpiar) {
    btnLimpiar.addEventListener('click', limpiarFiltros);
  }
}

// ============================================================
// LÓGICA DE FILTRADO
// ============================================================

/**
 * Aplica los filtros activos consultando al BACKEND (página 1) y
 * actualiza la tabla con los resultados ya paginados/filtrados.
 */
async function aplicarFiltros() {
  actualizarIndicadorFiltros();
  await cargarPedidos(1); // los filtros van dentro de cargarPedidos vía filtrosActivos
}

/**
 * Limpia todos los filtros activos y recarga la página 1 sin filtros.
 */
async function limpiarFiltros() {
  // Resetear estado
  filtrosActivos = {
    busqueda: '',
    estado: '',
    tipoProducto: '',
    canal: '',
    fechaDesde: '',
    fechaHasta: ''
  };

  // Limpiar controles de UI
  const campos = [
    'search-input',
    'filtro-estado',
    'filtro-tipo',
    'filtro-canal',
    'filtro-fecha-desde',
    'filtro-fecha-hasta'
  ];
  campos.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  actualizarIndicadorFiltros();
  await cargarPedidos(1);
  showToast('Filtros limpiados', 'info');
}

/**
 * Actualiza el indicador visual que muestra cuántos filtros están activos.
 */
function actualizarIndicadorFiltros() {
  const activos = Object.values(filtrosActivos).filter(v => v !== '').length;
  const badge = document.getElementById('filtros-activos-badge');
  if (badge) {
    if (activos > 0) {
      badge.textContent = activos;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }
}

// ============================================================
// UTILIDADES
// ============================================================

/**
 * Función debounce que retrasa la ejecución de una función
 * hasta que el usuario deje de escribir por 'wait' ms.
 * Mejora el rendimiento en búsquedas en tiempo real.
 * 
 * @param {Function} func - Función a ejecutar
 * @param {number} wait - Milisegundos de espera
 * @returns {Function} Función con debounce aplicado
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func.apply(this, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
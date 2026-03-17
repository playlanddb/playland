/**
 * filtros.js - Módulo de búsqueda y filtros avanzados
 * 
 * Maneja la búsqueda en tiempo real y los filtros combinables
 * que operan sobre el cache local para máxima velocidad.
 * No requiere llamadas al servidor para filtrar.
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
 * Aplica todos los filtros activos al cache de pedidos
 * y actualiza la tabla con los resultados.
 * Opera exclusivamente sobre datos locales (sin requests al servidor).
 */
function aplicarFiltros() {
  const pedidos = getPedidosCache();
  let resultado = [...pedidos];

  // Filtro de búsqueda por texto (múltiples campos)
  if (filtrosActivos.busqueda) {
    const query = filtrosActivos.busqueda;
    resultado = resultado.filter(p => {
      return (
        String(p.numero_pedido || '').toLowerCase().includes(query) ||
        String(p.cliente || '').toLowerCase().includes(query) ||
        String(p.numero_contacto || '').toLowerCase().includes(query) ||
        String(p.usuario_instagram || '').toLowerCase().includes(query) ||
        String(p.nombre_producto || '').toLowerCase().includes(query) ||
        String(p.artista || '').toLowerCase().includes(query)
      );
    });
  }

  // Filtro por estado del pedido
  if (filtrosActivos.estado) {
    resultado = resultado.filter(p => p.estado_pedido === filtrosActivos.estado);
  }

  // Filtro por tipo de producto
  if (filtrosActivos.tipoProducto) {
    resultado = resultado.filter(p => p.tipo_producto === filtrosActivos.tipoProducto);
  }

  // Filtro por canal de venta
  if (filtrosActivos.canal) {
    resultado = resultado.filter(p => p.canal_venta === filtrosActivos.canal);
  }

  // Filtro por rango de fechas
  if (filtrosActivos.fechaDesde) {
    resultado = resultado.filter(p => {
      if (!p.fecha) return false;
      return p.fecha >= filtrosActivos.fechaDesde;
    });
  }

  if (filtrosActivos.fechaHasta) {
    resultado = resultado.filter(p => {
      if (!p.fecha) return false;
      return p.fecha <= filtrosActivos.fechaHasta;
    });
  }

  // Renderizar resultados filtrados
  renderizarTabla(resultado);
  actualizarContadorResultados(resultado.length);
  actualizarIndicadorFiltros();
}

/**
 * Limpia todos los filtros activos y restablece la tabla completa.
 */
function limpiarFiltros() {
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

  // Restaurar tabla completa
  renderizarTabla(getPedidosCache());
  actualizarContadorResultados(getPedidosCache().length);
  actualizarIndicadorFiltros();
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

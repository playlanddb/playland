/**
 * dashboard.js - Módulo del dashboard y estadísticas
 * 
 * Maneja las tarjetas de estadísticas y las gráficas visuales
 * del dashboard principal. Usa Chart.js para las gráficas.
 */

// ============================================================
// INSTANCIAS DE GRÁFICAS (para actualizarlas sin duplicar)
// ============================================================

let chartEstados = null;
let chartCanales = null;

// ============================================================
// ACTUALIZACIÓN DEL DASHBOARD
// ============================================================

/**
 * Actualiza todas las estadísticas y gráficas del dashboard.
 * IMPORTANTE: ya NO calcula nada del cache local de pedidos (pedidosCache),
 * porque ese cache ahora solo contiene la página actual (50 registros),
 * no todos los pedidos. En su lugar pide las estadísticas ya calculadas
 * al backend (getDashboardStats), que las cachea 5 minutos en el servidor,
 * así que esta llamada es liviana incluso con miles de pedidos.
 */
async function actualizarDashboard() {
  try {
    const stats = await apiGetDashboard();
    calcularYMostrarStats(stats);
    renderizarGraficas(stats);
  } catch (error) {
    showToast('Error al cargar el dashboard: ' + error.message, 'error');
    console.error('Error actualizarDashboard:', error);
  }
}

/**
 * Actualiza las tarjetas del dashboard con las estadísticas
 * ya calculadas y devueltas por el backend.
 * @param {Object} stats - { totalPedidos, enPreventa, enTransito, entregados, totalVentas, gananciasTotal, porEstado }
 */
function calcularYMostrarStats(stats) {
  actualizarTarjeta('stat-total-pedidos', stats.totalPedidos || 0);
  actualizarTarjeta('stat-preventa', stats.enPreventa || 0);
  actualizarTarjeta('stat-transito', stats.enTransito || 0);
  actualizarTarjeta('stat-entregados', stats.entregados || 0);
  actualizarTarjeta('stat-ventas', formatCurrency(stats.totalVentas || 0));
  actualizarTarjeta('stat-ganancias', formatCurrency(stats.gananciasTotal || 0));
}

/**
 * Actualiza el valor mostrado en una tarjeta del dashboard.
 * Aplica animación de conteo si el valor es numérico.
 * @param {string} id - ID del elemento
 * @param {string|number} valor - Valor a mostrar
 */
function actualizarTarjeta(id, valor) {
  const el = document.getElementById(id);
  if (!el) return;

  // Si es número, animar el conteo
  if (typeof valor === 'number') {
    animarConteo(el, 0, valor, 800);
  } else {
    el.textContent = valor;
  }
}

/**
 * Anima un número desde start hasta end en la duración dada.
 * @param {HTMLElement} el - Elemento a actualizar
 * @param {number} start - Valor inicial
 * @param {number} end - Valor final
 * @param {number} duration - Duración en ms
 */
function animarConteo(el, start, end, duration) {
  const startTime = performance.now();
  const updateCount = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic
    el.textContent = Math.round(start + (end - start) * eased);
    if (progress < 1) requestAnimationFrame(updateCount);
  };
  requestAnimationFrame(updateCount);
}

// ============================================================
// GRÁFICAS CON CHART.JS
// ============================================================

/**
 * Renderiza las gráficas del dashboard a partir de los conteos
 * ya calculados en el backend (stats.porEstado / stats.porCanal).
 * @param {Object} stats - Estadísticas devueltas por apiGetDashboard()
 */
function renderizarGraficas(stats) {
  renderizarGraficaEstados(stats.porEstado || {});
  renderizarGraficaCanales(stats.porCanal || {});
}

/**
 * Renderiza la gráfica de dona con los estados de pedidos.
 * @param {Object} porEstado - { estado: count }
 */
function renderizarGraficaEstados(porEstado) {
  const canvas = document.getElementById('chart-estados');
  if (!canvas) return;

  // Destruir gráfica anterior si existe
  if (chartEstados) {
    chartEstados.destroy();
    chartEstados = null;
  }

  const labels = Object.keys(porEstado);
  const values = Object.values(porEstado);

  if (labels.length === 0) return;

  // Paleta de colores por estado
  const colores = {
    'Pendiente de compra': '#94a3b8',
    'Pedido realizado a la disquera': '#60a5fa',
    'En proceso de compra': '#a78bfa',
    'Preventa': '#f59e0b',
    'Despachado': '#34d399',
    'En aduanas': '#fb923c',
    'En viaje internacional': '#38bdf8',
    'En bodega': '#818cf8',
    'Entregado': '#4ade80'
  };

  const backgroundColors = labels.map(l => colores[l] || '#6b7280');

  chartEstados = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: backgroundColors,
        borderColor: 'rgba(15, 15, 25, 0.8)',
        borderWidth: 3,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#94a3b8',
            font: { size: 11, family: "'DM Sans', sans-serif" },
            padding: 12,
            usePointStyle: true,
            pointStyleWidth: 8
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 15, 35, 0.95)',
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (ctx) => ` ${ctx.parsed} pedido${ctx.parsed !== 1 ? 's' : ''}`
          }
        }
      }
    }
  });
}

/**
 * Renderiza la gráfica de barras por canal de venta.
 * @param {Object} porCanal - { canal: count }
 */
function renderizarGraficaCanales(porCanal) {
  const canvas = document.getElementById('chart-canales');
  if (!canvas) return;

  if (chartCanales) {
    chartCanales.destroy();
    chartCanales = null;
  }

  const labels = Object.keys(porCanal);
  const values = Object.values(porCanal);

  if (labels.length === 0) return;

  chartCanales = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Pedidos',
        data: values,
        backgroundColor: 'rgba(251, 191, 36, 0.2)',
        borderColor: '#fbbf24',
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 15, 35, 0.95)',
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 12
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: '#64748b',
            stepSize: 1,
            font: { family: "'DM Sans', sans-serif" }
          },
          grid: {
            color: 'rgba(255,255,255,0.05)'
          }
        },
        x: {
          ticks: {
            color: '#64748b',
            font: { family: "'DM Sans', sans-serif" }
          },
          grid: { display: false }
        }
      }
    }
  });
}
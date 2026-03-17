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
 * Calcula las estadísticas directamente del cache local
 * para evitar llamadas adicionales al servidor.
 */
async function actualizarDashboard() {
  const pedidos = getPedidosCache();
  calcularYMostrarStats(pedidos);
  renderizarGraficas(pedidos);
}

/**
 * Calcula estadísticas desde el cache local y actualiza las tarjetas.
 * @param {Array} pedidos - Lista de pedidos del cache
 */
function calcularYMostrarStats(pedidos) {
  // Contadores por estado
  const estadosTransito = ['Despachado', 'En aduanas', 'En viaje internacional'];
  let totalVentas = 0;
  let ganancias = 0;
  let enPreventa = 0;
  let enTransito = 0;
  let entregados = 0;

  pedidos.forEach(p => {
    const venta = parseFloat(p.precio_venta) || 0;
    const ganancia = parseFloat(p.ganancia) || 0;
    totalVentas += venta;
    ganancias += ganancia;

    if (p.estado_pedido === 'Preventa') enPreventa++;
    if (estadosTransito.includes(p.estado_pedido)) enTransito++;
    if (p.estado_pedido === 'Entregado') entregados++;
  });

  // Actualizar tarjetas del dashboard
  actualizarTarjeta('stat-total-pedidos', pedidos.length);
  actualizarTarjeta('stat-preventa', enPreventa);
  actualizarTarjeta('stat-transito', enTransito);
  actualizarTarjeta('stat-entregados', entregados);
  actualizarTarjeta('stat-ventas', formatCurrency(totalVentas));
  actualizarTarjeta('stat-ganancias', formatCurrency(ganancias));
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
 * Renderiza las gráficas del dashboard.
 * Destruye instancias anteriores para evitar duplicados.
 * @param {Array} pedidos - Lista de pedidos para calcular datos
 */
function renderizarGraficas(pedidos) {
  const porEstado = {};
  const porCanal = {};

  pedidos.forEach(p => {
    const estado = p.estado_pedido || 'Sin estado';
    const canal = p.canal_venta || 'Sin canal';
    porEstado[estado] = (porEstado[estado] || 0) + 1;
    porCanal[canal] = (porCanal[canal] || 0) + 1;
  });

  renderizarGraficaEstados(porEstado);
  renderizarGraficaCanales(porCanal);
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

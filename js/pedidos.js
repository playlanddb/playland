/**
 * pedidos.js - Módulo de gestión de pedidos
 * 
 * Maneja el renderizado de la tabla de pedidos y las
 * operaciones CRUD: crear, editar y eliminar pedidos.
 */

// ============================================================
// ESTADO LOCAL DE PEDIDOS
// ============================================================

/**
 * Cache local de SOLO la página de pedidos actualmente cargada
 * (no de todos los pedidos). Se actualiza con cada operación exitosa.
 */
let pedidosCache = [];

/**
 * Estado de paginación de la tabla de pedidos.
 */
let paginacionPedidos = {
  page: 1,
  limit: 50,
  total: 0,
  totalPages: 1
};

// ============================================================
// CARGA Y RENDERIZADO
// ============================================================

/**
 * Carga UNA PÁGINA de pedidos desde el backend (con los filtros activos
 * de filtros.js, si los hay) y actualiza la tabla + controles de paginación.
 * Es la función principal que inicializa/actualiza la vista de pedidos.
 *
 * @param {number} [page] - Página a cargar. Si no se indica, usa la página actual.
 */
async function cargarPedidos(page) {
  showLoader('Cargando pedidos...');
  try {
    const filtros = (typeof filtrosActivos !== 'undefined') ? filtrosActivos : {};
    const targetPage = page || paginacionPedidos.page || 1;

    const respuesta = await apiGetPedidos({
      page: targetPage,
      limit: paginacionPedidos.limit,
      search: filtros.busqueda || '',
      estado: filtros.estado || '',
      tipoProducto: filtros.tipoProducto || '',
      canal: filtros.canal || '',
      fechaDesde: filtros.fechaDesde || '',
      fechaHasta: filtros.fechaHasta || ''
    });

    pedidosCache = respuesta.data;
    paginacionPedidos = {
      page: respuesta.page,
      limit: respuesta.limit,
      total: respuesta.total,
      totalPages: respuesta.totalPages
    };

    renderizarTabla(pedidosCache);
    actualizarContadorResultados(paginacionPedidos.total);
    renderizarControlesPaginacion();
  } catch (error) {
    showToast('Error al cargar pedidos: ' + error.message, 'error');
    console.error('Error cargarPedidos:', error);
  } finally {
    hideLoader();
  }
}

/**
 * Renderiza la tabla de pedidos con los datos proporcionados.
 * Si el array está vacío, muestra un estado vacío visual.
 * 
 * Todos los campos se convierten con String() antes de usarlos
 * porque Google Sheets puede devolver números en vez de texto
 * (ej: numero_pedido llega como 1045 en vez de "1045").
 * 
 * @param {Array} pedidos - Lista de pedidos a mostrar
 */
function renderizarTabla(pedidos) {
  const tbody = document.getElementById('tabla-pedidos-body');
  if (!tbody) return;

  if (!pedidos || pedidos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-state">
          <div class="empty-icon">📦</div>
          <p>No se encontraron pedidos</p>
          <span>Crea tu primer pedido con el botón "+ Nuevo Pedido"</span>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = pedidos.map(p => {
    // Convertir todos los campos a string para evitar errores con valores
    // numéricos que llegan de Google Sheets
    const id = String(p.id_pedido || '');
    const numPedido = String(p.numero_pedido || '—');
    const numWeb = String(p.numero_pedido_web || '');
    const cliente = String(p.cliente || '—');
    const instagram = String(p.usuario_instagram || '');
    const producto = String(p.nombre_producto || '—');
    const artista = String(p.artista || '—');
    const tipo = String(p.tipo_producto || '—');
    const canal = String(p.canal_venta || '');

    // Escapar comillas simples para uso seguro en atributos onclick
    const numEsc = numPedido.replace(/'/g, "\\'");
    const clienteEsc = cliente.replace(/'/g, "\\'");

    return `
    <tr class="table-row" data-id="${id}">
      <td data-label="Pedido">
        <div>
          <span class="order-number">#${numPedido}</span>
          ${numWeb ? `<span class="order-web-num">Web: ${numWeb}</span>` : ''}
          <span class="order-date">${formatDate(p.fecha)}</span>
        </div>
      </td>
      <td data-label="Cliente">
        <div>
          <span class="client-name">${cliente}</span>
          ${instagram ? `<span class="instagram-handle">@${instagram}</span>` : ''}
        </div>
      </td>
      <td data-label="Producto">
        <div>
          <span class="product-name">${producto}</span>
          <span class="artist-name">${artista}</span>
        </div>
      </td>
      <td data-label="Tipo">
        <span class="product-type">${tipo}</span>
      </td>
      <td data-label="Estado">${getEstadoBadge(p.estado_pedido)}</td>
      <td data-label="Venta">
        <span class="price-value">${formatCurrency(p.precio_venta)}</span>
      </td>
      <td data-label="Ganancia">
        <span class="gain-value ${(parseFloat(p.ganancia) || 0) >= 0 ? 'positive' : 'negative'}">
          ${formatCurrency(p.ganancia)}
        </span>
      </td>
      <td data-label="Restante">
        <span class="restante ${(parseFloat(p.restante_por_pagar) || 0) <= 0 ? 'paid' : 'pending'}">
          ${(parseFloat(p.restante_por_pagar) || 0) <= 0 ? '✓ Pagado' : formatCurrency(p.restante_por_pagar)}
        </span>
      </td>
      <td data-label="Canal">
        <span class="canal-badge canal-${canal.toLowerCase().replace(/\s+/g, '-')}">
          ${canal || '—'}
        </span>
      </td>
      <td>
        <div class="action-buttons">
          <button class="btn-action btn-edit" onclick="editarPedido('${id}')" title="Editar pedido">
            <i class="fa-solid fa-pen-to-square" style="color: white;"></i>
            
          </button>
          <button class="btn-action btn-delete" onclick="confirmarEliminar('${id}', '${numEsc}', '${clienteEsc}')" title="Eliminar pedido">
            <i class="fa-solid fa-trash" style="color: white;"></i>
          </button>
        </div>
      </td>
    </tr>
  `;
  }).join('');
}

/**
 * Actualiza el contador de resultados mostrado sobre la tabla.
 * @param {number} count - Número total de pedidos que cumplen los filtros (no solo los de la página)
 */
function actualizarContadorResultados(count) {
  const contador = document.getElementById('resultado-count');
  if (contador) {
    contador.textContent = `${count} pedido${count !== 1 ? 's' : ''}`;
  }
}

// ============================================================
// PAGINACIÓN
// ============================================================

/**
 * Pinta los controles de paginación (Anterior / página actual / Siguiente)
 * dentro de #paginacion-pedidos, según el estado de paginacionPedidos.
 */
function renderizarControlesPaginacion() {
  const cont = document.getElementById('paginacion-pedidos');
  if (!cont) return;

  const { page, totalPages, total } = paginacionPedidos;

  if (total === 0) {
    cont.innerHTML = '';
    return;
  }

  cont.innerHTML = `
    <button class="btn btn-secondary btn-paginacion" id="btn-pagina-anterior" ${page <= 1 ? 'disabled' : ''}>
      <i class="fa-solid fa-chevron-left"></i> Anterior
    </button>
    <span class="paginacion-info">Página ${page} de ${totalPages}</span>
    <button class="btn btn-secondary btn-paginacion" id="btn-pagina-siguiente" ${page >= totalPages ? 'disabled' : ''}>
      Siguiente <i class="fa-solid fa-chevron-right"></i>
    </button>
  `;

  const btnAnterior = document.getElementById('btn-pagina-anterior');
  if (btnAnterior) {
    btnAnterior.addEventListener('click', () => {
      if (paginacionPedidos.page > 1) cargarPedidos(paginacionPedidos.page - 1);
    });
  }

  const btnSiguiente = document.getElementById('btn-pagina-siguiente');
  if (btnSiguiente) {
    btnSiguiente.addEventListener('click', () => {
      if (paginacionPedidos.page < paginacionPedidos.totalPages) cargarPedidos(paginacionPedidos.page + 1);
    });
  }
}

// ============================================================
// CREAR / EDITAR PEDIDO
// ============================================================

/**
 * Maneja el envío del formulario de creación/edición de pedido.
 * Determina si es una creación nueva o una actualización según
 * si existe un id en el campo oculto.
 */
async function guardarPedido() {
  if (!validarFormulario()) return;

  const idExistente = document.getElementById('pedido-id').value;
  const esEdicion = Boolean(idExistente);

  const datos = {
    numero_pedido: document.getElementById('f-numero-pedido').value.trim(),
    fecha: document.getElementById('f-fecha').value,
    artista: document.getElementById('f-artista').value.trim(),
    tipo_producto: document.getElementById('f-tipo-producto').value,
    nombre_producto: document.getElementById('f-nombre-producto').value.trim(),
    estado_pedido: document.getElementById('f-estado').value,
    cliente: document.getElementById('f-cliente').value.trim(),
    numero_contacto: document.getElementById('f-contacto').value.trim(),
    usuario_instagram: document.getElementById('f-instagram').value.trim().replace('@', ''),
    numero_pedido_web: document.getElementById('f-numero-pedido-web').value.trim(),
    canal_venta: document.getElementById('f-canal').value,
    precio_compra: document.getElementById('f-precio-compra').value || '0',
    precio_venta: document.getElementById('f-precio-venta').value || '0',
    costo_envio: document.getElementById('f-envio').value || '0',
    abono_cliente: document.getElementById('f-abono').value || '0',
    nota: document.getElementById('f-nota').value.trim(),
    id_producto_inventario: document.getElementById('f-producto-inventario-id')?.value || ''
  };

  if (esEdicion) datos.id_pedido = idExistente;

  showLoader(esEdicion ? 'Actualizando pedido...' : 'Creando pedido...');

  try {
    if (esEdicion) {
      await apiUpdatePedido(datos);
      showToast('Pedido actualizado correctamente ✓', 'success');
    } else {
      await apiCreatePedido(datos);
      showToast('Pedido creado correctamente ✓', 'success');
    }

    closePedidoModal();

    // Recargar solo la página actual (con los filtros activos), no todo el dataset
    await cargarPedidos(paginacionPedidos.page);

    // El dashboard depende de totales/ganancias, así que siempre se refresca
    // (es una llamada cacheada y liviana en el backend).
    await actualizarDashboard();

    // El inventario solo cambia si el pedido se vinculó a un producto del stock
    // (solo ocurre al CREAR un pedido nuevo, no al editar).
    if (!esEdicion && datos.id_producto_inventario) {
      await cargarInventario();
    }

  } catch (error) {
    showToast('Error al guardar: ' + error.message, 'error');
    console.error('Error guardarPedido:', error);
  } finally {
    hideLoader();
  }
}

// ============================================================
// EDITAR PEDIDO
// ============================================================

/**
 * Abre el modal de edición prellenado con los datos del pedido.
 * Busca el pedido en el cache local por su ID.
 * @param {string} idPedido - ID del pedido a editar
 */
function editarPedido(idPedido) {
  const pedido = pedidosCache.find(p => String(p.id_pedido) === String(idPedido));
  if (!pedido) {
    showToast('Pedido no encontrado', 'error');
    return;
  }
  openPedidoModal(pedido);
}

// ============================================================
// ELIMINAR PEDIDO
// ============================================================

/**
 * Muestra confirmación antes de eliminar un pedido.
 * @param {string} idPedido - ID del pedido
 * @param {string} numeroPedido - Número visible del pedido
 * @param {string} cliente - Nombre del cliente
 */
async function confirmarEliminar(idPedido, numeroPedido, cliente) {
  const confirmado = await showConfirm(
    'Eliminar Pedido',
    `¿Estás seguro de que deseas eliminar el pedido #${numeroPedido} de ${cliente}? Esta acción no se puede deshacer.`,
    'Eliminar'
  );

  if (confirmado) {
    await eliminarPedido(idPedido);
  }
}

/**
 * Elimina un pedido del backend y actualiza la interfaz.
 * @param {string} idPedido - ID del pedido a eliminar
 */
async function eliminarPedido(idPedido) {
  showLoader('Eliminando pedido...');
  try {
    await apiDeletePedido(idPedido);
    showToast('Pedido eliminado correctamente', 'success');
    // Recarga solo la página actual (el backend ajusta la página si ya no existe)
    await cargarPedidos(paginacionPedidos.page);
    await actualizarDashboard();
    // Eliminar un pedido no devuelve stock al inventario, así que no hace
    // falta recargar inventario aquí.
  } catch (error) {
    showToast('Error al eliminar: ' + error.message, 'error');
    console.error('Error eliminarPedido:', error);
  } finally {
    hideLoader();
  }
}

/**
 * Retorna el cache de pedidos actual para uso en otros módulos.
 * @returns {Array} Lista de pedidos en cache
 */
function getPedidosCache() {
  return pedidosCache;
}
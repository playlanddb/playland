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
 * Cache local de todos los pedidos cargados desde el backend.
 * Se actualiza con cada operación exitosa.
 */
let pedidosCache = [];

// ============================================================
// CARGA Y RENDERIZADO
// ============================================================

/**
 * Carga todos los pedidos desde el backend y actualiza la tabla.
 * Es la función principal que inicializa la vista de pedidos.
 */
async function cargarPedidos() {
  showLoader('Cargando pedidos...');
  try {
    pedidosCache = await apiGetPedidos();
    renderizarTabla(pedidosCache);
    actualizarContadorResultados(pedidosCache.length);
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
    const id          = String(p.id_pedido || '');
    const numPedido   = String(p.numero_pedido || '—');
    const numWeb      = String(p.numero_pedido_web || '');
    const cliente     = String(p.cliente || '—');
    const instagram   = String(p.usuario_instagram || '');
    const producto    = String(p.nombre_producto || '—');
    const artista     = String(p.artista || '—');
    const tipo        = String(p.tipo_producto || '—');
    const canal       = String(p.canal_venta || '');

    // Escapar comillas simples para uso seguro en atributos onclick
    const numEsc     = numPedido.replace(/'/g, "\\'");
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
 * @param {number} count - Número de pedidos visibles
 */
function actualizarContadorResultados(count) {
  const contador = document.getElementById('resultado-count');
  if (contador) {
    contador.textContent = `${count} pedido${count !== 1 ? 's' : ''}`;
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
    numero_pedido:         document.getElementById('f-numero-pedido').value.trim(),
    fecha:                 document.getElementById('f-fecha').value,
    artista:               document.getElementById('f-artista').value.trim(),
    tipo_producto:         document.getElementById('f-tipo-producto').value,
    nombre_producto:       document.getElementById('f-nombre-producto').value.trim(),
    estado_pedido:         document.getElementById('f-estado').value,
    cliente:               document.getElementById('f-cliente').value.trim(),
    numero_contacto:       document.getElementById('f-contacto').value.trim(),
    usuario_instagram:     document.getElementById('f-instagram').value.trim().replace('@', ''),
    numero_pedido_web:     document.getElementById('f-numero-pedido-web').value.trim(),
    canal_venta:           document.getElementById('f-canal').value,
    precio_compra:         document.getElementById('f-precio-compra').value || '0',
    precio_venta:          document.getElementById('f-precio-venta').value || '0',
    costo_envio:           document.getElementById('f-envio').value || '0',
    abono_cliente:         document.getElementById('f-abono').value || '0',
    nota:                  document.getElementById('f-nota').value.trim()
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
    await cargarPedidos();
    await actualizarDashboard();

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
    await cargarPedidos();
    await actualizarDashboard();
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
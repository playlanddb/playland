/**
 * PLAYLAND - Sistema de Gestión de Pedidos e Inventario
 * Backend en Google Apps Script
 *
 * INSTRUCCIONES DE DESPLIEGUE:
 * 1. Abrir Google Sheets → Extensiones → Apps Script
 * 2. Pegar este código en Code.gs
 * 3. Implementar → Nueva implementación → Aplicación web
 * 4. Ejecutar como: Yo | Acceso: Cualquier usuario
 * 5. Copiar la URL y pegarla en api.js del frontend
 */

// ============================================================
// CONFIGURACIÓN GLOBAL
// ============================================================

const SHEET_NAME = 'pedidos';
const INVENTORY_SHEET_NAME = 'inventario';

const COLUMNS = [
  'id_pedido', 'numero_pedido', 'fecha', 'artista', 'tipo_producto',
  'nombre_producto', 'estado_pedido', 'precio_compra', 'precio_venta',
  'costo_envio', 'ganancia', 'cliente', 'numero_contacto',
  'usuario_instagram', 'canal_venta', 'nota', 'abono_cliente', 'restante_por_pagar'
];

const INVENTORY_COLUMNS = [
  'id_producto', 'artista', 'tipo_producto', 'nombre_producto',
  'unidades_disponibles', 'costo_unitario', 'precio_venta_sugerido',
  'estado', 'nota', 'fecha_ingreso'
];

// ============================================================
// PUNTO DE ENTRADA PRINCIPAL
// ============================================================

function doGet(e) {
  try {
    const action = e.parameter.action;
    let result;

    switch (action) {
      // --- Pedidos ---
      case 'getPedidos':       result = getPedidos(); break;
      case 'createPedido':     result = createPedido(e.parameter); break;
      case 'updatePedido':     result = updatePedido(e.parameter); break;
      case 'deletePedido':     result = deletePedido(e.parameter.id_pedido); break;
      case 'getDashboard':     result = getDashboardStats(); break;
      // --- Inventario ---
      case 'getInventario':    result = getInventario(); break;
      case 'createProducto':   result = createProducto(e.parameter); break;
      case 'updateProducto':   result = updateProducto(e.parameter); break;
      case 'deleteProducto':   result = deleteProducto(e.parameter.id_producto); break;
      case 'ajustarStock':     result = ajustarStock(e.parameter); break;
      default:
        result = { success: false, error: 'Acción no reconocida: ' + action };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// CRUD PEDIDOS
// ============================================================

function getPedidos() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: true, data: [] };

  const pedidos = data.slice(1).map(row => {
    const pedido = {};
    COLUMNS.forEach((col, i) => {
      if (col === 'fecha' && row[i] instanceof Date) {
        pedido[col] = Utilities.formatDate(row[i], Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else {
        pedido[col] = row[i];
      }
    });
    return pedido;
  });

  return { success: true, data: pedidos };
}

function createPedido(params) {
  const sheet = getSheet();
  const id = 'PL-' + Date.now();
  const fecha = params.fecha || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  const precioCompra = parseFloat(params.precio_compra) || 0;
  const precioVenta  = parseFloat(params.precio_venta)  || 0;
  const costoEnvio   = parseFloat(params.costo_envio)   || 0;
  const abono        = parseFloat(params.abono_cliente)  || 0;

  const newRow = [
    id, params.numero_pedido || '', fecha,
    params.artista || '', params.tipo_producto || '', params.nombre_producto || '',
    params.estado_pedido || 'Pendiente de compra',
    precioCompra, precioVenta, costoEnvio,
    precioVenta - precioCompra - costoEnvio,
    params.cliente || '', params.numero_contacto || '',
    params.usuario_instagram || '', params.canal_venta || '',
    params.nota || '', abono, precioVenta - abono
  ];

  sheet.appendRow(newRow);
  return { success: true, message: 'Pedido creado correctamente' };
}

function updatePedido(params) {
  const sheet = getSheet();
  const data  = sheet.getDataRange().getValues();
  let rowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(params.id_pedido)) { rowIndex = i + 1; break; }
  }
  if (rowIndex === -1) return { success: false, error: 'Pedido no encontrado' };

  const precioCompra = parseFloat(params.precio_compra) || 0;
  const precioVenta  = parseFloat(params.precio_venta)  || 0;
  const costoEnvio   = parseFloat(params.costo_envio)   || 0;
  const abono        = parseFloat(params.abono_cliente)  || 0;

  const updatedRow = [
    params.id_pedido, params.numero_pedido || data[rowIndex-1][1],
    params.fecha || data[rowIndex-1][2],
    params.artista || '', params.tipo_producto || '', params.nombre_producto || '',
    params.estado_pedido || '',
    precioCompra, precioVenta, costoEnvio,
    precioVenta - precioCompra - costoEnvio,
    params.cliente || '', params.numero_contacto || '',
    params.usuario_instagram || '', params.canal_venta || '',
    params.nota || '', abono, precioVenta - abono
  ];

  sheet.getRange(rowIndex, 1, 1, COLUMNS.length).setValues([updatedRow]);
  return { success: true, message: 'Pedido actualizado correctamente' };
}

function deletePedido(idPedido) {
  const sheet = getSheet();
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(idPedido)) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Pedido eliminado correctamente' };
    }
  }
  return { success: false, error: 'Pedido no encontrado' };
}

// ============================================================
// CRUD INVENTARIO
// ============================================================

/**
 * Obtiene todos los productos del inventario.
 * Calcula automáticamente el estado (disponible/agotado/bajo stock)
 * basado en las unidades disponibles.
 */
function getInventario() {
  const sheet = getInventorySheet();
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: true, data: [] };

  const productos = data.slice(1).map(row => {
    const producto = {};
    INVENTORY_COLUMNS.forEach((col, i) => {
      if (col === 'fecha_ingreso' && row[i] instanceof Date) {
        producto[col] = Utilities.formatDate(row[i], Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else {
        producto[col] = row[i];
      }
    });
    return producto;
  });

  return { success: true, data: productos };
}

/**
 * Crea un nuevo producto en el inventario.
 * El estado se calcula automáticamente según las unidades.
 */
function createProducto(params) {
  const sheet = getInventorySheet();
  const id    = 'INV-' + Date.now();
  const fecha = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const unidades = parseInt(params.unidades_disponibles) || 0;
  const estado   = calcularEstadoStock(unidades);

  const newRow = [
    id,
    params.artista || '',
    params.tipo_producto || '',
    params.nombre_producto || '',
    unidades,
    parseFloat(params.costo_unitario) || 0,
    parseFloat(params.precio_venta_sugerido) || 0,
    estado,
    params.nota || '',
    fecha
  ];

  sheet.appendRow(newRow);
  return { success: true, message: 'Producto agregado al inventario' };
}

/**
 * Actualiza un producto existente en el inventario.
 */
function updateProducto(params) {
  const sheet = getInventorySheet();
  const data  = sheet.getDataRange().getValues();
  let rowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(params.id_producto)) { rowIndex = i + 1; break; }
  }
  if (rowIndex === -1) return { success: false, error: 'Producto no encontrado' };

  const unidades = parseInt(params.unidades_disponibles) || 0;
  const estado   = calcularEstadoStock(unidades);

  const updatedRow = [
    params.id_producto,
    params.artista || '',
    params.tipo_producto || '',
    params.nombre_producto || '',
    unidades,
    parseFloat(params.costo_unitario) || 0,
    parseFloat(params.precio_venta_sugerido) || 0,
    estado,
    params.nota || '',
    data[rowIndex - 1][9] // mantener fecha_ingreso original
  ];

  sheet.getRange(rowIndex, 1, 1, INVENTORY_COLUMNS.length).setValues([updatedRow]);
  return { success: true, message: 'Producto actualizado correctamente' };
}

/**
 * Elimina un producto del inventario.
 */
function deleteProducto(idProducto) {
  const sheet = getInventorySheet();
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(idProducto)) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Producto eliminado del inventario' };
    }
  }
  return { success: false, error: 'Producto no encontrado' };
}

/**
 * Ajusta el stock de un producto (sumar o restar unidades).
 * Se usa para entradas manuales o descuentos por entrega.
 * @param {Object} params - { id_producto, cantidad, tipo: 'entrada'|'salida' }
 */
function ajustarStock(params) {
  const sheet = getInventorySheet();
  const data  = sheet.getDataRange().getValues();
  let rowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(params.id_producto)) { rowIndex = i + 1; break; }
  }
  if (rowIndex === -1) return { success: false, error: 'Producto no encontrado' };

  const cantidadActual = parseInt(data[rowIndex - 1][4]) || 0;
  const cantidad       = parseInt(params.cantidad) || 0;
  const nuevaCantidad  = params.tipo === 'entrada'
    ? cantidadActual + cantidad
    : Math.max(0, cantidadActual - cantidad);

  const nuevoEstado = calcularEstadoStock(nuevaCantidad);

  // Actualizar solo columnas de unidades y estado (col 5 y 8)
  sheet.getRange(rowIndex, 5).setValue(nuevaCantidad);
  sheet.getRange(rowIndex, 8).setValue(nuevoEstado);

  return {
    success: true,
    message: `Stock actualizado: ${cantidadActual} → ${nuevaCantidad} unidades`,
    nuevaCantidad: nuevaCantidad
  };
}

// ============================================================
// DASHBOARD
// ============================================================

function getDashboardStats() {
  const sheet = getSheet();
  const data  = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    return { success: true, stats: { totalPedidos:0, enPreventa:0, enTransito:0, entregados:0, totalVentas:0, gananciasTotal:0, porEstado:{} } };
  }

  const pedidos = data.slice(1);
  let totalVentas = 0, gananciasTotal = 0;
  const porEstado = {};
  const estadosTransito = ['Despachado', 'En aduanas', 'En viaje internacional'];

  pedidos.forEach(row => {
    const estado = row[6] || 'Sin estado';
    totalVentas    += parseFloat(row[8]) || 0;
    gananciasTotal += parseFloat(row[10]) || 0;
    porEstado[estado] = (porEstado[estado] || 0) + 1;
  });

  return {
    success: true,
    stats: {
      totalPedidos: pedidos.length,
      enPreventa:   porEstado['Preventa'] || 0,
      enTransito:   estadosTransito.reduce((acc, e) => acc + (porEstado[e] || 0), 0),
      entregados:   porEstado['Entregado'] || 0,
      totalVentas, gananciasTotal, porEstado
    }
  };
}

// ============================================================
// UTILIDADES INTERNAS
// ============================================================

/**
 * Calcula el estado del stock según las unidades disponibles.
 * - 0 unidades     → Agotado
 * - 1-3 unidades   → Stock bajo
 * - 4+ unidades    → Disponible
 */
function calcularEstadoStock(unidades) {
  if (unidades <= 0) return 'Agotado';
  if (unidades <= 3) return 'Stock bajo';
  return 'Disponible';
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(COLUMNS);
    const r = sheet.getRange(1, 1, 1, COLUMNS.length);
    r.setBackground('#1a1a2e'); r.setFontColor('#ffffff'); r.setFontWeight('bold');
  }
  return sheet;
}

function getInventorySheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(INVENTORY_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(INVENTORY_SHEET_NAME);
    sheet.appendRow(INVENTORY_COLUMNS);
    const r = sheet.getRange(1, 1, 1, INVENTORY_COLUMNS.length);
    r.setBackground('#1a1a2e'); r.setFontColor('#ffffff'); r.setFontWeight('bold');
  }
  return sheet;
}
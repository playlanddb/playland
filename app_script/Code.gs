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
  'usuario_instagram', 'canal_venta', 'nota', 'abono_cliente', 'restante_por_pagar',
  'numero_pedido_web'
];

const INVENTORY_COLUMNS = [
  'id_producto', 'artista', 'tipo_producto', 'nombre_producto',
  'unidades_disponibles', 'costo_unitario', 'precio_venta_sugerido',
  'estado', 'nota', 'fecha_ingreso'
];

// ============================================================
// CONFIGURACIÓN DE CACHE (CacheService)
// ============================================================
// CacheService.getScriptCache() permite guardar datos hasta 6 horas,
// pero cada VALOR está limitado a 100KB. Para no superar ese límite
// con miles de filas, los datos crudos de la hoja se trocean en
// "chunks" de N filas cada uno y se guardan bajo claves separadas.

const CACHE_TTL_SECONDS = 300;       // 5 minutos de vida para los datos crudos
const CACHE_CHUNK_SIZE = 200;        // filas por chunk de cache

const PEDIDOS_CACHE_META_KEY = 'pedidos_cache_meta_v1';
const PEDIDOS_CACHE_CHUNK_PREFIX = 'pedidos_chunk_v1_';

const INVENTARIO_CACHE_META_KEY = 'inventario_cache_meta_v1';
const INVENTARIO_CACHE_CHUNK_PREFIX = 'inventario_chunk_v1_';

const DASHBOARD_CACHE_KEY = 'dashboard_stats_v1';

// ============================================================
// PUNTO DE ENTRADA PRINCIPAL
// ============================================================

function doGet(e) {
  try {
    const action = e.parameter.action;
    let result;

    switch (action) {
      // --- Pedidos ---
      case 'getPedidos':       result = getPedidos(e.parameter); break;
      case 'createPedido':     result = createPedido(e.parameter); break;
      case 'updatePedido':     result = updatePedido(e.parameter); break;
      case 'deletePedido':     result = deletePedido(e.parameter.id_pedido); break;
      case 'getDashboard':     result = getDashboardStats(); break;
      // --- Inventario ---
      case 'getInventario':    result = getInventario(e.parameter); break;
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

/**
 * Obtiene pedidos de forma PAGINADA, con filtros opcionales y
 * ordenados por fecha más reciente primero.
 *
 * Los datos crudos de la hoja se leen en un solo getRange().getValues()
 * (nunca celda por celda) y se guardan en CacheService durante 5 minutos,
 * así que peticiones repetidas (cambiar de página, escribir en el buscador,
 * refrescar el dashboard) no vuelven a golpear Google Sheets cada vez.
 *
 * @param {Object} params - { page, limit, search, estado, tipoProducto, canal, fechaDesde, fechaHasta }
 * @returns {Object} { success, data, total, page, limit, totalPages }
 */
function getPedidos(params) {
  params = params || {};

  const page  = Math.max(1, parseInt(params.page, 10) || 1);
  const limit = Math.max(1, parseInt(params.limit, 10) || 50);

  const search       = String(params.search || '').toLowerCase().trim();
  const estado       = params.estado || '';
  const tipoProducto = params.tipoProducto || '';
  const canal        = params.canal || '';
  const fechaDesde   = params.fechaDesde || '';
  const fechaHasta   = params.fechaHasta || '';

  const rawRows = getPedidosRawData(); // array de arrays (ya cacheado), fecha como 'yyyy-MM-dd'

  // Convertir filas a objetos
  let pedidos = rawRows.map(row => {
    const pedido = {};
    COLUMNS.forEach((col, i) => { pedido[col] = row[i]; });
    return pedido;
  });

  // ── Filtros (se aplican en memoria, sobre el set ya leído) ──
  if (search) {
    pedidos = pedidos.filter(p =>
      String(p.numero_pedido || '').toLowerCase().includes(search) ||
      String(p.cliente || '').toLowerCase().includes(search) ||
      String(p.numero_contacto || '').toLowerCase().includes(search) ||
      String(p.usuario_instagram || '').toLowerCase().includes(search) ||
      String(p.nombre_producto || '').toLowerCase().includes(search) ||
      String(p.artista || '').toLowerCase().includes(search)
    );
  }
  if (estado)       pedidos = pedidos.filter(p => p.estado_pedido === estado);
  if (tipoProducto) pedidos = pedidos.filter(p => p.tipo_producto === tipoProducto);
  if (canal)        pedidos = pedidos.filter(p => p.canal_venta === canal);
  if (fechaDesde)    pedidos = pedidos.filter(p => String(p.fecha || '').substring(0, 10) >= fechaDesde);
  if (fechaHasta)    pedidos = pedidos.filter(p => String(p.fecha || '').substring(0, 10) <= fechaHasta);

  // ── Orden: más reciente primero (por fecha, y por id como desempate) ──
  pedidos.sort((a, b) => {
    const fa = String(a.fecha || ''), fb = String(b.fecha || '');
    if (fa !== fb) return fa < fb ? 1 : -1;
    return String(b.id_pedido || '').localeCompare(String(a.id_pedido || ''));
  });

  // ── Paginación ──
  const total      = pedidos.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage   = Math.min(page, totalPages);
  const start      = (safePage - 1) * limit;
  const pageData   = pedidos.slice(start, start + limit);

  return {
    success: true,
    data: pageData,
    total: total,
    page: safePage,
    limit: limit,
    totalPages: totalPages
  };
}

/**
 * Lee los datos crudos (sin encabezado) de la hoja de pedidos.
 * Usa CacheService para evitar lecturas repetidas de Sheets; si el cache
 * expiró o fue invalidado, hace UNA sola lectura con getRange().getValues()
 * (rango exacto, nunca celda por celda) y vuelve a poblar el cache.
 * La columna 'fecha' se normaliza a texto 'yyyy-MM-dd' antes de cachear,
 * para que el resultado sea idéntico venga o no del cache.
 * @returns {Array<Array>} Filas crudas (cada fila = array en el orden de COLUMNS)
 */
function getPedidosRawData() {
  const cached = readChunkedCache(PEDIDOS_CACHE_META_KEY, PEDIDOS_CACHE_CHUNK_PREFIX);
  if (cached !== null) return cached;

  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const fechaIndex = COLUMNS.indexOf('fecha');
  const data = sheet.getRange(2, 1, lastRow - 1, COLUMNS.length).getValues();

  data.forEach(row => {
    if (row[fechaIndex] instanceof Date) {
      row[fechaIndex] = Utilities.formatDate(row[fechaIndex], Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
  });

  writeChunkedCache(PEDIDOS_CACHE_META_KEY, PEDIDOS_CACHE_CHUNK_PREFIX, data);
  return data;
}

/**
 * Invalida (borra) el cache de pedidos y el cache del dashboard.
 * Debe llamarse después de cualquier creación, edición o eliminación de pedidos.
 */
function invalidatePedidosCache() {
  clearChunkedCache(PEDIDOS_CACHE_META_KEY, PEDIDOS_CACHE_CHUNK_PREFIX);
  CacheService.getScriptCache().remove(DASHBOARD_CACHE_KEY);
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
    params.nota || '', abono, precioVenta - abono,
    params.numero_pedido_web || ''
  ];

  sheet.appendRow(newRow);
  invalidatePedidosCache();

  // ── NUEVO: descontar stock si el pedido viene vinculado a un producto del inventario
  if (params.id_producto_inventario) {
    try {
      ajustarStock({
        id_producto: params.id_producto_inventario,
        cantidad: 1,
        tipo: 'salida'
      });
    } catch (e) {
      // No bloquear la creación del pedido si el ajuste falla
      Logger.log('Error ajustando stock: ' + e.message);
    }
  }

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
    params.nota || '', abono, precioVenta - abono,
    params.numero_pedido_web || ''
  ];

  sheet.getRange(rowIndex, 1, 1, COLUMNS.length).setValues([updatedRow]);
  invalidatePedidosCache();
  return { success: true, message: 'Pedido actualizado correctamente' };
}

function deletePedido(idPedido) {
  const sheet = getSheet();
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(idPedido)) {
      sheet.deleteRow(i + 1);
      invalidatePedidosCache();
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
/**
 * Obtiene todos los productos del inventario.
 * Calcula automáticamente el estado (disponible/agotado/bajo stock)
 * basado en las unidades disponibles.
 *
 * NOTA: a diferencia de getPedidos(), aquí se sigue devolviendo el listado
 * COMPLETO (no paginado), porque el frontend lo usa para el autocompletado
 * del formulario de pedidos y para las tarjetas de stats del inventario,
 * que necesitan ver todos los productos a la vez. Como el catálogo de
 * productos suele ser mucho más pequeño que el histórico de pedidos, el
 * cuello de botella aquí no es el tamaño sino las lecturas repetidas a
 * Sheets, así que se resuelve con CacheService (igual que en pedidos).
 * Si en el futuro el inventario también crece a miles de filas, se puede
 * paginar con el mismo patrón usado en getPedidos().
 *
 * @param {Object} params - reservado para uso futuro (filtros/paginación)
 */
function getInventario(params) {
  const rawRows = getInventarioRawData();
  if (rawRows.length === 0) return { success: true, data: [] };

  const productos = rawRows.map(row => {
    const producto = {};
    INVENTORY_COLUMNS.forEach((col, i) => { producto[col] = row[i]; });
    return producto;
  });

  return { success: true, data: productos };
}

/**
 * Lee los datos crudos del inventario (sin encabezado), con cache,
 * igual patrón que getPedidosRawData().
 */
function getInventarioRawData() {
  const cached = readChunkedCache(INVENTARIO_CACHE_META_KEY, INVENTARIO_CACHE_CHUNK_PREFIX);
  if (cached !== null) return cached;

  const sheet = getInventorySheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const fechaIndex = INVENTORY_COLUMNS.indexOf('fecha_ingreso');
  const data = sheet.getRange(2, 1, lastRow - 1, INVENTORY_COLUMNS.length).getValues();

  data.forEach(row => {
    if (row[fechaIndex] instanceof Date) {
      row[fechaIndex] = Utilities.formatDate(row[fechaIndex], Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
  });

  writeChunkedCache(INVENTARIO_CACHE_META_KEY, INVENTARIO_CACHE_CHUNK_PREFIX, data);
  return data;
}

/**
 * Invalida el cache de inventario.
 * Debe llamarse tras crear, editar, eliminar o ajustar stock de productos.
 */
function invalidateInventarioCache() {
  clearChunkedCache(INVENTARIO_CACHE_META_KEY, INVENTARIO_CACHE_CHUNK_PREFIX);
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
  invalidateInventarioCache();
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
  invalidateInventarioCache();
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
      invalidateInventarioCache();
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
  invalidateInventarioCache();

  return {
    success: true,
    message: `Stock actualizado: ${cantidadActual} → ${nuevaCantidad} unidades`,
    nuevaCantidad: nuevaCantidad
  };
}

// ============================================================
// DASHBOARD
// ============================================================

/**
 * Calcula las estadísticas del dashboard.
 * Se cachea el resultado final (un objeto pequeño) durante 5 minutos,
 * así que si el usuario navega entre secciones o refresca el dashboard
 * varias veces seguidas, no se recalcula ni se vuelve a leer Sheets
 * cada vez. El cache se invalida automáticamente al crear, editar o
 * eliminar un pedido (ver invalidatePedidosCache).
 */
function getDashboardStats() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(DASHBOARD_CACHE_KEY);
  if (cached !== null) {
    return JSON.parse(cached);
  }

  const rawRows = getPedidosRawData();

  if (rawRows.length === 0) {
    const empty = { success: true, stats: { totalPedidos:0, enPreventa:0, enTransito:0, entregados:0, totalVentas:0, gananciasTotal:0, porEstado:{}, porCanal:{} } };
    cache.put(DASHBOARD_CACHE_KEY, JSON.stringify(empty), CACHE_TTL_SECONDS);
    return empty;
  }

  const idxEstado = COLUMNS.indexOf('estado_pedido');
  const idxVenta  = COLUMNS.indexOf('precio_venta');
  const idxGanancia = COLUMNS.indexOf('ganancia');
  const idxCanal  = COLUMNS.indexOf('canal_venta');

  let totalVentas = 0, gananciasTotal = 0;
  const porEstado = {};
  const porCanal = {};
  const estadosTransito = ['Despachado', 'En aduanas', 'En viaje internacional'];

  rawRows.forEach(row => {
    const estado = row[idxEstado] || 'Sin estado';
    const canal  = row[idxCanal] || 'Sin canal';
    totalVentas    += parseFloat(row[idxVenta]) || 0;
    gananciasTotal += parseFloat(row[idxGanancia]) || 0;
    porEstado[estado] = (porEstado[estado] || 0) + 1;
    porCanal[canal] = (porCanal[canal] || 0) + 1;
  });

  const result = {
    success: true,
    stats: {
      totalPedidos: rawRows.length,
      enPreventa:   porEstado['Preventa'] || 0,
      enTransito:   estadosTransito.reduce((acc, e) => acc + (porEstado[e] || 0), 0),
      entregados:   porEstado['Entregado'] || 0,
      totalVentas, gananciasTotal, porEstado, porCanal
    }
  };

  cache.put(DASHBOARD_CACHE_KEY, JSON.stringify(result), CACHE_TTL_SECONDS);
  return result;
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

// ============================================================
// HELPERS DE CACHE TROCEADO (CHUNKED CACHE)
// ============================================================
// CacheService.getScriptCache() solo admite valores de hasta 100KB.
// Estas 3 funciones genéricas permiten guardar/leer/borrar un array
// de filas (2D) de cualquier tamaño, partiéndolo en varios "chunks"
// bajo claves numeradas, controladas por una clave "meta" que guarda
// cuántos chunks hay. Se reutilizan tanto para pedidos como inventario.

/**
 * Intenta leer un array de filas previamente cacheado.
 * @returns {Array<Array>|null} Las filas si el cache es válido, o null si no existe/expiró.
 */
function readChunkedCache(metaKey, chunkPrefix) {
  const cache = CacheService.getScriptCache();
  const metaRaw = cache.get(metaKey);
  if (!metaRaw) return null;

  let meta;
  try {
    meta = JSON.parse(metaRaw);
  } catch (e) {
    return null;
  }

  if (meta.chunkCount === 0) return [];

  const chunkKeys = [];
  for (let i = 0; i < meta.chunkCount; i++) chunkKeys.push(chunkPrefix + i);

  const chunksMap = cache.getAll(chunkKeys);
  const rows = [];
  for (let i = 0; i < meta.chunkCount; i++) {
    const raw = chunksMap[chunkPrefix + i];
    if (raw === undefined) return null; // algún chunk expiró antes que el meta -> cache inválido
    rows.push.apply(rows, JSON.parse(raw));
  }
  return rows;
}

/**
 * Guarda un array de filas en cache, troceado en chunks de CACHE_CHUNK_SIZE.
 */
function writeChunkedCache(metaKey, chunkPrefix, rows) {
  const cache = CacheService.getScriptCache();
  const chunkCount = Math.ceil(rows.length / CACHE_CHUNK_SIZE);

  const payload = {};
  for (let i = 0; i < chunkCount; i++) {
    const chunk = rows.slice(i * CACHE_CHUNK_SIZE, (i + 1) * CACHE_CHUNK_SIZE);
    payload[chunkPrefix + i] = JSON.stringify(chunk);
  }

  if (chunkCount > 0) cache.putAll(payload, CACHE_TTL_SECONDS);
  cache.put(metaKey, JSON.stringify({ chunkCount: chunkCount, total: rows.length }), CACHE_TTL_SECONDS);
}

/**
 * Borra un cache troceado por completo (meta + todos sus chunks).
 */
function clearChunkedCache(metaKey, chunkPrefix) {
  const cache = CacheService.getScriptCache();
  const metaRaw = cache.get(metaKey);
  if (metaRaw) {
    try {
      const meta = JSON.parse(metaRaw);
      const keys = [metaKey];
      for (let i = 0; i < meta.chunkCount; i++) keys.push(chunkPrefix + i);
      cache.removeAll(keys);
      return;
    } catch (e) {
      // si el meta está corrupto, al menos borramos esa clave
    }
  }
  cache.remove(metaKey);
}
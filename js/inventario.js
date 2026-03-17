/**
 * inventario.js - Módulo de gestión de inventario/stock
 *
 * Maneja el CRUD de productos en inventario:
 * agregar productos, editar stock, eliminar y ajustar unidades.
 */

// ============================================================
// ESTADO LOCAL
// ============================================================

let inventarioCache = [];

// Estado de filtros del inventario
let filtrosInventario = {
  busqueda: "",
  tipo: "",
  estado: "",
};

// ============================================================
// CARGA Y RENDERIZADO
// ============================================================

async function cargarInventario() {
  showLoader("Cargando inventario...");
  try {
    const response = await apiRequest({ action: "getInventario" });
    inventarioCache = response.data || [];
    aplicarFiltrosInventario();
    actualizarStatsInventario(inventarioCache);
  } catch (error) {
    showToast("Error al cargar inventario: " + error.message, "error");
    console.error("Error cargarInventario:", error);
  } finally {
    hideLoader();
  }
}

// ============================================================
// FILTROS DE INVENTARIO
// ============================================================

/**
 * Inicializa los listeners de búsqueda y filtros del inventario.
 * Se llama una vez al arrancar la app.
 */
function initFiltrosInventario() {
  const inputBusqueda = document.getElementById("inv-search-input");
  if (inputBusqueda) {
    inputBusqueda.addEventListener(
      "input",
      debounce(function () {
        filtrosInventario.busqueda = this.value.toLowerCase().trim();
        aplicarFiltrosInventario();
      }, 300),
    );
  }

  const selectTipo = document.getElementById("inv-filtro-tipo");
  if (selectTipo) {
    selectTipo.addEventListener("change", function () {
      filtrosInventario.tipo = this.value;
      aplicarFiltrosInventario();
    });
  }

  const selectEstado = document.getElementById("inv-filtro-estado");
  if (selectEstado) {
    selectEstado.addEventListener("change", function () {
      filtrosInventario.estado = this.value;
      aplicarFiltrosInventario();
    });
  }

  const btnLimpiar = document.getElementById("btn-limpiar-filtros-inv");
  if (btnLimpiar) {
    btnLimpiar.addEventListener("click", limpiarFiltrosInventario);
  }
}

/**
 * Aplica los filtros activos sobre el cache del inventario.
 */
function aplicarFiltrosInventario() {
  let resultado = [...inventarioCache];

  if (filtrosInventario.busqueda) {
    const q = filtrosInventario.busqueda;
    resultado = resultado.filter(
      (p) =>
        String(p.nombre_producto || "")
          .toLowerCase()
          .includes(q) ||
        String(p.artista || "")
          .toLowerCase()
          .includes(q) ||
        String(p.tipo_producto || "")
          .toLowerCase()
          .includes(q),
    );
  }

  if (filtrosInventario.tipo) {
    resultado = resultado.filter(
      (p) => p.tipo_producto === filtrosInventario.tipo,
    );
  }

  if (filtrosInventario.estado) {
    resultado = resultado.filter((p) => p.estado === filtrosInventario.estado);
  }

  renderizarInventario(resultado);

  // Actualizar contador
  const contador = document.getElementById("inv-resultado-count");
  if (contador)
    contador.textContent = `${resultado.length} producto${resultado.length !== 1 ? "s" : ""}`;

  // Actualizar badge de filtros activos
  const activos = Object.values(filtrosInventario).filter(
    (v) => v !== "",
  ).length;
  const badge = document.getElementById("inv-filtros-badge");
  if (badge) {
    badge.textContent = activos;
    badge.style.display = activos > 0 ? "inline-flex" : "none";
  }
}

/**
 * Limpia todos los filtros del inventario.
 */
function limpiarFiltrosInventario() {
  filtrosInventario = { busqueda: "", tipo: "", estado: "" };
  const campos = ["inv-search-input", "inv-filtro-tipo", "inv-filtro-estado"];
  campos.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  aplicarFiltrosInventario();
  showToast("Filtros limpiados", "info");
}

/**
 * Retorna el cache del inventario para uso externo (autocompletado).
 */
function getInventarioCache() {
  return inventarioCache;
}

/**
 * Renderiza la tabla de inventario.
 * @param {Array} productos - Lista de productos a mostrar
 */
function renderizarInventario(productos) {
  const tbody = document.getElementById("tabla-inventario-body");
  if (!tbody) return;

  if (!productos || productos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          <div class="empty-icon">🎵</div>
          <p>No hay productos en el inventario</p>
          <span>Agrega tu primer producto con el botón "+ Agregar Producto"</span>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = productos
    .map((p) => {
      const id = String(p.id_producto || "");
      const artista = String(p.artista || "—");
      const tipo = String(p.tipo_producto || "—");
      const nombre = String(p.nombre_producto || "—");
      const unidades = parseInt(p.unidades_disponibles) || 0;
      const costo = parseFloat(p.costo_unitario) || 0;
      const pvp = parseFloat(p.precio_venta_sugerido) || 0;
      const estado = String(p.estado || "—");
      const nota = String(p.nota || "");

      const nombreEsc = nombre.replace(/'/g, "\\'");

      return `
    <tr class="table-row" data-id="${id}">
      <td>
        <span class="product-name">${nombre}</span>
        <span class="artist-name">${artista}</span>
      </td>
      <td><span class="product-type">${tipo}</span></td>
      <td>
        <div class="stock-cell">
          <span class="stock-number ${unidades <= 0 ? "stock-zero" : unidades <= 3 ? "stock-low" : "stock-ok"}">${unidades}</span>
          <span class="stock-label">uds.</span>
        </div>
      </td>
      <td><span class="price-value">${formatCurrency(costo)}</span></td>
      <td><span class="price-value">${formatCurrency(pvp)}</span></td>
      <td>${getEstadoStockBadge(estado)}</td>
      <td><span class="nota-text">${nota || "—"}</span></td>
      <td>
        <div class="action-buttons">
          <button class="btn-action btn-stock-in"  onclick="abrirAjusteStock('${id}', '${nombreEsc}', 'entrada')" title="Entrada de stock">＋</button>
          <button class="btn-action btn-stock-out" onclick="abrirAjusteStock('${id}', '${nombreEsc}', 'salida')"  title="Salida de stock">－</button>
          <button class="btn-action btn-edit"      onclick="editarProducto('${id}')"                              title="Editar producto"><i class="fa-solid fa-pen-to-square" style="color: white;"></i></button>
          <button class="btn-action btn-delete"    onclick="confirmarEliminarProducto('${id}', '${nombreEsc}')"   title="Eliminar producto"><i class="fa-solid fa-trash" style="color: white;"></i></button>
        </div>
      </td>
    </tr>
    `;
    })
    .join("");
}

/**
 * Actualiza las tarjetas de estadísticas del inventario.
 * @param {Array} productos
 */
function actualizarStatsInventario(productos) {
  const total = productos.length;
  const disponibles = productos.filter((p) => p.estado === "Disponible").length;
  const bajoStock = productos.filter((p) => p.estado === "Stock bajo").length;
  const agotados = productos.filter((p) => p.estado === "Agotado").length;
  const totalUnidades = productos.reduce(
    (acc, p) => acc + (parseInt(p.unidades_disponibles) || 0),
    0,
  );

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  set("inv-stat-total", total);
  set("inv-stat-disponible", disponibles);
  set("inv-stat-bajo", bajoStock);
  set("inv-stat-agotado", agotados);
  set("inv-stat-unidades", totalUnidades);
}

// ============================================================
// MODAL DE PRODUCTO
// ============================================================

/**
 * Abre el modal para crear o editar un producto.
 * @param {Object|null} producto - Si se pasa, modo edición
 */
function abrirModalProducto(producto = null) {
  const modal = document.getElementById("producto-modal");
  const form = document.getElementById("producto-form");
  const titulo = document.getElementById("producto-modal-title");
  if (!modal || !form) return;

  form.reset();
  document.getElementById("producto-id").value = "";

  if (producto) {
    titulo.textContent = "Editar Producto";
    document.getElementById("producto-id").value = producto.id_producto || "";
    document.getElementById("pf-artista").value = producto.artista || "";
    document.getElementById("pf-tipo").value = producto.tipo_producto || "";
    document.getElementById("pf-nombre").value = producto.nombre_producto || "";
    document.getElementById("pf-unidades").value =
      producto.unidades_disponibles || 0;
    document.getElementById("pf-costo").value = producto.costo_unitario || "";
    document.getElementById("pf-pvp").value =
      producto.precio_venta_sugerido || "";
    document.getElementById("pf-nota").value = producto.nota || "";
  } else {
    titulo.textContent = "Agregar Producto";
  }

  modal.classList.add("modal-visible");
}

function cerrarModalProducto() {
  const modal = document.getElementById("producto-modal");
  if (modal) modal.classList.remove("modal-visible");
}

/**
 * Guarda el producto (crear o actualizar).
 */
async function guardarProducto() {
  const idExistente = document.getElementById("producto-id").value;
  const esEdicion = Boolean(idExistente);

  const nombre = document.getElementById("pf-nombre").value.trim();
  const artista = document.getElementById("pf-artista").value.trim();
  if (!nombre || !artista) {
    showToast("Nombre y artista son requeridos", "warning");
    return;
  }

  const datos = {
    artista,
    tipo_producto: document.getElementById("pf-tipo").value,
    nombre_producto: nombre,
    unidades_disponibles: document.getElementById("pf-unidades").value || "0",
    costo_unitario: document.getElementById("pf-costo").value || "0",
    precio_venta_sugerido: document.getElementById("pf-pvp").value || "0",
    nota: document.getElementById("pf-nota").value.trim(),
  };

  if (esEdicion) datos.id_producto = idExistente;

  const action = esEdicion ? "updateProducto" : "createProducto";
  showLoader(esEdicion ? "Actualizando producto..." : "Agregando producto...");

  try {
    await apiRequest({ action, ...datos });
    showToast(
      esEdicion ? "Producto actualizado ✓" : "Producto agregado ✓",
      "success",
    );
    cerrarModalProducto();
    await cargarInventario();
  } catch (error) {
    showToast("Error: " + error.message, "error");
  } finally {
    hideLoader();
  }
}

// ============================================================
// EDITAR PRODUCTO
// ============================================================

function editarProducto(idProducto) {
  const producto = inventarioCache.find(
    (p) => String(p.id_producto) === String(idProducto),
  );
  if (!producto) {
    showToast("Producto no encontrado", "error");
    return;
  }
  abrirModalProducto(producto);
}

// ============================================================
// AJUSTE DE STOCK (ENTRADA / SALIDA)
// ============================================================

/**
 * Abre el modal de ajuste de stock para un producto.
 * @param {string} idProducto
 * @param {string} nombreProducto
 * @param {string} tipo - 'entrada' | 'salida'
 */
function abrirAjusteStock(idProducto, nombreProducto, tipo) {
  const modal = document.getElementById("ajuste-modal");
  if (!modal) return;

  document.getElementById("ajuste-id").value = idProducto;
  document.getElementById("ajuste-tipo").value = tipo;
  document.getElementById("ajuste-cantidad").value = "";
  document.getElementById("ajuste-nombre").textContent = nombreProducto;
  document.getElementById("ajuste-modal-title").textContent =
    tipo === "entrada" ? "➕ Entrada de Stock" : "➖ Salida de Stock";
  document.getElementById("ajuste-btn-confirm").textContent =
    tipo === "entrada" ? "Agregar unidades" : "Descontar unidades";

  modal.classList.add("modal-visible");
}

function cerrarAjusteModal() {
  const modal = document.getElementById("ajuste-modal");
  if (modal) modal.classList.remove("modal-visible");
}

/**
 * Confirma el ajuste de stock y lo envía al backend.
 */
async function confirmarAjusteStock() {
  const id = document.getElementById("ajuste-id").value;
  const tipo = document.getElementById("ajuste-tipo").value;
  const cantidad = parseInt(document.getElementById("ajuste-cantidad").value);

  if (!cantidad || cantidad <= 0) {
    showToast("Ingresa una cantidad válida", "warning");
    return;
  }

  showLoader("Actualizando stock...");
  try {
    const res = await apiRequest({
      action: "ajustarStock",
      id_producto: id,
      cantidad,
      tipo,
    });
    showToast(res.message || "Stock actualizado ✓", "success");
    cerrarAjusteModal();
    await cargarInventario();
  } catch (error) {
    showToast("Error: " + error.message, "error");
  } finally {
    hideLoader();
  }
}

// ============================================================
// ELIMINAR PRODUCTO
// ============================================================

async function confirmarEliminarProducto(idProducto, nombre) {
  const confirmado = await showConfirm(
    "Eliminar Producto",
    `¿Estás seguro de eliminar "${nombre}" del inventario? Esta acción no se puede deshacer.`,
    "Eliminar",
  );
  if (confirmado) {
    showLoader("Eliminando producto...");
    try {
      await apiRequest({ action: "deleteProducto", id_producto: idProducto });
      showToast("Producto eliminado ✓", "success");
      await cargarInventario();
    } catch (error) {
      showToast("Error: " + error.message, "error");
    } finally {
      hideLoader();
    }
  }
}

// ============================================================
// UTILIDADES
// ============================================================

/**
 * Retorna el badge HTML para el estado del stock.
 * @param {string} estado - 'Disponible' | 'Stock bajo' | 'Agotado'
 */
function getEstadoStockBadge(estado) {
  const clases = {
    Disponible: "badge-delivered",
    "Stock bajo": "badge-customs",
    Agotado: "badge-error",
  };
  return `<span class="badge ${clases[estado] || "badge-default"}">${estado}</span>`;
}
// ============================================================
// AUTOCOMPLETADO EN FORMULARIO DE PEDIDO
// ============================================================

/**
 * Inicializa el autocompletado del campo "buscar producto"
 * en el formulario de nuevo/editar pedido.
 * Filtra el inventario en tiempo real y al seleccionar
 * rellena artista, tipo y nombre del producto automáticamente.
 */
function initAutocompletadoProducto() {
  const input = document.getElementById("f-buscar-producto");
  const dropdown = document.getElementById("autocomplete-dropdown");
  if (!input || !dropdown) return;

  input.addEventListener(
    "input",
    debounce(function () {
      const query = this.value.toLowerCase().trim();

      // Cerrar si el campo está vacío
      if (!query) {
        cerrarDropdown();
        return;
      }

      // Filtrar inventario por nombre o artista
      const resultados = getInventarioCache()
        .filter(
          (p) =>
            String(p.nombre_producto || "")
              .toLowerCase()
              .includes(query) ||
            String(p.artista || "")
              .toLowerCase()
              .includes(query),
        )
        .slice(0, 8); // Máximo 8 sugerencias

      if (resultados.length === 0) {
        dropdown.innerHTML = `<div class="autocomplete-empty">Sin resultados en inventario</div>`;
        dropdown.classList.add("dropdown-open");
        return;
      }

      // Renderizar sugerencias
      dropdown.innerHTML = resultados
        .map((p) => {
          const unidades = parseInt(p.unidades_disponibles) || 0;
          const estadoClass =
            unidades <= 0 ? "ac-agotado" : unidades <= 3 ? "ac-bajo" : "ac-ok";
          const estadoText = unidades <= 0 ? "Agotado" : `${unidades} uds.`;
          return `
        <div class="autocomplete-item" onclick="seleccionarProductoInventario(${JSON.stringify(p).replace(/"/g, "&quot;")})">
          <div class="ac-info">
            <span class="ac-nombre">${p.nombre_producto || "—"}</span>
            <span class="ac-artista">${p.artista || ""} · ${p.tipo_producto || ""}</span>
          </div>
          <span class="ac-stock ${estadoClass}">${estadoText}</span>
        </div>
      `;
        })
        .join("");

      dropdown.classList.add("dropdown-open");
    }, 250),
  );

  // Cerrar al hacer click fuera
  document.addEventListener("click", function (e) {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      cerrarDropdown();
    }
  });
}

/**
 * Rellena los campos del formulario con los datos del producto seleccionado.
 * @param {Object} producto - Producto del inventario
 */
function seleccionarProductoInventario(producto) {
  // Llenar campos automáticamente
  const nombre = document.getElementById("f-nombre-producto");
  const artista = document.getElementById("f-artista");
  const tipo = document.getElementById("f-tipo-producto");

  if (nombre) nombre.value = producto.nombre_producto || "";
  if (artista) artista.value = producto.artista || "";
  if (tipo) tipo.value = producto.tipo_producto || "";

  // También llenar precio de venta sugerido si está vacío
  // Llenar precio de venta y precio de compra
  const pvp = document.getElementById("f-precio-venta");
  if (pvp && !pvp.value && producto.precio_venta_sugerido) {
    pvp.value = producto.precio_venta_sugerido;
  }

  const precioCompra = document.getElementById("f-precio-compra");
  if (precioCompra && !precioCompra.value && producto.costo_unitario) {
    precioCompra.value = producto.costo_unitario;
  }

  calcularTotales();

  // Limpiar el buscador y cerrar dropdown
  const input = document.getElementById("f-buscar-producto");
  if (input) input.value = "";
  cerrarDropdown();

  showToast(`Producto seleccionado: ${producto.nombre_producto}`, "info");
}

function cerrarDropdown() {
  const dropdown = document.getElementById("autocomplete-dropdown");
  if (dropdown) {
    dropdown.classList.remove("dropdown-open");
    dropdown.innerHTML = "";
  }
}

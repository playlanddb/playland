/**
 * api.js - Módulo de conexión con Google Apps Script
 * 
 * Este archivo maneja toda la comunicación entre el frontend
 * y el backend (Google Apps Script Web App).
 * 
 * CONFIGURACIÓN INICIAL:
 * Después de hacer Deploy del Web App en Apps Script,
 * reemplazar el valor de API_URL con la URL generada.
 */

// ============================================================
// CONFIGURACIÓN - CAMBIAR ESTA URL DESPUÉS DEL DEPLOY
// ============================================================

/**
 * URL del Web App de Google Apps Script.
 * Reemplazar con la URL real después de hacer el deploy.
 * Ejemplo: https://script.google.com/macros/s/AKfycb.../exec
 */
const API_URL = "https://script.google.com/macros/s/AKfycbyzdYHMBLeDlVsH5kYshaBXzV4ycVVheNe0Y7fNXDqTYEXbxXOBF23MCittOa-r6JNd-A/exec";

// ============================================================
// CLIENTE HTTP BASE
// ============================================================

/**
 * Realiza una petición GET al backend de Apps Script.
 * Google Apps Script solo acepta GET en Web Apps públicas,
 * por eso todos los parámetros se envían por query string.
 * 
 * @param {Object} params - Parámetros a enviar al backend
 * @returns {Promise<Object>} Respuesta del servidor
 */
async function apiRequest(params) {
  // Verificar que la URL fue configurada
  if (!API_URL || API_URL.includes('PEGAR_URL')) {
    throw new Error('⚠️ La URL del backend no está configurada. Abre api.js y reemplaza API_URL con tu URL de Apps Script.');
  }

  // Construir URL con query parameters
  const queryString = Object.entries(params)
    .map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`)
    .join('&');

  const url = `${API_URL}?${queryString}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow', // Apps Script puede redirigir
    });

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Error desconocido del servidor');
    }

    return data;
  } catch (error) {
    // Re-lanzar errores con contexto adicional
    if (error.message.includes('fetch')) {
      throw new Error('No se pudo conectar con el servidor. Verifica tu conexión o la URL del backend.');
    }
    throw error;
  }
}

// ============================================================
// ENDPOINTS DE PEDIDOS
// ============================================================

/**
 * Obtiene todos los pedidos desde Google Sheets.
 * @returns {Promise<Array>} Lista de pedidos
 */
async function apiGetPedidos() {
  const response = await apiRequest({ action: 'getPedidos' });
  return response.data || [];
}

/**
 * Crea un nuevo pedido en Google Sheets.
 * @param {Object} pedidoData - Datos del nuevo pedido
 * @returns {Promise<Object>} Pedido creado
 */
async function apiCreatePedido(pedidoData) {
  return await apiRequest({ action: 'createPedido', ...pedidoData });
}

/**
 * Actualiza un pedido existente en Google Sheets.
 * @param {Object} pedidoData - Datos actualizados (debe incluir id_pedido)
 * @returns {Promise<Object>} Respuesta del servidor
 */
async function apiUpdatePedido(pedidoData) {
  return await apiRequest({ action: 'updatePedido', ...pedidoData });
}

/**
 * Elimina un pedido de Google Sheets.
 * @param {string} idPedido - ID único del pedido a eliminar
 * @returns {Promise<Object>} Respuesta del servidor
 */
async function apiDeletePedido(idPedido) {
  return await apiRequest({ action: 'deletePedido', id_pedido: idPedido });
}

/**
 * Obtiene las estadísticas del dashboard desde el backend.
 * @returns {Promise<Object>} Estadísticas calculadas
 */
async function apiGetDashboard() {
  const response = await apiRequest({ action: 'getDashboard' });
  return response.stats || {};
}

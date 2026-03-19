/**
 * auth.js - Sistema de autenticación y control de roles
 *
 * ROLES:
 * - ventas: Crear y ver pedidos. Sin inventario, sin ganancias, sin eliminar.
 * - admin:  Acceso total.
 *
 * NOTA: Login de frontend — no es seguridad real.
 * Para producción usar Netlify Identity.
 */

// ============================================================
// CREDENCIALES
// ============================================================

const USUARIOS = [
  { usuario: 'Ventasplayland01', password: 'play123@music',      rol: 'ventas', nombre: 'Ventas'   },
  { usuario: 'Adminplayland',    password: 'adminplay123@music', rol: 'admin',  nombre: 'Admin'    }
];

let sesionActual = null;

// ============================================================
// INICIALIZACIÓN — verificar sesión guardada
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const guardada = sessionStorage.getItem('playland_sesion');

  if (guardada) {
    try {
      sesionActual = JSON.parse(guardada);
      mostrarApp();
    } catch {
      mostrarLogin();
    }
  } else {
    mostrarLogin();
  }

  // Enter en campos de login
  ['login-usuario', 'login-password'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') intentarLogin();
    });
  });
});

// ============================================================
// LOGIN
// ============================================================

function intentarLogin() {
  const usuario  = document.getElementById('login-usuario')?.value.trim();
  const password = document.getElementById('login-password')?.value;

  if (!usuario || !password) {
    mostrarErrorLogin('Completa usuario y contraseña');
    return;
  }

  const encontrado = USUARIOS.find(u => u.usuario === usuario && u.password === password);

  if (!encontrado) {
    mostrarErrorLogin('Usuario o contraseña incorrectos');
    document.querySelector('.login-card')?.classList.add('login-shake');
    setTimeout(() => document.querySelector('.login-card')?.classList.remove('login-shake'), 500);
    return;
  }

  sesionActual = { usuario: encontrado.usuario, rol: encontrado.rol, nombre: encontrado.nombre };
  sessionStorage.setItem('playland_sesion', JSON.stringify(sesionActual));
  document.getElementById('login-error').style.display = 'none';
  mostrarApp();
}

function mostrarErrorLogin(msg) {
  const el = document.getElementById('login-error');
  if (el) { el.textContent = msg; el.style.display = 'flex'; }
}

function togglePasswordVisibility() {
  const input = document.getElementById('login-password');
  const icon  = document.getElementById('pass-icon');
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    icon?.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    input.type = 'password';
    icon?.classList.replace('fa-eye-slash', 'fa-eye');
  }
}

// ============================================================
// LOGOUT
// ============================================================

function cerrarSesion() {
  sesionActual = null;
  sessionStorage.removeItem('playland_sesion');
  document.getElementById('login-usuario').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').style.display = 'none';
  mostrarLogin();
}

// ============================================================
// PANTALLAS
// ============================================================

function mostrarLogin() {
  const loginScreen = document.getElementById('login-screen');
  const appLayout   = document.querySelector('.app-layout');
  loginScreen.style.display  = 'flex';
  loginScreen.style.opacity  = '1';
  loginScreen.style.transition = 'opacity 0.3s ease';
  appLayout.style.display    = 'none';
}

function mostrarApp() {
  const loginScreen = document.getElementById('login-screen');
  const appLayout   = document.querySelector('.app-layout');

  loginScreen.style.transition = 'opacity 0.3s ease';
  loginScreen.style.opacity    = '0';

  setTimeout(() => {
    loginScreen.style.display = 'none';
    appLayout.style.display   = 'flex';
    aplicarRol(sesionActual.rol);
  }, 300);
}

// ============================================================
// ROLES
// ============================================================

function aplicarRol(rol) {
  // Badge en header
  const badge = document.getElementById('role-badge');
  if (badge) {
    badge.textContent = sesionActual.nombre;
    badge.className   = `role-badge role-${rol}`;
  }

  // Eliminar restricciones anteriores si las hubiera
  document.getElementById('ventas-restrictions')?.remove();

  // Restaurar visibilidad del menú inventario (por si estaba oculto)
  document.querySelectorAll('[data-section="inventario"]').forEach(el => {
    el.style.display = '';
  });

  if (rol === 'admin') return; // Admin ve todo

  if (rol === 'ventas') {
    // Ocultar nav de inventario
    document.querySelectorAll('[data-section="inventario"]').forEach(el => {
      el.style.display = 'none';
    });

    // Inyectar CSS con restricciones
    const style = document.createElement('style');
    style.id = 'ventas-restrictions';
    style.textContent = `
      #section-pedidos .orders-table th:nth-child(7),
      #section-pedidos .orders-table td[data-label="Ganancia"] { display: none !important; }
      .btn-delete { display: none !important; }
      #section-inventario { display: none !important; }
    `;
    document.head.appendChild(style);

    // Si estaba en inventario, ir a pedidos
    if (document.getElementById('section-inventario')?.classList.contains('section-active')) {
      mostrarSeccion('pedidos');
    }
  }
}

function getRolActual() {
  return sesionActual?.rol || null;
}
// admin.js — panel privado de gestión de leads (CRM básico)

const SUPABASE_URL = "https://uagmlfssbixytierxdib.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_8FvlGTc8ICk04jqAH0yzzg_Q84Jp1UQ";

const loginSection = document.getElementById('admin-login');
const dashboardSection = document.getElementById('admin-dashboard');
const loginForm = document.getElementById('login-form');
const loginStatus = document.getElementById('login-status');
const dashboardStatus = document.getElementById('dashboard-status');
const tablaBody = document.getElementById('tabla-leads-body');
const filtroStatus = document.getElementById('filtro-status');
const logoutBtn = document.getElementById('logout-btn');
const refrescarBtn = document.getElementById('refrescar-btn');

const ETIQUETAS_ESTADO = {
  new: 'Nuevo',
  contacted: 'Contactado',
  qualified: 'Cualificado',
  won: 'Ganado',
  lost: 'Perdido',
};

// --- Sesión ---
function getToken() {
  return sessionStorage.getItem('admin-token');
}

function setToken(token) {
  sessionStorage.setItem('admin-token', token);
}

function clearToken() {
  sessionStorage.removeItem('admin-token');
}

function mostrarDashboard() {
  loginSection.hidden = true;
  dashboardSection.hidden = false;
  cargarLeads();
}

function mostrarLogin() {
  loginSection.hidden = false;
  dashboardSection.hidden = true;
}

// --- Login ---
loginForm.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  loginStatus.textContent = 'Comprobando…';
  loginStatus.className = 'form-status';

  try {
    const respuesta = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    });

    const datos = await respuesta.json();

    if (!respuesta.ok || !datos.access_token) {
      throw new Error(datos.error_description || datos.msg || 'Credenciales incorrectas');
    }

    setToken(datos.access_token);
    loginStatus.textContent = '';
    mostrarDashboard();
  } catch (error) {
    loginStatus.textContent = 'No se pudo entrar: ' + error.message;
    loginStatus.className = 'form-status error';
  }
});

// --- Logout ---
logoutBtn.addEventListener('click', () => {
  clearToken();
  mostrarLogin();
});

// --- Cargar leads ---
async function cargarLeads() {
  const token = getToken();
  if (!token) {
    mostrarLogin();
    return;
  }

  dashboardStatus.textContent = 'Cargando…';
  dashboardStatus.className = 'form-status';

  const filtro = filtroStatus.value;
  let url = `${SUPABASE_URL}/rest/v1/leads?select=*&order=created_at.desc`;
  if (filtro) {
    url += `&status=eq.${filtro}`;
  }

  try {
    const respuesta = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
      },
    });

    if (respuesta.status === 401) {
      clearToken();
      mostrarLogin();
      loginStatus.textContent = 'Tu sesión ha caducado, entra de nuevo.';
      loginStatus.className = 'form-status error';
      return;
    }

    if (!respuesta.ok) {
      throw new Error(`Error ${respuesta.status}`);
    }

    const leads = await respuesta.json();
    renderLeads(leads);
    dashboardStatus.textContent = `${leads.length} lead(s)`;
    dashboardStatus.className = 'form-status ok';
  } catch (error) {
    dashboardStatus.textContent = 'Error al cargar: ' + error.message;
    dashboardStatus.className = 'form-status error';
  }
}

function renderLeads(leads) {
  tablaBody.innerHTML = '';

  leads.forEach((lead) => {
    const fila = document.createElement('tr');

    const fecha = new Date(lead.created_at).toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });

    fila.innerHTML = `
      <td>${fecha}</td>
      <td>${escapeHtml(lead.full_name)}</td>
      <td>${escapeHtml(lead.email)}${lead.phone ? '<br><span class="admin-tel">' + escapeHtml(lead.phone) + '</span>' : ''}</td>
      <td>${escapeHtml(lead.country)}</td>
      <td>${escapeHtml(lead.budget_range)}</td>
      <td>${escapeHtml(lead.region_interest)}</td>
      <td>${escapeHtml(lead.timeframe)}</td>
      <td>${lead.owns_property_spain ? (lead.properties_count ?? '–') : '—'}</td>
      <td></td>
      <td></td>
    `;

    // Selector de estado
    const celdaEstado = fila.children[8];
    const selectEstado = document.createElement('select');
    Object.entries(ETIQUETAS_ESTADO).forEach(([valor, etiqueta]) => {
      const opcion = document.createElement('option');
      opcion.value = valor;
      opcion.textContent = etiqueta;
      if (valor === lead.status) opcion.selected = true;
      selectEstado.appendChild(opcion);
    });
    selectEstado.addEventListener('change', () => {
      actualizarLead(lead.id, { status: selectEstado.value });
    });
    celdaEstado.appendChild(selectEstado);

    // Notas
    const celdaNotas = fila.children[9];
    const textareaNotas = document.createElement('textarea');
    textareaNotas.className = 'admin-notas';
    textareaNotas.value = lead.notes || '';
    textareaNotas.rows = 2;
    let temporizador;
    textareaNotas.addEventListener('input', () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        actualizarLead(lead.id, { notes: textareaNotas.value });
      }, 800); // guarda 0.8s después de dejar de escribir
    });
    celdaNotas.appendChild(textareaNotas);

    tablaBody.appendChild(fila);
  });
}

async function actualizarLead(id, cambios) {
  const token = getToken();
  try {
    const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(cambios),
    });
    if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
  } catch (error) {
    dashboardStatus.textContent = 'No se pudo guardar el cambio: ' + error.message;
    dashboardStatus.className = 'form-status error';
  }
}

function escapeHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

filtroStatus.addEventListener('change', cargarLeads);
refrescarBtn.addEventListener('click', cargarLeads);

// --- Al cargar la página, ¿ya había sesión? ---
if (getToken()) {
  mostrarDashboard();
} else {
  mostrarLogin();
}

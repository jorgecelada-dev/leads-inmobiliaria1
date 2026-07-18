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
const filtroPresupuesto = document.getElementById('filtro-presupuesto');
const filtroZona = document.getElementById('filtro-zona');
const filtroPlazo = document.getElementById('filtro-plazo');
const filtroPropiedadesMin = document.getElementById('filtro-propiedades-min');
const filtroPropiedadesMax = document.getElementById('filtro-propiedades-max');
const limpiarFiltrosBtn = document.getElementById('limpiar-filtros-btn');
const logoutBtn = document.getElementById('logout-btn');
const refrescarBtn = document.getElementById('refrescar-btn');
const nuevoLeadBtn = document.getElementById('nuevo-lead-btn');
const leadNuevoForm = document.getElementById('lead-nuevo-form');
const crearLeadForm = document.getElementById('crear-lead-form');
const crearLeadStatus = document.getElementById('crear-lead-status');
const cancelarLeadBtn = document.getElementById('cancelar-lead-btn');

const ETIQUETAS_ESTADO = {
  new: 'Nuevo',
  contacted: 'Contactado',
  qualified: 'Cualificado',
  won: 'Ganado',
  lost: 'Perdido',
  blacklisted: 'Lista negra',
};

// Mismas opciones que el formulario público (index.html), en español para el panel.
const OPCIONES_PRESUPUESTO = [
  ['<200k', '< €200.000'],
  ['200k-500k', '€200.000 – €500.000'],
  ['500k-1m', '€500.000 – €1.000.000'],
  ['1m-2m', '€1.000.000 – €2.000.000'],
  ['2m-5m', '€2.000.000 – €5.000.000'],
  ['5m+', '€5.000.000+'],
];

const OPCIONES_ZONA = [
  ['costa-del-sol', 'Costa del Sol'],
  ['madrid', 'Madrid'],
  ['barcelona', 'Barcelona'],
  ['baleares', 'Islas Baleares'],
  ['costa-blanca', 'Costa Blanca'],
  ['canarias', 'Islas Canarias'],
  ['otra', 'Otra'],
];

const OPCIONES_PLAZO = [
  ['immediate', 'Inmediato (0–3 meses)'],
  ['3-6', '3–6 meses'],
  ['6-12', '6–12 meses'],
  ['exploring', 'Solo explorando'],
];

// Caché de perfiles de trabajadores: { [id_usuario]: nombre }
let perfilesPorId = {};

// Rellena los <select> de filtro reutilizando las mismas listas de opciones
// que usa la tabla, para no duplicar los valores en dos sitios distintos.
function poblarSelectDeFiltro(select, opciones) {
  opciones.forEach(([valor, etiqueta]) => {
    const opcion = document.createElement('option');
    opcion.value = valor;
    opcion.textContent = etiqueta;
    select.appendChild(opcion);
  });
}
poblarSelectDeFiltro(filtroPresupuesto, OPCIONES_PRESUPUESTO);
poblarSelectDeFiltro(filtroZona, OPCIONES_ZONA);
poblarSelectDeFiltro(filtroPlazo, OPCIONES_PLAZO);

// --- Formulario de alta manual de lead ---
function poblarSelectConPlaceholder(select, opciones) {
  const vacio = document.createElement('option');
  vacio.value = '';
  vacio.textContent = 'Selecciona…';
  select.appendChild(vacio);
  poblarSelectDeFiltro(select, opciones);
}
poblarSelectConPlaceholder(document.getElementById('nl-presupuesto'), OPCIONES_PRESUPUESTO);
poblarSelectConPlaceholder(document.getElementById('nl-zona'), OPCIONES_ZONA);
poblarSelectConPlaceholder(document.getElementById('nl-plazo'), OPCIONES_PLAZO);

nuevoLeadBtn.addEventListener('click', () => {
  crearLeadForm.reset();
  crearLeadStatus.textContent = '';
  leadNuevoForm.hidden = false;
  leadNuevoForm.scrollIntoView({ behavior: 'smooth' });
});

cancelarLeadBtn.addEventListener('click', () => {
  leadNuevoForm.hidden = true;
});

crearLeadForm.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  crearLeadStatus.textContent = 'Guardando…';
  crearLeadStatus.className = 'form-status';

  const propiedades = document.getElementById('nl-propiedades').value;
  const datos = {
    full_name: document.getElementById('nl-nombre').value,
    email: document.getElementById('nl-email').value,
    phone: document.getElementById('nl-telefono').value || null,
    country: document.getElementById('nl-pais').value,
    owns_property_spain: Boolean(propiedades) && Number(propiedades) > 0,
    properties_count: propiedades ? Number(propiedades) : null,
    budget_range: document.getElementById('nl-presupuesto').value,
    region_interest: document.getElementById('nl-zona').value,
    timeframe: document.getElementById('nl-plazo').value,
    source: 'panel-manual',
  };

  try {
    const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${getToken()}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(datos),
    });
    if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
    leadNuevoForm.hidden = true;
    cargarLeads();
  } catch (error) {
    crearLeadStatus.textContent = 'Error al guardar: ' + error.message;
    crearLeadStatus.className = 'form-status error';
  }
});

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

// --- Cargar perfiles de trabajadores (para mostrar nombre en "Última edición") ---
async function cargarPerfiles() {
  const token = getToken();
  try {
    const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,full_name`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!respuesta.ok) return;
    const perfiles = await respuesta.json();
    perfilesPorId = Object.fromEntries(perfiles.map((p) => [p.id, p.full_name]));
  } catch (error) {
    console.error('No se pudieron cargar los perfiles de trabajadores:', error);
  }
}

// --- Construir la URL de leads a partir de todos los filtros activos ---
function construirUrlLeads() {
  const params = new URLSearchParams();
  params.set('select', '*');
  params.set('order', 'created_at.desc');
  if (filtroStatus.value) params.append('status', `eq.${filtroStatus.value}`);
  if (filtroPresupuesto.value) params.append('budget_range', `eq.${filtroPresupuesto.value}`);
  if (filtroZona.value) params.append('region_interest', `eq.${filtroZona.value}`);
  if (filtroPlazo.value) params.append('timeframe', `eq.${filtroPlazo.value}`);
  if (filtroPropiedadesMin.value) params.append('properties_count', `gte.${filtroPropiedadesMin.value}`);
  if (filtroPropiedadesMax.value) params.append('properties_count', `lte.${filtroPropiedadesMax.value}`);
  return `${SUPABASE_URL}/rest/v1/leads?${params.toString()}`;
}

// --- Cargar leads ---
async function cargarLeads() {
  const token = getToken();
  if (!token) {
    mostrarLogin();
    return;
  }

  dashboardStatus.textContent = 'Cargando…';
  dashboardStatus.className = 'form-status';

  const url = construirUrlLeads();

  try {
    await cargarPerfiles();

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

// --- Helpers para construir celdas editables ---
function crearInputTexto(valorInicial, tipo, onGuardar) {
  const input = document.createElement('input');
  input.type = tipo;
  input.value = valorInicial ?? '';
  input.className = 'admin-input';
  let temporizador;
  input.addEventListener('input', () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => onGuardar(input.value || null), 800);
  });
  return input;
}

function crearSelect(opciones, valorInicial, onGuardar) {
  const select = document.createElement('select');
  opciones.forEach(([valor, etiqueta]) => {
    const opcion = document.createElement('option');
    opcion.value = valor;
    opcion.textContent = etiqueta;
    if (valor === valorInicial) opcion.selected = true;
    select.appendChild(opcion);
  });
  select.addEventListener('change', () => onGuardar(select.value));
  return select;
}

function formatearFechaHora(fechaIso) {
  return new Date(fechaIso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function renderLeads(leads) {
  tablaBody.innerHTML = '';

  leads.forEach((lead) => {
    const fila = document.createElement('tr');
    const fecha = formatearFechaHora(lead.created_at).split(',')[0];
    fila.innerHTML = `<td>${fecha}</td>`;

    // Nombre
    const celdaNombre = document.createElement('td');
    celdaNombre.appendChild(
      crearInputTexto(lead.full_name, 'text', (valor) => actualizarLead(lead.id, { full_name: valor })),
    );
    fila.appendChild(celdaNombre);

    // Contacto: email + teléfono
    const celdaContacto = document.createElement('td');
    celdaContacto.appendChild(
      crearInputTexto(lead.email, 'email', (valor) => actualizarLead(lead.id, { email: valor })),
    );
    const inputTelefono = crearInputTexto(lead.phone, 'tel', (valor) => actualizarLead(lead.id, { phone: valor }));
    inputTelefono.placeholder = 'Teléfono';
    celdaContacto.appendChild(inputTelefono);
    fila.appendChild(celdaContacto);

    // País
    const celdaPais = document.createElement('td');
    celdaPais.appendChild(
      crearInputTexto(lead.country, 'text', (valor) => actualizarLead(lead.id, { country: valor })),
    );
    fila.appendChild(celdaPais);

    // Presupuesto
    const celdaPresupuesto = document.createElement('td');
    celdaPresupuesto.appendChild(
      crearSelect(OPCIONES_PRESUPUESTO, lead.budget_range, (valor) => actualizarLead(lead.id, { budget_range: valor })),
    );
    fila.appendChild(celdaPresupuesto);

    // Zona
    const celdaZona = document.createElement('td');
    celdaZona.appendChild(
      crearSelect(OPCIONES_ZONA, lead.region_interest, (valor) => actualizarLead(lead.id, { region_interest: valor })),
    );
    fila.appendChild(celdaZona);

    // Plazo
    const celdaPlazo = document.createElement('td');
    celdaPlazo.appendChild(
      crearSelect(OPCIONES_PLAZO, lead.timeframe, (valor) => actualizarLead(lead.id, { timeframe: valor })),
    );
    fila.appendChild(celdaPlazo);

    // Propiedades: checkbox "posee" + nº de propiedades
    const celdaPropiedades = document.createElement('td');
    const checkboxPosee = document.createElement('input');
    checkboxPosee.type = 'checkbox';
    checkboxPosee.checked = Boolean(lead.owns_property_spain);
    const inputCantidad = document.createElement('input');
    inputCantidad.type = 'number';
    inputCantidad.min = '1';
    inputCantidad.className = 'admin-input admin-input-num';
    inputCantidad.value = lead.properties_count ?? '';
    inputCantidad.disabled = !checkboxPosee.checked;
    checkboxPosee.addEventListener('change', () => {
      inputCantidad.disabled = !checkboxPosee.checked;
      if (!checkboxPosee.checked) {
        inputCantidad.value = '';
        actualizarLead(lead.id, { owns_property_spain: false, properties_count: null });
      } else {
        actualizarLead(lead.id, { owns_property_spain: true });
      }
    });
    let temporizadorCantidad;
    inputCantidad.addEventListener('input', () => {
      clearTimeout(temporizadorCantidad);
      temporizadorCantidad = setTimeout(() => {
        actualizarLead(lead.id, { properties_count: inputCantidad.value ? Number(inputCantidad.value) : null });
      }, 800);
    });
    celdaPropiedades.appendChild(checkboxPosee);
    celdaPropiedades.appendChild(inputCantidad);
    fila.appendChild(celdaPropiedades);

    // Estado
    const celdaEstado = document.createElement('td');
    celdaEstado.appendChild(
      crearSelect(
        Object.entries(ETIQUETAS_ESTADO),
        lead.status,
        (valor) => actualizarLead(lead.id, { status: valor }),
      ),
    );
    fila.appendChild(celdaEstado);

    // Notas
    const celdaNotas = document.createElement('td');
    const textareaNotas = document.createElement('textarea');
    textareaNotas.className = 'admin-notas';
    textareaNotas.value = lead.notes || '';
    textareaNotas.rows = 2;
    let temporizadorNotas;
    textareaNotas.addEventListener('input', () => {
      clearTimeout(temporizadorNotas);
      temporizadorNotas = setTimeout(() => {
        actualizarLead(lead.id, { notes: textareaNotas.value });
      }, 800);
    });
    celdaNotas.appendChild(textareaNotas);
    fila.appendChild(celdaNotas);

    // Marketing (suscripción a campañas de email)
    const celdaMarketing = document.createElement('td');
    const checkboxMarketing = document.createElement('input');
    checkboxMarketing.type = 'checkbox';
    checkboxMarketing.className = 'checkbox-marketing';
    checkboxMarketing.checked = Boolean(lead.marketing_opt_in);
    checkboxMarketing.addEventListener('change', () => {
      actualizarLead(lead.id, { marketing_opt_in: checkboxMarketing.checked });
    });
    celdaMarketing.appendChild(checkboxMarketing);
    fila.appendChild(celdaMarketing);

    // Última edición
    const celdaEdicion = document.createElement('td');
    if (lead.updated_at) {
      const nombre = perfilesPorId[lead.updated_by] || 'Desconocido';
      celdaEdicion.innerHTML = `${escapeHtml(nombre)}<br><span class="admin-tel">${formatearFechaHora(lead.updated_at)}</span>`;
    } else {
      celdaEdicion.textContent = '—';
    }
    fila.appendChild(celdaEdicion);

    // Acciones
    const celdaAcciones = document.createElement('td');
    const botonEliminar = document.createElement('button');
    botonEliminar.type = 'button';
    botonEliminar.className = 'btn-eliminar';
    botonEliminar.textContent = 'Eliminar';
    botonEliminar.addEventListener('click', () => eliminarLead(lead.id, lead.full_name));
    celdaAcciones.appendChild(botonEliminar);
    fila.appendChild(celdaAcciones);

    tablaBody.appendChild(fila);
  });
}

async function eliminarLead(id, nombre) {
  const confirmado = confirm(`¿Seguro que quieres eliminar el lead "${nombre}"? Esta acción no se puede deshacer.`);
  if (!confirmado) return;

  const token = getToken();
  try {
    const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Prefer': 'return=representation',
      },
    });
    if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
    const borrados = await respuesta.json();
    if (borrados.length === 0) {
      throw new Error('No se ha borrado nada (permiso denegado o el lead ya no existe).');
    }
    cargarLeads();
  } catch (error) {
    dashboardStatus.textContent = 'No se pudo eliminar: ' + error.message;
    dashboardStatus.className = 'form-status error';
  }
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
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(cambios),
    });
    if (respuesta.status === 401 || respuesta.status === 403) {
      clearToken();
      mostrarLogin();
      loginStatus.textContent = 'Tu sesión ha caducado, entra de nuevo.';
      loginStatus.className = 'form-status error';
      return;
    }
    if (!respuesta.ok) {
      const cuerpo = await respuesta.text();
      console.error('Respuesta de Supabase al fallar el PATCH:', cuerpo);
      throw new Error(`Error ${respuesta.status}: ${cuerpo}`);
    }
    const filas = await respuesta.json();
    if (filas.length === 0) {
      throw new Error('No se ha guardado nada (permiso denegado o el lead ya no existe).');
    }
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
filtroPresupuesto.addEventListener('change', cargarLeads);
filtroZona.addEventListener('change', cargarLeads);
filtroPlazo.addEventListener('change', cargarLeads);
filtroPropiedadesMin.addEventListener('change', cargarLeads);
filtroPropiedadesMax.addEventListener('change', cargarLeads);
refrescarBtn.addEventListener('click', cargarLeads);
limpiarFiltrosBtn.addEventListener('click', () => {
  filtroStatus.value = '';
  filtroPresupuesto.value = '';
  filtroZona.value = '';
  filtroPlazo.value = '';
  filtroPropiedadesMin.value = '';
  filtroPropiedadesMax.value = '';
  cargarLeads();
});

// --- Al cargar la página, ¿ya había sesión? ---
if (getToken()) {
  mostrarDashboard();
} else {
  mostrarLogin();
}

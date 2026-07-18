// marketing.js — envío de campañas de email a leads suscritos a marketing

const SUPABASE_URL = "https://uagmlfssbixytierxdib.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_8FvlGTc8ICk04jqAH0yzzg_Q84Jp1UQ";

function getToken() {
  return sessionStorage.getItem('admin-token');
}

// Reutiliza la sesión ya iniciada en admin.html
if (!getToken()) {
  window.location.href = 'admin.html';
}

const logoutBtn = document.getElementById('logout-btn');
logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem('admin-token');
  window.location.href = 'admin.html';
});

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

function poblarSelect(select, opciones) {
  opciones.forEach(([valor, etiqueta]) => {
    const opcion = document.createElement('option');
    opcion.value = valor;
    opcion.textContent = etiqueta;
    select.appendChild(opcion);
  });
}

const filtroPresupuesto = document.getElementById('mkt-filtro-presupuesto');
const filtroZona = document.getElementById('mkt-filtro-zona');
const filtroPlazo = document.getElementById('mkt-filtro-plazo');
poblarSelect(filtroPresupuesto, OPCIONES_PRESUPUESTO);
poblarSelect(filtroZona, OPCIONES_ZONA);
poblarSelect(filtroPlazo, OPCIONES_PLAZO);

const presetEjemploBtn = document.getElementById('mkt-preset-ejemplo-btn');
const limpiarFiltrosBtn = document.getElementById('mkt-limpiar-filtros-btn');
const marketingStatus = document.getElementById('marketing-status');
const tablaBody = document.getElementById('tabla-marketing-body');
const seleccionarTodos = document.getElementById('mkt-seleccionar-todos');
const marketingSeleccionados = document.getElementById('marketing-seleccionados');
const mktAsunto = document.getElementById('mkt-asunto');
const mktCuerpo = document.getElementById('mkt-cuerpo');
const mktEnviarBtn = document.getElementById('mkt-enviar-btn');
const mktEnvioStatus = document.getElementById('mkt-envio-status');

let presetInversores = false;
const seleccionados = new Set();

function escapeHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

function formatearFechaHora(fechaIso) {
  return new Date(fechaIso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// --- El botón de ejemplo muestra cómo se puede filtrar el envío: aquí, solo
// leads con presupuesto de 1M€ o más (varios tramos a la vez) ---
presetEjemploBtn.addEventListener('click', () => {
  presetInversores = true;
  filtroPresupuesto.value = '';
  cargarMarketing();
});

limpiarFiltrosBtn.addEventListener('click', () => {
  presetInversores = false;
  filtroPresupuesto.value = '';
  filtroZona.value = '';
  filtroPlazo.value = '';
  cargarMarketing();
});

[filtroPresupuesto, filtroZona, filtroPlazo].forEach((select) => {
  select.addEventListener('change', () => {
    presetInversores = false;
    cargarMarketing();
  });
});

async function cargarMarketing() {
  marketingStatus.textContent = 'Cargando…';
  marketingStatus.className = 'form-status';
  seleccionados.clear();
  actualizarContadorSeleccionados();

  const params = new URLSearchParams();
  params.set('select', '*');
  params.set('marketing_opt_in', 'eq.true');
  params.set('order', 'full_name.asc');
  if (presetInversores) {
    params.append('budget_range', 'in.(1m-2m,2m-5m,5m+)');
  } else if (filtroPresupuesto.value) {
    params.append('budget_range', `eq.${filtroPresupuesto.value}`);
  }
  if (filtroZona.value) params.append('region_interest', `eq.${filtroZona.value}`);
  if (filtroPlazo.value) params.append('timeframe', `eq.${filtroPlazo.value}`);

  try {
    const [respuestaLeads, respuestaLog] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/leads?${params.toString()}`, {
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${getToken()}` },
      }),
      fetch(`${SUPABASE_URL}/rest/v1/email_log?select=lead_id,created_at&order=created_at.desc`, {
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${getToken()}` },
      }),
    ]);

    if (respuestaLeads.status === 401 || respuestaLog.status === 401) {
      sessionStorage.removeItem('admin-token');
      window.location.href = 'admin.html';
      return;
    }
    if (!respuestaLeads.ok) throw new Error(`Error ${respuestaLeads.status}`);

    const leads = await respuestaLeads.json();
    const log = respuestaLog.ok ? await respuestaLog.json() : [];

    // El log viene ordenado por fecha desc, así que la primera aparición de
    // cada lead_id ya es su envío más reciente.
    const ultimoEnvioPorLead = {};
    log.forEach((entrada) => {
      if (!ultimoEnvioPorLead[entrada.lead_id]) {
        ultimoEnvioPorLead[entrada.lead_id] = entrada.created_at;
      }
    });

    renderTablaMarketing(leads, ultimoEnvioPorLead);
    marketingStatus.textContent = `${leads.length} lead(s) suscritos a marketing`;
    marketingStatus.className = 'form-status ok';
  } catch (error) {
    marketingStatus.textContent = 'Error al cargar: ' + error.message;
    marketingStatus.className = 'form-status error';
  }
}

function renderTablaMarketing(leads, ultimoEnvioPorLead) {
  tablaBody.innerHTML = '';
  seleccionarTodos.checked = false;

  leads.forEach((lead) => {
    const fila = document.createElement('tr');

    const celdaCheckbox = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) seleccionados.add(lead.id);
      else seleccionados.delete(lead.id);
      actualizarContadorSeleccionados();
    });
    celdaCheckbox.appendChild(checkbox);
    fila.appendChild(celdaCheckbox);

    const ultimoEnvio = ultimoEnvioPorLead[lead.id];
    fila.innerHTML += `
      <td>${escapeHtml(lead.full_name)}</td>
      <td>${escapeHtml(lead.email)}</td>
      <td>${escapeHtml(lead.budget_range)}</td>
      <td>${escapeHtml(lead.region_interest)}</td>
      <td>${ultimoEnvio ? formatearFechaHora(ultimoEnvio) : '<span class="admin-tel">Nunca</span>'}</td>
    `;
    tablaBody.appendChild(fila);
  });
}

seleccionarTodos.addEventListener('change', () => {
  const checkboxes = tablaBody.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach((cb) => {
    cb.checked = seleccionarTodos.checked;
    cb.dispatchEvent(new Event('change'));
  });
});

function actualizarContadorSeleccionados() {
  marketingSeleccionados.textContent = `${seleccionados.size} lead(s) seleccionados`;
}

mktEnviarBtn.addEventListener('click', async () => {
  if (seleccionados.size === 0) {
    mktEnvioStatus.textContent = 'Selecciona al menos un lead.';
    mktEnvioStatus.className = 'form-status error';
    return;
  }
  if (!mktAsunto.value.trim() || !mktCuerpo.value.trim()) {
    mktEnvioStatus.textContent = 'Pon un asunto y un mensaje antes de enviar.';
    mktEnvioStatus.className = 'form-status error';
    return;
  }
  const confirmado = confirm(`¿Enviar este email a ${seleccionados.size} lead(s)?`);
  if (!confirmado) return;

  mktEnviarBtn.disabled = true;
  mktEnvioStatus.textContent = 'Enviando…';
  mktEnvioStatus.className = 'form-status';

  try {
    const respuesta = await fetch(`${SUPABASE_URL}/functions/v1/send-marketing-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
      },
      body: JSON.stringify({
        leadIds: Array.from(seleccionados),
        subject: mktAsunto.value.trim(),
        body: mktCuerpo.value.trim(),
      }),
    });
    if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
    const resultado = await respuesta.json();
    mktEnvioStatus.textContent = `Enviado a ${resultado.enviados} de ${resultado.total} lead(s).`;
    mktEnvioStatus.className = 'form-status ok';
    mktAsunto.value = '';
    mktCuerpo.value = '';
    cargarMarketing();
  } catch (error) {
    mktEnvioStatus.textContent = 'Error al enviar: ' + error.message;
    mktEnvioStatus.className = 'form-status error';
  } finally {
    mktEnviarBtn.disabled = false;
  }
});

cargarMarketing();

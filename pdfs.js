// pdfs.js — listado de todos los dossiers que ya tienen un PDF generado

const SUPABASE_URL = "https://uagmlfssbixytierxdib.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_8FvlGTc8ICk04jqAH0yzzg_Q84Jp1UQ";

function getToken() {
  return sessionStorage.getItem('admin-token');
}

if (!getToken()) {
  window.location.href = 'admin.html';
}

const pdfsLista = document.getElementById('pdfs-lista');
const pdfsStatus = document.getElementById('pdfs-status');
const logoutBtn = document.getElementById('logout-btn');

function escapeHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

function formatearPrecio(precio) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(precio);
}

async function cargarPdfs() {
  pdfsStatus.textContent = 'Cargando…';
  pdfsStatus.className = 'form-status';
  try {
    const respuesta = await fetch(
      `${SUPABASE_URL}/rest/v1/dossiers?select=*&pdf_url=not.is.null&order=updated_at.desc`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${getToken()}` } },
    );
    if (respuesta.status === 401 || respuesta.status === 403) {
      sessionStorage.removeItem('admin-token');
      window.location.href = 'admin.html';
      return;
    }
    if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
    const dossiers = await respuesta.json();
    renderPdfs(dossiers);
    pdfsStatus.textContent = `${dossiers.length} PDF(s) generado(s)`;
    pdfsStatus.className = 'form-status ok';
  } catch (error) {
    pdfsStatus.textContent = 'Error al cargar: ' + error.message;
    pdfsStatus.className = 'form-status error';
  }
}

function renderPdfs(dossiers) {
  pdfsLista.innerHTML = '';
  if (dossiers.length === 0) {
    pdfsLista.innerHTML = '<p class="mapa-vacio">Todavía no se ha generado ningún PDF.</p>';
    return;
  }
  dossiers.forEach((d) => {
    const tarjeta = document.createElement('div');
    tarjeta.className = 'dossier-tarjeta';
    tarjeta.innerHTML = `
      ${d.cover_image_url ? `<img src="${d.cover_image_url}" alt="">` : '<div class="dossier-tarjeta-sin-foto"></div>'}
      <div class="dossier-tarjeta-info">
        <h3>${escapeHtml(d.title)}</h3>
        <p>${escapeHtml(d.region || d.address || '')}</p>
        ${d.price ? `<p>${formatearPrecio(d.price)}</p>` : ''}
        <a href="${d.pdf_url}" target="_blank" rel="noopener" class="btn-secundario pdf-tarjeta-link">Ver PDF</a>
      </div>
    `;
    pdfsLista.appendChild(tarjeta);
  });
}

logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem('admin-token');
  window.location.href = 'admin.html';
});

cargarPdfs();

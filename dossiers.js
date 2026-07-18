// dossiers.js — creación/edición de dossiers de inmuebles + generación de PDF

const SUPABASE_URL = "https://uagmlfssbixytierxdib.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_8FvlGTc8ICk04jqAH0yzzg_Q84Jp1UQ";
const STORAGE_BUCKET = "dossiers";
const CONTACTO_EMAIL = "jorgeceladaa2@gmail.com";

function getToken() {
  return sessionStorage.getItem('admin-token');
}

// Esta página reutiliza la sesión ya iniciada en admin.html; si no hay
// token guardado, no hay formulario de login propio: se manda al de admin.
if (!getToken()) {
  window.location.href = 'admin.html';
}

const dossiersStatus = document.getElementById('dossiers-status');
const dossiersLista = document.getElementById('dossiers-lista');
const nuevoDossierBtn = document.getElementById('nuevo-dossier-btn');
const editor = document.getElementById('dossier-editor');
const editorTitulo = document.getElementById('editor-titulo');
const dossierForm = document.getElementById('dossier-form');
const dossierFormStatus = document.getElementById('dossier-form-status');
const cancelarEditorBtn = document.getElementById('cancelar-editor-btn');
const eliminarDossierBtn = document.getElementById('eliminar-dossier-btn');
const generarPdfBtn = document.getElementById('generar-pdf-btn');
const verPdfLink = document.getElementById('ver-pdf-link');
const preview = document.getElementById('dossier-preview');
const logoutBtn = document.getElementById('logout-btn');

let dossierActualId = null; // null mientras se está creando uno nuevo
let dossierActual = {};
let galeriaSeleccionada = []; // archivos NUEVOS de la galería pendientes de subir
let galeriaExistente = []; // URLs de galería que ya tenía el dossier (menos las quitadas)
let coverExistenteUrl = null; // URL de portada que ya tenía el dossier (null si se quitó)
let floorplanExistenteUrl = null; // igual, para el plano

// --- Helper: crea un recuadro de imagen con botón "×" para quitarla ---
function crearPreviewItem(urlImagen, alQuitar) {
  const envoltorio = document.createElement('div');
  envoltorio.className = 'dossier-file-preview-item';
  const img = document.createElement('img');
  img.src = urlImagen;
  const botonQuitar = document.createElement('button');
  botonQuitar.type = 'button';
  botonQuitar.className = 'dossier-file-preview-quitar';
  botonQuitar.textContent = '×';
  botonQuitar.addEventListener('click', alQuitar);
  envoltorio.appendChild(img);
  envoltorio.appendChild(botonQuitar);
  return envoltorio;
}

const inputCover = document.getElementById('d-cover');
const previewCover = document.getElementById('d-cover-preview');
const inputFloorplan = document.getElementById('d-floorplan');
const previewFloorplan = document.getElementById('d-floorplan-preview');
const inputGallery = document.getElementById('d-gallery');
const previewGallery = document.getElementById('d-gallery-preview');

// --- Preview de portada/plano: muestra la existente (si hay) o la recién elegida ---
function renderPreviewUnico(contenedor, urlExistente, input) {
  contenedor.innerHTML = '';
  const file = input.files[0];
  if (file) {
    contenedor.appendChild(crearPreviewItem(URL.createObjectURL(file), () => {
      input.value = '';
      renderPreviewUnico(contenedor, urlExistente, input);
    }));
  } else if (urlExistente) {
    contenedor.appendChild(crearPreviewItem(urlExistente, () => {
      if (contenedor === previewCover) coverExistenteUrl = null;
      if (contenedor === previewFloorplan) floorplanExistenteUrl = null;
      renderPreviewUnico(contenedor, null, input);
    }));
  }
}

inputCover.addEventListener('change', () => renderPreviewUnico(previewCover, coverExistenteUrl, inputCover));
inputFloorplan.addEventListener('change', () => renderPreviewUnico(previewFloorplan, floorplanExistenteUrl, inputFloorplan));

// --- Preview de galería: fotos ya existentes + archivos nuevos pendientes de subir ---
inputGallery.addEventListener('change', () => {
  galeriaSeleccionada.push(...inputGallery.files);
  inputGallery.value = ''; // permite reabrir el selector y seguir añadiendo
  renderPreviewGaleria();
});

function renderPreviewGaleria() {
  previewGallery.innerHTML = '';

  galeriaExistente.forEach((url, indice) => {
    previewGallery.appendChild(crearPreviewItem(url, () => {
      galeriaExistente.splice(indice, 1);
      renderPreviewGaleria();
    }));
  });

  galeriaSeleccionada.forEach((file, indice) => {
    previewGallery.appendChild(crearPreviewItem(URL.createObjectURL(file), () => {
      galeriaSeleccionada.splice(indice, 1);
      renderPreviewGaleria();
    }));
  });
}

logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem('admin-token');
  window.location.href = 'admin.html';
});

function escapeHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

function formatearPrecio(precio) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(precio);
}

// --- Cargar lista de dossiers ---
async function cargarDossiers() {
  dossiersStatus.textContent = 'Cargando…';
  dossiersStatus.className = 'form-status';
  try {
    const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/dossiers?select=*&order=created_at.desc`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${getToken()}` },
    });
    if (respuesta.status === 401) {
      sessionStorage.removeItem('admin-token');
      window.location.href = 'admin.html';
      return;
    }
    if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
    const dossiers = await respuesta.json();
    renderListaDossiers(dossiers);
    dossiersStatus.textContent = `${dossiers.length} dossier(s)`;
    dossiersStatus.className = 'form-status ok';
  } catch (error) {
    dossiersStatus.textContent = 'Error al cargar: ' + error.message;
    dossiersStatus.className = 'form-status error';
  }
}

function renderListaDossiers(dossiers) {
  dossiersLista.innerHTML = '';
  dossiers.forEach((d) => {
    const tarjeta = document.createElement('div');
    tarjeta.className = 'dossier-tarjeta';
    tarjeta.innerHTML = `
      ${d.cover_image_url ? `<img src="${d.cover_image_url}" alt="">` : '<div class="dossier-tarjeta-sin-foto"></div>'}
      <div class="dossier-tarjeta-info">
        <h3>${escapeHtml(d.title)}</h3>
        <p>${escapeHtml(d.region || d.address || '')}</p>
        ${d.price ? `<p>${formatearPrecio(d.price)}</p>` : ''}
        ${d.pdf_url ? '<span class="dossier-tarjeta-badge">PDF listo</span>' : ''}
      </div>
    `;

    const acciones = document.createElement('div');
    acciones.className = 'dossier-tarjeta-acciones';

    const botonEditar = document.createElement('button');
    botonEditar.type = 'button';
    botonEditar.className = 'btn-editar';
    botonEditar.textContent = 'Editar';
    botonEditar.addEventListener('click', (evento) => {
      evento.stopPropagation();
      abrirEditor(d);
    });

    const botonEliminar = document.createElement('button');
    botonEliminar.type = 'button';
    botonEliminar.className = 'btn-eliminar';
    botonEliminar.textContent = 'Eliminar';
    botonEliminar.addEventListener('click', (evento) => {
      evento.stopPropagation();
      eliminarDossier(d);
    });

    acciones.appendChild(botonEditar);
    acciones.appendChild(botonEliminar);
    tarjeta.querySelector('.dossier-tarjeta-info').appendChild(acciones);

    tarjeta.dataset.dossierId = d.id;
    tarjeta.addEventListener('click', () => abrirEditor(d));
    dossiersLista.appendChild(tarjeta);
  });
}

// --- Abrir editor (nuevo o edición) ---
function abrirEditor(dossier) {
  dossierActualId = dossier ? dossier.id : null;
  dossierActual = dossier || {};
  editorTitulo.textContent = dossier ? 'Editar dossier' : 'Nuevo dossier';
  dossierForm.reset();
  dossierFormStatus.textContent = '';
  verPdfLink.hidden = true;

  galeriaSeleccionada = [];
  coverExistenteUrl = dossier?.cover_image_url || null;
  floorplanExistenteUrl = dossier?.floor_plan_url || null;
  galeriaExistente = [...(dossier?.gallery_urls || [])];
  renderPreviewUnico(previewCover, coverExistenteUrl, inputCover);
  renderPreviewUnico(previewFloorplan, floorplanExistenteUrl, inputFloorplan);
  renderPreviewGaleria();

  document.getElementById('d-title').value = dossier?.title || '';
  document.getElementById('d-address').value = dossier?.address || '';
  document.getElementById('d-region').value = dossier?.region || '';
  document.getElementById('d-price').value = dossier?.price ?? '';
  document.getElementById('d-surface').value = dossier?.surface_m2 ?? '';
  document.getElementById('d-bedrooms').value = dossier?.bedrooms ?? '';
  document.getElementById('d-bathrooms').value = dossier?.bathrooms ?? '';
  document.getElementById('d-energy').value = dossier?.energy_rating || '';
  document.getElementById('d-community').value = dossier?.community_fees ?? '';
  document.getElementById('d-ibi').value = dossier?.ibi ?? '';
  document.getElementById('d-description').value = dossier?.description || '';
  document.getElementById('d-area').value = dossier?.area_info || '';

  if (dossier?.pdf_url) {
    verPdfLink.href = dossier.pdf_url;
    verPdfLink.hidden = false;
  }

  eliminarDossierBtn.hidden = !dossier;

  editor.hidden = false;
  renderPreview();
  editor.scrollIntoView({ behavior: 'smooth' });
}

nuevoDossierBtn.addEventListener('click', () => abrirEditor(null));
cancelarEditorBtn.addEventListener('click', () => {
  editor.hidden = true;
  dossierActualId = null;
});

// Convierte una URL pública de Storage en la ruta interna (bucket/carpeta/archivo)
function extraerRutaStorage(url) {
  if (!url) return null;
  const marcador = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  const indice = url.indexOf(marcador);
  if (indice === -1) return null;
  return url.slice(indice + marcador.length);
}

// Borrado en bloque de archivos en Storage. Es "best effort": si falla, no
// bloquea el borrado del dossier en sí, solo se queda algún archivo huérfano.
async function borrarArchivosStorage(rutas) {
  const rutasValidas = rutas.filter(Boolean);
  if (rutasValidas.length === 0) return;
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefixes: rutasValidas }),
    });
  } catch (error) {
    console.warn('No se pudieron borrar algunos archivos de Storage:', error);
  }
}

async function eliminarDossier(dossier) {
  const confirmado = confirm(`¿Seguro que quieres eliminar el dossier "${dossier.title}"? Esta acción no se puede deshacer.`);
  if (!confirmado) return;

  // Animación de salida antes de borrar de verdad (si la tarjeta está visible en la lista)
  const tarjeta = dossiersLista.querySelector(`[data-dossier-id="${dossier.id}"]`);
  if (tarjeta) {
    tarjeta.classList.add('dossier-tarjeta-saliendo');
    await new Promise((resolver) => setTimeout(resolver, 250));
  }

  try {
    const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/dossiers?id=eq.${dossier.id}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${getToken()}`,
        'Prefer': 'return=minimal',
      },
    });
    if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);

    await borrarArchivosStorage([
      extraerRutaStorage(dossier.cover_image_url),
      extraerRutaStorage(dossier.floor_plan_url),
      extraerRutaStorage(dossier.pdf_url),
      ...(dossier.gallery_urls || []).map(extraerRutaStorage),
    ]);

    if (dossierActualId === dossier.id) {
      editor.hidden = true;
      dossierActualId = null;
    }
    cargarDossiers();
  } catch (error) {
    dossiersStatus.textContent = 'No se pudo eliminar: ' + error.message;
    dossiersStatus.className = 'form-status error';
  }
}

eliminarDossierBtn.addEventListener('click', () => eliminarDossier(dossierActual));

// --- Subir una imagen a Supabase Storage, devuelve la URL pública ---
async function subirImagen(file, carpeta) {
  const nombreArchivo = `${carpeta}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
  const respuesta = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${nombreArchivo}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': file.type,
    },
    body: file,
  });
  if (respuesta.status === 401 || respuesta.status === 403) {
    sessionStorage.removeItem('admin-token');
    window.location.href = 'admin.html';
    throw new Error('Tu sesión ha caducado. Vuelve a iniciar sesión e inténtalo de nuevo.');
  }
  if (!respuesta.ok) {
    const cuerpo = await respuesta.text();
    console.error('Respuesta de Storage al fallar la subida:', cuerpo);
    throw new Error(`No se pudo subir ${file.name} (${respuesta.status}): ${cuerpo}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${nombreArchivo}`;
}

// --- Guardar dossier (crear o actualizar) ---
dossierForm.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  dossierFormStatus.textContent = 'Guardando…';
  dossierFormStatus.className = 'form-status';

  try {
    const datos = {
      title: document.getElementById('d-title').value,
      address: document.getElementById('d-address').value || null,
      region: document.getElementById('d-region').value || null,
      price: document.getElementById('d-price').value ? Number(document.getElementById('d-price').value) : null,
      surface_m2: document.getElementById('d-surface').value ? Number(document.getElementById('d-surface').value) : null,
      bedrooms: document.getElementById('d-bedrooms').value ? Number(document.getElementById('d-bedrooms').value) : null,
      bathrooms: document.getElementById('d-bathrooms').value ? Number(document.getElementById('d-bathrooms').value) : null,
      energy_rating: document.getElementById('d-energy').value || null,
      community_fees: document.getElementById('d-community').value ? Number(document.getElementById('d-community').value) : null,
      ibi: document.getElementById('d-ibi').value ? Number(document.getElementById('d-ibi').value) : null,
      description: document.getElementById('d-description').value || null,
      area_info: document.getElementById('d-area').value || null,
    };

    // Portada: archivo nuevo > la que ya había (si no se quitó) > ninguna
    datos.cover_image_url = inputCover.files[0]
      ? await subirImagen(inputCover.files[0], 'portadas')
      : coverExistenteUrl;

    // Plano: mismo criterio
    datos.floor_plan_url = inputFloorplan.files[0]
      ? await subirImagen(inputFloorplan.files[0], 'planos')
      : floorplanExistenteUrl;

    // Galería: las que ya había (menos las quitadas) + las nuevas subidas
    const urlsGaleria = [...galeriaExistente];
    for (const file of galeriaSeleccionada) {
      urlsGaleria.push(await subirImagen(file, 'galeria'));
    }
    datos.gallery_urls = urlsGaleria;

    let dossierGuardado;
    if (dossierActualId) {
      const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/dossiers?id=eq.${dossierActualId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${getToken()}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(datos),
      });
      if (respuesta.status === 401 || respuesta.status === 403) {
        sessionStorage.removeItem('admin-token');
        window.location.href = 'admin.html';
        return;
      }
      if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
      const filas = await respuesta.json();
      if (filas.length === 0) {
        throw new Error('No se ha guardado nada (permiso denegado o el dossier ya no existe). Prueba a salir y volver a entrar.');
      }
      [dossierGuardado] = filas;
    } else {
      const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/dossiers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${getToken()}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(datos),
      });
      if (respuesta.status === 401 || respuesta.status === 403) {
        sessionStorage.removeItem('admin-token');
        window.location.href = 'admin.html';
        return;
      }
      if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
      const filas = await respuesta.json();
      if (filas.length === 0) {
        throw new Error('No se ha guardado nada (permiso denegado).');
      }
      [dossierGuardado] = filas;
      dossierActualId = dossierGuardado.id;
    }

    dossierActual = dossierGuardado;
    dossierFormStatus.textContent = 'Guardado.';
    dossierFormStatus.className = 'form-status ok';

    inputCover.value = '';
    inputFloorplan.value = '';
    galeriaSeleccionada = [];
    coverExistenteUrl = dossierGuardado.cover_image_url || null;
    floorplanExistenteUrl = dossierGuardado.floor_plan_url || null;
    galeriaExistente = [...(dossierGuardado.gallery_urls || [])];
    renderPreviewUnico(previewCover, coverExistenteUrl, inputCover);
    renderPreviewUnico(previewFloorplan, floorplanExistenteUrl, inputFloorplan);
    renderPreviewGaleria();

    renderPreview();
    cargarDossiers();
  } catch (error) {
    dossierFormStatus.textContent = 'Error al guardar: ' + error.message;
    dossierFormStatus.className = 'form-status error';
  }
});

// --- Vista previa (es exactamente lo que se convierte en PDF) ---
function renderPreview() {
  const titulo = document.getElementById('d-title').value || 'Título del inmueble';
  const direccion = document.getElementById('d-address').value;
  const zona = document.getElementById('d-region').value;
  const precio = document.getElementById('d-price').value;
  const superficie = document.getElementById('d-surface').value;
  const habitaciones = document.getElementById('d-bedrooms').value;
  const banos = document.getElementById('d-bathrooms').value;
  const energia = document.getElementById('d-energy').value;
  const comunidad = document.getElementById('d-community').value;
  const ibi = document.getElementById('d-ibi').value;
  const descripcion = document.getElementById('d-description').value;
  const areaInfo = document.getElementById('d-area').value;

  const portada = dossierActual.cover_image_url || '';
  const plano = dossierActual.floor_plan_url || '';
  const galeria = dossierActual.gallery_urls || [];

  preview.innerHTML = `
    <div class="dossier-pdf">
      <div class="dossier-pdf-portada" style="background-image:url('${portada}')">
        <div class="dossier-pdf-portada-overlay">
          <h1>${escapeHtml(titulo)}</h1>
          <p>${escapeHtml(direccion || zona || '')}</p>
          ${precio ? `<span class="dossier-pdf-precio">${formatearPrecio(Number(precio))}</span>` : ''}
        </div>
      </div>

      <div class="dossier-pdf-seccion">
        <h2>Datos técnicos</h2>
        <div class="dossier-pdf-datos">
          ${superficie ? `<div><b>Superficie</b><span>${superficie} m²</span></div>` : ''}
          ${habitaciones ? `<div><b>Habitaciones</b><span>${habitaciones}</span></div>` : ''}
          ${banos ? `<div><b>Baños</b><span>${banos}</span></div>` : ''}
          ${energia ? `<div><b>Cert. energética</b><span>${energia}</span></div>` : ''}
          ${comunidad ? `<div><b>Gastos comunidad</b><span>${comunidad} €/mes</span></div>` : ''}
          ${ibi ? `<div><b>IBI anual</b><span>${ibi} €</span></div>` : ''}
        </div>
      </div>

      ${descripcion ? `<div class="dossier-pdf-seccion"><h2>Descripción</h2><p>${escapeHtml(descripcion).replace(/\n/g, '<br>')}</p></div>` : ''}

      ${galeria.length ? `<div class="dossier-pdf-seccion"><h2>Galería</h2><div class="dossier-pdf-galeria">${galeria.map((url) => `<img src="${url}">`).join('')}</div></div>` : ''}

      ${plano ? `<div class="dossier-pdf-seccion"><h2>Plano de planta</h2><img class="dossier-pdf-plano" src="${plano}"></div>` : ''}

      ${areaInfo ? `<div class="dossier-pdf-seccion"><h2>Zona y puntos de interés</h2><p>${escapeHtml(areaInfo).replace(/\n/g, '<br>')}</p></div>` : ''}

      <div class="dossier-pdf-contacto">
        <p><b>Invest Spain Properties</b></p>
        <p>${CONTACTO_EMAIL}</p>
      </div>
    </div>
  `;
}

// Vuelve a pintar la vista previa en vivo mientras se rellena el formulario
dossierForm.addEventListener('input', renderPreview);

// --- Generar PDF a partir de la vista previa y subirlo a Storage ---
generarPdfBtn.addEventListener('click', async () => {
  if (!dossierActualId) {
    dossierFormStatus.textContent = 'Guarda el dossier antes de generar el PDF.';
    dossierFormStatus.className = 'form-status error';
    return;
  }
  generarPdfBtn.disabled = true;
  generarPdfBtn.textContent = 'Generando…';
  try {
    const pdfBlob = await html2pdf()
      .set({ html2canvas: { useCORS: true, scale: 2 } })
      .from(preview.firstElementChild)
      .outputPdf('blob');
    const nombreArchivo = `pdfs/${dossierActualId}.pdf`;

    const respuestaSubida = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${nombreArchivo}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/pdf',
        'x-upsert': 'true',
      },
      body: pdfBlob,
    });
    if (!respuestaSubida.ok) throw new Error(`Error ${respuestaSubida.status}`);

    const pdfUrl = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${nombreArchivo}`;
    const respuestaPatch = await fetch(`${SUPABASE_URL}/rest/v1/dossiers?id=eq.${dossierActualId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${getToken()}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ pdf_url: pdfUrl }),
    });
    if (!respuestaPatch.ok) throw new Error(`Error ${respuestaPatch.status}`);

    dossierActual.pdf_url = pdfUrl;
    verPdfLink.href = pdfUrl;
    verPdfLink.hidden = false;
    dossierFormStatus.textContent = 'PDF generado correctamente.';
    dossierFormStatus.className = 'form-status ok';
    cargarDossiers();
  } catch (error) {
    dossierFormStatus.textContent = 'Error al generar el PDF: ' + error.message;
    dossierFormStatus.className = 'form-status error';
  } finally {
    generarPdfBtn.disabled = false;
    generarPdfBtn.textContent = 'Generar PDF';
  }
});

// ============================================================
// Pestañas: Dossiers / Seguimiento
// ============================================================
const ETIQUETAS_ESTADO_VENTA = {
  available: 'Disponible',
  reserved: 'Reservado',
  negotiating: 'En negociación',
  sold: 'Vendido',
  withdrawn: 'Retirado',
};

const tabDossiersBtn = document.querySelector('.inmuebles-tab[data-tab="dossiers"]');
const tabSeguimientoBtn = document.querySelector('.inmuebles-tab[data-tab="seguimiento"]');
const panelDossiers = document.getElementById('tab-dossiers');
const panelSeguimiento = document.getElementById('tab-seguimiento');
let seguimientoCargado = false;

function cambiarTab(nombre) {
  const esDossiers = nombre === 'dossiers';
  panelDossiers.hidden = !esDossiers;
  panelSeguimiento.hidden = esDossiers;
  tabDossiersBtn.classList.toggle('inmuebles-tab-activa', esDossiers);
  tabSeguimientoBtn.classList.toggle('inmuebles-tab-activa', !esDossiers);
  if (!esDossiers && !seguimientoCargado) {
    seguimientoCargado = true;
    cargarSeguimiento();
  }
}
tabDossiersBtn.addEventListener('click', () => cambiarTab('dossiers'));
tabSeguimientoBtn.addEventListener('click', () => cambiarTab('seguimiento'));

// ============================================================
// Seguimiento: lista de inmuebles con su estado de venta
// ============================================================
const seguimientoStatus = document.getElementById('seguimiento-status');
const seguimientoLista = document.getElementById('seguimiento-lista');
const seguimientoDetalle = document.getElementById('seguimiento-detalle');
const seguimientoTitulo = document.getElementById('seguimiento-titulo');
const cerrarSeguimientoBtn = document.getElementById('cerrar-seguimiento-btn');
const segEstado = document.getElementById('seg-estado');
const seguimientoComparativa = document.getElementById('seguimiento-comparativa');
const segLeadSelect = document.getElementById('seg-lead-select');
const anadirInteresadoBtn = document.getElementById('anadir-interesado-btn');
const seguimientoInteresados = document.getElementById('seguimiento-interesados');
const segDocNombre = document.getElementById('seg-doc-nombre');
const segDocArchivo = document.getElementById('seg-doc-archivo');
const subirDocumentoBtn = document.getElementById('subir-documento-btn');
const seguimientoDocumentos = document.getElementById('seguimiento-documentos');

let todosLosDossiers = []; // caché para calcular la comparativa de precios
let dossierSeguimientoActual = null;

// --- Alta rápida de un inmueble (ficha técnica, sin fotos ni descripción) ---
const nuevoInmuebleBtn = document.getElementById('nuevo-inmueble-btn');
const seguimientoNuevoForm = document.getElementById('seguimiento-nuevo-form');
const inmuebleForm = document.getElementById('inmueble-form');
const inmuebleFormStatus = document.getElementById('inmueble-form-status');
const cancelarInmuebleBtn = document.getElementById('cancelar-inmueble-btn');

nuevoInmuebleBtn.addEventListener('click', () => {
  inmuebleForm.reset();
  inmuebleFormStatus.textContent = '';
  seguimientoDetalle.hidden = true;
  seguimientoNuevoForm.hidden = false;
  seguimientoNuevoForm.scrollIntoView({ behavior: 'smooth' });
});

cancelarInmuebleBtn.addEventListener('click', () => {
  seguimientoNuevoForm.hidden = true;
});

inmuebleForm.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  inmuebleFormStatus.textContent = 'Guardando…';
  inmuebleFormStatus.className = 'form-status';
  try {
    const datos = {
      title: document.getElementById('inm-title').value,
      address: document.getElementById('inm-address').value || null,
      region: document.getElementById('inm-region').value || null,
      price: document.getElementById('inm-price').value ? Number(document.getElementById('inm-price').value) : null,
      surface_m2: document.getElementById('inm-surface').value ? Number(document.getElementById('inm-surface').value) : null,
      bedrooms: document.getElementById('inm-bedrooms').value ? Number(document.getElementById('inm-bedrooms').value) : null,
      bathrooms: document.getElementById('inm-bathrooms').value ? Number(document.getElementById('inm-bathrooms').value) : null,
      sale_status: document.getElementById('inm-estado').value,
    };
    const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/dossiers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${getToken()}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(datos),
    });
    if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
    const [nuevoInmueble] = await respuesta.json();
    seguimientoNuevoForm.hidden = true;
    await cargarSeguimiento();
    abrirSeguimientoDetalle(nuevoInmueble);
  } catch (error) {
    inmuebleFormStatus.textContent = 'Error al guardar: ' + error.message;
    inmuebleFormStatus.className = 'form-status error';
  }
});

async function cargarSeguimiento() {
  seguimientoStatus.textContent = 'Cargando…';
  seguimientoStatus.className = 'form-status';
  try {
    const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/dossiers?select=*&order=created_at.desc`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${getToken()}` },
    });
    if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
    todosLosDossiers = await respuesta.json();
    renderListaSeguimiento(todosLosDossiers);
    seguimientoStatus.textContent = `${todosLosDossiers.length} inmueble(s)`;
    seguimientoStatus.className = 'form-status ok';
  } catch (error) {
    seguimientoStatus.textContent = 'Error al cargar: ' + error.message;
    seguimientoStatus.className = 'form-status error';
  }
}

function renderListaSeguimiento(dossiers) {
  seguimientoLista.innerHTML = '';
  dossiers.forEach((d) => {
    const estado = d.sale_status || 'available';
    const tarjeta = document.createElement('div');
    tarjeta.className = 'seguimiento-tarjeta';
    tarjeta.innerHTML = `
      <h3>${escapeHtml(d.title)}</h3>
      <p>${escapeHtml(d.region || d.address || '')}${d.price ? ' · ' + formatearPrecio(d.price) : ''}</p>
      <span class="seguimiento-estado-badge seguimiento-estado-${estado}">${ETIQUETAS_ESTADO_VENTA[estado] || estado}</span>
    `;
    tarjeta.addEventListener('click', () => abrirSeguimientoDetalle(d));
    seguimientoLista.appendChild(tarjeta);
  });
}

async function abrirSeguimientoDetalle(dossier) {
  dossierSeguimientoActual = dossier;
  seguimientoTitulo.textContent = dossier.title;
  segEstado.value = dossier.sale_status || 'available';
  seguimientoNuevoForm.hidden = true;
  seguimientoDetalle.hidden = false;
  seguimientoDetalle.scrollIntoView({ behavior: 'smooth' });

  renderComparativa(dossier);
  await Promise.all([cargarLeadsParaSelect(), cargarInteresados(dossier.id), cargarDocumentos(dossier.id)]);
}

cerrarSeguimientoBtn.addEventListener('click', () => {
  seguimientoDetalle.hidden = true;
  dossierSeguimientoActual = null;
});

segEstado.addEventListener('change', async () => {
  if (!dossierSeguimientoActual) return;
  try {
    const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/dossiers?id=eq.${dossierSeguimientoActual.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${getToken()}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ sale_status: segEstado.value }),
    });
    if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
    dossierSeguimientoActual.sale_status = segEstado.value;
    cargarSeguimiento();
  } catch (error) {
    seguimientoStatus.textContent = 'No se pudo actualizar el estado: ' + error.message;
    seguimientoStatus.className = 'form-status error';
  }
});

// --- Comparativa de precio frente a otros inmuebles de la misma zona ---
function renderComparativa(dossier) {
  if (!dossier.price || !dossier.surface_m2) {
    seguimientoComparativa.textContent = 'Añade precio y superficie en el dossier para ver la comparativa.';
    return;
  }
  const precioM2 = dossier.price / dossier.surface_m2;

  const comparables = todosLosDossiers.filter((d) =>
    d.id !== dossier.id &&
    d.region &&
    dossier.region &&
    d.region.trim().toLowerCase() === dossier.region.trim().toLowerCase() &&
    d.price && d.surface_m2,
  );

  if (comparables.length === 0) {
    seguimientoComparativa.innerHTML = `<b>${precioM2.toFixed(0)} €/m²</b> — todavía no hay otros inmuebles en "${escapeHtml(dossier.region)}" para comparar.`;
    return;
  }

  const mediaM2 = comparables.reduce((suma, d) => suma + d.price / d.surface_m2, 0) / comparables.length;
  const diferencia = ((precioM2 - mediaM2) / mediaM2) * 100;
  const texto = diferencia > 5
    ? `un ${diferencia.toFixed(0)}% por encima de la media`
    : diferencia < -5
      ? `un ${Math.abs(diferencia).toFixed(0)}% por debajo de la media`
      : 'en línea con la media';

  seguimientoComparativa.innerHTML = `
    <b>${precioM2.toFixed(0)} €/m²</b> este inmueble.
    Media en "${escapeHtml(dossier.region)}" (${comparables.length} inmueble(s)): <b>${mediaM2.toFixed(0)} €/m²</b>.
    Está ${texto}.
  `;
}

// --- Leads interesados ---
async function cargarLeadsParaSelect() {
  try {
    const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/leads?select=id,full_name,email&order=full_name.asc`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${getToken()}` },
    });
    if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
    const leads = await respuesta.json();
    segLeadSelect.innerHTML = '';
    leads.forEach((lead) => {
      const opcion = document.createElement('option');
      opcion.value = lead.id;
      opcion.textContent = `${lead.full_name} (${lead.email})`;
      segLeadSelect.appendChild(opcion);
    });
  } catch (error) {
    console.error('No se pudieron cargar los leads:', error);
  }
}

async function cargarInteresados(dossierId) {
  seguimientoInteresados.innerHTML = '';
  try {
    const respuesta = await fetch(
      `${SUPABASE_URL}/rest/v1/dossier_leads?select=id,leads(id,full_name,email)&dossier_id=eq.${dossierId}`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${getToken()}` } },
    );
    if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
    const vinculos = await respuesta.json();
    if (vinculos.length === 0) {
      seguimientoInteresados.innerHTML = '<li>Ningún lead vinculado todavía.</li>';
      return;
    }
    vinculos.forEach((v) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${escapeHtml(v.leads?.full_name || 'Lead eliminado')}</span>`;
      const botonQuitar = document.createElement('button');
      botonQuitar.type = 'button';
      botonQuitar.textContent = 'Quitar';
      botonQuitar.addEventListener('click', () => quitarInteresado(v.id, dossierId));
      li.appendChild(botonQuitar);
      seguimientoInteresados.appendChild(li);
    });
  } catch (error) {
    seguimientoInteresados.innerHTML = `<li>Error al cargar: ${escapeHtml(error.message)}</li>`;
  }
}

anadirInteresadoBtn.addEventListener('click', async () => {
  if (!dossierSeguimientoActual || !segLeadSelect.value) return;
  try {
    const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/dossier_leads?on_conflict=dossier_id,lead_id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${getToken()}`,
        'Prefer': 'return=minimal,resolution=ignore-duplicates',
      },
      body: JSON.stringify({ dossier_id: dossierSeguimientoActual.id, lead_id: segLeadSelect.value }),
    });
    if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
    cargarInteresados(dossierSeguimientoActual.id);
  } catch (error) {
    seguimientoStatus.textContent = 'No se pudo añadir: ' + error.message;
    seguimientoStatus.className = 'form-status error';
  }
});

async function quitarInteresado(vinculoId, dossierId) {
  try {
    const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/dossier_leads?id=eq.${vinculoId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${getToken()}`,
        'Prefer': 'return=minimal',
      },
    });
    if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
    cargarInteresados(dossierId);
  } catch (error) {
    seguimientoStatus.textContent = 'No se pudo quitar: ' + error.message;
    seguimientoStatus.className = 'form-status error';
  }
}

// --- Documentos ---
async function cargarDocumentos(dossierId) {
  seguimientoDocumentos.innerHTML = '';
  try {
    const respuesta = await fetch(
      `${SUPABASE_URL}/rest/v1/dossier_documents?select=*&dossier_id=eq.${dossierId}&order=created_at.desc`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${getToken()}` } },
    );
    if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
    const documentos = await respuesta.json();
    if (documentos.length === 0) {
      seguimientoDocumentos.innerHTML = '<li>Ningún documento subido todavía.</li>';
      return;
    }
    documentos.forEach((doc) => {
      const li = document.createElement('li');
      li.innerHTML = `<a href="${doc.file_url}" target="_blank" rel="noopener">${escapeHtml(doc.name)}</a>`;
      const botonQuitar = document.createElement('button');
      botonQuitar.type = 'button';
      botonQuitar.textContent = 'Eliminar';
      botonQuitar.addEventListener('click', () => eliminarDocumento(doc));
      li.appendChild(botonQuitar);
      seguimientoDocumentos.appendChild(li);
    });
  } catch (error) {
    seguimientoDocumentos.innerHTML = `<li>Error al cargar: ${escapeHtml(error.message)}</li>`;
  }
}

subirDocumentoBtn.addEventListener('click', async () => {
  if (!dossierSeguimientoActual) return;
  const file = segDocArchivo.files[0];
  const nombre = segDocNombre.value.trim();
  if (!file || !nombre) {
    seguimientoStatus.textContent = 'Pon un nombre y elige un archivo antes de subir.';
    seguimientoStatus.className = 'form-status error';
    return;
  }
  try {
    const fileUrl = await subirImagen(file, 'documentos');
    const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/dossier_documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${getToken()}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ dossier_id: dossierSeguimientoActual.id, name: nombre, file_url: fileUrl }),
    });
    if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
    segDocNombre.value = '';
    segDocArchivo.value = '';
    cargarDocumentos(dossierSeguimientoActual.id);
  } catch (error) {
    seguimientoStatus.textContent = 'No se pudo subir el documento: ' + error.message;
    seguimientoStatus.className = 'form-status error';
  }
});

async function eliminarDocumento(doc) {
  const confirmado = confirm(`¿Eliminar el documento "${doc.name}"?`);
  if (!confirmado) return;
  try {
    const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/dossier_documents?id=eq.${doc.id}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${getToken()}`,
        'Prefer': 'return=minimal',
      },
    });
    if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
    await borrarArchivosStorage([extraerRutaStorage(doc.file_url)]);
    cargarDocumentos(doc.dossier_id);
  } catch (error) {
    seguimientoStatus.textContent = 'No se pudo eliminar: ' + error.message;
    seguimientoStatus.className = 'form-status error';
  }
}

cargarDossiers();

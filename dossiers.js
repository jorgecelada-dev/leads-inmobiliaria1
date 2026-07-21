// dossiers.js — creación/edición de dossiers de inmuebles + generación de PDF

const SUPABASE_URL = "https://uagmlfssbixytierxdib.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_8FvlGTc8ICk04jqAH0yzzg_Q84Jp1UQ";
const STORAGE_BUCKET = "dossiers";
const CONTACTO_EMAIL = "jorgeceladaa2@gmail.com";
const CONTACTO_TELEFONO = "+34 682548468";
const CONTACTO_NOMBRE = "Jorge Celada";
const CONTACTO_ROL = "Asesor de inversión inmobiliaria internacional";

// Agrupación de categorías de puntos de interés para la sección "Ubicación"
// de la nueva plantilla del PDF (Movilidad / Servicios / Ocio).
const GRUPOS_CONTEXTO_POI = [
  { titulo: 'Movilidad', keys: ['airport', 'transport'] },
  { titulo: 'Servicios', keys: ['schools', 'shopping', 'hospital', 'bank', 'offices'] },
  { titulo: 'Ocio', keys: ['restaurants', 'cafes', 'gym', 'parks', 'beach'] },
];

// Categorías fijas de puntos de interés, cada una con su icono (trazo simple,
// mismo estilo en toda la app). El icono es el contenido interior de un <svg>.
const CATEGORIAS_POI = [
  { key: 'airport', label: 'Aeropuerto', icon: '<path d="M21 3 L3 10 L11 13 L14 21 L21 3 Z"/><line x1="11" y1="13" x2="21" y2="3"/>' },
  { key: 'beach', label: 'Playa', icon: '<circle cx="12" cy="7" r="3"/><path d="M2 15 q2.5 -3 5 0 t5 0 t5 0 t5 0"/><path d="M2 19 q2.5 -3 5 0 t5 0 t5 0 t5 0"/>' },
  { key: 'transport', label: 'Transporte público', icon: '<rect x="5" y="3" width="14" height="13" rx="3"/><line x1="5" y1="10" x2="19" y2="10"/><circle cx="8.5" cy="13.2" r="0.9"/><circle cx="15.5" cy="13.2" r="0.9"/><path d="M8 16 L6 20 M16 16 L18 20"/>' },
  { key: 'schools', label: 'Colegios', icon: '<path d="M12 3 L2 8 L12 13 L22 8 Z"/><path d="M6 10 V16 C6 18 9 20 12 20 C15 20 18 18 18 16 V10"/><line x1="22" y1="8" x2="22" y2="15"/>' },
  { key: 'shopping', label: 'Centros comerciales', icon: '<path d="M6 8 L4 21 H20 L18 8 Z"/><path d="M8 8 V6 a4 4 0 0 1 8 0 v2"/>' },
  { key: 'restaurants', label: 'Restaurantes', icon: '<line x1="7" y1="2" x2="7" y2="9"/><line x1="10" y1="2" x2="10" y2="9"/><path d="M7 9 Q8.5 12 10 9"/><line x1="8.5" y1="2" x2="8.5" y2="22"/><path d="M16 2 C18 2 19 5 19 8 C19 11 17 12 16 12 V22"/>' },
  { key: 'cafes', label: 'Cafeterías', icon: '<path d="M4 9 H18 V15 A5 5 0 0 1 13 20 H9 A5 5 0 0 1 4 15 Z"/><path d="M18 10 H20 A2.5 2.5 0 0 1 20 15 H18"/><path d="M8 3 c0 1.5 -1.5 1.5 -1.5 3 M12 3 c0 1.5 -1.5 1.5 -1.5 3"/>' },
  { key: 'gym', label: 'Gimnasios', icon: '<rect x="1.5" y="9" width="3" height="6"/><rect x="19.5" y="9" width="3" height="6"/><rect x="5.5" y="7" width="2.5" height="10"/><rect x="16" y="7" width="2.5" height="10"/><line x1="8" y1="12" x2="16" y2="12"/>' },
  { key: 'parks', label: 'Parques', icon: '<circle cx="12" cy="8" r="6"/><line x1="12" y1="14" x2="12" y2="21"/>' },
  { key: 'hospital', label: 'Hospitales', icon: '<rect x="3" y="3" width="18" height="18" rx="3"/><line x1="12" y1="7.5" x2="12" y2="16.5"/><line x1="7.5" y1="12" x2="16.5" y2="12"/>' },
  { key: 'bank', label: 'Bancos', icon: '<path d="M3 10 L12 3 L21 10 Z"/><line x1="4" y1="10" x2="4" y2="19"/><line x1="9" y1="10" x2="9" y2="19"/><line x1="15" y1="10" x2="15" y2="19"/><line x1="20" y1="10" x2="20" y2="19"/><line x1="2" y1="20" x2="22" y2="20"/>' },
  { key: 'offices', label: 'Oficinas', icon: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7 V5 a2 2 0 0 1 2 -2 h4 a2 2 0 0 1 2 2 V7"/><line x1="3" y1="12.5" x2="21" y2="12.5"/>' },
];

function svgIcono(icono, tamano) {
  return `<svg width="${tamano}" height="${tamano}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icono}</svg>`;
}

// Término de búsqueda en Nominatim para cada categoría, para poder calcular
// la distancia automáticamente. Es una búsqueda por relevancia (no hay un
// servicio gratuito fiable de "más cercano por categoría"), así que el
// resultado es una distancia aproximada en línea recta, no la ruta real.
const TERMINOS_BUSQUEDA_POI = {
  airport: 'aeropuerto',
  beach: 'playa',
  transport: 'estación de tren',
  schools: 'colegio',
  shopping: 'centro comercial',
  restaurants: 'restaurante',
  cafes: 'cafetería',
  gym: 'gimnasio',
  parks: 'parque',
  hospital: 'hospital',
  bank: 'banco',
  offices: 'oficinas',
};

// Distancia en línea recta entre dos puntos (fórmula de Haversine), en km.
function distanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatearDistancia(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

// Tiempo real en coche entre dos puntos, por carretera (OSRM: gratuito, sin
// clave). Devuelve minutos redondeados, o null si falla el servicio.
async function calcularTiempoEnCoche(lat1, lng1, lat2, lng2) {
  try {
    const respuesta = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=false`,
    );
    if (!respuesta.ok) return null;
    const datos = await respuesta.json();
    const ruta = datos.routes && datos.routes[0];
    if (!ruta) return null;
    return Math.round(ruta.duration / 60);
  } catch (error) {
    console.error('No se pudo calcular el tiempo en coche:', error);
    return null;
  }
}

function formatearTiempoCoche(minutos) {
  if (minutos < 1) return 'menos de 1 min en coche';
  if (minutos < 60) return `${minutos} min en coche`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return `${horas} h${resto ? ` ${resto} min` : ''} en coche`;
}

// Busca en Nominatim el resultado más relevante de una categoría cerca del
// punto dado (acotado a una caja de ~2 km), se queda con el más próximo en
// línea recta, y calcula el tiempo real en coche hasta él. Si la ruta falla,
// cae de vuelta a la distancia en línea recta en vez de no mostrar nada.
async function calcularDistanciaPOI(lat, lng, categoriaKey) {
  const termino = TERMINOS_BUSQUEDA_POI[categoriaKey];
  if (!termino) return null;
  const delta = 0.02; // aprox. 2 km alrededor del punto: buscamos algo cercano de verdad
  const params = new URLSearchParams({
    q: termino,
    format: 'json',
    limit: '8',
    bounded: '1',
    viewbox: `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`,
  });
  try {
    const respuesta = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
    if (!respuesta.ok) return null;
    const resultados = await respuesta.json();
    if (!resultados.length) return null;
    // Nominatim ordena por relevancia, no por cercanía — de los resultados
    // dentro de la zona nos quedamos con el que esté realmente más cerca,
    // en vez de asumir que el primero (más "importante") es el más próximo.
    let masCercano = null;
    let distanciaMinima = Infinity;
    for (const resultado of resultados) {
      const km = distanciaKm(lat, lng, parseFloat(resultado.lat), parseFloat(resultado.lon));
      if (km < distanciaMinima) {
        distanciaMinima = km;
        masCercano = resultado;
      }
    }
    if (!masCercano) return null;
    const minutos = await calcularTiempoEnCoche(lat, lng, parseFloat(masCercano.lat), parseFloat(masCercano.lon));
    return minutos != null ? formatearTiempoCoche(minutos) : formatearDistancia(distanciaMinima);
  } catch (error) {
    console.error('No se pudo calcular la distancia para', categoriaKey, error);
    return null;
  }
}

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
const pdfVersionesLista = document.getElementById('pdf-versiones-lista');
const preview = document.getElementById('dossier-preview');
const dossierPreviewEditando = document.getElementById('dossier-preview-editando');
const dossierPreviewAcciones = document.getElementById('dossier-preview-acciones');
const logoutBtn = document.getElementById('logout-btn');

let dossierActualId = null; // null mientras se está creando uno nuevo
let dossierActual = {};
let galeriaSeleccionada = []; // archivos NUEVOS de la galería pendientes de subir, con su pie de foto: {file, caption}
let galeriaExistente = []; // fotos que ya tenía el dossier (menos las quitadas): {url, caption}
let coverExistenteUrl = null; // URL de portada que ya tenía el dossier (null si se quitó)
let floorplanExistenteUrl = null; // igual, para el plano
let puntosInteres = {}; // { [categoria]: detalleTexto } — solo entran las categorías marcadas
let mapaLat = null;
let mapaLng = null;

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

// --- Igual, pero con un campo de texto debajo para el pie de foto ---
function crearPreviewConPie(urlImagen, pieInicial, alQuitar, alCambiarPie) {
  const envoltorio = crearPreviewItem(urlImagen, alQuitar);
  envoltorio.classList.add('dossier-file-preview-item-con-pie');
  const inputPie = document.createElement('input');
  inputPie.type = 'text';
  inputPie.className = 'dossier-file-pie';
  inputPie.placeholder = 'Pie de foto';
  inputPie.value = pieInicial || '';
  inputPie.addEventListener('input', () => alCambiarPie(inputPie.value));
  envoltorio.appendChild(inputPie);
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
  Array.from(inputGallery.files).forEach((file) => galeriaSeleccionada.push({ file, caption: '' }));
  inputGallery.value = ''; // permite reabrir el selector y seguir añadiendo
  renderPreviewGaleria();
});

function renderPreviewGaleria() {
  previewGallery.innerHTML = '';

  galeriaExistente.forEach((foto, indice) => {
    previewGallery.appendChild(crearPreviewConPie(
      foto.url,
      foto.caption,
      () => { galeriaExistente.splice(indice, 1); renderPreviewGaleria(); },
      (nuevoTexto) => { foto.caption = nuevoTexto; },
    ));
  });

  galeriaSeleccionada.forEach((item, indice) => {
    previewGallery.appendChild(crearPreviewConPie(
      URL.createObjectURL(item.file),
      item.caption,
      () => { galeriaSeleccionada.splice(indice, 1); renderPreviewGaleria(); },
      (nuevoTexto) => { item.caption = nuevoTexto; },
    ));
  });
}

logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem('admin-token');
  window.location.href = 'admin.html';
});

// --- Rejilla de puntos de interés (casillas con icono + detalle opcional) ---
const poiGrid = document.getElementById('poi-grid');

function renderGridPOI() {
  poiGrid.innerHTML = '';
  CATEGORIAS_POI.forEach((categoria) => {
    const marcado = Object.prototype.hasOwnProperty.call(puntosInteres, categoria.key);

    const item = document.createElement('div');
    item.className = 'poi-item' + (marcado ? ' poi-item-activo' : '');

    const cabecera = document.createElement('label');
    cabecera.className = 'poi-item-cabecera';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = marcado;

    const icono = document.createElement('span');
    icono.className = 'poi-icono';
    icono.innerHTML = svgIcono(categoria.icon, 20);

    const etiqueta = document.createElement('span');
    etiqueta.textContent = categoria.label;

    cabecera.appendChild(checkbox);
    cabecera.appendChild(icono);
    cabecera.appendChild(etiqueta);
    item.appendChild(cabecera);

    const detalle = document.createElement('input');
    detalle.type = 'text';
    detalle.className = 'poi-detalle';
    detalle.placeholder = 'Distancia (se calcula sola, o escríbela tú)';
    detalle.value = puntosInteres[categoria.key] || '';
    detalle.hidden = !marcado;
    detalle.addEventListener('input', () => {
      puntosInteres[categoria.key] = detalle.value;
    });
    item.appendChild(detalle);

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        puntosInteres[categoria.key] = detalle.value;
        detalle.hidden = false;
        item.classList.add('poi-item-activo');

        // Si ya tenemos la ubicación geocodificada y no hay una distancia
        // puesta a mano, la calculamos sola (aproximada, línea recta).
        if (mapaLat != null && mapaLng != null && !detalle.value) {
          detalle.value = 'Calculando…';
          calcularDistanciaPOI(mapaLat, mapaLng, categoria.key).then((resultado) => {
            if (!checkbox.checked) return;
            detalle.value = resultado || '';
            puntosInteres[categoria.key] = resultado || '';
            renderPreview();
          });
        }
      } else {
        delete puntosInteres[categoria.key];
        detalle.hidden = true;
        item.classList.remove('poi-item-activo');
      }
    });

    poiGrid.appendChild(item);
  });
}

// --- Mapa de ubicación: dirección/zona -> coordenadas (Nominatim) -> mapa (Leaflet) ---
const mapaPreview = document.getElementById('mapa-preview');
const mapaStatus = document.getElementById('mapa-status');
const inputDireccion = document.getElementById('d-address');
const inputZona = document.getElementById('d-region');

async function buscarEnNominatim(params) {
  const respuesta = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
  if (!respuesta.ok) return null;
  const resultados = await respuesta.json();
  if (resultados.length === 0) return null;
  return { lat: Number(resultados[0].lat), lng: Number(resultados[0].lon) };
}

// Intenta varias formas de búsqueda, de la más precisa a la más amplia,
// porque la búsqueda de texto libre de Nominatim es muy sensible al orden
// exacto en que se escribe la dirección.
async function geocodificarDireccion(direccion, zona) {
  // 1) Búsqueda "estructurada": calle + ciudad por separado (más fiable)
  if (direccion) {
    const params = new URLSearchParams({ format: 'json', limit: '1', country: 'España' });
    params.set('street', direccion);
    if (zona) params.set('city', zona);
    const resultado = await buscarEnNominatim(params);
    if (resultado) return resultado;
  }

  // 2) Búsqueda de texto libre con dirección + zona juntas
  if (direccion && zona) {
    const params = new URLSearchParams({ format: 'json', limit: '1', q: `${direccion}, ${zona}, España` });
    const resultado = await buscarEnNominatim(params);
    if (resultado) return resultado;
  }

  // 3) Solo la zona (da una ubicación aproximada, mejor que nada)
  if (zona) {
    const params = new URLSearchParams({ format: 'json', limit: '1', q: `${zona}, España` });
    const resultado = await buscarEnNominatim(params);
    if (resultado) return { ...resultado, aproximado: true };
  }

  return null;
}

// Guarda la última imagen del mapa ya "congelada" (para usarla en el PDF sin
// tener que volver a generarla cada vez que se repinta la vista previa)
let mapaImagenDataUrl = null;

const TILE_SIZE = 256;

// Convierte lat/lng a "coordenadas de tesela" (con decimales) al zoom dado.
// Es la fórmula estándar de mapas tipo slippy-map (la misma que usan OSM/Google).
function latLngATesela(lat, lng, zoom) {
  const n = 2 ** zoom;
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

// Dibuja el rombo + skyline del logo (en blanco) centrado en (cx, cy),
// escalado a "tamano" px — mismas proporciones que favicon.svg / la topbar.
function dibujarLogoEnCanvas(ctx, cx, cy, tamano) {
  const escala = tamano / 80;
  ctx.save();
  ctx.translate(cx - tamano / 2, cy - tamano / 2);
  ctx.scale(escala, escala);

  ctx.beginPath();
  ctx.moveTo(40, 6);
  ctx.lineTo(74, 40);
  ctx.lineTo(40, 74);
  ctx.lineTo(6, 40);
  ctx.closePath();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(26, 38, 6, 16);
  ctx.fillRect(37, 28, 6, 26);
  ctx.fillRect(48, 34, 6, 20);

  ctx.restore();
}

function cargarImagen(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Construye la imagen del mapa descargando directamente las teselas de OSM y
// dibujándolas en un <canvas>, con un marcador propio encima. No depende de
// ninguna librería de mapas ni de capturar un mapa "en vivo" — por eso es
// mucho más fiable que las alternativas anteriores.
async function generarImagenMapa(lat, lng, zoom = 17, anchoPx = 800, altoPx = 400) {
  const centro = latLngATesela(lat, lng, zoom);
  const centroPxX = centro.x * TILE_SIZE;
  const centroPxY = centro.y * TILE_SIZE;
  const origenX = centroPxX - anchoPx / 2;
  const origenY = centroPxY - altoPx / 2;

  const tileMinX = Math.floor(origenX / TILE_SIZE);
  const tileMaxX = Math.floor((origenX + anchoPx) / TILE_SIZE);
  const tileMinY = Math.floor(origenY / TILE_SIZE);
  const tileMaxY = Math.floor((origenY + altoPx) / TILE_SIZE);

  const canvas = document.createElement('canvas');
  canvas.width = anchoPx;
  canvas.height = altoPx;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#DCE7E5';
  ctx.fillRect(0, 0, anchoPx, altoPx);

  const cargas = [];
  for (let tx = tileMinX; tx <= tileMaxX; tx++) {
    for (let ty = tileMinY; ty <= tileMaxY; ty++) {
      cargas.push(
        cargarImagen(`https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`).then((img) => {
          if (!img) return;
          ctx.drawImage(img, tx * TILE_SIZE - origenX, ty * TILE_SIZE - origenY, TILE_SIZE, TILE_SIZE);
        }),
      );
    }
  }
  await Promise.all(cargas);

  // Marcador propio en el centro exacto (el punto que se geocodificó):
  // círculo azul con el rombo del logo dibujado dentro, en blanco.
  const cx = anchoPx / 2;
  const cy = altoPx / 2;
  const radioMarcador = 18;

  ctx.beginPath();
  ctx.arc(cx, cy, radioMarcador, 0, Math.PI * 2);
  ctx.fillStyle = '#1D4ED8';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();

  dibujarLogoEnCanvas(ctx, cx, cy, radioMarcador * 1.2);

  return canvas.toDataURL('image/png');
}

// Rellena la distancia de los puntos de interés ya marcados que aún no
// tengan una (p. ej. si se marcaron antes de tener la ubicación en el mapa).
async function rellenarDistanciasFaltantes(lat, lng) {
  const pendientes = Object.keys(puntosInteres).filter((key) => !puntosInteres[key]);
  if (!pendientes.length) return;
  await Promise.all(pendientes.map(async (key) => {
    const resultado = await calcularDistanciaPOI(lat, lng, key);
    if (!resultado) return;
    puntosInteres[key] = resultado;
    const indice = CATEGORIAS_POI.findIndex((c) => c.key === key);
    const input = poiGrid.children[indice]?.querySelector('.poi-detalle');
    if (input) input.value = resultado;
  }));
}

async function mostrarMapa(lat, lng) {
  mapaPreview.innerHTML = '<p class="mapa-vacio">Generando mapa…</p>';
  try {
    mapaImagenDataUrl = await generarImagenMapa(lat, lng);
    mapaPreview.innerHTML = `<img src="${mapaImagenDataUrl}" alt="Mapa de ubicación" class="mapa-imagen">`;
    await rellenarDistanciasFaltantes(lat, lng);
  } catch (error) {
    console.error('No se pudo generar el mapa:', error);
    mapaStatus.textContent = 'No se pudo generar la imagen del mapa: ' + error.message;
    mapaStatus.className = 'form-status error';
  }
  renderPreview();
}

async function actualizarMapaDesdeFormulario() {
  const direccion = inputDireccion.value.trim();
  const zona = inputZona.value.trim();
  if (!direccion && !zona) {
    mapaPreview.innerHTML = '<p class="mapa-vacio">Escribe la dirección y la zona, luego pulsa "Buscar en el mapa".</p>';
    mapaLat = null;
    mapaLng = null;
    return;
  }
  mapaStatus.textContent = 'Buscando ubicación…';
  mapaStatus.className = 'form-status';
  try {
    const coords = await geocodificarDireccion(direccion, zona);
    if (!coords) {
      mapaStatus.textContent = 'No se encontró esa dirección en el mapa. Prueba a simplificarla (solo calle y número) o escribe solo la zona/ciudad. Puedes seguir guardando el dossier igualmente.';
      mapaStatus.className = 'form-status error';
      return;
    }
    mapaLat = coords.lat;
    mapaLng = coords.lng;
    await mostrarMapa(coords.lat, coords.lng);
    mapaStatus.textContent = coords.aproximado
      ? 'No se encontró la dirección exacta — mostrando la ubicación aproximada de la zona.'
      : '';
    mapaStatus.className = coords.aproximado ? 'form-status' : 'form-status ok';
  } catch (error) {
    mapaStatus.textContent = 'No se pudo generar el mapa: ' + error.message;
    mapaStatus.className = 'form-status error';
  }
}

document.getElementById('buscar-mapa-btn').addEventListener('click', actualizarMapaDesdeFormulario);

function escapeHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

function formatearPrecio(precio) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(precio);
}

// --- Selector de moneda de visualización (solo orientativo, no vinculante) ---
let tasasCambio = null; // caché: { USD: 1.14, GBP: 0.85 }

async function obtenerTasasCambio() {
  if (tasasCambio) return tasasCambio;
  try {
    const respuesta = await fetch('https://api.frankfurter.dev/v1/latest?from=EUR&to=USD,GBP');
    if (!respuesta.ok) return null;
    const datos = await respuesta.json();
    tasasCambio = datos.rates;
    return tasasCambio;
  } catch (error) {
    console.error('No se pudieron obtener las tasas de cambio:', error);
    return null;
  }
}

document.getElementById('d-currency').addEventListener('change', async (evento) => {
  if (evento.target.value !== 'EUR') await obtenerTasasCambio();
  renderPreview();
});

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
    todosLosDossiers = dossiers; // caché reutilizada también para la comparativa de precio/m²
    renderListaDossiers(dossiers);
    dossiersStatus.textContent = `${dossiers.length} dossier(s)`;
    dossiersStatus.className = 'form-status ok';
    renderPreview();
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
  galeriaExistente = dossier?.gallery && dossier.gallery.length
    ? dossier.gallery.map((foto) => ({ ...foto }))
    : (dossier?.gallery_urls || []).map((url) => ({ url, caption: '' }));
  renderPreviewUnico(previewCover, coverExistenteUrl, inputCover);
  renderPreviewUnico(previewFloorplan, floorplanExistenteUrl, inputFloorplan);
  renderPreviewGaleria();

  puntosInteres = {};
  (dossier?.points_of_interest || []).forEach((p) => { puntosInteres[p.category] = p.detail || ''; });
  renderGridPOI();

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
  document.getElementById('d-currency').value = 'EUR';
  document.getElementById('d-insurance').value = dossier?.annual_insurance_estimate ?? '';
  document.getElementById('d-build-year').value = dossier?.build_year ?? '';
  document.getElementById('d-renovation-year').value = dossier?.renovation_year ?? '';
  document.getElementById('d-orientation').value = dossier?.orientation || '';
  document.getElementById('d-garage').value = dossier?.garage_spaces ?? '';
  document.getElementById('d-furnished').value = dossier?.furnished || '';
  document.getElementById('d-storage').checked = !!dossier?.storage_room;
  document.getElementById('d-cadastral').value = dossier?.cadastral_reference || '';
  document.getElementById('d-legal-status').value = dossier?.legal_status || '';

  mapaLat = dossier?.lat ?? null;
  mapaLng = dossier?.lng ?? null;
  mapaImagenDataUrl = null;
  mapaStatus.textContent = '';
  if (mapaLat && mapaLng) {
    setTimeout(() => mostrarMapa(mapaLat, mapaLng), 0);
  } else {
    mapaPreview.innerHTML = '<p class="mapa-vacio">Escribe la dirección y la zona, luego pulsa "Buscar en el mapa".</p>';
  }

  if (dossier?.pdf_url) {
    verPdfLink.href = dossier.pdf_url;
    verPdfLink.hidden = false;
  }
  renderVersionesPdf(dossier?.pdf_versions || []);

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
      ...(dossier.gallery || []).map((foto) => extraerRutaStorage(foto.url)),
      ...(dossier.pdf_versions || []).map((v) => extraerRutaStorage(v.url)),
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

// Dibuja el rombo + skyline del logo como marca de agua semitransparente en
// la esquina inferior derecha: blanco con un contorno oscuro fino detrás,
// para que se lea igual sobre fotos claras y oscuras.
function dibujarMarcaDeAgua(ctx, anchoPx, altoPx) {
  const tamano = Math.max(36, Math.min(anchoPx, altoPx) * 0.12);
  const margen = tamano * 0.4;
  const cx = anchoPx - tamano / 2 - margen;
  const cy = altoPx - tamano / 2 - margen;
  const escala = tamano / 80;

  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.translate(cx - tamano / 2, cy - tamano / 2);
  ctx.scale(escala, escala);

  ctx.beginPath();
  ctx.moveTo(40, 6);
  ctx.lineTo(74, 40);
  ctx.lineTo(40, 74);
  ctx.lineTo(6, 40);
  ctx.closePath();
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(78, 65, 59, 0.7)';
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();

  ctx.fillStyle = 'rgba(78, 65, 59, 0.5)';
  ctx.fillRect(25.5, 37.5, 7, 17);
  ctx.fillRect(36.5, 27.5, 7, 27);
  ctx.fillRect(47.5, 33.5, 7, 21);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(26, 38, 6, 16);
  ctx.fillRect(37, 28, 6, 26);
  ctx.fillRect(48, 34, 6, 20);

  ctx.restore();
}

// Estampa la marca de agua sobre una imagen subida por el usuario y devuelve
// un nuevo File con el resultado. Si algo falla, se sube la imagen original
// sin marca en vez de bloquear la subida.
function aplicarMarcaDeAgua(file) {
  return new Promise((resolve) => {
    const lector = new FileReader();
    lector.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        dibujarMarcaDeAgua(ctx, canvas.width, canvas.height);
        const tipoSalida = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        canvas.toBlob((blob) => {
          resolve(blob ? new File([blob], file.name, { type: tipoSalida }) : file);
        }, tipoSalida, 0.92);
      };
      img.onerror = () => resolve(file);
      img.src = lector.result;
    };
    lector.onerror = () => resolve(file);
    lector.readAsDataURL(file);
  });
}

// --- Subir una imagen a Supabase Storage, devuelve la URL pública ---
async function subirImagen(file, carpeta, conMarcaDeAgua = false) {
  const archivoFinal = (conMarcaDeAgua && file.type.startsWith('image/'))
    ? await aplicarMarcaDeAgua(file)
    : file;
  const nombreArchivo = `${carpeta}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
  const respuesta = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${nombreArchivo}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': archivoFinal.type,
    },
    body: archivoFinal,
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
      points_of_interest: Object.entries(puntosInteres).map(([category, detail]) => ({ category, detail })),
      lat: mapaLat,
      lng: mapaLng,
      annual_insurance_estimate: document.getElementById('d-insurance').value ? Number(document.getElementById('d-insurance').value) : null,
      build_year: document.getElementById('d-build-year').value ? Number(document.getElementById('d-build-year').value) : null,
      renovation_year: document.getElementById('d-renovation-year').value ? Number(document.getElementById('d-renovation-year').value) : null,
      orientation: document.getElementById('d-orientation').value || null,
      garage_spaces: document.getElementById('d-garage').value ? Number(document.getElementById('d-garage').value) : null,
      furnished: document.getElementById('d-furnished').value || null,
      storage_room: document.getElementById('d-storage').checked,
      cadastral_reference: document.getElementById('d-cadastral').value || null,
      legal_status: document.getElementById('d-legal-status').value || null,
    };

    // Portada: archivo nuevo > la que ya había (si no se quitó) > ninguna
    datos.cover_image_url = inputCover.files[0]
      ? await subirImagen(inputCover.files[0], 'portadas', true)
      : coverExistenteUrl;

    // Plano: mismo criterio
    datos.floor_plan_url = inputFloorplan.files[0]
      ? await subirImagen(inputFloorplan.files[0], 'planos', true)
      : floorplanExistenteUrl;

    // Galería: las que ya había (menos las quitadas) + las nuevas subidas, con sus pies de foto
    const fotosGaleria = galeriaExistente.map((foto) => ({ url: foto.url, caption: foto.caption || null }));
    for (const item of galeriaSeleccionada) {
      const url = await subirImagen(item.file, 'galeria', true);
      fotosGaleria.push({ url, caption: item.caption || null });
    }
    datos.gallery = fotosGaleria;

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
    galeriaExistente = (dossierGuardado.gallery || []).map((foto) => ({ ...foto }));
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
// Orden inspirado en dossiers comerciales profesionales (tipo Pryconsa):
// portada -> ubicación -> datos técnicos -> descripción -> galería con pies
// de foto -> plano -> puntos de interés con icono -> contacto.
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
  const moneda = document.getElementById('d-currency').value;
  const seguro = document.getElementById('d-insurance').value;
  const anoConstruccion = document.getElementById('d-build-year').value;
  const anoReforma = document.getElementById('d-renovation-year').value;
  const orientacion = document.getElementById('d-orientation').value;
  const garaje = document.getElementById('d-garage').value;
  const amueblado = document.getElementById('d-furnished').value;
  const trastero = document.getElementById('d-storage').checked;
  const catastro = document.getElementById('d-cadastral').value;
  const situacionLegal = document.getElementById('d-legal-status').value;

  const ETIQUETAS_ORIENTACION = { norte: 'Norte', sur: 'Sur', este: 'Este', oeste: 'Oeste', noreste: 'Noreste', noroeste: 'Noroeste', sureste: 'Sureste', suroeste: 'Suroeste' };
  const ETIQUETAS_AMUEBLADO = { si: 'Sí', no: 'No', parcial: 'Parcialmente' };

  // Precio mostrado en portada: convertido si se eligió otra moneda (las
  // tasas se cargan al cambiar el selector; si aún no llegan, se muestra en €).
  let precioMostrado = precio ? formatearPrecio(Number(precio)) : '';
  let notaMoneda = '';
  if (precio && moneda !== 'EUR') {
    if (tasasCambio && tasasCambio[moneda]) {
      const convertido = Number(precio) * tasasCambio[moneda];
      const simbolo = moneda === 'USD' ? '$' : '£';
      precioMostrado = `${simbolo}${Math.round(convertido).toLocaleString('es-ES')} <small>(${formatearPrecio(Number(precio))})</small>`;
      notaMoneda = 'Tipo de cambio orientativo, no vinculante.';
    } else {
      precioMostrado += ' (convirtiendo…)';
    }
  }

  // Gasto anual total aproximado: IBI + comunidad (mensual → anual) + seguro estimado
  const costeAnual = (ibi ? Number(ibi) : 0) + (comunidad ? Number(comunidad) * 12 : 0) + (seguro ? Number(seguro) : 0);

  // Comparativa de precio/m² frente a otros dossiers de la misma zona (solo datos internos)
  const comparativa = compararPrecioM2(dossierActualId, zona, precio ? Number(precio) : null, superficie ? Number(superficie) : null);

  // Precio/m² comparado con la zona: mismo dato ya calculado arriba, solo
  // cambia cómo se presenta (número grande + una línea de contexto).
  let precioM2Valor = '';
  let precioM2Caption = '';
  if (comparativa) {
    precioM2Valor = `${comparativa.precioM2.toFixed(0)} €/m²`;
    if (comparativa.mediaM2) {
      const diferencia = ((comparativa.precioM2 - comparativa.mediaM2) / comparativa.mediaM2) * 100;
      precioM2Caption = diferencia > 5
        ? `↑ ${diferencia.toFixed(0)}% vs. media de "${escapeHtml(zona)}"`
        : diferencia < -5
          ? `↓ ${Math.abs(diferencia).toFixed(0)}% vs. media de "${escapeHtml(zona)}"`
          : `En línea con la media de "${escapeHtml(zona)}"`;
    } else {
      precioM2Caption = `Sin otros inmuebles en "${escapeHtml(zona)}" para comparar todavía`;
    }
  }

  const portada = dossierActual.cover_image_url || '';
  const plano = dossierActual.floor_plan_url || '';
  const galeria = dossierActual.gallery && dossierActual.gallery.length
    ? dossierActual.gallery
    : (dossierActual.gallery_urls || []).map((url) => ({ url, caption: null }));

  // Si hay más de 6 fotos, mostramos solo las 5 primeras + una tesela
  // "+N fotos más" en vez de alargar la página con toda la galería.
  const galeriaDesborda = galeria.length > 6;
  const galeriaVisible = galeriaDesborda ? galeria.slice(0, 5) : galeria;
  const galeriaRestantes = galeriaDesborda ? galeria.length - 5 : 0;

  // Puntos de interés agrupados en Movilidad / Servicios / Ocio para la
  // sección de ubicación (en vez de una única rejilla de tarjetas).
  const gruposContexto = GRUPOS_CONTEXTO_POI
    .map((grupo) => ({
      titulo: grupo.titulo,
      items: CATEGORIAS_POI.filter((c) => grupo.keys.includes(c.key) && Object.prototype.hasOwnProperty.call(puntosInteres, c.key)),
    }))
    .filter((grupo) => grupo.items.length);

  // Barra de estadísticas de portada de la página de datos
  const statsBarra = [
    superficie ? { valor: `${superficie} m²`, etiqueta: 'Superficie' } : null,
    habitaciones ? { valor: habitaciones, etiqueta: 'Habitaciones' } : null,
    banos ? { valor: banos, etiqueta: 'Baños' } : null,
    garaje ? { valor: garaje, etiqueta: 'Garaje' } : null,
    orientacion ? { valor: ETIQUETAS_ORIENTACION[orientacion] || orientacion, etiqueta: 'Orientación' } : null,
  ].filter(Boolean);

  const badgesEstado = [situacionLegal || null, energia ? `Cert. energético ${energia}` : null].filter(Boolean);

  // "Datos de la vivienda" en 3 grupos (Distribución / Estado / Gastos) en
  // vez de una única lista plana de todos los campos.
  const grupoDistribucion = [
    superficie ? { etiqueta: 'Superficie construida', valor: `${superficie} m²` } : null,
    habitaciones ? { etiqueta: 'Habitaciones', valor: habitaciones } : null,
    banos ? { etiqueta: 'Baños', valor: banos } : null,
    trastero ? { etiqueta: 'Trastero', valor: 'Sí' } : null,
  ].filter(Boolean);

  const grupoEstadoVivienda = [
    anoConstruccion ? { etiqueta: 'Año construcción', valor: anoConstruccion } : null,
    anoReforma ? { etiqueta: 'Última reforma', valor: anoReforma } : null,
    amueblado ? { etiqueta: 'Amueblado', valor: ETIQUETAS_AMUEBLADO[amueblado] || amueblado } : null,
  ].filter(Boolean);

  const grupoGastos = [
    comunidad ? { etiqueta: 'Comunidad', valor: `${comunidad} €/mes` } : null,
    ibi ? { etiqueta: 'IBI anual', valor: `${ibi} €` } : null,
    energia ? { etiqueta: 'Cert. energético', valor: energia } : null,
  ].filter(Boolean);

  function renderGrupoDatos(titulo, filas) {
    if (!filas.length) return '';
    return `<div>
      <span class="pdf-datos-grupo-titulo">${escapeHtml(titulo)}</span>
      ${filas.map((f) => `<div class="pdf-datos-fila"><span>${escapeHtml(f.etiqueta)}</span><b>${escapeHtml(String(f.valor))}</b></div>`).join('')}
    </div>`;
  }

  const estadoVenta = dossierActual.sale_status || 'available';
  const etiquetaEstadoVenta = ETIQUETAS_ESTADO_VENTA[estadoVenta] || 'Disponible';
  const referenciaDossier = 'ISP-' + (dossierActualId ? dossierActualId.replace(/-/g, '').slice(0, 4).toUpperCase() : '0000');

  const numeroWhatsapp = CONTACTO_TELEFONO.replace(/[^0-9]/g, '');
  const mensajeWhatsapp = encodeURIComponent(`Hola, me interesa el inmueble "${titulo}"`);
  const inicialContacto = CONTACTO_NOMBRE.trim().charAt(0).toUpperCase();

  const cabeceraPagina = (numeroPagina) => `
    <div class="pdf-cabecera">
      <span class="pdf-cabecera-marca"><span class="pdf-cabecera-rombo"></span>Invest Spain Properties</span>
      <span class="pdf-cabecera-ref">${referenciaDossier} · ${numeroPagina}/04</span>
    </div>`;

  const piePagina = (esUltima) => `
    <div class="pdf-pie">
      <span>Invest Spain Properties</span>
      <span>${esUltima ? 'Be First. · Documento de trabajo, no final' : 'Documento de trabajo, no final'}</span>
    </div>`;

  preview.innerHTML = `
    <div class="dossier-pdf">

      <section class="pdf-pagina pdf-portada">
        <div class="pdf-portada-marca">
          <div class="pdf-portada-rombo"></div>
          <div class="pdf-portada-marca-nombre">Invest Spain Properties</div>
          <div class="pdf-portada-marca-ref">Dossier confidencial · Ref. ${referenciaDossier}</div>
        </div>

        <div class="pdf-portada-titular">
          <h1>${escapeHtml(titulo)}</h1>
          <div class="pdf-portada-eslogan">Be First.</div>
        </div>

        ${descripcion ? `<p class="pdf-portada-texto">${escapeHtml(descripcion)}</p>` : ''}

        <div class="pdf-portada-foto">
          <span class="pdf-badge-estado">${escapeHtml(etiquetaEstadoVenta)}</span>
          ${portada ? `<img src="${portada}" alt="">` : ''}
          ${!portada ? '<span class="pdf-portada-foto-caption">imagen de ejemplo</span>' : ''}
        </div>

        <div class="pdf-portada-precio-bloque">
          ${precio ? `<div class="pdf-portada-precio">${precioMostrado}</div>` : ''}
          ${notaMoneda ? `<small class="pdf-portada-nota-moneda">${notaMoneda}</small>` : ''}
          <div class="pdf-portada-direccion">${escapeHtml([direccion, zona].filter(Boolean).join(' · '))}</div>
        </div>

        <div class="pdf-portada-disclaimer">Documento de trabajo · Uso exclusivo del destinatario</div>
      </section>

      <section class="pdf-pagina">
        ${cabeceraPagina('02')}

        ${statsBarra.length ? `
        <div class="pdf-bloque pdf-stats">
          ${statsBarra.map((s) => `<div class="pdf-stats-item"><b>${escapeHtml(String(s.valor))}</b><span>${escapeHtml(s.etiqueta)}</span></div>`).join('')}
        </div>` : ''}

        ${(precioM2Valor || costeAnual) ? `
        <div class="pdf-bloque">
          <span class="pdf-eyebrow">Para inversores</span>
          <h2 class="pdf-seccion-titulo">Radiografía de la inversión</h2>
          <div class="pdf-radiografia">
            ${precioM2Valor ? `
            <div class="pdf-radiografia-item">
              <span class="pdf-eyebrow">Precio por m²</span>
              <b>${precioM2Valor}</b>
              ${precioM2Caption ? `<small>${precioM2Caption}</small>` : ''}
            </div>` : ''}
            ${costeAnual ? `
            <div class="pdf-radiografia-item">
              <span class="pdf-eyebrow">Mantenimiento anual</span>
              <b>≈ ${formatearPrecio(costeAnual)}</b>
              <small>IBI + comunidad + seguro est.</small>
            </div>` : ''}
          </div>
        </div>` : ''}

        ${badgesEstado.length ? `
        <div class="pdf-bloque pdf-badges">
          ${badgesEstado.map((b) => `<span class="pdf-badge">${escapeHtml(b)}</span>`).join('')}
        </div>` : ''}
        ${catastro ? `<p class="pdf-ref-catastral">Ref. catastral: ${escapeHtml(catastro)}</p>` : ''}

        ${descripcion ? `
        <div class="pdf-bloque">
          <span class="pdf-eyebrow">Descripción</span>
          <p class="pdf-descripcion">${escapeHtml(descripcion).replace(/\n/g, '<br>')}</p>
        </div>` : ''}

        ${(grupoDistribucion.length || grupoEstadoVivienda.length || grupoGastos.length) ? `
        <div class="pdf-bloque">
          <span class="pdf-eyebrow">Datos de la vivienda</span>
          <div class="pdf-datos-vivienda">
            ${renderGrupoDatos('Distribución', grupoDistribucion)}
            ${renderGrupoDatos('Estado', grupoEstadoVivienda)}
            ${renderGrupoDatos('Gastos', grupoGastos)}
          </div>
        </div>` : ''}

        ${piePagina(false)}
      </section>

      <section class="pdf-pagina">
        ${cabeceraPagina('03')}

        <div class="pdf-bloque">
          <span class="pdf-eyebrow">Contexto</span>
          <h2 class="pdf-seccion-titulo">Ubicación y puntos de interés</h2>

          <div class="pdf-mapa-caja">
            ${mapaImagenDataUrl ? `<img src="${mapaImagenDataUrl}" alt="Mapa de ubicación">` : ''}
            <span class="pdf-mapa-caption">${escapeHtml([direccion, zona].filter(Boolean).join(' · ')) || 'mapa — pendiente de dirección'}</span>
          </div>

          ${gruposContexto.length ? `
          <div class="pdf-contexto">
            ${gruposContexto.map((grupo) => `
              <div class="pdf-contexto-columna">
                <span class="pdf-eyebrow">${escapeHtml(grupo.titulo)}</span>
                ${grupo.items.map((c) => `
                  <div class="pdf-contexto-fila">
                    <span>${escapeHtml(c.label)}</span>
                    ${puntosInteres[c.key] ? `<b>${escapeHtml(puntosInteres[c.key])}</b>` : ''}
                  </div>
                `).join('')}
              </div>
            `).join('')}
          </div>` : ''}

          ${areaInfo ? `<p class="pdf-notas-zona">${escapeHtml(areaInfo).replace(/\n/g, '<br>')}</p>` : ''}
        </div>

        ${galeria.length ? `
        <div class="pdf-bloque">
          <span class="pdf-eyebrow">Galería</span>
          <div class="pdf-galeria">
            ${galeriaVisible.map((foto) => `
              <figure>
                <img src="${foto.url}">
                ${foto.caption ? `<figcaption>${escapeHtml(foto.caption)}</figcaption>` : ''}
              </figure>
            `).join('')}
            ${galeriaRestantes ? `<div class="pdf-galeria-mas">+${galeriaRestantes} fotos más</div>` : ''}
          </div>
        </div>` : ''}

        ${piePagina(false)}
      </section>

      <section class="pdf-pagina">
        ${cabeceraPagina('04')}

        ${plano ? `
        <div class="pdf-bloque">
          <span class="pdf-eyebrow">Distribución</span>
          <h2 class="pdf-seccion-titulo">Plano de planta</h2>
          <div class="pdf-plano-caja"><img src="${plano}" alt="Plano de planta"></div>
        </div>` : ''}

        <div class="pdf-bloque">
          <span class="pdf-eyebrow">Contacto</span>
          <div class="pdf-contacto-bar">
            <div class="pdf-contacto-avatar">${escapeHtml(inicialContacto)}</div>
            <div class="pdf-contacto-info">
              <b>${escapeHtml(CONTACTO_NOMBRE)}</b>
              <span>${escapeHtml(CONTACTO_ROL)}</span>
            </div>
            <a class="pdf-contacto-whatsapp" href="https://wa.me/${numeroWhatsapp}?text=${mensajeWhatsapp}" target="_blank" rel="noopener">Escríbenos por WhatsApp →</a>
          </div>
          <p class="pdf-contacto-datos">${CONTACTO_EMAIL} · ${CONTACTO_TELEFONO}</p>
        </div>

        ${piePagina(true)}
      </section>

    </div>
  `;

  dossierPreviewEditando.hidden = !dossierActualId;
  if (dossierActualId) {
    dossierPreviewEditando.textContent = `Editando: ${titulo}`;
  }
  dossierPreviewAcciones.hidden = !dossierActualId;

  ajustarEncuadreFotos();
}

// Recorte inteligente: por defecto las fotos (portada/galería) se recortan
// centradas y ligeramente hacia arriba (para no cortar tejados/fachadas),
// pero si la proporción de la foto es muy distinta a la del hueco (el doble
// o más en cualquier sentido), se ajusta completa sin recortar en vez de
// perder contenido importante de la imagen.
function ajustarEncuadreFotos() {
  const imgs = preview.querySelectorAll('.pdf-portada-foto img, .pdf-galeria img');
  imgs.forEach((img) => {
    const ajustar = () => {
      if (!img.naturalWidth || !img.naturalHeight) return;
      const marco = img.parentElement.getBoundingClientRect();
      if (!marco.width || !marco.height) return;
      const ratioImagen = img.naturalWidth / img.naturalHeight;
      const ratioMarco = marco.width / marco.height;
      if (ratioImagen / ratioMarco > 2 || ratioMarco / ratioImagen > 2) {
        img.classList.add('pdf-foto-contain');
      }
    };
    if (img.complete) ajustar();
    else img.addEventListener('load', ajustar, { once: true });
  });
}

// Vuelve a pintar la vista previa en vivo mientras se rellena el formulario
dossierForm.addEventListener('input', renderPreview);

// Muestra el historial de PDFs generados (v1, v2, ...) de más reciente a más antiguo
function renderVersionesPdf(versiones) {
  if (!versiones || versiones.length === 0) {
    pdfVersionesLista.innerHTML = '';
    return;
  }
  pdfVersionesLista.innerHTML = [...versiones]
    .reverse()
    .map((v) => `<a href="${v.url}" target="_blank" rel="noopener">v${v.version}</a>`)
    .join('');
}

// --- Generar PDF a partir de la vista previa y subirlo a Storage ---
generarPdfBtn.addEventListener('click', async () => {
  if (!dossierActualId) {
    dossierFormStatus.textContent = 'Guarda el dossier antes de generar el PDF.';
    dossierFormStatus.className = 'form-status error';
    return;
  }
  generarPdfBtn.disabled = true;
  generarPdfBtn.textContent = 'Generando…';
  // Causa real del PDF en blanco (confirmada con pruebas automatizadas):
  // abrirEditor() hace scrollIntoView() al abrir el dossier, y si la página
  // queda desplazada (scroll > 0), html2canvas captura la zona equivocada y
  // el resultado sale en blanco. La solución es subir el scroll a 0 antes de
  // capturar — nada de matemáticas de compensación, eso es lo que fallaba.
  window.scrollTo(0, 0);
  // El panel de vista previa usa "position: sticky" para quedarse fijo al
  // hacer scroll; lo desactivamos también durante la captura por seguridad.
  const previewWrap = document.querySelector('.dossier-preview-wrap');
  const posicionOriginal = previewWrap.style.position;
  previewWrap.style.position = 'static';
  try {
    // Las fotos (portada, galería, plano) se cargan desde Supabase Storage,
    // así que pueden no estar completamente descargadas todavía aunque ya se
    // vean en pantalla. Si html2canvas empieza a capturar antes de que
    // terminen de cargar, el resultado puede salir en blanco o incompleto.
    const imagenesPendientes = Array.from(preview.querySelectorAll('img')).map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
    });
    await Promise.all(imagenesPendientes);
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    const pdfBlob = await html2pdf()
      .set({ html2canvas: { useCORS: true, scale: 2 } })
      .from(preview.firstElementChild)
      .outputPdf('blob');

    // Cada generación se guarda como una versión nueva (v1, v2, ...) en vez
    // de sobrescribir el archivo anterior, para poder ver el historial.
    const versionesExistentes = Array.isArray(dossierActual.pdf_versions) ? dossierActual.pdf_versions : [];
    const numeroVersion = versionesExistentes.length + 1;
    const nombreArchivo = `pdfs/${dossierActualId}-v${numeroVersion}.pdf`;

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
    const nuevasVersiones = [
      ...versionesExistentes,
      { version: numeroVersion, url: pdfUrl, created_at: new Date().toISOString() },
    ];
    const respuestaPatch = await fetch(`${SUPABASE_URL}/rest/v1/dossiers?id=eq.${dossierActualId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${getToken()}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ pdf_url: pdfUrl, pdf_versions: nuevasVersiones }),
    });
    if (!respuestaPatch.ok) throw new Error(`Error ${respuestaPatch.status}`);

    dossierActual.pdf_url = pdfUrl;
    dossierActual.pdf_versions = nuevasVersiones;
    verPdfLink.href = pdfUrl;
    verPdfLink.hidden = false;
    renderVersionesPdf(nuevasVersiones);
    dossierFormStatus.textContent = 'PDF generado correctamente.';
    dossierFormStatus.className = 'form-status ok';
    cargarDossiers();
  } catch (error) {
    dossierFormStatus.textContent = 'Error al generar el PDF: ' + error.message;
    dossierFormStatus.className = 'form-status error';
  } finally {
    previewWrap.style.position = posicionOriginal;
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

// --- Comparativa de precio/m² frente a otros dossiers de la misma zona ---
// (solo datos internos — nunca de fuentes externas). La usan tanto la vista
// previa del dossier principal como la pestaña de Seguimiento.
function compararPrecioM2(idActual, region, price, surfaceM2) {
  if (!price || !surfaceM2) return null;
  const precioM2 = price / surfaceM2;
  const comparables = todosLosDossiers.filter((d) =>
    d.id !== idActual &&
    d.region &&
    region &&
    d.region.trim().toLowerCase() === region.trim().toLowerCase() &&
    d.price && d.surface_m2,
  );
  if (comparables.length === 0) return { precioM2, mediaM2: null, comparables: 0 };
  const mediaM2 = comparables.reduce((suma, d) => suma + d.price / d.surface_m2, 0) / comparables.length;
  return { precioM2, mediaM2, comparables: comparables.length };
}

function renderComparativa(dossier) {
  if (!dossier.price || !dossier.surface_m2) {
    seguimientoComparativa.textContent = 'Añade precio y superficie en el dossier para ver la comparativa.';
    return;
  }
  const resultado = compararPrecioM2(dossier.id, dossier.region, dossier.price, dossier.surface_m2);

  if (!resultado.mediaM2) {
    seguimientoComparativa.innerHTML = `<b>${resultado.precioM2.toFixed(0)} €/m²</b> — todavía no hay otros inmuebles en "${escapeHtml(dossier.region)}" para comparar.`;
    return;
  }

  const diferencia = ((resultado.precioM2 - resultado.mediaM2) / resultado.mediaM2) * 100;
  const texto = diferencia > 5
    ? `un ${diferencia.toFixed(0)}% por encima de la media`
    : diferencia < -5
      ? `un ${Math.abs(diferencia).toFixed(0)}% por debajo de la media`
      : 'en línea con la media';

  seguimientoComparativa.innerHTML = `
    <b>${resultado.precioM2.toFixed(0)} €/m²</b> este inmueble.
    Media en "${escapeHtml(dossier.region)}" (${resultado.comparables} inmueble(s)): <b>${resultado.mediaM2.toFixed(0)} €/m²</b>.
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

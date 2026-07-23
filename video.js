// video.js — editor de vídeos promocionales cortos (35-40s) a partir de
// clips subidos, con subtítulos por clip, música fija y fundidos a blanco.
// Los datos del inmueble (si se elige uno) vienen de la misma tabla
// "dossiers" de Supabase que usa dossiers.js — no hace falta duplicar ni
// mover nada, cualquier página del panel puede leer esos datos igual.

const SUPABASE_URL = "https://uagmlfssbixytierxdib.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_8FvlGTc8ICk04jqAH0yzzg_Q84Jp1UQ";
const STORAGE_BUCKET = "dossiers";

// Mismos datos de contacto y misma paleta (Espresso/Coral) que usa la
// plantilla del PDF del dossier — así el vídeo y el PDF comparten
// identidad visual como piezas de la misma marca.
const CONTACTO_NOMBRE = "Jorge Celada";
const CONTACTO_ROL = "Asesor de inversión inmobiliaria internacional";
const CONTACTO_TELEFONO = "+34 682548468";
const CONTACTO_EMAIL = "jorgeceladaa2@gmail.com";
const COLOR_ESPRESSO = '#241C18';
const COLOR_CORAL = '#FF6B45';

function getToken() {
  return sessionStorage.getItem('admin-token');
}

if (!getToken()) {
  window.location.href = 'admin.html';
}

const inmuebleSelect = document.getElementById('v-inmueble');
const clipsInput = document.getElementById('v-clips');
const musicaBancoSelect = document.getElementById('v-musica-banco');
const musicaSubirZona = document.getElementById('v-musica-subir-zona');
const musicaInput = document.getElementById('v-musica');
const musicaGuardarCheckbox = document.getElementById('v-musica-guardar');
const musicaNombre = document.getElementById('v-musica-nombre');
const clipsVacio = document.getElementById('video-clips-vacio');
const clipsLista = document.getElementById('video-clips-lista');
const duracionBarra = document.getElementById('video-duracion-barra');
const duracionTotalEl = document.getElementById('v-duracion-total');
const canvas = document.getElementById('video-canvas');
const ctx = canvas.getContext('2d');
const videoResultado = document.getElementById('video-resultado');
const generarBtn = document.getElementById('generar-video-btn');
const descargaLink = document.getElementById('video-descarga-link');
const videoStatus = document.getElementById('video-status');
const logoutBtn = document.getElementById('logout-btn');
const repartirObjetivoInput = document.getElementById('v-repartir-objetivo');
const repartirBtn = document.getElementById('v-repartir-btn');

// Duración objetivo del vídeo final, en segundos (ver criterios del brief).
const DURACION_OBJETIVO_MIN = 35;
const DURACION_OBJETIVO_MAX = 40;
// Duración por defecto y mínima de cada clip recortado.
const DURACION_CLIP_DEFECTO = 5;
const DURACION_CLIP_MINIMA = 1;
// Duración del fundido a blanco al principio y al final de cada clip.
const FUNDIDO_S = 0.35;

let dossiersDisponibles = [];
let musicaFile = null;
let siguienteIdClip = 1;

// Cada clip: { id, file, url, nombre, duracionOriginal, inicio, duracion, subtitulo, videoEl }
const clips = [];

function escapeHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

function formatearPrecio(precio) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(precio);
}

// --- Cargar inmuebles (dossiers) para el selector ---
async function cargarInmuebles() {
  try {
    const respuesta = await fetch(
      `${SUPABASE_URL}/rest/v1/dossiers?select=id,title,address,region,price,bedrooms,surface_m2&order=created_at.desc`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${getToken()}` } },
    );
    if (respuesta.status === 401 || respuesta.status === 403) {
      sessionStorage.removeItem('admin-token');
      window.location.href = 'admin.html';
      return;
    }
    if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
    dossiersDisponibles = await respuesta.json();
    dossiersDisponibles.forEach((d) => {
      const opcion = document.createElement('option');
      opcion.value = d.id;
      opcion.textContent = d.title + (d.region ? ` — ${d.region}` : d.address ? ` — ${d.address}` : '');
      inmuebleSelect.appendChild(opcion);
    });
  } catch (error) {
    videoStatus.textContent = 'No se pudieron cargar los inmuebles: ' + error.message;
    videoStatus.className = 'form-status error';
  }
}

// --- Autorrelleno de subtítulos a partir de los datos del inmueble ---
// Reparte la información entre los clips disponibles en vez de meterla toda
// junta en uno solo. El precio, si existe, se reserva siempre para el
// último clip (cierre habitual de este tipo de vídeos). Si falta algún
// dato del inmueble simplemente se omite esa pieza, nunca se muestra
// "undefined" ni deja huecos raros en el texto.
function construirPiezasSubtitulo(dossier) {
  const piezas = [];
  if (dossier.title) piezas.push(dossier.title);
  if (dossier.region) piezas.push(dossier.region);
  const habM2 = [
    dossier.bedrooms ? `${dossier.bedrooms} hab` : null,
    dossier.surface_m2 ? `${dossier.surface_m2} m²` : null,
  ].filter(Boolean).join(' · ');
  if (habM2) piezas.push(habM2);
  const precio = dossier.price ? formatearPrecio(dossier.price) : null;
  return { piezas, precio };
}

function repartirSubtitulos(dossier) {
  if (!dossier || clips.length === 0) return;
  const { piezas, precio } = construirPiezasSubtitulo(dossier);

  // El precio (si hay) se reserva para el último clip; el resto de piezas
  // se reparten entre los clips restantes, agrupando varias piezas en un
  // mismo clip si hay menos clips que piezas.
  const clipsParaPiezas = precio && clips.length > 1 ? clips.slice(0, -1) : clips;

  if (piezas.length === 0) {
    clipsParaPiezas.forEach((c) => { c.subtitulo = ''; });
  } else {
    clipsParaPiezas.forEach((clip, indice) => {
      const desde = Math.floor((indice * piezas.length) / clipsParaPiezas.length);
      const hasta = Math.floor(((indice + 1) * piezas.length) / clipsParaPiezas.length);
      clip.subtitulo = piezas.slice(desde, Math.max(hasta, desde + 1)).join(' · ');
    });
  }

  if (precio && clips.length > 1) {
    clips[clips.length - 1].subtitulo = precio;
  } else if (precio && clips.length === 1) {
    clips[0].subtitulo = [clips[0].subtitulo, precio].filter(Boolean).join(' · ');
  }

  renderClips();
}

inmuebleSelect.addEventListener('change', () => {
  const dossier = dossiersDisponibles.find((d) => d.id === inmuebleSelect.value);
  if (dossier) repartirSubtitulos(dossier);
});

// --- Banco de música: pistas ya subidas antes, guardadas en Supabase
// Storage bajo el prefijo "musica/" del mismo bucket que usan los dossiers
// (mismas políticas de acceso, no hace falta nada nuevo en Supabase). Así
// no hay que volver a subir la misma canción cada vez — o si se prefiere,
// se puede usar siempre la misma eligiéndola cada vez del banco.
async function cargarBancoMusica() {
  try {
    const respuesta = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${STORAGE_BUCKET}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ prefix: 'musica', limit: 200, sortBy: { column: 'name', order: 'asc' } }),
    });
    if (!respuesta.ok) return;
    const archivos = await respuesta.json();
    musicaBancoSelect.querySelectorAll('option[data-banco]').forEach((o) => o.remove());
    const opcionNueva = musicaBancoSelect.querySelector('option[value="__nueva__"]');
    archivos
      .filter((a) => a.name && a.id)
      .forEach((archivo) => {
        const opcion = document.createElement('option');
        opcion.value = `${STORAGE_BUCKET}/musica/${archivo.name}`;
        opcion.textContent = archivo.name;
        opcion.dataset.banco = '1';
        musicaBancoSelect.insertBefore(opcion, opcionNueva);
      });
  } catch (error) {
    // El banco es un extra: si la lista falla, simplemente no aparece
    // ninguna pista guardada, pero se puede seguir subiendo música nueva.
  }
}

musicaBancoSelect.addEventListener('change', async () => {
  const valor = musicaBancoSelect.value;
  if (valor === '__nueva__') {
    musicaSubirZona.hidden = false;
    musicaFile = null;
    musicaNombre.textContent = 'Elige un archivo de música para subir.';
    return;
  }
  musicaSubirZona.hidden = true;
  if (!valor) {
    musicaFile = null;
    musicaNombre.textContent = 'Ninguna música seleccionada todavía.';
    return;
  }
  musicaNombre.textContent = 'Cargando música del banco…';
  try {
    const respuesta = await fetch(`${SUPABASE_URL}/storage/v1/object/public/${valor}`);
    if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
    const blob = await respuesta.blob();
    musicaFile = new File([blob], valor.split('/').pop(), { type: blob.type || 'audio/mpeg' });
    musicaNombre.textContent = `Seleccionada del banco: ${musicaFile.name}`;
  } catch (error) {
    musicaFile = null;
    musicaNombre.textContent = 'No se pudo cargar esa música del banco: ' + error.message;
  }
});

musicaInput.addEventListener('change', async () => {
  const file = musicaInput.files[0];
  if (!file) return;
  musicaFile = file;
  musicaNombre.textContent = `Seleccionada: ${file.name}`;

  if (musicaGuardarCheckbox.checked) {
    try {
      const nombreArchivo = `musica/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
      await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${nombreArchivo}`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': file.type || 'audio/mpeg',
        },
        body: file,
      });
      musicaNombre.textContent = `Seleccionada: ${file.name} (guardada en el banco de música)`;
      await cargarBancoMusica();
    } catch (error) {
      musicaNombre.textContent = `Seleccionada: ${file.name} (no se pudo guardar en el banco: ${error.message})`;
    }
  }
});

// --- Gestión de clips ---
function leerDuracionVideo(url) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.src = url;
    v.addEventListener('loadedmetadata', () => resolve(Number.isFinite(v.duration) ? v.duration : DURACION_CLIP_DEFECTO));
    v.addEventListener('error', () => resolve(DURACION_CLIP_DEFECTO));
  });
}

clipsInput.addEventListener('change', async () => {
  const archivos = Array.from(clipsInput.files || []);
  for (const file of archivos) {
    const url = URL.createObjectURL(file);
    const duracionOriginal = await leerDuracionVideo(url);
    clips.push({
      id: siguienteIdClip++,
      file,
      url,
      nombre: file.name,
      duracionOriginal,
      inicio: 0,
      duracion: Math.min(DURACION_CLIP_DEFECTO, duracionOriginal),
      subtitulo: '',
    });
  }
  clipsInput.value = '';
  // Si ya hay un inmueble elegido, autorrellena también los clips nuevos.
  const dossier = dossiersDisponibles.find((d) => d.id === inmuebleSelect.value);
  if (dossier) repartirSubtitulos(dossier);
  renderClips();
});

function moverClip(id, direccion) {
  const indice = clips.findIndex((c) => c.id === id);
  const nuevoIndice = indice + direccion;
  if (nuevoIndice < 0 || nuevoIndice >= clips.length) return;
  [clips[indice], clips[nuevoIndice]] = [clips[nuevoIndice], clips[indice]];
  renderClips();
}

function eliminarClip(id) {
  const indice = clips.findIndex((c) => c.id === id);
  if (indice === -1) return;
  // Solo libera la URL si ningún otro tramo del mismo vídeo la sigue usando
  // (varios clips pueden compartir el mismo archivo/URL, ver duplicarClip).
  const urlEnUso = clips.some((c, i) => i !== indice && c.url === clips[indice].url);
  if (!urlEnUso) URL.revokeObjectURL(clips[indice].url);
  clips.splice(indice, 1);
  renderClips();
}

// Saca otro tramo del MISMO vídeo ya subido (mismo archivo/URL), colocado
// justo después del original en la lista, empezando donde termina el
// tramo anterior — así de un solo vídeo largo se pueden sacar varios
// clips sin tener que volver a subir el archivo.
function duplicarClip(id) {
  const indice = clips.findIndex((c) => c.id === id);
  if (indice === -1) return;
  const original = clips[indice];
  const inicioNuevo = Math.min(original.inicio + original.duracion, Math.max(original.duracionOriginal - DURACION_CLIP_MINIMA, 0));
  const disponible = Math.max(original.duracionOriginal - inicioNuevo, DURACION_CLIP_MINIMA);
  clips.splice(indice + 1, 0, {
    id: siguienteIdClip++,
    file: original.file,
    url: original.url,
    nombre: original.nombre,
    duracionOriginal: original.duracionOriginal,
    inicio: inicioNuevo,
    duracion: Math.min(DURACION_CLIP_DEFECTO, disponible),
    subtitulo: '',
  });
  renderClips();
}

// Reparte una duración total objetivo entre todos los clips SIN forzar que
// todos duren lo mismo: a cada uno se le da como máximo el metraje que
// realmente tiene disponible (duracionOriginal - inicio); lo que un clip
// no puede aprovechar se reparte entre el resto ("water-filling"). Así,
// con pocos clips (2-3) se puede llegar a 35-40s dándole más tiempo a los
// que sí tienen metraje de sobra, sin tener que subir más vídeos.
function repartirDuracion(objetivoTotal) {
  if (clips.length === 0) return;
  const disponibles = clips.map((c) => Math.max(c.duracionOriginal - c.inicio, DURACION_CLIP_MINIMA));
  const asignadas = clips.map((c, i) => Math.min(DURACION_CLIP_MINIMA, disponibles[i]));
  let restante = objetivoTotal - asignadas.reduce((suma, v) => suma + v, 0);
  let activos = clips.map((_, i) => i).filter((i) => disponibles[i] > asignadas[i]);

  let vueltasSeguridad = clips.length + 5;
  while (restante > 0.01 && activos.length > 0 && vueltasSeguridad-- > 0) {
    const porClip = restante / activos.length;
    let sobrante = 0;
    const siguientesActivos = [];
    activos.forEach((i) => {
      const espacio = disponibles[i] - asignadas[i];
      if (porClip >= espacio) {
        asignadas[i] += espacio;
        sobrante += porClip - espacio;
      } else {
        asignadas[i] += porClip;
        siguientesActivos.push(i);
      }
    });
    restante = sobrante;
    activos = siguientesActivos;
  }

  clips.forEach((c, i) => { c.duracion = Math.round(asignadas[i] * 10) / 10; });
  renderClips();
}

function actualizarDuracionTotal() {
  const total = clips.reduce((suma, c) => suma + c.duracion, 0);
  duracionTotalEl.textContent = `${total.toFixed(1)}s`;
  duracionBarra.hidden = clips.length === 0;
  const dentroDelObjetivo = total >= DURACION_OBJETIVO_MIN && total <= DURACION_OBJETIVO_MAX;
  duracionBarra.classList.toggle('video-duracion-ok', dentroDelObjetivo);
  duracionBarra.classList.toggle('video-duracion-fuera', clips.length > 0 && !dentroDelObjetivo);
  generarBtn.disabled = clips.length === 0;
}

function renderClips() {
  clipsVacio.hidden = clips.length > 0;
  clipsLista.innerHTML = '';

  clips.forEach((clip, indice) => {
    const tarjeta = document.createElement('div');
    tarjeta.className = 'video-clip-tarjeta';
    tarjeta.innerHTML = `
      <div class="video-clip-cabecera">
        <span class="video-clip-numero">Clip ${indice + 1}</span>
        <span class="video-clip-nombre">${escapeHtml(clip.nombre)}</span>
        <div class="video-clip-orden">
          <button type="button" class="btn-secundario video-clip-mini-btn" data-accion="subir" data-id="${clip.id}" ${indice === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="btn-secundario video-clip-mini-btn" data-accion="bajar" data-id="${clip.id}" ${indice === clips.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" class="btn-eliminar video-clip-mini-btn" data-accion="eliminar" data-id="${clip.id}">Quitar</button>
        </div>
      </div>
      <div class="campo-fila">
        <div class="campo">
          <label>Inicio del recorte (s)</label>
          <input type="number" min="0" step="0.1" class="admin-input video-clip-inicio" data-id="${clip.id}"
            value="${clip.inicio}" max="${Math.max(clip.duracionOriginal - DURACION_CLIP_MINIMA, 0).toFixed(1)}">
        </div>
        <div class="campo">
          <label>Duración usada (s)</label>
          <input type="number" min="${DURACION_CLIP_MINIMA}" step="0.1" class="admin-input video-clip-duracion" data-id="${clip.id}"
            value="${clip.duracion}" max="${clip.duracionOriginal.toFixed(1)}">
        </div>
      </div>
      <div class="campo">
        <label>Subtítulo de este clip</label>
        <textarea class="admin-notas video-clip-subtitulo" data-id="${clip.id}" rows="2" placeholder="Texto que aparecerá sobre este clip (opcional)">${escapeHtml(clip.subtitulo)}</textarea>
      </div>
      <button type="button" class="btn-secundario video-clip-otro-tramo" data-accion="otro-tramo" data-id="${clip.id}">✂ Sacar otro tramo de este mismo vídeo</button>
    `;
    clipsLista.appendChild(tarjeta);
  });

  actualizarDuracionTotal();
}

clipsLista.addEventListener('click', (evento) => {
  const boton = evento.target.closest('button[data-accion]');
  if (!boton) return;
  const id = Number(boton.dataset.id);
  if (boton.dataset.accion === 'subir') moverClip(id, -1);
  else if (boton.dataset.accion === 'bajar') moverClip(id, 1);
  else if (boton.dataset.accion === 'eliminar') eliminarClip(id);
  else if (boton.dataset.accion === 'otro-tramo') duplicarClip(id);
});

clipsLista.addEventListener('input', (evento) => {
  const el = evento.target;
  const id = Number(el.dataset.id);
  const clip = clips.find((c) => c.id === id);
  if (!clip) return;
  if (el.classList.contains('video-clip-inicio')) {
    const valor = Number(el.value) || 0;
    clip.inicio = Math.max(0, Math.min(valor, Math.max(clip.duracionOriginal - DURACION_CLIP_MINIMA, 0)));
  } else if (el.classList.contains('video-clip-duracion')) {
    const valor = Number(el.value) || DURACION_CLIP_MINIMA;
    clip.duracion = Math.max(DURACION_CLIP_MINIMA, Math.min(valor, clip.duracionOriginal));
    actualizarDuracionTotal();
  } else if (el.classList.contains('video-clip-subtitulo')) {
    clip.subtitulo = el.value;
  }
});

repartirBtn.addEventListener('click', () => {
  const objetivo = Number(repartirObjetivoInput.value) || (DURACION_OBJETIVO_MIN + DURACION_OBJETIVO_MAX) / 2;
  repartirDuracion(objetivo);
});

// --- Dibujo de un fotograma en el canvas: vídeo "cover" + fundido + subtítulo ---
function dibujarFotograma(clip, elementoVideo, progresoEnClip) {
  const anchoDestino = canvas.width;
  const altoDestino = canvas.height;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, anchoDestino, altoDestino);

  if (elementoVideo && elementoVideo.videoWidth) {
    const ratioDestino = anchoDestino / altoDestino;
    const ratioOrigen = elementoVideo.videoWidth / elementoVideo.videoHeight;
    let sx = 0, sy = 0, sw = elementoVideo.videoWidth, sh = elementoVideo.videoHeight;
    if (ratioOrigen > ratioDestino) {
      sw = elementoVideo.videoHeight * ratioDestino;
      sx = (elementoVideo.videoWidth - sw) / 2;
    } else {
      sh = elementoVideo.videoWidth / ratioDestino;
      sy = (elementoVideo.videoHeight - sh) / 2;
    }
    ctx.drawImage(elementoVideo, sx, sy, sw, sh, 0, 0, anchoDestino, altoDestino);
  }

  // Fundido a blanco al principio y al final del clip
  const fundido = Math.min(FUNDIDO_S, clip.duracion / 2 - 0.02);
  let opacidadBlanco = 0;
  if (fundido > 0) {
    if (progresoEnClip < fundido) opacidadBlanco = 1 - progresoEnClip / fundido;
    else if (progresoEnClip > clip.duracion - fundido) opacidadBlanco = (progresoEnClip - (clip.duracion - fundido)) / fundido;
  }
  if (opacidadBlanco > 0) {
    ctx.fillStyle = `rgba(255,255,255,${opacidadBlanco})`;
    ctx.fillRect(0, 0, anchoDestino, altoDestino);
  }

  // Subtítulo (se atenúa junto con el fundido para que no corte en seco)
  if (clip.subtitulo && clip.subtitulo.trim()) {
    const opacidadTexto = 1 - opacidadBlanco;
    if (opacidadTexto > 0.02) {
      dibujarSubtitulo(clip.subtitulo, opacidadTexto);
    }
  }
}

function dibujarSubtitulo(texto, opacidad) {
  const anchoDestino = canvas.width;
  const altoDestino = canvas.height;
  const margen = 40;
  const anchoMaximo = anchoDestino - margen * 2;

  ctx.font = '600 40px "Public Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Ajuste de línea sencillo (word-wrap) por ancho disponible.
  const palabras = texto.trim().split(/\s+/);
  const lineas = [];
  let lineaActual = '';
  palabras.forEach((palabra) => {
    const prueba = lineaActual ? `${lineaActual} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width > anchoMaximo && lineaActual) {
      lineas.push(lineaActual);
      lineaActual = palabra;
    } else {
      lineaActual = prueba;
    }
  });
  if (lineaActual) lineas.push(lineaActual);

  const altoLinea = 50;
  const altoBarra = lineas.length * altoLinea + 40;
  const yBarra = altoDestino - altoBarra - 60;

  ctx.fillStyle = `rgba(36, 28, 24, ${0.72 * opacidad})`;
  ctx.fillRect(0, yBarra, anchoDestino, altoBarra);

  ctx.fillStyle = `rgba(255, 255, 255, ${opacidad})`;
  lineas.forEach((linea, indice) => {
    ctx.fillText(linea, margen, yBarra + 40 + indice * altoLinea + 30);
  });
}

// Con timeout de seguridad: si el navegador no llega a disparar el evento
// (por ejemplo "seeked" al buscar el mismo punto en el que ya está el
// vídeo, que en algunos navegadores no dispara el evento) seguimos igual
// en vez de quedarnos colgados para siempre generando el vídeo.
function esperarEvento(elemento, evento, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const limite = setTimeout(resolve, timeoutMs);
    elemento.addEventListener(evento, () => {
      clearTimeout(limite);
      resolve();
    }, { once: true });
  });
}

// Igual que esperarEvento pero para cualquier promesa (por ejemplo
// elementoVideo.play(), que en algunos navegadores/entornos puede no
// llegar a resolverse ni rechazarse nunca) — así la generación del vídeo
// nunca se queda colgada indefinidamente.
function conTimeout(promesa, timeoutMs = 2000) {
  return Promise.race([
    promesa,
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

// --- Tarjetas de apertura y cierre (sobre fondo Espresso, con el logo) ---
// Mismo rombo + skyline que el logo de la marca, dibujado en blanco.
function dibujarLogoEnCanvas(cx, cy, tamano) {
  const escala = tamano / 80;
  ctx.save();
  ctx.translate(cx - tamano / 2, cy - tamano / 2);
  ctx.scale(escala, escala);
  ctx.beginPath();
  ctx.moveTo(40, 6); ctx.lineTo(74, 40); ctx.lineTo(40, 74); ctx.lineTo(6, 40); ctx.closePath();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(26, 38, 6, 16);
  ctx.fillRect(37, 28, 6, 26);
  ctx.fillRect(48, 34, 6, 20);
  ctx.restore();
}

// Ajuste de línea sencillo (word-wrap) reutilizado por las tarjetas.
function ajustarLineas(texto, anchoMaximo) {
  const palabras = (texto || '').trim().split(/\s+/).filter(Boolean);
  const lineas = [];
  let actual = '';
  palabras.forEach((palabra) => {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width > anchoMaximo && actual) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = prueba;
    }
  });
  if (actual) lineas.push(actual);
  return lineas;
}

// Calcula la opacidad del fundido a blanco al principio/final de una
// tarjeta o clip — misma fórmula que dibujarFotograma, reutilizada aquí
// para que la apertura/cierre tengan el mismo lenguaje visual.
function calcularFundido(progreso, duracion) {
  const fundido = Math.min(FUNDIDO_S, duracion / 2 - 0.02);
  if (fundido <= 0) return 0;
  if (progreso < fundido) return 1 - progreso / fundido;
  if (progreso > duracion - fundido) return (progreso - (duracion - fundido)) / fundido;
  return 0;
}

function dibujarTarjetaApertura(dossier, progreso, duracion) {
  const anchoDestino = canvas.width;
  const altoDestino = canvas.height;
  const cx = anchoDestino / 2;
  const opacidadBlanco = calcularFundido(progreso, duracion);

  ctx.fillStyle = COLOR_ESPRESSO;
  ctx.fillRect(0, 0, anchoDestino, altoDestino);

  ctx.save();
  ctx.globalAlpha = 1 - opacidadBlanco;
  ctx.textAlign = 'center';

  dibujarLogoEnCanvas(cx, 400, 90);

  ctx.font = '700 22px "Public Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('INVEST SPAIN PROPERTIES', cx, 510);

  ctx.font = '700 26px "Public Sans", sans-serif';
  ctx.fillStyle = COLOR_CORAL;
  ctx.fillText('EN EXCLUSIVA', cx, 600);

  let y = 680;
  ctx.font = '600 56px "Fraunces", serif';
  ctx.fillStyle = '#FFFFFF';
  ajustarLineas(dossier.title, anchoDestino - 120).forEach((linea) => {
    ctx.fillText(linea, cx, y);
    y += 64;
  });

  const datos = [
    dossier.region,
    [dossier.bedrooms ? `${dossier.bedrooms} hab` : null, dossier.surface_m2 ? `${dossier.surface_m2} m²` : null].filter(Boolean).join(' · '),
  ].filter(Boolean).join(' · ');
  if (datos) {
    y += 26;
    ctx.font = '400 30px "Public Sans", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ajustarLineas(datos, anchoDestino - 120).forEach((linea) => {
      ctx.fillText(linea, cx, y);
      y += 40;
    });
  }

  if (dossier.price) {
    ctx.font = '600 62px "Fraunces", serif';
    ctx.fillStyle = COLOR_CORAL;
    ctx.fillText(formatearPrecio(dossier.price), cx, y + 76);
  }

  ctx.restore();

  if (opacidadBlanco > 0) {
    ctx.fillStyle = `rgba(255,255,255,${opacidadBlanco})`;
    ctx.fillRect(0, 0, anchoDestino, altoDestino);
  }
}

function dibujarTarjetaCierre(progreso, duracion) {
  const anchoDestino = canvas.width;
  const altoDestino = canvas.height;
  const cx = anchoDestino / 2;
  const opacidadBlanco = calcularFundido(progreso, duracion);

  ctx.fillStyle = COLOR_ESPRESSO;
  ctx.fillRect(0, 0, anchoDestino, altoDestino);

  ctx.save();
  ctx.globalAlpha = 1 - opacidadBlanco;
  ctx.textAlign = 'center';

  dibujarLogoEnCanvas(cx, 420, 100);

  ctx.font = '700 28px "Public Sans", sans-serif';
  ctx.fillStyle = COLOR_CORAL;
  ctx.fillText('CONTÁCTANOS', cx, 560);

  ctx.font = '600 46px "Fraunces", serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(CONTACTO_NOMBRE, cx, 650);

  ctx.font = '400 24px "Public Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ajustarLineas(CONTACTO_ROL, anchoDestino - 120).forEach((linea, i) => {
    ctx.fillText(linea, cx, 695 + i * 32);
  });

  ctx.font = '600 30px "Public Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(CONTACTO_TELEFONO, cx, 800);
  ctx.fillText(CONTACTO_EMAIL, cx, 848);

  ctx.restore();

  if (opacidadBlanco > 0) {
    ctx.fillStyle = `rgba(255,255,255,${opacidadBlanco})`;
    ctx.fillRect(0, 0, anchoDestino, altoDestino);
  }
}

// --- Generación del vídeo final (Canvas + MediaRecorder) ---
generarBtn.addEventListener('click', async () => {
  if (clips.length === 0) return;
  generarBtn.disabled = true;
  generarBtn.textContent = 'Generando…';
  videoStatus.textContent = 'Generando vídeo, no cierres esta pestaña…';
  videoStatus.className = 'form-status';
  videoResultado.hidden = true;
  descargaLink.hidden = true;

  let audioContext;
  try {
    // Las tarjetas de apertura/cierre usan Fraunces — nos aseguramos de que
    // la fuente ya esté cargada antes de dibujar el primer fotograma, si
    // no el texto saldría con la fuente de reserva durante un instante.
    if (document.fonts && document.fonts.ready) await document.fonts.ready;

    const dossierSeleccionado = dossiersDisponibles.find((d) => d.id === inmuebleSelect.value);
    const DURACION_APERTURA = 3.5;
    const DURACION_CIERRE = 3;
    const secuencia = [];
    if (dossierSeleccionado) secuencia.push({ tipo: 'apertura', duracion: DURACION_APERTURA, dossier: dossierSeleccionado });
    clips.forEach((clip) => secuencia.push({ tipo: 'clip', clip }));
    if (dossierSeleccionado) secuencia.push({ tipo: 'cierre', duracion: DURACION_CIERRE });

    const canvasStream = canvas.captureStream(30);

    let pistaAudio = null;
    let elementoMusica = null;
    if (musicaFile) {
      audioContext = new AudioContext();
      elementoMusica = document.createElement('audio');
      elementoMusica.src = URL.createObjectURL(musicaFile);
      elementoMusica.loop = true;
      const origenAudio = audioContext.createMediaElementSource(elementoMusica);
      const destinoAudio = audioContext.createMediaStreamDestination();
      origenAudio.connect(destinoAudio);
      pistaAudio = destinoAudio.stream.getAudioTracks()[0];
    }

    const pistasFinales = [...canvasStream.getVideoTracks()];
    if (pistaAudio) pistasFinales.push(pistaAudio);
    const streamFinal = new MediaStream(pistasFinales);

    const mimeCandidatos = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    const mimeType = mimeCandidatos.find((tipo) => MediaRecorder.isTypeSupported(tipo)) || '';
    const recorder = new MediaRecorder(streamFinal, mimeType ? { mimeType } : undefined);
    const trozos = [];
    recorder.addEventListener('dataavailable', (evento) => {
      if (evento.data.size > 0) trozos.push(evento.data);
    });

    const finPromesa = new Promise((resolve) => recorder.addEventListener('stop', resolve, { once: true }));

    recorder.start();
    if (elementoMusica) elementoMusica.play().catch(() => {});

    for (const item of secuencia) {
      if (item.tipo !== 'clip') {
        // Tarjeta estática (apertura/cierre): no hay vídeo que reproducir,
        // solo se dibuja el mismo fotograma con el fundido correspondiente
        // durante su duración.
        const inicioTarjetaMs = performance.now();
        const dibujarTarjeta = item.tipo === 'apertura'
          ? (progreso) => dibujarTarjetaApertura(item.dossier, progreso, item.duracion)
          : (progreso) => dibujarTarjetaCierre(progreso, item.duracion);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolveTarjeta) => {
          function dibujarSiguiente() {
            const progreso = (performance.now() - inicioTarjetaMs) / 1000;
            if (progreso >= item.duracion) { resolveTarjeta(); return; }
            dibujarTarjeta(progreso);
            requestAnimationFrame(dibujarSiguiente);
          }
          dibujarSiguiente();
        });
        continue;
      }

      const clip = item.clip;
      const elementoVideo = document.createElement('video');
      elementoVideo.muted = true;
      elementoVideo.playsInline = true;
      elementoVideo.src = clip.url;
      await esperarEvento(elementoVideo, 'loadedmetadata');
      elementoVideo.currentTime = clip.inicio;
      await esperarEvento(elementoVideo, 'seeked');
      await conTimeout(elementoVideo.play().catch(() => {}));

      const inicioClipMs = performance.now();
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolveClip) => {
        function dibujarSiguiente() {
          const progreso = (performance.now() - inicioClipMs) / 1000;
          if (progreso >= clip.duracion) {
            elementoVideo.pause();
            resolveClip();
            return;
          }
          dibujarFotograma(clip, elementoVideo, progreso);
          requestAnimationFrame(dibujarSiguiente);
        }
        dibujarSiguiente();
      });
    }

    if (elementoMusica) elementoMusica.pause();
    recorder.stop();
    await finPromesa;

    const blobFinal = new Blob(trozos, { type: mimeType || 'video/webm' });
    const urlFinal = URL.createObjectURL(blobFinal);
    videoResultado.src = urlFinal;
    videoResultado.hidden = false;
    descargaLink.href = urlFinal;
    descargaLink.hidden = false;

    videoStatus.textContent = 'Vídeo generado correctamente.';
    videoStatus.className = 'form-status ok';
  } catch (error) {
    videoStatus.textContent = 'No se pudo generar el vídeo: ' + error.message;
    videoStatus.className = 'form-status error';
  } finally {
    if (audioContext) audioContext.close();
    generarBtn.disabled = false;
    generarBtn.textContent = 'Generar vídeo';
  }
});

logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem('admin-token');
  window.location.href = 'admin.html';
});

cargarInmuebles();
cargarBancoMusica();
renderClips();

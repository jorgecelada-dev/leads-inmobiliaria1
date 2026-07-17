// script.js

// ============================================================
// CONFIGURA AQUÍ TUS DATOS DE SUPABASE (Project Settings → API)
// ============================================================
const SUPABASE_URL = "https://uagmlfssbixytierxdib.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_8FvlGTc8ICk04jqAH0yzzg_Q84Jp1UQ";

// --- 1. Selector de idioma (ES/EN) ---
const langToggle = document.getElementById('lang-toggle');
const elementosTraducibles = document.querySelectorAll('[data-en][data-es]');

function aplicarIdioma(idioma) {
  elementosTraducibles.forEach((el) => {
    const texto = el.dataset[idioma]; // dataset.en o dataset.es
    if (texto !== undefined) {
      el.textContent = texto;
    }
  });
  document.documentElement.lang = idioma;
  langToggle.textContent = idioma === 'es' ? 'EN' : 'ES';
  localStorage.setItem('idioma-preferido', idioma);
}

function idiomaInicial() {
  const guardado = localStorage.getItem('idioma-preferido');
  if (guardado === 'es' || guardado === 'en') return guardado;
  // Si el navegador está en español, arrancamos en español; si no, en inglés.
  return navigator.language.startsWith('es') ? 'es' : 'en';
}

let idiomaActual = idiomaInicial();
aplicarIdioma(idiomaActual);

langToggle.addEventListener('click', () => {
  idiomaActual = idiomaActual === 'es' ? 'en' : 'es';
  aplicarIdioma(idiomaActual);
});

// --- 2. Mostrar/ocultar "¿cuántas propiedades?" según la respuesta ---
const radiosPropiedad = document.querySelectorAll('input[name="owns_property_spain"]');
const campoPropertiesCount = document.getElementById('campo-properties-count');
const inputPropertiesCount = document.getElementById('properties_count');

radiosPropiedad.forEach((radio) => {
  radio.addEventListener('change', () => {
    const muestraCampo = radio.value === 'si' && radio.checked;
    if (muestraCampo) {
      campoPropertiesCount.hidden = false;
      inputPropertiesCount.required = true;
    } else if (radio.checked && radio.value === 'no') {
      campoPropertiesCount.hidden = true;
      inputPropertiesCount.required = false;
      inputPropertiesCount.value = '';
    }
  });
});

// --- 3. Envío del formulario a Supabase ---
const form = document.getElementById('lead-form');
const status = document.getElementById('form-status');

const mensajes = {
  enviando: { es: 'Enviando…', en: 'Sending…' },
  ok: { es: '¡Gracias! Nos pondremos en contacto pronto.', en: 'Thank you! We will be in touch soon.' },
  error: { es: 'Algo ha fallado. Inténtalo de nuevo en unos minutos.', en: 'Something went wrong. Please try again in a few minutes.' },
  configFalta: { es: 'Formulario no configurado todavía (falta conectar la base de datos).', en: 'Form not configured yet (database connection missing).' },
};

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  if (SUPABASE_URL === "TU_SUPABASE_URL_AQUI" || SUPABASE_ANON_KEY === "TU_ANON_KEY_AQUI") {
    status.textContent = mensajes.configFalta[idiomaActual];
    status.className = 'form-status error';
    return;
  }

  const datos = new FormData(form);
  const payload = {
    full_name: datos.get('full_name'),
    email: datos.get('email'),
    phone: datos.get('phone') || null,
    country: datos.get('country'),
    owns_property_spain: datos.get('owns_property_spain') === 'si',
    properties_count: datos.get('properties_count') ? Number(datos.get('properties_count')) : null,
    budget_range: datos.get('budget_range'),
    region_interest: datos.get('region_interest'),
    timeframe: datos.get('timeframe'),
    form_language: idiomaActual,
    source: 'landing-v1',
  };

  status.textContent = mensajes.enviando[idiomaActual];
  status.className = 'form-status';

  try {
    const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(payload),
    });

    if (!respuesta.ok) {
      throw new Error(`Supabase respondió con estado ${respuesta.status}`);
    }

    status.textContent = mensajes.ok[idiomaActual];
    status.className = 'form-status ok';
    form.reset();
    campoPropertiesCount.hidden = true;
  } catch (error) {
    console.error('Error al enviar el formulario:', error);
    status.textContent = mensajes.error[idiomaActual];
    status.className = 'form-status error';
  }
});

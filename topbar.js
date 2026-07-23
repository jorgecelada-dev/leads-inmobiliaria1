// topbar.js — comportamiento de los menús desplegables de la barra superior
// ("Mis inmuebles" / "Clientes"). Compartido por todas las páginas del
// panel privado; cada página trae su propio marcado con las mismas clases.

document.querySelectorAll('.nav-dropdown-toggle').forEach((boton) => {
  boton.addEventListener('click', (evento) => {
    evento.stopPropagation();
    const menu = boton.closest('.nav-dropdown');
    const yaAbierto = menu.dataset.abierto === 'true';
    document.querySelectorAll('.nav-dropdown').forEach((m) => { m.dataset.abierto = 'false'; });
    menu.dataset.abierto = yaAbierto ? 'false' : 'true';
  });
});

document.addEventListener('click', () => {
  document.querySelectorAll('.nav-dropdown').forEach((m) => { m.dataset.abierto = 'false'; });
});

document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape') {
    document.querySelectorAll('.nav-dropdown').forEach((m) => { m.dataset.abierto = 'false'; });
  }
});

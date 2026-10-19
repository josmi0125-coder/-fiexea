(() => {
  'use strict';
  // This demo uses memory only. It never reads account storage or calls an API.
  const initial = () => [
    { label: 'Nómina de ejemplo', category: 'ingreso', cents: 280000 },
    { label: 'Vivienda', category: 'vivienda', cents: -78000 },
    { label: 'Compra semanal', category: 'alimentacion', cents: -26000 },
    { label: 'Transporte', category: 'transporte', cents: -9500 },
    { label: 'Suscripciones', category: 'suscripciones', cents: -3500 }
  ];
  const categories = {
    vivienda: { name: 'Vivienda', icon: '🏠' },
    alimentacion: { name: 'Alimentación', icon: '🛒' },
    transporte: { name: 'Transporte', icon: '🚗' },
    suscripciones: { name: 'Suscripciones', icon: '📺' },
    ocio: { name: 'Ocio', icon: '🎮' },
    otros: { name: 'Otros', icon: '📦' }
  };
  let moves = initial();
  const picker = document.getElementById('demo-category-picker');
  const selectedCategory = document.getElementById('demo-category');
  function renderPicker() {
    picker.replaceChildren();
    Object.entries(categories).forEach(([key, category]) => {
      const button = el('button', undefined, 'demo-category-choice');
      button.type = 'button';
      button.setAttribute('aria-pressed', String(selectedCategory.value === key));
      button.append(el('span', category.icon, 'demo-emoji'), el('span', category.name));
      button.addEventListener('click', () => { selectedCategory.value = key; renderPicker(); });
      picker.append(button);
    });
  }
  const format = cents => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(cents / 100);
  const el = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const status = document.getElementById('demo-status');
  function render() {
    const income = moves.reduce((sum, move) => sum + Math.max(0, move.cents), 0);
    const expenses = moves.reduce((sum, move) => sum - Math.min(0, move.cents), 0);
    document.getElementById('income').textContent = format(income);
    document.getElementById('expenses').textContent = format(expenses);
    document.getElementById('balance').textContent = format(income - expenses);
    const list = document.getElementById('demo-categories');
    list.replaceChildren();
    Object.entries(categories).forEach(([key, category]) => {
      const entries = moves.filter(move => move.category === key);
      const group = el('details', undefined, 'demo-category-group');
      const summary = el('summary');
      summary.append(el('span', category.icon + ' ' + category.name), el('strong', format(entries.reduce((sum, move) => sum - move.cents, 0))));
      const items = el('ul', undefined, 'move-list');
      [...entries].reverse().forEach(move => {
        const item = el('li');
        item.append(el('span', move.label), el('b', '−' + format(-move.cents)));
        items.append(item);
      });
      if (!entries.length) items.append(el('li', 'Todavía no hay gastos en esta categoría.'));
      group.append(summary, items); list.append(group);
    });
    renderBudget();
  }
  function renderBudget() {
    const expenses = moves.reduce((sum, move) => sum - Math.min(0, move.cents), 0);
    const input = document.getElementById('demo-limit');
    const raw = input.value;
    const limit = Math.round(Number(raw) * 100);
    const valid = raw !== '' && input.validity.valid && Number.isFinite(limit) && limit > 0;
    const remaining = document.getElementById('budget-remaining');
    const note = document.getElementById('budget-note');
    const progress = document.getElementById('budget-progress');
    document.getElementById('budget-spent').textContent = format(expenses);
    remaining.textContent = valid ? format(limit - expenses) : '—';
    remaining.classList.toggle('budget-alert', valid && expenses > limit);
    progress.hidden = !valid;
    progress.value = valid ? Math.min(100, expenses / limit * 100) : 0;
    progress.classList.toggle('over', valid && expenses > limit);
    note.classList.toggle('budget-alert', valid && expenses > limit);
    note.textContent = !valid ? (raw === '' ? 'Escribe un límite para ver cuánto te queda.' : 'Introduce un límite mayor que cero, con un máximo de dos decimales.') : expenses > limit ? 'Has superado tu límite en ' + format(expenses - limit) + '.' : 'Los gastos se descuentan automáticamente. Te queda no es tu saldo bancario.';
  }
  document.getElementById('demo-limit').addEventListener('input', renderBudget);
  document.getElementById('demo-month').textContent = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(new Date());

  const tabs = [...document.querySelectorAll('[role="tab"][data-view]')];
  function choose(view, focus = false) {
    tabs.forEach(tab => {
      const active = tab.dataset.view === view;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
      if (active && focus) tab.focus();
    });
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => choose(tab.dataset.view));
    tab.addEventListener('keydown', event => {
      let target;
      if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') target = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') target = 0;
      else if (event.key === 'End') target = tabs.length - 1;
      else return;
      event.preventDefault(); choose(tabs[target].dataset.view, true);
    });
  });
  const form = document.getElementById('demo-expense-form');
  form.addEventListener('submit', event => {
    event.preventDefault();
    const label = document.getElementById('demo-concept').value.trim();
    const cents = Math.round(Number(document.getElementById('demo-amount').value) * 100);
    const category = document.getElementById('demo-category').value;
    if (!label || !Number.isFinite(cents) || cents < 1 || cents > 10000000 || !categories[category]) {
      status.textContent = 'Introduce un concepto y un importe válido para el ejemplo.';
      return;
    }
    moves.push({ label: label.slice(0, 60), cents: -cents, category });
    render(); form.reset(); selectedCategory.value = category; renderPicker();
    status.textContent = 'Gasto añadido a su categoría y descontado de Mi presupuesto.';
  });
  document.getElementById('reset-demo').addEventListener('click', () => {
    moves = initial(); document.getElementById('demo-limit').value = ''; form.reset(); selectedCategory.value = 'ocio'; renderPicker(); render(); choose('inicio');
    status.textContent = 'Ejemplo reiniciado con los datos iniciales.';
  });
  document.getElementById('demo-open-moves').addEventListener('click', () => choose('movimientos', true));
  renderPicker(); render();
})();


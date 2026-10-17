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
    vivienda: { name: 'Vivienda', icon: '🏠', limit: 90000 },
    alimentacion: { name: 'Alimentación', icon: '🛒', limit: 35000 },
    transporte: { name: 'Transporte', icon: '🚗', limit: 15000 },
    suscripciones: { name: 'Suscripciones', icon: '📺', limit: 6000 },
    ocio: { name: 'Ocio', icon: '🎮', limit: 18000 },
    otros: { name: 'Otros', icon: '📦', limit: 20000 }
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
    const list = document.getElementById('demo-moves');
    list.replaceChildren();
    [...moves].reverse().forEach(move => {
      const item = el('li');
      const caption = el('div', move.label, 'demo-move-copy');
      caption.append(el('small', categories[move.category]?.name || 'Ingreso'));
      const left = el('div', undefined, 'demo-move-main');
      left.append(el('span', categories[move.category]?.icon || '💶', 'demo-move-icon'), caption);
      item.append(left, el('b', (move.cents > 0 ? '+' : '−') + format(Math.abs(move.cents)), 'demo-move-amount' + (move.cents > 0 ? ' income' : '')));
      list.append(item);
    });
    const budgets = document.getElementById('demo-budgets');
    budgets.replaceChildren();
    Object.entries(categories).forEach(([key, category]) => {
      const spent = moves.filter(move => move.category === key).reduce((sum, move) => sum - move.cents, 0);
      const block = el('div', undefined, 'demo-budget');
      const label = el('div', undefined, 'demo-budget-head');
      const categoryTitle = el('strong'); categoryTitle.append(el('span', category.icon, 'demo-budget-icon'), el('span', category.name));
      label.append(categoryTitle, el('span', format(spent) + ' / ' + format(category.limit)));
      const bar = el('div', undefined, 'mini-bar');
      bar.setAttribute('aria-hidden', 'true');
      const fill = el('i');
      fill.style.width = Math.min(100, Math.round(spent / category.limit * 100)) + '%';
      if (spent > category.limit) fill.style.backgroundColor = '#a3431c';
      bar.append(fill);
      const note = el('small', spent > category.limit ? 'Superado en ' + format(spent - category.limit) : 'Disponible: ' + format(category.limit - spent), spent > category.limit ? 'budget-alert' : '');
      block.append(label, bar, note);
      budgets.append(block);
    });
  }
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
    status.textContent = 'Gasto ficticio añadido. Puedes ver el cambio en Presupuesto.';
  });
  document.getElementById('reset-demo').addEventListener('click', () => {
    moves = initial(); form.reset(); selectedCategory.value = 'ocio'; renderPicker(); render(); choose('inicio');
    status.textContent = 'Ejemplo reiniciado con los datos iniciales.';
  });
  renderPicker(); render();
})();

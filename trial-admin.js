(() => {
  'use strict';
  const key = 'fiexea_guest_trial_v1';
  let adminUser = null, revision = 0, page = 0, tracking = null, lastTrack = 0, claimedUser = null;
  const rpc = async (name, args) => {
    const { data, error } = await fiexeaSupabase.rpc(name, args);
    if (error) throw new Error(error.message || 'No se pudo consultar el registro.');
    return data;
  };
  async function trackGuest(record, force = false) {
    if (!record || !Number.isFinite(record.started)) return;
    if (tracking) return tracking;
    if (!force && record.token && Date.now() - lastTrack < 300000) return;
    if (!record.token) {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      record.token = Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(key, JSON.stringify(record));
    }
    tracking = (async () => {
      const data = await rpc('fiexea_guest_trial', { action: 'start', payload: { token: record.token, started_at: new Date(record.started).toISOString() } });
      // Server may shorten a local deadline, but never restart it.
      record.started = Math.min(record.started, Date.parse(data.started_at));
      record.id = data.id;
      localStorage.setItem(key, JSON.stringify(record));
      lastTrack = Date.now();
      return data;
    })();
    try { return await tracking; } finally { tracking = null; }
  }
  async function claim(session) {
    if (!session?.user?.id || claimedUser === session.user.id) return;
    const record = JSON.parse(localStorage.getItem(key) || 'null');
    if (!record) return;
    await trackGuest(record, true);
    await rpc('fiexea_guest_trial', { action: 'claim', payload: { token: record.token } });
    claimedUser = session.user.id;
  }
  const esc = value => String(value ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const date = value => value ? new Date(value).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  const labels = { active: 'Prueba vigente', expired: 'Prueba caducada', registered: 'Cuenta creada · Sin conversión a pago', converted: 'Convertida a pago' };
  const dialog = document.createElement('dialog');
  dialog.id = 'trialAdminDialog'; dialog.setAttribute('aria-labelledby', 'trialAdminTitle');
  dialog.innerHTML = `<header><h2 id="trialAdminTitle">Usuarios en prueba</h2><button type="button" data-close aria-label="Cerrar panel">Cerrar</button></header><p class="trial-admin-note">Registros desde esta actualización. Los visitantes sin registro aparecen con un identificador anónimo; no se muestran sus datos financieros. Una conversión se registra cuando Stripe confirma una suscripción real activa, aunque después se cancele.</p><div id="trialAdminSummary" class="trial-admin-summary"></div><div class="trial-admin-controls"><label>Mostrar <select id="trialAdminFilter"><option value="all">Todas las pruebas</option><option value="active">Pruebas vigentes</option><option value="expired">Pruebas caducadas</option><option value="registered">Cuentas creadas sin pago</option><option value="converted">Convertidas a pago</option></select></label><button id="trialAdminRefresh" type="button">Actualizar</button></div><p id="trialAdminStatus" role="status" aria-live="polite"></p><div id="trialAdminRows"></div><footer><button type="button" id="trialAdminPrev">Anterior</button><span id="trialAdminPage"></span><button type="button" id="trialAdminNext">Siguiente</button></footer>`;
  document.body.appendChild(dialog);
  const get = id => dialog.querySelector('#' + id);
  async function load() {
    if (!adminUser) return;
    const current = ++revision, owner = adminUser;
    get('trialAdminStatus').textContent = 'Consultando pruebas…';
    try {
      const data = await rpc('fiexea_admin_trials', { payload: { filter: get('trialAdminFilter').value, page } });
      if (revision !== current || owner !== adminUser) return;
      const s = data.summary;
      get('trialAdminSummary').innerHTML = [['Total',s.total],['Vigentes',s.active],['Caducadas',s.expired],['Cuenta creada',s.registered],['Convertidas a pago',s.converted]].map(([name,count]) => `<div><strong>${esc(count)}</strong><span>${esc(name)}</span></div>`).join('');
      get('trialAdminRows').innerHTML = data.rows.length ? data.rows.map(row => `<article class="trial-admin-row"><strong>${esc(row.email || 'Visitante ' + row.id.slice(0,8))}</strong><span class="trial-admin-state ${esc(row.state)}">${esc(labels[row.state])}</span><dl><dt>Inicio</dt><dd>${esc(date(row.started_at))}</dd><dt>Caducidad</dt><dd>${esc(date(row.ends_at))}</dd><dt>Última actividad</dt><dd>${esc(date(row.last_seen_at))}</dd>${row.registered_at ? `<dt>Cuenta creada</dt><dd>${esc(date(row.registered_at))}</dd>` : ''}${row.converted_at ? `<dt>Conversión a pago</dt><dd>${esc(date(row.converted_at))}</dd>` : ''}</dl></article>`).join('') : '<p>No hay pruebas en este filtro.</p>';
      get('trialAdminPage').textContent = 'Página ' + (page + 1);
      get('trialAdminPrev').disabled = page === 0; get('trialAdminNext').disabled = data.rows.length < 50;
      get('trialAdminStatus').textContent = 'Actualizado: ' + date(data.server_now);
    } catch (error) { if (revision === current && owner === adminUser) get('trialAdminStatus').textContent = error.message; }
  }
  function setAdmin(isAdmin, uid) {
    if (!isAdmin) { reset(); return; }
    adminUser = uid;
    const group = document.getElementById('fiexeaAdminMenu');
    if (group && !document.getElementById('trialAdminOpen')) {
      const button = document.createElement('button'); button.id = 'trialAdminOpen'; button.type = 'button';
      button.innerHTML = '<span class="menu-icon" aria-hidden="true">📊</span>Usuarios en prueba<span class="more-menu-description">Pruebas vigentes, caducidad y conversiones a pago.</span>';
      button.addEventListener('click', () => { if (!adminUser) return; page = 0; dialog.showModal(); load(); });
      group.appendChild(button);
    }
  }
  function reset() {
    adminUser = null; claimedUser = null; revision++;
    if (dialog.open) dialog.close();
    document.getElementById('trialAdminOpen')?.remove();
    get('trialAdminRows').replaceChildren(); get('trialAdminSummary').replaceChildren(); get('trialAdminStatus').textContent = '';
  }
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  get('trialAdminRefresh').addEventListener('click', load);
  get('trialAdminFilter').addEventListener('change', () => { page = 0; load(); });
  get('trialAdminPrev').addEventListener('click', () => { if (page) { page--; load(); } });
  get('trialAdminNext').addEventListener('click', () => { page++; load(); });
  window.FiexeaTrials = { trackGuest, claim, setAdmin, reset };
})();

(() => {
  'use strict';
  const gate = document.getElementById('fiexeaAccessGate');
  const title = document.getElementById('fiexeaAccessTitle');
  const message = document.getElementById('fiexeaAccessMessage');
  const plans = document.getElementById('fiexeaAccessPlans');
  const retry = document.getElementById('fiexeaAccessRetry');
  const banner = document.getElementById('fiexeaTrialBanner');
  const signupButton = document.getElementById('fiexeaOpenSignup');
  const signupNotice = document.getElementById('fiexeaSignupAvailability');
  let userId = '', generation = 0, allowed = false, timer = null, countdown = null, inFlight = null;
  let billingReady = false, billingChecked = false;
  let checkoutPending = new URLSearchParams(location.search).get('checkout') === 'success', checkoutAttempts = 0;
  const checkoutNotice = document.createElement('div');
  checkoutNotice.setAttribute('role','status'); checkoutNotice.setAttribute('aria-live','polite');
  checkoutNotice.style.cssText='padding:12px 16px;background:var(--card,#fff);color:var(--text,#132b2b);border-bottom:1px solid #b8d6cd;text-align:center';
  checkoutNotice.hidden=true; gate.insertAdjacentElement('afterend',checkoutNotice);
  function checkoutMessage(text){checkoutNotice.textContent=text;checkoutNotice.hidden=!text;}
  function clearCheckoutQuery(){
    const url=new URL(location.href);url.searchParams.delete('checkout');
    history.replaceState(history.state,'',url.pathname+url.search+url.hash);
  }
  if(new URLSearchParams(location.search).get('checkout')==='cancelled'){
    checkoutMessage('Has vuelto del proceso de pago. Puedes consultar tu suscripción desde Más → Cuenta.');clearCheckoutQuery();
  }
  const setState = state => { document.documentElement.dataset.fiexeaAccess = state; };
  const showGate = (heading, detail, canPay = false) => {
    allowed = false; setState('blocked'); gate.hidden = false;
    title.textContent = heading; message.textContent = detail; plans.hidden = !canPay; retry.hidden = false; banner.hidden = true;
  };
  async function billingAvailability() {
    try {
      const response = await fetch(FIEXEA_SUPABASE_URL + '/functions/v1/create-checkout-session', { cache: 'no-store' });
      if (!response.ok) throw new Error('availability');
      const body = await response.json(); billingReady = body.billing_available === true;
    } catch (_) { billingReady = false; }
    billingChecked = true;
    signupButton.disabled = false;
    signupNotice.textContent = window.FiexeaInvitations?.pending ? 'Acceso gratuito por invitación. Crea tu cuenta con el correo destinatario y confírmalo para activarla.' : 'Prueba FIEXEA 7 días sin registro desde la bienvenida. Crear una cuenta no inicia otra prueba. Para acceder con cuenta necesitas un plan.';
    return billingReady;
  }
  // Guest access is local to this browser; it never grants an authenticated session.
  const guestKey = 'fiexea_guest_trial_v1', guestActiveKey = 'fiexea_guest_active';
  let guest = false, guestExpiryShown = false, plansPromptedFor = null;
  function guestRecord() {
    try { return JSON.parse(localStorage.getItem(guestKey) || 'null'); } catch (_) { return null; }
  }
  function guestActive() { try { return localStorage.getItem(guestActiveKey) === '1'; } catch (_) { return false; } }
  function leaveGuest(view = 'signup') {
    guest = false;
    try { localStorage.removeItem(guestActiveKey); } catch (_) {}
    signedOut(); originalGate(true); fiexeaShowView(view);
  }
  function resumeGuest() {
    if (fiexeaIsRecoveryUrl() || window.FiexeaInvitations?.pending || !guestActive()) return false;
    const record = guestRecord();
    if (!record || !Number.isFinite(record.started) || !Number.isFinite(record.lastSeen)) return false;
    guest = true;
    document.getElementById('fiexeaAccessLogout').textContent = 'Crear cuenta / Iniciar sesión';
    const remaining = Math.max(0, record.started + 7 * 24 * 3600000 - Math.max(Date.now(), record.lastSeen));
    const deadline = performance.now() + remaining;
    clearInterval(countdown);
    function tick() {
      const left = Math.max(0, Math.min(deadline - performance.now(), record.started + 7 * 24 * 3600000 - Math.max(Date.now(), record.lastSeen)));
      record.lastSeen = Math.max(record.lastSeen, Date.now(), record.started + 7 * 24 * 3600000 - left);
      try { localStorage.setItem(guestKey, JSON.stringify(record)); } catch (_) {}
      if (!left) {
        clearInterval(countdown); allowed = false; setState('blocked');
        gate.hidden = true; banner.hidden = true; originalGate(true);
        const notice = document.getElementById('fiexeaSignupExpired');
        if (notice) notice.hidden = false;
        document.getElementById('fiexeaSignupSubmit').textContent = 'Crear cuenta y elegir plan';
        if (!guestExpiryShown) {
          guestExpiryShown = true;
          fiexeaShowView('signup');
        }
        return;
      }
      allowed = true; setState('allowed'); gate.hidden = true; originalGate(false); banner.hidden = false;
      document.getElementById('fiexeaTrialRemaining').textContent = 'Prueba sin registro · Quedan ' + Math.floor(left / 3600000) + ' h ' + Math.floor(left % 3600000 / 60000) + ' min · Datos en este navegador';
      document.getElementById('fiexeaTrialPlans').hidden = true;
    }
    guestAccount.hidden = false;
    tick(); if (allowed) countdown = setInterval(tick, 1000);
    return true;
  }
  async function startGuest() {
    const button = document.getElementById('fiexeaWelcomeTrial'), errorBox = document.getElementById('fiexeaGuestError');
    button.disabled = true; errorBox.textContent = '';
    try {
      const { data: { session }, error } = await fiexeaSupabase.auth.getSession();
      if (error) throw error;
      if (session) { await checkAccess(session); return; }
      if (!guestRecord()) localStorage.setItem(guestKey, JSON.stringify({started: Date.now(), lastSeen: Date.now()}));
      localStorage.setItem(guestActiveKey, '1');
      resumeGuest();
    } catch (_) { errorBox.textContent = 'No se pudo iniciar la prueba. Permite el almacenamiento del navegador y vuelve a intentarlo.'; }
    finally { button.disabled = false; }
  }
  document.getElementById('fiexeaWelcomeTrial')?.addEventListener('click', startGuest);
  const guestAccount = document.createElement('button');
  guestAccount.type = 'button'; guestAccount.textContent = 'Crear cuenta / Iniciar sesión';
  guestAccount.addEventListener('click', () => leaveGuest('welcome'));
  banner.appendChild(guestAccount); guestAccount.hidden = true;
  function signedOut() {
    generation++; userId = ''; allowed = false; inFlight = null; clearTimeout(timer); clearInterval(countdown);
    gate.hidden = true; banner.hidden = true; checkoutMessage(''); window.resetPremiumView?.(); setState('signedout');
    guestAccount.hidden = true;
    if (resumeGuest()) guestAccount.hidden = false;
  }
  async function checkAccess(session, silent = false) {
    if (fiexeaIsRecoveryUrl()) { signedOut(); fiexeaShowGate(true); fiexeaShowView('reset'); return; }
    const id = session?.user?.id;
    if (!id) { signedOut(); return; }
    guest = false; guestAccount.hidden = true;
    document.getElementById('fiexeaAccessLogout').textContent = 'Cerrar sesión';
    if (id !== userId) { generation++; userId = id; allowed = false; inFlight = null; }
    if (inFlight) return inFlight;
    const checkGeneration = generation;
    clearTimeout(timer); clearInterval(countdown);
    if (!silent || !allowed) showGate('Comprobando tu acceso', 'Un momento, estamos consultando tu cuenta.');
    retry.hidden = true;
    inFlight = (async () => {
      try {
        if (window.FiexeaInvitations?.pending) {
          try { await window.FiexeaInvitations.redeem(session); }
          catch (error) { showGate('No se pudo activar la invitación', error.message); return; }
        }
        await window.FiexeaInvitations?.prepare(session);
        const { data, error } = await fiexeaSupabase.rpc('fiexea_access_status');
        if (error) throw error;
        const { data: latest } = await fiexeaSupabase.auth.getSession();
        if (latest.session?.user?.id !== id) return;
        if (generation !== checkGeneration || userId !== id || fiexeaIsRecoveryUrl()) return;
        if (!data || typeof data.allowed !== 'boolean') throw new Error('invalid-access');
        if(!checkoutPending && (!document.getElementById('premiumModal')?.hidden || document.getElementById('t9')?.classList.contains('active'))){
          window.refreshProfilePremium?.(id);
        }
        if(checkoutPending){
          if(['paid','admin','existing'].includes(data.state)){
            checkoutPending=false;clearCheckoutQuery();
            checkoutMessage(data.state==='paid'?'Tu suscripción Premium está activa.':'El acceso a tu cuenta está actualizado.');
            window.refreshProfilePremium?.(id);
          }else if(checkoutAttempts++<15){
            showGate('Confirmando tu suscripción','Estamos esperando la confirmación de Stripe. No vuelvas a pagar.');
            retry.hidden=true;timer=setTimeout(()=>refresh(true),2000);return;
          }else{
            checkoutMessage('La confirmación está tardando. No vuelvas a pagar. Usa Volver a comprobar o contacta con soporte@fiexea.es.');
            showGate('Tu pago aún no está confirmado','Tus datos siguen guardados. Pulsa Volver a comprobar para comprobarlo de nuevo.');
            retry.hidden=false;return;
          }
        }
        if (!data.allowed) {
          showGate(data.state === 'invitation_expired' ? 'Tu acceso por invitación ha terminado' : 'Tu prueba de 7 días ha terminado', data.state === 'invitation_expired' ? 'La invitación ha caducado o se ha desactivado. Tus datos siguen guardados. Contacta con soporte@fiexea.es para consultar tu acceso.' : 'Tus datos siguen guardados. Elige un plan mensual o anual para continuar usando FIEXEA.', data.state !== 'invitation_expired');
          if (data.state === 'expired' && plansPromptedFor !== id) {
            plansPromptedFor = id;
            openPremiumModal();
          }
          return;
        }
        allowed = true; setState('allowed'); gate.hidden = true; fiexeaAuthGate.hidden = true;
        let lease = 30000;
        if (data.state === 'trial' || data.state === 'invitation') {
          const invited = data.state === 'invitation';
          document.getElementById('fiexeaTrialPlans').hidden = invited;
          const remaining = Math.max(0, Date.parse(invited ? data.invitation_ends_at : data.trial_ends_at) - Date.parse(data.server_now));
          const deadline = performance.now() + remaining;
          banner.hidden = false;
          const tick = () => {
            const seconds = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
            const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60);
            document.getElementById('fiexeaTrialRemaining').textContent = (invited ? 'Invitación activa · Quedan ' : 'Prueba activa · Quedan ') + hours + ' h ' + minutes + ' min';
            if (seconds === 0) { clearInterval(countdown); showGate(invited ? 'Tu acceso por invitación ha terminado' : 'Tu prueba de 7 días ha terminado', invited ? 'Tus datos siguen guardados. Contacta con soporte@fiexea.es para consultar tu acceso.' : 'Tus datos siguen guardados. Elige un plan para continuar.', !invited); }
          };
          tick(); countdown = setInterval(tick, 1000); lease = Math.min(lease, remaining + 10);
        } else if (data.state === 'admin') {
          clearInterval(countdown);
          banner.hidden = false;
          document.getElementById('fiexeaTrialRemaining').textContent = 'Administrador de FIEXEA · Acceso permanente';
          document.getElementById('fiexeaTrialPlans').hidden = true;
        } else banner.hidden = true;
        timer = setTimeout(() => refresh(true), Math.max(100, lease));
      } catch (_) {
        if (generation !== checkGeneration || fiexeaIsRecoveryUrl()) return;
        showGate('No se pudo comprobar tu acceso', 'Comprueba tu conexión y vuelve a intentarlo. No se ha eliminado ningún dato.');
      } finally { if (generation === checkGeneration) inFlight = null; }
    })();
    return inFlight;
  }
  async function refresh(silent = false) {
    const { data: { session }, error } = await fiexeaSupabase.auth.getSession();
    if (error) { showGate('No se pudo comprobar tu sesión', 'Vuelve a iniciar sesión para continuar.'); return; }
    return checkAccess(session, silent);
  }
  const originalGate = fiexeaShowGate;
  fiexeaShowGate = function (show) {
    originalGate(show);
    if (show || fiexeaIsRecoveryUrl()) signedOut();
    else if (!allowed) { setState('checking'); setTimeout(() => refresh(), 0); }
  };
  fiexeaSupabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') signedOut();
    else if (session && !fiexeaIsRecoveryUrl()) setTimeout(() => checkAccess(session, event === 'TOKEN_REFRESHED'), 0);
  });
  retry.addEventListener('click', () => { checkoutAttempts=0;refresh(); });
  document.getElementById('fiexeaAccessLogout').addEventListener('click', async () => { if (guest) { leaveGuest('welcome'); return; } await fiexeaSupabase.auth.signOut(); signedOut(); fiexeaShowGate(true); fiexeaShowView('login'); });
  function showPlans() {
    // Viewing prices must remain available even before billing is activated.
    // Checkout performs its own availability and authorization checks.
    openPremiumModal();
  }
  plans.addEventListener('click', showPlans);
  document.getElementById('fiexeaTrialPlans').addEventListener('click', showPlans);
  signupButton.addEventListener('click', () => fiexeaShowView('signup'));
  document.getElementById('fiexeaSignupBack').addEventListener('click', () => fiexeaShowView('login'));
  document.getElementById('fiexeaSignupForm').addEventListener('submit', async event => {
    event.preventDefault();
    const result = document.getElementById('fiexeaSignupMessage'), submit = document.getElementById('fiexeaSignupSubmit');
    result.textContent = '';
    // El registro gratuito es independiente de la disponibilidad de Stripe; el acceso y el cobro se validan en Supabase.
    const email = document.getElementById('fiexeaSignupEmail').value.trim();
    const password = document.getElementById('fiexeaSignupPassword').value;
    if (password !== document.getElementById('fiexeaSignupPassword2').value) { result.textContent = 'Las contraseñas no coinciden.'; return; }
    if (!document.getElementById('fiexeaSignupTerms').checked) { result.textContent = 'Lee y acepta las condiciones para crear tu cuenta.'; return; }
    submit.disabled = true;
    try {
      const { data, error } = await fiexeaSupabase.auth.signUp({ email, password, options: { emailRedirectTo: window.FiexeaInvitations?.redirect() || fiexeaRedirectUrl() } });
      if (error) { result.textContent = fiexeaTranslateAuthError(error.message); return; }
      document.getElementById('fiexeaSignupForm').reset();
      result.textContent = 'Revisa tu correo para confirmar la cuenta. Después, inicia sesión para elegir tu plan. Crear la cuenta no realiza ningún cobro. Si ya tenías cuenta, inicia sesión o recupera tu contraseña.';
      if (data.session) await checkAccess(data.session);
    } catch (_) { result.textContent = 'No se ha podido crear la cuenta. Inténtalo de nuevo.'; }
    finally { submit.disabled = false; }
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { if (userId) refresh(); else if (guestActive()) resumeGuest(); } });
  window.addEventListener('focus', () => { if (userId) refresh(); });
  window.addEventListener('pageshow', event => { if (event.persisted) refresh(); });
  document.addEventListener('click', event => {
    if (!allowed && event.target.closest('.app,.nav')) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  billingAvailability().then(() => { if (window.FIEXEA_START_SIGNUP && !userId && !fiexeaIsRecoveryUrl()) fiexeaShowView('signup'); });
  window.FiexeaAccess={refresh};
  refresh();
})();


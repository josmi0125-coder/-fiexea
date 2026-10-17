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
    signupNotice.textContent = window.FiexeaInvitations?.pending ? 'Acceso gratuito por invitación. Crea tu cuenta con el correo destinatario y confírmalo para activarla.' : billingReady ? 'Prueba única de 3 días desde la creación de la cuenta. Sin tarjeta para empezar.' : 'Puedes crear tu cuenta y probar FIEXEA 3 días sin tarjeta. La contratación de Premium estará disponible cuando se activen los pagos.';
    return billingReady;
  }
  function signedOut() {
    generation++; userId = ''; allowed = false; inFlight = null; clearTimeout(timer); clearInterval(countdown);
    gate.hidden = true; banner.hidden = true; checkoutMessage(''); window.resetPremiumView?.(); setState('signedout');
  }
  async function checkAccess(session, silent = false) {
    if (fiexeaIsRecoveryUrl()) { signedOut(); fiexeaShowGate(true); fiexeaShowView('reset'); return; }
    const id = session?.user?.id;
    if (!id) { signedOut(); return; }
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
          showGate(data.state === 'invitation_expired' ? 'Tu acceso por invitación ha terminado' : 'Tu prueba de 3 días ha terminado', data.state === 'invitation_expired' ? 'La invitación ha caducado o se ha desactivado. Tus datos siguen guardados. Contacta con soporte@fiexea.es para consultar tu acceso.' : 'Tus datos siguen guardados. Elige un plan mensual o anual para continuar usando FIEXEA.', data.state !== 'invitation_expired');
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
            if (seconds === 0) { clearInterval(countdown); showGate(invited ? 'Tu acceso por invitación ha terminado' : 'Tu prueba de 3 días ha terminado', invited ? 'Tus datos siguen guardados. Contacta con soporte@fiexea.es para consultar tu acceso.' : 'Tus datos siguen guardados. Elige un plan para continuar.', !invited); }
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
  document.getElementById('fiexeaAccessLogout').addEventListener('click', async () => { await fiexeaSupabase.auth.signOut(); signedOut(); fiexeaShowGate(true); fiexeaShowView('login'); });
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
      result.textContent = 'Revisa tu correo para confirmar el acceso. Si ya tenías cuenta, inicia sesión o recupera tu contraseña.';
      if (data.session) await checkAccess(data.session);
    } catch (_) { result.textContent = 'No se ha podido crear la cuenta. Inténtalo de nuevo.'; }
    finally { submit.disabled = false; }
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && userId) refresh(); });
  window.addEventListener('focus', () => { if (userId) refresh(); });
  window.addEventListener('pageshow', event => { if (event.persisted) refresh(); });
  document.addEventListener('click', event => {
    if (!allowed && event.target.closest('.app,.nav')) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  billingAvailability().then(() => { if (window.FIEXEA_START_SIGNUP && !userId && !fiexeaIsRecoveryUrl()) fiexeaShowView('signup'); });
  window.FiexeaAccess={refresh};
  refresh();
})();


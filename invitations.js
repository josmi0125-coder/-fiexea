(() => {
  'use strict';
  const storageKey = 'fiexea-pending-invitation';
  const incomingUrl = new URL(location.href);
  const match = location.hash.match(/^#invite=([a-f0-9]{64})$/);
  const incomingToken = match?.[1] || incomingUrl.searchParams.get('invite');
  let token = null;
  try { if (/^[a-f0-9]{64}$/.test(incomingToken || '')) sessionStorage.setItem(storageKey, incomingToken); token = sessionStorage.getItem(storageKey); } catch (_) { token = /^[a-f0-9]{64}$/.test(incomingToken || '') ? incomingToken : null; }
  if (match || incomingUrl.searchParams.has('invite')) { incomingUrl.searchParams.delete('invite'); if(match) incomingUrl.hash=''; history.replaceState(null, '', incomingUrl.pathname + incomingUrl.search + incomingUrl.hash); }
  let admin = false, identity = null, activation = null, verifiedUser = null;
  const rpc = async (action, payload = {}) => {
    const { data, error } = await fiexeaSupabase.rpc('fiexea_invitations', { action, payload });
    if (error) throw new Error(error.message || 'No se pudo completar la operación.');
    return data;
  };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, x => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[x]));
  const date = value => value ? new Date(value).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  const style = document.createElement('style');
  style.textContent = '#fiexeaAdminDialog{width:min(850px,calc(100% - 24px));max-height:90dvh;overflow:auto;border:1px solid var(--line,#ddd);border-radius:22px;padding:24px;background:var(--panel,#fff);color:var(--text,#17292d)}#fiexeaAdminDialog::backdrop{background:#10202799}#fiexeaAdminDialog h2{margin:0}#fiexeaAdminDialog .admin-head{display:flex;justify-content:space-between;align-items:center;gap:15px}#fiexeaAdminDialog button,#fiexeaAdminDialog input,#fiexeaAdminDialog select{font:inherit}#fiexeaAdminDialog button{cursor:pointer;padding:10px 14px;border:1px solid #ccdcd8;border-radius:10px;background:#eef6f3;color:#0f766e}#fiexeaAdminDialog label{display:grid;gap:5px;font-size:14px}#fiexeaAdminDialog input,#fiexeaAdminDialog select{width:100%;padding:11px;border:1px solid #c5d4d0;border-radius:9px;box-sizing:border-box;background:var(--bg,#fff);color:inherit}#fiexeaAdminDialog .admin-fields{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:18px 0}#fiexeaAdminDialog .admin-wide{grid-column:1/-1}#fiexeaAdminDialog .admin-muted{font-size:13px;color:var(--muted,#60727a);line-height:1.5}#fiexeaAdminDialog .admin-item{border:1px solid #dbe5e2;border-radius:14px;padding:16px;margin:12px 0;overflow-wrap:anywhere}#fiexeaAdminDialog .admin-item p{margin:7px 0}#fiexeaAdminDialog .admin-actions{display:flex;flex-wrap:wrap;gap:8px}#fiexeaAdminDialog [role=status]{min-height:1.5em;margin:12px 0;overflow-wrap:anywhere}#fiexeaInviteNotice{padding:12px;border:1px solid #a9cebf;border-radius:10px;margin:12px 0;font-size:14px}#fiexeaAdminDialog [hidden]{display:none!important}@media(max-width:520px){#fiexeaAdminDialog{padding:18px}#fiexeaAdminDialog .admin-fields{grid-template-columns:1fr}}';
  document.head.append(style);
  const dialog = document.createElement('dialog');
  dialog.id = 'fiexeaAdminDialog'; dialog.setAttribute('aria-labelledby','fiexeaAdminTitle');
  dialog.innerHTML = `<div class="admin-head"><h2 id="fiexeaAdminTitle">Invitaciones</h2><button type="button" data-close aria-label="Cerrar administración">Cerrar</button></div><p class="admin-muted">Acceso gratuito por invitación. Cada enlace sirve una sola vez y solo para el correo indicado. La revocación corta este acceso y conserva los datos; una suscripción independiente sigue siendo válida.</p><form id="fiexeaInviteCreate"><div class="admin-fields"><label>Correo destinatario<input name="email" type="email" required maxlength="254" autocomplete="off"></label><label>Nombre o nota<input name="label" maxlength="100" autocomplete="off"></label><label>Vigencia<select name="mode"><option value="days">Días desde la activación</option><option value="date">Hasta una fecha</option></select></label><label id="fiexeaInviteDays">Días de acceso<input name="days" type="number" min="1" max="365" value="7" required></label><label id="fiexeaInviteDate" hidden>Fecha y hora de fin<input name="end" type="datetime-local"></label></div><p class="admin-muted">El enlace debe activarse en los próximos 30 días o antes de la fecha de fin, si es anterior. Después de crearlo, copia y guarda el enlace: no se mostrará de nuevo.</p><button type="submit">Crear invitación</button></form><p id="fiexeaAdminMessage" role="status" aria-live="polite"></p><div id="fiexeaInviteResult" hidden><label>Enlace de un solo uso<input id="fiexeaInviteLink" readonly></label><button type="button" id="fiexeaInviteCopy">Copiar enlace</button></div><h3>Invitaciones creadas</h3><button type="button" id="fiexeaInviteRefresh">Actualizar lista</button><div id="fiexeaInviteList"></div>`;
  document.body.append(dialog);
  const form = dialog.querySelector('form'), message = dialog.querySelector('[role=status]'), list = dialog.querySelector('#fiexeaInviteList');
  const showMessage = text => { message.textContent = text; };
  async function load() {
    const rows = await rpc('list');
    list.innerHTML = rows.length ? rows.map(row => `<article class="admin-item"><strong>${escape(row.label || row.email)}</strong><p>${escape(row.email)} · <b>${escape(row.status)}</b></p><p class="admin-muted">Creada: ${escape(date(row.created_at))}<br>Activada: ${escape(date(row.redeemed_at))}<br>${row.redeemed_at ? 'Fin del acceso: '+escape(date(row.access_until)) : 'Activar antes de: '+escape(date(row.redeem_by))+'<br>Vigencia: '+escape(row.duration_days ? row.duration_days+' días desde la activación' : 'Hasta '+date(row.fixed_end))}</p>${!row.revoked_at ? `<div class="admin-actions"><button type="button" data-extend="${escape(row.id)}">Ampliar plazo</button><button type="button" data-revoke="${escape(row.id)}">Desactivar acceso</button></div>` : ''}</article>`).join('') : '<p class="admin-muted">Todavía no has creado invitaciones.</p>';
  }
  function reset() {
    window.FiexeaTrials?.reset();
    admin = false; identity = null; verifiedUser = null;
    document.getElementById('fiexeaAdminMenu')?.remove();
    if (dialog.open) dialog.close();
    form.reset(); list.replaceChildren(); showMessage('');
    dialog.querySelector('#fiexeaInviteLink').value=''; dialog.querySelector('#fiexeaInviteResult').hidden=true;
  }
  async function prepare(session) {
    const uid = session?.user?.id;
    if (!uid) { reset(); return; }
    if (verifiedUser === uid) return;
    if (identity !== uid) reset();
    identity = uid;
    const data = await rpc('status');
    if (identity !== uid) return;
    admin = data.admin === true; verifiedUser = uid;
    if (admin && !document.getElementById('fiexeaAdminMenu')) {
      const group = document.createElement('div'); group.id='fiexeaAdminMenu'; group.className='more-menu-group';
      group.innerHTML='<h3>Administración</h3><button type="button"><span class="menu-icon" aria-hidden="true">🔑</span>Invitaciones<span class="more-menu-description">Crea enlaces, controla su vigencia y desactiva el acceso.</span></button>';
      group.querySelector('button').addEventListener('click', async () => { if(!admin)return; dialog.showModal(); try { await load(); } catch(e) { showMessage(e.message); } });
      document.getElementById('navMoreMenu')?.prepend(group);
    }
    window.FiexeaTrials?.setAdmin(admin, uid);
  }
  async function redeem(session) {
    if (!token || !session?.user?.id) return;
    if (activation) return activation;
    activation = (async()=>{
      await rpc('redeem',{ token });
      token = null; try { sessionStorage.removeItem(storageKey); } catch (_) {}
      document.getElementById('fiexeaInviteNotice')?.remove();
    })();
    try { await activation; } finally { activation=null; }
  }
  if (token) {
    const notice=document.createElement('div'); notice.id='fiexeaInviteNotice';
    notice.append(document.createTextNode('Tienes una invitación gratuita. Inicia sesión o crea una cuenta con el correo destinatario y confirma tu correo para activarla. '));
    const remove=document.createElement('button'); remove.type='button'; remove.textContent='Quitar invitación';
    remove.addEventListener('click',()=>{token=null;try{sessionStorage.removeItem(storageKey)}catch(_){}location.reload()});notice.append(remove);
    (document.getElementById('fiexeaAuthGate') || document.body).prepend(notice);
  }
  const mode = form.elements.mode;
  mode.addEventListener('change',()=>{const fixed=mode.value==='date';dialog.querySelector('#fiexeaInviteDate').hidden=!fixed;dialog.querySelector('#fiexeaInviteDays').hidden=fixed;form.elements.end.required=fixed;form.elements.end.disabled=!fixed;form.elements.days.required=!fixed;form.elements.days.disabled=fixed;});
  dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
  form.addEventListener('submit',async event=>{
    event.preventDefault(); const submit=form.querySelector('[type=submit]'); submit.disabled=true; showMessage('Creando invitación…');
    dialog.querySelector('#fiexeaInviteResult').hidden=true;dialog.querySelector('#fiexeaInviteLink').value='';
    try {
      const fixed=mode.value==='date';
      const payload={email:form.elements.email.value.trim(),label:form.elements.label.value.trim(),duration_days:fixed?null:Number(form.elements.days.value),fixed_end:fixed?new Date(form.elements.end.value).toISOString():null};
      const result=await rpc('create',payload);const link=new URL('app.html',location.href);link.search='';link.hash='invite='+result.token;
      dialog.querySelector('#fiexeaInviteLink').value=link.href;dialog.querySelector('#fiexeaInviteResult').hidden=false;
      showMessage('Invitación creada. Copia el enlace y envíalo al destinatario.'); await load();
    }catch(e){showMessage(e.message)}finally{submit.disabled=false}
  });
  dialog.querySelector('#fiexeaInviteCopy').addEventListener('click',async()=>{const input=dialog.querySelector('#fiexeaInviteLink');try{await navigator.clipboard.writeText(input.value);showMessage('Enlace copiado.')}catch(_){input.focus();input.select();showMessage('Mantén pulsado el enlace seleccionado y elige Copiar.')}});
  dialog.querySelector('#fiexeaInviteRefresh').addEventListener('click',async()=>{try{await load();showMessage('Lista actualizada.')}catch(e){showMessage(e.message)}});
  list.addEventListener('click',async event=>{
    const button=event.target.closest('button');if(!button)return;
    let action,payload;
    if(button.dataset.revoke){if(!confirm('¿Desactivar esta invitación y el acceso que concede? Los datos se conservarán.'))return;action='revoke';payload={id:button.dataset.revoke};}
    else if(button.dataset.extend){const answer=prompt('¿Cuántos días quieres añadir? (1–365)','7');if(answer===null)return;const days=Number(answer);if(!Number.isInteger(days)||days<1||days>365){showMessage('Indica entre 1 y 365 días.');return}action='extend';payload={id:button.dataset.extend,days};}else return;
    button.disabled=true;try{await rpc(action,payload);await load();showMessage(action==='revoke'?'Acceso desactivado.':'Plazo ampliado.')}catch(e){showMessage(e.message)}finally{button.disabled=false}
  });
  fiexeaSupabase.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT')reset()});
  window.FiexeaInvitations={prepare,redeem,get pending(){return !!token},redirect(){const url=new URL(fiexeaRedirectUrl());if(token)url.searchParams.set('invite',token);return url.href;}};
})();

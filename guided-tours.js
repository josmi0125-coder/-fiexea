/* Optional, account-scoped walkthroughs. Navigation only: users submit their own forms. */
(()=>{
'use strict';
const $=s=>document.querySelector(s),tr=s=>window.fiexeaTourTranslate?.(s)||window.fiexeaTranslate?.(s)||s;
const step=(target,text)=>({target,text});
const movementSteps=[
 step('#openMoveEditor','Pulsa Añadir categoría para abrir las categorías disponibles.'),
 step('.category-manager-tabs','Elige Gastos o Ingresos. Así se clasificará el movimiento que vas a añadir.'),
 step('#categoryManagerList','Toca la categoría que quieras utilizar. Quedará añadida a Mis categorías y se abrirá su movimiento.'),
 step('#mvAmount','Escribe el importe real del movimiento.'),
 step('#mvDate','Elige la fecha del movimiento. Puedes registrar también fechas anteriores.'),
 step('#moveDescriptionField','Añade una descripción si la necesitas y revisa los datos.'),
 step('#moveQuickSave','Pulsa Guardar cuando quieras registrar el movimiento. Terminar guía solo cierra la ayuda; no guarda el formulario.')
];
const catalog={
 home:{title:'Inicio',tab:0,steps:[
  step('#t0 .hero','Aquí puedes consultar tu patrimonio neto: el valor de tus activos menos tus deudas.'),
  step('#t0 .home-month-grid','Consulta tus ingresos, gastos y balance del mes. Toca una tarjeta para ver el detalle.'),
  step('#t0 .home-shortcuts','Usa los accesos rápidos para registrar datos o abrir una sección.')
 ]},
 analysis:{title:'Análisis financiero',tab:5,steps:[
  step('#operationsAnalysisPeriod','Elige el periodo que quieres consultar.'),
  step('#t5 .analysis-summary-grid','Consulta los ingresos, gastos y balance calculados con tus movimientos.'),
  step('#financialAnalysisToggle','Abre Análisis anual para revisar el resumen de un año.')
 ]},
 more:{title:'Más',tab:10,steps:[
  step('#navMoreMenu [data-more-action="profile"]','Abre tu perfil para consultar los datos de tu cuenta.'),
  step('#navMoreMenu [data-more-action="settings"]','En Ajustes puedes cambiar idioma, moneda, inicio del mes y apariencia.'),
  step('#navMoreMenu [data-more-action="help"]','En Ayuda encontrarás todas las guías paso a paso.')
 ]},
 accounts:{title:'Cuentas',tab:7,steps:[
  step('#t7 .account-add-button','Pulsa Añadir cuenta para registrar una cuenta manualmente.'),
  step('#accName','Escribe un nombre para reconocer la cuenta.'),
  step('#accBalance','Introduce el saldo inicial y revisa los demás datos.'),
  step('#manualAccountForm .account-manual-actions button','Pulsa Guardar cuenta para registrarla. Terminar guía no guarda por ti.')
 ]},
 settings:{title:'Ajustes',tab:6,steps:[
  step('#languageSettingsSelect','Elige el idioma de la aplicación.'),
  step('#appCurrencySelect','Elige la moneda para mostrar tus importes. No convierte los saldos.'),
  step('#cycleStartDaySelect','Elige el día en que empieza tu mes financiero.'),
  step('#appearanceSelect','Elige la apariencia que prefieras.')
 ]},
 investment:{title:'Añadir una inversión',tab:4,steps:[
  step('#investmentAddToggle','Pulsa Añadir inversión para abrir el formulario.'),
  step('#iName','Escribe un nombre para reconocer la inversión.'),
  step('#iVal','Introduce su valor actual. Los valores se actualizan manualmente.'),
  step('#iType','Selecciona el tipo de inversión.'),
  step('#iInvested','Puedes indicar el dinero aportado neto para calcular la ganancia o pérdida.'),
  step('#investmentSaveButton','Revisa los datos y pulsa Guardar inversión. Terminar guía no guarda por ti.')
 ]},

 category:{title:'Crear una categoría y su primer movimiento',tab:1,steps:movementSteps},
 expense:{title:'Añadir un gasto',tab:1,steps:[movementSteps[0],step('#categoryManagerExpenseTab','Selecciona Gastos para registrar una salida de dinero.'),...movementSteps.slice(2)]},
 income:{title:'Añadir un ingreso',tab:1,steps:[movementSteps[0],step('#categoryManagerIncomeTab','Selecciona Ingresos para registrar una entrada de dinero.'),...movementSteps.slice(2)]},
 debt:{title:'Añadir una deuda',tab:2,steps:[
  step('#debtEditorDetails > summary','Abre Añadir deuda para ver el formulario.'),
  step('#dEntity','Indica la entidad si la conoces y el nombre que quieres dar a la deuda.'),
  step('#dBal','Escribe el capital pendiente, no la cantidad inicial del préstamo.'),
  step('#debtEditorDetails .form','Completa la cuota, el interés y los demás datos que tengas. Revisa las unidades de cada campo.'),
  step('#debtSaveButton','Revisa los datos y pulsa Añadir deuda para guardarla. Terminar guía no guarda por ti.')
 ]},
 asset:{title:'Añadir un activo',tab:4,steps:[
  step('[aria-controls="assetEditor"]','Abre Añadir activo para registrar algo que forma parte de tu patrimonio.'),
  step('#aName','Escribe un nombre que te permita reconocer el activo.'),
  step('#aVal','Introduce su valor actual estimado.'),
  step('#aType','Selecciona el tipo de activo y revisa la información.'),
  step('#assetSaveButton','Pulsa Guardar activo para registrarlo. Terminar guía solo cierra esta ayuda.')
 ]},
 goal:{title:'Crear un objetivo de ahorro',tab:3,steps:[
  step('#openGoalFormButton','Abre Crear objetivo para definir tu meta.'),
  step('#gName','Pon un nombre al objetivo, por ejemplo Fondo de emergencia.'),
  step('#gTarget','Indica cuánto quieres conseguir.'),
  step('#gSaved','Escribe lo que ya tienes ahorrado para esta meta.'),
  step('#gDeadline','Puedes indicar una fecha objetivo para calcular una aportación mensual orientativa.'),
  step('#goalSaveButton','Revisa los datos y pulsa Crear objetivo. Terminar guía no crea el objetivo.')
 ]},
 calendar:{title:'Crear un gasto del calendario',tab:11,steps:[
  step('#calendarAdd','Pulsa Añadir gasto con fecha para planificar un recibo.'),
  step('#calName','Escribe el nombre del gasto y el importe del primer pago.'),
  step('#calDate','Elige la fecha exacta. Si ya lo pagaste, marca Ya está pagado en esta fecha.'),
  step('#calReceipt','Adjunta el recibo o factura si lo tienes.'),
  step('#calSplitLabel','Si se paga en varios plazos, activa Pago fraccionado y completa cada pago con su fecha, importe y recibo.'),
  step('#calendarEditor details','En Más opciones puedes elegir categoría, vivienda y revisión para la renta. Marcarlo no confirma su deducibilidad.'),
  step('#calendarPlanSubmit','Pulsa Guardar gasto para registrarlo. Los pendientes no crean movimientos; los pagos marcados como pagados sí.')
 ]},
 budget:{title:'Poner mi límite mensual',tab:1,steps:[
  step('.monthly-budget-toggle','Abre Mi presupuesto, debajo de las categorías.'),
  step('#budgetMonthLabel','Comprueba el mes. Las flechas permiten cambiarlo.'),
  step('#monthlyBudgetInput','Escribe tu límite del mes. Este campo se guarda automáticamente al escribir.'),
  step('.monthly-budget-values','Consulta cuánto has gastado y cuánto te queda. El límite es independiente del saldo de tus cuentas.')
 ]}
};
let active=null,highlight=null,coach=null,chooser=null,lastOwner='',previousFocus=null,timer=null;
const memory=new Map();
function owner(){
 const account=typeof financialActiveUserId!=='undefined'?financialActiveUserId||'':'';
 if(account)return account;
 // Guest access is granted by access.js; guide preferences stay separate from accounts.
 try{if(localStorage.getItem('fiexea_guest_active')==='1')return 'guest-trial'}catch(_){}
 return '';
}
function ready(){return !!owner()&&typeof financialAppReady!=='undefined'&&financialAppReady&&document.documentElement.dataset.fiexeaAccess==='allowed'}
function storageKey(id=owner()){return 'fiexea_guides_v1_'+encodeURIComponent(id)}
function preference(id=owner()){try{return JSON.parse(localStorage.getItem(storageKey(id))||'null')||memory.get(id)||{}}catch(_){return memory.get(id)||{}}}
function remember(update){const id=owner();if(!id)return;const next={...preference(id),...update};memory.set(id,next);try{localStorage.setItem(storageKey(id),JSON.stringify(next))}catch(_){}}
function visible(el){const modal=document.querySelector('dialog[open]');return !!el&&el.isConnected&&!el.closest('[hidden]')&&el.getClientRects().length>0&&(!modal||modal.contains(el))}
function find(selector){return [...document.querySelectorAll(selector)].find(visible)||null}
function button(text,action,primary=false){const b=document.createElement('button');b.type='button';b.className=primary?'tour-primary':'tour-secondary';b.textContent=tr(text);b.addEventListener('click',action);return b}
function clearHighlight(){highlight?.classList.remove('tour-highlight');highlight=null}
function stop(status='skipped',restoreFocus=true){
 if(active&&owner()===active.owner)remember({intro:'seen',[active.id]:status});
 active=null;clearHighlight();coach?.remove();coach=null;clearInterval(timer);timer=null;
 document.body.classList.remove('tour-running');
 document.querySelectorAll('.tour-scroll-space').forEach(el=>el.remove());
 if(restoreFocus&&visible(previousFocus))previousFocus.focus({preventScroll:true});
}
let positioning=false;
function position(){
 if(!coach)return;

 if(positioning)return;
 const focused=document.activeElement;
 const editing=!!focused?.matches('input,select,textarea')&&!coach.contains(focused);
 coach.classList.toggle('tour-editing',editing);
 const vp=window.visualViewport,w=vp?.width||innerWidth,h=vp?.height||innerHeight,x=vp?.offsetLeft||0,y=vp?.offsetTop||0;
 coach.style.width=Math.max(180,Math.min(350,w-24))+'px';
 coach.style.maxHeight=Math.max(60,Math.min(h-24,editing?90:300))+'px';
 const target=editing?focused:highlight;
 let rect=target?.getBoundingClientRect();
 const height=coach.getBoundingClientRect().height;
 let top=y+h-height-12;
 if(rect){
  if(rect.bottom+height+24<=y+h)top=rect.bottom+12;
  else if(rect.top-height-12>=y+12)top=rect.top-height-12;
  else{
   // Reserve enough scroll room to move the active control above the coach.
   let scroller=target.parentElement;
   while(scroller&&scroller!==document.body){
    if(scroller.scrollHeight>scroller.clientHeight&&/(auto|scroll)/.test(getComputedStyle(scroller).overflowY))break;
    scroller=scroller.parentElement;
   }
   const host=scroller||document.body;
   let space=host.querySelector(':scope > .tour-scroll-space');
   if(!space){space=document.createElement('div');space.className='tour-scroll-space';space.setAttribute('aria-hidden','true');host.appendChild(space)}
   space.style.height=(height+32)+'px';
   const shift=rect.bottom-(top-12);
   if(shift>0){
    positioning=true;
    if(scroller&&scroller!==document.body)scroller.scrollTop+=shift;
    else window.scrollBy(0,shift);
    positioning=false;
   }
  }
 }
 coach.style.left=Math.max(x+12,Math.min(rect?.left||x+12,x+w-coach.offsetWidth-12))+'px';
 coach.style.top=Math.max(y+8,Math.min(top,y+h-height-8))+'px';
}
function announce(message){if(coach)coach.querySelector('.tour-hint').textContent=tr(message)}
function showStep(index,scroll=true){
 if(!active)return false;
 if(index===2&&['expense','income'].includes(active.id)){
  const tab=find(active.id==='expense'?'#categoryManagerExpenseTab':'#categoryManagerIncomeTab');
  if(tab?.getAttribute('aria-selected')!=='true'){announce(active.id==='expense'?'Selecciona Gastos para registrar una salida de dinero.':'Selecciona Ingresos para registrar una entrada de dinero.');return false}
 }
 const tour=catalog[active.id],s=tour.steps[index],target=find(s.target);
 if(!target){announce('Primero realiza la acción indicada. Puedes saltar la guía en cualquier momento.');return false}
 active.index=index;active.target=target;clearHighlight();highlight=target;target.classList.add('tour-highlight');
 // A coach inside an open native dialog remains above its modal backdrop.
 const host=target.closest('dialog[open]')||document.body;
 if(!coach){coach=document.createElement('section');coach.className='tour-coach';coach.setAttribute('role','dialog');coach.setAttribute('aria-modal','false');coach.setAttribute('aria-labelledby','tourCoachTitle')}
 host.appendChild(coach);coach.replaceChildren();
 const progress=document.createElement('small');progress.textContent=(index+1)+' / '+tour.steps.length+' · '+tr(tour.title);coach.appendChild(progress);
 const title=document.createElement('h3');title.id='tourCoachTitle';title.textContent=tr('Paso a paso');coach.appendChild(title);
 const p=document.createElement('p');p.textContent=tr(s.text);p.setAttribute('aria-live','polite');coach.appendChild(p);
 const hint=document.createElement('p');hint.className='tour-hint';hint.setAttribute('role','status');coach.appendChild(hint);
 const actions=document.createElement('div');actions.className='tour-actions';
 const back=button('Atrás',()=>{for(let i=active.index-1;i>=0;i--)if(showStep(i))break});back.disabled=index===0;actions.appendChild(back);
 actions.appendChild(button(index===tour.steps.length-1?'Terminar guía':'Siguiente',()=>{if(index===tour.steps.length-1){stop('completed');return}showStep(index+1)},true));
 actions.appendChild(button('Saltar guía',()=>stop()));coach.appendChild(actions);
 if(scroll)target.scrollIntoView({behavior:'auto',block:'center'});
 requestAnimationFrame(position);return true;
}
function start(id){
 if(!catalog[id]||!ready())return;
 if(document.querySelector('dialog[open]')){if(chooser?.open)chooser.close();else return}
 window.closeHelpCenter?.(false);stop('skipped',false);previousFocus=document.activeElement;
 remember({intro:'seen'});lastOwner=owner();const tour=catalog[id];
 if(tour.tab===11)window.openExpenseCalendar?.();else window.tab?.(tour.tab);
 active={id,index:0,owner:owner(),tab:tour.tab,target:null};document.body.classList.add('tour-running');
 // Existing open editors are left intact. Start at the first visible step.
 let first=tour.steps.findIndex(s=>find(s.target));if(first<0){stop('skipped');return}
 showStep(first);timer=setInterval(tick,350);
}
function tick(){
 if(!active)return;
 if(!ready()||owner()!==active.owner){stop('skipped',false);return}
 const currentTab=$('.tab.active')?.id;if(currentTab&&currentTab!=='t'+active.tab){stop('skipped',false);return}
 const target=find(catalog[active.id].steps[active.index].target);
 if(!target){
  // Opening a form or saving can replace the current target; follow only visible later steps.
  const steps=catalog[active.id].steps;
  for(let i=active.index+1;i<steps.length;i++)if(find(steps[i].target)){showStep(i);return}
  stop(active.index===steps.length-1?'completed':'skipped',false);return;
 }
 if(target!==highlight)showStep(active.index,false);else position();
}
function showChooser(welcome=false,ids=null){
 if(!ready()||active)return;
 if(chooser?.open)return;
 previousFocus=document.activeElement;const chooserOwner=owner();lastOwner=chooserOwner;
 chooser=document.createElement('dialog');chooser.className='tour-chooser';chooser.setAttribute('aria-labelledby','tourChooserTitle');
 const h=document.createElement('h2');h.id='tourChooserTitle';h.textContent=tr(welcome?'¿Quieres que te enseñemos cómo empezar?':'Guías paso a paso');chooser.appendChild(h);
 const p=document.createElement('p');p.textContent=tr(welcome?'Aprende creando una categoría y su primer movimiento. Tú eliges cuándo guardar y puedes saltar la guía.':'Elige qué quieres aprender. Los globos señalan los controles de la aplicación mientras la utilizas.');chooser.appendChild(p);
 const actions=document.createElement('div');actions.className='tour-actions';
 if(welcome)actions.appendChild(button('Empezar guía',()=>{chooser.close();start('category')},true));
 else{const list=document.createElement('div');list.className='tour-list';for(const [id,tour] of Object.entries(catalog).filter(([id])=>!ids||ids.includes(id)))list.appendChild(button(tour.title,()=>{chooser.close();start(id)}));chooser.appendChild(list)}
 actions.appendChild(button(welcome?'Saltar guía':'Cerrar',()=>chooser.close()));chooser.appendChild(actions);
 chooser.addEventListener('close',()=>{if(owner()===chooserOwner)remember({intro:'seen'});chooser.remove();if(visible(previousFocus))previousFocus.focus({preventScroll:true})},{once:true});
 chooser.addEventListener('cancel',()=>{if(owner()===chooserOwner)remember({intro:'seen'})});document.body.appendChild(chooser);chooser.showModal();
}
function checkWelcome(){
 if(owner()!==lastOwner){if(active)stop('skipped',false);chooser?.close();lastOwner=owner()}
 if(!ready()||active||chooser?.open||preference().intro)return;
 if(document.querySelector('dialog[open],.help-overlay:not([hidden]),.ux-info-overlay:not([hidden])'))return;
 // Offer onboarding on the next visit; never take over an already open form.
 if(document.activeElement?.matches('input,select,textarea')||document.querySelector('#moveEditor:not([hidden]),#budgetCategoryForm:not([hidden]),#assetEditor:not([hidden]),#goalEditorCard:not([hidden]),#investmentEditor:not([hidden]),#debtEditorDetails[open]'))return;
 showChooser(true);
}

const sectionGuides=[
 ['#t0 .home-section-kicker',['home']],
 ['#t1 > .section h2',['category','expense','income','budget']],
 ['#t2 > .section h2',['debt']],
 ['#t3 .goals-overview-heading h2',['goal']],
 ['#t4 .wealth-overview-heading h2',['asset','investment']],
 ['#t5 .analysis-page-heading h2',['analysis']],
 ['#t7 > .section h2',['accounts']],
 ['#t6 > .section h2',['settings']],
 ['#t10 > .section h2',['more']],
 ['#t11 h2',['calendar']]
];
function openSectionGuide(ids){
 if(active)stop('skipped',false);
 if(ids.length===1)start(ids[0]);else showChooser(false,ids);
}
function installSectionGuides(){
 for(const [selector,ids] of sectionGuides){
  const heading=document.querySelector(selector);
  if(!heading||heading.parentElement.classList.contains('tour-section-heading'))continue;
  const row=document.createElement('div');row.className='tour-section-heading';
  heading.before(row);row.appendChild(heading);
  const help=document.createElement('button');help.type='button';help.className='tour-section-help';
  help.dataset.guideIds=ids.join(',');help.setAttribute('aria-label',tr('Guías paso a paso'));
  help.title=tr('Guías paso a paso');
  help.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/></svg>';
  const label=document.createElement('span');label.className='tour-section-help-label';label.textContent=tr('Guía');help.appendChild(label);
  help.addEventListener('click',()=>openSectionGuide(ids));row.appendChild(help);
 }
}

function init(){
 installSectionGuides();
 if(typeof MutationObserver==='function'){
  const root=document.querySelector('main')||document.body;
  let pending=false;
  const observer=new MutationObserver(()=>{
   if(pending)return;
   pending=true;
   requestAnimationFrame(()=>{
    pending=false;
    observer.disconnect();
    try{installSectionGuides()}finally{observer.observe(root,{childList:true,subtree:true})}
   });
  });
  observer.observe(root,{childList:true,subtree:true});
 }
 const helpButton=document.getElementById('guidedToursOpen');
 const updateHelpLabel=()=>{if(helpButton)helpButton.textContent='🧭 '+tr('Guías paso a paso')};updateHelpLabel();
 helpButton?.addEventListener('click',()=>showChooser());
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active){e.preventDefault();stop()}});
 document.addEventListener('focusin',e=>{
  if(!active||coach?.contains(e.target))return;
  const steps=catalog[active.id].steps;
  const index=steps.findIndex(s=>{const el=find(s.target);return el&&(el===e.target||el.contains(e.target))});
  if(index>active.index)showStep(index,false);
  position();
 });
 document.addEventListener('focusout',()=>requestAnimationFrame(position));
 document.addEventListener('click',e=>{
  if(!active||coach?.contains(e.target)||!highlight?.contains(e.target)||e.target.matches('input,select,textarea'))return;
  const current=active;
  setTimeout(()=>{
   if(active!==current)return;
   const next=active.index+1;
   if(next<catalog[active.id].steps.length&&find(catalog[active.id].steps[next].target))showStep(next,false);
  },80);
 });
 window.addEventListener('resize',position);window.addEventListener('scroll',position,true);window.visualViewport?.addEventListener('resize',position);window.visualViewport?.addEventListener('scroll',position);
 document.addEventListener('fiexea:language',()=>{updateHelpLabel();document.querySelectorAll('.tour-section-help').forEach(b=>{b.title=tr('Guías paso a paso');b.setAttribute('aria-label',b.title);const label=b.querySelector('.tour-section-help-label');if(label)label.textContent=tr('Guía')});if(active)showStep(active.index,false)});
 setInterval(checkWelcome,2000);
}
window.FiexeaTours={open:()=>showChooser(),start,stop,catalog};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

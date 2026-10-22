/* FIEXEA scheduled expenses. Uses the existing account-scoped backup/sync pipeline. */
(()=>{
'use strict';
const M=window.FiexeaCalendarMath,KEY='fiexea_scheduled_expenses';
if(!M)return;
const ReceiptStore=window.FiexeaReceiptStorage&&typeof fiexeaSupabase!=='undefined'?window.FiexeaReceiptStorage.create({client:fiexeaSupabase,getOwner:()=>financialAppReady&&(financialActiveUserId||localStorage.getItem('fiexea_financial_owner_id'))||''}):null;
if(ReceiptStore)window.fiexeaReceiptStorage=ReceiptStore;
function saveError(error){return /quota|exceeded/i.test(error?.name+' '+error?.message)?'El almacenamiento del navegador está lleno. Conéctate a Internet y vuelve a guardar para trasladar los recibos a tu cuenta. No borres los datos de FIEXEA.':error.message;}
async function compactExistingReceipts(owner){
 if(!ReceiptStore)return;
 const keys=[KEY,'fiexea_moves','fiexea_financial_cache_v1_'+encodeURIComponent(owner)];
 for(const key of keys){const raw=localStorage.getItem(key);if(!raw||!raw.includes('data:'))continue;
  const compact=await ReceiptStore.compact(JSON.parse(raw),owner),next=JSON.stringify(compact);
  if((financialActiveUserId||localStorage.getItem('fiexea_financial_owner_id'))!==owner)throw new Error('La cuenta ha cambiado. Abre el gasto de nuevo.');
  if(localStorage.getItem(key)!==raw)throw new Error('Los datos han cambiado mientras se guardaba el recibo. Vuelve a pulsar Guardar.');
  if(next!==raw){localStorage.setItem(key,next);if(key==='fiexea_moves')moves=compact;queueFinancialSync();}
 }
}
let view='upcoming',year=new Date().getFullYear(),editId='',payment=null,returnFocus=null,sessionOwner=null;
const $=id=>document.getElementById(id),e=value=>esc(value),today=()=>localMoveDate();
function read(){const raw=localStorage.getItem(KEY);if(!raw)return[];const value=JSON.parse(raw);if(!Array.isArray(value))throw new Error('El calendario guardado tiene un formato no compatible.');return value}
function write(plans){localStorage.setItem(KEY,JSON.stringify(plans));queueFinancialSync()}
function amount(value){return eur(Number(value)||0)}
function date(value){return M.validDate(value)?new Date(value+'T12:00:00').toLocaleDateString(window.fiexeaLocale||'es-ES',{day:'numeric',month:'short',year:'numeric'}):'Sin fecha'}
function filename(name){return String(name||'recibo').replace(/[\\/:*?"<>|]/g,'-')}
function download(blob,name){const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download=filename(name);document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
function allRows(plans){return M.calendarRows(plans,moves,year)}
function planReceipt(plan,move,due){
 if(!plan?.receipt)return null;
 const receiptDate=plan.receiptDate||plan.date;
 if(receiptDate===(move?.scheduledOriginalDate||move?.scheduledDate||due))return plan.receipt;
 // A one-off expense can have an edited date while its paid movement retains the original date.
 if(move&&plan.repeat==='once'&&String(move.scheduledExpenseId)===String(plan.id)&&M.paidMoves(moves).filter(m=>String(m.scheduledExpenseId)===String(plan.id)).length===1)return plan.receipt;
 return null;
}
function filteredTax(){const plans=read();return M.taxRows(moves,year,$('calendarProperty').value,$('calendarCategory').value,$('calendarOnlyReview').checked).map(m=>m.receipt?m:{...m,receipt:planReceipt(plans.find(p=>String(p.id)===String(m.scheduledExpenseId)),m)})}
function upcoming(plans){
 const now=today(),current=Number(now.slice(0,4)),rows=[];
 const first=Math.min(current,...plans.filter(p=>M.validDate(p.date)).map(p=>Number(p.date.slice(0,4))));
 for(let y=first;y<=current+1;y++){
  if(!plans.some(p=>Number(p.date?.slice(0,4))<=y))continue;
  rows.push(...M.calendarRows(plans,moves,y).filter(r=>!r.move));
 }
 return rows.sort((a,b)=>a.due.localeCompare(b.due));
}
function optionList(values,current,empty){return '<option value="">'+e(empty)+'</option>'+values.map(x=>'<option value="'+e(x)+'"'+(x===current?' selected':'')+'>'+e(x)+'</option>').join('')}
function refreshFilters(){
 const list=M.paidMoves(moves),property=$('calendarProperty').value,category=$('calendarCategory').value;
 $('calendarProperty').innerHTML=optionList([...new Set(list.map(x=>x.property).filter(Boolean))].sort(),property,'Todas las viviendas');
 $('calendarCategory').innerHTML=optionList([...new Set(list.map(x=>x.cat).filter(Boolean))].sort(),category,'Todas las categorías');
}
function rowMarkup(row){
 const m=row.move,p=row.plan||(m?read().find(x=>String(x.id)===String(m.scheduledExpenseId)):null),id=m?.scheduledExpenseId||p.id,receipt=m?.receipt||planReceipt(p,m,row.due);
 return '<article class="calendar-item"><div class="calendar-row"><div><strong>'+e(m?.desc||p?.name||'Gasto')+'</strong><small>'+e(date(m?.date||row.due))+'</small><small>'+e(m?.cat||p?.category||'Otros')+((m?.property||p?.property)?' · '+e(m?.property||p?.property):'')+'</small></div><strong class="money">'+e(amount(row.amount))+'</strong></div><span class="calendar-badge '+(m?'paid':'')+'">'+(m?'Pagado':row.due<today()?'Pendiente · fecha pasada':'Pendiente')+'</span><div class="calendar-actions">'+(!m?'<button class="calendar-pay" type="button" data-calendar-action="pay" data-id="'+e(id)+'" data-date="'+e(row.due)+'">Confirmar pago</button>':'<button type="button" data-calendar-action="payment" data-id="'+e(m.id)+'">Editar pago</button>')+(p?'<button type="button" data-calendar-action="edit" data-id="'+e(p.id)+'">Editar gasto</button>':'')+(p&&m?'<button type="button" data-calendar-action="group" data-id="'+e(p.id)+'">Agrupar gasto</button>':'')+(receipt?'<button type="button" data-calendar-action="receipt" data-id="'+e(m?.id||p.id)+'" data-date="'+e(row.due)+'">📎 Recibo</button>':'')+'</div></article>';
}
function taxGroupsMarkup(list,plans){
 return M.taxGroups(list,plans).map(g=>g.entries.length===1?taxMarkup(g.entries[0]):'<details class="calendar-card"><summary><strong>'+e(g.name)+'</strong> · '+e(amount(g.total))+'<small class="calendar-help"> · '+g.entries.length+' pagos · '+g.entries.filter(m=>m.receipt).length+' justificantes</small></summary>'+g.entries.map(taxMarkup).join('')+'</details>').join('');
}
function taxMarkup(m){return rowMarkup({move:m,due:m.scheduledDate,amount:m.amount})+(m.taxReview?'<small class="calendar-help">Marcado para revisar en la renta</small>':'')}
function renderCalendar(){
 if(!$('t11'))return;
 const currentOwner=financialActiveUserId||localStorage.getItem('fiexea_financial_owner_id')||'';
 if(sessionOwner!==currentOwner){closeDialogs();sessionOwner=currentOwner}
 const plans=read(),rows=allRows(plans),pending=rows.filter(r=>!r.move),paid=rows.filter(r=>r.move);
 $('calendarYear').textContent=year;
 $('calendarSummary').classList.toggle('calendar-annual-summary',view==='annual');
 $('calendarPrevYear').disabled=year<=1900;
 $('calendarNextYear').disabled=year>=2199;
 document.querySelectorAll('[data-calendar-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.calendarView===view)));
 $('calendarTaxFilters').hidden=view!=='tax';
 $('calendarYearLabel').hidden=view==='upcoming';
 $('calendarExport').hidden=view!=='tax';
 $('calendarReceiptExport').hidden=view!=='tax';
 refreshFilters();
 $('calendarSummary').innerHTML='<h3 class="calendar-summary-title">Resumen del año</h3><div><small>Previsto en '+year+'</small><strong class="money">'+e(amount(rows.reduce((s,r)=>s+r.amount,0)))+'</strong></div><div><small>Pendiente en '+year+'</small><strong class="money">'+e(amount(pending.reduce((s,r)=>s+r.amount,0)))+'</strong></div>';
 if(view==='upcoming'){
  const next=upcoming(plans);
  $('calendarSummary').hidden=true;
  $('calendarContent').innerHTML='<div class="calendar-card"><h3>Próximos cobros</h3><p class="calendar-help">Pendientes anteriores y pagos previstos hasta el final del próximo año.</p>'+ (next.length?next.map(rowMarkup).join(''):'<p class="calendar-empty">No tienes cobros pendientes.<br>Añade tu primer gasto con fecha.</p>')+'</div>';
 }else if(view==='annual'){
  $('calendarSummary').hidden=false;
  $('calendarContent').innerHTML='<h3 class="calendar-months-title">Gastos por mes</h3><div class="calendar-months">'+Array.from({length:12},(_,i)=>{
   const key=year+'-'+String(i+1).padStart(2,'0'),list=rows.filter(r=>r.due.startsWith(key)),total=list.reduce((s,r)=>s+r.amount,0),name=new Date(year,i,1).toLocaleDateString(window.fiexeaLocale||'es-ES',{month:'long'});
   return '<details><summary>'+e(name)+'<small>'+list.length+' cobros · '+list.filter(r=>!r.move).length+' pendientes</small><strong class="money">'+e(amount(total))+'</strong></summary>'+(list.length?list.map(rowMarkup).join(''):'<p class="calendar-empty">Sin gastos previstos</p>')+'</details>';
  }).join('')+'</div>';
 }else{
  const list=filteredTax();$('calendarSummary').hidden=false;
  $('calendarSummary').innerHTML='<div><small>Pagado en '+year+'</small><strong class="money">'+e(amount(list.reduce((s,m)=>s+Number(m.amount),0)))+'</strong></div><div><small>Justificantes adjuntos</small><strong>'+list.filter(m=>m.receipt).length+' / '+list.length+'</strong></div>';
  $('calendarContent').innerHTML='<div class="calendar-card"><h3>Gastos pagados de '+year+'</h3><p class="calendar-help">Se usa la fecha real de pago. Marcar un gasto para la renta no confirma que sea deducible.</p>'+(list.length?taxGroupsMarkup(list,plans):'<p class="calendar-empty">No hay pagos del calendario con estos filtros.</p>')+'</div>';
 }
 const next=upcoming(plans).slice(0,3);
 $('calendarHomeList').innerHTML=next.length?next.map(r=>'<div class="calendar-item calendar-row"><div><strong>'+e(r.plan.name)+'</strong><small>'+e(date(r.due))+(r.due<today()?' · Pendiente':'')+'</small></div><b class="money">'+e(amount(r.amount))+'</b></div>').join(''):'<p class="calendar-help">Organiza seguros, impuestos y otros gastos por su fecha de cobro.</p>';
}
function openCalendar(){year=new Date().getFullYear();tab(11);renderCalendar()}
function closeDialogs(){for(const id of ['calendarEditor','calendarPayment'])if($(id)?.open)$(id).close();payment=null;editId=''}
function showDialog(id){returnFocus=document.activeElement;$(id).showModal()}
function categoryChoices(){
 const catalog=typeof categoryOptionsForType==='function'?categoryOptionsForType('expense'):[];
 const seen=new Set();
 return catalog.map(c=>String(c.name||'').trim()).filter(name=>{const key=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');if(!name||seen.has(key))return false;seen.add(key);return true}).sort((a,b)=>a.localeCompare(b,'es'));
}
function fillCategorySelect(current){
 const choices=categoryChoices();
 $('calCategory').innerHTML='<option value="">'+(choices.length?'Selecciona una categoría':'Crea una categoría en Movimientos')+'</option>'+choices.map(name=>'<option value="'+e(name)+'">'+e(typeof displayCategoryName==='function'?displayCategoryName(name):name)+'</option>').join('');
 const matched=choices.find(name=>name.localeCompare(current,'es',{sensitivity:'base'})===0);$('calCategory').value=matched||'';
}
function selectedCategory(){return $('calCategory').value.trim()}
function fillGroupSelect(p){
 const plans=read(),seen=new Set();
 $('calGroup').innerHTML='<option value="">Sin agrupar</option>'+plans.filter(x=>String(x.id)!==String(p?.id)).filter(x=>{const key=x.taxGroupId||String(x.id);if(seen.has(key))return false;seen.add(key);return true}).map(x=>'<option value="'+e(x.id)+'">'+e((x.taxGroupName||x.name)+(x.property?' · '+x.property:''))+'</option>').join('');
 const target=plans.find(x=>String(x.id)!==String(p?.id)&&p?.taxGroupId&&x.taxGroupId===p.taxGroupId);
 if(target)$('calGroup').value=target.id;
 // A remaining single-member group is still retained when editing.
 $('calGroup').dataset.retainedGroup=target?'':p?.taxGroupId||'';
 $('calGroup').dataset.retainedName=target?'':p?.taxGroupName||'';
}
function updateInstallments(){
 const enabled=!editId&&$('calSplit').checked,count=Math.max(2,Math.min(24,Number($('calSplitCount').value)||2));
 $('calSplitFields').hidden=!enabled;$('calGroupLabel').hidden=enabled;$('calGroup').disabled=enabled;
 $('calRepeat').disabled=enabled;$('calAlreadyPaidLabel').hidden=!!editId||enabled;
 $('calReceiptLabelText').textContent=enabled?'Recibo del pago 1 (opcional)':'Recibo o factura (opcional)';
 if(enabled){$('calRepeat').value='once';$('calAlreadyPaid').checked=false}
 const container=$('calSplitRows');
 container.querySelectorAll('input').forEach(input=>input.disabled=!enabled);
 if(!enabled)return;
 while(container.children.length>count-1)container.lastElementChild.remove();
 while(container.children.length<count-1){const number=container.children.length+2,row=document.createElement('div');row.dataset.installment=String(number);row.className='calendar-card';
 row.innerHTML='<h3>Pago '+number+'</h3><label>Fecha del pago '+number+'<input type="date" min="1900-01-01" max="2199-12-31" required></label><label>Importe del pago '+number+'<input type="number" inputmode="decimal" min="0.01" max="999999999" step="0.01" required></label><label>Recibo del pago '+number+' (opcional)<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"><small class="calendar-help">Imagen o PDF, máximo 500 KB. Este recibo corresponde solo a este pago.</small></label>';
 row.querySelector('[type=number]').value=$('calAmount').value;container.appendChild(row)}
}
function openEditor(id=''){
 const p=read().find(x=>String(x.id)===String(id));editId=p?.id||'';
 $('calendarForm').reset();$('calendarEditorTitle').textContent=p?'Editar gasto previsto':'Añadir gasto con fecha';
 $('calName').value=p?.name||'';$('calAmount').value=p?.amount||'';$('calDate').value=p?.date||today();$('calRepeat').value=p?.repeat||'once';$('calEnd').value=p?.end||'';fillCategorySelect(p?.category||'Otros');$('calProperty').value=p?.property||'';$('calTax').checked=!!p?.taxReview;
 $('calendarPlanReceiptNote').textContent=p?.receipt?'Adjunto: '+p.receipt.name+'. Puedes reemplazarlo.':'Imagen o PDF, máximo 500 KB. Se guarda también si está pendiente.';
 $('calAlreadyPaid').checked=false;$('calAlreadyPaidLabel').hidden=!!p;
 $('calSplitLabel').hidden=!!p;$('calSplitRows').innerHTML='';fillGroupSelect(p);updateInstallments();
 $('calendarDelete').hidden=!p;showDialog('calendarEditor');
}
async function savePlan(event){
 event.preventDefault();
 if(!financialAppReady){alert('Espera a que se cargue tu cuenta.');return}
 const owner=financialActiveUserId||localStorage.getItem('fiexea_financial_owner_id')||'',editorId=editId,button=$('calendarPlanSubmit');if(button.disabled)return;
 const name=$('calName').value.trim(),value=Number($('calAmount').value),start=$('calDate').value,end=$('calEnd').value;
 if(!selectedCategory()){alert('Selecciona una categoría de Movimientos. Si no tienes ninguna, créala allí primero.');return}
 if(!name||!Number.isFinite(value)||value<=0||!M.validDate(start)||(end&&(!M.validDate(end)||end<start))){alert('Revisa el concepto, el importe y las fechas.');return}
 button.disabled=true;
 try{
  const split=!editorId&&$('calSplit').checked;
  const installmentDrafts=split?[...$('calSplitRows').querySelectorAll('[data-installment]')].map(row=>({date:row.querySelector('[type=date]').value,amount:Number(row.querySelector('[type=number]').value),file:row.querySelector('[type=file]').files[0]})):[];
  const receipt=await readReceipt($('calReceipt').files[0]);
  const installmentReceipts=await Promise.all(installmentDrafts.map(row=>readReceipt(row.file)));
  await compactExistingReceipts(owner);
  if(!financialAppReady||editId!==editorId||!$('calendarEditor').open||(financialActiveUserId||localStorage.getItem('fiexea_financial_owner_id')||'')!==owner)throw new Error('La cuenta o el formulario han cambiado. Abre el gasto de nuevo.');
  const plans=read(),index=plans.findIndex(x=>String(x.id)===String(editId)),p={id:editId||uid(),name,amount:Math.round(value*100)/100,date:start,end,repeat:$('calRepeat').value,category:selectedCategory()||'Otros',property:$('calProperty').value.trim(),taxReview:$('calTax').checked};
  const previousPlan=plans[index];if(receipt){p.receipt=receipt;p.receiptDate=start}else if(previousPlan?.receipt){p.receipt=previousPlan.receipt;p.receiptDate=previousPlan.receiptDate||previousPlan.date}
  const target=!split&&plans.find(x=>String(x.id)===String($('calGroup').value));
  if(target){const groupId=target.taxGroupId||uid(),groupName=target.taxGroupName||target.name.replace(/\s+\d+\/\d+$/,'');target.taxGroupId=groupId;target.taxGroupName=groupName;p.taxGroupId=groupId;p.taxGroupName=groupName}
  else if(!split&&$('calGroup').dataset.retainedGroup){p.taxGroupId=$('calGroup').dataset.retainedGroup;p.taxGroupName=$('calGroup').dataset.retainedName}
  let newPlans=[p];
  if(split){
   const installments=[{date:start,amount:value,receipt},...installmentDrafts.map((row,i)=>({date:row.date,amount:row.amount,receipt:installmentReceipts[i]}))];
   newPlans=M.installmentPlans(p,installments,uid());
  }
  if(index>=0)plans[index]=p;else plans.push(...newPlans);
  const alreadyPaid=!editId&&$('calAlreadyPaid').checked;
  if(alreadyPaid&&start>today())throw new Error('Un pago realizado debe tener una fecha de hoy o anterior.');
  const before=moves,previous=localStorage.getItem(KEY);
  const recategorized=moves.map(m=>{const plan=plans.find(x=>String(x.id)===String(m.scheduledExpenseId));if(!plan)return m;const next={...m,taxGroupId:plan.taxGroupId||'',taxGroupName:plan.taxGroupName||''};if(String(plan.id)===String(p.id)){next.cat=p.category;const attached=planReceipt(p,m);if(attached&&(receipt||!m.receipt))next.receipt=attached;}return JSON.stringify(next)===JSON.stringify(m)?m:next}),categoryUpdated=recategorized.some((m,i)=>m!==moves[i]);
  try{
   if(categoryUpdated){localStorage.setItem('fiexea_moves',JSON.stringify(recategorized));moves=recategorized}
   if(alreadyPaid){const draft={id:uid(),type:'expense',desc:name,cat:p.category,amount:p.amount,date:start,scheduledExpenseId:p.id,scheduledDate:start,property:p.property,taxReview:p.taxReview,taxGroupId:p.taxGroupId||'',taxGroupName:p.taxGroupName||'',...(p.receiptDate===start&&p.receipt?{receipt:p.receipt}:{})};localStorage.setItem('fiexea_moves',JSON.stringify([...moves,draft]));moves=[...moves,draft]}
   write(plans);if(alreadyPaid||categoryUpdated)save();
  }catch(error){moves=before;localStorage.setItem('fiexea_moves',JSON.stringify(before));if(previous===null)localStorage.removeItem(KEY);else localStorage.setItem(KEY,previous);throw error}
  year=Number(start.slice(0,4));view='annual';$('calendarEditor').close();render();renderCalendar();showSaveToast(alreadyPaid?'Pago guardado.':'Gasto previsto guardado.');
 }catch(error){alert('No se pudo guardar el gasto: '+saveError(error))}finally{button.disabled=false}
}
function openPayment(id,due,moveId=''){
 const m=moveId?moves.find(x=>String(x.id)===String(moveId)):null,p=read().find(x=>String(x.id)===String(id||m?.scheduledExpenseId));
 if(!m&&!p)return;
 if(!m&&M.paidMoves(moves).some(x=>String(x.scheduledExpenseId)===String(id)&&(x.scheduledOriginalDate||x.scheduledDate)===due)){renderCalendar();return}
 payment={id:p?.id||m.scheduledExpenseId,due:m?.scheduledDate||due,moveId:m?.id||'',owner:sessionOwner};
 $('calendarPayForm').reset();$('calendarPayTitle').textContent=m?'Editar pago':'Confirmar pago';$('calendarPayConcept').textContent=m?.desc||p.name;
 $('calPayName').value=m?.desc||p?.name||'';
 $('calPayDate').value=m?.date||today();$('calPayAmount').value=m?.amount??p.amount;$('calPayTax').checked=m?!!m.taxReview:!!p.taxReview;$('calPayProperty').value=m?.property??p?.property??'';
 $('calendarReceiptNote').textContent=(m?.receipt||planReceipt(p,m,due))?'Adjunto: '+(m?.receipt||p.receipt).name+'. Puedes reemplazarlo.':'Adjunta una imagen o PDF (máximo 500 KB).';
 $('calPayAccount').innerHTML='<option value="">Sin cuenta asignada</option>'+accounts.map(a=>'<option value="'+e(a.id)+'"'+(String(a.id)===String(m?.accountId)?' selected':'')+'>'+e(a.name||a.label||'Cuenta')+'</option>').join('');
 $('calendarExistingLabel').hidden=!!m;
 const candidates=moves.filter(x=>x.type==='expense'&&!x.scheduledExpenseId).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 $('calPayExisting').innerHTML='<option value="">Crear un nuevo movimiento</option>'+candidates.map(x=>'<option value="'+e(x.id)+'">'+e(date(x.date)+' · '+(x.desc||x.cat)+' · '+amount(x.amount))+'</option>').join('');
 showDialog('calendarPayment');
}
function readReceipt(file){return new Promise((resolve,reject)=>{
 if(!file){resolve(null);return}
 if(file.size>500*1024||!['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(file.type)){reject(new Error('Selecciona una imagen o PDF de hasta 500 KB.'));return}
 const r=new FileReader();r.onerror=()=>reject(new Error('No se pudo leer el justificante.'));r.onload=()=>{const receipt={name:filename(file.name),type:file.type,data:r.result};if(ReceiptStore)ReceiptStore.storeInline(receipt).then(resolve,reject);else resolve(receipt)};r.readAsDataURL(file);
})}
async function confirmPayment(event){
 event.preventDefault();if(!payment||!financialAppReady)return;
 const activePayment=payment,token={...payment},button=$('calendarPaySubmit');button.disabled=true;
 try{
  const receipt=await readReceipt($('calPayReceipt').files[0]);
  await compactExistingReceipts(token.owner);
  if(!payment||payment!==activePayment||payment.owner!==token.owner||sessionOwner!==token.owner||(financialActiveUserId||localStorage.getItem('fiexea_financial_owner_id')||'')!==token.owner)throw new Error('La cuenta ha cambiado. Abre el pago de nuevo.');
  const plans=read(),p=plans.find(x=>String(x.id)===String(token.id)),existingId=$('calPayExisting').value;
  let m=token.moveId?moves.find(x=>String(x.id)===String(token.moveId)):existingId?moves.find(x=>String(x.id)===String(existingId)):null;
  if((token.moveId||existingId)&&!m)throw new Error('El movimiento ya no existe.');
  if(!token.moveId&&M.paidMoves(moves).some(x=>String(x.scheduledExpenseId)===String(token.id)&&(x.scheduledOriginalDate||x.scheduledDate)===token.due))throw new Error('Este cobro ya está registrado.');
  if(!m&&!p)throw new Error('El gasto ya no existe.');
  if(existingId&&m?.scheduledExpenseId)throw new Error('El movimiento ya está vinculado a otro cobro.');
  const value=Number($('calPayAmount').value),paidDate=$('calPayDate').value,dueDate=paidDate,name=$('calPayName').value.trim()||m?.desc||p?.name||'Gasto';
  if(!M.validDate(dueDate))throw new Error('Revisa la fecha prevista.');
  if(M.paidMoves(moves).some(x=>String(x.id)!==String(m?.id)&&String(x.scheduledExpenseId)===String(token.id)&&(x.scheduledOriginalDate||x.scheduledDate)===dueDate))throw new Error('Ya hay un pago para esa fecha prevista.');
  if(!Number.isFinite(value)||value<=0||!M.validDate(paidDate))throw new Error('Revisa el importe y la fecha de pago.');
  if(paidDate>today())throw new Error('Para una fecha futura, conserva el gasto como pendiente.');
  const draft={...(m||{}),id:m?.id||uid(),type:'expense',amount:Math.round(value*100)/100,date:paidDate,cat:m?.cat||p?.category||'Otros',desc:name,scheduledExpenseId:token.id,scheduledOriginalDate:m?.scheduledOriginalDate||token.due,scheduledDate:dueDate,property:$('calPayProperty').value.trim(),taxReview:$('calPayTax').checked,taxGroupId:p?.taxGroupId||m?.taxGroupId||'',taxGroupName:p?.taxGroupName||m?.taxGroupName||''};
  const account=accounts.find(a=>String(a.id)===String($('calPayAccount').value));if(account)draft.accountId=account.id;else delete draft.accountId;if(receipt)draft.receipt=receipt;else if(!draft.receipt&&planReceipt(p,m,token.due))draft.receipt=planReceipt(p,m,token.due);
  const before=moves,next=moves.map(x=>x===m?draft:x);if(!m)next.push(draft);
  /* Persist before replacing in-memory state, so a full browser storage cannot create a false paid state. */
  const serialized=JSON.stringify(next);if(!ReceiptStore&&receipt&&serialized.length>2500000)throw new Error('No queda espacio para más justificantes. Guarda el pago sin adjunto o utiliza un archivo menor.');
  localStorage.setItem('fiexea_moves',serialized);moves=next;
  try{save()}catch(error){moves=before;localStorage.setItem('fiexea_moves',JSON.stringify(before));throw error}
  $('calendarPayment').close();payment=null;year=Number(dueDate.slice(0,4));render();showSaveToast('Pago guardado en Movimientos.');
 }catch(error){alert(saveError(error)||'No se pudo guardar el pago.')}finally{button.disabled=false}
}
async function receiptBlob(receipt){if(ReceiptStore)return ReceiptStore.download(receipt);if(!receipt||!/^data:(application\/pdf|image\/(jpeg|png|webp|heic|heif));base64,/.test(receipt.data||''))throw new Error('El justificante no tiene un formato compatible.');const raw=atob(receipt.data.split(',')[1]),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));return new Blob([bytes],{type:receipt.type})}
function exportCSV(){
 const list=filteredTax();if(!list.length){alert('No hay pagos para exportar con estos filtros.');return}
 const plans=read(),rows=[['Agrupación','Concepto','Categoría','Vivienda','Fecha prevista','Fecha real de pago','Importe','Revisar para renta','Justificante'],...list.map(m=>[plans.find(p=>String(p.id)===String(m.scheduledExpenseId))?.taxGroupName||m.taxGroupName||m.desc,m.desc,m.cat,m.property,m.scheduledDate,m.date,Number(m.amount).toFixed(2).replace('.',','),m.taxReview?'Sí':'No',m.receipt?.name||''])];
 download(new Blob(['\uFEFF'+rows.map(r=>r.map(M.csvCell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}),'FIEXEA-renta-'+year+'.csv');
}
async function shareReceipts(){
 const list=filteredTax().filter(m=>m.receipt);if(!list.length){alert('No hay justificantes adjuntos con estos filtros.');return}
 const files=await Promise.all(list.map(async(m,i)=>new File([await receiptBlob(m.receipt)],m.date+'-'+(i+1)+'-'+filename(m.receipt.name),{type:m.receipt.type})));
 if(navigator.canShare?.({files})){try{await navigator.share({files,title:'Justificantes FIEXEA '+year})}catch(error){if(error.name!=='AbortError')alert('No se pudieron compartir los justificantes.')}return}
 if(files.length===1){download(files[0],files[0].name);return}
 alert('Tu navegador no permite compartir varios archivos. Abre cada botón «Recibo» para descargarlos.');
}
function start(){
 document.querySelector('main').insertAdjacentHTML('beforeend',page);
 $('t0').insertAdjacentHTML('beforeend','<section class="calendar-card calendar-home"><div class="calendar-row"><h3>📅 Próximos cobros</h3><button type="button" id="calendarHomeOpen">Ver todos →</button></div><div id="calendarHomeList" data-calendar-home-list></div></section>');
 const group=document.querySelector('#navMoreMenu .more-menu-group:nth-child(3)');
 group?.insertAdjacentHTML('beforeend','<button type="button" id="calendarMenuOpen"><span class="menu-icon" aria-hidden="true">📅</span>Calendario de gastos</button>');
 document.body.insertAdjacentHTML('beforeend',dialogs);
 $('calendarHomeOpen').onclick=$('calendarMenuOpen').onclick=openCalendar;
 $('calendarAdd').onclick=()=>openEditor();
 $('calSplit').onchange=updateInstallments;$('calSplitCount').onchange=updateInstallments;$('calGroup').onchange=()=>{$('calGroup').dataset.retainedGroup='';$('calGroup').dataset.retainedName=''};
 $('calendarForm').onsubmit=savePlan;$('calendarPayForm').onsubmit=confirmPayment;
 $('calendarPrevYear').onclick=()=>{if(year>1900){year--;renderCalendar()}};
 $('calendarNextYear').onclick=()=>{if(year<2199){year++;renderCalendar()}};
 document.querySelectorAll('[data-calendar-view]').forEach(b=>b.onclick=()=>{view=b.dataset.calendarView;renderCalendar()});
 ['calendarProperty','calendarCategory','calendarOnlyReview'].forEach(id=>$(id).onchange=renderCalendar);
 $('calendarExport').onclick=exportCSV;$('calendarReceiptExport').onclick=()=>shareReceipts().catch(error=>alert(error.message));
 $('calendarDelete').onclick=()=>{if(!confirm('¿Eliminar este gasto y sus cobros pendientes? Los pagos ya registrados se conservarán en Movimientos y en la vista para la renta.'))return;try{write(read().filter(x=>String(x.id)!==String(editId)));$('calendarEditor').close();renderCalendar()}catch(error){alert(error.message)}};
 $('calPayExisting').onchange=()=>{const m=moves.find(x=>String(x.id)===String($('calPayExisting').value));if(m){$('calPayDate').value=m.date;$('calPayAmount').value=m.amount;$('calPayAccount').value=m.accountId||''}};
 for(const id of ['calendarEditor','calendarPayment']){$(id).addEventListener('close',()=>{if(id==='calendarPayment')payment=null;if(returnFocus?.isConnected)returnFocus.focus()});$(id).querySelectorAll('[data-calendar-close]').forEach(b=>b.onclick=()=>$(id).close())}
 $('calendarContent').onclick=async event=>{
  const b=event.target.closest('[data-calendar-action]');if(!b)return;
  const id=b.dataset.id,action=b.dataset.calendarAction;
  if(action==='group'){openEditor(id);$('calGroup').scrollIntoView({block:'center'});$('calGroup').focus()}
  if(action==='edit')openEditor(id);if(action==='pay')openPayment(id,b.dataset.date);if(action==='payment')openPayment('','',id);
  if(action==='receipt'){const m=moves.find(x=>String(x.id)===String(id)),p=read().find(x=>String(x.id)===String(m?.scheduledExpenseId||id)),receipt=m?.receipt||planReceipt(p,m,b.dataset.date);try{b.disabled=true;const blob=await receiptBlob(receipt);download(blob,receipt.name)}catch(error){alert(error.message)}finally{b.disabled=false}}
 };
 window.fiexeaRenderCalendar=renderCalendar;window.openExpenseCalendar=openCalendar;
 renderCalendar();
 if(location.hash==='#t11')tab(11);
}
const page='<section id="t11" class="tab calendar-page"><div class="section"><h2>Calendario de gastos</h2><p class="calendar-lead">Tus seguros, impuestos y recibos, en la fecha en que toca pagarlos.</p><button id="calendarAdd" type="button" class="btn" style="width:100%">＋ Añadir gasto con fecha</button><div class="calendar-tabs" role="group" aria-label="Vista del calendario"><button type="button" data-calendar-view="upcoming" aria-pressed="true">Próximos cobros</button><button type="button" data-calendar-view="annual" aria-pressed="false">Todo el año</button><button type="button" data-calendar-view="tax" aria-pressed="false">Para la renta</button></div><div class="calendar-toolbar"><div id="calendarYearLabel" class="calendar-year-control" hidden><span id="calendarYearTitle">Año</span><div class="calendar-year-picker" role="group" aria-labelledby="calendarYearTitle"><button id="calendarPrevYear" type="button" aria-label="Año anterior">‹</button><output id="calendarYear" aria-live="polite" aria-atomic="true"></output><button id="calendarNextYear" type="button" aria-label="Año siguiente">›</button></div></div><button id="calendarExport" type="button" class="btn secondary" hidden>Exportar CSV</button><button id="calendarReceiptExport" type="button" class="btn secondary" hidden>Compartir justificantes</button></div><div id="calendarTaxFilters" class="calendar-card" hidden><div class="calendar-filters"><label>Vivienda<select id="calendarProperty"></select></label><label>Categoría<select id="calendarCategory"></select></label></div><p><label><input id="calendarOnlyReview" type="checkbox" checked>Solo marcados para revisar en la renta</label></p></div><div id="calendarSummary" class="calendar-summary"></div><div id="calendarContent" aria-live="polite"></div><details class="calendar-card calendar-help"><summary>Cómo funciona</summary><p>Añade el concepto, el importe previsto y la fecha exacta. Si se repite cada mes, trimestre o año, FIEXEA mostrará los siguientes cobros. En meses más cortos, el cobro pasa al último día disponible.</p><p>Puedes adjuntar el recibo al añadir o editar el gasto, aunque esté pendiente. En gastos repetidos, el recibo corresponde solo a la fecha indicada. Un gasto pendiente no descuenta dinero. Al confirmar el pago puedes corregir su importe y fecha, elegir cuenta y adjuntar un recibo. Si ya lo apuntaste, elige ese movimiento para evitar duplicarlo.</p><p>En «Todo el año» cada mes se despliega con sus cobros. «Para la renta» reúne los pagos del calendario por la fecha real de pago, incluso si se pagaron en un año distinto al previsto. Puedes filtrar por vivienda y categoría, exportar CSV y compartir justificantes.</p><p>En «Editar pago» puedes cambiar el concepto, importe y fecha del pago, también de meses pasados. Editar un gasto cambia sus cobros pendientes y actualiza la categoría de sus pagos registrados; los pagos conservan sus importes, fechas y recibos. Si eliminas un movimiento pagado, su cobro volverá a estar pendiente mientras exista el gasto previsto. Para dejar de generar nuevos cobros, indica una última fecha.</p><p>Para un recibo en varios plazos, marca «Pago fraccionado», indica el número de pagos y la fecha, importe y recibo de cada uno. Los plazos se agrupan automáticamente para la renta. El importe inicial corresponde al primer plazo; los demás pueden tener importes diferentes. Para unir gastos ya creados, abre «Editar gasto» y elige «Agrupar con otro gasto para la renta». En «Para la renta» verás el total pagado del grupo en ese año y vivienda; abre el desplegable para consultar cada pago y recibo. El CSV conserva los pagos individuales e incluye su agrupación. Elige «Sin agrupar» para separar un gasto.</p><p>Los gastos del calendario se guardan con tus datos y copias de seguridad. Marcar «Revisar para la renta» sirve para organizar documentos; no determina su deducibilidad.</p></details></div></section>';
const dialogs='<dialog id="calendarEditor" class="calendar-dialog" aria-labelledby="calendarEditorTitle"><header><h2 id="calendarEditorTitle">Añadir gasto con fecha</h2><button type="button" data-calendar-close aria-label="Cerrar">×</button></header><form id="calendarForm"><label>¿Qué gasto es?<input id="calName" maxlength="140" required placeholder="Ej.: Seguro del coche" autofocus></label><label>Importe previsto<input id="calAmount" type="number" inputmode="decimal" min="0.01" max="999999999" step="0.01" required placeholder="299,00"></label><label>Fecha del pago<input id="calDate" type="date" min="1900-01-01" max="2199-12-31" required></label><label id="calAlreadyPaidLabel"><input id="calAlreadyPaid" type="checkbox">Ya está pagado en esta fecha</label><label id="calSplitLabel"><input id="calSplit" type="checkbox">Pago fraccionado</label><label><span id="calReceiptLabelText">Recibo o factura (opcional)</span><input id="calReceipt" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"><small id="calendarPlanReceiptNote" class="calendar-help"></small></label><div id="calSplitFields" hidden><p class="calendar-help">El importe, la fecha y el recibo de arriba corresponden al pago 1. Añade los datos y el recibo de cada pago. Se agrupan automáticamente para la renta; cada uno conserva su fecha y justificante.</p><label>Número de pagos<select id="calSplitCount"><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="7">7</option><option value="8">8</option><option value="9">9</option><option value="10">10</option><option value="11">11</option><option value="12">12</option><option value="13">13</option><option value="14">14</option><option value="15">15</option><option value="16">16</option><option value="17">17</option><option value="18">18</option><option value="19">19</option><option value="20">20</option><option value="21">21</option><option value="22">22</option><option value="23">23</option><option value="24">24</option></select></label><div id="calSplitRows"></div></div><label id="calGroupLabel">Agrupar con otro gasto para la renta<select id="calGroup"></select><small class="calendar-help">Los pagos se sumarán en un desplegable por vivienda y año. No se duplican ni cambian sus fechas o recibos.</small></label><label>Se repite<select id="calRepeat"><option value="once">Solo una vez</option><option value="monthly">Cada mes</option><option value="quarterly">Cada tres meses</option><option value="yearly">Cada año</option></select></label><details><summary>Más opciones</summary><p><label>Categoría<select id="calCategory"></select></label></p><p><label>Vivienda asociada (opcional)<input id="calProperty" maxlength="140" placeholder="Ej.: Piso de Alberic"></label></p><p><label>Último cobro (opcional)<input id="calEnd" type="date" min="1900-01-01" max="2199-12-31"></label></p><p><label><input id="calTax" type="checkbox">Revisar para la renta</label></p></details><p class="calendar-help">Puedes elegir cualquier mes o año anterior. Marca «Ya está pagado» para guardarlo directamente como pago.</p><div class="calendar-actions"><button id="calendarDelete" type="button" hidden>Eliminar gasto</button><button type="button" data-calendar-close>Cancelar</button><button id="calendarPlanSubmit" type="submit" class="calendar-pay">Guardar gasto</button></div></form></dialog><dialog id="calendarPayment" class="calendar-dialog" aria-labelledby="calendarPayTitle"><header><h2 id="calendarPayTitle">Confirmar pago</h2><button type="button" data-calendar-close aria-label="Cerrar">×</button></header><p id="calendarPayConcept"></p><form id="calendarPayForm"><label id="calendarExistingLabel">¿Ya está en Movimientos?<select id="calPayExisting"></select></label><label>Concepto<input id="calPayName" maxlength="140" required></label><label>Importe pagado<input id="calPayAmount" type="number" inputmode="decimal" min="0.01" step="0.01" required></label><label>Fecha del pago<input id="calPayDate" type="date" min="1900-01-01" max="2199-12-31" required></label><label>Cuenta<select id="calPayAccount"></select></label><label>Vivienda asociada<input id="calPayProperty" maxlength="140" placeholder="Opcional"></label><label><input id="calPayTax" type="checkbox">Revisar para la renta</label><label>Recibo o factura<input id="calPayReceipt" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"><small id="calendarReceiptNote" class="calendar-help"></small></label><div class="calendar-actions"><button type="button" data-calendar-close>Cancelar</button><button id="calendarPaySubmit" type="submit" class="calendar-pay">Guardar pago</button></div></form></dialog>';
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();



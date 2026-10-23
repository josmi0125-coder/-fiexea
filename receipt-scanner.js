/* On-device OCR. Images stay in the browser until the user saves a receipt. */
(()=>{
'use strict';
const M=window.FiexeaReceiptScanMath,$=id=>document.getElementById(id);if(!M)return;
let token=0,worker=null,loading=null,draft=null,busy=false,returnFocus=null,calendarContext=null;
const owner=()=>{let trial='';try{const record=JSON.parse(localStorage.getItem('fiexea_guest_trial_v1')||'null');trial=String(record?.started||'')}catch(_){}return String(typeof financialActiveUserId!=='undefined'&&financialActiveUserId||localStorage.getItem('fiexea_financial_owner_id')||'')+'|'+String(localStorage.getItem('fiexea_guest_active')||'')+'|'+trial};
function allowed(){return typeof financialAppReady!=='undefined'&&financialAppReady&&document.documentElement.dataset.fiexeaAccess==='allowed'}
function assertDraft(d){if(!d||draft!==d||owner()!==d.owner||!allowed()||!$('receiptScanner').open)throw new Error('El acceso o la cuenta han cambiado. Abre el escáner de nuevo.')}
function status(s){$('receiptScanStatus').textContent=s; $('receiptScanStatus').hidden=false}
function stop(){token++;if(worker){worker.terminate().catch(()=>{});worker=null}busy=false;if($('receiptScanForm'))$('receiptScanFields').disabled=false}
function close(){if($('receiptScanSave')?.disabled)return;stop();draft=null;$('receiptScanPreview').removeAttribute('src');$('receiptScanner').close();returnFocus?.focus?.({preventScroll:true})}
function open(context=null){if(!allowed()){throw new Error('El escáner no está disponible con el estado de acceso actual. Recarga la aplicación.')}stop();draft=null;calendarContext=context;returnFocus=document.activeElement;$('receiptScanForm').reset();$('receiptScanForm').hidden=true;$('receiptScanExisting').closest('label').hidden=false;$('receiptScanNewFields').hidden=false;$('receiptScanSave').textContent='Guardar gasto';$('receiptScanPreview').hidden=true;$('receiptScanPreview').removeAttribute('src');$('receiptScanWarning').hidden=true;status('Haz una foto nítida del recibo completo, con buena luz.');$('receiptScanner').showModal()}
function loadEngine(){if(window.Tesseract)return Promise.resolve(window.Tesseract);if(!loading)loading=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js';s.crossOrigin='anonymous';s.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(new Error('No se pudo cargar el lector.'));s.onerror=()=>{s.remove();loading=null;reject(new Error('No se pudo descargar el lector. Comprueba la conexión y vuelve a intentarlo.'))};document.head.appendChild(s)});return loading}
async function preparePdf(file){
 const pdfjs=window.pdfjsLib;
 if(!pdfjs)throw new Error('El lector PDF no está disponible. Comprueba tu conexión.');
 const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
 try{
  const page=await pdf.getPage(1);
  const content=await page.getTextContent();
  const extracted=content.items.map(item=>item.str||'').join(' ');
  const viewport=page.getViewport({scale:1.6});
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
  await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
  const data=canvas.toDataURL('image/jpeg',0.72);
  return {ocr:data,text:extracted,receipt:{name:'justificante-'+Date.now()+'.jpg',type:'image/jpeg',data}};
 }finally{await pdf.destroy()}
}
async function prepare(file){
 if(!file||file.size>20*1024*1024||!(/^image\//.test(file.type)||/\.(heic|heif|jpg|jpeg|png|webp)$/i.test(file.name)))throw new Error('Elige una foto de hasta 20 MB. Para un PDF, adjúntalo desde Calendario de gastos.');
 const url=URL.createObjectURL(file),img=new Image();try{img.src=url;try{await img.decode()}catch(decodeError){await new Promise((resolve,reject)=>{const fallback=new Image();fallback.onload=()=>{img.src=fallback.src;resolve()};fallback.onerror=()=>reject(decodeError);fallback.src=url})}if(!img.naturalWidth||!img.naturalHeight)throw new Error('Imagen vacía');const scale=Math.min(1,2200/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);c.drawImage(img,0,0,canvas.width,canvas.height);const ocr=canvas.toDataURL('image/jpeg',.94);let data='';for(let pass=0;pass<6;pass++){data=canvas.toDataURL('image/jpeg',Math.max(.45,.85-pass*.08));if(Math.ceil((data.length-data.indexOf(',')-1)*.75)<=450*1024)break;const next=document.createElement('canvas');next.width=Math.round(canvas.width*.8);next.height=Math.round(canvas.height*.8);next.getContext('2d').drawImage(canvas,0,0,next.width,next.height);canvas.width=next.width;canvas.height=next.height;c.drawImage(next,0,0)}if(data.length>650000)throw new Error('La foto es demasiado grande. Recorta el fondo y vuelve a intentarlo.');return{ocr,receipt:{name:'recibo-'+Date.now()+'.jpg',type:'image/jpeg',data}}}catch(e){if(e.message?.includes('grande'))throw e;throw new Error('No se pudo abrir esta imagen. Si es HEIC, conviértela a JPG desde Fotos o Archivos y vuelve a intentarlo.')}finally{URL.revokeObjectURL(url)}
}
function categories(){return typeof categoryOptionsForType==='function'?categoryOptionsForType('expense'):[]}
function fillReview(parsed){
 const d=draft;d.parsed=parsed;
 if(calendarContext){$('receiptScanName').value=parsed.name||'';$('receiptScanAmount').value=parsed.amount||'';$('receiptScanDate').value=parsed.date||'';$('receiptScanWarning').textContent=['Revisa el resultado antes de aplicarlo al gasto.',...(parsed.warnings||[])].join(' ');$('receiptScanWarning').hidden=false;$('receiptScanForm').hidden=false;$('receiptScanExisting').closest('label').hidden=true;$('receiptScanNewFields').hidden=true;$('receiptScanSave').textContent='Aplicar datos al gasto';return}
$('receiptScanName').value=parsed.name;$('receiptScanAmount').value=parsed.amount||'';$('receiptScanDate').value=parsed.date||'';
 const select=$('receiptScanCategory');select.replaceChildren(new Option('Selecciona una categoría',''));for(const c of categories())select.add(new Option(c.name,String(c.id)));
 const suggestion=categories().find(c=>M.norm(c.name)===M.norm(parsed.category));if(suggestion)select.value=String(suggestion.id);
 for(const[id,value]of [['receiptScanName',parsed.name],['receiptScanAmount',parsed.amount],['receiptScanDate',parsed.date],['receiptScanCategory',suggestion]])$(id).classList.toggle('receipt-scan-uncertain',!value);
 $('receiptScanWarning').textContent=['Revisa los datos antes de guardar.',...parsed.warnings].join(' ');$('receiptScanWarning').hidden=false;$('receiptScanForm').hidden=false;updateDuplicates();
}
async function scan(file){
 if(!allowed())throw new Error('Acceso al escáner no disponible');if($('receiptScanSave').disabled)return;stop();const current=token;const d={owner:owner(),receipt:null};draft=d;busy=true;$('receiptScanForm').hidden=true;$('receiptScanWarning').hidden=true;status('Preparando la foto…');
 try{
  const image=/\.pdf$/i.test(file?.name||'')||file?.type==='application/pdf'?await preparePdf(file):await prepare(file);if(current!==token)return;assertDraft(d);d.receipt=image.receipt;$('receiptScanPreview').src=image.receipt.data;$('receiptScanPreview').hidden=false;
  status('Descargando el lector. La primera lectura puede tardar unos segundos…');const engine=await loadEngine();if(current!==token)return;assertDraft(d);
  const created=await engine.createWorker('spa',1,{workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js',corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0',logger:m=>{if(current===token&&m.status==='recognizing text')status('Leyendo recibo… '+Math.round((m.progress||0)*100)+' %')}});
  if(current!==token){await created.terminate();return}worker=created;const result=await worker.recognize(image.ocr);if(current!==token)return;assertDraft(d);const parsed=M.parse((image.text||'')+'\n'+result.data.text);if(Number(result.data.confidence)<65)parsed.warnings.push('La imagen se lee con poca claridad. Comprueba todos los campos.');fillReview(parsed);status('Lectura terminada. Comprueba comercio, total, fecha y categoría.');
 }catch(e){if(current!==token)return;if(d.receipt&&owner()===d.owner&&allowed()){fillReview({name:'',amount:null,date:'',category:'',warnings:['No se ha podido leer automáticamente. Completa los datos o prueba otra foto.']});status(e.message||'No se pudo leer la foto.')}else status(e.message||'No se pudo abrir la foto.')}
 finally{if(current===token){busy=false;if(worker){worker.terminate().catch(()=>{});worker=null}}}
}
function values(){return{name:$('receiptScanName').value.trim(),amount:Number($('receiptScanAmount').value),date:$('receiptScanDate').value}}
function updateDuplicates(){
 if(!draft)return;const select=$('receiptScanExisting'),old=select.value,items=(typeof moves!=='undefined'?moves:[]).filter(m=>m.type==='expense').slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')),duplicates=M.duplicates(items,values());
 select.replaceChildren(new Option('Crear un gasto nuevo',''));for(const m of items){const isDuplicate=duplicates.some(x=>String(x.id)===String(m.id));select.add(new Option((isDuplicate?'⚠ Coincide · ':'')+m.date+' · '+(m.desc||m.cat)+' · '+Number(m.amount).toFixed(2)+' €',String(m.id)))}if(items.some(m=>String(m.id)===old))select.value=old;
 $('receiptScanDuplicate').hidden=!duplicates.length;$('receiptScanDuplicate').textContent=duplicates.length?'Hay gastos con el mismo importe y fecha. Vincula el recibo a uno existente o confirma que es un gasto distinto.':'';
 $('receiptScanAllowDuplicateLabel').hidden=!duplicates.length||!!select.value;$('receiptScanReplaceLabel').hidden=!select.value||!items.find(m=>String(m.id)===select.value)?.receipt;
 $('receiptScanNewFields').hidden=!!select.value;$('receiptScanSave').textContent=select.value?'Adjuntar al gasto existente':'Guardar gasto';
}
async function saveScan(event){
 event.preventDefault();if(busy||$('receiptScanSave').disabled)return;const d=draft;try{assertDraft(d)}catch(e){status(e.message);return}
 if(calendarContext){const parsed={...d.parsed,name:$('receiptScanName').value.trim(),amount:Number($('receiptScanAmount').value)||null,date:$('receiptScanDate').value};try{calendarContext.apply(parsed,d.receipt);calendarContext=null;close()}catch(error){status(error.message||'No se pudieron aplicar los datos')}return}const v=values(),existingId=$('receiptScanExisting').value,existing=existingId?moves.find(m=>String(m.id)===existingId&&m.type==='expense'):null,cat=categories().find(c=>String(c.id)===$('receiptScanCategory').value),paid=$('receiptScanPaid').checked;
 if(!d.receipt){status('Selecciona primero una foto.');return}
 if(existingId&&!existing){status('El gasto ya no existe. Vuelve a seleccionarlo.');return}
 if(!existing&&(!v.name||!Number.isFinite(v.amount)||v.amount<=0||v.amount>999999999||!M.validDate(v.date)||!cat)){status('Completa el comercio, un importe válido, la fecha y la categoría.');return}
 if(!existing&&paid&&v.date>localMoveDate()){status('Un gasto pagado no puede tener una fecha futura.');return}
 if(!existing&&M.duplicates(moves,v).length&&!$('receiptScanAllowDuplicate').checked){status('Revisa el posible duplicado o confirma que es un gasto distinto.');return}
 if(existing?.receipt&&!$('receiptScanReplace').checked){status('Confirma que quieres reemplazar el justificante existente.');return}
 const button=$('receiptScanSave'),fields=$('receiptScanFields');button.disabled=true;fields.disabled=true;status('Guardando gasto y justificante…');
 try{
  const snapshot=JSON.stringify(moves),rawPlans=localStorage.getItem('fiexea_scheduled_expenses'),ownerId=typeof financialActiveUserId!=='undefined'?financialActiveUserId:null;
  const receipt=ownerId&&window.fiexeaReceiptStorage?await window.fiexeaReceiptStorage.storeInline(d.receipt,ownerId):d.receipt;assertDraft(d);
  if(JSON.stringify(moves)!==snapshot||localStorage.getItem('fiexea_scheduled_expenses')!==rawPlans)throw new Error('Los gastos han cambiado. Revisa los datos y vuelve a guardar.');
  const before=moves,beforeRaw=localStorage.getItem('fiexea_moves'),plans=JSON.parse(rawPlans||'[]');let next=moves.slice();
  if(existing){
   let scheduleId=existing.scheduledExpenseId;
   if(!scheduleId){scheduleId=uid();plans.push({id:scheduleId,name:existing.desc||existing.cat||'Gasto',amount:existing.amount,date:existing.date,repeat:'once',end:'',category:existing.cat||'Otros',property:existing.property||'',taxReview:!!existing.taxReview})}
   next=next.map(m=>String(m.id)===existingId?{...m,scheduledExpenseId:scheduleId,scheduledDate:m.scheduledDate||m.date,receipt}:m);
  }else{
   const id=uid(),amount=Math.round(v.amount*100)/100;plans.push({id,name:v.name,amount,date:v.date,repeat:'once',end:'',category:cat.name,receipt,receiptDate:v.date,property:'',taxReview:false});
   if(paid)next.push({id:uid(),type:'expense',desc:v.name,amount,date:v.date,cat:cat.name,categoryId:cat.id,scheduledExpenseId:id,scheduledDate:v.date,receipt});
  }
  try{localStorage.setItem('fiexea_moves',JSON.stringify(next));localStorage.setItem('fiexea_scheduled_expenses',JSON.stringify(plans));moves=next;save();queueFinancialSync()}catch(e){moves=before;try{if(beforeRaw===null)localStorage.removeItem('fiexea_moves');else localStorage.setItem('fiexea_moves',beforeRaw);if(rawPlans===null)localStorage.removeItem('fiexea_scheduled_expenses');else localStorage.setItem('fiexea_scheduled_expenses',rawPlans)}catch(_){}throw e}
  button.disabled=false;fields.disabled=false;close();render();if(window.fiexeaRenderCalendar)window.fiexeaRenderCalendar();showSaveToast(existing?'Recibo adjuntado sin duplicar el gasto.':paid?'Gasto guardado con su recibo.':'Gasto pendiente guardado en el calendario.');
 }catch(e){status(/quota|exceeded/i.test(e.name+' '+e.message)?'No queda espacio. Prueba una foto más pequeña. No se ha guardado el gasto.':e.message||'No se pudo guardar.');button.disabled=false;fields.disabled=false}
}
function init(){
 document.body.insertAdjacentHTML('beforeend',`<dialog id="receiptScanner" class="receipt-scanner" aria-labelledby="receiptScanTitle"><header><h2 id="receiptScanTitle">📷 Escanear recibo</h2><button type="button" data-receipt-close aria-label="Cerrar escáner">×</button></header><div class="receipt-scan-body"><p>Fotografía un ticket o factura. Revisa los datos y confirma antes de guardar.</p><div class="receipt-scan-actions"><button type="button" id="receiptScanCamera">Hacer foto</button><button type="button" class="secondary" id="receiptScanGallery">Elegir imagen</button></div><input id="receiptScanCameraFile" type="file" accept="image/*" capture="environment" hidden><input id="receiptScanGalleryFile" type="file" accept="image/*" hidden><p id="receiptScanStatus" class="receipt-scan-status" role="status" aria-live="polite"></p><img id="receiptScanPreview" class="receipt-scan-preview" alt="Recibo seleccionado" hidden><p id="receiptScanWarning" class="receipt-scan-warning" hidden></p><form id="receiptScanForm" hidden novalidate><fieldset id="receiptScanFields"><label>Comercio o concepto<input id="receiptScanName" maxlength="100" autocomplete="off"></label><label>Importe total<input id="receiptScanAmount" type="number" min="0.01" max="999999999" step="0.01" inputmode="decimal"></label><label>Fecha del recibo<input id="receiptScanDate" type="date" min="1900-01-01" max="2199-12-31"></label><p id="receiptScanDuplicate" class="receipt-scan-warning" hidden></p><label>¿Ya has registrado este gasto?<select id="receiptScanExisting"></select></label><label id="receiptScanReplaceLabel" hidden><input id="receiptScanReplace" type="checkbox">Reemplazar el justificante existente</label><label id="receiptScanAllowDuplicateLabel" hidden><input id="receiptScanAllowDuplicate" type="checkbox">He revisado la coincidencia: es un gasto distinto</label><div id="receiptScanNewFields"><label>Categoría sugerida<select id="receiptScanCategory"></select></label><label><input id="receiptScanPaid" type="checkbox">Ya está pagado en esta fecha</label><p class="receipt-scan-privacy">Si no marcas «Pagado», se guarda como pendiente en Calendario de gastos y no descuenta dinero.</p></div><div class="receipt-scan-actions"><button type="submit" id="receiptScanSave">Guardar gasto</button><button type="button" class="secondary" data-receipt-close>Cancelar</button></div></fieldset></form><p class="receipt-scan-privacy">La lectura se hace en este dispositivo. Necesitas conexión para descargar el lector la primera vez. La foto se comprime y se adjunta al guardar; con sesión iniciada se guarda en tu cuenta. Durante la prueba sin registro permanece en este navegador. El escáner no determina si un gasto es deducible.</p></div></dialog>`);
 $('receiptScanForm').addEventListener('submit',saveScan);document.querySelectorAll('[data-receipt-open]').forEach(b=>b.addEventListener('click',open));document.querySelectorAll('[data-receipt-close]').forEach(b=>b.addEventListener('click',close));
 for(const[type,button]of [['Camera','Camera'],['Gallery','Gallery']]){$('receiptScan'+button).addEventListener('click',()=>{if(!$('receiptScanSave').disabled)$('receiptScan'+type+'File').click()});$('receiptScan'+type+'File').addEventListener('change',e=>{const file=e.target.files[0];e.target.value='';if(file){status('Imagen seleccionada: '+file.name+'. Preparando lectura…');scan(file)}else status('No se ha seleccionado ninguna imagen.')})}
 for(const id of ['receiptScanName','receiptScanAmount','receiptScanDate'])$(id).addEventListener('input',()=>{$('receiptScanAllowDuplicate').checked=false;updateDuplicates()});$('receiptScanExisting').addEventListener('change',()=>{$('receiptScanReplace').checked=false;updateDuplicates()});
 $('receiptScanner').addEventListener('cancel',e=>{e.preventDefault();close()});window.FiexeaReceiptScanner={open,close,scan};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

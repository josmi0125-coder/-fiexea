const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const M=require('../expense-calendar-math.js');
test('monthly charges preserve day after a shorter month',()=>{
 assert.deepEqual(M.occurrences({date:'2027-01-31',repeat:'monthly'},2027).slice(0,3),['2027-01-31','2027-02-28','2027-03-31']);
});
test('annual leap-day charges recover the original day',()=>{
 const plan={date:'2024-02-29',repeat:'yearly'};
 assert.deepEqual(M.occurrences(plan,2027),['2027-02-28']);
 assert.deepEqual(M.occurrences(plan,2028),['2028-02-29']);
});
test('quarterly recurrence respects its inclusive end date',()=>{
 assert.deepEqual(M.occurrences({date:'2026-10-31',repeat:'quarterly',end:'2027-07-31'},2027),['2027-01-31','2027-04-30','2027-07-31']);
 assert.deepEqual(M.occurrences({date:'2028-01-01',repeat:'monthly'},2027),[]);
});
test('invalid calendar dates are rejected',()=>{
 assert.equal(M.validDate('2027-02-29'),false);
 assert.equal(M.validDate('2028-02-29'),true);
 assert.deepEqual(M.occurrences({date:'2027-02-30',repeat:'yearly'},2027),[]);
});
const plan={id:'p',date:'2026-12-31',repeat:'yearly',amount:100,name:'Seguro'};
const payment={id:'m',type:'expense',scheduledExpenseId:'p',scheduledDate:'2026-12-31',date:'2027-01-02',amount:110,taxReview:true,property:'Alberic',cat:'Seguros'};
test('paid charge uses the real amount once; deleting a payment restores pending',()=>{
 const rows=M.calendarRows([plan],[payment],2026);
 assert.equal(rows.length,1);assert.equal(rows[0].amount,110);
 assert.equal(M.calendarRows([plan],[],2026)[0].move,undefined);
});
test('tax filtering uses real payment year, property and category',()=>{
 assert.equal(M.taxRows([payment],2026).length,0);
 assert.equal(M.taxRows([payment],2027,'Alberic','Seguros').length,1);
 assert.equal(M.taxRows([payment],2027,'Otra').length,0);
 assert.equal(M.taxRows([{...payment,taxReview:false}],2027).length,0);
 assert.equal(M.taxRows([{...payment,taxReview:false}],2027,'','',false).length,1);
});
test('paid history survives deleting or editing a schedule',()=>{
 assert.equal(M.calendarRows([],[payment],2026).length,1);
 assert.equal(M.calendarRows([{...plan,date:'2027-02-01'}],[payment],2026).length,1);
});
test('CSV protects formula-like user input and escapes quotes',()=>{
 assert.equal(M.csvCell('=SUM(1)'),'"\'=SUM(1)"');
 assert.equal(M.csvCell('Casa "A"'),'"Casa ""A"""');
});
function harness(options={}){
 const nodes={},data=new Map(),alerts=[];
 const node=id=>nodes[id]||(nodes[id]={value:'',checked:false,files:[],disabled:false,dataset:{},querySelectorAll(){return []},close(){}});
 const env={window:{FiexeaCalendarMath:M},localStorage:{getItem:k=>data.get(k)??null,setItem(k,v){data.set(k,String(v))}},document:{getElementById:id=>id==='t11'?null:node(id)},financialAppReady:true,financialActiveUserId:'A',moves:[],accounts:[],queueFinancialSync(){},save(){data.set('fiexea_moves',JSON.stringify(env.moves))},render(){},showSaveToast(){},alert:m=>alerts.push(m),localMoveDate:()=> '2026-10-20',esc:String,eur:String,uid:()=> 'new-'+env.moves.length};
 const source=fs.readFileSync(require.resolve('../expense-calendar.js'),'utf8').replace(/if\(document\.readyState==='loading'\)[^\n]+/,"window.__calendarTest={openEditor,deleteCalendarExpense,taxGroupsMarkup,openPayment,renderCalendar,setView(value){view=value},planReceipt,rowMarkup,confirmPayment,savePlan,categoryChoices,selectedCategory,setEditor(id){editId=id},setPayment(p){payment=p;sessionOwner=p.owner}};");
 if(options.receiptStorage){env.window.FiexeaReceiptStorage=options.receiptStorage;env.fiexeaSupabase={};}
 vm.runInNewContext(source,env);
 data.set('fiexea_scheduled_expenses',JSON.stringify([{id:'p',name:'Seguro',amount:100,date:'2026-10-01',repeat:'yearly',category:'Seguros'}]));
 const api=env.window.__calendarTest;
 function setup(extra={}){api.setPayment({id:'p',due:'2026-10-01',moveId:'',owner:'A',...extra});node('calPayAmount').value='105';node('calPayDate').value='2026-10-20';node('calPayProperty').value='Alberic';node('calPayTax').checked=true;node('calPayExisting').value='';node('calPayAccount').value='';node('calPayReceipt').files=[];}
 return{env,node,data,alerts,api,setup,pay:()=>api.confirmPayment({preventDefault(){}})};
}
test('confirming twice produces only one expense',async()=>{
 const h=harness();h.setup();await h.pay();
 assert.equal(h.env.moves.length,1);assert.equal(h.env.moves[0].amount,105);assert.equal(h.env.moves[0].date,'2026-10-20');
 h.setup();await h.pay();assert.equal(h.env.moves.length,1);assert.match(h.alerts.pop(),/ya está registrado/);
});
test('link an existing movement, then update payment without duplicating',async()=>{
 const h=harness();h.env.moves=[{id:'manual',type:'expense',cat:'Seguros',desc:'Seguro pagado',date:'2026-10-19',amount:101}];
 h.setup();h.node('calPayExisting').value='manual';await h.pay();
 assert.equal(h.env.moves.length,1);assert.equal(h.env.moves[0].id,'manual');assert.equal(h.env.moves[0].scheduledExpenseId,'p');
 h.setup({moveId:'manual'});h.node('calPayAmount').value='120';await h.pay();assert.equal(h.env.moves.length,1);assert.equal(h.env.moves[0].amount,120);
});
test('future dates and storage failures leave charges unpaid',async()=>{
 const h=harness();h.setup();h.node('calPayDate').value='2026-11-01';await h.pay();assert.equal(h.env.moves.length,0);
 h.setup();h.env.localStorage.setItem=()=>{throw Error('QuotaExceeded')};await h.pay();assert.equal(h.env.moves.length,0);assert.match(h.alerts.pop(),/almacenamiento del navegador está lleno/);
});
test('account change during confirmation cannot write into the new account',async()=>{
 const h=harness();h.setup();h.env.financialActiveUserId='B';await h.pay();assert.equal(h.env.moves.length,0);assert.match(h.alerts.pop(),/cuenta ha cambiado/);
});
test('existing backups remain valid and calendar is included in new backups',()=>{
 const html=fs.readFileSync(require.resolve('../app.html'),'utf8');
 const keys=vm.runInNewContext(html.match(/const FIEXEA_FINANCIAL_BACKUP_KEYS=Object\.freeze\((\[[^\n]+?\])\)/)[1]);
 const start=html.indexOf('function validateFinancialBackupData('),end=html.indexOf('function validateFinancialBackup(',start);
 const validate=vm.runInNewContext('('+html.slice(start,end)+')',{FIEXEA_FINANCIAL_BACKUP_KEYS:keys});
 const legacy=Object.fromEntries(keys.filter(k=>k!=='fiexea_scheduled_expenses').map(k=>[k,null]));
 assert.equal(validate(legacy),true);assert.equal(validate({...legacy,fiexea_scheduled_expenses:'[]'}),true);
 assert.match(html,/function render\(\)\{save\(\);window\.fiexeaRenderCalendar\?\.\(\)/);
});


test('moving a paid due date to a past month or year does not recreate the old pending charge',()=>{
 const p={id:'p',date:'2026-10-21',repeat:'once',amount:290};
 const m={id:'m',type:'expense',scheduledExpenseId:'p',scheduledOriginalDate:'2026-10-21',scheduledDate:'2025-09-02',date:'2025-09-02',amount:290};
 assert.equal(M.calendarRows([p],[m],2026).length,0);
 const rows=M.calendarRows([p],[m],2025);assert.equal(rows.length,1);assert.equal(rows[0].due,'2025-09-02');assert.equal(rows[0].move.id,'m');
});
test('editing the scheduled date preserves the receipt and updates the existing payment',async()=>{
 const h=harness();h.setup();await h.pay();h.env.moves[0].receipt={name:'recibo.pdf'};
 h.setup({moveId:h.env.moves[0].id});h.node('calPayDate').value='2026-09-02';await h.pay();
 assert.equal(h.env.moves.length,1);assert.equal(h.env.moves[0].scheduledDate,'2026-09-02');assert.equal(h.env.moves[0].scheduledOriginalDate,'2026-10-01');assert.equal(h.env.moves[0].receipt.name,'recibo.pdf');
});

test('one payment date updates both calendar placement and movement date',async()=>{
 const h=harness();h.setup();h.node('calPayDate').value='2025-08-12';await h.pay();
 assert.equal(h.env.moves[0].date,'2025-08-12');assert.equal(h.env.moves[0].scheduledDate,'2025-08-12');
 assert.equal(M.calendarRows(JSON.parse(h.data.get('fiexea_scheduled_expenses')),h.env.moves,2026).filter(r=>!r.move).length,0);
 h.setup();await h.pay();assert.equal(h.env.moves.length,1);
});

test('pending receipt transfers to its payment but not to later recurring charges',async()=>{
 const h=harness();const receipt={name:'seguro.pdf',type:'application/pdf',data:'data:application/pdf;base64,YQ=='};
 const plans=JSON.parse(h.data.get('fiexea_scheduled_expenses'));plans[0].receipt=receipt;plans[0].receiptDate='2026-10-01';h.data.set('fiexea_scheduled_expenses',JSON.stringify(plans));
 h.setup();await h.pay();assert.equal(h.env.moves[0].receipt.name,'seguro.pdf');
 h.setup({due:'2027-10-01'});await h.pay();assert.equal(h.env.moves[1].receipt,undefined);
});

test('editing a schedule updates the category of its paid movements and preserves payment details',async()=>{
 const h=harness();const receipt={name:'IBI.pdf',data:'original'};
 h.env.moves=[{id:'paid',type:'expense',scheduledExpenseId:'p',cat:'Otros',date:'2026-08-03',amount:133.60,receipt},{id:'unrelated',type:'expense',cat:'Otros',amount:20}];
 h.api.setEditor('p');h.node('calendarEditor').open=true;
 for(const [id,value] of Object.entries({calName:'Contribución Atico',calAmount:'133.60',calDate:'2026-08-03',calRepeat:'once',calCategory:'Gastos Atico',calProperty:'Atico'}))h.node(id).value=value;
 await h.api.savePlan({preventDefault(){}});
 assert.deepEqual(h.alerts,[]);assert.equal(h.env.moves[0].cat,'Gastos Atico');assert.equal(h.env.moves[0].amount,133.60);assert.equal(h.env.moves[0].date,'2026-08-03');assert.equal(h.env.moves[0].receipt,receipt);assert.equal(h.env.moves[1].cat,'Otros');
 assert.equal(JSON.parse(h.data.get('fiexea_moves'))[0].cat,'Gastos Atico');
});

test('category dropdown includes the full expense catalog even when categories are not active',()=>{
 const h=harness();h.env.moves=[{type:'expense',cat:'Gastos Ático'},{type:'income',cat:'Nómina'}];
 h.env.categoryOptionsForType=type=>{assert.equal(type,'expense');return [{name:'Dentista'},{name:'Seguros'},{name:'DENTISTA'},{name:'Categoría propia'}]};h.env.movementCategoryIsActive=c=>c.name.toLowerCase()==='dentista';
 const choices=h.api.categoryChoices('Categoría antigua');assert.deepEqual(Array.from(choices),['Categoría propia','Dentista','Seguros']);
 h.node('calCategory').value='Dentista';assert.equal(h.api.selectedCategory(),'Dentista');
});


test('installments keep separate dates, unequal amounts and receipts under one tax group',()=>{
 const p={id:'first',name:'Contribución',receipt:{name:'agosto.pdf'},receiptDate:'2026-08-03'};
 const parts=M.installmentPlans(p,[{date:'2026-08-03',amount:133.6},{date:'2026-10-01',amount:140}],'g');
 assert.equal(new Set(parts.map(p=>p.id)).size,2);assert.equal(parts[0].receipt.name,'agosto.pdf');assert.equal(parts[1].receipt,undefined);assert.equal(parts[1].date,'2026-10-01');assert.equal(parts[1].amount,140);
 assert.throws(()=>M.installmentPlans(p,[{date:'2026-02-30',amount:1},{date:'2026-10-01',amount:1}],'g'));
});
test('tax groups sum only filtered paid amounts and keep different properties separate',()=>{
 const plans=[{id:'a',taxGroupId:'g',taxGroupName:'Contribución'},{id:'b',taxGroupId:'g',taxGroupName:'Contribución'}];
 const entries=plans.map((p,i)=>({id:'m'+i,type:'expense',scheduledExpenseId:p.id,scheduledDate:'2026-08-03',date:i?'2026-10-22':'2026-08-03',amount:133.6,property:'Ático',taxReview:true}));
 assert.equal(M.taxGroups(M.taxRows(entries,2026),plans)[0].total,267.2);
 assert.equal(M.taxGroups(M.taxRows([{...entries[0],date:'2027-01-01'},entries[1]],2026),plans)[0].total,133.6);
 assert.equal(M.taxGroups([entries[0],{...entries[1],property:'Otra vivienda'}],plans).length,2);
});
test('grouping existing schedules preserves each paid amount, date and receipt',async()=>{
 const h=harness();h.data.set('fiexea_scheduled_expenses',JSON.stringify([{id:'a',name:'Contribución 1/2',category:'Suministros'},{id:'b',name:'Contribución 2/2',category:'Suministros'}]));
 h.env.moves=['a','b'].map((id,i)=>({id:'m'+i,scheduledExpenseId:id,type:'expense',amount:133.6,date:i?'2026-10-22':'2026-08-03',cat:'Suministros',receipt:{name:id+'.pdf'}}));
 h.api.setEditor('b');h.node('calendarEditor').open=true;
 for(const [id,value]of Object.entries({calName:'Contribución 2/2',calAmount:'133.6',calDate:'2026-10-01',calRepeat:'once',calCategory:'Suministros',calProperty:'Ático',calGroup:'a'}))h.node(id).value=value;
 await h.api.savePlan({preventDefault(){}});assert.deepEqual(h.alerts,[]);
 const plans=JSON.parse(h.data.get('fiexea_scheduled_expenses'));assert.equal(plans[0].taxGroupId,plans[1].taxGroupId);assert.equal(h.env.moves.length,2);assert.equal(h.env.moves[0].date,'2026-08-03');assert.equal(h.env.moves[1].receipt.name,'b.pdf');assert.equal(M.taxGroups(h.env.moves,plans)[0].total,267.2);
 h.node('calendarEditor').open=true;h.node('calGroup').value='';await h.api.savePlan({preventDefault(){}});assert.deepEqual(h.alerts,[]);assert.equal(M.taxGroups(h.env.moves,JSON.parse(h.data.get('fiexea_scheduled_expenses'))).length,2);
});

test('receipt saved on an already-paid schedule reaches only its matching payment',async()=>{
 const h=harness(),receipt={name:'contribucion.pdf',type:'application/pdf',data:'data:application/pdf;base64,YQ=='};
 h.data.set('fiexea_scheduled_expenses',JSON.stringify([{id:'p',name:'Contribución',date:'2026-08-03',repeat:'yearly',category:'Suministros',receipt,receiptDate:'2026-08-03'}]));
 h.env.moves=[{id:'august',type:'expense',scheduledExpenseId:'p',scheduledOriginalDate:'2026-08-03',scheduledDate:'2026-08-05',date:'2026-08-05',amount:133.6},{id:'next-year',type:'expense',scheduledExpenseId:'p',scheduledDate:'2027-08-03',date:'2027-08-03',amount:140}];
 h.api.setEditor('p');h.node('calendarEditor').open=true;
 for(const [id,value]of Object.entries({calName:'Contribución',calAmount:'133.6',calDate:'2026-08-03',calRepeat:'yearly',calCategory:'Suministros',calProperty:'Ático'}))h.node(id).value=value;
 await h.api.savePlan({preventDefault(){}});
 assert.deepEqual(h.alerts,[]);assert.equal(h.env.moves.length,2);assert.equal(h.env.moves[0].receipt.name,receipt.name);assert.equal(h.env.moves[0].date,'2026-08-05');assert.equal(h.env.moves[0].amount,133.6);assert.equal(h.env.moves[1].receipt,undefined);
 assert.equal(JSON.parse(h.data.get('fiexea_moves'))[0].receipt.name,receipt.name);
 const replacement={name:'nuevo.pdf',type:'application/pdf',size:1};
 h.env.FileReader=class{readAsDataURL(){this.result='data:application/pdf;base64,Yg==';this.onload()}};
 h.node('calendarEditor').open=true;h.node('calReceipt').files=[replacement];await h.api.savePlan({preventDefault(){}});
 assert.deepEqual(h.alerts,[]);assert.equal(h.env.moves[0].receipt.name,'nuevo.pdf');assert.equal(h.env.moves[1].receipt,undefined);
});

 test('one-off paid receipt remains visible after the schedule date was corrected',()=>{
 const h=harness(),receipt={name:'IBI.png'},plan={id:'p',repeat:'once',date:'2026-08-03',receiptDate:'2026-08-03',receipt};
 const move={id:'august',type:'expense',scheduledExpenseId:'p',scheduledOriginalDate:'2026-10-22',scheduledDate:'2026-08-03',date:'2026-08-03',amount:133.6};
 h.env.moves=[move];h.data.set('fiexea_scheduled_expenses',JSON.stringify([plan]));
 assert.equal(h.api.planReceipt(plan,move),receipt);assert.match(h.api.rowMarkup({move,due:move.scheduledDate,amount:133.6}),/📎 Recibo/);
 assert.equal(h.api.planReceipt({...plan,repeat:'yearly'},move),null);
 h.env.moves.push({...move,id:'ambiguous'});assert.equal(h.api.planReceipt(plan,move),null);
 });

test('creating installments saves each receipt and ignores the manual group selector',async()=>{
 const h=harness();h.api.setEditor('');h.node('calendarEditor').open=true;h.node('calSplit').checked=true;
 for(const [id,value]of Object.entries({calName:'Residuos 1/2',calAmount:'51.65',calDate:'2026-07-01',calRepeat:'once',calCategory:'Suministros',calGroup:'p'}))h.node(id).value=value;
 h.node('calReceipt').files=[{name:'julio.pdf',type:'application/pdf',size:1}];
 const secondFile={name:'agosto.pdf',type:'application/pdf',size:1};
 h.node('calSplitRows').querySelectorAll=()=>[{querySelector(selector){return selector==='[type=date]'?{value:'2026-08-03'}:selector==='[type=number]'?{value:'51.65'}:{files:[secondFile]}}}];
 h.env.FileReader=class{readAsDataURL(file){this.result='data:application/pdf;base64,'+(file.name==='julio.pdf'?'YQ==':'Yg==');this.onload()}};
 await h.api.savePlan({preventDefault(){}});assert.deepEqual(h.alerts,[]);
 const plans=JSON.parse(h.data.get('fiexea_scheduled_expenses'));assert.equal(plans.length,3);
 assert.equal(plans[0].taxGroupId,undefined);assert.equal(plans[1].taxGroupId,plans[2].taxGroupId);
 assert.equal(plans[1].name,'Residuos 1/2');assert.equal(plans[2].name,'Residuos 2/2');assert.equal(plans[1].taxGroupName,'Residuos');
 assert.equal(plans[1].receipt.name,'julio.pdf');assert.equal(plans[1].receiptDate,'2026-07-01');assert.equal(plans[2].receipt.name,'agosto.pdf');assert.equal(plans[2].receiptDate,'2026-08-03');assert.equal(h.env.moves.length,0);
});

 test('saving with a full browser moves legacy receipt copies out before persisting the expense',async()=>{
 const compact=async value=>JSON.parse(JSON.stringify(value),(key,value)=>{
  if(key==='receipt'&&value?.data){const {data,...metadata}=value;return {...metadata,bucket:'expense-receipts',path:'A/hash',owner:'A'}}
  if(key.startsWith('fiexea_')&&typeof value==='string'){try{return JSON.stringify(awaitlessCompact(JSON.parse(value)))}catch(_){}}
  return value;
 });
 function awaitlessCompact(value){if(Array.isArray(value))return value.map(awaitlessCompact);if(value&&typeof value==='object'){const out={...value};for(const key of Object.keys(out)){if(key==='receipt'&&out[key]?.data){const{data,...metadata}=out[key];out[key]={...metadata,bucket:'expense-receipts',path:'A/hash',owner:'A'}}else out[key]=awaitlessCompact(out[key]);}return out;}return value;}
 const h=harness({receiptStorage:{create:()=>({compact,storeInline:async r=>{const{data,...metadata}=r;return {...metadata,bucket:'expense-receipts',path:'A/hash',owner:'A'}}})}});
 const receipt={name:'IBI.pdf',type:'application/pdf',data:'data:application/pdf;base64,'+'YQ=='.repeat(10000)};
 const plans=[{id:'p',name:'IBI',date:'2026-08-03',repeat:'once',category:'Suministros',receipt,receiptDate:'2026-08-03'}];
 h.env.moves=[{id:'old',type:'expense',scheduledExpenseId:'p',scheduledDate:'2026-08-03',date:'2026-08-03',amount:133.6,receipt}];
 h.data.set('fiexea_scheduled_expenses',JSON.stringify(plans));h.data.set('fiexea_moves',JSON.stringify(h.env.moves));
 h.data.set('fiexea_financial_cache_v1_A',JSON.stringify({fiexea_moves:JSON.stringify(h.env.moves)}));
 const limit=[...h.data.values()].join('').length+50;
 const normalSet=h.env.localStorage.setItem;h.env.localStorage.setItem=(key,value)=>{const used=[...h.data.entries()].filter(([k])=>k!==key).reduce((sum,[,v])=>sum+v.length,0)+String(value).length;if(used>limit)throw new Error('QuotaExceeded');normalSet(key,value)};
 h.api.setEditor('');h.node('calendarEditor').open=true;
 for(const [id,value]of Object.entries({calName:'Residuos',calAmount:'51.65',calDate:'2026-07-01',calRepeat:'once',calCategory:'Suministros'}))h.node(id).value=value;
 await h.api.savePlan({preventDefault(){}});
 assert.deepEqual(h.alerts,[]);assert.equal(JSON.parse(h.data.get('fiexea_scheduled_expenses')).length,2);
 assert.equal(h.env.moves[0].amount,133.6);assert.equal(h.env.moves[0].date,'2026-08-03');assert.equal(h.env.moves[0].receipt.data,undefined);
 assert.ok([...h.data.values()].join('').length<limit/5);
 });

 test('calendar refresh keeps expanded months and skips unchanged markup',()=>{
 const h=harness();h.env.presentationCurrency='EUR';h.env.document.getElementById=id=>h.node(id);h.env.document.querySelectorAll=()=>[];h.node('calendarSummary').classList={toggle(){}};
 h.node('calendarContent').querySelectorAll=()=>[{dataset:{calendarMonth:'2026-10'}}];h.api.setView('annual');h.api.renderCalendar();
 assert.match(h.node('calendarContent').innerHTML,/data-calendar-month="2026-10" open/);
 h.node('calendarContent').innerHTML='unchanged';h.api.renderCalendar();assert.equal(h.node('calendarContent').innerHTML,'unchanged');
 h.env.moves=[{id:'m',type:'expense',scheduledExpenseId:'p',scheduledDate:'2026-10-01',date:'2026-10-01',amount:100}];h.api.renderCalendar();assert.match(h.node('calendarContent').innerHTML,/data-calendar-month="2026-10" open/);
 });
 test('receipt upload shows progress and rejects repeated submissions until complete',async()=>{
 const h=harness();h.setup();let reader;h.env.FileReader=class{readAsDataURL(){reader=this}};h.node('calPayReceipt').files=[{name:'recibo.pdf',size:1,type:'application/pdf'}];h.node('calendarPaySubmit').textContent='Guardar pago';
 const saving=h.pay();assert.equal(h.node('calendarPaySubmit').disabled,true);assert.equal(h.node('calendarPaySubmit').textContent,'Guardando…');
 await h.pay();assert.equal(h.env.moves.length,0);
 reader.result='data:application/pdf;base64,YQ==';reader.onload();await saving;assert.deepEqual(h.alerts,[]);assert.equal(h.env.moves.length,1);assert.equal(h.node('calendarPaySubmit').disabled,false);assert.equal(h.node('calendarPaySubmit').textContent,'Guardar pago');
 });


function setupSplitPayment(h,paid=[true,true]){
 h.api.setEditor('');h.node('calendarEditor').open=true;h.node('calSplit').checked=true;h.node('calAlreadyPaid').checked=paid[0];
 for(const [id,value]of Object.entries({calName:'Residuos',calAmount:'51.65',calDate:'2026-08-03',calRepeat:'once',calCategory:'Suministros',calProperty:'Ático'}))h.node(id).value=value;
 h.node('calSplitRows').querySelectorAll=()=>[{querySelector(selector){return {'[type=date]':{value:'2026-10-12'},'[type=number]':{value:'55.20'},'[type=file]':{files:[]},'[data-installment-name]':{value:'Segundo recibo'},'[data-installment-paid]':{checked:paid[1]}}[selector]}}];
}
test('both installments can be paid in one save with their exact dates and individual names',async()=>{
 const h=harness();setupSplitPayment(h);await h.api.savePlan({preventDefault(){}});
 assert.deepEqual(h.alerts,[]);assert.equal(h.env.moves.length,2);
 assert.deepEqual(Array.from(h.env.moves,m=>m.date),['2026-08-03','2026-10-12']);
 assert.deepEqual(Array.from(h.env.moves,m=>m.scheduledDate),['2026-08-03','2026-10-12']);
 assert.deepEqual(Array.from(h.env.moves,m=>m.amount),[51.65,55.2]);
 assert.equal(h.env.moves[1].desc,'Segundo recibo');
 const plans=JSON.parse(h.data.get('fiexea_scheduled_expenses'));
 assert.equal(M.calendarRows(plans,h.env.moves,2026).filter(r=>!r.move&&r.plan.id!=='p').length,0);
 assert.equal(M.taxGroups(h.env.moves,plans).length,1);
});
test('each installment has independent paid status',async()=>{
 const h=harness();setupSplitPayment(h,[false,true]);await h.api.savePlan({preventDefault(){}});
 assert.deepEqual(h.alerts,[]);assert.equal(h.env.moves.length,1);assert.equal(h.env.moves[0].date,'2026-10-12');
 const rows=M.calendarRows(JSON.parse(h.data.get('fiexea_scheduled_expenses')),h.env.moves,2026);
 assert.ok(rows.some(r=>!r.move&&r.due==='2026-08-03'));assert.ok(rows.some(r=>r.move&&r.due==='2026-10-12'));
});
test('future paid installment rejects the whole save without changing existing dates or payments',async()=>{
 const h=harness();setupSplitPayment(h);h.node('calDate').value='2027-08-03';const before=h.data.get('fiexea_scheduled_expenses');
 await h.api.savePlan({preventDefault(){}});assert.match(h.alerts[0],/fecha de hoy o anterior/);assert.equal(h.env.moves.length,0);assert.equal(h.data.get('fiexea_scheduled_expenses'),before);
});
test('editing a paid one-off expense keeps its single payment and uses the chosen date',async()=>{
 const h=harness();h.data.set('fiexea_scheduled_expenses',JSON.stringify([{id:'p',name:'IBI',repeat:'once',date:'2026-08-03',category:'Suministros'}]));
 h.env.moves=[{id:'paid',type:'expense',scheduledExpenseId:'p',scheduledDate:'2026-08-03',date:'2026-08-03',amount:100,receipt:{name:'original.pdf'}}];
 h.api.setEditor('p');h.node('calendarEditor').open=true;h.node('calAlreadyPaid').checked=true;
 for(const [id,value]of Object.entries({calName:'IBI corregido',calAmount:'133.60',calDate:'2026-09-14',calRepeat:'once',calCategory:'Suministros',calProperty:'Ático'}))h.node(id).value=value;
 await h.api.savePlan({preventDefault(){}});assert.deepEqual(h.alerts,[]);assert.equal(h.env.moves.length,1);assert.equal(h.env.moves[0].date,'2026-09-14');assert.equal(h.env.moves[0].receipt.name,'original.pdf');
 const plans=JSON.parse(h.data.get('fiexea_scheduled_expenses'));assert.equal(plans[0].date,'2026-09-14');assert.equal(M.calendarRows(plans,h.env.moves,2026).filter(r=>!r.move).length,0);
});


test('confirm payment starts with the selected due date instead of today',()=>{
 const h=harness();h.node('calendarPayForm').reset=()=>{};h.node('calendarPayment').showModal=()=>{};
 h.api.openPayment('p','2026-08-03');assert.equal(h.node('calPayDate').value,'2026-08-03');
});

test('deleting a paid installment directly removes only it and its one-off schedule',()=>{
 const h=harness();setupSplitPayment(h);
 h.data.set('fiexea_scheduled_expenses',JSON.stringify([{id:'a',name:'IBI 1/2',repeat:'once',date:'2026-08-03',taxGroupId:'ibi'},{id:'b',name:'IBI 2/2',repeat:'once',date:'2026-10-01',taxGroupId:'ibi'}]));
 h.env.moves=[{id:'ma',type:'expense',desc:'IBI 1/2',scheduledExpenseId:'a',scheduledDate:'2026-08-03',date:'2026-08-03',amount:100},{id:'mb',type:'expense',desc:'IBI 2/2',scheduledExpenseId:'b',scheduledDate:'2026-10-01',date:'2026-10-01',amount:110}];
 h.env.confirm=()=>true;assert.equal(h.api.deleteCalendarExpense('payment','ma'),true);
 assert.deepEqual(Array.from(h.env.moves,m=>m.id),['mb']);const plans=JSON.parse(h.data.get('fiexea_scheduled_expenses'));assert.deepEqual(plans.map(p=>p.id),['b']);
 assert.equal(M.calendarRows(plans,h.env.moves,2026).filter(r=>!r.move).length,0);
});
test('deleting a collapsed tax group removes its shown payments and leaves other groups intact',async()=>{
 const h=harness();setupSplitPayment(h);h.node('calTax').checked=true;await h.api.savePlan({preventDefault(){}});assert.deepEqual(h.alerts,[]);
 h.env.moves.push({id:'other',type:'expense',scheduledExpenseId:'p',date:'2026-10-01',scheduledDate:'2026-10-01',amount:100,taxReview:true});
 h.node('calendarOnlyReview').checked=true;let question='';h.env.confirm=m=>{question=m;return true};
 assert.equal(h.api.deleteCalendarExpense('group',h.env.moves[0].id),true);assert.match(question,/2 pagos/);assert.deepEqual(Array.from(h.env.moves,m=>m.id),['other']);
 assert.equal(JSON.parse(h.data.get('fiexea_scheduled_expenses')).length,1);
});
test('cancelling direct deletion changes neither expenses nor movements',()=>{
 const h=harness();h.env.confirm=()=>false;const before=h.data.get('fiexea_scheduled_expenses');
 assert.equal(h.api.deleteCalendarExpense('plan','p'),false);assert.equal(h.data.get('fiexea_scheduled_expenses'),before);assert.equal(h.env.moves.length,0);
});
test('deleting a pending schedule retains its paid history',()=>{
 const h=harness();h.env.confirm=()=>true;h.env.moves=[{id:'paid',scheduledExpenseId:'p',type:'expense',date:'2026-10-01',scheduledDate:'2026-10-01',amount:100}];
 assert.equal(h.api.deleteCalendarExpense('plan','p'),true);assert.equal(h.env.moves.length,1);assert.equal(JSON.parse(h.data.get('fiexea_scheduled_expenses')).length,0);
});
test('failed payment deletion restores both schedules and movements',()=>{
 const h=harness();h.env.confirm=()=>true;h.env.localStorage.removeItem=k=>h.data.delete(k);
 h.env.moves=[{id:'paid',scheduledExpenseId:'p',type:'expense',date:'2026-10-01',scheduledDate:'2026-10-01',amount:100}];h.data.set('fiexea_moves',JSON.stringify(h.env.moves));
 const plans=h.data.get('fiexea_scheduled_expenses'),payments=h.data.get('fiexea_moves');h.env.save=()=>{throw new Error('Failed saving')};
 assert.equal(h.api.deleteCalendarExpense('payment','paid'),false);assert.equal(h.data.get('fiexea_scheduled_expenses'),plans);assert.equal(h.data.get('fiexea_moves'),payments);assert.equal(h.env.moves.length,1);
});
test('direct deletion rejects a changed account',()=>{
 const h=harness();h.setup();h.env.financialActiveUserId='B';h.env.confirm=()=>{throw new Error('Should not confirm')};
 assert.equal(h.api.deleteCalendarExpense('plan','p'),false);assert.match(h.alerts[0],/cuenta ha cambiado/);
});

function openSavedExpense(h,m){
 h.node('calendarForm').reset=()=>{};h.node('calendarEditor').showModal=()=>{h.node('calendarEditor').open=true};
 h.env.categoryOptionsForType=()=>[{name:'Gym'},{name:'Seguros'}];
 h.api.openEditor(m.scheduledExpenseId,m.id);
}
test('paid expenses without a schedule show Edit expense and open their saved fields',()=>{
 const h=harness(),m={id:'gym',desc:'Iron gym',type:'expense',cat:'Gym',amount:290,date:'2026-10-01',scheduledDate:'2026-10-01',scheduledExpenseId:'missing',receipt:{name:'gym.pdf'}};h.env.moves=[m];
 const html=h.api.rowMarkup({move:m,due:m.scheduledDate,amount:m.amount});assert.match(html,/data-calendar-action="edit"[^>]*data-move-id="gym"[^>]*>Editar gasto/);
 openSavedExpense(h,m);assert.equal(h.node('calendarEditor').open,true);assert.equal(h.node('calName').value,'Iron gym');assert.equal(h.node('calAmount').value,290);assert.equal(h.node('calDate').value,'2026-10-01');assert.equal(h.node('calCategory').value,'Gym');assert.equal(h.node('calAlreadyPaid').checked,true);assert.match(h.node('calendarPlanReceiptNote').textContent,/gym.pdf/);
});
test('editing an orphan payment retains its receipt and changes no other payment with the old schedule ID',async()=>{
 const h=harness(),m={id:'gym',desc:'Iron gym',type:'expense',cat:'Gym',amount:290,date:'2026-10-01',scheduledDate:'2026-10-01',scheduledExpenseId:'missing',taxReview:true,receipt:{name:'gym.pdf'}};
 const other={...m,id:'past',date:'2026-09-01',scheduledDate:'2026-09-01',amount:200};h.env.moves=[m,other];openSavedExpense(h,m);
 h.node('calName').value='Gym actualizado';h.node('calAmount').value='295';h.node('calDate').value='2026-10-02';await h.api.savePlan({preventDefault(){}});
 assert.deepEqual(h.alerts,[]);assert.equal(h.env.moves.length,2);assert.equal(h.env.moves[0].id,'gym');assert.equal(h.env.moves[0].amount,295);assert.equal(h.env.moves[0].date,'2026-10-02');assert.equal(h.env.moves[0].receipt.name,'gym.pdf');assert.equal(h.env.moves[1],other);
 const plans=JSON.parse(h.data.get('fiexea_scheduled_expenses'));assert.ok(plans.some(p=>p.id===h.env.moves[0].scheduledExpenseId&&p.receipt.name==='gym.pdf'));assert.equal(M.calendarRows(plans,h.env.moves,2026).filter(r=>!r.move&&r.plan.id!=='p').length,0);
});
test('opening an orphan expense editor does not create or write a schedule',()=>{
 const h=harness(),m={id:'gym',type:'expense',desc:'Gym',cat:'Gym',amount:290,date:'2026-10-01',scheduledDate:'2026-10-01',scheduledExpenseId:'missing'};h.env.moves=[m];const before=h.data.get('fiexea_scheduled_expenses');openSavedExpense(h,m);assert.equal(h.data.get('fiexea_scheduled_expenses'),before);assert.equal(h.env.moves[0],m);
});

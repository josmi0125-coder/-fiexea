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
function harness(){
 const nodes={},data=new Map(),alerts=[];
 const node=id=>nodes[id]||(nodes[id]={value:'',checked:false,files:[],disabled:false,close(){}});
 const env={window:{FiexeaCalendarMath:M},localStorage:{getItem:k=>data.get(k)??null,setItem(k,v){data.set(k,String(v))}},document:{getElementById:id=>id==='t11'?null:node(id)},financialAppReady:true,financialActiveUserId:'A',moves:[],accounts:[],queueFinancialSync(){},save(){data.set('fiexea_moves',JSON.stringify(env.moves))},render(){},showSaveToast(){},alert:m=>alerts.push(m),localMoveDate:()=> '2026-10-20',esc:String,eur:String,uid:()=> 'new-'+env.moves.length};
 const source=fs.readFileSync(require.resolve('../expense-calendar.js'),'utf8').replace(/if\(document\.readyState==='loading'\)[^\n]+/,"window.__calendarTest={confirmPayment,setPayment(p){payment=p;sessionOwner=p.owner}};");
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
 h.setup();h.env.localStorage.setItem=()=>{throw Error('QuotaExceeded')};await h.pay();assert.equal(h.env.moves.length,0);assert.equal(h.alerts.pop(),'QuotaExceeded');
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

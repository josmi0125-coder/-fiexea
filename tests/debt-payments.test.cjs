const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync('app.html','utf8');
function harness(overrides={}){
 const nodes=new Map(),node=id=>{if(!nodes.has(id)){let value='';nodes.set(id,{get value(){return value},set value(v){value=String(v)},dataset:{},hidden:false,innerHTML:'',textContent:'',focus(){},scrollIntoView(){}})}return nodes.get(id)};
 const debt={id:'credit',entity:'REVOLUT',name:'Crédito',type:'tarjetas',installmentType:'revolving',balance:2995.20,payment:74.88,collectionDay:'last',installmentTrackingStartPeriod:'2026-10',payments:[],...overrides},alerts=[];
 const ctx={document:{getElementById:node},window:{},debts:[debt],moves:[],editingDebtPayment:null,budgetCategories:[],activeMovementCategories:[],normalizeBudgetCategory:s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),moveCategoryFor:move=>move.cat||'',eur:n=>Number(n).toFixed(2)+' €',esc:String,escAttr:String,localMoveDate:()=> '2026-10-31',alert:s=>alerts.push(s),confirm:()=>true,uid:(()=>{let i=0;return()=>String(++i)})(),render(){},save(){},showSaveToast(){}};
 vm.createContext(ctx);vm.runInContext(html.slice(html.indexOf('function debtTranslate('),html.indexOf('\nfunction ',html.indexOf('function deleteDebtPayment('))),ctx);
 for(const [id,value]of Object.entries({dpKind:'installment',dpDate:'2026-10-31',dpTotal:'74.88',dpOtherCharges:'0',dpMovement:'__new__'}))node(id).value=value;
 ctx.editingDebtPayment={debtId:debt.id,periodId:'2026-10',dueDate:'2026-10-31'};return{ctx,node,debt,alerts};
}
test('revolving amount is visible and prefilled',()=>{const h=harness();assert.match(h.ctx.debtExpectedPaymentLabel(h.debt),/74.88/);assert.equal(h.ctx.debtOccurrences(h.debt,new Date('2026-10-31T12:00:00'))[0].amount,74.88);h.ctx.openDebtPaymentForm('credit','','2026-10','2026-10-31','installment');assert.equal(h.node('dpTotal').value,'74.88');assert.equal(h.node('dpPrincipal').value,'')});
test('payment without breakdown records one expense, then editing applies principal once',()=>{
 const h=harness();h.ctx.saveDebtPayment();assert.deepEqual(h.alerts,[]);assert.equal(h.debt.balance,2995.20);assert.equal(h.debt.payments[0].principal,null);assert.equal(h.debt.payments[0].breakdownPending,true);assert.equal(h.ctx.moves.length,1);assert.equal(h.ctx.moves[0].amount,74.88);assert.equal(h.ctx.debtPeriodIsPaid(h.debt,'2026-10'),true);assert.match(h.ctx.renderDebtPaymentHistory(h.debt),/Desglose pendiente/);
 const payment=h.debt.payments[0];h.ctx.editingDebtPayment={debtId:'credit',paymentId:payment.id,periodId:'2026-10',dueDate:'2026-10-31'};
 for(const [id,value]of Object.entries({dpDate:'2026-10-31',dpTotal:'74.88',dpPrincipal:'24.96',dpInterest:'49.92',dpOtherCharges:'0',dpKind:'installment',dpMovement:payment.moveId}))h.node(id).value=value;
 h.ctx.saveDebtPayment();assert.deepEqual(h.alerts,[]);assert.equal(h.debt.balance,2970.24);assert.equal(h.debt.payments.length,1);assert.equal(h.ctx.moves.length,1);assert.equal(h.debt.payments[0].breakdownPending,false);h.ctx.deleteDebtPayment('credit',payment.id);assert.equal(h.debt.balance,2995.20);assert.equal(h.ctx.moves.length,0);
});
test('invalid dates, partial breakdowns, mismatched totals and duplicate periods remain blocked',()=>{
 for(const setup of [h=>h.node('dpDate').value='2026-02-30',h=>h.node('dpPrincipal').value='10',h=>{h.node('dpPrincipal').value='10';h.node('dpInterest').value='5'},h=>h.node('dpOtherCharges').value='100',h=>h.node('dpInterest').value='invalid',h=>h.debt.payments.push({id:'old',periodId:'2026-10'})]){const h=harness();setup(h);const count=h.debt.payments.length;h.ctx.saveDebtPayment();assert.equal(h.alerts.length,1);assert.equal(h.ctx.moves.length,0);assert.equal(h.debt.payments.length,count);assert.equal(h.debt.balance,2995.20)}
});
test('matching expense is linked without duplication',()=>{const h=harness();h.ctx.moves.push({id:'expense',type:'expense',cat:'Préstamos',date:'2026-10-31',amount:74.88});h.ctx.saveDebtPayment();assert.equal(h.ctx.moves.length,1);assert.equal(h.debt.payments.length,0);h.node('dpMovement').value='expense';h.ctx.saveDebtPayment();assert.equal(h.ctx.moves.length,1);assert.equal(h.debt.payments[0].moveId,'expense')});
test('missing amount stays unknown',()=>{const h=harness({payment:0});assert.equal(h.ctx.debtExpectedPayment(h.debt),null);assert.equal(h.ctx.debtExpectedPaymentLabel(h.debt),'Importe por confirmar')});

test('all loans and credit payments use Prestamos, mortgage stays separate',()=>{
 for(const type of ['consumo','tarjetas','otro','hipoteca']){const h=harness({type});h.ctx.saveDebtPayment();assert.deepEqual(h.alerts,[]);assert.equal(h.ctx.moves[0].cat,type==='hipoteca'?'Hipoteca':'Préstamos')}
});
test('category picker includes other dates and amounts and preserves the selected expense',()=>{
 const h=harness();h.ctx.moves.push({id:'loan',type:'expense',cat:'Préstamos',date:'2026-10-29',amount:101.92,desc:'Cetelem recibo'}, {id:'mortgage',type:'expense',cat:'Hipoteca',date:'2026-10-31',amount:74.88}, {id:'used',type:'expense',cat:'Préstamos',debtPaymentId:'other',amount:99});
 assert.equal(h.ctx.debtPaymentMovementCandidates(h.debt).length,2);h.node('dpMovement').value='loan';h.ctx.selectDebtPaymentMovement();assert.equal(h.node('dpDate').value,'2026-10-29');assert.equal(h.node('dpTotal').value,'101.92');h.ctx.saveDebtPayment();assert.deepEqual(h.alerts,[]);assert.equal(h.ctx.moves.length,3);assert.equal(h.debt.payments[0].moveId,'loan');assert.equal(h.ctx.moves[0].desc,'Cetelem recibo');assert.equal(h.ctx.moves[0].date,'2026-10-29');assert.equal(h.ctx.moves[0].amount,101.92);
});
test('linking preserves any user category including a custom category',()=>{const h=harness();h.ctx.moves.push({id:'custom',type:'expense',cat:'Financiación familiar',categoryId:'family',date:'2026-10-31',amount:74.88});h.node('dpMovement').value='custom';h.ctx.saveDebtPayment();assert.deepEqual(h.alerts,[]);assert.equal(h.debt.payments.length,1);assert.equal(h.ctx.moves[0].cat,'Financiación familiar');assert.equal(h.ctx.moves[0].categoryId,'family')});
test('separate payments can link separate expenses in the same category',()=>{
 const h=harness();h.ctx.moves.push({id:'first',type:'expense',cat:'Préstamos',date:'2026-10-31',amount:74.88},{id:'second',type:'expense',cat:'Préstamos',date:'2026-11-30',amount:74.88});h.node('dpMovement').value='first';h.ctx.saveDebtPayment();
 assert.equal(h.ctx.debtPaymentMovementCandidates(h.debt).length,1);assert.equal(h.ctx.debtPaymentMovementCandidates(h.debt)[0].id,'second');
 h.ctx.editingDebtPayment={debtId:'credit',periodId:'2026-11',dueDate:'2026-11-30'};h.node('dpKind').value='installment';h.node('dpOtherCharges').value='0';h.node('dpMovement').value='second';h.ctx.selectDebtPaymentMovement();h.ctx.saveDebtPayment();assert.deepEqual(h.alerts,[]);assert.equal(h.debt.payments.length,2);assert.equal(h.ctx.moves.length,2);assert.equal(h.ctx.moves[0].cat,'Préstamos');assert.equal(h.ctx.moves[1].cat,'Préstamos');
});
test('new payment can use a user selected category',()=>{const h=harness();h.ctx.budgetCategories.push({id:'custom',type:'expense',name:'Financiación'});h.node('dpNewCategory').value='Financiación';h.ctx.saveDebtPayment();assert.deepEqual(h.alerts,[]);assert.equal(h.ctx.moves[0].cat,'Financiación');assert.equal(h.ctx.moves[0].categoryId,'custom')});

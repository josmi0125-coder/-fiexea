const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('../receipt-scan-math.js');
test('extracts receipt total rather than VAT, tendered cash, subtotal or change',()=>{
 const result=M.parse('MERCADONA\nCIF A12345678\n23/10/2026 12:30\nSUBTOTAL 40,00\nTOTAL IVA 2,80\nTOTAL A PAGAR 42,80 EUR\nEFECTIVO 50,00\nCAMBIO 7,20');
 assert.equal(result.name,'MERCADONA');assert.equal(result.amount,42.8);assert.equal(result.date,'2026-10-23');assert.equal(result.category,'Alimentación');
});
test('ambiguous or missing totals and impossible dates remain empty for review',()=>{
 assert.equal(M.parse('Tienda\nTOTAL 20,00\nTOTAL 30,00').amount,null);
 assert.equal(M.parse('Tienda\nSubtotal 20,00\n31/02/2026').amount,null);
 assert.equal(M.parse('Tienda\n31/02/2026').date,'');assert.equal(M.parse('TIENDA\n2026-10-23\nTOTAL\n1.234,56').amount,1234.56);assert.equal(M.parse('TIENDA\n2026-10-23').date,'2026-10-23');
 assert.ok(M.parse('Shop\nTOTAL $ 10.50').warnings.some(s=>s.includes('moneda')));
});
test('duplicate detection includes equal amount and date without hiding different merchant names',()=>{
 assert.deepEqual(M.duplicates([{id:'1',type:'expense',amount:42.8,date:'2026-10-23',desc:'Shop'},{id:'2',type:'income',amount:42.8,date:'2026-10-23'}],{amount:42.8,date:'2026-10-23',name:'Other'}).map(x=>x.id),['1']);
});
const source=fs.readFileSync('receipt-scanner.js','utf8');
function setup({paid=true,existing=false}={}){
 const store=new Map(),nodes=new Map();let nextId=0;const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',checked:false,disabled:false});return nodes.get(id)};
 for(const[k,v]of Object.entries({receiptScanName:'Mercadona',receiptScanAmount:'42.80',receiptScanDate:'2026-10-23',receiptScanCategory:'food',receiptScanExisting:existing?'old':''}))node(k).value=v;node('receiptScanPaid').checked=paid;
 const d={owner:'user',receipt:{name:'scan.jpg',type:'image/jpeg',data:'data:image/jpeg;base64,AA=='}};
 const ctx={M,$:node,moves:existing?[{id:'old',type:'expense',desc:'Original',amount:42.8,date:'2026-10-23',cat:'Alimentación',accountId:'bank'}]:[],draft:d,owner:()=> 'user',allowed:()=>true,assertDraft(x){if(x!==ctx.draft||ctx.owner()!==x.owner)throw new Error('Cuenta cambiada')},values:()=>({name:node('receiptScanName').value,amount:Number(node('receiptScanAmount').value),date:node('receiptScanDate').value}),categories:()=>[{id:'food',name:'Alimentación'}],busy:false,status:s=>{ctx.message=s},financialActiveUserId:'user',window:{fiexeaReceiptStorage:{storeInline:async()=>({path:'user/file',owner:'user',bucket:'expense-receipts',name:'scan.jpg',type:'image/jpeg'})}},localStorage:{getItem:k=>store.get(k)??null,setItem(k,v){store.set(k,v)},removeItem:k=>store.delete(k)},localMoveDate:()=> '2026-10-23',uid:()=> 'new'+(++nextId),save(){},queueFinancialSync(){},render(){},close(){ctx.closed=true},showSaveToast(){},JSON,Number,Error};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function saveScan('),source.indexOf('function init(){')),ctx);return{ctx,store,node,run:()=>ctx.saveScan({preventDefault(){}})};
}
test('confirmed paid scan creates exactly one linked movement and receipt; second submission cannot duplicate silently',async()=>{
 const h=setup();await h.run();assert.equal(h.ctx.moves.length,1);assert.equal(h.ctx.moves[0].amount,42.8);assert.equal(h.ctx.moves[0].receipt.path,'user/file');assert.equal(JSON.parse(h.store.get('fiexea_scheduled_expenses')).length,1);await h.run();assert.equal(h.ctx.moves.length,1);assert.match(h.ctx.message,/duplicado/);
});
test('pending invoice creates a calendar expense without changing paid movements',async()=>{
 const h=setup({paid:false});await h.run();assert.equal(h.ctx.moves.length,0);const plans=JSON.parse(h.store.get('fiexea_scheduled_expenses'));assert.equal(plans.length,1);assert.equal(plans[0].receipt.name,'scan.jpg');
});
test('linking a receipt preserves existing movement values and account without another expense',async()=>{
 const h=setup({existing:true});await h.run();assert.equal(h.ctx.moves.length,1);assert.equal(h.ctx.moves[0].desc,'Original');assert.equal(h.ctx.moves[0].accountId,'bank');assert.ok(h.ctx.moves[0].scheduledExpenseId);assert.equal(JSON.parse(h.store.get('fiexea_scheduled_expenses')).length,1);
});
test('account change during receipt upload prevents any financial write',async()=>{
 const h=setup();h.ctx.window.fiexeaReceiptStorage.storeInline=async()=>{h.ctx.owner=()=> 'another';return{path:'user/file'}};await h.run();assert.equal(h.ctx.moves.length,0);assert.equal(h.store.size,0);assert.match(h.ctx.message,/Cuenta/);
});
test('storage error rolls back movements and pending plans and allows retry',async()=>{
 const h=setup();let failed=false;const set=h.ctx.localStorage.setItem;h.ctx.localStorage.setItem=(k,v)=>{if(k==='fiexea_scheduled_expenses'&&!failed){failed=true;throw new Error('Quota exceeded')}set(k,v)};await h.run();assert.equal(h.ctx.moves.length,0);assert.equal(h.store.size,0);assert.match(h.ctx.message,/No queda espacio/);assert.equal(h.node('receiptScanSave').disabled,false);
});

const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync('app.html','utf8');
test('unchanged data does not rewrite storage or restart cloud synchronization',()=>{
 const data=new Map(),writes=[];let syncs=0;const ctx={moves:[{id:'a',amount:10}],debts:[],goals:[],assets:[],accounts:[],budget:0,localStorage:{getItem:k=>data.get(k)??null,setItem(k,v){writes.push(k);data.set(k,v)}},queueFinancialSync(){syncs++}};
 vm.createContext(ctx);vm.runInContext(html.split('\n').find(l=>l.startsWith('function save(){')),ctx);
 ctx.save();assert.equal(writes.length,6);assert.equal(syncs,1);writes.length=0;ctx.save();ctx.save();assert.equal(writes.length,0);assert.equal(syncs,1);
 ctx.moves[0].amount=20;ctx.save();assert.deepEqual(writes,['fiexea_moves']);assert.equal(syncs,2);assert.equal(JSON.parse(data.get('fiexea_moves'))[0].amount,20);
 ctx.moves[0].amount=30;data.set('fiexea_moves',JSON.stringify(ctx.moves));writes.length=0;ctx.save();assert.equal(writes.length,0);assert.equal(syncs,3,'Payments already persisted before save still synchronize');
});
test('navigation renders the selected section while keeping home summaries current',()=>{
 let active='t0';const calls=[],nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:'',className:'',style:{setProperty(){}}});return nodes.get(id)};
 const ctx={window:{fiexeaRenderCalendar(){}},document:{querySelector:selector=>selector==='.tab.active'?{id:active}:node(selector),getElementById:node},moves:[],debts:[],assets:[],goals:[],budget:0,save(){},totals:()=>({inc:100,exp:0}),eur:String,pct:String,financialScore:()=>80,esc:String,Date};
 for(const name of ['mIncomeLabel','mExpenseLabel','mSaveLabel','mIncome','mExpense','mSave','mAnnualSave','assetsTotal','liabTotal','nw2','liquid','debtPay','debtRatio','score','scoreCircle','scoreText','budgetText','budgetBar','budgetHint','homeGoals','homeDebt'])ctx[name]=node(name);
 for(const name of ['renderAccounts','renderMoveAccountChoices','renderBudget','renderFinancialAnalysis','renderMoves','renderDebts','renderGoals','renderAssets','renderWealthHistory','renderStats','applyPrivacy'])ctx[name]=()=>calls.push(name);
 vm.createContext(ctx);vm.runInContext(html.slice(html.indexOf('function render(){'),html.indexOf('function goalIcon(')),ctx);
 const expected={t0:[],t1:['renderMoveAccountChoices','renderBudget','renderMoves'],t2:['renderDebts'],t3:['renderGoals'],t4:['renderAssets'],t5:['renderFinancialAnalysis','renderStats'],t7:['renderAccounts']};
 for(const [id,sections]of Object.entries(expected)){active=id;calls.length=0;ctx.render();assert.deepEqual(calls.filter(n=>!['renderWealthHistory','applyPrivacy'].includes(n)),sections,id);assert.equal(node('net').textContent,'0');assert.ok(calls.includes('renderWealthHistory'));}
});
test('all cryptocurrency symbols retain an existing, individually loadable icon',()=>{
 const ctx={window:{}};vm.runInNewContext(fs.readFileSync('crypto-icons.js','utf8'),ctx);const catalog=ctx.window.FIEXEA_CRYPTO;assert.ok(catalog.coins.length>400);assert.ok(Object.keys(catalog.icons).length>400);
 for(const path of Object.values(catalog.icons)){assert.match(path,/^assets\/crypto\/[a-f0-9]+\.svg$/);assert.match(fs.readFileSync(path,'utf8'),/<svg\b/)}
 assert.ok(fs.statSync('crypto-icons.js').size<60000);
});
test('calendar lookup work grows with paid movements instead of repeating a full scan for every charge',()=>{
 const M=require('../expense-calendar-math.js');let reads=0;const plans=Array.from({length:200},(_,i)=>({id:'p'+i,date:'2026-01-01',repeat:'monthly',amount:10}));
 const entries=plans.flatMap(p=>Array.from({length:12},(_,i)=>({id:p.id+'-'+i,type:'expense',get scheduledExpenseId(){reads++;return p.id},scheduledDate:'2026-'+String(i+1).padStart(2,'0')+'-01',date:'2026-'+String(i+1).padStart(2,'0')+'-01',amount:10})));
 const rows=M.calendarRows(plans,entries,2026);assert.equal(rows.length,2400);assert.ok(rows.every(r=>r.move));assert.ok(reads<20000,'Avoid scanning thousands of movements for every occurrence');
});

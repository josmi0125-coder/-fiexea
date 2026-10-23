const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../guided-tours.js'),'utf8'),translations=fs.readFileSync(require.resolve('../guided-tours-i18n.js'),'utf8');
function harness(){
 const nodes=new Map(),storage=new Map(),timers=new Set(),events={},writes=[],navigations=[];
 class Node{
  constructor(tag='div'){this.tagName=tag;this.children=[];this.attrs={};this.listeners={};this.isConnected=true;this.visible=true;this.open=false;this.classList={add(){},remove(){},toggle(){}};this.style={};this.offsetWidth=350}
  setAttribute(k,v){this.attrs[k]=v}getAttribute(k){return this.attrs[k]??null}
  addEventListener(k,fn){this.listeners[k]=fn}appendChild(n){this.children.push(n);return n}replaceChildren(){this.children=[]}
  closest(s){return s==='dialog[open]'?this.modal||null:null}getClientRects(){return this.visible?[{}]:[]}getBoundingClientRect(){return{top:100,bottom:140,left:20,height:180}}
  remove(){this.isConnected=false}focus(){}scrollIntoView(){}showModal(){this.open=true}close(){this.open=false;this.listeners.close?.()}
  contains(n){return n===this||this.children.some(c=>c===n||c.contains(n))}
  querySelector(selector){return this.children.find(n=>selector==='.'+n.className)||null}
  click(){this.listeners.click?.()}
 }
 const body=new Node('body'),doc={readyState:'complete',body,activeElement:null,documentElement:{dataset:{fiexeaAccess:'allowed'}},createElement:t=>new Node(t),getElementById:id=>nodes.get('#'+id)||null,querySelector:s=>s==='.tab.active'?{id:'t'+ctx.currentTab}:s==='dialog[open]'?body.children.find(n=>n.tagName==='dialog'&&n.open):nodes.get(s)||null,querySelectorAll:s=>nodes.has(s)?[nodes.get(s)]:[],addEventListener:(s,fn)=>events[s]=fn};
 const ctx={document:doc,window:{addEventListener(){},tab:n=>{ctx.currentTab=n;navigations.push(n)},closeHelpCenter(){},openExpenseCalendar(){ctx.currentTab=11}},financialActiveUserId:'A',financialAppReady:true,currentTab:1,localStorage:{getItem:k=>storage.get(k)||null,setItem(k,v){storage.set(k,v);writes.push(k)}},setInterval(fn){timers.add(fn);return fn},clearInterval:fn=>timers.delete(fn),requestAnimationFrame:fn=>fn(),innerWidth:390,innerHeight:844,console};
 vm.createContext(ctx);vm.runInContext(source,ctx);const api=ctx.window.FiexeaTours;
 function add(selector){const n=new Node();nodes.set(selector,n);return n}
 function coach(){return body.children.findLast(n=>n.className==='tour-coach'&&n.isConnected)}
 function click(label){const c=coach(),actions=c.children.find(n=>n.className==='tour-actions');const b=actions.children.find(n=>n.textContent===label);assert.ok(b,label);b.click()}
 return{ctx,api,add,Node,nodes,storage,writes,navigations,timers,events,body,coach,click,tick(){[...timers].forEach(fn=>fn())}};
}
test('all promised guides exist and every step has an instruction and target',()=>{
 const h=harness();assert.deepEqual(Object.keys(h.api.catalog),['home','analysis','more','accounts','settings','investment','category','expense','income','debt','asset','goal','calendar','budget']);
 for(const guide of Object.values(h.api.catalog)){assert.ok(guide.steps.length>=3);for(const s of guide.steps){assert.ok(s.target);assert.ok(s.text)}}
});
test('next waits for the real control, back works and skip clears the highlight and timer',()=>{
 const h=harness();h.add('#openMoveEditor');h.api.start('category');assert.deepEqual(h.navigations,[1]);assert.ok(h.coach());
 h.click('Siguiente');assert.match(h.coach().querySelector('.tour-hint').textContent,/Primero realiza/);
 h.add('.category-manager-tabs');h.click('Siguiente');assert.match(h.coach().children[0].textContent,/^2 \/ 7/);
 h.click('Atrás');assert.match(h.coach().children[0].textContent,/^1 \/ 7/);
 h.click('Saltar guía');assert.equal(h.coach(),undefined);assert.equal(h.timers.size,1);
 assert.equal(JSON.parse(h.storage.get('fiexea_guides_v1_A')).category,'skipped');
 assert.ok(h.writes.every(k=>k.startsWith('fiexea_guides_v1_')));
});
test('income guide requires the income tab to be selected',()=>{
 const h=harness();h.add('#openMoveEditor');const tab=h.add('#categoryManagerIncomeTab');tab.setAttribute('aria-selected','false');h.add('#categoryManagerList');
 h.api.start('income');h.click('Siguiente');h.click('Siguiente');assert.match(h.coach().children[0].textContent,/^2 \/ 7/);
 tab.setAttribute('aria-selected','true');h.click('Siguiente');assert.match(h.coach().children[0].textContent,/^3 \/ 7/);
});
test('finishing a guide never submits its form or clicks save',()=>{
 const h=harness();const steps=h.api.catalog.asset.steps;let saves=0;for(const s of steps)h.add(s.target);h.nodes.get('#assetSaveButton').addEventListener('click',()=>saves++);
 h.api.start('asset');for(let i=1;i<steps.length;i++)h.click('Siguiente');h.click('Terminar guía');
 assert.equal(saves,0);assert.equal(JSON.parse(h.storage.get('fiexea_guides_v1_A')).asset,'completed');
});
test('native-dialog steps keep the coach inside that dialog',()=>{
 const h=harness(),modal=new h.Node('dialog');modal.open=true;const target=h.add('#calName');target.modal=modal;
 h.api.start('calendar');assert.ok(modal.children.some(n=>n.className==='tour-coach'));
});
test('opening the calendar dialog advances away from the now-inert page button',()=>{
 const h=harness();h.add('#calendarAdd');h.api.start('calendar');const modal=new h.Node('dialog');modal.open=true;h.body.appendChild(modal);
 const field=h.add('#calName');field.modal=modal;modal.appendChild(field);h.tick();assert.ok(modal.children.some(n=>n.className==='tour-coach'));
});
test('switching accounts stops the guide without writing its state to the new account',()=>{
 const h=harness();h.add('#openMoveEditor');h.api.start('category');h.ctx.financialActiveUserId='B';h.ctx.financialAppReady=false;h.tick();
 assert.equal(h.coach(),undefined);assert.equal(h.storage.has('fiexea_guides_v1_B'),false);
});
test('welcome is optional, dismissed once and available again from Help',()=>{
 const h=harness();h.tick();const welcome=h.body.children.find(n=>n.tagName==='dialog'&&n.open);assert.ok(welcome);welcome.close();h.tick();
 assert.equal(h.body.children.filter(n=>n.tagName==='dialog'&&n.open).length,0);
 h.api.open();const chooser=h.body.children.findLast(n=>n.tagName==='dialog'&&n.open);assert.ok(chooser);assert.equal(chooser.children.find(n=>n.className==='tour-list').children.length,14);
});
test('all tour titles and instructions translate into all four supported non-Spanish languages',()=>{
 const h=harness(),select=h.add('#languageSettingsSelect');vm.runInContext(translations,h.ctx);
 const strings=['Guías paso a paso','Siguiente','Atrás','Saltar guía','Terminar guía',...Object.values(h.api.catalog).flatMap(t=>[t.title,...t.steps.map(s=>s.text)])];
 for(const lang of ['en','fr','it','pt']){select.value=lang;for(const s of strings)assert.notEqual(h.ctx.window.fiexeaTourTranslate(s),s,lang+': '+s)}
});
test('storage errors do not prevent use of the guides or translation',()=>{
 const h=harness();h.ctx.localStorage.getItem=()=>{throw Error('blocked')};h.ctx.localStorage.setItem=()=>{throw Error('blocked')};h.add('#openMoveEditor');
 vm.runInContext(translations,h.ctx);assert.equal(h.ctx.window.fiexeaTourTranslate('Siguiente'),'Siguiente');h.api.start('category');assert.ok(h.coach());h.api.stop();
});

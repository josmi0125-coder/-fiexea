const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('access.js','utf8');
async function run(state, { session = true, fail = false, remaining = 7200000, invitations = null, recovery = false, storage = new Map() } = {}) {
  const elements = new Map();
  function element(id) {
    if(!elements.has(id)) elements.set(id,{hidden:true,disabled:false,textContent:'',value:'',checked:false,style:{},classList:{contains(){return false}},setAttribute(){},insertAdjacentElement(){},appendChild(){},addEventListener(name,fn){this[name]=fn},reset(){}});
    return elements.get(id);
  }
  let monotonic = 0;
  const intervals=[];
  const context = {localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},console, Promise, Date, Math, Number, URLSearchParams,location:{search:''}, setTimeout(){return 1;},clearTimeout(){},setInterval(fn){intervals.push(fn);return 1;},clearInterval(){},performance:{now:()=>monotonic},document:{createElement:()=>element('created'),getElementById:element,documentElement:{dataset:{}},addEventListener(){},visibilityState:'visible'},window:{addEventListener(){},FiexeaInvitations:invitations},FIEXEA_SUPABASE_URL:'https://example.invalid',fiexeaAuthGate:element('auth'),fiexeaShowGate(show){element('auth').hidden=!show},fiexeaShowView(view){context.authView=view},fiexeaIsRecoveryUrl:()=>recovery,openPremiumModal(){context.premiumOpens=(context.premiumOpens||0)+1},fetch:async()=>({ok:true,json:async()=>({billing_available:false})}),fiexeaSupabase:{auth:{getSession:async()=>({data:{session:session?{user:{id:'example-user'}}:null},error:null}),onAuthStateChange(){}},rpc:async()=>({data:{state,allowed:['existing','trial','paid','invitation'].includes(state),server_now:'2026-10-17T00:00:00Z',invitation_ends_at:new Date(Date.parse('2026-10-17T00:00:00Z')+remaining).toISOString(),trial_ends_at:new Date(Date.parse('2026-10-17T00:00:00Z')+remaining).toISOString()},error:fail?new Error('offline'):null})}};
  vm.runInNewContext(source,context);
  await new Promise(resolve=>setImmediate(resolve));
  return {context,element,intervals,advance:value=>monotonic=value};
}
test('existing and paid accounts are admitted only after server confirmation',async()=>{for(const state of ['existing','paid']){const x=await run(state);assert.equal(x.context.document.documentElement.dataset.fiexeaAccess,'allowed');assert.equal(x.element('fiexeaAccessGate').hidden,true);}});
test('expired account stays blocked while free registration remains available',async()=>{const x=await run('expired');assert.equal(x.context.document.documentElement.dataset.fiexeaAccess,'blocked');assert.match(x.element('fiexeaAccessTitle').textContent,/terminado/);assert.equal(x.element('fiexeaOpenSignup').disabled,false);});
test('trial expires using monotonic time without trusting the device clock',async()=>{const x=await run('trial',{remaining:1000});assert.equal(x.element('fiexeaTrialBanner').hidden,false);x.advance(1100);x.intervals[0]();assert.equal(x.context.document.documentElement.dataset.fiexeaAccess,'blocked');});
test('server failure never grants access',async()=>{const x=await run('paid',{fail:true});assert.equal(x.context.document.documentElement.dataset.fiexeaAccess,'blocked');assert.match(x.element('fiexeaAccessTitle').textContent,/No se pudo/);});
test('signed-out account stays at login with free registration available in test mode',async()=>{const x=await run('trial',{session:false});assert.equal(x.context.document.documentElement.dataset.fiexeaAccess,'signedout');assert.equal(x.element('fiexeaAccessGate').hidden,true);assert.equal(x.element('fiexeaOpenSignup').disabled,false);});

test('invitation access expires on the server deadline and hides payment button',async()=>{const x=await run('invitation',{remaining:1000});assert.equal(x.context.document.documentElement.dataset.fiexeaAccess,'allowed');assert.equal(x.element('fiexeaTrialPlans').hidden,true);assert.match(x.element('fiexeaTrialRemaining').textContent,/Invitación activa/);x.advance(1100);x.intervals[0]();assert.equal(x.context.document.documentElement.dataset.fiexeaAccess,'blocked');assert.equal(x.element('fiexeaAccessPlans').hidden,true);});
test('revoked invitation blocks access with an invitation-specific message',async()=>{const x=await run('invitation_expired');assert.equal(x.context.document.documentElement.dataset.fiexeaAccess,'blocked');assert.match(x.element('fiexeaAccessTitle').textContent,/invitación/);assert.equal(x.element('fiexeaAccessPlans').hidden,true);});
test('pending invitation permits registration without active billing',async()=>{const x=await run('trial',{session:false,invitations:{pending:true}});assert.equal(x.element('fiexeaOpenSignup').disabled,false);});
test('invalid invitation never falls back to a free trial',async()=>{const x=await run('trial',{invitations:{pending:true,redeem:async()=>{throw new Error('Invitación no válida')}}});assert.equal(x.context.document.documentElement.dataset.fiexeaAccess,'blocked');assert.match(x.element('fiexeaAccessMessage').textContent,/Invitación no válida/);});


test("access checks cannot hide password recovery behind a trial or paid screen",async()=>{for(const state of ["paid","expired"]){const x=await run(state,{recovery:true});assert.notEqual(x.context.document.documentElement.dataset.fiexeaAccess,"allowed");assert.equal(x.element("fiexeaAccessGate").hidden,true);}});

 test('guest starts without an auth request and resumes the same deadline',async()=>{
 const storage=new Map(); const x=await run('trial',{session:false,storage});
 await x.element('fiexeaWelcomeTrial').click();
 assert.equal(x.context.document.documentElement.dataset.fiexeaAccess,'allowed');
 const started=JSON.parse(storage.get('fiexea_guest_trial_v1')).started;
 const y=await run('trial',{session:false,storage});
 assert.equal(y.context.document.documentElement.dataset.fiexeaAccess,'allowed');
 assert.equal(JSON.parse(storage.get('fiexea_guest_trial_v1')).started,started);
 });
 test('expired guest cannot restart the seven day trial',async()=>{
 const storage=new Map([['fiexea_guest_trial_v1',JSON.stringify({started:Date.now()-169*3600000,lastSeen:Date.now()})],['fiexea_guest_active','1']]);
 const x=await run('trial',{session:false,storage});
 assert.equal(x.context.document.documentElement.dataset.fiexeaAccess,'blocked');
 await x.element('fiexeaWelcomeTrial').click();
 assert.equal(x.context.document.documentElement.dataset.fiexeaAccess,'blocked');
 });
 test('guest expiry and recovery preserve the auth boundary',async()=>{
 const storage=new Map([['fiexea_guest_trial_v1',JSON.stringify({started:Date.now(),lastSeen:Date.now()})],['fiexea_guest_active','1']]);
 const x=await run('trial',{session:false,storage}); x.advance(169*3600000);x.intervals[0]();
 assert.equal(x.context.document.documentElement.dataset.fiexeaAccess,'blocked');
 const y=await run('trial',{session:false,storage,recovery:true});
 assert.notEqual(y.context.document.documentElement.dataset.fiexeaAccess,'allowed');
 });

test('guest remains active after three days but blocks after seven',async()=>{
 const storage=new Map([['fiexea_guest_trial_v1',JSON.stringify({started:Date.now()-4*24*3600000,lastSeen:Date.now()})],['fiexea_guest_active','1']]);
 const x=await run('trial',{session:false,storage});
 assert.equal(x.context.document.documentElement.dataset.fiexeaAccess,'allowed');
 x.advance(3*24*3600000+1);x.intervals[0]();
 assert.equal(x.context.document.documentElement.dataset.fiexeaAccess,'blocked');
});

test('expired guest goes directly to signup with the application blocked',async()=>{
 const storage=new Map([['fiexea_guest_trial_v1',JSON.stringify({started:Date.now()-8*24*3600000,lastSeen:Date.now()})],['fiexea_guest_active','1']]);
 const x=await run('trial',{session:false,storage});
 assert.equal(x.context.authView,'signup');
 assert.equal(x.context.document.documentElement.dataset.fiexeaAccess,'blocked');
 assert.equal(x.element('auth').hidden,false);
 assert.equal(x.element('fiexeaAccessGate').hidden,true);
 assert.equal(x.element('fiexeaSignupExpired').hidden,false);
 assert.equal(x.element('fiexeaSignupSubmit').textContent,'Crear cuenta y elegir plan');
});
test('expired authenticated account opens plans once; active accounts do not',async()=>{
 const x=await run('expired');assert.equal(x.context.premiumOpens,1);
 await x.context.window.FiexeaAccess.refresh();assert.equal(x.context.premiumOpens,1);
 for(const state of ['paid','existing','trial']){const y=await run(state);assert.equal(y.context.premiumOpens,undefined)}
});

test('guest countdown uses days, hours and minutes and never displays 0 minutes before expiry',async()=>{
 const started=Date.now(),storage=new Map([['fiexea_guest_trial_v1',JSON.stringify({started,lastSeen:started})],['fiexea_guest_active','1']]);
 const x=await run('trial',{session:false,storage});
 assert.match(x.element('fiexeaTrialRemaining').textContent,/7 días/);assert.doesNotMatch(x.element('fiexeaTrialRemaining').textContent,/167 h/);
 x.advance(60001);x.intervals[0]();assert.match(x.element('fiexeaTrialRemaining').textContent,/6 días 23 h 59 min/);
 x.advance(7*24*3600000-30000);x.intervals[0]();assert.match(x.element('fiexeaTrialRemaining').textContent,/menos de 1 min/);assert.equal(x.context.document.documentElement.dataset.fiexeaAccess,'allowed');
 x.advance(7*24*3600000+1);x.intervals[0]();assert.equal(x.context.document.documentElement.dataset.fiexeaAccess,'blocked');
});

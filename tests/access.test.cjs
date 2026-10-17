const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('access.js','utf8');
async function run(state, { session = true, fail = false, remaining = 7200000, invitations = null } = {}) {
  const elements = new Map();
  function element(id) {
    if(!elements.has(id)) elements.set(id,{hidden:true,disabled:false,textContent:'',value:'',checked:false,addEventListener(){},reset(){}});
    return elements.get(id);
  }
  let monotonic = 0;
  const intervals=[];
  const context = {console, Promise, Date, Math, Number, setTimeout(){return 1;},clearTimeout(){},setInterval(fn){intervals.push(fn);return 1;},clearInterval(){},performance:{now:()=>monotonic},document:{getElementById:element,documentElement:{dataset:{}},addEventListener(){},visibilityState:'visible'},window:{addEventListener(){},FiexeaInvitations:invitations},FIEXEA_SUPABASE_URL:'https://example.invalid',fiexeaAuthGate:element('auth'),fiexeaShowGate(){},fiexeaShowView(){},fiexeaIsRecoveryUrl:()=>false,openPremiumModal(){},fetch:async()=>({ok:true,json:async()=>({billing_available:false})}),fiexeaSupabase:{auth:{getSession:async()=>({data:{session:session?{user:{id:'example-user'}}:null},error:null}),onAuthStateChange(){}},rpc:async()=>({data:{state,allowed:['existing','trial','paid','invitation'].includes(state),server_now:'2026-10-17T00:00:00Z',invitation_ends_at:new Date(Date.parse('2026-10-17T00:00:00Z')+remaining).toISOString(),trial_ends_at:new Date(Date.parse('2026-10-17T00:00:00Z')+remaining).toISOString()},error:fail?new Error('offline'):null})}};
  vm.runInNewContext(source,context);
  await new Promise(resolve=>setImmediate(resolve));
  return {context,element,intervals,advance:value=>monotonic=value};
}
test('existing and paid accounts are admitted only after server confirmation',async()=>{for(const state of ['existing','paid']){const x=await run(state);assert.equal(x.context.document.documentElement.dataset.fiexeaAccess,'allowed');assert.equal(x.element('fiexeaAccessGate').hidden,true);}});
test('expired account is blocked without enabling billing in test mode',async()=>{const x=await run('expired');assert.equal(x.context.document.documentElement.dataset.fiexeaAccess,'blocked');assert.match(x.element('fiexeaAccessTitle').textContent,/terminado/);assert.equal(x.element('fiexeaOpenSignup').disabled,true);});
test('trial expires using monotonic time without trusting the device clock',async()=>{const x=await run('trial',{remaining:1000});assert.equal(x.element('fiexeaTrialBanner').hidden,false);x.advance(1100);x.intervals[0]();assert.equal(x.context.document.documentElement.dataset.fiexeaAccess,'blocked');});
test('server failure never grants access',async()=>{const x=await run('paid',{fail:true});assert.equal(x.context.document.documentElement.dataset.fiexeaAccess,'blocked');assert.match(x.element('fiexeaAccessTitle').textContent,/No se pudo/);});
test('signed-out account stays at login with registration unavailable in test mode',async()=>{const x=await run('trial',{session:false});assert.equal(x.context.document.documentElement.dataset.fiexeaAccess,'signedout');assert.equal(x.element('fiexeaAccessGate').hidden,true);assert.equal(x.element('fiexeaOpenSignup').disabled,true);});

test('invitation access expires on the server deadline and hides payment button',async()=>{const x=await run('invitation',{remaining:1000});assert.equal(x.context.document.documentElement.dataset.fiexeaAccess,'allowed');assert.equal(x.element('fiexeaTrialPlans').hidden,true);assert.match(x.element('fiexeaTrialRemaining').textContent,/Invitación activa/);x.advance(1100);x.intervals[0]();assert.equal(x.context.document.documentElement.dataset.fiexeaAccess,'blocked');assert.equal(x.element('fiexeaAccessPlans').hidden,true);});
test('revoked invitation blocks access with an invitation-specific message',async()=>{const x=await run('invitation_expired');assert.equal(x.context.document.documentElement.dataset.fiexeaAccess,'blocked');assert.match(x.element('fiexeaAccessTitle').textContent,/invitación/);assert.equal(x.element('fiexeaAccessPlans').hidden,true);});
test('pending invitation permits registration without active billing',async()=>{const x=await run('trial',{session:false,invitations:{pending:true}});assert.equal(x.element('fiexeaOpenSignup').disabled,false);});
test('invalid invitation never falls back to a free trial',async()=>{const x=await run('trial',{invitations:{pending:true,redeem:async()=>{throw new Error('Invitación no válida')}}});assert.equal(x.context.document.documentElement.dataset.fiexeaAccess,'blocked');assert.match(x.element('fiexeaAccessMessage').textContent,/Invitación no válida/);});

const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(handler){
 const nodes=new Map(),storage=new Map(),calls=[];
 function node(id){if(!nodes.has(id))nodes.set(id,{id,hidden:true,value:id==='trialAdminFilter'?'all':'',textContent:'',innerHTML:'',open:false,children:[],events:{},setAttribute(){},querySelector(selector){return node(selector.replace(/^#/,''))},appendChild(child){this.children.push(child)},addEventListener(name,fn){this.events[name]=fn},showModal(){this.open=true},close(){this.open=false},remove(){nodes.delete(id)},replaceChildren(){this.children=[];this.innerHTML=''}});return nodes.get(id)}
 const context={Date,Math,Number,Uint8Array,Array,JSON,String,crypto:require('node:crypto').webcrypto,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},document:{body:node('body'),createElement:()=>node('dialog'),getElementById:id=>id==='trialAdminOpen'?null:node(id)},window:{},fiexeaSupabase:{rpc:async(name,args)=>{calls.push([name,args]);return handler(name,args)}}};
 vm.runInNewContext(fs.readFileSync('trial-admin.js','utf8'),context);return{api:context.window.FiexeaTrials,node,storage,calls};
}
test('trial tracking reuses the secret and does not restart its deadline',async()=>{
 const x=setup(async()=>({data:{id:'fixture',started_at:new Date(1000).toISOString()},error:null}));
 const record={started:2000,lastSeen:2000};await x.api.trackGuest(record);const token=record.token;
 assert.match(token,/^[a-f0-9]{64}$/);assert.equal(record.started,1000);
 await x.api.trackGuest(record,true);assert.equal(record.token,token);assert.equal(x.calls[1][1].payload.token,token);
});
test('dashboard reset prevents an in-flight result from exposing admin data after signout',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r);const x=setup(()=>pending);
 x.api.setAdmin(true,'owner');const button=x.node('fiexeaAdminMenu').children[0];button.events.click();
 x.api.reset();resolve({data:{summary:{total:1},rows:[{email:'private@example.invalid',id:'12345678',state:'active'}],server_now:new Date().toISOString()},error:null});
 await new Promise(r=>setImmediate(r));assert.equal(x.node('trialAdminRows').innerHTML,'');assert.equal(x.node('dialog').open,false);
});
test('authenticated conversion link requires a locally tracked trial',async()=>{
 const x=setup(async()=>({data:{id:'fixture',started_at:new Date(1000).toISOString()},error:null}));
 await x.api.claim({user:{id:'user'}});assert.equal(x.calls.length,0);
 x.storage.set('fiexea_guest_trial_v1',JSON.stringify({started:1000,lastSeen:1000}));await x.api.claim({user:{id:'user'}});
 assert.equal(x.calls.at(-1)[1].action,'claim');
});

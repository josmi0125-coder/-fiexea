const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
const html=fs.readFileSync('app.html','utf8');
const head=html.match(/<script>(document.documentElement.dataset.fiexeaAccess=.*?)<\/script>/s)[1];
const auth=html.slice(html.indexOf("const FIEXEA_SUPABASE_URL=")).split('</script>')[0];
async function setup({hash='#access_token=fake&type=recovery',session={user:{id:'test'}},event='PASSWORD_RECOVERY'}={}){
 const elements=new Map(),listeners=[];
 const el=id=>{if(!elements.has(id))elements.set(id,{hidden:true,value:'',textContent:'',events:{},addEventListener(e,fn){this.events[e]=fn}});return elements.get(id)};
 const location={href:'https://fiexea.es/app.html'+hash,hash,search:'',pathname:'/app.html'};
 const window={location,history:{replaceState(){location.hash=''}},supabase:{createClient(){return {auth:{onAuthStateChange(fn){listeners.push(fn)},async getSession(){location.hash='';if(event)listeners.forEach(fn=>fn(event,session));return {data:{session}}},async updateUser(){return {error:null}}}}}}};
 const ctx=vm.createContext({window,URLSearchParams,URL,document:{title:'FIEXEA',documentElement:{dataset:{}},getElementById:el},setTimeout(fn){fn()}});
 vm.runInContext(head,ctx);vm.runInContext(auth,ctx);await new Promise(setImmediate);
 return {ctx,window,el,listeners,session};
}
test('recovery survives SDK stripping the fragment and subsequent SIGNED_IN events',async()=>{
 const x=await setup();assert.equal(x.window.FIEXEA_PASSWORD_RECOVERY,true);x.listeners.forEach(fn=>fn('SIGNED_IN',x.session));vm.runInContext('fiexeaShowGate(false)',x.ctx);assert.equal(x.el('fiexeaAuthGate').hidden,false);assert.equal(x.el('fiexeaResetView').hidden,false);assert.equal(x.el('fiexeaLoginView').hidden,true);
});
test('PASSWORD_RECOVERY opens reset even if callback URL has already been cleaned',async()=>{const x=await setup({hash:''});assert.equal(x.el('fiexeaResetView').hidden,false);});
test('expired email link gives a way to request another link',async()=>{const x=await setup({hash:'#error=access_denied&error_code=otp_expired',session:null,event:null});assert.equal(x.el('fiexeaForgotView').hidden,false);assert.match(x.el('fiexeaForgotMsg').textContent,/caducado/);});
test('direct forgot link opens the email form',async()=>{const x=await setup({hash:'#forgot',session:null,event:null});assert.equal(x.el('fiexeaForgotView').hidden,false);});
test('successful password update releases recovery state',async()=>{const x=await setup();x.el('fiexeaNewPassword').value=x.el('fiexeaNewPassword2').value='test-password';await x.el('fiexeaResetForm').events.submit({preventDefault(){}});assert.equal(x.window.FIEXEA_PASSWORD_RECOVERY,false);assert.equal(x.el('fiexeaAuthGate').hidden,true);});

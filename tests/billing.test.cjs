const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync('supabase/functions/create-checkout-session/index.ts','utf8').replace(/^import .*;\n/gm,''));
function server(options={}){
  let handler,checkout,portal;
  class Stripe {
    prices={retrieve:async id=>({livemode:!!options.live,active:true,currency:'eur',unit_amount:id.includes('Nzz')?499:4500,recurring:{interval:id.includes('Nzz')?'month':'year',interval_count:1}})};
    checkout={sessions:{create:async value=>{checkout=value;return{url:'https://checkout.stripe.com/c/pay/test'}}}};
    billingPortal={sessions:{create:async value=>{portal=value;return{url:'https://billing.stripe.com/p/session/test'}}}};
  }
  const client={auth:{getUser:async()=>({data:{user:options.invalid?null:{id:'owner',email:'test@example.invalid'}},error:null})},rpc:async()=>({data:{state:options.state||'trial'},error:null}),from:()=>({select(){return this},eq(){return this},order:async()=>({data:options.customers||[],error:null}),in:async()=>({data:options.existing||[],error:null})})};
  vm.runInNewContext(source,{Stripe,createClient:()=>client,Deno:{env:{get:key=>key==='STRIPE_SECRET_KEY'?(options.live?'sk_live_mock':'sk_test_mock'):undefined},serve:fn=>handler=fn},Response,Set,Date});
  return{request:(origin='https://fiexea.es',body=null,method=body?'POST':'GET',auth=true)=>handler(new Request('https://example.invalid',{method,headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(auth?{Authorization:'Bearer mock'}:{})},...(body?{body:JSON.stringify(body)}:{})})),checkout:()=>checkout,portal:()=>portal};
}
test('canonical and www domain preflights are accepted, unrelated origins rejected',async()=>{
 const s=server();for(const origin of ['https://fiexea.es','https://www.fiexea.es','https://josmi0125-coder.github.io']){const r=await s.request(origin,null,'OPTIONS');assert.equal(r.status,200);assert.equal(r.headers.get('access-control-allow-origin'),origin);}
 assert.equal((await s.request('https://unrelated.invalid')).status,403);
});
test('test Stripe prices never enable real billing or create Checkout',async()=>{const s=server();assert.equal((await (await s.request()).json()).billing_available,false);assert.equal((await s.request(undefined,{plan:'monthly'})).status,503);assert.equal(s.checkout(),undefined);});
test('billing requires a valid account and an allowed plan',async()=>{assert.equal((await server().request(undefined,{plan:'monthly'},'POST',false)).status,401);assert.equal((await server({invalid:true}).request(undefined,{plan:'monthly'})).status,401);assert.equal((await server({live:true}).request(undefined,{plan:'invalid'})).status,400);});
test('live checkout returns to fiexea.es with the authenticated account and no extra trial',async()=>{const s=server({live:true});assert.equal((await s.request(undefined,{plan:'monthly'})).status,200);assert.equal(s.checkout().client_reference_id,'owner');assert.equal(s.checkout().success_url,'https://fiexea.es/app.html?checkout=success');assert.equal(s.checkout().cancel_url,'https://fiexea.es/app.html?checkout=cancelled');assert.equal(s.checkout().subscription_data.trial_period_days,undefined);});
test('an admin with an existing subscription cannot create duplicate billing',async()=>{const s=server({live:true,state:'admin',existing:[{status:'active'}]});assert.equal((await s.request(undefined,{plan:'annual'})).status,409);assert.equal(s.checkout(),undefined);});
test('portal ignores client customer IDs and uses only the account billing record',async()=>{const s=server({customers:[{stripe_customer_id:'cus_owner',livemode:false}]});assert.equal((await s.request(undefined,{action:'portal',customer:'cus_someone_else'})).status,200);assert.equal(s.portal().customer,'cus_owner');assert.equal(s.portal().return_url,'https://fiexea.es/app.html');});
test('portal cannot open for an account with no matching customer',async()=>{const s=server({customers:[{stripe_customer_id:'cus_live',livemode:true}]});assert.equal((await s.request(undefined,{action:'portal'})).status,404);assert.equal(s.portal(),undefined);});

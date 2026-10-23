const test=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('../receipt-storage.js');
function setup(){let owner='11111111-1111-4111-8111-111111111111',uploads=0,reads=0,fail=false,switchOnUpload=false;const objects=new Map();
 const client={
  auth:{getSession:async()=>({data:{session:{user:{id:owner}}}})},
  storage:{from(bucket){
   assert.equal(bucket,'expense-receipts');
   return {
    async upload(path,blob,options){uploads++;assert.equal(options.upsert,false);if(fail)return{error:{statusCode:500}};if(objects.has(path))return{error:{statusCode:409}};objects.set(path,blob);if(switchOnUpload)owner='other';return{}},
    async download(path){reads++;return objects.has(path)?{data:objects.get(path)}:{error:{statusCode:404}}}
   };
  }}
 };
 const store=create({client,getOwner:()=>owner});return{store,objects,client,get uploads(){return uploads},get reads(){return reads},setOwner(value){owner=value},setFailure(){fail=true},switchOnUpload(){switchOnUpload=true},owner:()=>owner};
}
const receipt={name:'Recibo original.pdf',type:'application/pdf',data:'data:application/pdf;base64,JVBERi0xLjQ='};
test('receipt bytes leave snapshots and survive download and standalone export',async()=>{const h=setup(),ref=await h.store.storeInline(receipt);assert.equal(ref.data,undefined);assert.equal(ref.name,receipt.name);assert.equal(ref.owner,h.owner());assert.match(ref.path,/\/[a-f0-9]{64}$/);assert.equal(await(await h.store.download(ref)).text(),'%PDF-1.4');assert.equal((await h.store.materialize({receipt:ref})).receipt.data,receipt.data);});
test('identical receipts upload once while retaining their individual filenames',async()=>{const h=setup();const [a,b]=await Promise.all([h.store.storeInline(receipt),h.store.storeInline({...receipt,name:'Pago 2.pdf'})]);assert.equal(h.uploads,1);assert.equal(a.path,b.path);assert.notEqual(a.name,b.name);});
test('the local financial cache and each payment compact without changing dates or amounts',async()=>{const h=setup(),move={id:'m',date:'2026-08-03',amount:133.6,receipt};const source={fiexea_moves:JSON.stringify([move]),fiexea_scheduled_expenses:JSON.stringify([{id:'p',date:move.date,receipt}])};const compact=await h.store.compact(source);assert.ok(JSON.stringify(compact).length<JSON.stringify(source).length+500);const entry=JSON.parse(compact.fiexea_moves)[0];assert.equal(entry.date,move.date);assert.equal(entry.amount,move.amount);assert.equal(entry.receipt.data,undefined);assert.equal(h.uploads,1);assert.deepEqual(await h.store.materialize(compact),source);});
test('upload failure leaves the original receipt untouched and a retry can succeed',async()=>{const h=setup();h.setFailure();await assert.rejects(h.store.storeInline(receipt),/conexión/);assert.equal(receipt.data,'data:application/pdf;base64,JVBERi0xLjQ=');});
test('switching accounts during upload cannot commit the reference into the new account',async()=>{const h=setup();h.switchOnUpload();await assert.rejects(h.store.storeInline(receipt),/cuenta ha cambiado/);});
test('another account cannot open a receipt even when its bytes were cached in memory',async()=>{const h=setup(),ref=await h.store.storeInline(receipt);h.setOwner('22222222-2222-4222-8222-222222222222');await assert.rejects(h.store.download(ref),/otra cuenta/);assert.equal(h.reads,0);});
test('existing objects are reused only after their contents have been verified',async()=>{const h=setup(),ref=await h.store.storeInline(receipt);const second=create({client:h.client,getOwner:h.owner});const same=await second.storeInline(receipt);assert.equal(same.path,ref.path);assert.equal(h.reads,1);h.objects.set(ref.path,new Blob(['wrong']));const third=create({client:h.client,getOwner:h.owner});await assert.rejects(third.storeInline(receipt),/verificar/);});
test('fresh devices download and verify private receipts with the signed-in account',async()=>{const h=setup(),ref=await h.store.storeInline(receipt),fresh=create({client:h.client,getOwner:h.owner});assert.equal(await(await fresh.download(ref)).text(),'%PDF-1.4');assert.equal(h.reads,1);});

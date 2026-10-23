const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
test('native bundle preserves calendar, receipts, calculator and page guides from the shared web app',()=>{
 const html=fs.readFileSync('dist/mobile/index.html','utf8');
 for(const id of ['compoundDialog','fiexea-home-chart-sync'])assert.ok(html.includes('id="'+id+'"'),`Missing ${id}`);
 for(const file of ['receipt-storage.js','expense-calendar-math.js','expense-calendar.js','guided-tours.js','guided-tours.css','guided-tours-i18n.js','compound.js','compound.css']){
  assert.ok(html.includes(file),`Missing reference to ${file}`);
  assert.deepEqual(fs.readFileSync('dist/mobile/'+file),fs.readFileSync(file),`Stale native resource ${file}`);
 }
});
test('native callbacks accept only the app auth route and preserve PKCE verifier flow',async()=>{
 const{parseAuthCallback}=await import('../mobile/utils.js');
 assert.equal(parseAuthCallback('com.fiexea.mobile.dev://auth/callback?code=example','com.fiexea.mobile.dev'),'index.html?code=example');
 for(const url of ['https://unrelated.invalid/auth/callback?code=example','com.fiexea.mobile.dev://other/callback?code=example','com.fiexea.mobile.dev://auth/other?code=example','com.fiexea.mobile.dev://auth/callback#access_token=token','garbage'])assert.equal(parseAuthCallback(url,'com.fiexea.mobile.dev'),null);
});
test('export filenames cannot escape the native cache folder',async()=>{
 const{safeExportName}=await import('../mobile/utils.js');assert.ok(!safeExportName('../../account/secret.csv').includes('/'));assert.ok(safeExportName('x'.repeat(200)).length<=100);
});
test('a repeated cold-launch callback does not loop after reloading the WebView',async()=>{
 const{consumeAuthCallback}=await import('../mobile/utils.js');const values=new Map();const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 const raw='com.fiexea.mobile.dev://auth/callback?code=private-one-time-code';
 assert.equal(await consumeAuthCallback(raw,'com.fiexea.mobile.dev',storage),'index.html?code=private-one-time-code');
 assert.equal(await consumeAuthCallback(raw,'com.fiexea.mobile.dev',storage),null);
 assert.ok(![...values.values()].join('').includes('private-one-time-code'));
});
test('mobile build contains a local entry and native share integration',()=>{
 const source=fs.readFileSync('dist/mobile/index.html','utf8');assert.ok(source.includes('window.FiexeaNative.shareBlob'));assert.ok(source.includes("flowType:'pkce'"));assert.ok(source.includes('Las compras y la gestión de suscripciones no están disponibles en esta versión de prueba.'));assert.ok(!source.includes('https://cdn.jsdelivr.net/npm/@supabase'));
 const access=fs.readFileSync('dist/mobile/access.js','utf8');assert.ok(access.includes('plans.hidden = true'));assert.ok(access.includes("getElementById('fiexeaTrialPlans').hidden = true"));
});

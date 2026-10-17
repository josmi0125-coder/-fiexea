const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('app.html','utf8');
const source=html.slice(html.indexOf('const FIEXEA_FINANCIAL_BACKUP_KEYS='),html.indexOf('function initializeFinancialPersistence()'))+html.slice(html.indexOf('function createFinancialBackup('),html.indexOf('function financialRestoreArrayCount('));
function storage(values={}){const data=new Map(Object.entries(values));return{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};}
function setup({remoteChanged=false,writeRace=false,empty=false,otherUser=false}={}){
 const old={'fiexea_moves':'[{"id":"one","amount":10}]'};
 let written=null;
 const context={console,Date,Number,JSON,Map,Set,Object,Array,encodeURIComponent,clearTimeout(){},localBudgetMonth:()=> '2026-10',localStorage:storage(),setCloudRestoreMessage(){},setKeepLocalButtonVisible(){},document:{getElementById:()=>null},window:{},queueFinancialSync(){},fiexeaSupabase:{auth:{getSession:async()=>({data:{session:{user:{id:'owner'}}},error:null})},from:()=>{
  const query={kind:'read',select(){return this},eq(){return this},is(){return this},update(record){this.kind='write';written=record;return this},insert(record){this.kind='write';written=record;return this},then(resolve){return Promise.resolve(this.kind==='read'?{data:[{id:'row',user_id:'owner',created_at:'2026-10-01T00:00:00Z',updated_at:'2026-10-17T00:00:00Z',data:{...context.base,fiexea_moves:remoteChanged?'[{"id":"other-device","amount":99}]':old.fiexea_moves}}],error:null}:{data:writeRace?[]:[{id:'row'}],error:null}).then(resolve)}};return query;}}};
 vm.createContext(context);vm.runInContext(source,context);
 context.base=vm.runInContext('financialDataEmpty()',context);Object.assign(context.base,old);
 const local={...context.base,fiexea_moves:empty?'[]':'[{"id":"one","amount":10},{"id":"two","amount":20}]'};
 for(const[k,v]of Object.entries(local))if(v!==null)context.localStorage.setItem(k,v);
 context.localStorage.setItem('fiexea_financial_owner_id',otherUser?'different-owner':'owner');
 vm.runInContext("financialActiveUserId='owner';financialLastSyncedSnapshot=financialDataSnapshot(base)",context);
 return{context,written:()=>written};
}
test('editing data after a successful sync updates the existing cloud copy',async()=>{const s=setup();const result=await s.context.syncFinancialDataToSupabase();assert.equal(result.synced,true);assert.equal(JSON.parse(s.written().data.fiexea_moves).length,2);});
test('a newer copy from another device is preserved as a conflict',async()=>{const s=setup({remoteChanged:true});await assert.rejects(s.context.syncFinancialDataToSupabase(),/cambios pendientes/);assert.equal(s.written(),null);});
test('an empty local state does not overwrite a populated cloud copy',async()=>{const s=setup({empty:true});await assert.rejects(s.context.syncFinancialDataToSupabase(),/copia guardada/);assert.equal(s.written(),null);});
test('a concurrent cloud write is detected instead of reporting success',async()=>{const s=setup({writeRace:true});await assert.rejects(s.context.syncFinancialDataToSupabase(),/remote-changed/);});
test('data belonging to another account cannot be uploaded',async()=>{const s=setup({otherUser:true});await assert.rejects(s.context.syncFinancialDataToSupabase(),/otra cuenta/);assert.equal(s.written(),null);});
test('backup and restore round trip all registered data blocks and preferences',()=>{const s=setup();const keys=Object.keys(s.context.base);for(const key of keys)s.context.localStorage.setItem(key,key);const backup=s.context.createFinancialBackup(s.context.localStorage);const target=storage();s.context.restoreFinancialBackupData(backup.data,target);for(const key of keys)assert.equal(target.getItem(key),key);assert.ok(keys.includes('fiexea_accounts'));assert.ok(keys.includes('fiexea_active_categories'));assert.ok(keys.includes('fiexea_planner_rows'));});
test('cloud restore preserves fields absent from an older partial backup',()=>{const s=setup();const target=storage({fiexea_accounts:'[{"id":"keep"}]'});s.context.restoreFinancialCloudData({fiexea_moves:'[]'},target);assert.equal(target.getItem('fiexea_accounts'),'[{"id":"keep"}]');assert.equal(target.getItem('fiexea_moves'),'[]');});

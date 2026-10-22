/* Private receipt files live outside the small localStorage financial snapshots. */
(function(root){
'use strict';
const BUCKET='expense-receipts',TYPES=['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif'];
function create({client,getOwner}){
 const pending=new Map(),blobs=new Map();let database;
 function remember(path,blob){blobs.delete(path);blobs.set(path,blob);let bytes=0;for(const file of blobs.values())bytes+=file.size;while(bytes>4*1024*1024&&blobs.size>1){const first=blobs.keys().next().value;bytes-=blobs.get(first).size;blobs.delete(first)}}
 const ownerNow=()=>String(getOwner()||'');
 function assertOwner(owner){if(!owner||ownerNow()!==owner)throw new Error('La cuenta ha cambiado. Abre el gasto de nuevo.');}
 async function authorize(owner){assertOwner(owner);const {data,error}=await client.auth.getSession();if(error)throw error;assertOwner(owner);if(data?.session?.user?.id!==owner)throw new Error('Inicia sesión para guardar o abrir el recibo.');}
 function cacheDB(){if(!root.indexedDB)return Promise.resolve(null);if(!database)database=new Promise((resolve,reject)=>{const request=root.indexedDB.open('fiexea-private-receipts',1);request.onupgradeneeded=()=>request.result.createObjectStore('files');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});return database;}
 async function cache(action,key,blob){try{const db=await cacheDB();if(!db)return null;return await new Promise((resolve,reject)=>{const tx=db.transaction('files',action==='put'?'readwrite':'readonly'),store=tx.objectStore('files'),request=action==='put'?store.put(blob,key):store.get(key);tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}catch(_){return null}}
 function inlineBlob(receipt){const match=/^data:(application\/pdf|image\/(?:jpeg|png|webp|heic|heif));base64,([A-Za-z0-9+/=\s]+)$/.exec(receipt?.data||'');if(!match||!TYPES.includes(receipt.type)||match[1]!==receipt.type)throw new Error('El justificante no tiene un formato compatible.');const raw=atob(match[2]);return new Blob([Uint8Array.from(raw,c=>c.charCodeAt(0))],{type:receipt.type})}
 async function digest(blob){const hash=await root.crypto.subtle.digest('SHA-256',await blob.arrayBuffer());return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')}
 function validateRef(receipt,owner){assertOwner(owner);if(receipt?.bucket!==BUCKET||receipt.owner!==owner||!new RegExp('^'+owner+'/[a-f0-9]{64}$').test(receipt.path||''))throw new Error('Este recibo pertenece a otra cuenta o no es válido.');}
 async function storeInline(receipt,owner=ownerNow()){
  if(!receipt?.data)return receipt;await authorize(owner);const blob=inlineBlob(receipt),hash=await digest(blob);assertOwner(owner);
  if(blob.size>500*1024)throw new Error('Selecciona una imagen o PDF de hasta 500 KB.');
  const path=owner+'/'+hash,key=path+':'+receipt.type;
  if(!pending.has(key))pending.set(key,(async()=>{
   const {error}=await client.storage.from(BUCKET).upload(path,blob,{contentType:receipt.type,upsert:false});assertOwner(owner);
   if(error){if(String(error.statusCode||error.status)!=='409'&&error.error!=='Duplicate')throw new Error('No se pudo guardar el recibo. Comprueba la conexión y vuelve a intentarlo.');
    const existing=await client.storage.from(BUCKET).download(path);assertOwner(owner);if(existing.error||!existing.data||await digest(existing.data)!==hash)throw new Error('No se pudo verificar el recibo guardado.');}
   await cache('put',path,blob);assertOwner(owner);remember(path,blob);return{bucket:BUCKET,path,owner};
  })().catch(error=>{pending.delete(key);throw error}));
  const reference=await pending.get(key);assertOwner(owner);const {data,...metadata}=receipt;return{...metadata,...reference};
 }
 async function download(receipt){if(receipt?.data)return inlineBlob(receipt);const owner=ownerNow();validateRef(receipt,owner);
  let blob=blobs.get(receipt.path)||await cache('get',receipt.path);assertOwner(owner);
  if(!blob){await authorize(owner);const result=await client.storage.from(BUCKET).download(receipt.path);assertOwner(owner);if(result.error||!result.data)throw new Error('No se pudo abrir el recibo. Comprueba la conexión y vuelve a intentarlo.');blob=result.data;if(await digest(blob)!==receipt.path.split('/')[1])throw new Error('No se pudo verificar el recibo.');await cache('put',receipt.path,blob);}
  assertOwner(owner);remember(receipt.path,blob);return blob;
 }
 async function walk(value,convert){if(Array.isArray(value))return Promise.all(value.map(item=>walk(item,convert)));if(!value||typeof value!=='object')return value;const copy={...value};for(const key of Object.keys(copy)){if(key==='receipt'&&copy[key])copy[key]=await convert(copy[key]);else if(key.startsWith('fiexea_')&&typeof copy[key]==='string'&&/^[\[{]/.test(copy[key])){let parsed;try{parsed=JSON.parse(copy[key])}catch(_){continue}copy[key]=JSON.stringify(await walk(parsed,convert));}else if(copy[key]&&typeof copy[key]==='object')copy[key]=await walk(copy[key],convert);}return copy;}
 async function compact(value,owner=ownerNow()){return walk(value,r=>storeInline(r,owner));}
 async function materialize(value){return walk(value,async receipt=>{if(receipt.data)return receipt;const blob=await download(receipt),bytes=new Uint8Array(await blob.arrayBuffer());let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));const {bucket,path,owner,...metadata}=receipt;return{...metadata,data:'data:'+receipt.type+';base64,'+btoa(raw)}});}
 return{storeInline,download,compact,materialize};
}
root.FiexeaReceiptStorage={create};if(typeof module!=='undefined'&&module.exports)module.exports={create};
})(typeof window!=='undefined'?window:globalThis);

import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'dist/mobile');
await rm(output,{recursive:true,force:true});
await mkdir(path.join(output,'vendor'),{recursive:true});
// Include the shared web resources, including modules added after the native shell.
for(const file of await readdir(root)){
 if(['index.html','app.html'].includes(file)||! /\.(?:html|js|css|png|webp|ico|svg|webmanifest)$/.test(file))continue;
 await cp(path.join(root,file),path.join(output,file));
 if(file.endsWith('.html')){
  const page=await readFile(path.join(output,file),'utf8');
  await writeFile(path.join(output,file),page.replaceAll('href="app.html','href="index.html'));
 }
}
await cp(path.join(root,'assets'),path.join(output,'assets'),{recursive:true});
for(const [entry,name] of [['mobile/supabase-entry.js','supabase.js'],['mobile/runtime.js','native.js']])
 await build({entryPoints:[path.join(root,entry)],outfile:path.join(output,'vendor',name),bundle:true,format:'iife',target:['safari15','chrome100'],minify:true,legalComments:'eof'});
// Ship receipt readers and their workers with the native app, rather than loading CDN code.
const vendor=path.join(output,'vendor');
await build({entryPoints:[path.join(root,'node_modules/pdfjs-dist/legacy/build/pdf.mjs')],outfile:path.join(vendor,'pdf.js'),bundle:true,format:'iife',globalName:'pdfjsLib',target:['safari15','chrome100'],minify:true,legalComments:'eof'});
await build({entryPoints:[path.join(root,'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')],outfile:path.join(vendor,'pdf.worker.mjs'),bundle:true,format:'esm',target:['safari15','chrome100'],minify:true,legalComments:'eof'});
for(const dir of ['cmaps','standard_fonts','wasm'])await cp(path.join(root,'node_modules/pdfjs-dist',dir),path.join(vendor,'pdf',dir),{recursive:true});
for(const file of ['tesseract.min.js','worker.min.js'])await cp(path.join(root,'node_modules/tesseract.js/dist',file),path.join(vendor,file));
await mkdir(path.join(vendor,'tesseract-core'),{recursive:true});
for(const file of await readdir(path.join(root,'node_modules/tesseract.js-core')))if(/\.wasm(?:\.js)?$/.test(file))await cp(path.join(root,'node_modules/tesseract.js-core',file),path.join(vendor,'tesseract-core',file));
await mkdir(path.join(vendor,'tessdata'),{recursive:true});
await cp(path.join(root,'node_modules/@tesseract.js-data/spa/4.0.0/spa.traineddata.gz'),path.join(vendor,'tessdata/spa.traineddata.gz'));
await mkdir(path.join(vendor,'licenses'),{recursive:true});
for(const [pkg,file] of [['pdfjs-dist','LICENSE'],['tesseract.js','LICENSE.md'],['tesseract.js-core','LICENSE'],['@tesseract.js-data/spa','LICENSE']]){
 try{await cp(path.join(root,'node_modules',pkg,file),path.join(vendor,'licenses',pkg.replaceAll('/','-')+'.txt'));}catch(error){if(error.code!=='ENOENT')throw error;}
}
let html=await readFile(path.join(root,'app.html'),'utf8');
function replaceOnce(old,value){if(html.split(old).length!==2)throw new Error(`Mobile source changed: ${old.slice(0,80)}`);html=html.replace(old,value);}
replaceOnce('<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>','<script src="vendor/pdf.js"></script>');
replaceOnce('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js','vendor/pdf.worker.mjs');
replaceOnce('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>','<script src="vendor/supabase.js"></script><script src="vendor/native.js"></script>');
replaceOnce("function fiexeaRedirectUrl(){return new URL('./',window.location.href).href}","function fiexeaRedirectUrl(){return window.FiexeaNative?.redirect||new URL('./',window.location.href).href}");
replaceOnce('window.supabase.createClient(FIEXEA_SUPABASE_URL,FIEXEA_SUPABASE_PUBLISHABLE_KEY)','window.supabase.createClient(FIEXEA_SUPABASE_URL,FIEXEA_SUPABASE_PUBLISHABLE_KEY,{auth:{flowType:\'pkce\'}})');
html=html.replaceAll('Abre el enlace en Safari.','Abre el enlace de confirmación para volver a FIEXEA.');
replaceOnce('function saveOrShareFinancialBackup(){','function saveOrShareFinancialBackup(){if(window.FiexeaNative){if(!preparedFinancialBackup)return;window.FiexeaNative.shareBlob(preparedFinancialBackup.blob,preparedFinancialBackup.fileName).then(closeFinancialBackupExportModal).catch(()=>alert("No se pudo compartir la copia."));return;}');
replaceOnce('function downloadCSV(){','function downloadCSV(){if(window.FiexeaNative){if(!moves.length){exportCSV();return;}window.FiexeaNative.shareBlob(createCSVBlob(),"fiexea-movimientos.csv").then(closeCSVExportModal).catch(()=>alert("No se pudo compartir el CSV."));return;}');
replaceOnce('function shareCSV(){','function shareCSV(){if(window.FiexeaNative){downloadCSV();return;}');
replaceOnce('function exportJSON(){','function exportJSON(){if(window.FiexeaNative){window.FiexeaNative.shareBlob(new Blob([JSON.stringify(createFinancialBackup(localStorage),null,2)],{type:"application/json"}),"fiexea-copia.json").catch(()=>alert("No se pudo compartir la copia."));return;}');
// Development builds do not initiate web checkout. Store billing is a separate release requirement.
html=html.replace(/async function startCheckout\(plan\)\{[\s\S]*?\n\}/,'async function startCheckout(){openPremiumModal()}');
html=html.replace(/async function openBillingPortal\(\)\{[\s\S]*?\n\}/,'async function openBillingPortal(){openPremiumModal()}');
const modalStart=html.indexOf('<div id="premiumModal"');
if(modalStart<0)throw new Error('Premium modal missing');
// Replace only the premium modal: preserve later scripts and calculator dialogs.
const divs=html.slice(modalStart).matchAll(/<\/?div\b[^>]*>/g);
let depth=0,modalEnd=-1;
for(const match of divs){
 depth+=match[0].startsWith('</')?-1:1;
 if(depth===0){modalEnd=modalStart+match.index+match[0].length;break;}
}
if(modalEnd<0)throw new Error('Premium modal closing tag missing');
html=html.slice(0,modalStart)+`<div id="premiumModal" class="premium-modal" role="dialog" aria-modal="true" aria-labelledby="premiumTitle" hidden onclick="if(event.target===this)closePremiumModal()"><div class="premium-card"><button class="premium-close" type="button" onclick="closePremiumModal()" aria-label="Cerrar">×</button><h2 id="premiumTitle">FIEXEA para móvil</h2><p>Esta es una versión de prueba para Android y iPhone. Puedes utilizar las funciones de tu cuenta mientras tu acceso esté activo.</p><p>Las compras y la gestión de suscripciones no están disponibles en esta versión de prueba.</p></div></div>`+html.slice(modalEnd);
html=html.replace('</head>','<style>html[data-native-platform] .app{padding-top:max(12px,env(safe-area-inset-top))}html[data-native-platform] .nav{padding-bottom:env(safe-area-inset-bottom)}</style></head>');
await writeFile(path.join(output,'index.html'),html);
let access=await readFile(path.join(output,'access.js'),'utf8');
access=access.replace("const response = await fetch(FIEXEA_SUPABASE_URL + '/functions/v1/create-checkout-session', { cache: 'no-store' });",'const response = {ok:true,json:async()=>({billing_available:false})};');
access=access.replace('plans.hidden = !canPay','plans.hidden = true').replace('document.getElementById(\'fiexeaTrialPlans\').hidden = invited','document.getElementById(\'fiexeaTrialPlans\').hidden = true');
access=access.replaceAll('Tus datos siguen guardados. Elige un plan mensual o anual para continuar usando FIEXEA.','Tu acceso no está activo. Tus datos siguen guardados.').replaceAll('Tus datos siguen guardados. Elige un plan para continuar.','Tu acceso no está activo. Tus datos siguen guardados.');
await writeFile(path.join(output,'access.js'),access);
console.log('FIEXEA mobile bundle built from app.html with local dependencies and native file sharing. Web source unchanged.');

let scanner=await readFile(path.join(output,'receipt-scanner.js'),'utf8');
scanner=scanner.replace('https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js','vendor/tesseract.min.js')
 .replace("workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js',corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0'", "workerPath:new URL('vendor/worker.min.js',document.baseURI).href,corePath:new URL('vendor/tesseract-core',document.baseURI).href,langPath:new URL('vendor/tessdata',document.baseURI).href")
 .replace('const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;', "const pdfTask=pdfjs.getDocument({isEvalSupported:false,cMapUrl:new URL('vendor/pdf/cmaps/',document.baseURI).href,cMapPacked:true,standardFontDataUrl:new URL('vendor/pdf/standard_fonts/',document.baseURI).href,wasmUrl:new URL('vendor/pdf/wasm/',document.baseURI).href,data:new Uint8Array(await file.arrayBuffer())});const pdf=await pdfTask.promise;")
 .replace('await pdf.destroy()', 'await pdfTask.destroy()')
 .replace('Necesitas conexión para descargar el lector la primera vez.','El lector está incluido en esta aplicación.');
await writeFile(path.join(output,'receipt-scanner.js'),scanner);

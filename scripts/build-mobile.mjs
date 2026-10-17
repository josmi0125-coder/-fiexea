import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'dist/mobile');
await rm(output,{recursive:true,force:true});
await mkdir(path.join(output,'vendor'),{recursive:true});
for(const file of ['i18n.js','fiexea-logo.png','access.js','access.css','invitations.js','informacion.html','site.css','site.js']) await cp(path.join(root,file),path.join(output,file));
await cp(path.join(root,'assets'),path.join(output,'assets'),{recursive:true});
for(const [entry,name] of [['mobile/supabase-entry.js','supabase.js'],['mobile/runtime.js','native.js']])
 await build({entryPoints:[path.join(root,entry)],outfile:path.join(output,'vendor',name),bundle:true,format:'iife',target:['safari15','chrome100'],minify:true,legalComments:'eof'});
let html=await readFile(path.join(root,'app.html'),'utf8');
function replaceOnce(old,value){if(html.split(old).length!==2)throw new Error(`Mobile source changed: ${old.slice(0,80)}`);html=html.replace(old,value);}
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
html=html.slice(0,modalStart)+`<div id="premiumModal" class="premium-modal" role="dialog" aria-modal="true" aria-labelledby="premiumTitle" hidden onclick="if(event.target===this)closePremiumModal()"><div class="premium-card"><button class="premium-close" type="button" onclick="closePremiumModal()" aria-label="Cerrar">×</button><h2 id="premiumTitle">FIEXEA para móvil</h2><p>Esta es una versión de prueba para Android y iPhone. Puedes utilizar las funciones de tu cuenta mientras tu acceso esté activo.</p><p>Las compras y la gestión de suscripciones no están disponibles en esta versión de prueba.</p></div></div></body></html>`;
html=html.replace('</head>','<style>html[data-native-platform] .app{padding-top:max(12px,env(safe-area-inset-top))}html[data-native-platform] .nav{padding-bottom:env(safe-area-inset-bottom)}</style></head>');
await writeFile(path.join(output,'index.html'),html);
let access=await readFile(path.join(output,'access.js'),'utf8');
access=access.replace("const response = await fetch(FIEXEA_SUPABASE_URL + '/functions/v1/create-checkout-session', { cache: 'no-store' });",'const response = {ok:true,json:async()=>({billing_available:false})};');
access=access.replace('plans.hidden = !canPay','plans.hidden = true').replace('document.getElementById(\'fiexeaTrialPlans\').hidden = invited','document.getElementById(\'fiexeaTrialPlans\').hidden = true');
access=access.replaceAll('Tus datos siguen guardados. Elige un plan mensual o anual para continuar usando FIEXEA.','Tu acceso no está activo. Tus datos siguen guardados.').replaceAll('Tus datos siguen guardados. Elige un plan para continuar.','Tu acceso no está activo. Tus datos siguen guardados.');
await writeFile(path.join(output,'access.js'),access);
console.log('FIEXEA mobile bundle built from app.html with local dependencies and native file sharing. Web source unchanged.');

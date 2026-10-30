import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = 'test-results/android';
mkdirSync(out, { recursive: true });
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', timeout: 30000 }).trim();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const app = 'com.fiexea.mobile.dev';
const results = [];
const errors = [];
let ws;
let sequence = 0;
const pending = new Map();
function command(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 60000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function check(name, expression) {
  assert.equal(await evaluate(expression), true, name);
  results.push(name);
  console.log(`PASS ${name}`);
}
function screenshot(name) {
  writeFileSync(`${out}/${name}.png`, execFileSync('adb', ['exec-out', 'screencap', '-p']));
}
try {
  adb('shell', 'am', 'start', '-W', '-n', `${app}/.MainActivity`);
  let pages;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const pid = adb('shell', 'pidof', app).split(' ')[0];
      adb('forward', 'tcp:9222', `localabstract:webview_devtools_remote_${pid}`);
      pages = await (await fetch('http://127.0.0.1:9222/json/list')).json();
      if (pages.some(page => page.webSocketDebuggerUrl)) break;
    } catch {}
    await pause(1000);
  }
  const page = pages?.find(page => page.webSocketDebuggerUrl && page.url.startsWith('https://localhost'));
  assert.ok(page, 'Packaged WebView is available');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    const request = pending.get(message.id);
    if (!request) return;
    clearTimeout(request.timer); pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error))); else request.resolve(message.result);
  });
  await command('Runtime.enable');
  for (let attempt = 0; attempt < 30; attempt++) {
    if (await evaluate('document.readyState === "complete" && !!window.FiexeaNative')) break;
    await pause(1000);
  }
  await check('Android native bridge initialized', 'document.documentElement.dataset.nativePlatform === "android" && !!window.FiexeaNative');
  await check('Welcome offers seven days without registration', '!document.getElementById("fiexeaWelcomeView").hidden && document.getElementById("fiexeaWelcomeTrial").getClientRects().length > 0');
  await evaluate('document.getElementById("fiexeaWelcomeLogin").click()');
  await check('Login form visible without a session' , '!document.getElementById("fiexeaLoginView").hidden && document.getElementById("fiexeaEmail").getClientRects().length > 0');
  await check('Logo loaded from package', 'document.querySelector(".fiexea-auth-logo").naturalWidth > 0');
  screenshot('01-login');
  await evaluate('document.getElementById("fiexeaForgotBtn").click()');
  await check('Password recovery opens', '!document.getElementById("fiexeaForgotView").hidden && document.getElementById("fiexeaLoginView").hidden');
  screenshot('02-password-recovery');
  await evaluate('document.getElementById("fiexeaBackLoginBtn").click()');
  await check('Return to login', '!document.getElementById("fiexeaLoginView").hidden && document.getElementById("fiexeaForgotView").hidden');
  adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0');
  adb('shell', 'settings', 'put', 'system', 'user_rotation', '1');
  await pause(2000);
  await check('Login survives landscape rotation', 'document.getElementById("fiexeaAuthSubmit").getClientRects().length > 0 && document.documentElement.scrollWidth <= innerWidth + 1');
  screenshot('03-landscape');
  adb('shell', 'settings', 'put', 'system', 'user_rotation', '0');
  adb('shell', 'input', 'keyevent', 'KEYCODE_HOME');
  await pause(1000);
  adb('shell', 'am', 'start', '-W', '-n', `${app}/.MainActivity`);
  await pause(1000);
  await check('Login survives background and resume', '!document.getElementById("fiexeaLoginView").hidden && !!window.FiexeaNative');
  await command('Network.enable');
  await command('Network.setBlockedURLs', { urls: ['*cdn.jsdelivr.net*', '*cdnjs.cloudflare.com*', '*tessdata.projectnaptha.com*'] });
  await check('Packaged PDF reader extracts and renders a receipt without CDN access', `(async()=>{
    const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 100] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
    const stream='BT /F1 20 Tf 10 50 Td (TOTAL 42.80) Tj ET';
    objects.push('<< /Length '+stream.length+' >>\\nstream\\n'+stream+'\\nendstream');
    let pdf='%PDF-1.4\\n';const offsets=[0];
    objects.forEach((object,i)=>{offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\\n'+object+'\\nendobj\\n'});
    const xref=pdf.length;pdf+='xref\\n0 6\\n0000000000 65535 f \\n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \\n').join('')+'trailer\\n<< /Size 6 /Root 1 0 R >>\\nstartxref\\n'+xref+'\\n%%EOF';
    const pdfTask=pdfjsLib.getDocument({data:new TextEncoder().encode(pdf),isEvalSupported:false,standardFontDataUrl:new URL('vendor/pdf/standard_fonts/',document.baseURI).href});const doc=await pdfTask.promise;
    try{const page=await doc.getPage(1),text=await page.getTextContent(),canvas=document.createElement('canvas'),viewport=page.getViewport({scale:1});canvas.width=viewport.width;canvas.height=viewport.height;await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;return text.items.some(item=>item.str.includes('42.80'))}finally{await pdfTask.destroy()}
  })()`);
  await check('Packaged Spanish OCR reads a receipt without CDN access', `(async()=>{
    await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='vendor/tesseract.min.js';script.onload=resolve;script.onerror=reject;document.head.appendChild(script)});
    const canvas=document.createElement('canvas');canvas.width=900;canvas.height=200;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,900,200);ctx.fillStyle='black';ctx.font='60px sans-serif';ctx.fillText('TOTAL 42,80',40,120);
    const worker=await Tesseract.createWorker('spa',1,{workerPath:new URL('vendor/worker.min.js',document.baseURI).href,corePath:new URL('vendor/tesseract-core',document.baseURI).href,langPath:new URL('vendor/tessdata',document.baseURI).href});
    try{const result=await worker.recognize(canvas);return result.data.text.includes('42')}finally{await worker.terminate()}
  })()`);
  assert.equal(errors.length, 0, 'No uncaught JavaScript exceptions during smoke test');
  results.push('No uncaught JavaScript exceptions during smoke test');
} finally {
  screenshot('04-final');
  writeFileSync(`${out}/report.json`, JSON.stringify({ checks: results, exceptions: errors, scope: 'Fresh install; no login, financial data, purchase, or server mutation.' }, null, 2));
  writeFileSync(`${out}/logcat.txt`, adb('logcat', '-d', '-t', '1000'));
  ws?.close();
}

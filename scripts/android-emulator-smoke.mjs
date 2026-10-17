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
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
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
  await check('Login form visible without a session', '!document.getElementById("fiexeaLoginView").hidden && document.getElementById("fiexeaEmail").getClientRects().length > 0');
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
  assert.equal(errors.length, 0, 'No uncaught JavaScript exceptions during smoke test');
  results.push('No uncaught JavaScript exceptions during smoke test');
} finally {
  screenshot('04-final');
  writeFileSync(`${out}/report.json`, JSON.stringify({ checks: results, exceptions: errors, scope: 'Fresh install; no login, financial data, purchase, or server mutation.' }, null, 2));
  writeFileSync(`${out}/logcat.txt`, adb('logcat', '-d', '-t', '1000'));
  ws?.close();
}

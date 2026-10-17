import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const config=JSON.parse(fs.readFileSync('capacitor.config.json','utf8'));
assert.equal(config.server?.url,undefined,'Native app must load its packaged resources');
assert.equal(config.server?.cleartext,false);
const html=fs.readFileSync('dist/mobile/index.html','utf8');
assert.ok(html.includes('fiexea_financial_data'),'Mobile entry must be the finance app, not the landing page');
assert.ok(html.includes('vendor/native.js'));
assert.ok(!html.includes('cdn.jsdelivr.net/npm/@supabase'));
assert.ok(!html.includes('window.location.href=result.url'),'Web checkout must not be active in development mobile builds');
assert.ok(!html.includes('function openBillingPortal(){\n  const button='));
for(const match of html.matchAll(/<script[^>]+src="([^"]+)"/g)){
 const file=match[1].split('?')[0];assert.ok(!/^https?:/.test(file),'Remote JavaScript found');
 assert.ok(fs.existsSync(path.join('dist/mobile',file)),`Missing ${file}`);
}
for(const file of ['android/app/src/main/AndroidManifest.xml','ios/App/App/Info.plist'])
 assert.ok(fs.readFileSync(file,'utf8').includes(config.appId),`Missing callback declaration: ${file}`);
assert.ok(fs.readFileSync('ios/App/App.xcodeproj/project.pbxproj','utf8').includes('PrivacyInfo.xcprivacy in Resources'));
if(process.argv.includes('--release')){
 const blockers=[];
 if(config.appId.endsWith('.dev'))blockers.push('Confirm the final application/bundle identifier');
 blockers.push('Implement and validate StoreKit / Google Play Billing, or document an eligible approved billing program');
 blockers.push('Complete legal identity, store privacy labels, review access and physical-device QA');
 throw new Error('Not ready for public store submission:\n- '+blockers.join('\n- '));
}
console.log('Mobile development checks passed. Public store release remains blocked until the documented release requirements are complete.');

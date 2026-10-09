import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(projectRoot, 'dist', 'mobile');
const supabaseUmd = path.join(
  projectRoot,
  'node_modules',
  '@supabase',
  'supabase-js',
  'dist',
  'umd',
  'supabase.js',
);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(path.join(outputDirectory, 'vendor'), { recursive: true });

for (const file of ['i18n.js', 'fiexea-logo.png']) {
  await cp(path.join(projectRoot, file), path.join(outputDirectory, file));
}
await cp(path.join(projectRoot, 'assets'), path.join(outputDirectory, 'assets'), { recursive: true });

let html = await readFile(path.join(projectRoot, 'index.html'), 'utf8');
const supabaseCdnTag = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>';
if (html.split(supabaseCdnTag).length !== 2) {
  throw new Error('Expected exactly one Supabase CDN script reference in the web entry point.');
}
html = html.replace(supabaseCdnTag, '<script src="vendor/supabase.js"></script>');
await writeFile(path.join(outputDirectory, 'index.html'), html);
await cp(supabaseUmd, path.join(outputDirectory, 'vendor', 'supabase.js'));

console.log('Prepared dist/mobile with local FIEXEA resources and the pinned Supabase UMD bundle.');

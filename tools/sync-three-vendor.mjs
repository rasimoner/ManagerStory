import { mkdir, copyFile, readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const pkg = JSON.parse(await readFile(new URL('node_modules/three/package.json', root)));
if (pkg.version !== '0.180.0') throw new Error('Expected audited Three.js 0.180.0');
const target = new URL('dist/vendor/three/', root);
await mkdir(target, { recursive: true });
for (const name of ['three.module.min.js', 'three.core.min.js']) {
  await copyFile(new URL('node_modules/three/build/' + name, root), new URL(name, target));
}
await copyFile(new URL('node_modules/three/LICENSE', root), new URL('LICENSE', target));

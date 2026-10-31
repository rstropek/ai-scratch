// Workaround: the Node build of @scratch/scratch-vm bundles jsdom, which reads
// "../../browser/default-stylesheet.css" relative to dist/node at load time,
// but that file is not shipped in the npm package. Copy it from jsdom.
// Packages are resolved through Node because the workspace root hoists them out of this folder.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const resolve = (pkg: string): string | undefined => {
  try {
    return require.resolve(pkg);
  } catch {
    return undefined;
  }
};

const vmMain = resolve('@scratch/scratch-vm'); // <vm>/dist/node/scratch-vm.js
if (vmMain) {
  const dir = path.join(path.dirname(vmMain), '../../browser');
  const jsdomMain = resolve('jsdom'); // <jsdom>/lib/api.js
  const src = jsdomMain && path.join(path.dirname(jsdomMain), 'jsdom/browser/default-stylesheet.css');
  fs.mkdirSync(dir, { recursive: true });
  const dst = path.join(dir, 'default-stylesheet.css');
  if (src && fs.existsSync(src)) fs.copyFileSync(src, dst);
  else fs.writeFileSync(dst, '');
}

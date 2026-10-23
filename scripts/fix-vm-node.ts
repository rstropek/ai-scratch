// Workaround: the Node build of @scratch/scratch-vm bundles jsdom, which reads
// "../../browser/default-stylesheet.css" relative to dist/node at load time,
// but that file is not shipped in the npm package. Copy it from jsdom.
import fs from 'node:fs';

const src = 'node_modules/jsdom/lib/jsdom/browser/default-stylesheet.css';
const dst = 'node_modules/@scratch/scratch-vm/browser/default-stylesheet.css';
if (fs.existsSync('node_modules/@scratch/scratch-vm')) {
  fs.mkdirSync('node_modules/@scratch/scratch-vm/browser', { recursive: true });
  if (fs.existsSync(src)) fs.copyFileSync(src, dst);
  else fs.writeFileSync(dst, '');
}

// Production build step (after `vite build`):
// 1. copies the unmodified Scratch standalone build to dist/scratch, without what the browser never
//    loads (source maps, the non-standalone bundle, type declarations);
// 2. writes .br and .gz next to every compressible file in dist/client, dist/scratch and dist/slides, so the server
//    sends the 17 MB editor bundle as ~4-6 MB without compressing on every request.
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import zlib from 'node:zlib';

const SOURCE = 'node_modules/@scratch/scratch-gui/dist';
const DIST = 'dist';
const SKIP = [/\.map$/, /^scratch-gui\.js/, /^types\//];
const COMPRESSIBLE = /\.(js|mjs|css|html|json|svg|txt|wasm)$/;

const brotli = promisify(zlib.brotliCompress);
const gzip = promisify(zlib.gzip);

const files = (dir: string): string[] =>
  fs.readdirSync(dir, { recursive: true, withFileTypes: true }).flatMap((e) => {
    const full = path.join(e.parentPath, e.name);
    return e.isFile() ? [full] : [];
  });

const copyScratch = () => {
  const target = path.join(DIST, 'scratch');
  fs.rmSync(target, { recursive: true, force: true });
  let count = 0;
  for (const file of files(SOURCE)) {
    const rel = path.relative(SOURCE, file);
    if (SKIP.some((re) => re.test(rel))) continue;
    fs.mkdirSync(path.dirname(path.join(target, rel)), { recursive: true });
    fs.copyFileSync(file, path.join(target, rel));
    count++;
  }
  console.log(`copied ${count} Scratch files to ${target}`);
};

const compress = async (dir: string) => {
  const todo = files(dir).filter((f) => COMPRESSIBLE.test(f) && fs.statSync(f).size > 1024);
  let before = 0;
  let after = 0;
  for (const file of todo) {
    const data = fs.readFileSync(file);
    const [br, gz] = await Promise.all([
      brotli(data, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } }),
      gzip(data, { level: 9 }),
    ]);
    fs.writeFileSync(`${file}.br`, br);
    fs.writeFileSync(`${file}.gz`, gz);
    before += data.length;
    after += br.length;
  }
  const mb = (n: number) => (n / 1e6).toFixed(1);
  console.log(`compressed ${todo.length} files in ${dir}: ${mb(before)} MB -> ${mb(after)} MB (brotli)`);
};

copyScratch();
await compress(path.join(DIST, 'client'));
await compress(path.join(DIST, 'scratch'));
// the slide deck, when slides/ was built before (the Docker image does)
if (fs.existsSync(path.join(DIST, 'slides'))) await compress(path.join(DIST, 'slides'));

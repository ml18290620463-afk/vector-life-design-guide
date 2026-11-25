import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = 'dist';
const manifest = JSON.parse(readFileSync(join(root, '.vite/manifest.json'), 'utf8'));
const budget = JSON.parse(readFileSync('resource-budget.json', 'utf8'));
const initial = new Set();
const visited = new Set();
function visit(key) {
  if (visited.has(key)) return;
  visited.add(key);
  const item = manifest[key];
  if (!item) throw new Error(`Missing manifest entry: ${key}`);
  initial.add(item.file);
  for (const css of item.css ?? []) initial.add(css);
  for (const dependency of item.imports ?? []) visit(dependency);
}
for (const [key, item] of Object.entries(manifest)) if (item.isEntry) visit(key);
if (!initial.size) throw new Error('No initial resources found');
// React.lazy App and NOW are required by the first empty-vault screen, even
// though Vite records them as dynamic imports. Include their static closure.
const appRoots = Object.entries(manifest).filter(([, item]) => item.name === 'App');
if (appRoots.length !== 1) throw new Error('Expected one App startup root');
visit(appRoots[0][0]);
visit('features/now/NowFlow.tsx');
const size = (name) => statSync(join(root, name)).size;
const gzip = (name) => gzipSync(readFileSync(join(root, name))).length;
const sw = readFileSync(join(root, 'sw.js'), 'utf8');
const precache = [...new Set([...sw.matchAll(/\{url:"([^"]+)",revision:/g)].map((m) => m[1]))];
if (!precache.includes('index.html')) throw new Error('Cannot read generated precache manifest');
if (precache.some((name) => /\.onnx$|\.wasm$|^models\//.test(name)))
  throw new Error('Lazy model was precached');
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) =>
    item.isDirectory() ? files(join(directory, item.name)) : [join(directory, item.name)],
  );
}
const models = files(join(root, 'models'));
const wasm = files(join(root, 'assets')).filter((name) => /ort-.*\.(wasm|mjs)$/.test(name));
const result = {
  initialJsGzip: [...initial].filter((n) => n.endsWith('.js')).reduce((a, n) => a + gzip(n), 0),
  initialCssGzip: [...initial].filter((n) => n.endsWith('.css')).reduce((a, n) => a + gzip(n), 0),
  precacheBytes: precache.reduce((a, n) => a + size(n), 0),
  lazyModelBytes: models.reduce((a, n) => a + statSync(n).size, 0),
  lazyRuntimeBytes: wasm.reduce((a, n) => a + statSync(n).size, 0),
};
console.log(
  JSON.stringify(
    { bytes: result, limits: budget, initialFiles: [...initial], precacheFiles: precache.length },
    null,
    2,
  ),
);
for (const [key, actual] of Object.entries(result)) {
  if (!Number.isFinite(budget[key]) || actual > budget[key])
    throw new Error(`${key}: ${actual} exceeds ${budget[key]}`);
}

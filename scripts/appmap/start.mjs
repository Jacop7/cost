import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLocalEnvironment, createAppmapServer } from './server.mjs';
import { buildModel } from './model.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
assertLocalEnvironment(root);
buildModel(root);
const server = createAppmapServer({ root });
let metro;
server.on('error', e => { console.error(e.message); process.exitCode = 1; metro?.kill(); });
server.listen(8091, '127.0.0.1', () => {
  metro = spawn(process.execPath, [resolve(dirname(require.resolve('expo/package.json')), 'bin/cli'), 'start', '--web', '--port', '8094'],
    { cwd: resolve(root, 'apps/mobile'), stdio: 'inherit', windowsHide: true });
  metro.on('exit', code => { server.close(); process.exitCode = code ?? 1; });
  console.log('실제 Expo: http://localhost:8091/ · 탭 탐색: http://localhost:8091/appmap/');
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { metro?.kill(); server.close(); });

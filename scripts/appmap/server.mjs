import http from 'node:http';
import net from 'node:net';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildModel } from './model.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(here, '../..');
const files = new Map([
  ['/appmap/', ['index.html', 'text/html; charset=utf-8']],
  ['/appmap/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/appmap/bridge.js', ['bridge.js', 'text/javascript; charset=utf-8']],
  ['/appmap/samples.js', ['samples.js', 'text/javascript; charset=utf-8']],
  ['/appmap/navigation.mjs', ['navigation.mjs', 'text/javascript; charset=utf-8']],
  ['/appmap/style.css', ['style.css', 'text/css; charset=utf-8']],
]);
const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
// Inline, before any external script: a missing bridge must never enable writes.
export function previewBootstrap() {
  const original = window.fetch;
  window.__APPMAP_UNGUARDED_FETCH__ = original;
  window.fetch = async function(input, init) {
    const u = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url, location.href);
    const method = (init?.method ?? input?.method ?? 'GET').toUpperCase();
    if (u.pathname.includes('/rpc/') || (!['GET','HEAD','OPTIONS'].includes(method) && u.pathname !== '/auth/v1/token')) {
      return new Response(JSON.stringify({ code: 'APPMAP_PREVIEW_STARTING', message: '샘플 보호 장치 준비 전에는 데이터를 변경할 수 없습니다.' }), { status: 403, headers: { 'content-type': 'application/json' } });
    }
    return original.call(this, input, init);
  };
}
export function assertLocalEnvironment(root) {
  if (process.env.NODE_ENV === 'production') throw Error('AppMap is development-only');
  // This repository's web client already forces loopback, independently of the
  // native phone's LAN URL. Do not change that existing product configuration.
  const client = readFileSync(resolve(root, 'apps/mobile/src/lib/supabase.ts'), 'utf8');
  if (client.includes("const SUPABASE_URL = Platform.OS === 'web' ? `http://127.0.0.1:${localPort}` : ENV_URL;")) return;
  // Explicit process environment wins, as it does for Expo. Never rewrite .env.
  let effective = process.env.EXPO_PUBLIC_SUPABASE_URL;
  for (const name of ['.env.development.local', '.env.local', '.env.development', '.env']) {
    if (effective) break;
    try { effective = [...readFileSync(resolve(root, 'apps/mobile', name), 'utf8').matchAll(/^\s*EXPO_PUBLIC_SUPABASE_URL\s*=\s*["']?([^\s"'#]+)/gm)].at(-1)?.[1]; }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  if (!effective || [effective].some(v => {
    try { const u = new URL(v); return u.protocol !== 'http:' || !localHosts.has(u.hostname); } catch { return true; }
  })) throw Error('AppMap requires an explicitly configured loopback Supabase URL');
}

export function createAppmapServer({ root = defaultRoot, upstreamPort = 8094 } = {}) {
  if (!Number.isInteger(upstreamPort) || upstreamPort < 1024 || upstreamPort > 65535) throw Error('Invalid upstream port');
  const fail = (res, code, message) => { res.writeHead(code, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }); res.end(message); };
  function allowed(req) { try { return localHosts.has(new URL(`http://${req.headers.host}`).hostname); } catch { return false; } }
  const server = http.createServer((req, res) => {
    if (!allowed(req)) return fail(res, 403, 'Loopback Host required');
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/appmap') { res.writeHead(302, { location: '/appmap/' + url.search }); res.end(); return; }
    if (url.pathname.startsWith('/appmap/')) {
      if (!['GET', 'HEAD'].includes(req.method)) return fail(res, 405, 'Read-only catalog endpoint');
      try {
        assertLocalEnvironment(root);
        const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin' };
        let body;
        if (url.pathname === '/appmap/model.json') { body = JSON.stringify(buildModel(root)); headers['content-type'] = 'application/json; charset=utf-8'; }
        else if (files.has(url.pathname)) { const [file, mime] = files.get(url.pathname); body = readFileSync(resolve(here, file)); headers['content-type'] = mime; }
        else return fail(res, 404, 'Unknown AppMap resource');
        res.writeHead(200, headers); res.end(req.method === 'HEAD' ? undefined : body); return;
      } catch (e) { return fail(res, 503, e.message); }
    }
    const embedded = url.searchParams.get('__appmap') === '1';
    const sampleTarget = embedded && url.searchParams.get('__appmap_sample') === '1' ? url.searchParams.get('__appmap_target') : null;
    const run = embedded ? url.searchParams.get('__appmap_run') : null;
    if (embedded) {
      try { assertLocalEnvironment(root); } catch (e) { return fail(res, 503, e.message); }
      url.searchParams.delete('__appmap');
      url.searchParams.delete('__appmap_sample'); url.searchParams.delete('__appmap_target');
      url.searchParams.delete('__appmap_run');
    }
    const headers = { ...req.headers, host: `localhost:${upstreamPort}` };
    if (embedded) { headers['accept-encoding'] = 'identity'; delete headers['if-none-match']; delete headers['if-modified-since']; }
    const upstream = http.request({ hostname: '127.0.0.1', port: upstreamPort, path: url.pathname + url.search, method: req.method, headers }, incoming => {
      if (embedded && /text\/html/.test(incoming.headers['content-type'] ?? '')) {
        const chunks = [];
        incoming.on('data', b => chunks.push(b));
        incoming.on('end', () => {
          // Observe existing list responses, not a second Expo renderer or provider tree.
          const config = JSON.stringify(sampleTarget).replace(/</g, '\\u003c');
          const runConfig = JSON.stringify(run).replace(/</g, '\\u003c');
          const injection = `<script>window.__APPMAP_RUN__=${runConfig}</script>` + (sampleTarget ? `<script>window.__APPMAP_SAMPLE_TARGET__=${config};(${previewBootstrap.toString()})()</script><script src="/appmap/samples.js"></script>` : '');
          const body = Buffer.concat(chunks).toString('utf8').replace(/<head([^>]*)>/i, `<head$1>${injection}<script src="/appmap/bridge.js"></script>`);
          const out = { ...incoming.headers, 'cache-control': 'no-store' }; delete out['content-length']; delete out.etag;
          res.writeHead(incoming.statusCode, out); res.end(body);
        });
      } else { res.writeHead(incoming.statusCode, incoming.headers); incoming.pipe(res); }
    });
    upstream.on('error', () => fail(res, 502, 'Expo 연결 대기 중입니다. Metro를 8094 포트에서 실행해 주세요.'));
    req.pipe(upstream);
  });
  server.on('upgrade', (req, socket, head) => {
    if (!allowed(req) || req.url.startsWith('/appmap')) return socket.destroy();
    const upstream = net.connect(upstreamPort, '127.0.0.1', () => {
      upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n` + Object.entries(req.headers).map(([k, v]) => `${k}: ${v}\r\n`).join('') + '\r\n');
      if (head.length) upstream.write(head);
      socket.pipe(upstream); upstream.pipe(socket);
    });
    upstream.on('error', () => socket.destroy()); socket.on('error', () => upstream.destroy());
    socket.on('close', () => upstream.destroy());
  });
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assertLocalEnvironment(defaultRoot);
  const model = buildModel(defaultRoot);
  const server = createAppmapServer();
  server.listen(8091, '127.0.0.1', () => console.log(`AppMap http://localhost:8091/appmap/ | ${model.counts.total} targets | Expo upstream :8094`));
  server.on('error', e => { console.error(e.message); process.exitCode = 1; });
}

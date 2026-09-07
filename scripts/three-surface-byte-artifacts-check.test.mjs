#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const checker = resolve(fileURLToPath(new URL('./three-surface-byte-artifacts-check.mjs', import.meta.url)));
const root = mkdtempSync(join(tmpdir(), 'three-surface-byte-'));
const manifestRel = 'docs/prototypes/three-surface-byte-artifacts.json';
const manifestPath = resolve(root, manifestRel);
const canonical = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const put = (path, text = '{}\n') => { const full = resolve(root, path); mkdirSync(dirname(full), { recursive: true }); writeFileSync(full, text); };
const run = () => spawnSync(process.execPath, [checker, `--root=${root}`], { encoding: 'utf8' });
const required = [
  '.gitattributes',
  'apps/mobile/src/dev/surfaceRegistry.declarations.json', 'apps/mobile/src/dev/surfaceRegistry.generated.json',
  'docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-001/advisory-ledger.json',
  'docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-001/advisory-ledger.md',
  'docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-P0-001/collaboration.md',
  'docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-P0-001/opus-direct-advisory-r1.md',
  'docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-P0-001/task.json',
  'docs/prototypes/three-surface-approved-visual-changes.json', 'docs/prototypes/three-surface-approvers.json',
  'docs/prototypes/three-surface-baseline.json', manifestRel,
  'docs/prototypes/three-surface-migration-backlog.json', 'docs/prototypes/three-surface-native-evidence.json',
  'scripts/three-surface-advisory-ledger-check.mjs', 'scripts/three-surface-advisory-ledger-check.test.mjs',
  'scripts/three-surface-byte-artifacts-check.mjs', 'scripts/three-surface-byte-artifacts-check.test.mjs',
  'scripts/three-surface-p0-check.mjs', 'scripts/three-surface-p0-check.test.mjs',
].sort((a, b) => a === manifestRel ? -1 : b === manifestRel ? 1 : a.localeCompare(b, 'en'));
let passed = 0;
const expectFail = (message) => { const result = run(); assert.notEqual(result.status, 0); assert.match(`${result.stdout}${result.stderr}`, message); passed += 1; };

try {
  const present = new Set(['.gitattributes', manifestRel, 'docs/prototypes/three-surface-baseline.json',
    'docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-001/advisory-ledger.json',
    'docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-001/advisory-ledger.md',
    'docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-P0-001/collaboration.md',
    'docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-P0-001/opus-direct-advisory-r1.md',
    'docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-P0-001/task.json',
    'scripts/three-surface-advisory-ledger-check.mjs', 'scripts/three-surface-advisory-ledger-check.test.mjs',
    'scripts/three-surface-byte-artifacts-check.mjs', 'scripts/three-surface-byte-artifacts-check.test.mjs',
    'scripts/three-surface-p0-check.mjs', 'scripts/three-surface-p0-check.test.mjs']);
  for (const path of present) if (path !== manifestRel) put(path, path.endsWith('.md') ? '# ledger\n' : '{}\n');
  const makeManifest = () => ({ schemaVersion: 2, encoding: 'UTF-8', lineEndings: 'LF', finalNewlineCount: 1,
    hashContract: 'sha256-raw-bytes-v1', artifacts: required.map((path) => ({ path, status: present.has(path) ? 'present' : 'planned',
      contentSha256: path === manifestRel ? null : present.has(path) ? sha(readFileSync(resolve(root, path))) : null })),
    readmeMarker: { path: 'apps/mobile/src/features/README.md', start: '<!-- THREE-SURFACE-STATUS:START -->', end: '<!-- THREE-SURFACE-STATUS:END -->', status: 'planned' } });
  const original = canonical(makeManifest()); put(manifestRel, original);
  assert.equal(run().status, 0); passed += 1;

  const restore = () => writeFileSync(manifestPath, original);
  const data = () => JSON.parse(original);
  const reordered = data(); [reordered.artifacts[0], reordered.artifacts[1]] = [reordered.artifacts[1], reordered.artifacts[0]];
  writeFileSync(manifestPath, canonical(reordered)); expectFail(/manifest 자체가 첫 항목/); restore();
  writeFileSync(manifestPath, `${JSON.stringify(data(), null, 4)}\n`); expectFail(/canonical JSON/); restore();
  put('docs/prototypes/three-surface-SECRET-generated.json'); expectFail(/미등록 생성 산출물/); rmSync(resolve(root, 'docs/prototypes/three-surface-SECRET-generated.json')); restore();
  put('scripts/three-surface-secret.test.mjs', '// generated\n'); expectFail(/미등록 생성 산출물/); rmSync(resolve(root, 'scripts/three-surface-secret.test.mjs')); restore();
  put('docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-P0-001/unregistered.json'); expectFail(/미등록 생성 산출물/); rmSync(resolve(root, 'docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-P0-001/unregistered.json')); restore();
  put('apps/mobile/src/dev/surfaceRegistry.generated.json'); expectFail(/status가 planned/); rmSync(resolve(root, 'apps/mobile/src/dev/surfaceRegistry.generated.json')); restore();
  writeFileSync(resolve(root, 'docs/prototypes/three-surface-baseline.json'), '{"changed":true}\n'); expectFail(/contentSha256/);
  put('docs/prototypes/three-surface-baseline.json', '{}\r\n'); expectFail(/CRLF\/CR/);
  assert.equal(passed, 9);
  console.log(`three-surface byte artifact 실행 음성 계약 ${passed}/9 PASS`);
} finally { rmSync(root, { recursive: true, force: true }); }

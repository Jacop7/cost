#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name) => argv.find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1);
const root = resolve(option('--root') ?? fileURLToPath(new URL('..', import.meta.url)));
const manifestPath = resolve(root, option('--manifest') ?? 'docs/prototypes/three-surface-byte-artifacts.json');
const manifestRel = relative(root, manifestPath).replaceAll('\\', '/');
const compareArtifacts = (a, b) => a.path === manifestRel ? -1 : b.path === manifestRel ? 1 : a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const canonical = (value) => `${JSON.stringify(value, null, 2)}\n`;
const git = (input) => spawnSync('git', input, { cwd: root, encoding: 'utf8' });
const walk = (base) => {
  const out = [];
  const visit = (dir) => { if (!existsSync(dir)) return; for (const name of readdirSync(dir)) {
    const path = join(dir, name); const stat = statSync(path);
    if (stat.isDirectory()) visit(path); else out.push(relative(root, path).replaceAll('\\', '/'));
  }};
  visit(resolve(root, base)); return out.sort();
};
const ownedGenerated = () => [...walk('docs/prototypes').filter((path) => /^docs\/prototypes\/three-surface-.*\.json$/.test(path)),
  ...walk('apps/mobile/src/dev').filter((path) => /^apps\/mobile\/src\/dev\/(?:surfaceRegistry\.(?:.*\.json|ts)|surfaceFixtureStubs\.json)$/.test(path)),
  ...walk('scripts').filter((path) => /^scripts\/three-surface-.*\.mjs$/.test(path)),
  'scripts/native-product-evidence-scope.mjs',
  ...walk('docs/ai-review/tasks').filter((path) => /^docs\/ai-review\/tasks\/PROTOTYPE-EXPO-THREE-SURFACE(?:-|\/)/.test(path)),
  'docs/프로토타입-Expo-3표면-동기화-기획안.md',
  'docs/프로토타입-Expo-3표면-동기화-세부실행서.md'].sort();

if (!existsSync(manifestPath)) throw new Error('three-surface-byte-artifacts.json이 없다.');
if (flag('--write')) {
  const head = git(['rev-parse', 'HEAD']).stdout.trim();
  if (option('--expect-commit') !== head || !/^[0-9a-f]{40}$/.test(head)) throw new Error('--write는 --expect-commit=<현재 40자 SHA>가 필요하다.');
  if (git(['status', '--porcelain=v1', '--untracked-files=all']).stdout.trim()) throw new Error('--write는 clean worktree에서만 허용된다.');
  const source = JSON.parse(readFileSync(manifestPath, 'utf8'));
  source.artifacts = source.artifacts.sort(compareArtifacts).map((item) => {
    const path = resolve(root, item.path);
    if (item.path === manifestRel || item.status !== 'present' || !existsSync(path)) return { ...item, contentSha256: item.path === manifestRel ? null : item.contentSha256 ?? null };
    return { ...item, contentSha256: sha(readFileSync(path)) };
  });
  writeFileSync(manifestPath, canonical(source));
}

const bytes = readFileSync(manifestPath); const text = bytes.toString('utf8'); const manifest = JSON.parse(text);
const failures = []; const fail = (message) => failures.push(message);
if (manifest.schemaVersion !== 2 || manifest.encoding !== 'UTF-8' || manifest.lineEndings !== 'LF' || manifest.hashContract !== 'sha256-raw-bytes-v1') fail('manifest header 계약 오류');
if (bytes[0] === 0xef || text.includes('\r') || text !== canonical(manifest)) fail('manifest canonical JSON/BOM/LF 계약 위반');
const sorted = [...(manifest.artifacts ?? [])].sort(compareArtifacts);
if (JSON.stringify(manifest.artifacts) !== JSON.stringify(sorted)) fail('artifact 배열은 manifest 자체가 첫 항목이고 나머지는 path 정렬이어야 한다');
const paths = new Set();
for (const item of manifest.artifacts ?? []) {
  if (paths.has(item.path)) fail(`중복 artifact ${item.path}`); paths.add(item.path);
  if (!['present', 'planned'].includes(item.status)) fail(`${item.path} status 오류`);
  const path = resolve(root, item.path); let itemBytes;
  try { itemBytes = readFileSync(path); } catch { if (item.status === 'present') fail(`${item.path} present인데 파일이 없다`); continue; }
  if (item.status === 'planned') { fail(`${item.path} 파일이 생겼는데 manifest status가 planned다`); continue; }
  if (itemBytes[0] === 0xef && itemBytes[1] === 0xbb && itemBytes[2] === 0xbf) fail(`${item.path} BOM 금지`);
  const itemText = itemBytes.toString('utf8');
  if (itemText.includes('\r')) fail(`${item.path} CRLF/CR 금지`);
  if (!itemText.endsWith('\n') || itemText.endsWith('\n\n')) fail(`${item.path} 파일 끝 개행은 정확히 1개여야 한다`);
  if (item.path === manifestRel) {
    if (item.contentSha256 !== null) fail('manifest 자기 hash는 self-reference라 null이어야 한다');
  } else if (!/^[0-9a-f]{64}$/.test(item.contentSha256 ?? '') || sha(itemBytes) !== item.contentSha256) fail(`${item.path} contentSha256 불일치`);
}
for (const discovered of ownedGenerated()) if (!paths.has(discovered)) fail(`미등록 생성 산출물 ${discovered}`);
for (const required of [
  '.gitattributes',
  manifestRel,
  'docs/prototypes/three-surface-baseline.json',
  'docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-001/advisory-ledger.json',
  'docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-001/advisory-ledger.md',
  'apps/mobile/src/dev/surfaceRegistry.declarations.json',
  'apps/mobile/src/dev/surfaceRegistry.generated.json',
  'apps/mobile/src/dev/surfaceRegistry.ts',
  'apps/mobile/src/dev/surfaceFixtureStubs.json',
  'docs/프로토타입-Expo-3표면-동기화-기획안.md',
  'docs/프로토타입-Expo-3표면-동기화-세부실행서.md',
  'docs/prototypes/three-surface-approved-visual-changes.json',
  'docs/prototypes/three-surface-native-evidence.json',
  'docs/prototypes/three-surface-approvers.json',
  'docs/prototypes/three-surface-migration-backlog.json',
  'docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-P0-001/task.json',
  'docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-P0-001/collaboration.md',
  'docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-P0-001/opus-direct-advisory-r1.md',
  'docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-P0-001/opus-direct-advisory-r2.md',
  'scripts/three-surface-p0-check.mjs',
  'scripts/three-surface-p0-check.test.mjs',
  'scripts/native-product-evidence-scope.mjs',
  'scripts/three-surface-byte-artifacts-check.mjs',
  'scripts/three-surface-byte-artifacts-check.test.mjs',
  'scripts/three-surface-advisory-ledger-check.mjs',
  'scripts/three-surface-advisory-ledger-check.test.mjs',
  'scripts/three-surface-sync-check.mjs',
  'scripts/three-surface-sync-check.test.mjs',
]) if (!paths.has(required)) fail(`닫힌 목록 필수 경로 누락: ${required}`);
if (failures.length) { console.error(failures.map((item) => `  - ${item}`).join('\n')); process.exit(1); }
console.log(`3표면 byte artifact manifest PASS — present ${manifest.artifacts.filter((item) => item.status === 'present').length} · planned ${manifest.artifacts.filter((item) => item.status === 'planned').length}`);

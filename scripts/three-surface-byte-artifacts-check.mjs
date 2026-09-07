#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const manifestPath = resolve(root, 'docs/prototypes/three-surface-byte-artifacts.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const failures = [];
const fail = (message) => failures.push(message);
const expectedSelf = 'docs/prototypes/three-surface-byte-artifacts.json';
if (manifest.schemaVersion !== 1 || manifest.encoding !== 'UTF-8' || manifest.lineEndings !== 'LF') fail('manifest header 계약 오류');
if (manifest.artifacts?.[0]?.path !== expectedSelf || manifest.artifacts?.[0]?.status !== 'present') fail('manifest 자신이 첫 present 항목이 아니다');
const paths = new Set();
for (const item of manifest.artifacts ?? []) {
  if (paths.has(item.path)) fail(`중복 artifact ${item.path}`); paths.add(item.path);
  if (!['present', 'planned'].includes(item.status)) fail(`${item.path} status 오류`);
  const path = resolve(root, item.path); let bytes;
  try { bytes = readFileSync(path); } catch { if (item.status === 'present') fail(`${item.path} present인데 파일이 없다`); continue; }
  if (item.status === 'planned') fail(`${item.path} 파일이 생겼는데 manifest status가 planned다`);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) fail(`${item.path} BOM 금지`);
  const text = bytes.toString('utf8');
  if (text.includes('\r')) fail(`${item.path} CRLF/CR 금지`);
  if (!text.endsWith('\n') || text.endsWith('\n\n')) fail(`${item.path} 파일 끝 개행은 정확히 1개여야 한다`);
}
for (const required of [
  expectedSelf,
  'docs/prototypes/three-surface-baseline.json',
  'docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-001/advisory-ledger.json',
  'docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-001/advisory-ledger.md',
  'apps/mobile/src/dev/surfaceRegistry.declarations.json',
  'apps/mobile/src/dev/surfaceRegistry.generated.json',
  'docs/prototypes/three-surface-approved-visual-changes.json',
  'docs/prototypes/three-surface-native-evidence.json',
  'docs/prototypes/three-surface-approvers.json',
  'docs/prototypes/three-surface-migration-backlog.json',
]) if (!paths.has(required)) fail(`닫힌 목록 필수 경로 누락: ${required}`);
if (failures.length) { console.error(failures.map((item) => `  - ${item}`).join('\n')); process.exit(1); }
console.log(`3표면 byte artifact manifest PASS — present ${manifest.artifacts.filter((item) => item.status === 'present').length} · planned ${manifest.artifacts.filter((item) => item.status === 'planned').length}`);


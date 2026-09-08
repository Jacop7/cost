import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { textSha256 } from './full-page-flow-prototype-text-sha256.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, name), 'utf8');

test('같은 HTML의 LF와 CRLF는 같은 적용본 SHA다', () => {
  const lf = '<!doctype html>\n<!-- DESIGN_SYNC: DS-20260905-005 -->\n';
  assert.equal(textSha256(lf), textSha256(lf.replace(/\n/g, '\r\n')));
});

test('UTF-8 BOM 유무는 같은 텍스트 증거 SHA다', () => {
  const text = '# 계약\n값\n';
  assert.equal(textSha256(text), textSha256(`\uFEFF${text}`));
});

test('세 DOM 감사기는 적용본과 자기 스크립트를 공용 textSha256로 재다', () => {
  for (const name of [
    'full-page-flow-prototype-render-audit.mjs',
    'full-page-flow-prototype-design-audit.mjs',
    'full-page-flow-prototype-i18n-stress.mjs',
  ]) {
    const src = read(name);
    assert.match(src, /import \{ textSha256 \} from '\.\/full-page-flow-prototype-text-sha256\.mjs'/, name);
    assert.match(src, /target:\s*\{[^\n]*sha256:\s*textSha256\(bytes\)/, name);
  }
});

test('PowerShell 소비자와 sync-state는 적용본 원시 바이트 해시를 쓰지 않는다', () => {
  const src = read('full-page-flow-prototype-design-sync-check.ps1');
  assert.doesNotMatch(src, /Get-RawFileSha256/);
  assert.equal((src.match(/Get-NormalizedTextSha256 \(Read-Utf8 \(Join-Path \$PrototypeDirectory '0_full-page-flow-prototype-ui-applied\.html'\)\)/g) ?? []).length, 3);
  assert.match(src, /\$hashes\[\$fileName\] = Get-Sha256 \$contentsByFile\[\$fileName\]/);
});

test('프로토타입 대비 게이트도 스크립트와 계약을 공용 textSha256로 재다', () => {
  const src = read('full-page-flow-prototype-contrast-gate.mjs');
  assert.match(src, /import \{ textSha256 \} from '\.\/full-page-flow-prototype-text-sha256\.mjs'/);
  assert.match(src, /scriptSha256:\s*textSha256\(/);
  assert.match(src, /contractSha256:\s*textSha256\(/);
});

test('해시 지점 전수표는 ID가 유일하고 모든 지점의 정규화 계약을 명시한다', () => {
  const inventory = JSON.parse(read('full-page-flow-prototype-hash-inventory.json'));
  assert.equal(inventory.contract, 'utf8-bom-strip-crlf-to-lf-sha256-v1');
  assert.equal(inventory.points.length, 18);
  assert.equal(new Set(inventory.points.map((p) => p.id)).size, inventory.points.length);
  const allowed = new Set(['shared-textSha256', 'powershell-crlf-to-lf-parity', 'canonical-json', 'git-blob-sha', 'domain-contract']);
  for (const point of inventory.points) assert.ok(allowed.has(point.normalization), point.id);
});

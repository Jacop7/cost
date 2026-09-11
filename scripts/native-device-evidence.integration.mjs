// Repository/device snapshot assertions are advisory, unlike validator unit tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildEvidenceReceipt, scaledLayoutWitness, verifyEvidenceReceipt, verifyRepositoryEvidence } from './native-touch-runtime-evidence-check.mjs';
import { PRODUCT_GENERATED_EXCLUSIONS, productScopeChanged } from './native-product-evidence-scope.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const json = path => JSON.parse(readFileSync(join(root, path), 'utf8'));
const contract = json('scripts/native-touch-runtime-contract.json');
const source = json('docs/prototypes/native-touch-android-1x.json');

test('closedPlatforms의 exact 증거는 원시 frame 재계산과 현재 제품 범위에 결속된다', () => {
  assert.deepEqual(verifyRepositoryEvidence(root, { requirePlatforms: ['android'] }).failures, []);
});
test('프로토타입 SHA만 담는 생성 레지스트리는 네이티브 제품 증거를 무효화하지 않는다', () => {
  assert.deepEqual(PRODUCT_GENERATED_EXCLUSIONS, ['apps/mobile/src/dev/surfaceRegistry.generated.json']);
  const productCommit = source.manifest.productCommit;
  assert.notEqual(spawnSync('git', ['diff', '--quiet', productCommit, 'HEAD', '--', 'apps/mobile'], { cwd: root }).status, 0);
  assert.equal(productScopeChanged(root, productCommit), false);
});
test('작은 영수증도 원시 증거·제품 SHA·검사 계약 해시에 결속된다', () => {
  const verification = verifyRepositoryEvidence(root, { requirePlatforms: ['android'] });
  const receipt = buildEvidenceReceipt(root, verification, ['android']);
  assert.equal(receipt.status, 'PASS');
  assert.deepEqual(receipt.requirePlatforms, ['android']);
  assert.equal(receipt.cells.length, 2);
  assert.equal(receipt.tapProbeCells.length, 1);
  assert.equal(receipt.tapProbeCells[0].probeCount, 3);
  assert.deepEqual(receipt.cells.map(cell => cell.coverage), [
    { observedRows: 246, fullyVisibleRows: 165, excludedScrollableOrRootRows: 81, targetShortCount: 0 },
    { observedRows: 246, fullyVisibleRows: 127, excludedScrollableOrRootRows: 119, targetShortCount: 0 },
  ]);
  assert.ok(receipt.cells.every(cell => cell.status === 'PRESENT' && cell.textSha256.length === 64));
  assert.equal(new Set(receipt.cells.map(cell => cell.productCommit)).size, 1);
  assert.ok(Object.values(receipt.contracts).every(item => item.textSha256.length === 64));
});
test('커밋된 영수증은 현재 원시 증거와 exact 일치하고 closedPlatforms와 같은 범위를 요구한다', () => {
  const result = verifyEvidenceReceipt(root);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.receipt.requirePlatforms, contract.closedPlatforms);
});
test('전체 4칸 요구는 iOS 증거가 없으면 MISSING으로 설명하고, 있으면 전부 검증한다', () => {
  const failures = verifyRepositoryEvidence(root, { requirePlatforms: ['android', 'ios'] }).failures;
  const iosExists = ['native-touch-ios-1x.json', 'native-touch-ios-2x.json']
    .every(name => { try { readFileSync(join(root, 'docs/prototypes', name)); return true; } catch { return false; } });
  if (iosExists) {
    const witness = scaledLayoutWitness(json('docs/prototypes/native-touch-ios-1x.json'), json('docs/prototypes/native-touch-ios-2x.json'));
    if (witness.dimensionChanged) assert.deepEqual(failures, []);
    else assert.match(failures.join('\n'), /크기가 달라진 동일 제품 frame이 없다/);
  } else assert.match(failures.join('\n'), /MISSING native-touch-ios-1x\.json.*MISSING native-touch-ios-2x\.json/s);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dominantTapViewport, supplementTextArtifact } from './native-text-scale-rederive.mjs';

const tap = { device: { model: 'iPhone15Pro', osVersion: '26.5.2', density: 3 }, frames: {
  initial: { ancestors: [{ host: 'RNSScreenContentWrapper', frame: [0, 0, 393, 758] }] },
} };
const artifact = { device: { model: null, osVersion: '26.5.2', density: 3, screen: { width: 393, height: 852 } }, manifest: {} };

test('같은 iOS tap probe의 model과 콘텐츠 viewport만 보충한다', () => {
  assert.deepEqual(dominantTapViewport(tap), { width: 393, height: 758 });
  const result = supplementTextArtifact(structuredClone(artifact), tap);
  assert.equal(result.device.model, 'iPhone15Pro');
  assert.deepEqual(result.manifest.deviceIdentitySupplement.matched.contentViewportDp, { width: 393, height: 758 });
});

test('OS·density·화면 width가 다른 tap probe는 보충 출처가 될 수 없다', () => {
  const wrong = structuredClone(artifact);
  wrong.device.screen.width = 430;
  assert.throws(() => supplementTextArtifact(wrong, tap), /다르다/);
});

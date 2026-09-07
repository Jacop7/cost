import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertSameIosIdentity, dominantScreenContentViewport } from './native-touch-runtime-rederive.mjs';

const artifact = {
  device: { osVersion: '26.5.2', density: 3 },
  scenarios: [{ phases: [{ rows: [{ ancestors: [
    { hostName: 'RNSScreenContentWrapper', windowMeasure: [0, 0, 393, 758] },
  ] }] }] }],
};
const tap = {
  device: { osVersion: '26.5.2', density: 3 },
  frames: { initial: { ancestors: [
    { host: 'RNSScreenContentWrapper', frame: [0, 0, 393, 758] },
  ] } },
};

test('iOS 모델 보충은 OS·density뿐 아니라 화면 콘텐츠 width/height dp까지 일치해야 한다', () => {
  assert.deepEqual(dominantScreenContentViewport(artifact), { width: 393, height: 758 });
  assert.deepEqual(assertSameIosIdentity(artifact, tap), { width: 393, height: 758 });
  const otherPhone = structuredClone(tap);
  otherPhone.frames.initial.ancestors[0].frame = [0, 0, 430, 840];
  assert.throws(() => assertSameIosIdentity(artifact, otherPhone), /width\/height dp/);
});

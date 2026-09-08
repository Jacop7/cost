import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertSameIosIdentity, dominantScreenContentViewport } from './native-touch-runtime-rederive.mjs';

const artifact = {
  device: { id: '00008130-test', osVersion: '26.5.2', density: 3, fontScale: 1 },
  scenarios: [{ phases: [{ rows: [{ ancestors: [
    { hostName: 'RNSScreenContentWrapper', windowMeasure: [0, 0, 393, 758] },
  ] }] }] }],
};
const tap = {
  device: { id: '00008130-test', osVersion: '26.5.2', density: 3, fontScale: 1 },
  frames: { initial: { ancestors: [
    { host: 'RNSScreenContentWrapper', frame: [0, 0, 393, 758] },
  ] } },
};

test('iOS 모델 보충은 exact 기기 ID·OS·density·화면 콘텐츠 폭이 일치해야 한다', () => {
  assert.deepEqual(dominantScreenContentViewport(artifact), { width: 393, height: 758 });
  assert.deepEqual(assertSameIosIdentity(artifact, tap), {
    deviceId: '00008130-test', contentWidthDp: 393,
    sourceViewportDp: { width: 393, height: 758 }, tapViewportDp: { width: 393, height: 758 },
  });
  const otherPhone = structuredClone(tap);
  otherPhone.frames.initial.ancestors[0].frame = [0, 0, 430, 840];
  assert.throws(() => assertSameIosIdentity(artifact, otherPhone), /width dp/);
  const otherId = structuredClone(tap);
  otherId.device.id = '00008130-other';
  assert.throws(() => assertSameIosIdentity(artifact, otherId), /exact 기기 ID/);
});

test('동일 기기의 다른 글자 배율은 동적 탭바로 달라진 콘텐츠 높이를 보존한다', () => {
  const scaled = structuredClone(artifact);
  scaled.device.fontScale = 2.143;
  scaled.scenarios[0].phases[0].rows[0].ancestors[0].windowMeasure = [0, 0, 393, 703];
  assert.deepEqual(assertSameIosIdentity(scaled, tap), {
    deviceId: '00008130-test', contentWidthDp: 393,
    sourceViewportDp: { width: 393, height: 703 }, tapViewportDp: { width: 393, height: 758 },
  });
  const sameScaleWrongHeight = structuredClone(tap);
  sameScaleWrongHeight.frames.initial.ancestors[0].frame = [0, 0, 393, 703];
  assert.throws(() => assertSameIosIdentity(artifact, sameScaleWrongHeight), /같은 글자 배율/);
});

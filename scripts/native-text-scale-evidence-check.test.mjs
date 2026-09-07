import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareTextScale } from './native-text-scale-evidence-check.mjs';

const device = { platform: 'ios', density: 3, fontScale: 1, model: 'iPhone', osVersion: '26.5.2', screen: { width: 393, height: 852 }, window: { width: 393, height: 852 } };
const artifact = (fontScale, grow = true) => ({ platform: 'ios', fontScale, device: { ...device, fontScale },
  rows: Array.from({ length: 137 }, (_, i) => ({ key: `text-${i}`, label: `label-${i}`, ownerChain: [`Role-${i}`], allowFontScaling: true, fontSize: 16,
    windowMeasure: [0, i * 30, grow ? 80 * fontScale : 80, grow ? 22 * fontScale : 22] })) });

test('같은 iPhone의 2× Text host frame이 실제로 커져야 통과한다', () => {
  assert.deepEqual(compareTextScale(artifact(1), artifact(2.143)).failures, []);
  assert.match(compareTextScale(artifact(1), artifact(2, false)).failures.join('\n'), /비례해 커진/);
});

test('화면 dp가 다른 iPhone을 같은 증거쌍으로 묶지 않는다', () => {
  const other = artifact(2);
  other.device = { ...other.device, screen: { width: 430, height: 932 } };
  assert.match(compareTextScale(artifact(1), other).failures.join('\n'), /screen·window dp/);
});

test('산출물 표기와 런타임 fontScale이 다르거나 host key가 중복되면 실패한다', () => {
  const wrongScale = artifact(2);
  wrongScale.device = { ...wrongScale.device, fontScale: 1 };
  assert.match(compareTextScale(artifact(1), wrongScale).failures.join('\n'), /런타임 device/);
  const duplicate = artifact(2);
  duplicate.rows[1].key = duplicate.rows[0].key;
  assert.match(compareTextScale(artifact(1), duplicate).failures.join('\n'), /key가 중복/);
});

test('문구가 다르면 같은 owner·typography라도 통제 확대 증거가 아니다', () => {
  const one = artifact(1), two = artifact(2.143);
  two.rows.forEach((row, index) => { row.label = `changed-${index}`; row.key = `changed-${index}`; });
  assert.match(compareTextScale(one, two).failures.join('\n'), /통제 제품 Text host/);
});

test('개발 LogBox만 커진 증거로 제품 Text 확대를 통과시키지 않는다', () => {
  const one = artifact(1), two = artifact(2.143);
  for (const row of [...one.rows, ...two.rows]) row.ownerChain = ['LogBoxNotificationMessage', 'AppContainer'];
  assert.match(compareTextScale(one, two).failures.join('\n'), /통제 제품 Text host/);
});

test('0.5dp 같은 미세 성장만으로 실제 배율 확대를 통과시키지 않는다', () => {
  const one = artifact(1), two = artifact(2.143, false);
  two.rows.forEach((row) => { row.windowMeasure[2] += 0.5; row.windowMeasure[3] += 0.5; });
  assert.match(compareTextScale(one, two).failures.join('\n'), /비례해 커진/);
});

test('model이 비어 있으면 같은 null끼리라도 동일 기기로 보지 않는다', () => {
  const one = artifact(1), two = artifact(2.143);
  one.device.model = null; two.device.model = null;
  assert.match(compareTextScale(one, two).failures.join('\n'), /기기·screen·window dp/);
});

test('통제·비례 제품 Text 래칫이 대량 증거 소실을 막는다', () => {
  const one = artifact(1), two = artifact(2.143);
  one.rows.length = 129; two.rows.length = 129;
  assert.match(compareTextScale(one, two).failures.join('\n'), /통제 제품 Text host가 130건 미만/);
  const one2 = artifact(1), two2 = artifact(2.143);
  for (let index = 0; index < 18; index++) {
    two2.rows[index].windowMeasure[2] = one2.rows[index].windowMeasure[2];
    two2.rows[index].windowMeasure[3] = one2.rows[index].windowMeasure[3];
  }
  assert.match(compareTextScale(one2, two2).failures.join('\n'), /비례해 커진 통제 제품 Text host가 120건 미만/);
});

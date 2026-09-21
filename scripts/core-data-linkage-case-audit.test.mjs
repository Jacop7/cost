import assert from 'node:assert/strict';
import test from 'node:test';
import { evidenceGaps, evidenceState } from './core-data-linkage-case-audit.mjs';

test('미완료 증거 문구는 검증 완료로 세지 않는다', () => {
  for (const result of [
    '실제 전 경로 기기 확인 미완료',
    '통화별 실제 표시·기기 확인 미수집',
    '최종 판본 증거 연결',
    '최신 실행과 미대조',
    '현재 전체 SHA 미봉인',
    '판매 관련 회귀와 추가 통합 필요',
  ]) {
    assert.equal(evidenceState(result), 'needs_evidence', result);
  }
});

test('명시된 통과 증거는 검증 완료로 센다', () => {
  assert.equal(evidenceState('DB99 22개 단언과 두 세션 3경로 PASS'), 'verified');
  assert.deepEqual(evidenceGaps('DB99 22개 단언과 두 세션 3경로 PASS'), []);
});

test('미결 증거의 필요한 검수 종류를 중복 보존한다', () => {
  assert.deepEqual(
    evidenceGaps('실기기 네트워크 오류와 최종 판본 증거 연결이 미완료'),
    ['native_device', 'failure_path', 'version_binding'],
  );
  assert.deepEqual(evidenceGaps('현행 요청키 보장 없음, 실패 재현·수정 미완료'), ['implementation']);
  assert.deepEqual(evidenceGaps('전체 화면 연결 미확인'), ['integration']);
});

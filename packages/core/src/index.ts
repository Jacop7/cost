/**
 * @margincook/core — 파생값 계산 엔진 (순수 TS, 부수효과 없음).
 *
 * 용도:
 *  1) 앱(apps/mobile)의 실시간 미리보기 — 단가/손익/권장가 입력 즉시 표시.
 *  2) 검산 테스트 — CLAUDE.md 검산값(4.00원/g · 4,046.69원·33.72% · 31.3% 등) 고정.
 *
 * 주의: 영구 저장되는 확정값(전파 이벤트 결과)은 packages/db 의 RPC가 권위.
 *       두 곳의 공식이 어긋나면 안 된다 — 공식 변경 시 양쪽 동시 수정.
 */
export * from './guards';
export * from './businessDate';
export * from './round';
export * from './locale';
export * from './units';
export * from './pricing';
export * from './inventory';
export * from './recipe';
export * from './profitSnapshot';
export * from './fixedCost';
export * from './ordering';
export * from './propagation';
export * from './internationalTax';

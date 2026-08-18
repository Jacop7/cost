/**
 * 수치 입력 가드 — 가이드 불변식 6.
 * "금액과 수량은 음수·NaN·Infinity를 허용하지 않는다."
 *
 * 계산 함수 앞단에서 오염된 값을 걸러 Infinity·NaN·음수 단가가 화면이나 저장 경로로
 * 흘러가지 못하게 한다. 방어를 화면마다 복제하지 않고 여기 한 곳에 둔다.
 */

/** 유한한 0 이상 (금액·수량·누적량). */
export const isNonNegativeFinite = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** 유한한 양수 (분모로 쓰이는 용량·인분·판매량). */
export const isPositiveFinite = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0;

/** 0~1 비율 (로스율·순이익률·고정지출률). upperExclusive=true면 1 미만만 허용. */
export const isRatio = (v: unknown, upperExclusive = false): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && (upperExclusive ? v < 1 : v <= 1);

/** 계산 결과가 화면·저장으로 나가도 되는 값인지. null 은 '산출 불가'라 허용된다. */
export const isSafeResult = (v: number | null): boolean => v === null || Number.isFinite(v);

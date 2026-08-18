/** 표시·검산용 반올림 헬퍼. 계산 중간값은 풀 정밀도 유지, 표시 직전에만 반올림. */
export const round = (n: number, digits = 0): number => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

/**
 * 산출 불가(null)를 보존하는 반올림.
 * 단가 계산은 경계 입력에서 null 을 돌려주므로(가이드 불변식 6), 표시 직전 반올림에서도 null 을 유지해
 * 0원으로 위장하지 않는다. 표시 계층은 null 을 '-' 로 그린다.
 */
export const roundOrNull = (n: number | null, digits = 0): number | null =>
  n === null ? null : round(n, digits);

/** 순이익률 등 % 1자리. */
export const pct1 = (ratio: number): number => round(ratio * 100, 1);

/** 원 단위 정수. */
export const won = (n: number): number => Math.round(n);

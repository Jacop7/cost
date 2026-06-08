/** 표시·검산용 반올림 헬퍼. 계산 중간값은 풀 정밀도 유지, 표시 직전에만 반올림. */
export const round = (n: number, digits = 0): number => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

/** 순이익률 등 % 1자리. */
export const pct1 = (ratio: number): number => round(ratio * 100, 1);

/** 원 단위 정수. */
export const won = (n: number): number => Math.round(n);

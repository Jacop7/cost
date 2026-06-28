// num.ts — 숫자 입력 정리(소수점 자릿수 제한).
// 단위별 허용 소수점: kg=3, g=2, L=2, ml=0, 개=0, 박스=0.

export const unitDecimals = (unit: string): number => {
  if (unit === 'kg') return 3;
  if (unit === 'g' || unit === 'L') return 2;
  return 0; // ml · 개 · 박스 (정수)
};

/** 입력 텍스트를 숫자(소수점 decimals 자리)로 정리. 콤마·문자 제거, 점 1개, decimals=0이면 정수. */
export function clampDecimals(text: string, decimals: number): string {
  let s = text.replace(/[^\d.]/g, '');
  const dot = s.indexOf('.');
  if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, ''); // 점은 1개만
  if (decimals === 0) return s.split('.')[0] ?? ''; // 정수: 소수점 이전만
  if (dot === -1) return s;
  const [intp, decp = ''] = s.split('.');
  return intp + '.' + decp.slice(0, decimals);
}

/** 단위 기준으로 소수점 정리. */
export const clampByUnit = (text: string, unit: string): string => clampDecimals(text, unitDecimals(unit));

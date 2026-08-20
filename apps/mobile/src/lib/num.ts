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

/**
 * 산출 불가(null)를 화면 표기로 바꾼다.
 * `@sikjae/core` 의 단가 계산은 용량 0·로스율 100% 이상 같은 경계에서 null 을 돌려준다(불변식 6).
 * 이때 0 으로 그리면 "0원 단가"라는 거짓 정보가 되므로 '-' 로 비워 둔다.
 */
export const dash = (v: number | null | undefined): string => (v == null ? '-' : String(v));

/**
 * 구매 한 건을 한 줄로 — `총 6kg (3kg × 2개) · 30,000원`.
 *
 * 들어온 **양이 먼저**다. 재고에 실제로 더해진 값이고 팩 구성은 그 근거다.
 * 금액도 **총액**이다 — 팩 1개 금액을 총액처럼 보이면 3배 싸게 산 것처럼 읽힌다.
 *
 * 팩이 하나뿐이면 괄호를 뺀다. `총 3kg (3kg × 1개)` 는 같은 숫자를 두 번 말한다.
 */
export function packSummary(opts: {
  /** 팩 1개 용량(기준단위) */
  volume: number;
  /** 주문한 개수 */
  qty: number;
  /** 실제로 받은 개수. 주문과 다르면 그 사실이 단가와 재고를 바꾼다. */
  receivedQty?: number | null;
  /** 팩 1개 금액 */
  amount: number;
  /** 양 표기 — formatQuantity 를 넘겨 받는다(단위 환산은 core 한 곳에서만 한다). */
  fmtQty: (v: number) => string;
  /** 금액 표기 */
  fmtWon: (v: number) => string;
}): string {
  const got = opts.receivedQty ?? opts.qty;
  const total = opts.volume * got;
  const paid = opts.amount * got;
  const partial = opts.receivedQty != null && opts.receivedQty !== opts.qty;

  const breakdown = partial
    ? ` (${opts.fmtQty(opts.volume)} × ${opts.qty}개 중 ${got}개)`
    : got === 1
      ? ''
      : ` (${opts.fmtQty(opts.volume)} × ${got}개)`;

  return `총 ${opts.fmtQty(total)}${breakdown} · ${opts.fmtWon(paid)}원`;
}

// num.ts — 숫자 입력 정리(소수점 자릿수 제한).
// 단위별 허용 소수점: kg=3, g=2, L=2, ml=0, 개=0, 박스=0.

export const unitDecimals = (unit: string): number => {
  if (unit === 'kg') return 3;
  if (unit === 'g' || unit === 'L') return 2;
  return 0; // ml · 개 · 박스 (정수)
};

export interface NumericInputFormat {
  /** 화면에 고정해 보여 줄 소수 자릿수. 포커스 중에는 사용자가 입력한 자리만 보존한다. */
  fixedDigits?: number;
  group?: string;
  decimal?: string;
}

/** 숫자 입력의 화면용 자릿수 구분자를 제거한다. 폼 상태와 서버에는 구분자를 저장하지 않는다. */
export function stripNumericGrouping(text: string, group = ','): string {
  return group ? text.split(group).join('') : text;
}

/**
 * 숫자 입력 문자열에 자릿수 구분자를 붙인다. `12.` 같은 입력 중간 상태는 그대로 보존하고,
 * blur 상태에서 fixedDigits가 있으면 통화 계약에 맞춰 `12.00`처럼 채운다.
 */
export function formatNumericInput(text: string | undefined, format: NumericInputFormat = {}, pad = false): string | undefined {
  if (text == null || text === '') return text;
  const group = format.group ?? ',';
  const decimal = format.decimal ?? '.';
  const ungrouped = stripNumericGrouping(text, group);
  const normalized = decimal === '.' ? ungrouped : ungrouped.split(decimal).join('.');
  if (!/^-?\d*(?:\.\d*)?$/.test(normalized) || normalized === '-' || normalized === '.' || normalized === '-.') return text;

  if (pad && format.fixedDigits != null) {
    const value = Number(normalized);
    if (Number.isFinite(value)) {
      const fixed = Math.abs(value).toFixed(format.fixedDigits);
      const [integer = '0', fraction = ''] = fixed.split('.');
      const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, group);
      return `${value < 0 ? '-' : ''}${grouped}${fraction ? decimal + fraction : ''}`;
    }
  }

  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;
  const hasDecimal = unsigned.includes('.');
  const [integer = '', fraction = ''] = unsigned.split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return `${negative ? '-' : ''}${grouped}${hasDecimal ? decimal + fraction : ''}`;
}

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

/** 부호를 없애 양수로 바꾸지 않는다. 음수 허용 여부는 각 폼의 유효성 검사가 판정한다. */
export const clampSignedDecimals = (text: string, decimals: number): string =>
  (/^\s*[-−]/.test(text) ? '-' : '') + clampDecimals(text, decimals);

/**
 * 산출 불가(null)를 화면 표기로 바꾼다.
 * `@costkeep/core` 의 단가 계산은 용량 0·로스율 100% 이상 같은 경계에서 null 을 돌려준다(불변식 6).
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
export interface PackSummaryOptions {
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
}

/** 같은 구매 계산을 합친 문장과 분리 배치가 함께 사용한다. */
export function packSummaryParts(opts: PackSummaryOptions) {
  const got = opts.receivedQty ?? opts.qty;
  const total = opts.volume * got;
  const paid = opts.amount * got;
  const partial = opts.receivedQty != null && opts.receivedQty !== opts.qty;

  const breakdown = partial
    ? ` (${opts.fmtQty(opts.volume)} × ${opts.qty}개 중 ${got}개)`
    : got === 1
      ? ''
      : ` (${opts.fmtQty(opts.volume)} × ${got}개)`;

  return { total: `총 ${opts.fmtQty(total)}`, breakdown: breakdown.trim(), amount: `${opts.fmtWon(paid)}원` };
}

export function packSummary(opts: PackSummaryOptions): string {
  const p = packSummaryParts(opts);
  return `${p.total}${p.breakdown ? ` ${p.breakdown}` : ''} · ${p.amount}`;
}

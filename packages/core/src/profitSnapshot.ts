/**
 * 손익 스냅샷 비교 (RCP-16 · 0083).
 *
 * `computeProfit()` 이 **지금 얼마인가**를 답한다면, 여기는 **얼마에서 얼마로 움직였나**를 답한다.
 * 사장님의 질문이 그거다 — 언제, 무엇 때문에, 얼마만큼.
 *
 * SQL `profit_delta_cause()` 의 미러다. 두 곳의 고르는 규칙이 어긋나면
 * 목록 줄과 상세 시트가 서로 다른 항목을 가리키게 된다(절대원칙 3).
 */
import { isNonNegativeFinite } from './guards';

/** 손익 한 시점. DB `profit_trends` 의 금액 컬럼과 같은 모양이다. */
export interface ProfitSnapshot {
  price: number;
  materialCost: number;
  extraCost: number;
  taxAmount: number;
  fixedCost: number;
  profitAmount: number;
}

/** 대표 원인이 될 수 있는 구성요소. 순이익 자체는 결과이지 원인이 아니다. */
export type ProfitCauseKey = 'price' | 'material_cost' | 'extra_cost' | 'tax_amount' | 'fixed_cost';

export interface ProfitCause {
  key: ProfitCauseKey;
  label: string;
  before: number;
  after: number;
  delta: number;
  /** `재료비 32원 감소` — 목록 한 줄. */
  summary: string;
}

/** SQL 쪽 라벨과 한 글자도 달라선 안 된다. 화면 두 곳이 같은 말을 써야 한다. */
const LABEL: Record<ProfitCauseKey, string> = {
  price: '판매가',
  material_cost: '재료비',
  extra_cost: '부자재',
  tax_amount: '세금',
  fixed_cost: '고정지출',
};

/** 안정된 순서 — 움직인 크기가 같으면 키 이름 순. SQL 의 `order by ... , v.key` 와 같다. */
const KEYS: ProfitCauseKey[] = ['extra_cost', 'fixed_cost', 'material_cost', 'price', 'tax_amount'];

const FIELD: Record<ProfitCauseKey, keyof ProfitSnapshot> = {
  price: 'price',
  material_cost: 'materialCost',
  extra_cost: 'extraCost',
  tax_amount: 'taxAmount',
  fixed_cost: 'fixedCost',
};

/**
 * 32 → `32`, 45.46 → `45.46`, 2806.4 → `2,806.40`.
 * SQL `money_short()` 미러. 정수면 소수점을 붙이지 않는다 —
 * "재료비 32.00원 감소"는 사람이 읽는 문장이 아니다.
 */
export function moneyShort(v: number): string {
  if (!Number.isFinite(v)) return '';
  const r2 = Math.round(v * 100) / 100;
  const whole = r2 === Math.round(r2);
  return r2.toLocaleString('ko-KR', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  });
}

/**
 * 두 스냅샷 사이의 **대표 원인 하나**.
 *
 * 규칙: 가장 크게 움직인 구성요소. 여러 개가 함께 바뀌어도 목록에는 하나만 쓴다 —
 * 나머지는 스냅샷에 그대로 남아 있으니 잃는 정보가 없다.
 *
 * 아무것도 안 움직였으면 `null`. 그런 재계산은 사건이 아니라서 목록에 나오지 않는다.
 * `prev` 가 없으면(첫 점) 비교 대상이 없으므로 역시 `null`이다.
 */
export function profitDeltaCause(
  prev: ProfitSnapshot | null | undefined,
  cur: ProfitSnapshot,
): ProfitCause | null {
  if (!prev) return null;

  let best: ProfitCause | null = null;
  for (const key of KEYS) {
    const before = prev[FIELD[key]];
    const after = cur[FIELD[key]];
    if (!Number.isFinite(before) || !Number.isFinite(after)) continue;

    const delta = after - before;
    // 1원의 100분의 1도 못 움직였으면 변동이 아니다. 부동소수 찌꺼기를 사건으로 만들지 않는다.
    if (Math.round(Math.abs(delta) * 100) / 100 < 0.01) continue;
    if (best !== null && Math.abs(delta) <= Math.abs(best.delta)) continue;

    best = {
      key,
      label: LABEL[key],
      before,
      after,
      delta,
      summary: `${LABEL[key]} ${moneyShort(Math.abs(delta))}원 ${delta > 0 ? '증가' : '감소'}`,
    };
  }
  return best;
}

/**
 * 순이익 증감. 목록 오른쪽 아래 한 줄이 이걸 쓴다.
 *
 * ⚠ 판매가를 500원 올렸다고 순이익이 500원 오르지 않는다 — 부가세 10/110 과
 *   고정지출률이 판매가에 걸려 함께 움직인다. 그래서 **서버 확정 스냅샷의 차이**를
 *   그대로 쓴다. 화면에서 다시 빼고 더하지 않는다.
 */
export function profitDelta(
  prev: ProfitSnapshot | null | undefined,
  cur: ProfitSnapshot,
): number | null {
  if (!prev) return null;
  if (!Number.isFinite(prev.profitAmount) || !Number.isFinite(cur.profitAmount)) return null;
  return cur.profitAmount - prev.profitAmount;
}

/** 손익표가 맞아떨어지는지. 스냅샷을 신뢰하기 전에 한 번 검산한다. */
export function snapshotBalances(s: ProfitSnapshot, tolerance = 0.005): boolean {
  if (!isNonNegativeFinite(s.price)) return false;
  const expected = s.price - s.taxAmount - s.materialCost - s.extraCost - s.fixedCost;
  return Math.abs(expected - s.profitAmount) <= tolerance;
}

/**
 * 재고 원장 한 줄의 표기 규칙 — 상세(ING-03)·재고 내역(ING-07)이 같은 문구를 쓰게 한다.
 *
 * 같은 사건을 화면마다 다르게 부르면(‘판매 소진’ vs ‘소진’) 사장님은 다른 일이 벌어졌다고 읽는다.
 */
import { formatQuantity } from '@sikjae/core';
import type { LedgerEntry } from './hooks';

export type LedgerType = LedgerEntry['type'];

const LABEL: Record<LedgerType, string> = {
  inbound: '입고',
  consume: '판매 소진',
  discard: '폐기',
  stocktake: '재고 실사',
  adjust: '수량 조정',
};

/**
 * 같은 '폐기'라도 원인이 다르면 다르게 불러야 한다(0041).
 *   보관 폐기 — 상해서 버렸다      → 발주량이나 보관이 문제
 *   조리 폐기 — 만들었는데 못 팔았다 → 판매 예측이 문제
 */
export const ledgerLabel = (t: LedgerType, waste = false): string =>
  t === 'discard' ? (waste ? '조리 폐기' : '보관 폐기') : (LABEL[t] ?? '변동');

/** 표기 단위 — DB 의 ea 는 화면에서 '개'. */
export const dispUnit = (u: 'g' | 'ml' | 'ea'): 'g' | 'ml' | '개' => (u === 'ea' ? '개' : u);

export interface LedgerView {
  id: string;
  date: string;
  label: string;
  memo: string;
  delta: string;
  balance: string;
  /** true 면 증가(파랑), false 면 감소(빨강). */
  up: boolean;
}

/** 원장 항목 → 화면 표기. 부호·단위·잔량 문구를 한 곳에서 만든다. */
export function toLedgerView(e: LedgerEntry, unit: 'g' | 'ml' | 'ea'): LedgerView {
  const u = dispUnit(unit);
  const up = e.countDelta > 0;
  const abs = Math.abs(e.countDelta);
  return {
    id: e.id,
    date: e.date.slice(5).replace('-', '/'),
    label: ledgerLabel(e.type, e.waste),
    memo: e.note ?? '',
    // 변화가 없는 실사도 있다 — '0' 이 아니라 '변동 없음'이라고 적어야 읽힌다.
    delta: e.countDelta === 0 ? '변동 없음' : `${up ? '+' : '−'}${formatQuantity(abs, u)}`,
    balance: `잔량 ${formatQuantity(e.balance, u)}`,
    up,
  };
}

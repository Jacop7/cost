/**
 * 재고 원장 한 줄의 표기 규칙 — 상세(ING-03)·재고 내역(ING-07)이 같은 문구를 쓰게 한다.
 *
 * 같은 사건을 화면마다 다르게 부르면(‘판매 소진’ vs ‘소진’) 사장님은 다른 일이 벌어졌다고 읽는다.
 */
import { formatQuantity, isNegativeStock } from '@margincook/core';
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
 * 같은 '폐기'라도 언제 버렸느냐에 따라 사장님이 할 일이 다르다(0044).
 *   조리 전 폐기 — 쓰기도 전에 상해서 버렸다  → 발주량이나 보관이 문제
 *   조리 후 폐기 — 만들어 놓고 못 팔았다      → 판매 예측이 문제
 *
 * 원인('보관')이 아니라 시점('조리 전/후')으로 부른다. 읽는 즉시 이해되고
 * 둘이 대칭이라 짝으로 기억된다.
 */
export const ledgerLabel = (t: LedgerType, waste = false): string =>
  t === 'discard' ? (waste ? '조리 후 폐기' : '조리 전 폐기') : (LABEL[t] ?? '변동');

/** 표기 단위 — DB 의 ea 는 화면에서 '개'. */
export const dispUnit = (u: 'g' | 'ml' | 'ea'): 'g' | 'ml' | '개' => (u === 'ea' ? '개' : u);

export interface LedgerView {
  id: string;
  date: string;
  label: string;
  memo: string;
  delta: string;
  balance: string;
  /**
   * 그 사건 직후 잔량이 음수였는가(0102). 문자열은 이미 `−750g` 을 담고 있지만
   * **색은 따로 정해야 한다** — 회색으로 쓰면 스크롤하다 그냥 지나친다.
   */
  balanceNegative: boolean;
  /** true 면 증가(파랑), false 면 감소(빨강). */
  up: boolean;
}

/** 원장 항목 → 화면 표기. 부호·단위·잔량 문구를 한 곳에서 만든다. */
export function toLedgerView(e: LedgerEntry, unit: 'g' | 'ml' | 'ea'): LedgerView {
  const u = dispUnit(unit);
  const up = e.countDelta > 0;
  const abs = Math.abs(e.countDelta);
  const label = ledgerLabel(e.type, e.waste);

  /*
   * ⚠ 서버 note 는 라벨까지 붙여 저장한다 — `순두부찌개 7개 판매 소진`.
   *   라벨 줄 바로 아래 그대로 놓으면 '판매 소진'이 두 번 나온다.
   *
   *     판매 소진
   *     순두부찌개 7개 판매 소진      ← 이렇게 보였다
   *
   *   뒤에 붙은 라벨만 떼어낸다. note 를 서버에서 고치지 않는 이유는
   *   그게 원장 기록이라서다 — 표기를 바꾸는 것과 값을 바꾸는 것은 다르다.
   */
  let detail = (e.note ?? '').trim();
  if (detail.endsWith(label)) detail = detail.slice(0, -label.length).trim();

  /*
   * ⚠ 여기에 `총 105g` 을 앞세우지 않는다. 오른쪽에 이미 `−105g` 이 있어서
   *   같은 숫자를 두 번 말하게 된다. 한 번 넣었다가 뺐다.
   */

  return {
    id: e.id,
    date: e.date.slice(5).replace('-', '/'),
    label,
    memo: detail,
    // 변화가 없는 실사도 있다 — '0' 이 아니라 '변동 없음'이라고 적어야 읽힌다.
    delta: e.countDelta === 0 ? '변동 없음' : `${up ? '+' : '−'}${formatQuantity(abs, u)}`,
    balance: `잔량 ${formatQuantity(e.balance, u)}`,
    // 그 사건 직후 잔량이 음수였는가 — 화면이 빨강으로 칠할지 정한다(0102).
    balanceNegative: isNegativeStock(e.balance),
    up,
  };
}

/**
 * 재고 상태 판정 — **여유 / 소진 임박 / 소진** 세 단계.
 *
 * ⚠ 이 파일이 유일한 판정처다(0108). 예전엔 두 벌이었고 **서로 달랐다**.
 *     core   `soonOut || 재고 <= 0` → out    ← 'out' 이 소진임박이라는 뜻이었다
 *     앱     `재고 <= 0` → out(소진), `soonOut || 안전선 미달` → low(소진 임박)
 *   같은 이름이 다른 뜻이었으니 어느 쪽을 고쳐도 다른 쪽이 안 따라왔다.
 *   앱 컴포넌트에 있던 판정을 여기로 올리고, 화면들은 전부 이걸 부른다.
 *
 * 세 단계인 이유 — 할 일이 다르기 때문이다.
 *     소진      지금 없다(0 이하). 음수면 입고 누락이나 판매 오기록도 의심해야 한다.
 *     소진 임박 아직 있지만 곧 떨어진다. 발주할 때다.
 *     여유      둘 다 아니다.
 *
 * ⚠ 두 번 틀렸던 자리라 기록해 둔다.
 *   ① 3단계를 2단계로 줄이며 '부족'을 **'여유'로** 흡수 → 안전재고 미달인데
 *      '여유'라고 썼다(실측 7종. 애호박 720/1500).
 *   ② 흡수 방향을 뒤집어 '부족'을 **'소진 임박'으로** 보냈다 → 진간장이
 *      안전선의 99%(1,780/1,800) 인데 '소진 임박'이 됐다. 과장이다.
 *
 * 총량 계산과 변경은 서버가 권위이며 클라이언트는 상태만 미리 본다.
 */
import type { StockBadge } from '@sikjae/types';

export type StockState = StockBadge; // 'out' | 'low' | 'ok'

export interface StockSnapshot {
  /** 현재 장부 재고(기준단위). **음수일 수 있다**(0102) — 판매가 재고보다 많았던 몫이다. */
  stockTotal: number;
  /** 안전재고. ⚠ 0073 이후 **기준단위**다. 개당 용량을 곱하지 않는다. */
  safetyStock: number;
  /** 사장님이 직접 켠 긴급 소진 신호. 수량 계산과는 별개다. */
  soonOut: boolean;
}

/**
 * 안전선 아래인가.
 *
 * ⚠ 경계는 **이하**(`<=`)다. 기획안 §3: "안전재고 이하이면 소진 임박".
 *   앱 쪽 복사본만 `<` 였다 — 안전재고와 정확히 같은 재료를 '여유'로 칠했다.
 *   안전재고는 "이만큼은 있어야 한다"는 선이지 "이만큼이면 넉넉하다"가 아니다.
 *
 * ⚠ 안전재고는 **기준단위**다(0073) — perVolume 을 곱하지 않는다.
 *   곱하던 시절엔 팩 용량만 고쳐도 기준이 따라 움직였다.
 */
export function belowSafety(s: Pick<StockSnapshot, 'stockTotal' | 'safetyStock'>): boolean {
  return s.stockTotal <= s.safetyStock;
}

/** 재고 상태. 두 값 모두 같은 기준단위여야 한다. */
export function stockStateOf(s: StockSnapshot): StockState {
  // ⚠ 0 이하가 먼저다. 음수 재고는 `soonOut` 이 꺼져 있어도 소진이다.
  if (s.stockTotal <= 0) return 'out';
  if (s.soonOut || belowSafety(s)) return 'low';
  return 'ok';
}

/**
 * 부족량 — `abs(min(재고, 0))`(기획안 §3).
 *
 * ⚠ 이건 **표시용 설명**이지 상태명이 아니다. 상태는 `소진` 이고 수량은 `−750g` 으로
 *   그대로 보여 준다. 부족량으로 재고를 대체해 적으면 음수라는 사실이 사라진다.
 */
export function shortageOf(stockTotal: number): number {
  return stockTotal < 0 ? -stockTotal : 0;
}

/** 음수 재고인가 — 화면이 빨간색을 칠할지 정하는 한 곳. */
export function isNegativeStock(stockTotal: number): boolean {
  return stockTotal < 0;
}

/** 상태 뱃지 문구와 색. 화면마다 다른 말을 쓰지 않도록 여기 둔다. */
export const STOCK_STATE_LABEL: Record<StockState, { label: string; tone: 'green' | 'red' }> = {
  out: { label: '소진', tone: 'red' },
  low: { label: '소진 임박', tone: 'red' },
  ok: { label: '여유', tone: 'green' },
};

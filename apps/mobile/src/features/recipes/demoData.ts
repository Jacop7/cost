/**
 * 레시피 데모 데이터 — 프로토타입(② 레시피). RCP-01 리스트용.
 * ⚠ 임시. 실데이터는 Supabase 쿼리로 교체. 손익은 @sikjae/core computeProfit 로 계산(검산 일치).
 * 검산(CLAUDE.md): 제육볶음 순이익 4,014원·33.4% · 권장가 16,000 · 고정지출률 31.3%.
 */
import { computeProfit, recommendedPrice, round } from '@sikjae/core';
import type { TaxMode } from '@sikjae/types';

export interface RecipeCardData {
  id: string;
  name: string;
  price: number; // 판매가
  servings: number; // 기준 인분 N (표시용)
  taxMode: TaxMode;
  materialPerServing: number; // 1인분 재료 원가(기준단가 합) — 데모 입력
  extraPerServing: number; // 1인분 추가 지출(정액)
  fixedRate: number; // 고정지출률(0~1)
  target: number; // 목표 순이익률(0~1)
  salesVolume: number; // 월 평균 판매량(개/월)
  status: 'selling' | 'stopped';
}

/** 고정지출률 31.3% (검산 — 12,000원 기준 고정 ≈ 3,760원). */
export const FIXED_RATE = 0.3133;

export const DEMO_RECIPES: RecipeCardData[] = [
  { id: 'RCP-0007', name: '제육볶음', price: 12000, servings: 10, taxMode: 'included', materialPerServing: 2835, extraPerServing: 300, fixedRate: FIXED_RATE, target: 0.4, salesVolume: 300, status: 'selling' },
  { id: 'RCP-0012', name: '된장찌개', price: 8000, servings: 4, taxMode: 'included', materialPerServing: 2894, extraPerServing: 250, fixedRate: FIXED_RATE, target: 0.4, salesVolume: 200, status: 'selling' },
  { id: 'RCP-0004', name: '김치찌개', price: 9000, servings: 4, taxMode: 'included', materialPerServing: 3000, extraPerServing: 250, fixedRate: FIXED_RATE, target: 0.4, salesVolume: 180, status: 'selling' },
  { id: 'RCP-0019', name: '계란말이', price: 6000, servings: 2, taxMode: 'included', materialPerServing: 900, extraPerServing: 150, fixedRate: FIXED_RATE, target: 0.4, salesVolume: 120, status: 'selling' },
  { id: 'RCP-0023', name: '비빔밥', price: 9500, servings: 1, taxMode: 'included', materialPerServing: 3500, extraPerServing: 200, fixedRate: FIXED_RATE, target: 0.4, salesVolume: 0, status: 'stopped' },
];

export interface RecipeProfit {
  profit: number; // 1인분 순이익(원)
  profitRate: number; // 0~1
  materialRate: number; // 재료 원가율 0~1
  belowTarget: boolean; // 목표 순이익률 미달
  recommended: number | null; // 권장 판매가(목표 달성용)
}

/** 카드 표시값 — core computeProfit/recommendedPrice 로 계산. */
export function recipeProfit(r: RecipeCardData): RecipeProfit {
  const res = computeProfit({
    price: r.price,
    servings: 1,
    taxMode: r.taxMode,
    lines: [{ inputQty: r.materialPerServing, baseUnitPrice: 1 }],
    extraPerServing: r.extraPerServing,
    fixedRate: r.fixedRate,
  });
  const rec = recommendedPrice(r.materialPerServing + r.extraPerServing, r.fixedRate, r.target);
  return {
    profit: round(res.profit),
    profitRate: res.profitRate,
    materialRate: res.materialRate,
    belowTarget: res.profitRate < r.target,
    recommended: rec == null ? null : Math.round(rec / 100) * 100, // 100원 단위 반올림
  };
}

/** % 표기 — 소수 1자리 절사(검산 표기 일치: 4,014/12,000 = 33.45% → 33.4%). */
export const pct = (rate: number): string => (Math.floor(rate * 1000) / 10).toFixed(1);

// ── 레시피 상세(RCP-02) 확장 데모 ──────────────────────────────
/** 재료 라인 — 1인분 소요량·단위·기준단가(로스 반영). 라인원가 = qty × unitPrice. */
export interface RecipeLine {
  name: string;
  qty: number; // 1인분 소요량
  unit: string; // g·ml·개
  unitPrice: number; // 기준 단가(원/단위)
}
export interface ExtraExpense {
  name: string;
  amount: number; // 1인분 정액(원)
}
export interface RecipeDetail {
  lines: RecipeLine[];
  extras: ExtraExpense[];
  trend: number[]; // 순이익률(%) 추이
}

/** 고정 지출 항목(판매가 대비 비율) — 합계 = FIXED_RATE(31.3%). 메뉴별 amount = rate × 판매가. */
export const FIXED_ITEMS: { name: string; rate: number }[] = [
  { name: '인건비', rate: 0.15 },
  { name: '플랫폼 수수료', rate: 0.075 },
  { name: '포장비', rate: 0.03 },
  { name: '배달/배송', rate: 0.04 },
  { name: '광고/홍보', rate: 0.0183 },
];

export const RECIPE_DETAILS: Record<string, RecipeDetail> = {
  'RCP-0007': {
    lines: [
      { name: '돼지고기 앞다리', qty: 200, unit: 'g', unitPrice: 13.0 },
      { name: '양파', qty: 50, unit: 'g', unitPrice: 2.1 },
      { name: '대파', qty: 25, unit: 'g', unitPrice: 4.71 },
      { name: '다진마늘', qty: 1.4, unit: 'g', unitPrice: 8.5 },
    ],
    extras: [{ name: '특수 포장용기', amount: 300 }],
    trend: [38.1, 37.2, 36.0, 35.1, 34.0, 33.4],
  },
  'RCP-0012': {
    lines: [
      { name: '돼지고기 앞다리', qty: 100, unit: 'g', unitPrice: 13.0 },
      { name: '두부', qty: 1, unit: '개', unitPrice: 1100 },
      { name: '양파', qty: 60, unit: 'g', unitPrice: 2.1 },
      { name: '대파', qty: 40, unit: 'g', unitPrice: 4.71 },
    ],
    extras: [{ name: '뚝배기 포장용기', amount: 250 }],
    trend: [27.0, 26.1, 25.2, 24.4, 23.8, 23.4],
  },
  'RCP-0004': {
    lines: [
      { name: '돼지고기 앞다리', qty: 120, unit: 'g', unitPrice: 13.0 },
      { name: '두부', qty: 1, unit: '개', unitPrice: 1100 },
      { name: '대파', qty: 40, unit: 'g', unitPrice: 4.71 },
      { name: '다진마늘', qty: 18, unit: 'g', unitPrice: 8.5 },
    ],
    extras: [{ name: '밀폐 포장용기', amount: 250 }],
    trend: [30.5, 29.6, 28.4, 27.5, 26.8, 26.2],
  },
  'RCP-0019': {
    lines: [
      { name: '계란', qty: 3, unit: '개', unitPrice: 220 },
      { name: '대파', qty: 20, unit: 'g', unitPrice: 4.71 },
      { name: '양파', qty: 30, unit: 'g', unitPrice: 2.1 },
      { name: '식용유', qty: 30, unit: 'ml', unitPrice: 2.5 },
    ],
    extras: [{ name: '도시락 용기', amount: 150 }],
    trend: [41.0, 42.2, 43.1, 43.8, 44.2, 44.5],
  },
  'RCP-0023': {
    lines: [
      { name: '돼지고기 앞다리', qty: 100, unit: 'g', unitPrice: 13.0 },
      { name: '두부', qty: 1, unit: '개', unitPrice: 1100 },
      { name: '계란', qty: 1, unit: '개', unitPrice: 220 },
      { name: '양파', qty: 80, unit: 'g', unitPrice: 2.1 },
    ],
    extras: [{ name: '포장용기', amount: 200 }],
    trend: [22.0, 21.4, 20.8, 20.2, 19.8, 19.5],
  },
};

export const getRecipe = (id?: string) => DEMO_RECIPES.find((r) => r.id === id);

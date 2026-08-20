/**
 * 레시피 편집 초안 — 추가/수정 폼과 재료·부자재 검색 화면이 공유하는 상태.
 *
 * 검색은 별도 화면(라우트)이라 "고른 재료"를 폼으로 돌려줘야 하는데, 라우터 파라미터로
 * 배열을 실어 나르면 뒤로가기·재진입에서 쉽게 깨진다. 편집 중인 폼 자체를 한곳에 둔다.
 *
 * ⚠ 이건 **저장 전 초안**이다. 저장은 언제나 서버(save_recipe)가 하고, 저장 직후 초안은 버린다.
 */
import { create } from 'zustand';
import type { TaxMode } from './hooks';

export interface DraftLine {
  /** 식재료 줄이면 채워진다. 반제품 줄이면 null. */
  ingredientId: string | null;
  subRecipeId: string | null;
  name: string;
  /** 식재료: 'g'|'ml'|'개' · 반제품: null(인분) */
  unit: 'g' | 'ml' | '개' | null;
  /** 기준 인분 전체 사용량(기준단위). 저장 형식과 같다. */
  inputQty: number;
  /** 기준단가(원/기준단위). 산출 전이면 null — 0 으로 두면 공짜 재료가 된다. */
  unitPrice: number | null;
}

export interface DraftExtra {
  /** 부자재 마스터를 가리키면 금액은 서버가 마스터 단가 × 수량으로 다시 낸다. */
  materialId: string | null;
  name: string;
  /** 마스터 미지정일 때의 1인분 금액. */
  amount: number;
  qty: number;
}

/** 입력 중인 세금 항목. 요율은 '2.5' 처럼 치는 중일 수 있어 문자열이다. */
export interface DraftTaxItem {
  name: string;
  rate: string;
}

export interface RecipeDraft {
  id?: string;
  name: string;
  categoryId: string | null;
  categoryName: string;
  price: string;
  /** 메뉴 메모. 매출 계산과 무관하다(0063). */
  memo: string;
  taxMode: TaxMode;
  /** 부가세 외 세금 항목. 요율은 입력 중이라 문자열로 든다(0052). */
  taxItems: DraftTaxItem[];
  baseServings: string;
  avgMonthlySales: string;
  targetProfitRate: string;
  lines: DraftLine[];
  extras: DraftExtra[];
  /** 서버 값으로 채운 뒤 true. 사용자가 고친 값을 다시 덮어쓰지 않기 위한 표시. */
  loaded: boolean;
}

export const emptyDraft = (): RecipeDraft => ({
  name: '',
  categoryId: null,
  categoryName: '',
  price: '',
  memo: '',
  taxMode: 'included',
  taxItems: [],
  baseServings: '10',
  avgMonthlySales: '',
  targetProfitRate: '40',
  lines: [],
  extras: [],
  loaded: false,
});

interface DraftState {
  draft: RecipeDraft;
  reset: (next?: Partial<RecipeDraft>) => void;
  patch: (next: Partial<RecipeDraft>) => void;
  /** 같은 재료를 두 번 담으면 줄이 둘로 갈라져 원가가 어긋난다 — 사용량을 더한다. */
  addLine: (line: DraftLine) => void;
  updateLine: (index: number, next: Partial<DraftLine>) => void;
  removeLine: (index: number) => void;
  addExtra: (extra: DraftExtra) => void;
  updateExtra: (index: number, next: Partial<DraftExtra>) => void;
  removeExtra: (index: number) => void;
  addTaxItem: () => void;
  updateTaxItem: (index: number, next: Partial<DraftTaxItem>) => void;
  removeTaxItem: (index: number) => void;
}

const sameLine = (a: DraftLine, b: DraftLine) =>
  (a.ingredientId !== null && a.ingredientId === b.ingredientId) ||
  (a.subRecipeId !== null && a.subRecipeId === b.subRecipeId);

export const useRecipeDraft = create<DraftState>((set) => ({
  draft: emptyDraft(),
  reset: (next) => set({ draft: { ...emptyDraft(), ...next } }),
  patch: (next) => set((s) => ({ draft: { ...s.draft, ...next } })),

  addLine: (line) =>
    set((s) => {
      const i = s.draft.lines.findIndex((l) => sameLine(l, line));
      if (i >= 0) {
        const lines = s.draft.lines.map((l, k) => (k === i ? { ...l, inputQty: l.inputQty + line.inputQty } : l));
        return { draft: { ...s.draft, lines } };
      }
      return { draft: { ...s.draft, lines: [...s.draft.lines, line] } };
    }),

  updateLine: (index, next) =>
    set((s) => ({ draft: { ...s.draft, lines: s.draft.lines.map((l, k) => (k === index ? { ...l, ...next } : l)) } })),

  removeLine: (index) =>
    set((s) => ({ draft: { ...s.draft, lines: s.draft.lines.filter((_, k) => k !== index) } })),

  addExtra: (extra) =>
    set((s) => {
      const i = s.draft.extras.findIndex((e) => e.materialId !== null && e.materialId === extra.materialId);
      if (i >= 0) {
        const extras = s.draft.extras.map((e, k) => (k === i ? { ...e, qty: e.qty + extra.qty } : e));
        return { draft: { ...s.draft, extras } };
      }
      return { draft: { ...s.draft, extras: [...s.draft.extras, extra] } };
    }),

  updateExtra: (index, next) =>
    set((s) => ({ draft: { ...s.draft, extras: s.draft.extras.map((e, k) => (k === index ? { ...e, ...next } : e)) } })),

  removeExtra: (index) =>
    set((s) => ({ draft: { ...s.draft, extras: s.draft.extras.filter((_, k) => k !== index) } })),

  addTaxItem: () =>
    set((s) => ({ draft: { ...s.draft, taxItems: [...s.draft.taxItems, { name: '', rate: '' }] } })),

  updateTaxItem: (index, next) =>
    set((s) => ({
      draft: { ...s.draft, taxItems: s.draft.taxItems.map((t, k) => (k === index ? { ...t, ...next } : t)) },
    })),

  removeTaxItem: (index) =>
    set((s) => ({ draft: { ...s.draft, taxItems: s.draft.taxItems.filter((_, k) => k !== index) } })),
}));

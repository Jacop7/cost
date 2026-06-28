// store.ts — 식재료 클라이언트 상태 (zustand).
// ⚠ 임시: 화면 간 파급(추가·수정·삭제·재고·메모)을 즉시 반영하기 위한 로컬 상태.
//   실데이터·전파(E1/E2/E5)는 Supabase rpc.* + react-query 무효화로 교체 예정.
import { create } from 'zustand';
import { ingredients as seed } from './demoData';
import type { Ingredient } from './types';

export interface IngItem extends Ingredient {
  stock: number; // 현재 잔여 (기준단위 g/ml/개)
}

/** 초기 재고 = (미개봉 + 개봉) × 개당 용량 — 리스트 카드 표기와 일치. */
const initStock = (g: Ingredient) => (g.sealed + g.opened) * g.per;

interface IngState {
  items: IngItem[];
  find: (id?: string) => IngItem | undefined;
  add: (g: Omit<IngItem, 'id'>) => string;
  update: (id: string, patch: Partial<IngItem>) => void;
  remove: (id: string) => void;
  setMemo: (id: string, memo: string) => void;
  setStock: (id: string, stock: number) => void;
}

let seq = 1000;
const nextId = () => `ING-${String((seq += 7)).padStart(4, '0')}`;

export const useIngredients = create<IngState>((set, get) => ({
  items: seed.map((g) => ({ ...g, stock: initStock(g) })),
  find: (id) => get().items.find((x) => x.id === id),
  add: (g) => {
    const id = nextId();
    set((s) => ({ items: [{ ...g, id } as IngItem, ...s.items] }));
    return id;
  },
  update: (id, patch) => set((s) => ({ items: s.items.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
  remove: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
  setMemo: (id, memo) => set((s) => ({ items: s.items.map((x) => (x.id === id ? { ...x, memo } : x)) })),
  setStock: (id, stock) => set((s) => ({ items: s.items.map((x) => (x.id === id ? { ...x, stock: Math.max(0, stock) } : x)) })),
}));

/** 재고 수량 표기 — g/ml은 1,000 이상이면 kg/L, 그 외 원단위. */
export function fmtStock(unit: '개' | 'g' | 'ml', base: number): string {
  if (unit === '개') return `${base}개`;
  const big = unit === 'ml' ? 'L' : 'kg';
  if (base >= 1000) {
    const v = Math.round((base / 1000) * 10) / 10;
    return `${v}${big}`;
  }
  return `${Math.round(base)}${unit}`;
}

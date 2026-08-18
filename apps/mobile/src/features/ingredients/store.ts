// store.ts — 식재료 클라이언트 상태 (zustand).
// ⚠ 임시: 화면 간 파급(추가·수정·삭제·재고·메모)을 즉시 반영하기 위한 로컬 상태.
//   실데이터·전파(E1/E2/E5)는 Supabase rpc.* + react-query 무효화로 교체 예정.
import { currentBusinessDay, formatQuantity } from '@sikjae/core';
import { create } from 'zustand';
import { ingredients as seed } from './demoData';
import type { Ingredient } from './types';

export interface IngItem extends Ingredient {
  stock: number; // 현재 잔여 (기준단위 g/ml/개)
}

/**
 * 재고 변동 이벤트 — 원장(append-only).
 *
 * 재고를 덮어쓰기만 하면 "지금 얼마"만 남고 **왜 그렇게 됐는지가 사라진다.**
 * 폐기는 실측 로스율에 누적되어 기준단가까지 바꾸므로(E2), 종류를 잃으면 로스율이 영원히 0 이 된다.
 * DB 의 `inventory_events` 와 같은 모양으로 둬서 연동 시 그대로 매핑되게 한다.
 */
export interface StockEvent {
  id: string;
  ingredientId: string;
  /** 'adjust' 조정(E5) · 'stocktake' 완전 소진(E5) · 'discard' 폐기(E2) · 'inbound' 입고(E1) */
  type: 'adjust' | 'stocktake' | 'discard' | 'inbound';
  /** 재고 증감(기준단위). 감소는 음수. */
  countDelta: number;
  /** 폐기량(기준단위). discard 일 때만 채운다 — 실측 로스율의 분자. */
  volumeDelta: number;
  /** 변경 후 재고(기준단위) — 원장만 보고도 그 시점 잔량을 알 수 있게. */
  afterStock: number;
  note: string;
  occurredAt: string; // 영업일 'YYYY-MM-DD'
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
  /** ⚠ 이력 없이 수량만 덮어쓴다. 사용자 행동에는 `applyStockChange` 를 쓸 것. */
  setStock: (id: string, stock: number) => void;

  /** 재고 변동 원장 (최신순). */
  events: StockEvent[];
  /** 재고 수정 1건을 원장과 함께 반영한다 — 이것이 화면이 불러야 하는 액션이다. */
  applyStockChange: (id: string, change: { kind: 'adj' | 'out' | 'waste'; nextStock: number; wasteAmount: number; reason: string }) => void;
  /** 특정 식재료의 변동 이력. */
  eventsOf: (id: string) => StockEvent[];
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

  events: [],
  eventsOf: (id) => get().events.filter((e) => e.ingredientId === id),

  applyStockChange: (id, change) =>
    set((s) => {
      const item = s.items.find((x) => x.id === id);
      if (!item) return s;
      const next = Math.max(0, change.nextStock);
      // 화면 탭 id → 원장 이벤트 유형. DB inventory_event_type 과 같은 값을 쓴다.
      const type: StockEvent['type'] =
        change.kind === 'waste' ? 'discard' : change.kind === 'out' ? 'stocktake' : 'adjust';
      const ev: StockEvent = {
        id: `EV-${String((evSeq += 1)).padStart(5, '0')}`,
        ingredientId: id,
        type,
        countDelta: next - item.stock,
        volumeDelta: change.kind === 'waste' ? change.wasteAmount : 0,
        afterStock: next,
        note: change.reason,
        occurredAt: currentBusinessDay(),
      };
      return {
        items: s.items.map((x) => (x.id === id ? { ...x, stock: next, soon: next <= x.safe } : x)),
        events: [ev, ...s.events],
      };
    }),
}));

let evSeq = 0;

/**
 * 재고 수량 표기 — 규칙은 `@sikjae/core` formatQuantity 단일 출처.
 * 잔량은 대략값이면 되므로 소수 1자리(기본값)를 쓴다. 상품 스펙(구매 옵션 용량)은 `perLabel` 쪽에서
 * 더 높은 정밀도를 쓴다 — 같은 값이 화면마다 다르게 보이던 문제를 정밀도 의도로 분리했다.
 */
export function fmtStock(unit: '개' | 'g' | 'ml', base: number): string {
  return formatQuantity(base, unit);
}

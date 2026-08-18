/**
 * Supabase 클라이언트. 세션은 expo-secure-store 에 저장.
 * 환경변수: EXPO_PUBLIC_SUPABASE_URL · EXPO_PUBLIC_SUPABASE_ANON_KEY (.env)
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@sikjae/db';
import * as SecureStore from 'expo-secure-store';
import { currentBusinessMonth } from '@sikjae/core';
import type { OrderRecordSource } from '@sikjae/types';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * 환경변수 설정 여부. 화면은 "로딩"과 "환경 미설정"을 구분해서 보여야 한다.
 * 미설정 상태로 조회하면 네트워크 오류처럼 보여 원인을 오해하게 된다.
 */
export const isSupabaseConfigured = SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== '';

// 생성 타입을 물려 RPC 인자·반환과 테이블 컬럼이 **컴파일 단계에서** 검증되게 한다.
// (이전에는 Database = unknown 자리표시자라 supabase.rpc() 인자 오타가 잡히지 않았다.)
export const supabase = createClient<Database>(
  SUPABASE_URL || 'http://localhost:54321',
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

/**
 * 전파 이벤트 RPC 래퍼 — 화면에서 타입 안전하게 호출.
 * 실제 계산·정합성은 서버 트랜잭션이 보장. 앱은 결과로 캐시 무효화만.
 *
 * 인자 이름·개수는 생성 타입(`@sikjae/db`)이 컴파일 단계에서 검증한다.
 * 스키마를 바꾸면 `pnpm db:types` 로 타입을 다시 만들어야 여기 오류가 드러난다.
 */
export const rpc = {
  /**
   * E1 입고 확정 — `e1_confirm_inbound(p_order uuid, p_actual_qty numeric default null, p_idempotency_key text default null) → jsonb`
   *
   * `idempotencyKey` 는 **사용자 의도 1회분**을 식별한다. 화면은 버튼을 누른 시점에 키를 한 번 만들고
   * 재시도(네트워크 오류 후 '다시 시도')에는 **같은 키를 재사용**해야 중복 입고가 막힌다.
   * 새 입고(부분 입고 추가분)는 새 키를 만든다. 방어는 DB 유니크 인덱스가 하므로 debounce 에 의존하지 않는다.
   *
   * 반환 jsonb: `{ order_id, received_qty, unit_price, price_spike, duplicate, already_received }`
   * `duplicate`/`already_received` 가 true 면 서버가 아무것도 바꾸지 않은 것이다(오류 아님).
   */
  e1ConfirmInbound: (orderId: string, actualQty?: number, idempotencyKey?: string) =>
    // 생성 타입상 선택 인자는 `?: T` 이므로 null 이 아니라 **생략(undefined)** 해야 한다.
    // null 을 보내면 SQL default 가 적용되지 않고 명시적 null 이 전달된다.
    supabase.rpc('e1_confirm_inbound', {
      p_order: orderId,
      p_actual_qty: actualQty,
      p_idempotency_key: idempotencyKey,
    }),

  /** E2 폐기 — `e2_discard(p_ingredient uuid, p_remain_volume numeric) → void` */
  e2Discard: (ingredientId: string, remainVolume: number) =>
    supabase.rpc('e2_discard', { p_ingredient: ingredientId, p_remain_volume: remainVolume }),

  /** E3 레시피 저장 — `e3_recipe_saved(p_recipe uuid) → void` */
  e3RecipeSaved: (recipeId: string) => supabase.rpc('e3_recipe_saved', { p_recipe: recipeId }),

  /**
   * E4 고정지출 저장 — `e4_fixed_cost_saved(p_store uuid, p_month text) → jsonb`
   * month 는 'YYYY-MM'. 생략하면 **영업월**(KST 기준)을 쓴다 — 기기 로컬이나 UTC 로 계산하면
   * 월 경계에서 전월/다음월로 어긋난다(@sikjae/core businessMonth).
   */
  e4FixedCostSaved: (storeId: string, month?: string) =>
    supabase.rpc('e4_fixed_cost_saved', {
      p_store: storeId,
      p_month: month ?? currentBusinessMonth(),
    }),

  /** E5 재고 실사·조정 — `e5_stock_adjusted(p_ingredient uuid, p_sealed numeric, p_opened smallint, p_soon boolean) → void` */
  e5StockAdjusted: (ingredientId: string, sealed: number, opened: 0 | 1, soon: boolean) =>
    supabase.rpc('e5_stock_adjusted', {
      p_ingredient: ingredientId,
      p_sealed: sealed,
      p_opened: opened,
      p_soon: soon,
    }),

  /**
   * E6 레시피 계산 (2차 범위) — `e6_recipe_calc(p_store uuid, p_from date, p_to date, p_items jsonb, p_result jsonb) → uuid`
   * 부족분(shortage > 0)만 발주 후보로 병합된다. 날짜는 'YYYY-MM-DD' 영업일 문자열.
   */
  e6RecipeCalc: (input: {
    storeId: string;
    from: string;
    to: string;
    items: RecipeCalcItem[];
    result: RecipeCalcResult[];
  }) =>
    supabase.rpc('e6_recipe_calc', {
      p_store: input.storeId,
      p_from: input.from,
      p_to: input.to,
      p_items: input.items,
      p_result: input.result,
    }),

  /**
   * E7 발주 등록 — `e7_place_order(p_store uuid, p_ingredient uuid, p_vendor uuid, p_brand uuid,
   *   p_volume numeric, p_amount numeric, p_qty numeric, p_expected date, p_source order_source default 'manual') → uuid`
   *
   * ⚠ 절대원칙 2: E7 은 **기록만** 한다. 재고·기준단가·재고 이력은 변하지 않고,
   *   발주 후보 상태만 'ordered' 로 전이된다. 실제 재고 반영은 E1(입고 확정)에서만 일어난다.
   */
  e7PlaceOrder: (input: {
    storeId: string;
    ingredientId: string;
    vendorId: string | null;
    brandId: string | null;
    volume: number;
    amount: number;
    qty: number;
    /** 도착 예정일 'YYYY-MM-DD' (영업일 기준). */
    expectedAt: string;
    source?: OrderRecordSource;
  }) =>
    // 생성 타입은 p_vendor/p_brand 를 string 으로 노출하지만 SQL 은 null 을 허용한다
    // (order_records.vendor_id/brand_id 가 nullable). 미지정을 null 로 넘기기 위해 캐스팅한다.
    supabase.rpc('e7_place_order', {
      p_store: input.storeId,
      p_ingredient: input.ingredientId,
      p_vendor: input.vendorId as string,
      p_brand: input.brandId as string,
      p_volume: input.volume,
      p_amount: input.amount,
      p_qty: input.qty,
      p_expected: input.expectedAt,
      p_source: input.source ?? 'manual',
    }),
} as const;

/**
 * 입고 확정 1회분의 멱등성 키.
 * 버튼을 누른 시점에 한 번 만들어 state 에 보관하고, 재시도에는 같은 값을 다시 넘긴다.
 * 보안 토큰이 아니라 중복 제거용 식별자라 난수 품질 요구가 낮다(crypto 의존을 피한다).
 */
export const makeInboundKey = (orderId: string): string =>
  `${orderId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;

/** E6 입력 항목 — 계산 대상 메뉴와 예상 판매량. jsonb 로 넘어가므로 Json 호환이어야 한다. */
export interface RecipeCalcItem {
  recipe_id: string;
  qty: number;
  [key: string]: string | number;
}

/** E6 결과 항목 — SQL `jsonb_to_recordset(p_result) as x(ingredient_id, required, shortage)` 와 키가 일치해야 한다. */
export interface RecipeCalcResult {
  ingredient_id: string;
  required: number;
  shortage: number;
  [key: string]: string | number;
}

/**
 * Supabase 클라이언트. 세션은 expo-secure-store 에 저장.
 * 환경변수: EXPO_PUBLIC_SUPABASE_URL · EXPO_PUBLIC_SUPABASE_ANON_KEY (.env)
 */
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321',
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
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
 */
export const rpc = {
  e1ConfirmInbound: (orderId: string, actualQty?: number) =>
    supabase.rpc('e1_confirm_inbound', { p_order: orderId, p_actual_qty: actualQty ?? null }),
  e2Discard: (ingredientId: string, remainVolume: number) =>
    supabase.rpc('e2_discard', { p_ingredient: ingredientId, p_remain_volume: remainVolume }),
  e3RecipeSaved: (recipeId: string) => supabase.rpc('e3_recipe_saved', { p_recipe: recipeId }),
  e4FixedCostSaved: (storeId: string, month: string) =>
    supabase.rpc('e4_fixed_cost_saved', { p_store: storeId, p_month: month }),
  e5StockAdjusted: (ingredientId: string, sealed: number, opened: 0 | 1, soon: boolean) =>
    supabase.rpc('e5_stock_adjusted', {
      p_ingredient: ingredientId,
      p_sealed: sealed,
      p_opened: opened,
      p_soon: soon,
    }),
} as const;

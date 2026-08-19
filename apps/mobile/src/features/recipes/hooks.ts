/**
 * 레시피 조회·저장 훅.
 *
 * 손익(재료비·세금·고정지출·순이익률)은 **서버가 권위**다(절대원칙 3).
 * 앱은 받아서 그리기만 하고, 미리보기 계산이 필요하면 `@sikjae/core` 의 같은 공식을 쓴다.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidate, invalidateOn, qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { asJson } from '@/lib/json';
import { useStoreId } from '@/lib/SessionProvider';

const num = (v: unknown): number => Number(v ?? 0);
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

export type TaxMode = 'included' | 'separate' | 'exempt';

export interface RecipeRow {
  id: string;
  name: string;
  price: number;
  active: boolean;
  categoryId: string | null;
  categoryName: string | null;
  taxMode: TaxMode;
  baseServings: number;
  targetProfitRate: number;
  avgMonthlySales: number | null;
  materialCost: number;
  extraCost: number;
  tax: number;
  fixedCost: number;
  profit: number;
  /** 0~1 비율. 화면 표기는 formatPercent 가 맡는다. */
  profitRate: number;
  materialRate: number;
  /**
   * 기준단가가 없어 원가에서 **빠진** 재료 줄 수.
   * recipe_material_cost 는 단가 null 을 0 으로 넘기므로, 합계만 보면 공짜인지 빠진 건지 알 수 없다.
   */
  unknownCostLines: number;
  /**
   * 재고가 0 이라 이 메뉴를 못 만들게 하는 재료 이름. null 이면 만들 수 있다.
   * 서버가 판정한다(recipe_blocked_by) — 화면과 서버가 다른 기준을 쓰면 안 된다.
   */
  blockedBy: string | null;
}

export interface RecipeLine {
  id: string;
  ingredientId: string | null;
  subRecipeId: string | null;
  name: string;
  baseUnit: 'g' | 'ml' | 'ea' | null;
  /** 기준 인분 전체 사용량 */
  inputQty: number;
  /** 1인분 사용량 */
  perServing: number;
  /** 기준단가(원/기준단위). 산출 전이면 null — 0 으로 그리면 공짜 재료로 읽힌다. */
  unitPrice: number | null;
}

export interface RecipeDetail {
  id: string;
  name: string;
  price: number;
  active: boolean;
  /** 최근 30일 판매 실적 — 레시피 화면에서 매출 탭으로 건너가지 않게. */
  sales30d: { qty: number; revenue: number; waste: number };
  taxMode: TaxMode;
  baseServings: number;
  targetProfitRate: number;
  avgMonthlySales: number | null;
  materialCost: number;
  extraCost: number;
  fixedRate: number;
  categoryId: string | null;
  lines: RecipeLine[];
  extras: { id: string; name: string; amount: number; materialId: string | null; qty: number }[];
  profitTrends: { date: string; profitRate: number; materialRate: number; cause: 'material' | 'recipe' | 'fixed' }[];
}

export function useRecipeList() {
  const storeId = useStoreId();
  return useQuery({
    queryKey: qk.recipes,
    queryFn: async (): Promise<RecipeRow[]> => {
      const { data, error } = await supabase.rpc('recipe_list', { p_store: storeId });
      if (error) throw new Error(error.message);
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        id: String(r.id),
        name: String(r.name),
        price: num(r.price),
        active: r.active !== false,
        categoryId: str(r.category_id),
        categoryName: str(r.category_name),
        taxMode: r.tax_mode as TaxMode,
        baseServings: num(r.base_servings),
        targetProfitRate: num(r.target_profit_rate),
        avgMonthlySales: numOrNull(r.avg_monthly_sales),
        materialCost: num(r.material_cost),
        extraCost: num(r.extra_cost),
        tax: num(r.tax),
        fixedCost: num(r.fixed_cost),
        profit: num(r.profit),
        profitRate: num(r.profit_rate),
        materialRate: num(r.material_rate),
        unknownCostLines: num(r.unknown_cost_lines),
        blockedBy: str(r.blocked_by),
      }));
    },
  });
}

export function useRecipeDetail(id: string | undefined) {
  return useQuery({
    queryKey: qk.recipe(id ?? ''),
    enabled: Boolean(id),
    queryFn: async (): Promise<RecipeDetail | null> => {
      const { data, error } = await supabase.rpc('recipe_detail', { p_recipe: id as string });
      if (error) throw new Error(error.message);
      if (!data) return null;
      const r = data as unknown as Record<string, unknown>;
      return {
        id: String(r.id),
        name: String(r.name),
        price: num(r.price),
        active: r.active !== false,
        sales30d: {
          qty: num((r.sales_30d as Record<string, unknown> | null)?.qty),
          revenue: num((r.sales_30d as Record<string, unknown> | null)?.revenue),
          waste: num((r.sales_30d as Record<string, unknown> | null)?.waste),
        },
        taxMode: r.tax_mode as TaxMode,
        baseServings: num(r.base_servings),
        targetProfitRate: num(r.target_profit_rate),
        avgMonthlySales: numOrNull(r.avg_monthly_sales),
        materialCost: num(r.material_cost),
        extraCost: num(r.extra_cost),
        fixedRate: num(r.fixed_rate),
        categoryId: str(r.category_id),
        lines: ((r.lines ?? []) as Record<string, unknown>[]).map((l) => ({
          id: String(l.id),
          ingredientId: str(l.ingredient_id),
          subRecipeId: str(l.sub_recipe_id),
          name: String(l.name ?? ''),
          baseUnit: (l.base_unit as RecipeLine['baseUnit']) ?? null,
          inputQty: num(l.input_qty),
          perServing: num(l.per_serving),
          unitPrice: numOrNull(l.unit_price),
        })),
        extras: ((r.extras ?? []) as Record<string, unknown>[]).map((e) => ({
          id: String(e.id),
          name: String(e.name),
          amount: num(e.amount),
          materialId: str(e.material_id),
          qty: num(e.qty) || 1,
        })),
        profitTrends: ((r.profit_trends ?? []) as Record<string, unknown>[]).map((t) => ({
          date: String(t.date),
          profitRate: num(t.profit_rate),
          materialRate: num(t.material_rate),
          cause: t.cause as 'material' | 'recipe' | 'fixed',
        })),
      };
    },
  });
}

export interface RecipeInput {
  id?: string;
  name: string;
  price: number;
  categoryId?: string | null;
  active?: boolean;
  taxMode: TaxMode;
  baseServings: number;
  targetProfitRate: number;
  avgMonthlySales: number | null;
  /** 보내면 **전량 교체**된다. 헤더만 고칠 때는 생략한다. */
  lines?: { ingredientId?: string | null; subRecipeId?: string | null; inputQty: number }[];
  /** 부자재 마스터를 가리키면 금액은 서버가 마스터 단가 × 수량으로 계산한다. */
  extras?: { materialId?: string | null; name?: string; amount?: number; qty?: number }[];
}

export function useSaveRecipe() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (input: RecipeInput): Promise<string> => {
      const payload: Record<string, unknown> = {
        id: input.id ?? '',
        name: input.name,
        price: input.price,
        tax_mode: input.taxMode,
        base_servings: input.baseServings,
        target_profit_rate: input.targetProfitRate,
        avg_monthly_sales: input.avgMonthlySales ?? '',
      };
      if (input.categoryId !== undefined) payload.category_id = input.categoryId ?? '';
      if (input.active !== undefined) payload.active = input.active;
      if (input.lines) {
        payload.lines = input.lines.map((l) => ({
          ingredient_id: l.ingredientId ?? '',
          sub_recipe_id: l.subRecipeId ?? '',
          input_qty: l.inputQty,
        }));
      }
      if (input.extras) {
        payload.extras = input.extras.map((e) => ({
          material_id: e.materialId ?? '',
          name: e.name ?? '',
          amount: e.amount ?? 0,
          qty: e.qty ?? 1,
        }));
      }
      const { data, error } = await supabase.rpc('save_recipe', { p_store: storeId, p_payload: asJson(payload) });
      if (error) throw new Error(error.message);
      return String(data);
    },
    onSuccess: (id) => invalidate(qc, invalidateOn.e3(id)),
  });
}

export function useDeactivateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('deactivate_recipe', { p_recipe: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_r, id) => invalidate(qc, invalidateOn.e3(id)),
  });
}

/** 반제품 후보 — 레시피 재료로 넣을 수 있는 다른 메뉴(자기 자신 제외). */
export function useRecipePickList(excludeId?: string) {
  const storeId = useStoreId();
  return useQuery({
    queryKey: [...qk.recipes, 'pick', excludeId ?? ''],
    queryFn: async (): Promise<{ id: string; name: string; baseServings: number; unitCost: number; active: boolean }[]> => {
      const { data, error } = await supabase.rpc('recipe_pick_list', {
        p_store: storeId,
        p_exclude: excludeId,
      });
      if (error) throw new Error(error.message);
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        id: String(r.id),
        name: String(r.name),
        baseServings: num(r.base_servings),
        unitCost: num(r.unit_cost),
        active: r.active !== false,
      }));
    },
  });
}

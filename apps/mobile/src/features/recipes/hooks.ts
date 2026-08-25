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
import { parseLastChange, type LastChange } from '@/features/changes/hooks';

const num = (v: unknown): number => Number(v ?? 0);
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

const YM = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * 고정지출 응답을 **검증**한다. 없으면 조회 오류로 올린다 — 조용히 넘기지 않는다.
 *
 * ⚠ 예전엔 `String(r.fixed_month ?? '')` · `(r.fixed_items ?? [])` 였다. 서버가 키를
 *   빠뜨리면 화면이 **거짓말을 하면서 멀쩡해 보인다** —
 *       항목 자리: `이번 달 고정지출이 아직 없어요`
 *       소계 자리: `3,756원 · 31.3%`   (fixedRate 는 따로 오므로 그대로 나온다)
 *   사장님은 고정지출을 지운 적이 없는데 지워졌다고 읽는다. 차라리 못 불러온 게 낫다.
 */
function reqFixed(r: Record<string, unknown>): { month: string; items: { key: string; total: number }[] } {
  const month = typeof r.fixed_month === 'string' ? r.fixed_month : '';
  if (!YM.test(month)) {
    throw new Error('서버가 고정지출 기준 월을 주지 않았어요. 잠시 후 다시 시도해 주세요');
  }
  if (!Array.isArray(r.fixed_items)) {
    throw new Error('서버가 고정지출 항목을 주지 않았어요. 잠시 후 다시 시도해 주세요');
  }
  return {
    month,
    // 항목 자체는 **비어 있어도 정상**이다 — 아직 안 적은 달이 그렇다.
    // 여기서 거르는 건 `배열이 아닌 것`, 즉 서버가 안 준 경우뿐이다.
    items: (r.fixed_items as Record<string, unknown>[]).map((i) => ({
      key: String(i.key ?? ''), total: Number(i.total ?? 0),
    })),
  };
}

export type TaxMode = 'included' | 'separate' | 'exempt';

/** 부가세 외 세금 항목 — 카드 수수료 등. rate 는 판매가 대비 %(0052). */
export interface TaxItem {
  name: string;
  rate: number;
}

/** '(−) 세금' 을 펼쳤을 때 보이는 한 줄. 부가세는 builtin. */
export interface TaxRow extends TaxItem {
  amount: number;
  builtin: boolean;
}

const taxItems = (v: unknown): TaxItem[] =>
  ((v ?? []) as Record<string, unknown>[]).map((i) => ({
    name: String(i.name ?? ''),
    rate: Number(i.rate ?? 0),
  }));

const taxRows = (v: unknown): TaxRow[] =>
  ((v ?? []) as Record<string, unknown>[]).map((i) => ({
    name: String(i.name ?? ''),
    rate: Number(i.rate ?? 0),
    amount: Number(i.amount ?? 0),
    builtin: i.builtin === true,
  }));

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
  /**
   * 현재 장부 재고(기준단위). **음수일 수 있다**(0102).
   * ⚠ 이 줄은 사용량·단가·원가와 다른 축이다. 원가는 음수가 되지 않는다 —
   *   음수인 것은 지금 창고에 얼마가 있느냐뿐이다.
   */
  stockTotal: number;
  safetyStock: number;
  soonOut: boolean;
}

export interface RecipeDetail {
  id: string;
  name: string;
  price: number;
  active: boolean;
  /** 최근 30일 판매 실적 — 레시피 화면에서 매출 탭으로 건너가지 않게. */
  sales30d: { qty: number; revenue: number; waste: number };
  /** 메뉴 메모. 식재료와 같은 자리에 같은 모양으로 보인다(0063). */
  memo: string | null;
  /** 상세 첫 카드 아래 한 줄에 쓸 마지막 변경(0063). */
  lastChange: LastChange;
  taxMode: TaxMode;
  /** 부가세 외 세금 항목(0052). 편집 화면이 그대로 고쳐 되보낸다. */
  taxItems: TaxItem[];
  /** 부가세를 포함한 항목별 내역 — 손익표의 '(−) 세금' 을 펼칠 때. */
  taxBreakdown: TaxRow[];
  tax: number;
  baseServings: number;
  targetProfitRate: number;
  avgMonthlySales: number | null;
  materialCost: number;
  extraCost: number;
  fixedRate: number;
  /**
   * ⚠ `fixedRate` 를 낸 **그 달**과 **그 달의 항목**이다(0128). 서버가 한 문장에서
   *   같이 낸다 — 앱이 따로 고정지출을 조회하면 매장 자정 사이에 두 요청이 갈려
   *   9월 비율을 8월 항목으로 쪼갤 수 있다(합계는 맞고 줄마다 틀린다).
   */
  fixedMonth: string;
  fixedItems: { key: string; total: number }[];
  categoryId: string | null;
  lines: RecipeLine[];
  extras: { id: string; name: string; amount: number; materialId: string | null; qty: number }[];
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
      // 던지면 react-query 가 오류로 잡고, 화면의 QueryState 가 재시도를 준다.
      const fixed = reqFixed(r);
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
        memo: str(r.memo),
        lastChange: parseLastChange(r.last_change),
        taxMode: r.tax_mode as TaxMode,
        taxItems: taxItems(r.tax_items),
        taxBreakdown: taxRows(r.tax_breakdown),
        tax: num(r.tax),
        baseServings: num(r.base_servings),
        targetProfitRate: num(r.target_profit_rate),
        avgMonthlySales: numOrNull(r.avg_monthly_sales),
        materialCost: num(r.material_cost),
        extraCost: num(r.extra_cost),
        fixedRate: num(r.fixed_rate),
        fixedMonth: fixed.month,
        fixedItems: fixed.items,
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
          stockTotal: num(l.stock_total),
          safetyStock: num(l.safety_stock),
          soonOut: Boolean(l.soon_out),
        })),
        extras: ((r.extras ?? []) as Record<string, unknown>[]).map((e) => ({
          id: String(e.id),
          name: String(e.name),
          amount: num(e.amount),
          materialId: str(e.material_id),
          qty: num(e.qty) || 1,
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
  memo?: string | null;
  /*
   * ⚠ 세금은 여기 없다(0087). 매장 설정(MY > 세금)이 정하고 서버 트리거가
   *   레시피에 실어 준다 — 레시피 저장으로는 세금을 못 바꾼다.
   *   값이 바뀌는 길은 하나여야 한다(절대원칙 2 와 같은 이유).
   */
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
        base_servings: input.baseServings,
        target_profit_rate: input.targetProfitRate,
        avg_monthly_sales: input.avgMonthlySales ?? '',
      };
      if (input.memo !== undefined) payload.memo = input.memo ?? '';
      if (input.categoryId !== undefined) payload.category_id = input.categoryId ?? '';
      if (input.active !== undefined) payload.active = input.active;
      if (input.lines) {
        payload.lines = input.lines.map((l) => ({
          ingredient_id: l.ingredientId ?? '',
          /*
           * ⚠ `sub_recipe_id` 를 보내지 않는다(0109). 반제품은 1차 범위 밖이고,
           *   서버도 값이 들어오면 거부한다. 예전엔 `''` 를 보내고 있었는데,
           *   빈 문자열이라 통과했을 뿐 **보내는 자리가 남아 있다는 게 문제**였다 —
           *   화면 하나만 채우면 예약 컬럼이 곧바로 기능이 된다.
           */
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

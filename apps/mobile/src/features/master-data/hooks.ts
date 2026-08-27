/**
 * 카테고리·거래처·판매 채널·부자재의 공용 마스터 데이터 훅.
 * 화면 도메인과 무관한 기준 목록과 생명주기를 이 경계에서 소유한다.
 */
import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidate, invalidateOn, qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { asJson } from '@/lib/json';
import { useStoreId } from '@/lib/SessionProvider';
import { rpcNullableString as str, rpcNumber as num } from '@/lib/rpcValue';

export type CategoryKind = 'ingredient' | 'recipe' | 'material';

export interface CategoryRow { id: string; name: string; kind: CategoryKind; sortOrder: number; usedCount: number }
export interface VendorRow { id: string; name: string; usedCount: number }
export interface ChannelRow { id: string; code: string; name: string; active: boolean }
/** 부자재 마스터 — 여러 메뉴가 같은 단가를 참조하게 한다. */
export interface MaterialRow {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  unitCost: number;
  unitLabel: string;
  memo: string | null;
  usedCount: number;
}

export interface SettingsLists {
  categories: CategoryRow[];
  recipeCategories: CategoryRow[];
  materialCategories: CategoryRow[];
  materials: MaterialRow[];
  vendors: VendorRow[];
  channels: ChannelRow[];
}

export function useSettingsLists() {
  const storeId = useStoreId();
  return useQuery({
    queryKey: qk.settingsLists,
    queryFn: async (): Promise<SettingsLists> => {
      const { data, error } = await supabase.rpc('settings_lists', { p_store: storeId });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as unknown as Record<string, unknown>;
      const cats = (v: unknown): CategoryRow[] =>
        ((v ?? []) as Record<string, unknown>[]).map((c) => ({
          id: String(c.id), name: String(c.name),
          kind: (c.kind as CategoryKind) ?? 'ingredient',
          sortOrder: num(c.sort_order),
          usedCount: num(c.used_count),
        }));

      return {
        categories: cats(r.categories),
        recipeCategories: cats(r.recipe_categories),
        materialCategories: cats(r.material_categories),
        materials: ((r.materials ?? []) as Record<string, unknown>[]).map((m) => ({
          id: String(m.id), name: String(m.name),
          categoryId: str(m.category_id), categoryName: str(m.category_name),
          unitCost: num(m.unit_cost), unitLabel: String(m.unit_label ?? '개'),
          memo: str(m.memo), usedCount: num(m.used_count),
        })),
        vendors: ((r.vendors ?? []) as Record<string, unknown>[]).map((v) => ({
          id: String(v.id), name: String(v.name), usedCount: num(v.used_count),
        })),
        channels: ((r.channels ?? []) as Record<string, unknown>[]).map((c) => ({
          id: String(c.id), code: String(c.code), name: String(c.name),
          active: Boolean(c.active),
        })),
      };
    },
  });
}

export function useSaveCategory() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; kind?: CategoryKind }) => {
      const { error } = await supabase.rpc('save_category', {
        p_store: storeId,
        p_payload: asJson({
          id: input.id ?? '',
          name: input.name,
          kind: input.kind ?? 'ingredient',
        }),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(qc, invalidateOn.settingsSaved()),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_category', { p_id: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(qc, invalidateOn.settingsSaved()),
  });
}

/** 드래그 정렬 — 여러 행이 동시에 바뀌므로 순서 전체를 한 번에 보낸다. */
export function useReorderCategories() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.rpc('reorder_categories', { p_store: storeId, p_ids: ids });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(qc, invalidateOn.settingsSaved()),
  });
}

export function useSaveVendor() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (input: { id?: string; name: string }) => {
      const { error } = await supabase.rpc('save_vendor', {
        p_store: storeId,
        p_payload: asJson({ id: input.id ?? '', name: input.name }),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(qc, invalidateOn.settingsSaved()),
  });
}

/**
 * 이름으로 거래처를 확보한다 — 있으면 그 id, 없으면 만들어서 id.
 *
 * 재고 추가에서 `직접 입력` 으로 구매처를 적을 때 쓴다(기획안 §4.4).
 * ⚠ 같은 이름을 두 번 만들지 않는다. `save_vendor` 가 중복을 23505 로 막긴 하지만,
 *   막힌 뒤에 되찾는 것보다 먼저 찾아보는 게 낫다 — 대소문자만 다른 경우도 같은 곳이다.
 */
export function useEnsureVendor() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  const lists = useSettingsLists();
  return useCallback(
    async (name: string): Promise<string> => {
      const n = name.trim();
      if (n === '') throw new Error('구매처를 입력해 주세요');

      const hit = (lists.data?.vendors ?? []).find(
        (v) => v.name.trim().toLowerCase() === n.toLowerCase(),
      );
      if (hit) return hit.id;

      const { data, error } = await supabase.rpc('save_vendor', {
        p_store: storeId,
        p_payload: asJson({ id: '', name: n }),
      });
      if (error) throw new Error(error.message);
      invalidate(qc, invalidateOn.settingsSaved());
      return String(data);
    },
    [qc, storeId, lists.data],
  );
}

/** 발주 이력이 있으면 서버가 숨김 처리한다 — 지우면 과거 발주의 거래처가 사라진다. */
export function useDeleteVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_vendor', { p_id: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(qc, invalidateOn.settingsSaved()),
  });
}

export function useSaveChannel() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (input: { id: string; name: string; active?: boolean }) => {
      const { error } = await supabase.rpc('save_channel', {
        p_store: storeId,
        p_payload: asJson({ id: input.id, name: input.name, active: input.active }),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(qc, invalidateOn.settingsSaved()),
  });
}

/**
 * 채널 사용 중지 — 지우지 않는다.
 * 과거 매출이 그 채널로 기록돼 있어서, 지우면 "어디서 팔았는지 모르는 매출"이 남는다.
 */
export function useRetireChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('retire_channel', { p_id: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(qc, invalidateOn.settingsSaved()),
  });
}

// ── 부자재 마스터 (RCP-13) ────────────────────────────────────

export function useSaveMaterial() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      name: string;
      categoryId: string | null;
      /** 개당 단가(원). 박스로 샀으면 화면이 낱개로 환산해 넘긴다(절대원칙 1). */
      unitCost: number;
      unitLabel?: string;
      memo?: string | null;
    }) => {
      const { error } = await supabase.rpc('save_material', {
        p_store: storeId,
        p_payload: asJson({
          id: input.id ?? '',
          name: input.name,
          category_id: input.categoryId ?? '',
          unit_cost: input.unitCost,
          unit_label: input.unitLabel ?? '개',
          memo: input.memo ?? '',
        }),
      });
      if (error) throw new Error(error.message);
    },
    // 부자재 단가가 바뀌면 그걸 쓰는 메뉴 원가가 함께 움직인다 — 레시피도 무효화한다.
    onSuccess: () => invalidate(qc, [...invalidateOn.settingsSaved(), qk.recipes]),
  });
}

export function useDeactivateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('deactivate_material', { p_id: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(qc, [...invalidateOn.settingsSaved(), qk.recipes]),
  });
}

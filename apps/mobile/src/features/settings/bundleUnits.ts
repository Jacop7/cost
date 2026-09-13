import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useStoreId } from '@/lib/SessionProvider';
import { qk } from '@/lib/queryClient';
import { rpcError, supabase } from '@/lib/supabase';

export interface BundleUnit { id: string; name: string; quantity: number; itemUnitName: string; revision: number }
export function parseBundleUnit(value: unknown): BundleUnit {
  const r = value as Record<string, unknown> | null;
  if (!r || typeof r.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(r.id) || typeof r.name !== 'string' || !r.name.trim()
    || !Number.isSafeInteger(r.quantity) || Number(r.quantity) < 1 || Number(r.quantity) > 1_000_000
    || !Number.isSafeInteger(r.revision) || Number(r.revision) < 1) throw new Error('묶음 단위 정보를 확인할 수 없어요.');
  const itemUnitName = r.item_unit_name === undefined ? '개' : r.item_unit_name;
  if (typeof itemUnitName !== 'string' || !itemUnitName.trim() || itemUnitName.length > 20 || /[\u0000-\u001f\u007f]/.test(itemUnitName)) throw new Error('낱개 단위명을 확인할 수 없어요.');
  return { itemUnitName, id: r.id, name: r.name, quantity: Number(r.quantity), revision: Number(r.revision) };
}
export function newBundleUnitId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  // Identity only, never an authentication secret. Server UUID uniqueness is authoritative.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.floor(Math.random() * 16); return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });
}
export function useBundleUnits() {
  const storeId = useStoreId();
  return useQuery({ queryKey: [...qk.bundleUnits, storeId], queryFn: async () => {
    const { data, error } = await supabase.rpc('get_bundle_units', { p_store: storeId });
    if (error) throw rpcError(error);
    if (!Array.isArray(data)) throw new Error('묶음 단위 목록을 확인할 수 없어요.');
    return data.map(parseBundleUnit);
  } });
}
export function useBundleUnitActions() {
  const storeId = useStoreId(); const qc = useQueryClient();
  const refresh = () => { void qc.invalidateQueries({ queryKey: [...qk.bundleUnits, storeId] }); };
  const save = useMutation({ mutationFn: async (input: BundleUnit) => {
    const { data, error } = await supabase.rpc('save_bundle_unit', { p_store: storeId, p_id: input.id,
      p_name: input.name.trim(), p_item_unit_name: input.itemUnitName.trim(), p_quantity: input.quantity, p_base_revision: input.revision });
    if (error) throw rpcError(error); return parseBundleUnit(data);
  }, onSuccess: refresh });
  const remove = useMutation({ mutationFn: async (input: BundleUnit) => {
    const { data, error } = await supabase.rpc('delete_bundle_unit', { p_store: storeId, p_id: input.id, p_base_revision: input.revision });
    if (error) throw rpcError(error);
    if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.changed !== 'boolean') throw new Error('삭제 결과를 확인하지 못했어요. 다시 확인해 주세요.');
  }, onSuccess: refresh });
  return { save, remove };
}

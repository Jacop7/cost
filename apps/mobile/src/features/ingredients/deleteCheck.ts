import { supabase, rpcError } from '@/lib/supabase';

export async function checkIngredientDeletion(id: string) {
  const { data, error } = await supabase.rpc('ingredient_delete_check', { p_ingredient: id });
  if (error) throw rpcError(error);
  const value = data as { can_delete?: unknown; menu_names?: unknown } | null;
  if (!value || typeof value.can_delete !== 'boolean' || !Array.isArray(value.menu_names)
    || !value.menu_names.every(name => typeof name === 'string') || value.can_delete !== (value.menu_names.length === 0))
    throw new Error('재료 연결 정보를 확인하지 못했어요.');
  return { canDelete: value.can_delete, menuNames: value.menu_names as string[] };
}

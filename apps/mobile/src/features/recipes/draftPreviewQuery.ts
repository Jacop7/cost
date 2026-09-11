import { useQuery } from '@tanstack/react-query';
import { supabase, rpcError } from '@/lib/supabase';
import { qk } from '@/lib/queryClient';
import { useRecipeScope } from './useRecipeScope';
import { parseDraftPreview } from './draftPreviewContract';
import type { DraftPreviewInput } from './draftPreviewInput';
export const draftPreviewKey = (actorId: string, storeId: string, input: DraftPreviewInput | null) =>
  [...qk.recipes, 'draft-preview', actorId, storeId, input] as const;
export function previewRpcError(error: { code?: string | null; message: string }) {
  return error.code === 'PGRST202' || error.code === '42883'
    ? new Error('현재 연결에서 이 계산을 사용할 수 없어요. 업데이트 후 다시 시도해 주세요.') : rpcError(error);
}
export function useRecipeDraftPreview(input: DraftPreviewInput | null) {
  const { actorId, storeId } = useRecipeScope();
  return useQuery({ queryKey: draftPreviewKey(actorId, storeId, input), enabled: input !== null, staleTime: 0,
    refetchOnMount: 'always', retry: false,
    queryFn: async () => {
      if (!input) throw new Error('입력을 확인해 주세요.');
      const { data, error } = await supabase.rpc('recipe_draft_preview', { p_store: storeId, p_input: input });
      if (error) throw previewRpcError(error);
      return parseDraftPreview(data, actorId, storeId, input);
    } });
}
export function useRecipeRecommendation(recipeId: string, enabled = true) {
  const { actorId, storeId } = useRecipeScope();
  return useQuery({ queryKey: [...qk.recipe(recipeId), 'recommendation', actorId, storeId], enabled: enabled && Boolean(recipeId),
    staleTime: 0, refetchOnMount: 'always', retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('recipe_price_recommendation', { p_store: storeId, p_recipe: recipeId });
      if (error) throw previewRpcError(error);
      return parseDraftPreview(data, actorId, storeId, undefined, recipeId);
    } });
}

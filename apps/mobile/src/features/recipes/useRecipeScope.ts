import { useSessionState, useStoreId } from '@/lib/SessionProvider';
import type { RecipeScope } from './writeContract';
export function useRecipeScope(): RecipeScope {
  const storeId = useStoreId();
  const { userId } = useSessionState();
  if (!userId) throw new Error('로그인 정보를 확인하지 못했어요.');
  return { actorId: userId, storeId };
}

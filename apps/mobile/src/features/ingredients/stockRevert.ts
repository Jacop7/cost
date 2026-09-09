import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { invalidate, invalidateOn } from '@/lib/queryClient';

export function useRevertStockEvent(ingredientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.rpc('revert_latest_stock_event', { p_event: eventId });
      if (error) throw new Error(error.message);
    },
    onSettled: () => invalidate(qc, invalidateOn.e1(ingredientId)),
  });
}

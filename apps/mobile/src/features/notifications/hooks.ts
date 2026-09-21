import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useStoreId } from '@/lib/SessionProvider';
import { qk } from '@/lib/queryClient';
import { enablePushDevice, synchronizePushDevice } from './pushRegistration';

export function usePushDeviceRegistration() {
  const storeId = useStoreId();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: qk.pushDevice(storeId),
    queryFn: () => synchronizePushDevice(storeId),
    staleTime: 60_000,
    retry: false,
  });
  const enable = useMutation({
    mutationFn: () => enablePushDevice(storeId),
    onSuccess: (value) => qc.setQueryData(qk.pushDevice(storeId), value),
  });
  return { query, enable };
}

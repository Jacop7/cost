import { View } from 'react-native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, QueryState } from '@/components/kit';
import { BusinessDateGate } from '@/features/business-day/components/BusinessDateGate';
import { useStoreLocalDate } from '@/features/business-day/businessDay';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';
import { InboundOrderForm } from '../components/InboundOrderForm';
import { useOrderBoard, type OrderRecord } from '../hooks';

export default function InboundOrderScreen() {
  return <BusinessDateGate source={useStoreLocalDate()} title="입고 완료" onBack={() => safeBack('/orders?tab=waiting')}>
    {(localDate) => <InboundOrderBody localDate={localDate} />}
  </BusinessDateGate>;
}

function InboundOrderBody({ localDate }: { localDate: string }) {
  const { order: orderId } = useLocalSearchParams<{ order?: string }>();
  const router = useRouter();
  const board = useOrderBoard();
  const findOrder = (data = board.data): OrderRecord | undefined => data
    ? [...data.waiting, ...data.received].find((item) => item.id === orderId)
    : undefined;
  const order = findOrder();
  const saved = () => router.replace('/orders?tab=waiting' as Href);
  const refreshOrder = async () => {
    const latest = await board.refetch();
    if (latest.isError || !latest.data) throw Error('최신 발주 수량을 불러오지 못했어요. 다시 확인해 주세요.');
    return [...latest.data.waiting, ...latest.data.received].find((item) => item.id === orderId);
  };
  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <AppHeader title="입고 완료" onBack={() => safeBack('/orders?tab=waiting')} />
    <QueryState isLoading={board.isLoading} error={board.error} isEmpty={!order}
      onRetry={() => void board.refetch()} emptyTitle="입고할 발주를 찾을 수 없어요" emptyHint="입고 예정 목록에서 다시 선택해 주세요.">
      {order ? <InboundOrderForm key={order.id} initialOrder={order} localDate={localDate} onSaved={saved} refreshOrder={refreshOrder} /> : null}
    </QueryState>
  </View>;
}

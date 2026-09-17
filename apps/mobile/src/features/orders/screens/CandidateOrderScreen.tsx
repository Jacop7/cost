import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';
import { useStoreLocalDate } from '@/features/business-day/businessDay';
import { BusinessDateGate } from '@/features/business-day/components/BusinessDateGate';
import { CandidateOrderForm } from '../components/CandidateOrderForm';
import { useOrderBoard } from '../hooks';

/** 발주 후보에서 진입하는 실제 발주 완료 화면이다. AppMap도 이 화면을 사용한다. */
export default function CandidateOrderScreen() {
  return <BusinessDateGate source={useStoreLocalDate()} title="발주 완료" onBack={() => safeBack('/orders')}>
    {(localDate) => <CandidateOrderBody localDate={localDate} />}
  </BusinessDateGate>;
}

function CandidateOrderBody({ localDate }: { localDate: string }) {
  const { ingredient } = useLocalSearchParams<{ ingredient?: string }>();
  const router = useRouter();
  const board = useOrderBoard();
  const candidate = ingredient ? board.data?.candidates.find((c) => c.ingredientId === ingredient)
    : board.data?.candidates[0];
  const saved = () => router.replace('/orders?tab=waiting');
  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <AppHeader title="발주 완료" onBack={() => safeBack('/orders')} />
      <QueryState isLoading={board.isLoading} error={board.error} isEmpty={!candidate}
        onRetry={() => void board.refetch()} emptyTitle="발주 후보가 없어요" emptyHint="발주 목록에서 후보를 다시 선택해 주세요.">
        {candidate ? <CandidateOrderForm key={candidate.ingredientId} candidate={candidate} localDate={localDate} onSaved={saved} presentation="page" /> : null}
      </QueryState>
  </View>;
}

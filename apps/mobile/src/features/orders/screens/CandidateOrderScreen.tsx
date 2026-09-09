import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, QueryState, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';
import { useStoreLocalDate } from '@/features/business-day/businessDay';
import { BusinessDateGate } from '@/features/business-day/components/BusinessDateGate';
import { CandidateOrderForm } from '../components/CandidateOrderForm';
import { useOrderBoard } from '../hooks';

/** 후보 주문과 직접 발주는 다른 흐름이다. AppMap도 이 실제 화면을 사용한다. */
export default function CandidateOrderScreen() {
  return <BusinessDateGate source={useStoreLocalDate()} title="주문하기" onBack={() => safeBack('/orders')}>
    {(localDate) => <CandidateOrderBody localDate={localDate} />}
  </BusinessDateGate>;
}

function CandidateOrderBody({ localDate }: { localDate: string }) {
  const { ingredient, openOrder } = useLocalSearchParams<{ ingredient?: string; openOrder?: string }>();
  const board = useOrderBoard();
  const [popup, setPopup] = useState(openOrder === '1');
  const candidate = ingredient ? board.data?.candidates.find((c) => c.ingredientId === ingredient)
    : board.data?.candidates[0];
  const saved = () => safeBack('/orders');
  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <AppHeader title="주문하기" onBack={() => safeBack('/orders')} />
      <QueryState isLoading={board.isLoading} error={board.error} isEmpty={!candidate}
        onRetry={() => void board.refetch()} emptyTitle="발주 후보가 없어요" emptyHint="발주 목록에서 후보를 다시 선택해 주세요.">
        {candidate ? <CandidateOrderForm key={candidate.ingredientId} candidate={candidate} localDate={localDate} onSaved={saved} presentation="page" /> : null}
      </QueryState>
    <Sheet visible={popup && Boolean(candidate)} onClose={() => setPopup(false)} title="주문하기">
      {popup && candidate ? <CandidateOrderForm key={candidate.ingredientId} candidate={candidate} localDate={localDate} onSaved={saved} /> : null}
    </Sheet>
  </View>;
}

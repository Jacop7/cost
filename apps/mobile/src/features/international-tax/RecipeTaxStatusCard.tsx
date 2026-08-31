/** RCP-02 국제 과세 상태 — capability가 열린 뒤에만 서버 확정값을 표시한다. */
import { Text, View } from 'react-native';
import { Card, QueryState } from '@/components/kit';
import { T } from '@/theme/tokens';
import { useAppCapabilities, useRecipeTaxState } from './hooks';

const TREATMENT = {
  taxable: '일반 과세',
  zero_rated: '0% 과세',
  exempt: '면세',
} as const;

export function RecipeTaxStatusCard({ recipeId }: { recipeId: string }) {
  const capabilities = useAppCapabilities();
  const enabled = Boolean(capabilities.data?.internationalTax.readEnabled);
  const state = useRecipeTaxState(recipeId, enabled);

  if (!enabled) return null;
  return (
    <Card>
      <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink }}>국제 과세 상태</Text>
      <QueryState
        isLoading={state.isLoading}
        error={state.error}
        isEmpty={false}
        onRetry={() => void state.refetch()}
        emptyTitle="과세 상태가 없어요"
      >
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: T.ink2 }}>
            {state.data?.treatment ? TREATMENT[state.data.treatment] : '매장 기본 과세 상태'}
          </Text>
          <Text style={{ fontSize: 13, color: T.sub2, marginTop: 4 }}>
            {state.data?.taxCategory
              ? `카테고리 ${state.data.taxCategory}`
              : '판매할 때 적용되는 프로필과 카테고리를 서버가 확정해요.'}
          </Text>
          {!state.data?.capabilities.internationalTax.writeEnabled ? (
            <Text style={{ fontSize: 13, color: T.ter, marginTop: 7 }}>
              스테이징 전환 전에는 이 화면에서 과세 상태를 바꿀 수 없어요.
            </Text>
          ) : null}
        </View>
      </QueryState>
    </Card>
  );
}

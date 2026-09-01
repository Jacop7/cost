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
  const categoryName = state.data?.categories.find((category) => category.code === state.data?.taxCategory)?.name;
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
              ? `카테고리 ${categoryName ?? '확인 필요'}`
              : '판매할 때 적용되는 프로필과 카테고리를 서버가 확정해요.'}
          </Text>
          {!state.data?.capabilities.internationalTax.writeEnabled ? (
            <Text style={{ fontSize: 13, color: T.ter, marginTop: 7 }}>
              과세 상태 변경 기능은 준비 중이에요.
            </Text>
          ) : null}
        </View>
      </QueryState>
    </Card>
  );
}

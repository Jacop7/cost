/** RCP-02 현재 메뉴에 적용되는 손익용 세금 계산 상태. */
import { Text, View } from 'react-native';
import { Card, QueryState } from '@/components/kit';
import { T } from '@/theme/tokens';
import { formatMarketMoney } from '@costkeep/core';
import { useAppCapabilities, useRecipeTaxState } from './hooks';

export function RecipeTaxStatusCard({ recipeId }: { recipeId: string }) {
  const capabilities = useAppCapabilities();
  const enabled = Boolean(capabilities.data?.internationalTax.readEnabled);
  const state = useRecipeTaxState(recipeId, enabled);

  if (!enabled) return null;
  const currentMarket = state.data?.quoteContext?.market;
  const taxApplied = currentMarket?.priceBasis === 'tax_inclusive';
  return (
    <Card>
      <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink }}>세금 계산</Text>
      <QueryState
        isLoading={state.isLoading}
        error={state.error}
        isEmpty={false}
        onRetry={() => void state.refetch()}
        emptyTitle="세금 계산 상태가 없어요"
      >
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: T.ink2 }}>
            {taxApplied ? '판매가에 세금 포함' : '판매가에 세금 별도'}
          </Text>
          <Text style={{ fontSize: 13, color: T.sub2, marginTop: 4 }}>
            {taxApplied ? '판매 시점 설정으로 세액을 계산해 순이익에서 차감해요.' : '판매가 전액을 순매출로 사용해요.'}
          </Text>
          {taxApplied&&state.data?.quote&&currentMarket?<Text style={{fontSize:14,fontWeight:'700',color:T.ink2,marginTop:7}}>
            현재 판매가 세금 {formatMarketMoney(state.data.quote.taxAmount, currentMarket.currencyCode)} · 순매출 {formatMarketMoney(state.data.quote.netSales, currentMarket.currencyCode)}
          </Text>:null}
        </View>
      </QueryState>
    </Card>
  );
}

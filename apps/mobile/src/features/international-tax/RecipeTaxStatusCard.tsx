/** RCP-02 국제 과세 상태 — 과거 판매는 snapshot, 새 판매는 여기서 고른 판본을 쓴다. */
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, QueryState } from '@/components/kit';
import { T } from '@/theme/tokens';
import { RpcError } from '@/lib/supabase';
import { useAppCapabilities, useRecipeTaxState, useSaveMenuTaxOverride } from './hooks';

const TREATMENT = {
  taxable: '일반 과세',
  zero_rated: '0% 과세',
  exempt: '면세',
} as const;

export function RecipeTaxStatusCard({ recipeId }: { recipeId: string }) {
  const capabilities = useAppCapabilities();
  const enabled = Boolean(capabilities.data?.internationalTax.readEnabled);
  const state = useRecipeTaxState(recipeId, enabled);
  const save = useSaveMenuTaxOverride(recipeId);
  const [error,setError]=useState<string|null>(null);

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
          ) : state.data?.taxProfileId ? <View style={{gap:7,marginTop:10}}>
            <Button kind="gray" size="md" disabled={save.isPending} onPress={()=>{setError(null);save.mutate({taxProfileId:state.data!.taxProfileId!,taxCategory:null,treatment:null,baseRevision:state.data!.overrideRevision},{onError:e=>{if(e instanceof RpcError&&e.code==='45009'){setError('다른 기기에서 과세 상태가 변경됐어요. 새로고침해 주세요.');return;}setError(e instanceof Error?e.message:'저장하지 못했어요');}});}}>매장 기본값</Button>
            {state.data.categories.map(category=><Button key={category.code} kind="gray" size="md" disabled={save.isPending} onPress={()=>{setError(null);save.mutate({taxProfileId:state.data!.taxProfileId!,taxCategory:category.code,treatment:null,baseRevision:state.data!.overrideRevision},{onError:e=>{if(e instanceof RpcError&&e.code==='45009'){setError('다른 기기에서 과세 상태가 변경됐어요. 새로고침해 주세요.');return;}setError(e instanceof Error?e.message:'저장하지 못했어요');}});}}>{category.name}</Button>)}
            {error?<View role="alert"><Text style={{color:T.red,fontWeight:'700'}}>{error}</Text><Button kind="gray" size="md" onPress={()=>{setError(null);void state.refetch();}}>새로고침</Button></View>:null}
          </View> : null}
        </View>
      </QueryState>
    </Card>
  );
}

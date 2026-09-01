/** MY-12 국가·통화 확인 — 국제 세금 capability 활성 전에는 읽기 전용이다. */
import { ScrollView, Text, View } from 'react-native';
import { LAUNCH_MARKETS } from '@margincook/types';
import { AppHeader, Button, Card, Notice, QueryState } from '@/components/kit';
import { useInternationalTaxState } from '@/features/international-tax';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';

export default function MyCountryScreen(){
  const state=useInternationalTaxState();
  const market=state.data?.marketProfile;
  const definition=market?LAUNCH_MARKETS[market.countryCode]:null;
  return <View style={{flex:1,backgroundColor:T.bg}}>
    <AppHeader title="국가 · 통화" onBack={()=>safeBack('/my')}/>
    <ScrollView contentContainerStyle={{padding:16,paddingBottom:32,gap:12}}>
      <QueryState isLoading={state.isLoading} error={state.error} isEmpty={false} onRetry={()=>void state.refetch()} emptyTitle="국가 정보가 없어요">
        {state.data?.onboardingStatus==='manual_review_required'?<Notice>기존 세금 설정을 자동으로 해석할 수 없어요. 국제 세금 전환 전에 직접 확인해야 해요.</Notice>:null}
        {state.data?.onboardingStatus==='country_confirmation_required'?<Notice>매장이 영업하는 국가를 확인해야 해요. 국가는 통화와 세금 계산 기준을 정하지만 앱 언어와 시간대를 바꾸지는 않아요.</Notice>:null}
        {state.data?.onboardingStatus==='tax_profile_required'?<Notice>국가와 통화는 확인됐어요. 세금 기준을 설정해야 국제 세금 기록을 시작할 수 있어요.</Notice>:null}
        <Card>
          <Text style={{fontSize:14,fontWeight:'700',color:T.ter}}>현재 적용 예정 기준</Text>
          <Text style={{fontSize:20,fontWeight:'800',color:T.ink,marginTop:7}}>{definition?.countryNameKo??'아직 확인하지 않음'}</Text>
          <Text style={{fontSize:15,color:T.sub2,marginTop:4}}>{market?`${market.currencyCode} · ${market.businessLocaleCode} · ${market.priceBasis==='tax_inclusive'?'세금 포함 가격':'세금 별도 가격'}`:'국가를 확인하면 통화와 업무 로케일이 함께 정해져요.'}</Text>
          {market?<Text style={{fontSize:13,color:T.ter,marginTop:8}}>{market.effectiveFrom}부터 적용 · 판본 {market.revision}</Text>:null}
        </Card>
        {!state.data?.capabilities.internationalTax.readEnabled?<Notice>국제 세금 기능은 아직 비활성 상태예요. 기존 세금 계산은 그대로 유지됩니다.</Notice>:null}
        <Button kind="primary" size="lg" full disabled accessibilityLabel="국가 확인 저장">
          {state.data?.capabilities.internationalTax.writeEnabled
            ? '이 앱 판본에서는 아직 저장할 수 없어요'
            : '국가·통화 설정은 준비 중이에요'}
        </Button>
      </QueryState>
    </ScrollView>
  </View>;
}

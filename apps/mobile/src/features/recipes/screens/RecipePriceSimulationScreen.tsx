import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { type Href, useLocalSearchParams } from 'expo-router';
import { AppHeader, Card, Input, QueryState, ScrollTabs } from '@/components/kit';
import { COLOR, T, TYPE, space, won } from '@/theme/tokens';
import { formatPercent, recommendedPrice, taxRate } from '@margincook/core';
import { safeBack } from '@/lib/nav';
import { clampDecimals } from '@/lib/num';
import { useAppCapabilities } from '@/features/international-tax';
import { useRecipeDetail } from '../hooks';
import { previewRecipePrice } from '../priceSimulation';
import { useRecipePriceSimulation } from '../priceSimulationQuery';

/** RCP-02c — 실제 판매가/원장은 건드리지 않는 독립 시뮬레이션 화면. */
function LegacyPriceSimulationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useRecipeDetail(id, { readOnly: true });
  const r = query.data;
  const [priceInput, setPriceInput] = useState('');
  const [dirty, setDirty] = useState(false);
  const [batch, setBatch] = useState(false);
  useEffect(() => { setPriceInput(''); setDirty(false); setBatch(false); }, [id]);
  const price = dirty ? Number(priceInput) || 0 : r?.price ?? 0;
  const multiplier = batch ? r?.baseServings ?? 1 : 1;
  const result = r ? previewRecipePrice(price, r.materialCost, r.extraCost, r.fixedRate, taxRate(r.taxItems)) : null;
  const recommendation = r ? recommendedPrice(r.materialCost + r.extraCost, r.fixedRate, r.targetProfitRate / 100, taxRate(r.taxItems)) : null;
  const recommended = recommendation !== null && recommendation > 0 ? Math.round(recommendation / 100) * 100 : null;
  const money = (amount: number) => `${won(Math.round(amount * multiplier))}원`;
  const row = (label: string, amount: number, accent = false, subtitle?: string) => <View key={label}
    style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.lg,
      borderBottomWidth: 1, borderBottomColor: T.line2 }}>
    <View style={{ flex: 1 }}><Text style={{ ...TYPE.body, fontWeight: '700', color: T.ink }}>{label}</Text>
      {subtitle ? <Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary, marginTop: space.xs }}>{subtitle}</Text> : null}</View>
    <View style={{ alignItems: 'flex-end' }}><Text style={{ ...TYPE.body, fontWeight: '800', color: accent ? COLOR.status.negative : T.ink }}>{money(amount)}</Text>
      <Text style={{ ...TYPE.caption, color: COLOR.text.tertiary }}>{formatPercent(price > 0 ? amount / price : 0)}</Text></View>
  </View>;
  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <AppHeader title="판매가 시뮬레이션" onBack={() => safeBack(`/recipes/${id}` as Href)} />
    <ScrollView contentContainerStyle={{ padding: space.lg }}>
      <QueryState isLoading={query.isLoading} error={query.error}
        isEmpty={query.isFetched && !r} emptyTitle="메뉴를 찾을 수 없어요"
        onRetry={() => { void query.refetch(); }}>
        {r && result ? <Card pad={0} style={{ overflow: 'hidden' }}>
          <View style={{ padding: space.lg, backgroundColor: T.surface2 }}><Text style={{ ...TYPE.body, fontWeight: '800', color: T.ink }}>판매 손익</Text></View>
          <ScrollTabs tabs={[`${r.baseServings}인분`, '1인분']} active={batch ? 0 : 1} onChange={index => setBatch(index === 0)} />
          <View style={{ paddingHorizontal: space.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
              <Text style={{ ...TYPE.body, fontWeight: '700', color: T.ink }}>판매가</Text>
              <View style={{ flex: 1 }}><Input variant="stacked" mono suffix="원" accessibilityLabel="시뮬레이션 판매가" keyboardType="number-pad"
                value={dirty ? priceInput : String(r.price)} onChangeText={value => { setDirty(true); setPriceInput(clampDecimals(value, 0)); }} /></View>
            </View>
            <View style={{ flexDirection: 'row', paddingVertical: space.lg }}><Text style={{ flex: 1, ...TYPE.body, fontWeight: '700', color: T.ink }}>판매량</Text><Text style={{ ...TYPE.body, color: T.ink }}>{multiplier}인분</Text></View>
            {row('(−) 세금', result.tax)}
            {row('(−) 재료 원가', r.materialCost)}
            {row('(−) 고정 지출', result.fixed)}
            {row('(−) 부자재', r.extraCost)}
            {row('순이익', result.profit, result.rate * 100 < r.targetProfitRate, result.rate * 100 < r.targetProfitRate ? '목표 미달' : '목표 달성')}
            <View style={{ flexDirection: 'row', gap: space.sm, paddingVertical: space.lg }}>
              <View style={{ flex: 1 }}><Text style={{ ...TYPE.body, color: T.sub }}>권장 판매가</Text><Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary }}>목표 {r.targetProfitRate}% 기준</Text></View>
              <Text style={{ ...TYPE.body, fontWeight: '800', color: T.ink }}>{recommended === null ? '산출 불가' : `${won(recommended)}원`}</Text>
            </View>
          </View>
        </Card> : null}
      </QueryState>
    </ScrollView>
  </View>;
}


export default function RecipePriceSimulationScreen(){
 const cap=useAppCapabilities();const {id}=useLocalSearchParams<{id:string}>();
 const error=cap.error??(!cap.isLoading&&!cap.data?new Error('세금 계산 방식을 확인하지 못했어요.'):null);
 if(cap.isLoading||error)return <View><AppHeader title="판매가 시뮬레이션" onBack={()=>safeBack(`/recipes/${id}` as Href)}/>
  <QueryState isLoading={cap.isLoading} error={error} isEmpty={false} emptyTitle="" onRetry={()=>{void cap.refetch();}}>{null}</QueryState></View>;
 return cap.data?.internationalTax.readEnabled===false?<LegacyPriceSimulationScreen/>:<InternationalSimulation key={id} id={id}/>;
}
function InternationalSimulation({id}:{id:string}){
 const detail=useRecipeDetail(id, { readOnly: true });const r=detail.data;
 const [input,setInput]=useState<string|null>(null);const [batch,setBatch]=useState(false);
 const text=input??(r?String(r.price):'');
 const price=/^\d+(?:\.\d+)?$/.test(text)&&Number.isFinite(Number(text))&&Number(text)<=90071992547409?Number(text):null;
 const query=useRecipePriceSimulation(id,r?price:null);const data=query.data;
 // No placeholderData: each price owns its own result and late responses stay under their original key.
 const ready=data?.status==='ready'?data:null;
 const context=ready?.context;
 const result=ready?(batch?ready.batch:ready.one):null;
 const money=(amount:number|null)=>{if(amount===null||!context)return '산출 전';return new Intl.NumberFormat(context.locale,{style:'currency',currency:context.currencyCode,
  minimumFractionDigits:context.minorUnit,maximumFractionDigits:context.minorUnit}).format(amount);};
 const retry=()=>{void detail.refetch();void query.refetch();};
 return <View style={{flex:1,backgroundColor:T.bg}}>
  <AppHeader title="판매가 시뮬레이션" onBack={()=>safeBack(`/recipes/${id}` as Href)}/>
  <ScrollView contentContainerStyle={{padding:space.lg,gap:space.md}}>
   <QueryState isLoading={detail.isLoading} error={detail.error} isEmpty={detail.isFetched&&!r} emptyTitle="메뉴를 찾을 수 없어요" onRetry={retry}>
    {r?<><Input accessibilityLabel="시뮬레이션 판매가" keyboardType="decimal-pad" value={text}
      onChangeText={setInput}/>
     <Text style={{...TYPE.caption,color:COLOR.text.secondary}}>판매가는 1인분 기준이에요. 실제 판매가는 변경되지 않아요.</Text>
     {price===null?<Text style={{...TYPE.body,color:COLOR.status.negative}}>올바른 판매가를 입력해 주세요.</Text>:
      <QueryState isLoading={query.isFetching} error={query.error} isEmpty={false} emptyTitle="" onRetry={()=>{void query.refetch();}}>
       {data?.status==='unavailable'?<Text style={{...TYPE.body,color:COLOR.text.secondary}}>{data.reason==='not_active'?'세금 설정이 아직 적용되기 전이에요. 적용 후 계산할 수 있어요.':data.reason==='disabled'?'현재 연결에서는 판매가 계산을 사용할 수 없어요.':'현재 적용된 국가·세금 설정이 없어 계산할 수 없어요. MY에서 설정을 확인해 주세요.'}</Text>:null}
       {ready&&context&&result?<Card><ScrollTabs tabs={[`${ready.baseServings}인분`,'1인분']} active={batch?0:1} onChange={i=>setBatch(i===0)}/>
        <Text style={{...TYPE.caption,color:COLOR.text.secondary}}>{context.currencyCode} · {context.priceBasis==='tax_inclusive'?'세금 포함 판매가':'세금 별도 판매가'}</Text>
        {batch?<Text style={{...TYPE.caption,color:COLOR.text.secondary}}>1인분 계산 결과를 기준 인분으로 비교해요.</Text>:null}
        {([
          ['판매가 합계',result.listedTotal],['세금',result.tax],['고객 결제액',result.customerTotal],['세전 순매출',result.netSales],
          ['재료 원가',result.material],['고정 지출',result.fixed],['부자재',result.extra],['순이익',result.profit]
        ] as const).map(([label,amount])=><View key={label} style={{flexDirection:'row',justifyContent:'space-between',paddingVertical:space.md}}>
          <Text style={{...TYPE.body,color:COLOR.text.primary}}>{label}</Text><Text style={{...TYPE.body,color:COLOR.text.primary}}>{money(amount)}</Text></View>)}
        <Text style={{...TYPE.body,color:COLOR.text.secondary}}>{result.profitRate===null?'이익률 산출 전':formatPercent(result.profitRate)}</Text>
        {result.meetsTarget!==null?<Text style={{...TYPE.caption,color:result.meetsTarget?COLOR.status.positive:COLOR.status.negative}}>{result.meetsTarget?'목표 달성':'목표 미달'}</Text>:null}
        {result.material===null?<Text>재료 단가가 확정되면 순이익을 계산할 수 있어요.</Text>:null}
        {result.fixed===null?<Text>이번 달 고정지출 배분 기준이 없어 순이익을 계산할 수 없어요.</Text>:null}
       </Card>:null}
      </QueryState>}</>:null}
   </QueryState>
  </ScrollView>
 </View>;
}

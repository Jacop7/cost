/** MY-12 국가·통화 확인 — 시장 프로필 판본을 서버가 다음 미개장 영업일부터 적용한다. */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LAUNCH_COUNTRY_CODES, LAUNCH_MARKETS, type LaunchCountryCode, type TaxPriceBasis } from '@margincook/types';
import { AppHeader, Button, Card, Notice, QueryState } from '@/components/kit';
import { useInternationalTaxRegions, useInternationalTaxState, useSaveMarketProfile } from '@/features/international-tax';
import { safeBack } from '@/lib/nav';
import { RpcError } from '@/lib/supabase';
import { T } from '@/theme/tokens';

export default function MyCountryScreen(){
  const state=useInternationalTaxState();
  const save=useSaveMarketProfile();
  const market=state.data?.marketProfile;
  const [country,setCountry]=useState<LaunchCountryCode>('KR');
  const [region,setRegion]=useState<string|null>(null);
  const [basis,setBasis]=useState<TaxPriceBasis>('tax_inclusive');
  const [loaded,setLoaded]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const definition=LAUNCH_MARKETS[country];
  const regions=useInternationalTaxRegions(country,definition.requiresTaxRegion);

  useEffect(()=>{if(loaded||!state.data)return;const current=state.data.marketProfile;if(current){setCountry(current.countryCode);setRegion(current.regionCode);setBasis(current.priceBasis);}setLoaded(true);},[loaded,state.data]);
  const chooseCountry=(code:LaunchCountryCode)=>{const next=LAUNCH_MARKETS[code];setCountry(code);setBasis(next.defaultTaxPriceBasis);setRegion(null);setError(null);};

  const onSave=()=>{if(!state.data||!loaded||save.isPending||!state.data.capabilities.internationalTax.writeEnabled||definition.requiresTaxRegion&&!region)return;setError(null);save.mutate({
    countryCode:country,regionCode:region,currencyCode:definition.currencyCode,businessLocaleCode:definition.businessLocaleCode,
    priceBasis:basis,baseProfileId:market?.id??null,baseRevision:market?.revision??null,
  },{onSuccess:()=>{void state.refetch();},onError:(e)=>{if(e instanceof RpcError&&e.code==='45009'){setError('다른 기기에서 국가·통화 설정이 변경됐어요. 새로고침해 주세요.');return;}if(e instanceof RpcError&&e.code==='45017'){setError('금액 기록이 있는 매장은 국가와 통화를 바꿀 수 없어요.');return;}setError(e instanceof Error?e.message:'저장하지 못했어요');}});};

  return <View style={{flex:1,backgroundColor:T.bg}}>
    <AppHeader title="국가 · 통화" onBack={()=>{if(!save.isPending)safeBack('/my');}}/>
    <ScrollView contentContainerStyle={{padding:16,paddingBottom:32,gap:12}}>
      <QueryState isLoading={state.isLoading} error={state.error} isEmpty={false} onRetry={()=>void state.refetch()} emptyTitle="국가 정보가 없어요">
        {state.data?.onboardingStatus==='manual_review_required'?<Notice>기존 세금 설정을 자동으로 해석할 수 없어요. 국가와 세금 기준을 직접 확인해 주세요.</Notice>:null}
        {state.data?.onboardingStatus==='country_confirmation_required'?<Notice>매장이 영업하는 국가를 확인해야 해요. 앱 언어와 매장 시간대는 바뀌지 않아요.</Notice>:null}
        <Card>
          <Text style={{fontSize:14,fontWeight:'700',color:T.ter}}>영업 국가</Text>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:10}}>{LAUNCH_COUNTRY_CODES.map(code=><Choice key={code} selected={country===code} label={LAUNCH_MARKETS[code].countryNameKo} disabled={save.isPending} onPress={()=>chooseCountry(code)}/>)}</View>
          <Text style={{fontSize:14,color:T.sub2,marginTop:12}}>{definition.currencyCode} · {definition.businessLocaleCode}</Text>
        </Card>
        {definition.requiresTaxRegion?<Card><Text style={{fontSize:14,fontWeight:'700',color:T.ter}}>주·도</Text><QueryState isLoading={regions.isLoading} error={regions.error} isEmpty={!regions.data?.length} onRetry={()=>void regions.refetch()} emptyTitle="지역을 불러오지 못했어요"><View style={{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:10}}>{regions.data?.map(r=><Choice key={r.regionCode} selected={region===r.regionCode} label={r.name} disabled={save.isPending} onPress={()=>setRegion(r.regionCode)}/>)}</View></QueryState></Card>:null}
        <Card><Text style={{fontSize:14,fontWeight:'700',color:T.ter}}>메뉴판 가격</Text><View style={{flexDirection:'row',gap:8,marginTop:10}}><Choice selected={basis==='tax_inclusive'} label="세금 포함" disabled={save.isPending} onPress={()=>setBasis('tax_inclusive')}/><Choice selected={basis==='tax_exclusive'} label="세금 별도" disabled={save.isPending} onPress={()=>setBasis('tax_exclusive')}/></View><Text style={{fontSize:13,color:T.sub2,marginTop:9}}>변경 내용은 다음 미개장 영업일부터 적용돼요.</Text></Card>
        {market?<Text style={{fontSize:13,color:T.ter}}>현재 판본 {market.revision} · {market.effectiveFrom}부터 적용</Text>:null}
        {error?<View role="alert"><Text style={{color:T.red,fontWeight:'700'}}>{error}</Text><Button kind="gray" size="md" onPress={()=>{setError(null);void state.refetch();}}>새로고침</Button></View>:null}
        {!state.data?.capabilities.internationalTax.writeEnabled?<Notice>국제 세금 설정은 아직 비활성 상태예요. 기존 계산은 그대로 유지됩니다.</Notice>:null}
        <Button kind="primary" size="lg" full loading={save.isPending} disabled={!state.data?.capabilities.internationalTax.writeEnabled||!loaded||definition.requiresTaxRegion&&!region} accessibilityLabel="국가 확인 저장" onPress={onSave}>저장</Button>
      </QueryState>
    </ScrollView>
  </View>;
}

function Choice({selected,label,disabled,onPress}:{selected:boolean;label:string;disabled?:boolean;onPress:()=>void}){return <Pressable accessibilityRole="button" accessibilityLabel={`${label}${selected?' 선택됨':''}`} accessibilityState={{selected,disabled}} disabled={disabled} onPress={onPress} style={{paddingHorizontal:12,paddingVertical:9,borderRadius:10,borderWidth:1,borderColor:selected?T.blue:T.line2,backgroundColor:selected?T.blueTint:T.surface}}><Text style={{fontWeight:'700',color:selected?T.blue:T.ink2}}>{label}</Text></Pressable>;}

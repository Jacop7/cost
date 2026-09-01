/**
 * MY-02 세금 — 매장 하나에 하나다(0087).
 *
 * 규칙은 하나다 — **판매가 × Σ(항목 요율)**(0090).
 * 포함/별도/면세 세 갈래는 없앴다. 사장님이 답해야 할 질문이 하나 더 생기는 것이었다.
 * 항목이 없으면 0원이고, 그게 면세다.
 *
 * ⚠ 부가세 포함 가격이면 **9.09%** 다(10/110). 10 을 적으면 메뉴당 109원이 더 빠진다.
 *
 * 고정 지출과 **같은 짜임**이다 —
 *   저장 → 전 레시피 손익 재계산 → 각 메뉴의 손익 변동에 '세금 반영' 한 줄.
 *
 * ⚠ 배달 중개 수수료는 여기가 아니라 **고정 지출**이다(0043).
 *   두 곳에 넣으면 같은 돈이 손익에서 두 번 빠진다(실측 19일 503,397원).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { AppHeader, Button, Card, Icon, Input, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { clampDecimals } from '@/lib/num';
import { RpcError } from '@/lib/supabase';
import { T, tnum } from '@/theme/tokens';
import { useSaveStoreTax, useStoreSettings } from '@/features/settings/hooks';
import { useAppCapabilities, useInternationalTaxState, useSaveTaxProfile, type TaxComponentInput } from '@/features/international-tax';
import { LAUNCH_MARKETS, type SalesChannelCode, type TaxTreatment } from '@margincook/types';

interface Row { name: string; rate: string }
type TaxComponentDraft = Omit<TaxComponentInput, 'ratePct'> & { ratePct: string };

export default function MyTaxScreen(){
  const capabilities=useAppCapabilities();
  if(capabilities.isLoading)return <TaxShell><Text style={{color:T.ter}}>불러오는 중…</Text></TaxShell>;
  if(capabilities.isError||!capabilities.data)return <TaxShell><QueryState isLoading={false} error={capabilities.error??new Error('capabilities missing')} isEmpty={false} onRetry={()=>void capabilities.refetch()} emptyTitle="세금 계약이 없어요"><View/></QueryState></TaxShell>;
  return capabilities.data.internationalTax.readEnabled?<InternationalTaxScreen/>:<LegacyTaxScreen/>;
}

function TaxShell({children}:{children:ReactNode}){return <View style={{flex:1,backgroundColor:T.bg}}><AppHeader title="세금" onBack={()=>safeBack('/my')}/><View style={{padding:16}}>{children}</View></View>;}

function InternationalTaxScreen(){
  const state=useInternationalTaxState();const save=useSaveTaxProfile();const market=state.data?.marketProfile;const profile=state.data?.taxProfile;
  const [loaded,setLoaded]=useState(false);const [defaultTreatment,setDefaultTreatment]=useState<TaxTreatment>('taxable');const [components,setComponents]=useState<TaxComponentDraft[]>([]);const [error,setError]=useState<string|null>(null);
  useEffect(()=>{if(loaded||!state.data)return;if(profile){setDefaultTreatment(profile.defaultTreatment);setComponents(profile.components.map((c)=>({key:c.configKey,kind:c.kind,name:c.name,ratePct:String(c.ratePct),jurisdictionLevel:c.jurisdictionLevel,calculationBasis:c.calculationBasis,appliesToTreatments:[...c.appliesToTreatments],sortOrder:c.sortOrder,remittance:{hall:profile.remittanceRules.find(r=>r.taxComponentId===c.id&&r.salesChannel==='hall')?.remittanceOwner??'merchant',delivery:profile.remittanceRules.find(r=>r.taxComponentId===c.id&&r.salesChannel==='delivery')?.remittanceOwner??'merchant',takeout:profile.remittanceRules.find(r=>r.taxComponentId===c.id&&r.salesChannel==='takeout')?.remittanceOwner??'merchant'}})));}else if(market){setComponents([{key:'primary',kind:'primary',name:market.countryCode==='KR'?'부가세':'Primary tax',ratePct:market.countryCode==='KR'?'10':'0',jurisdictionLevel:'national',calculationBasis:'primary_tax_exclusive',appliesToTreatments:['taxable'],sortOrder:0,remittance:{hall:'merchant',delivery:'merchant',takeout:'merchant'}}]);}setLoaded(true);},[loaded,state.data,market,profile]);
  const categories=profile?.categories.map(c=>({code:c.code,name:c.name,treatment:c.treatment,active:c.active??true}))??[{code:'standard',name:'일반 과세',treatment:'taxable' as const,active:true},{code:'zero_rated',name:'0% 과세',treatment:'zero_rated' as const,active:true},{code:'exempt',name:'면세',treatment:'exempt' as const,active:true}];
  const componentInputs:TaxComponentInput[]=components.map(({ratePct,...c})=>({...c,ratePct:Number(ratePct)}));
  const invalid=!market||components.length===0||components.filter(c=>c.kind==='primary').length!==1||components.some(c=>{const rate=Number(c.ratePct);return !c.name.trim()||!c.ratePct.trim()||!Number.isFinite(rate)||rate<0||rate>=100;});
  const update=(key:string,part:Partial<TaxComponentDraft>)=>setComponents(rows=>rows.map(r=>r.key===key?{...r,...part}:r));
  const toggleOwner=(key:string,channel:SalesChannelCode)=>setComponents(rows=>rows.map(r=>r.key===key?{...r,remittance:{...r.remittance,[channel]:r.remittance[channel]==='merchant'?'marketplace':'merchant'}}:r));
  const onSave=()=>{if(invalid||save.isPending||!state.data?.capabilities.internationalTax.writeEnabled)return;setError(null);save.mutate({defaultTreatment,components:componentInputs,categories,baseProfileId:profile?.id??null,baseRevision:profile?.revision??null},{onSuccess:()=>void state.refetch(),onError:(e)=>{if(e instanceof RpcError&&e.code==='45009'){setError('다른 기기에서 세금 설정이 변경됐어요. 새로고침해 주세요.');return;}setError(e instanceof Error?e.message:'저장하지 못했어요');}});};
  return <View style={{flex:1,backgroundColor:T.bg}}><AppHeader title="세금" onBack={()=>{if(!save.isPending)safeBack('/my');}}/><ScrollView contentContainerStyle={{padding:16,paddingBottom:32,gap:12}}>
    <QueryState isLoading={state.isLoading} error={state.error} isEmpty={false} onRetry={()=>void state.refetch()} emptyTitle="세금 프로필이 없어요">
      {market?<><Card><Text style={{fontSize:14,fontWeight:'700',color:T.ter}}>{LAUNCH_MARKETS[market.countryCode].countryNameKo} · {market.currencyCode}</Text><Text style={{fontSize:19,fontWeight:'800',color:T.ink,marginTop:5}}>{market.priceBasis==='tax_inclusive'?'세금 포함 가격':'세금 별도 가격'}</Text><Text style={{fontSize:13,color:T.sub2,marginTop:5}}>{profile?`${profile.effectiveFrom}부터 적용 · 프로필 판본 ${profile.revision}`:'기본세를 확인하면 다음 미개장 영업일부터 적용돼요.'}</Text></Card><Card><Text style={{fontSize:14,fontWeight:'700',color:T.ter}}>매장 기본 과세</Text><View style={{flexDirection:'row',gap:7,marginTop:9}}>{(['taxable','zero_rated','exempt'] as TaxTreatment[]).map(t=><TaxChoice key={t} selected={defaultTreatment===t} label={t==='taxable'?'일반 과세':t==='zero_rated'?'0% 과세':'면세'} onPress={()=>setDefaultTreatment(t)} disabled={save.isPending}/>)}</View></Card>{components.map((c,i)=><Card key={c.key}><Text style={{fontSize:15,fontWeight:'800',color:T.ink}}>{c.kind==='primary'?'기본세':'추가세'} {i+1}</Text><View style={{marginTop:9,gap:8}}><Input value={c.name} disabled={save.isPending} onChangeText={name=>update(c.key,{name})} accessibilityLabel={`${c.key} 세금 이름`}/><Input value={c.ratePct} disabled={save.isPending} keyboardType="decimal-pad" suffix="%" onChangeText={ratePct=>update(c.key,{ratePct:clampDecimals(ratePct,4)})} accessibilityLabel={`${c.key} 세율`}/>{c.kind==='additional'?<TaxChoice selected={c.calculationBasis==='primary_tax_inclusive'} label={c.calculationBasis==='primary_tax_inclusive'?'기본세 포함 금액 기준':'기본세 제외 금액 기준'} onPress={()=>update(c.key,{calculationBasis:c.calculationBasis==='primary_tax_inclusive'?'primary_tax_exclusive':'primary_tax_inclusive'})} disabled={save.isPending}/>:null}<Text style={{fontSize:13,fontWeight:'700',color:T.sub2}}>채널별 납부 주체</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>{(['hall','delivery','takeout'] as SalesChannelCode[]).map(ch=><TaxChoice key={ch} selected={c.remittance[ch]==='marketplace'} label={`${ch} · ${c.remittance[ch]==='merchant'?'매장':'플랫폼'}`} onPress={()=>toggleOwner(c.key,ch)} disabled={save.isPending}/>)}</View>{c.kind==='additional'?<Button kind="gray" size="md" disabled={save.isPending} onPress={()=>setComponents(rows=>rows.filter(r=>r.key!==c.key))}>추가세 삭제</Button>:null}</View></Card>)}<Button kind="gray" size="md" disabled={save.isPending} onPress={()=>setComponents(rows=>[...rows,{key:`additional_${Date.now()}`,kind:'additional',name:'추가세',ratePct:'0',jurisdictionLevel:'custom',calculationBasis:'primary_tax_exclusive',appliesToTreatments:['taxable'],sortOrder:rows.length,remittance:{hall:'merchant',delivery:'merchant',takeout:'merchant'}}])}>추가세 추가</Button></>:<Card><Text style={{fontSize:16,fontWeight:'800',color:T.ink}}>국가·세금 확인이 필요해요</Text><Text style={{fontSize:14,color:T.sub2,marginTop:5}}>국가 화면에서 매장 기준을 먼저 확인해 주세요.</Text></Card>}
      {!state.data?.capabilities.internationalTax.writeEnabled?<View role="status"><Text style={{color:T.sub2,fontWeight:'700'}}>국제 세금 설정 기능은 준비 중이에요. 기존 계산과 기록은 바뀌지 않습니다.</Text></View>:null}
      {error?<View role="alert"><Text style={{color:T.red,fontWeight:'700'}}>{error}</Text><Button kind="gray" size="md" onPress={()=>{setError(null);void state.refetch();}}>새로고침</Button></View>:null}
      <Button kind="primary" size="lg" full disabled={invalid||!state.data?.capabilities.internationalTax.writeEnabled} loading={save.isPending} accessibilityLabel="국제 세금 프로필 저장" onPress={onSave}>저장</Button>
    </QueryState>
  </ScrollView></View>;
}

function TaxChoice({selected,label,onPress,disabled}:{selected:boolean;label:string;onPress:()=>void;disabled?:boolean}){return <Pressable accessibilityRole="button" accessibilityState={{selected,disabled}} disabled={disabled} onPress={onPress} style={{paddingHorizontal:10,paddingVertical:8,borderRadius:9,borderWidth:1,borderColor:selected?T.blue:T.line2,backgroundColor:selected?T.blueTint:T.surface}}><Text style={{fontSize:13,fontWeight:'700',color:selected?T.blue:T.ink2}}>{label}</Text></Pressable>;}

function LegacyTaxScreen() {
  const settings = useStoreSettings();
  const save = useSaveStoreTax();

  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [touched, setTouched] = useState(false);
  const [baseRevision, setBaseRevision] = useState<number | null>(null);
  const [serverChanged, setServerChanged] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const seenRevision = useRef<number | null>(null);
  const conflictBaseRevision = useRef<number | null>(null);

  // 서버 값으로 한 번만 채운다. 매번 덮으면 입력 중에 글자가 되돌아간다.
  useEffect(() => {
    const s = settings.data;
    if (!s) return;
    if (!loaded) {
      setRows(s.taxItems.map((t) => ({ name: t.name, rate: String(t.rate) })));
      setBaseRevision(s.revision);
      seenRevision.current = s.revision;
      setLoaded(true);
      return;
    }
    if (seenRevision.current === s.revision) return;
    // 자체 저장/충돌 새로고침 뒤 늦게 끝난 옛 조회가 더 낮은 판본을 돌려줘도 초안과 기준을 되돌리지 않는다.
    if (seenRevision.current !== null && s.revision < seenRevision.current) return;
    seenRevision.current = s.revision;
    if (!touched && !save.isPending) {
      setRows(s.taxItems.map((t) => ({ name: t.name, rate: String(t.rate) })));
      setBaseRevision(s.revision);
    } else if (s.revision !== baseRevision) {
      setServerChanged(true);
    }
  }, [settings.data, loaded, touched, save.isPending, baseRevision]);

  const editRows = (fn: (prev: Row[]) => Row[]) => {
    setRows(fn);
    setTouched(true);
    setSaveError(null);
  };

  /** 충돌 해결 — 성공 응답의 세금 항목·판본을 편집 기준으로 채택한다. */
  const adoptLatest = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const r = await settings.refetch();
      if (r.isError || !r.data) return;
      const s = r.data;
      const conflictBase = conflictBaseRevision.current;
      if (serverChanged && (
        conflictBase === null
        || s.revision <= conflictBase
        || (seenRevision.current !== null && s.revision < seenRevision.current)
      )) return;
      seenRevision.current = s.revision;
      setRows(s.taxItems.map((t) => ({ name: t.name, rate: String(t.rate) })));
      setBaseRevision(s.revision);
      setTouched(false);
      conflictBaseRevision.current = null;
      setServerChanged(false);
      setSaveError(null);
    } finally { setRefreshing(false); }
  };

  /** 배경 재조회 실패 재시도 — 서버 조회만 다시 하고 사용자가 쓰던 초안은 유지한다. */
  const retryPreservingDraft = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try { await settings.refetch(); }
    finally { setRefreshing(false); }
  };

  const num = (v: string) => {
    const n = parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
  };

  const nameError = rows.some((t) => t.name.trim() === '') ? '항목 이름을 입력해 주세요' : undefined;
  const rateError = rows.some((t) => num(t.rate) < 0 || num(t.rate) >= 100)
    ? '요율은 0 이상 100 미만이어야 해요'
    : undefined;
  const error = nameError ?? rateError;

  /** 세금 = 적은 항목의 합. 서버 `tax_of()` 와 같은 공식이다(절대원칙 3). */
  const rate = rows.reduce((a, t) => a + num(t.rate) / 100, 0);

  const onSave = () => {
    if (error || baseRevision === null || serverChanged || settings.isError || save.isPending) return;
    setSaveError(null);
    save.mutate(
      { items: rows.map((t) => ({ name: t.name.trim(), rate: num(t.rate) })), baseRevision },
      {
        onSuccess: (res) => {
          seenRevision.current = res.revision;
          setBaseRevision(res.revision);
          safeBack('/my');
          if (res.changed) {
            // 몇 개 메뉴가 다시 계산됐는지 말해 준다. 조용히 넘기면 무슨 일이 났는지 모른다.
            Alert.alert('세금을 저장했어요', `메뉴 ${res.recipes}개의 손익이 다시 계산됐어요.`);
          }
        },
        onError: (e) => {
          if (e instanceof RpcError && e.code === '45009') {
            conflictBaseRevision.current = baseRevision;
            setServerChanged(true);
            return;
          }
          setSaveError(e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요');
        },
      },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="세금" onBack={() => { if (!save.isPending) safeBack('/my'); }} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 11 }} showsVerticalScrollIndicator={false}>
        <QueryState
          isLoading={settings.isLoading}
          error={settings.data ? null : settings.error}
          isEmpty={false}
          onRetry={() => void settings.refetch()}
          emptyTitle="설정을 불러오지 못했어요"
        >
          {settings.isError && settings.data ? (
            <View role="alert" style={{ padding: 13, borderRadius: 12, backgroundColor: T.redTint }}>
              <Text style={{ color: T.red, fontWeight: '700' }}>최신 설정을 불러오지 못했어요. 다시 시도해 주세요.</Text>
              <View style={{ marginTop: 8 }}><Button kind="gray" size="md" loading={refreshing} onPress={() => { void retryPreservingDraft(); }}>다시 시도</Button></View>
            </View>
          ) : null}
          {serverChanged ? (
            <View role="status" style={{ padding: 13, borderRadius: 12, backgroundColor: T.redTint, borderWidth: 1, borderColor: T.red }}>
              <Text style={{ color: T.red, fontWeight: '700' }}>다른 기기에서 설정이 변경됐어요. 새로고침 후 다시 저장해 주세요.</Text>
              <View style={{ marginTop: 8 }}><Button kind="gray" size="md" loading={refreshing} onPress={() => { void adoptLatest(); }} accessibilityLabel="새로고침">새로고침</Button></View>
            </View>
          ) : null}
          {saveError ? <Text role="alert" style={{ color: T.red, fontWeight: '700' }}>저장하지 못했어요 · {saveError}</Text> : null}
          {/* 그 밖의 세금·수수료 */}
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15, backgroundColor: T.surface2 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.sub }}>세금 항목</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: T.ter }}>판매가 대비 %</Text>
            </View>

            <View style={{ paddingHorizontal: 15, paddingVertical: 12, gap: 9 }}>
              {rows.map((t, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 2 }}>
                    <Input
                      value={t.name}
                      disabled={save.isPending || serverChanged || settings.isError}
                      onChangeText={(v) => editRows((p) => p.map((x, k) => (k === i ? { ...x, name: v } : x)))}
                      placeholder="예) 부가세, 카드 수수료"
                      accessibilityLabel={`항목 ${i + 1} 이름`}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      value={t.rate}
                      disabled={save.isPending || serverChanged || settings.isError}
                      onChangeText={(v) =>
                        editRows((p) => p.map((x, k) => (k === i ? { ...x, rate: clampDecimals(v, 4) } : x)))
                      }
                      placeholder="0"
                      suffix="%"
                      mono
                      keyboardType="decimal-pad"
                      accessibilityLabel={`항목 ${i + 1} 요율`}
                    />
                  </View>
                  <Pressable
                    onPress={() => editRows((p) => p.filter((_, k) => k !== i))}
                    disabled={save.isPending || serverChanged || settings.isError}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.name || `항목 ${i + 1}`} 삭제`}
                    hitSlop={8}
                    style={{ width: 32, height: 40, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Icon name="close" size={18} color={T.ter} />
                  </Pressable>
                </View>
              ))}

              <Pressable
                onPress={() => editRows((p) => [...p, { name: '', rate: '' }])}
                disabled={save.isPending || serverChanged || settings.isError}
                accessibilityState={{ disabled: save.isPending || serverChanged || settings.isError }}
                accessibilityRole="button"
                accessibilityLabel="세금 항목 추가"
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
                  paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: T.blue,
                }}
              >
                <Icon name="plus" size={17} color={T.blue} sw={2.2} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: T.blue }}>항목 추가</Text>
              </Pressable>

              {error ? (
                <Text style={{ fontSize: 14, fontWeight: '600', color: T.red }}>{error}</Text>
              ) : null}
            </View>
          </Card>

          {/*
            ⚠ 이 한 줄이 0043 의 실측을 막는다. 배달 수수료를 여기와 고정 지출 두 곳에
              넣으면 같은 돈이 손익에서 두 번 빠진다(19일 503,397원).
          */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: 2 }}>
            <Icon name="info" size={15} color={T.ter} />
            <Text style={{ flex: 1, fontSize: 14, color: T.ter, lineHeight: 20 }}>
              배달앱 중개 수수료는 여기가 아니라 <Text style={{ fontWeight: '700' }}>MY {'>'} 고정 지출</Text>에서
              관리해요. 두 곳에 넣으면 같은 돈이 두 번 빠져요.
            </Text>
          </View>
        </QueryState>
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        {/* 저장 직전에 얼마가 빠지는지 — 재고 추가 화면 하단과 같은 짜임 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2, paddingBottom: 12 }}>
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: T.sub }}>판매가에서 빠지는 몫</Text>
          <Text style={[{ fontSize: 16, fontWeight: '800', color: T.blue }, tnum]}>
            {(Math.round(rate * 1000) / 10).toFixed(1)}%
          </Text>
        </View>
        <Button
          kind="primary"
          size="lg"
          full
          disabled={Boolean(error) || !loaded || baseRevision === null || serverChanged || settings.isError}
          loading={save.isPending}
          onPress={onSave}
        >
          저장
        </Button>
      </View>
    </View>
  );
}

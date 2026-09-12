import { ConfigurationHistoryLink } from '@/features/changes/components/ConfigurationHistoryLink';
import { EmptyDataText } from '@/components/kit/EmptyDataText';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { calculateInternationalTax } from '@margincook/core';
import { LAUNCH_COUNTRY_CODES, LAUNCH_MARKETS, type LaunchCountryCode, type SalesChannelCode, type TaxPriceBasis, type TaxTreatment } from '@margincook/types';
import { AppHeader, Button, Card, Field, Icon, Input, QueryState, Sheet } from '@/components/kit';
import { ConfirmDialog } from '@/components/kit/ConfirmDialog';
import { ResultField } from '@/components/kit/ResultField';
import { SelectionRow } from '@/components/kit/SelectionRow';
import { useInternationalTaxRegions, useInternationalTaxState, useSaveMarketProfile, useSaveTaxProfile, type InternationalTaxState, type TaxComponentInput } from '@/features/international-tax';
import { TaxSummaryCard, TaxSummaryRow } from '@/features/international-tax/TaxSummary';
import { safeBack } from '@/lib/nav';
import { clampDecimals } from '@/lib/num';
import { RpcError } from '@/lib/supabase';
import { COLOR, TYPE, T, iconSize, minTouchTarget, radius, rowMinHeight, space, tnum } from '@/theme/tokens';

type Draft = Omit<TaxComponentInput, 'ratePct'> & { ratePct: string };
const channels: SalesChannelCode[] = ['hall', 'delivery', 'takeout'];
const channelNames = { hall: '매장', delivery: '배달', takeout: '포장' };
const merchant = { hall: 'merchant', delivery: 'merchant', takeout: 'merchant' } as const;
const validRate = (value: string) => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) < 100;
const primaryDraft = (country: LaunchCountryCode): Draft => ({ key: 'primary', kind: 'primary', name: country === 'KR' ? '부가세' : '기본세', ratePct: country === 'KR' ? '10' : '0', jurisdictionLevel: 'national', calculationBasis: 'primary_tax_exclusive', appliesToTreatments: ['taxable'], sortOrder: 0, remittance: { ...merchant } });

/** 프로토타입 MY-02의 편집 UI. 미리보기는 core, 저장·적용일은 기존 RPC가 소유한다. */
export function InternationalTaxScreen() {
  const state = useInternationalTaxState();
  const save = useSaveTaxProfile();
  const saveMarket = useSaveMarketProfile();
  const insets = useSafeAreaInsets();
  const [base, setBase] = useState<InternationalTaxState | null>(null);
  const [country, setCountry] = useState<LaunchCountryCode>('KR');
  const [region, setRegion] = useState<string | null>(null);
  const [basis, setBasis] = useState<TaxPriceBasis>('tax_inclusive');
  const [treatment, setTreatment] = useState<TaxTreatment>('taxable');
  const [components, setComponents] = useState<Draft[]>([]);
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [simulationPrice, setSimulationPrice] = useState('');
  const [countryOpen, setCountryOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [edit, setEdit] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveBlocked, setSaveBlocked] = useState(false);
  const sequence = useRef(0);
  const definition = LAUNCH_MARKETS[country];
  const regions = useInternationalTaxRegions(country, definition.requiresTaxRegion);
  const pending = busy || save.isPending || saveMarket.isPending;
  const writable = Boolean(state.data?.capabilities.internationalTax.writeEnabled);
  const disabled = pending || !writable;
  const adopt = (data: InternationalTaxState) => {
    setSaveBlocked(false);
    setBase(data);
    const market = data.marketProfile;
    setCountry(market?.countryCode ?? 'KR'); setRegion(market?.regionCode ?? null);
    setBasis(market?.priceBasis ?? 'tax_inclusive');
    setTreatment(data.taxProfile?.defaultTreatment ?? 'taxable');
    setComponents(data.taxProfile ? data.taxProfile.components.map(c => ({
      key: c.configKey, kind: c.kind, name: c.name, ratePct: String(c.ratePct), jurisdictionLevel: c.jurisdictionLevel,
      calculationBasis: c.calculationBasis, appliesToTreatments: [...c.appliesToTreatments], sortOrder: c.sortOrder,
      remittance: Object.fromEntries(channels.map(ch => [ch, data.taxProfile!.remittanceRules.find(r => r.taxComponentId === c.id && r.salesChannel === ch)?.remittanceOwner ?? 'merchant'])) as Draft['remittance'],
    })) : [primaryDraft(market?.countryCode ?? 'KR')]);
  };
  useEffect(() => { if (!base && state.data) adopt(state.data); }, [base, state.data]);
  const primary = components.find(c => c.kind === 'primary');
  const invalid = !base || (definition.requiresTaxRegion && !region) || components.filter(c => c.kind === 'primary').length !== 1 || components.some(c => !c.name.trim() || !validRate(c.ratePct));
  const update = (key: string, part: Partial<Draft>) => { setSuccess(null); setComponents(rows => rows.map(c => c.key === key ? { ...c, ...part } : c)); };
  // 100 단위의 반올림 전 금액을 사용해 판매가 대비 요율을 표시한다.
  const unitPrice = 100;
  const quote = invalid ? null : calculateInternationalTax({ priceBasis: basis, minorUnit: definition.minorUnit, treatment, unitPrice, quantity: 1,
    components: components.map(c => ({ id: c.key, kind: c.kind, ratePct: Number(c.ratePct), calculationBasis: c.calculationBasis, appliesToTreatments: c.appliesToTreatments, remittanceOwner: c.remittance.hall })) });
  const simulationAmount = Number(simulationPrice);
  const simulation = !invalid && simulationPrice.trim() !== '' && Number.isFinite(simulationAmount) && simulationAmount >= 0 && simulationAmount <= Number.MAX_SAFE_INTEGER / (10 ** definition.minorUnit)
    ? calculateInternationalTax({ priceBasis: basis, minorUnit: definition.minorUnit, treatment, unitPrice: simulationAmount, quantity: 1,
      components: components.map(c => ({ id: c.key, kind: c.kind, ratePct: Number(c.ratePct), calculationBasis: c.calculationBasis, appliesToTreatments: c.appliesToTreatments, remittanceOwner: c.remittance.hall })) }) : null;
  const money = (amount: number) => new Intl.NumberFormat(definition.businessLocaleCode, { style: 'currency', currency: definition.currencyCode, minimumFractionDigits: definition.minorUnit, maximumFractionDigits: definition.minorUnit }).format(amount);
  const primaryAmount = quote?.components.find(c => c.kind === 'primary');
  const additional = components.filter(c => c.kind === 'additional');
  const additionalTotal = quote?.components.filter(c => c.kind === 'additional').reduce((sum, c) => sum + c.unroundedAmount, 0);
  const allOwners = components.flatMap(c => channels.map(ch => c.remittance[ch]));
  const owner = allOwners.length && allOwners.every(v => v === allOwners[0]) ? allOwners[0] : null;
  const setOwner = (value: 'merchant' | 'marketplace') => { setSuccess(null); setComponents(rows => rows.map(c => ({ ...c, remittance: { hall: value, delivery: value, takeout: value } }))); };
  const marketChanged = !base?.marketProfile || base.marketProfile.countryCode !== country || (base.marketProfile.regionCode ?? null) !== region || base.marketProfile.priceBasis !== basis;

  const onSave = async () => {
    if (invalid || disabled || saveBlocked || !base) return;
    setConfirmOpen(false);
    setBusy(true); setError(null); setSuccess(null);
    let marketSaved = false;
    try {
      let taxBase = base.taxProfile;
      if (marketChanged) {
        const result = await saveMarket.mutateAsync({ countryCode: country, regionCode: region, currencyCode: definition.currencyCode, businessLocaleCode: definition.businessLocaleCode, priceBasis: basis, baseProfileId: base.marketProfile?.id ?? null, baseRevision: base.marketProfile?.revision ?? null });
        marketSaved = result.changed;
        const refreshed = await state.refetch();
        if (!refreshed.data || refreshed.error || refreshed.data.marketProfile?.id !== result.profileId) throw new Error('국가 설정을 다시 확인한 뒤 저장해 주세요.');
        if (result.changed && refreshed.data.taxProfile) {
          setSaveBlocked(true);
          throw new Error('새 국가 설정에 다른 세금 설정이 저장됐어요. 최신 설정을 불러온 뒤 확인해 주세요.');
        }
        // 시장 교체는 이전 세금 프로필을 종료한다. 새 시장 조회가 확인된 후에만 후속 저장한다.
        setBase(refreshed.data); taxBase = refreshed.data.taxProfile;
      }
      save.mutate({ defaultTreatment: treatment, components: components.map(({ ratePct, ...c }) => ({ ...c, name: c.name.trim(), ratePct: Number(ratePct) })),
        categories: taxBase?.categories.map(c => ({ ...c, active: c.active ?? true })) ?? [
          { code: 'standard', name: '일반 과세', treatment: 'taxable', active: true },
          { code: 'zero_rated', name: '0% 과세', treatment: 'zero_rated', active: true },
          { code: 'exempt', name: '면세', treatment: 'exempt', active: true },
        ], baseProfileId: taxBase?.id ?? null, baseRevision: taxBase?.revision ?? null }, {
        onSuccess: async result => {
          const refreshed = await state.refetch();
          if (refreshed.data && !refreshed.error) adopt(refreshed.data);
          else { setSaveBlocked(true); setError('저장은 완료됐지만 최신 설정을 불러오지 못했어요. 최신 설정을 불러온 뒤 계속해 주세요.'); }
          setSuccess(!result.changed && !marketSaved ? '변경한 내용이 없어요.' : result.applicationMode === 'immediate' ? '저장했어요. 바로 적용됐어요.' : '저장했어요. 영업 종료 후 바로 적용돼요.'); setBusy(false);
        },
        onError: e => { reportError(e, marketSaved); setBusy(false); },
      });
    } catch (e) { reportError(e, marketSaved); setBusy(false); }
  };
  const reportError = (e: unknown, marketSaved: boolean) => {
    if (e instanceof RpcError && e.code === '45009') setSaveBlocked(true);
    const message = e instanceof RpcError && e.code === '45009' ? '다른 기기에서 설정이 변경됐어요. 최신 설정을 불러온 뒤 다시 입력해 주세요.'
      : e instanceof RpcError && e.code === '45017' ? '금액 기록이 있는 매장은 국가·가격 기준을 변경할 수 없어요.'
      : e instanceof Error ? e.message : '저장하지 못했어요.';
    setError(`${marketSaved ? '국가·가격 기준은 저장됐지만 세금 저장은 완료되지 않았어요. ' : ''}${message}`);
  };
  const newExtra = () => setEdit({ key: `additional_${Date.now()}_${++sequence.current}`, kind: 'additional', name: '', ratePct: '', jurisdictionLevel: 'custom', calculationBasis: 'primary_tax_exclusive', appliesToTreatments: ['taxable'], sortOrder: Math.max(0, ...components.map(c => c.sortOrder)) + 1, remittance: { hall: owner ?? 'merchant', delivery: owner ?? 'merchant', takeout: owner ?? 'merchant' } });

  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <AppHeader title="세금" onBack={() => { if (!pending) safeBack('/my'); }} right={<Text style={{ ...TYPE.captionSm, color: COLOR.text.accent }}>{definition.currencyCode} · {country}</Text>} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, paddingBottom: space.xxl, gap: space.xl }}>
      <QueryState isLoading={state.isLoading} error={state.error} isEmpty={false} onRetry={() => void state.refetch()} emptyTitle="세금 설정이 없어요">
        <ConfigurationHistoryLink kind="tax" />
        <Section title="국가"><Card><Pressable accessibilityRole="button" accessibilityLabel="국가 선택" disabled={disabled} onPress={() => setCountryOpen(true)} style={{ minHeight: minTouchTarget, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Text style={{ ...TYPE.body, color: COLOR.text.primary, flex: 1 }}>{definition.countryNameKo}{region ? ` · ${region}` : ''}</Text><Icon name="chevronDown" size={iconSize.sm} color={COLOR.text.tertiary} />
        </Pressable></Card></Section>
        <Section title="부가세 계산 기준"><Card style={{ gap: space.md }}>
          <Label>모든 메뉴에 공통으로 적용되는 세금 설정이에요.</Label>
          <Label>메뉴 가격 기준</Label><View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md }}><View style={{ minWidth: minTouchTarget, minHeight: minTouchTarget }}><Radio selected={basis === 'tax_inclusive'} label="부가세 포함" disabled={disabled} onPress={() => { setSuccess(null); setBasis('tax_inclusive'); }} /></View><View style={{ minWidth: minTouchTarget, minHeight: minTouchTarget }}><Radio selected={basis === 'tax_exclusive'} label="부가세 미포함" disabled={disabled} onPress={() => { setSuccess(null); setBasis('tax_exclusive'); }} /></View></View>
          {primary ? <><Field label="법정 세율" variant="stacked"><Input accessibilityLabel={`${primary.key} 세율`} value={primary.ratePct} onChangeText={value => update(primary.key, { ratePct: clampDecimals(value, 4) })} suffix="%" keyboardType="decimal-pad" disabled={disabled} variant="stacked" mono /></Field>
            <ResultField label="부가세 적용 요율" value={primaryAmount ? `${((primaryAmount.unroundedAmount / unitPrice) * 100).toFixed(4)} %` : '—'} />
          </> : null}
        </Card></Section>
        <Section title="과세 및 납부 설정"><Card style={{ gap: space.md }}>
          <Label>과세 상태</Label><View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md }}>{(['taxable', 'zero_rated', 'exempt'] as const).map(value => <View key={value} style={{ minWidth: minTouchTarget, minHeight: minTouchTarget }}><Radio selected={treatment === value} label={value === 'taxable' ? '일반 과세' : value === 'zero_rated' ? '0% 과세' : '면세'} disabled={disabled} onPress={() => { setSuccess(null); setTreatment(value); }} /></View>)}</View>
          <Label>세금 납부 주체</Label><View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md }}><View style={{ minWidth: minTouchTarget, minHeight: minTouchTarget }}><Radio selected={owner === 'merchant'} label="매장 직접 납부" disabled={disabled} onPress={() => setOwner('merchant')} /></View><View style={{ minWidth: minTouchTarget, minHeight: minTouchTarget }}><Radio selected={owner === 'marketplace'} label="플랫폼 대납" disabled={disabled} onPress={() => setOwner('marketplace')} /></View></View>
          {!owner ? <Label>항목·판매 채널별 설정을 유지하고 있어요.</Label> : null}
        </Card></Section>
        <TaxSummaryCard title="추가 세금 항목" count={additional.length}>
          <View>
            {additional.length ? additional.map(c => <Pressable key={c.key} accessibilityRole="button" accessibilityLabel={`${c.name} 수정`} disabled={disabled} onPress={() => setEdit({ ...c })}
              style={{ paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: rowMinHeight.oneLine, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
              <ValueRow label={c.name} value={`${c.ratePct}%`} />
            </Pressable>) : <EmptyDataText style={{ paddingHorizontal: space.lg, paddingVertical: space.lg }}>추가 세금 항목이 없어요</EmptyDataText>}
            <View style={{ borderTopWidth: additional.length ? 0 : 1, borderTopColor: T.line }}>
              <TaxSummaryRow label="추가 세금 소계" value={additionalTotal === undefined ? '—' : `${additionalTotal.toFixed(4)}%`} last />
            </View>
          </View>
          <Button kind="tint" full icon="plus" presentation="cardFooter" disabled={disabled} onPress={newExtra}
            accessibilityLabel="＋ 추가 세금 항목" style={{ borderRadius: 0 }}>추가 세금 항목</Button>
        </TaxSummaryCard>
        <TaxSummaryCard title="총 적용 세율">
          {quote ? <>
            {quote.components.map(c => <TaxSummaryRow key={c.id} label={components.find(row => row.key === c.id)?.name ?? ''} value={`${c.unroundedAmount.toFixed(4)}%`} />)}
            <TaxSummaryRow label="합계" value={`${quote.components.reduce((sum, c) => sum + c.unroundedAmount, 0).toFixed(4)}%`} last />
          </> : <View style={{ padding: space.lg }}><Label>국가와 세율을 확인해 주세요.</Label></View>}
          <View style={{ padding: space.lg }}><Label>메뉴 판매가 대비 세율이에요. 항목별 계산 기준을 반영해요.</Label></View>
        </TaxSummaryCard>
        <Button kind="gray" full disabled={Boolean(invalid)} onPress={() => { setSimulationPrice(''); setSimulationOpen(true); }}>세금 시뮬레이션</Button>
        {!writable ? <Label>국제 세금 설정 기능은 준비 중이에요. 기존 계산과 기록은 바뀌지 않습니다.</Label> : null}
        {error ? <View role="alert" style={{ gap: space.sm }}><Text style={{ ...TYPE.caption, color: COLOR.status.negative }}>{error}</Text><Button kind="gray" size="md" disabled={pending} onPress={async () => { const result = await state.refetch(); if (result.data && !result.error) { adopt(result.data); setError(null); } }}>최신 설정 불러오기</Button></View> : null}
        {success ? <Text role="status" style={{ ...TYPE.caption, color: COLOR.text.accent }}>{success}</Text> : null}
      </QueryState>
    </ScrollView>
    <View style={{ padding: space.lg, paddingBottom: space.lg + insets.bottom, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}><Button kind="primary" size="lg" full accessibilityLabel="국제 세금 프로필 저장" disabled={Boolean(invalid) || !writable || Boolean(state.error) || saveBlocked} loading={pending} onPress={() => setConfirmOpen(true)}>저장</Button></View>
    {simulationOpen ? <Sheet visible title="세금 시뮬레이션" onClose={() => setSimulationOpen(false)}>
      <View style={{ gap: space.lg }}>
        <Label>현재 입력한 세금 설정으로 계산해요.</Label>
        <Field label="판매가" variant="stacked"><Input accessibilityLabel="시뮬레이션 판매가" value={simulationPrice} onChangeText={value => setSimulationPrice(clampDecimals(value, definition.minorUnit))} placeholder="판매가 입력" suffix={definition.currencyCode} keyboardType="decimal-pad" variant="stacked" mono /></Field>
        {simulation ? <>
          <TaxSummaryCard title="세금 총액">
            {simulation.components.map(c => <TaxSummaryRow key={c.id} label={components.find(row => row.key === c.id)?.name ?? ''} value={money(c.roundedAmount)} rate={simulationAmount > 0 ? `${(c.roundedAmount / simulationAmount * 100).toFixed(1)}%` : '0.0%'} />)}
            <TaxSummaryRow label="합계" value={money(simulation.taxTotal)} last />
          </TaxSummaryCard>
          <TaxSummaryCard title="세금 제외 금액">
            <TaxSummaryRow label="판매가" value={money(simulationAmount)} />
            <TaxSummaryRow label={basis === 'tax_inclusive' ? '(−) 세금 총액' : '별도 부과 세금'} value={money(simulation.taxTotal)} />
            <TaxSummaryRow label="소계" value={money(simulation.netSales)} last />
          </TaxSummaryCard>
        </> : <Label>판매가를 입력하면 금액을 확인할 수 있어요.</Label>}
      </View>
    </Sheet> : null}
    {confirmOpen ? <ConfirmDialog visible title="세금 설정을 저장할까요?" kind="primary"
      message={base?.applicationMode === 'immediate'
        ? '저장하면 바로 적용돼요. 이미 마감한 매출 내역은 바뀌지 않아요.'
        : base?.applicationMode === 'next_business'
          ? '영업 중에는 현재 영업 기준을 유지해요. 변경한 설정은 영업 종료 후 바로 적용돼요.'
          : '영업 전·영업 종료 상태에서는 바로 적용돼요. 영업 중·브레이크 중에는 영업 종료 후 바로 적용돼요.'}
      confirmText="저장" cancelText="취소" closeLabel="세금 저장 확인 닫기" loading={pending}
      onCancel={() => { if (!pending) setConfirmOpen(false); }} onConfirm={() => void onSave()} /> : null}
    <Sheet visible={countryOpen} title="국가 선택" onClose={() => setCountryOpen(false)}>
      {LAUNCH_COUNTRY_CODES.map(code => <View key={code} style={{ minWidth: minTouchTarget, minHeight: minTouchTarget }}><SelectionRow label={LAUNCH_MARKETS[code].countryNameKo} selected={country === code} onPress={() => { if (country !== code) { setCountry(code); setRegion(null); setBasis(LAUNCH_MARKETS[code].defaultTaxPriceBasis); setComponents([primaryDraft(code)]); setTreatment('taxable'); setSuccess(null); } if (!LAUNCH_MARKETS[code].requiresTaxRegion) setCountryOpen(false); }} /></View>)}
      {definition.requiresTaxRegion ? <><Label>주·도</Label><QueryState isLoading={regions.isLoading} error={regions.error} isEmpty={!regions.data?.length} onRetry={() => void regions.refetch()} emptyTitle="지역을 불러오지 못했어요">{regions.data?.map(r => <View key={r.regionCode} style={{ minWidth: minTouchTarget, minHeight: minTouchTarget }}><SelectionRow label={r.name} selected={region === r.regionCode} onPress={() => { setRegion(r.regionCode); setCountryOpen(false); }} /></View>)}</QueryState></> : null}
    </Sheet>
    {edit ? <Sheet visible title={edit.kind === 'additional' ? '추가 세금 항목' : '기본세 설정'} onClose={() => setEdit(null)} footer={<View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md }}><Button kind="gray" size="lg" style={{ flex: 1 }} onPress={() => setEdit(null)}>취소</Button><Button kind="primary" size="lg" style={{ flex: 1 }} disabled={!edit.name.trim() || !validRate(edit.ratePct) || (edit.kind === 'additional' && Number(edit.ratePct) <= 0)} onPress={() => { setComponents(rows => rows.some(c => c.key === edit.key) ? rows.map(c => c.key === edit.key ? { ...edit, name: edit.name.trim() } : c) : [...rows, { ...edit, name: edit.name.trim() }]); setSuccess(null); setEdit(null); }}>{components.some(c => c.key === edit.key) ? '적용' : '추가'}</Button></View>}>
      {edit.kind === 'additional' ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md }}><View style={{ minWidth: minTouchTarget, minHeight: minTouchTarget }}><Radio label="부가세 포함 금액" selected={edit.calculationBasis === 'primary_tax_inclusive'} onPress={() => setEdit({ ...edit, calculationBasis: 'primary_tax_inclusive' })} /></View><View style={{ minWidth: minTouchTarget, minHeight: minTouchTarget }}><Radio label="부가세 미포함 금액" selected={edit.calculationBasis === 'primary_tax_exclusive'} onPress={() => setEdit({ ...edit, calculationBasis: 'primary_tax_exclusive' })} /></View></View> : null}
      <Field label="이름" variant="stacked"><Input value={edit.name} accessibilityLabel="세금 이름" placeholder="예) 지역세" onChangeText={name => setEdit({ ...edit, name })} variant="stacked" /></Field>
      <Field label="세율" variant="stacked"><Input value={edit.ratePct} accessibilityLabel="추가 세금 세율" placeholder="0" suffix="%" keyboardType="decimal-pad" onChangeText={ratePct => setEdit({ ...edit, ratePct: clampDecimals(ratePct, 4) })} variant="stacked" /></Field>
      {components.some(c => c.key === edit.key) ? <><Label>채널별 납부 주체</Label>{channels.map(ch => <View key={ch} style={{ marginTop: space.sm }}><Label>{channelNames[ch]}</Label><View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md }}>{(['merchant', 'marketplace'] as const).map(value => <View key={value} style={{ minWidth: minTouchTarget, minHeight: minTouchTarget }}><Radio label={value === 'merchant' ? `${channelNames[ch]} 직접 납부` : `${channelNames[ch]} 플랫폼 대납`} selected={edit.remittance[ch] === value} onPress={() => setEdit({ ...edit, remittance: { ...edit.remittance, [ch]: value } })} /></View>)}</View></View>)}{edit.kind === 'additional' ? <Button kind="gray" size="md" onPress={() => { setSuccess(null); setComponents(rows => rows.filter(c => c.key !== edit.key)); setEdit(null); }}>추가세 삭제</Button> : null}</> : null}
    </Sheet> : null}
  </View>;
}

function Section({ title, children }: { title: string; children: ReactNode }) { return <View style={{ gap: space.sm }}><Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>{title}</Text>{children}</View>; }
function Label({ children }: { children: ReactNode }) { return <Text style={{ ...TYPE.caption, color: COLOR.text.tertiary }}>{children}</Text>; }
function ValueRow({ label, value, sub }: { label: string; value: string; sub?: string }) { return <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}><Text style={{ ...TYPE.bodyWeak, color: COLOR.text.secondary, flex: 1 }}>{label}</Text><Text style={{ ...TYPE.body, ...tnum, color: COLOR.text.primary }}>{value}</Text>{sub ? <Text style={{ ...TYPE.caption, ...tnum, color: COLOR.text.tertiary }}>{sub}</Text> : null}</View>; }
function Radio({ selected, label, onPress, disabled }: { selected: boolean; label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="radio" aria-checked={selected} accessibilityLabel={label} accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress} style={{ minHeight: minTouchTarget, flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 }}>
    <View style={{ width: iconSize.md, height: iconSize.md, borderRadius: radius.full, borderWidth: 1, borderColor: selected ? COLOR.action.primary : COLOR.text.tertiary, alignItems: 'center', justifyContent: 'center' }}>{selected ? <View style={{ width: iconSize.md - space.sm, height: iconSize.md - space.sm, borderRadius: radius.full, backgroundColor: COLOR.action.primary }} /> : null}</View><Text style={{ ...TYPE.caption, color: disabled ? COLOR.text.disabled : COLOR.text.primary, flexShrink: 1 }}>{label}</Text>
  </Pressable>;
}

import { ConfigurationHistoryLink } from '@/features/changes/components/ConfigurationHistoryLink';
import { EmptyDataText } from '@/components/kit/EmptyDataText';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { LAUNCH_COUNTRY_CODES, LAUNCH_MARKETS, type LaunchCountryCode, type SalesChannelCode, type TaxPriceBasis, type TaxTreatment } from '@costkeep/types';
import { AppHeader, Button, Card, Field, Icon, Input, QueryState, Sheet } from '@/components/kit';
import { ConfirmDialog } from '@/components/kit/ConfirmDialog';
import { BUSINESS_EDIT_MESSAGE } from '@/features/business-day/useBusinessEditConfirmation';
import { SelectionRow } from '@/components/kit/SelectionRow';
import { useInternationalTaxRegions, useInternationalTaxState, useSaveAppLanguage, useSaveTaxConfiguration, useUserPreferences, type InternationalTaxState, type TaxComponentInput } from '@/features/international-tax';
import { safeBack } from '@/lib/nav';
import { clampDecimals } from '@/lib/num';
import { RpcError } from '@/lib/supabase';
import { COLOR, TYPE, T, iconSize, minTouchTarget, space, tnum } from '@/theme/tokens';
import { StoreTimezoneSetting } from '../components/StoreTimezoneSetting';

type Draft = Omit<TaxComponentInput, 'ratePct'> & { ratePct: string };
type TaxSettingSheet = 'basis' | 'name' | 'rate' | null;
const channels: SalesChannelCode[] = ['hall', 'delivery', 'takeout'];
const MARKET_TAX_NAMES: Readonly<Record<LaunchCountryCode, string>> = {
  KR: '부가세',
  US: 'Sales tax',
  GB: 'VAT',
  AU: 'GST',
  CA: 'GST/HST',
};
const merchant = { hall: 'merchant', delivery: 'merchant', takeout: 'merchant' } as const;
const validRate = (value: string) => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) < 100;
const primaryDraft = (country: LaunchCountryCode): Draft => ({ key: 'primary', kind: 'primary', name: MARKET_TAX_NAMES[country], ratePct: country === 'KR' ? '10' : '0', jurisdictionLevel: 'national', calculationBasis: 'primary_tax_exclusive', appliesToTreatments: ['taxable'], sortOrder: 0, remittance: { ...merchant } });
const defaultTaxCategories = [
  { code: 'standard', name: '일반 과세', treatment: 'taxable' as const, active: true },
  { code: 'zero_rated', name: '0% 과세', treatment: 'zero_rated' as const, active: true },
  { code: 'exempt', name: '면세', treatment: 'exempt' as const, active: true },
];

/** 프로토타입 MY-02의 편집 UI. 미리보기는 core, 저장·적용일은 기존 RPC가 소유한다. */
export function InternationalTaxScreen({ title = '세금', mode = 'tax' }: { title?: string; mode?: 'tax' | 'market' } = {}) {
  const state = useInternationalTaxState();
  const save = useSaveTaxConfiguration();
  const preferences = useUserPreferences();
  const saveLanguage = useSaveAppLanguage();
  const insets = useSafeAreaInsets();
  const [base, setBase] = useState<InternationalTaxState | null>(null);
  const [country, setCountry] = useState<LaunchCountryCode>('KR');
  const [region, setRegion] = useState<string | null>(null);
  const [basis, setBasis] = useState<TaxPriceBasis>('tax_inclusive');
  const [treatment, setTreatment] = useState<TaxTreatment>('taxable');
  const [components, setComponents] = useState<Draft[]>([]);
  const [settingSheet, setSettingSheet] = useState<TaxSettingSheet>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [rateDraft, setRateDraft] = useState('');
  const [countryOpen, setCountryOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [edit, setEdit] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveBlocked, setSaveBlocked] = useState(false);
  const sequence = useRef(0);
  const marketOnly = mode === 'market';
  const definition = LAUNCH_MARKETS[country];
  const taxApplied = basis === 'tax_inclusive' && treatment === 'taxable';
  const regions = useInternationalTaxRegions(country, definition.requiresTaxRegion);
  const pending = busy || save.isPending;
  const writable = Boolean(state.data?.capabilities.internationalTax.writeEnabled);
  const disabled = pending || !writable;
  const languageLabel = preferences.isLoading
    ? '확인 중…'
    : preferences.isError
      ? '언어를 불러오지 못했어요'
      : preferences.data?.appLanguage === 'en'
        ? 'English'
        : '한국어';
  const baseMarket = base?.marketProfile;
  const marketContractChanged = !baseMarket
    || country !== baseMarket.countryCode
    || region !== baseMarket.regionCode
    || definition.currencyCode !== baseMarket.currencyCode
    || definition.businessLocaleCode !== baseMarket.businessLocaleCode;
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
  const primaryTaxName = primary?.name.trim() || MARKET_TAX_NAMES[country];
  const rateLabel = '세율';
  const normalizedComponents = components.map(c => c.kind === 'additional'
    ? { ...c, calculationBasis: 'primary_tax_exclusive' as const }
    : c);
  const invalid = !base || (definition.requiresTaxRegion && !region) || components.filter(c => c.kind === 'primary').length !== 1 || components.some(c => !c.name.trim() || !validRate(c.ratePct));
  const update = (key: string, part: Partial<Draft>) => { setSuccess(null); setComponents(rows => rows.map(c => c.key === key ? { ...c, ...part } : c)); };
  const additional = components.filter(c => c.kind === 'additional');
  const totalRatePct = components.reduce((sum, component) => {
    const value = Number(component.ratePct);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  const allOwners = components.flatMap(c => channels.map(ch => c.remittance[ch]));
  const owner = allOwners.length && allOwners.every(v => v === allOwners[0]) ? allOwners[0] : null;
  const rateText = (value: string | number) => `${Number(value).toLocaleString('ko-KR', { maximumFractionDigits: 4 })}%`;
  const openNameSheet = () => { setNameDraft(primary?.name ?? ''); setSettingSheet('name'); };
  const openRateSheet = () => { setRateDraft(primary?.ratePct ?? ''); setSettingSheet('rate'); };

  const onSave = async () => {
    if (invalid || disabled || saveBlocked || !base) return;
    setConfirmOpen(false);
    setBusy(true); setError(null); setSuccess(null);
    try {
      const taxBase = base.taxProfile;
      const submittedComponents = marketOnly && marketContractChanged ? [primaryDraft(country)] : normalizedComponents;
      const submittedTreatment = marketOnly && marketContractChanged ? 'taxable' : treatment;
      const submittedCategories = marketOnly && marketContractChanged
        ? defaultTaxCategories
        : taxBase?.categories.map(c => ({ ...c, active: c.active ?? true })) ?? defaultTaxCategories;
      const result = await save.mutateAsync({
        market: { countryCode: country, regionCode: region, currencyCode: definition.currencyCode, businessLocaleCode: definition.businessLocaleCode, priceBasis: basis, baseProfileId: base.marketProfile?.id ?? null, baseRevision: base.marketProfile?.revision ?? null },
        tax: { defaultTreatment: submittedTreatment, components: submittedComponents.map(({ ratePct, ...c }) => ({ ...c, name: c.name.trim(), ratePct: Number(ratePct) })),
        categories: submittedCategories, baseProfileId: taxBase?.id ?? null, baseRevision: taxBase?.revision ?? null },
      });
      const refreshed = await state.refetch();
      if (refreshed.data && !refreshed.error) {
        adopt(refreshed.data);
        setSuccess(!result.changed ? '변경한 내용이 없어요.' : result.applicationMode === 'immediate' ? '저장했어요. 바로 적용됐어요.' : '저장했어요. 영업 종료 후 바로 적용돼요.');
      } else {
        setSaveBlocked(true);
        setError('저장은 완료됐지만 최신 설정을 불러오지 못했어요. 최신 설정을 불러온 뒤 계속해 주세요.');
      }
    } catch (e) { reportError(e); } finally { setBusy(false); }
  };
  const reportError = (e: unknown) => {
    if (e instanceof RpcError && e.code === '45009') setSaveBlocked(true);
    const message = e instanceof RpcError && e.code === '45009' ? '다른 기기에서 설정이 변경됐어요. 최신 설정을 불러온 뒤 다시 입력해 주세요.'
      : e instanceof RpcError && e.code === '45017' ? '금액 기록이 있는 매장은 국가·지역·통화를 변경할 수 없어요.'
      : e instanceof Error ? e.message : '저장하지 못했어요.';
    setError(message);
  };
  const newExtra = () => setEdit({ key: `additional_${Date.now()}_${++sequence.current}`, kind: 'additional', name: '', ratePct: '', jurisdictionLevel: 'custom', calculationBasis: 'primary_tax_exclusive', appliesToTreatments: ['taxable'], sortOrder: Math.max(0, ...components.map(c => c.sortOrder)) + 1, remittance: { hall: owner ?? 'merchant', delivery: owner ?? 'merchant', takeout: owner ?? 'merchant' } });
  const chooseLanguage = (appLanguage: 'ko' | 'en') => {
    const current = preferences.data;
    setLanguageOpen(false);
    if (!current || current.appLanguage === appLanguage || saveLanguage.isPending) return;
    setError(null); setSuccess(null);
    saveLanguage.mutate({ appLanguage, baseRevision: current.revision }, {
      onSuccess: () => setSuccess('언어 설정을 저장했어요.'),
      onError: (cause) => setError(cause instanceof RpcError && cause.code === '45009'
        ? '다른 기기에서 언어 설정이 변경됐어요. 최신 설정을 불러온 뒤 다시 선택해 주세요.'
        : cause instanceof Error ? cause.message : '언어 설정을 저장하지 못했어요.'),
    });
  };

  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <AppHeader title={title} onBack={() => { if (!pending) safeBack('/my'); }} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, paddingBottom: space.xxl, gap: space.xl }}>
      {!marketOnly ? <ConfigurationHistoryLink kind="tax" /> : null}
      <QueryState isLoading={state.isLoading} error={state.error} isEmpty={false} onRetry={() => void state.refetch()} emptyTitle={marketOnly ? '지역 설정이 없어요' : '세금 설정이 없어요'}>
        {marketOnly ? <Card pad={0} style={{ overflow: 'hidden' }}>
          <RegionalSettingRow label="언어" value={languageLabel} accessibilityLabel="언어 선택" disabled={preferences.isLoading || preferences.isError || saveLanguage.isPending} onPress={() => setLanguageOpen(true)} />
          <RegionalSettingRow label="통화" value={currencyOptionLabel(country)} accessibilityLabel="통화 선택" disabled={disabled} onPress={() => setCountryOpen(true)} />
          <StoreTimezoneSetting embedded />
        </Card> : null}
        {!marketOnly ? <>
        <Section title="세금 정책"><Card pad={0} style={{ overflow: 'hidden' }}>
          <TaxSettingRow label="국가" value={`${country === 'KR' ? '대한민국' : definition.countryNameKo} · ${definition.currencyCode}`} />
          <TaxSettingRow label="판매가에 세금 포함" value={taxApplied ? '포함' : '별도'} disabled={disabled} onPress={() => setSettingSheet('basis')} last />
        </Card></Section>
        {taxApplied && primary ? <>
          <Section title="기본 세금"><Card pad={0} style={{ overflow: 'hidden' }}>
            <TaxSettingRow label="세금 명" value={primaryTaxName} disabled={disabled} onPress={openNameSheet} />
            <TaxSettingRow label={rateLabel} value={rateText(primary.ratePct)} disabled={disabled} onPress={openRateSheet} last />
          </Card></Section>
        <Section title="추가 세금"><Card pad={0} style={{ overflow: 'hidden' }}>
          <View>
            {additional.length ? additional.map(c => <Pressable key={c.key} accessibilityRole="button" accessibilityLabel={`${c.name} 수정`} disabled={disabled} onPress={() => setEdit({ ...c })}
              style={{ paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: space.md, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
              <View style={{ flex: 1, gap: space.xs }}><Text style={{ ...TYPE.body, color: COLOR.text.primary }}>{c.name}</Text><Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>부가세 미포함 금액 기준</Text></View>
              <Text style={{ ...TYPE.body, ...tnum, color: COLOR.text.link }}>{rateText(c.ratePct)}</Text><Icon name="chevron" size={iconSize.sm} color={COLOR.text.tertiary} />
            </Pressable>) : <EmptyDataText style={{ paddingHorizontal: space.lg, paddingVertical: space.lg }}>추가 세금 항목이 없어요</EmptyDataText>}
          </View>
          <Button kind="tint" full icon="plus" presentation="cardFooter" disabled={disabled} onPress={newExtra}
            accessibilityLabel="＋ 추가 세금 항목" style={{ borderRadius: 0 }}>추가 세금 항목</Button>
        </Card></Section>
        <Section title="합계"><Card pad={0} style={{ overflow: 'hidden' }}>
          {components.map((component, index) => <View key={component.key} style={{
            minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg,
            borderBottomWidth: index < components.length - 1 ? 1 : 0, borderBottomColor: T.line2,
          }}>
            <Text style={{ ...TYPE.bodyWeak, color: COLOR.text.secondary, flex: 1 }}>{component.name.trim() || '세금'}</Text>
            <Text style={{ ...TYPE.body, ...tnum, color: COLOR.text.primary }}>{rateText(component.ratePct)}</Text>
          </View>)}
          <View style={{ minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, borderTopWidth: 1, borderTopColor: T.line2 }}>
            <Text style={{ ...TYPE.body, color: COLOR.text.primary, flex: 1 }}>세율 합계</Text>
            <Text style={{ ...TYPE.body, ...tnum, color: COLOR.text.accent }}>{rateText(totalRatePct)}</Text>
          </View>
          <Button kind="tint" full presentation="cardFooter" disabled={Boolean(invalid)} style={{ borderRadius: 0 }} onPress={() => router.push({ pathname: '/my/tax-simulation', params: {
              country, basis, treatment, components: JSON.stringify(normalizedComponents.map(c => ({ id: c.key, name: c.name.trim(), kind: c.kind,
                ratePct: Number(c.ratePct), calculationBasis: c.calculationBasis, appliesToTreatments: c.appliesToTreatments, remittanceOwner: c.remittance.hall }))),
            } } as Href)}>세금 시뮬레이션 &gt;</Button>
        </Card></Section>
        </> : <Label>결제 시 별도로 부과되는 세금은 손익에 포함하지 않아요.</Label>}
        </> : null}
        {!writable ? <Label>{marketOnly ? '통화 변경 기능은 준비 중이에요. 현재 설정은 그대로 유지됩니다.' : '국제 세금 설정 기능은 준비 중이에요. 기존 계산과 기록은 바뀌지 않습니다.'}</Label> : null}
        {error ? <View role="alert" style={{ gap: space.sm }}><Text style={{ ...TYPE.caption, color: COLOR.status.negative }}>{error}</Text><Button kind="gray" size="md" disabled={pending} onPress={async () => { const result = await state.refetch(); if (result.data && !result.error) { adopt(result.data); setError(null); } }}>최신 설정 불러오기</Button></View> : null}
        {success ? <Text role="status" style={{ ...TYPE.caption, color: COLOR.text.accent }}>{success}</Text> : null}
      </QueryState>
    </ScrollView>
    {!marketOnly || marketContractChanged ? <View style={{ padding: space.lg, paddingBottom: space.lg + insets.bottom, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}><Button kind="primary" size="lg" full accessibilityLabel={marketOnly ? '지역 설정 저장' : '국제 세금 프로필 저장'} disabled={Boolean(invalid) || !writable || Boolean(state.error) || saveBlocked} loading={pending} onPress={() => setConfirmOpen(true)}>저장</Button></View> : null}
    {!marketOnly && settingSheet === 'basis' ? <Sheet visible title="판매가에 세금 포함" onClose={() => setSettingSheet(null)}>
      <SelectionRow label="포함" selected={taxApplied} disabled={disabled} onPress={() => { setSuccess(null); setBasis('tax_inclusive'); setTreatment('taxable'); setSettingSheet(null); }} />
      <SelectionRow label="별도" selected={!taxApplied} disabled={disabled} last onPress={() => { setSuccess(null); setBasis('tax_exclusive'); setTreatment('taxable'); setSettingSheet(null); }} />
    </Sheet> : null}
    {!marketOnly && settingSheet === 'name' && primary ? <Sheet visible title="세금 명" onClose={() => setSettingSheet(null)} footer={<Button kind="primary" size="lg" full disabled={!nameDraft.trim()} onPress={() => { update(primary.key, { name: nameDraft.trim() }); setSettingSheet(null); }}>확인</Button>}>
      <Field label="세금 명" variant="stacked"><Input accessibilityLabel="기본 세금 명" value={nameDraft} onChangeText={setNameDraft} placeholder="예) 부가가치세 (VAT)" variant="stacked" /></Field>
    </Sheet> : null}
    {!marketOnly && settingSheet === 'rate' && primary ? <Sheet visible title={rateLabel} onClose={() => setSettingSheet(null)} footer={<Button kind="primary" size="lg" full disabled={!validRate(rateDraft)} onPress={() => { update(primary.key, { ratePct: rateDraft }); setSettingSheet(null); }}>확인</Button>}>
      <Field label={rateLabel} variant="stacked"><Input accessibilityLabel={`${primary.key} 세율`} value={rateDraft} onChangeText={value => setRateDraft(clampDecimals(value, 4))} suffix="%" keyboardType="decimal-pad" variant="stacked" mono /></Field>
    </Sheet> : null}
    {confirmOpen ? <ConfirmDialog visible title={marketOnly ? '통화를 바꿀까요?' : '세금을 수정하시겠습니까?'} kind="primary"
      message={marketOnly
        ? '선택한 통화와 지역 설정을 저장합니다.'
        : base?.applicationMode === 'immediate'
        ? '저장하면 바로 적용돼요. 이미 마감한 매출 내역은 바뀌지 않아요.'
        : base?.applicationMode === 'next_business'
          ? BUSINESS_EDIT_MESSAGE
          : '영업 전·영업 종료 상태에서는 바로 적용돼요. 영업 중·브레이크 중에는 영업 종료 후 바로 적용돼요.'}
      confirmText="저장" cancelText="취소" closeLabel={marketOnly ? '지역 설정 저장 확인 닫기' : '세금 저장 확인 닫기'} loading={pending}
      onCancel={() => { if (!pending) setConfirmOpen(false); }} onConfirm={() => void onSave()} /> : null}
    <Sheet visible={languageOpen} title="언어 선택" onClose={() => setLanguageOpen(false)}>
      <SelectionRow label="한국어" selected={preferences.data?.appLanguage !== 'en'} disabled={!preferences.data || preferences.isError || saveLanguage.isPending} onPress={() => chooseLanguage('ko')} />
      <SelectionRow label="English" selected={preferences.data?.appLanguage === 'en'} disabled={!preferences.data || preferences.isError || saveLanguage.isPending} last onPress={() => chooseLanguage('en')} />
    </Sheet>
    <Sheet visible={countryOpen} title={marketOnly ? '통화 선택' : '국가 선택'} onClose={() => setCountryOpen(false)}>
      {LAUNCH_COUNTRY_CODES.map(code => <View key={code} style={{ minWidth: minTouchTarget, minHeight: minTouchTarget }}><SelectionRow label={marketOnly ? currencyOptionLabel(code) : LAUNCH_MARKETS[code].countryNameKo} selected={country === code} onPress={() => { if (country !== code) { setCountry(code); setRegion(null); setBasis(LAUNCH_MARKETS[code].defaultTaxPriceBasis); if (!marketOnly) { setComponents([primaryDraft(code)]); setTreatment('taxable'); } setSuccess(null); } if (!LAUNCH_MARKETS[code].requiresTaxRegion) setCountryOpen(false); }} /></View>)}
      {definition.requiresTaxRegion ? <><Label>주·도</Label><QueryState isLoading={regions.isLoading} error={regions.error} isEmpty={!regions.data?.length} onRetry={() => void regions.refetch()} emptyTitle="지역을 불러오지 못했어요">{regions.data?.map(r => <View key={r.regionCode} style={{ minWidth: minTouchTarget, minHeight: minTouchTarget }}><SelectionRow label={r.name} selected={region === r.regionCode} onPress={() => { setRegion(r.regionCode); setCountryOpen(false); }} /></View>)}</QueryState></> : null}
    </Sheet>
    {!marketOnly && edit ? <Sheet visible title={components.some(c => c.key === edit.key) ? '세금 항목 수정' : '세금 항목 추가'} onClose={() => setEdit(null)} footer={<View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md }}><Button kind="gray" size="lg" style={{ flex: 1 }} onPress={() => setEdit(null)}>취소</Button><Button kind="primary" size="lg" style={{ flex: 1 }} disabled={!edit.name.trim() || !validRate(edit.ratePct) || (edit.kind === 'additional' && Number(edit.ratePct) <= 0)} onPress={() => { setComponents(rows => rows.some(c => c.key === edit.key) ? rows.map(c => c.key === edit.key ? { ...edit, name: edit.name.trim() } : c) : [...rows, { ...edit, name: edit.name.trim() }]); setSuccess(null); setEdit(null); }}>{components.some(c => c.key === edit.key) ? '확인' : '추가'}</Button></View>}>
      <Field label="세금 명" variant="stacked"><Input value={edit.name} accessibilityLabel="세금 이름" placeholder="예) 지역세" onChangeText={name => setEdit({ ...edit, name })} variant="stacked" /></Field>
      <Field label="세율" variant="stacked"><Input value={edit.ratePct} accessibilityLabel="추가 세금 세율" placeholder="0" suffix="%" keyboardType="decimal-pad" onChangeText={ratePct => setEdit({ ...edit, ratePct: clampDecimals(ratePct, 4) })} variant="stacked" /></Field>
      {components.some(c => c.key === edit.key) && edit.kind === 'additional'
        ? <Button kind="danger" size="md" onPress={() => { setSuccess(null); setComponents(rows => rows.filter(c => c.key !== edit.key)); setEdit(null); }}>삭제</Button>
        : null}
    </Sheet> : null}
  </View>;
}

function Section({ title, children }: { title: string; children: ReactNode }) { return <View style={{ gap: space.sm }}><Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>{title}</Text>{children}</View>; }
function Label({ children }: { children: ReactNode }) { return <Text style={{ ...TYPE.caption, color: COLOR.text.tertiary }}>{children}</Text>; }
const CURRENCY_SYMBOLS = { KRW: '₩', USD: '$', GBP: '£', AUD: 'A$', CAD: 'C$' } as const;
function currencyOptionLabel(country: LaunchCountryCode) { const market = LAUNCH_MARKETS[country]; return `${market.countryNameKo} ${market.currencyCode} · ${CURRENCY_SYMBOLS[market.currencyCode]}`; }
function RegionalSettingRow({ label, value, accessibilityLabel, onPress, disabled = false }: { label: string; value: string; accessibilityLabel: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} disabled={disabled} onPress={onPress}
    style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, borderBottomWidth: 1, borderBottomColor: T.line2, opacity: disabled ? 0.55 : 1 }}>
    <Text style={{ ...TYPE.bodyWeak, color: COLOR.text.secondary }}>{label}</Text>
    <Text style={{ ...TYPE.body, color: COLOR.text.primary, flex: 1, textAlign: 'right' }}>{value}</Text>
    <Icon name="chevron" size={iconSize.sm} color={COLOR.text.tertiary} />
  </Pressable>;
}
function TaxSettingRow({ label, value, onPress, disabled = false, last = false }: { label: string; value: string; onPress?: () => void; disabled?: boolean; last?: boolean }) {
  const content = <>
    <Text style={{ ...TYPE.body, color: COLOR.text.primary, flex: 1 }}>{label}</Text>
    <Text style={{ ...TYPE.body, ...tnum, color: onPress ? COLOR.state.selectedText : COLOR.text.secondary, textAlign: 'right' }}>{value}</Text>
    <View style={{ width: iconSize.sm, alignItems: 'flex-end' }}>
      {onPress ? <Icon name="chevron" size={iconSize.sm} color={disabled ? COLOR.text.disabled : COLOR.text.tertiary} /> : null}
    </View>
  </>;
  const style = { minHeight: 58, flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.md, paddingHorizontal: space.lg, borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line2, opacity: disabled ? 0.55 : 1 };
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={`${label} 설정`} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={style}>{content}</Pressable> : <View style={style}>{content}</View>;
}

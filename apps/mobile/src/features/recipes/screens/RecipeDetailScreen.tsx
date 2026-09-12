import { EmptyDataText } from '@/components/kit/EmptyDataText';
import { RecipeCurrentPrice, RecipeCurrentProfit, RecipeInternationalComposition, snapshotAmount, recipeSnapshotMoney } from '../RecipeInternationalComposition';
/**
 * RCP-02 레시피 상세 — 메뉴 1개의 손익계산서.
 *
 * 숫자는 전부 서버가 낸 값이다(recipe_detail). 재료비는 재료 줄을 펼친 원가이고,
 * 고정지출률은 이번 영업월 값이다. 앱은 배수(기준 인분/1인분)만 곱해 보여준다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { ActionSheet, AppHeader, Badge, Card, Donut, Icon, Notice, QueryState, ScrollTabs } from '@/components/kit';
import { ConfirmDialog } from '@/components/kit/ConfirmDialog';
import { Button } from '@/components/kit/Button';
import { safeBack } from '@/lib/nav';
import { RecentChangeRow } from '@/features/changes';
import { RecentChangeCard } from '@/features/changes/components/RecentChangeCard';
import { useBusinessEditConfirmation } from '@/features/business-day/useBusinessEditConfirmation';
import { DetailRowIcon } from '@/components/kit/DetailRowIcon';
import { formatPercent, formatQuantity, formatUnitPrice, recommendedPrice, round, taxAmount, taxRate } from '@margincook/core';
import { COLOR, COMPONENT, LAYOUT, T, TYPE, minTouchTarget, space, won } from '@/theme/tokens';
import { RecipeDetailHeading as SecHead, RecipeDetailRow, RecipeDetailSubtotal, RecipeDetailFooter } from '../components/RecipeDetailParts';
import { RecipeDetailCostBody } from '../components/RecipeDetailCostBody';
import { useRecipeCostDisclosure } from '../useRecipeCostDisclosure';
import { ProfitChangeRow } from '../components/ProfitChangeRow';
import { useRecipeRecommendation } from '../draftPreviewQuery';
import type { DraftPreview } from '../draftPreviewContract';
import { useRecipeDetail, useSaveRecipe } from '../hooks';
import { canEditRecipeDetail, RECIPE_EDIT_UNAVAILABLE } from '../detailContract';
import { useProfitHistory } from '../profitHistory';
import { isRecipeRevisionConflict, recipeRequestId } from '../writeContract';
import { RecipeConflictNotice, RecipeMemoEditor, RecipePendingNotice, useRecipeEditorSession, useRecipeEditRecovery } from '../editRecovery';
import { useAppCapabilities, useRecipeTaxState } from '@/features/international-tax';

const NUM = { fontVariant: ['tabular-nums' as const] };

/** 고정지출 항목 키 → 한글 라벨. */
const FIXED_LABEL: Record<string, string> = {
  labor: '인건비', rent: '임대료', utility: '공과금', commission: '플랫폼 수수료',
  packing: '포장비', delivery: '배달/배송', ads: '광고/홍보', etc: '기타',
};

const dispUnit = (u: 'g' | 'ml' | 'ea' | null) => (u === null ? null : u === 'ea' ? '개' : u);

/** 기준 밑줄 탭 — N인분 / 1인분. 기준 인분은 메뉴마다 다르므로 라벨을 데이터에서 만든다. */
function CostTabs({ value, onChange, servings }: { value: 'batch' | 'one'; onChange: (v: 'batch' | 'one') => void; servings: number }) {
  return (
    <View style={{ paddingTop: space.md, backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.line }}>
      <ScrollTabs tabs={[`${servings}인분`, '1인분']} active={value === 'batch' ? 0 : 1} onChange={i => onChange(i === 0 ? 'batch' : 'one')} />
    </View>
  );
}

/**
 * ⚠ 고정지출 **항목별 배분**은 비율을 낸 것과 **같은 달**을 봐야 한다.
 *   그래서 여기서 고정지출을 따로 조회하지 않는다 — `recipe_detail` 이 `fixedRate` ·
 *   `fixedMonth` · `fixedItems` 를 한 문장에서 같이 낸다(0128).
 *
 *   0126 에서는 서버 월을 받아 고정지출 조회 훅에 넘겨 맞췄다. 거의 맞지만 RPC 두 번이라
 *   매장 자정 사이에 갈릴 창이 남았다 — 9월 비율을 8월 항목으로 쪼개면 **합계는 맞고
 *   줄마다 틀린다.** 화면에서 제일 알아채기 어려운 종류라 창 자체를 없앴다.
 */
export default function RecipeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const editor = useRecipeEditorSession(id);
  const editConfirmation = useBusinessEditConfirmation('메뉴');
  const detail = useRecipeDetail(id, { readOnly: true });
  /** 축약 목록 3줄. RCP-16 과 **같은 RPC** 를 쓴다 — 두 화면이 다른 걸 보여 주면 안 된다. */
  const profitQ = useProfitHistory(id, 3);
  const saveRecipe = useSaveRecipe();
  const readEditable = async () => {
    const result = await detail.refetch();
    return { data: canEditRecipeDetail(result.data) ? result.data : null,
      error: result.error ?? (result.data && !canEditRecipeDetail(result.data) ? new Error(RECIPE_EDIT_UNAVAILABLE) : null) };
  };
  const memoRecovery = useRecipeEditRecovery(editor, readEditable);
  const statusRecovery = useRecipeEditRecovery(editor, readEditable);
  const capabilities = useAppCapabilities();
  // Legacy 계산은 명시적인 비활성 응답에서만 허용한다. 조회 실패/미확인은 false가 아니다.
  const capabilityError = capabilities.error ?? (!capabilities.isLoading && !capabilities.data
    ? new Error('세금 계산 방식을 확인하지 못했어요. 다시 시도해 주세요.') : null);
  const capabilityReady = !capabilities.isLoading && !capabilityError && Boolean(capabilities.data);
  const internationalEnabled = Boolean(capabilities.data?.internationalTax.readEnabled);
  const internationalTax = useRecipeTaxState(id, internationalEnabled);
  const currentQuote = useRecipeRecommendation(id, internationalEnabled && capabilityReady);

  // 명시적인 활성일 이전 응답에서만 현재 legacy 원가·서버 세액을 표시한다.
  // 조회 실패나 적용 중인 프로필 누락을 legacy 금액으로 덮지 않는다.
  const beforeTaxActivation = capabilityReady && internationalEnabled
    && !currentQuote.isFetching && !currentQuote.error
    && currentQuote.data?.status === 'unavailable' && currentQuote.data.reason === 'not_active'
    && !internationalTax.isLoading && !internationalTax.error && internationalTax.data?.quote === null;
  const useInternationalAmounts = internationalEnabled && !beforeTaxActivation;

  const [costMode, setCostMode] = useState<'batch' | 'one'>('one');
  const disclosure = useRecipeCostDisclosure(editor.scopeKey);
  const [memoOpen, setMemoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [memoDraft, setMemoDraft] = useState('');
  const memoDraftRef = useRef(memoDraft); memoDraftRef.current = memoDraft;
  const [memoTarget, setMemoTarget] = useState<{ id: string; revision: string; memo: string } | null>(null);
  const [statusTarget, setStatusTarget] = useState<{ id: string; active: boolean; desired: boolean; revision: string } | null>(null);
  const statusBusy = useRef<object | null>(null);
  const memoBusy = useRef<object | null>(null);
  useEffect(() => { setStatusTarget(null); setMemoOpen(false); setMemoTarget(null); statusBusy.current = null; memoBusy.current = null; }, [id, editor.scopeKey]);

  const r = detail.data;
  useEffect(() => {
    if (memoOpen && canEditRecipeDetail(r) && memoTarget && r.id === memoTarget.id && !memoBusy.current && !memoRecovery.isBlocked()
      && memoDraftRef.current === memoTarget.memo) {
      setMemoDraft(r.memo ?? '');
      setMemoTarget({ id: r.id, revision: r.editRevision, memo: r.memo ?? '' });
    }
  }, [r, memoOpen]);
  const profitChanges = profitQ.data?.pages[0]?.items ?? [];

  const calc = useMemo(() => {
    if (!r || !capabilityReady) return null;
    if (internationalEnabled && (!internationalTax.data || internationalTax.isLoading || internationalTax.error)) return null;
    const price = r.price;
    const material = r.materialCost;
    const extra = r.extraCost;
    const quote = internationalEnabled ? internationalTax.data?.quote ?? null : null;
    // 국제 세금이 켜지면 DB numeric quote가 유일한 권위다. 앱에서 법정 세율을 다시 곱하지 않는다.
    // 성공 응답의 null quote는 0191·0201의 활성일 이전 경로다.
    // 이때도 앱이 세율을 재계산하지 않고 recipe_detail의 서버 세액을 사용한다.
    const tax = quote?.taxAmount ?? (internationalEnabled ? r.tax : round(taxAmount(price, r.taxItems)));
    const netSales = quote?.netSales ?? price - tax;
    const fixed = round(r.fixedRate * price);
    const profit = netSales - material - fixed - extra;
    const profitRate = price > 0 ? profit / price : 0;
    const target = r.targetProfitRate / 100;
    // 국제 포함/미포함 가격은 역산식이 달라 기존 단일 세율 권장가 공식을 쓰면 안 된다.
    const recRaw = internationalEnabled ? null : recommendedPrice(material + extra, r.fixedRate, target, taxRate(r.taxItems));
    return {
      price, material, extra, tax, fixed, profit, profitRate, target, quote,
      recommended: recRaw == null ? null : Math.round(recRaw / 100) * 100,
    };
  }, [capabilityReady, internationalEnabled, internationalTax.data, internationalTax.isLoading, internationalTax.error, r]);

  /**
   * 메모만 고친다. 재료·부자재·세금 항목은 보내지 않는다 —
   * 서버가 키 없는 필드는 그대로 두므로(0055·0071) 구성이 날아가지 않는다.
   */
  const editReady = canEditRecipeDetail(r);
  const writeBlocked = !editReady || saveRecipe.intentReady === false || Boolean(saveRecipe.intentError || saveRecipe.pendingIntent || saveRecipe.intentBusy);
  const saveMemo = () => {
    const ticket = editor.capture();
    if (!r || !memoTarget || memoTarget.id !== id || !ticket || memoBusy.current || saveRecipe.isPending || writeBlocked || memoRecovery.isBlocked()) return;
    const submitted = memoDraft.trim(); const basis = memoTarget.revision;
    memoBusy.current = ticket;
    saveRecipe.mutate({ patch: 'memo', requestId: recipeRequestId(), id: memoTarget.id, expectedRevision: basis, memo: submitted || null }, {
      onSuccess: () => {
        if (!editor.isCurrent(ticket)) return;
        if (memoDraftRef.current.trim() === submitted) setMemoOpen(false);
        else void memoRecovery.refresh(basis, false);
      },
      onError: error => {
        if (!editor.isCurrent(ticket) || memoRecovery.handleError(error, basis)) return;
        Alert.alert('저장하지 못했어요', error.message);
      },
      onSettled: () => { if (memoBusy.current === ticket) memoBusy.current = null; },
    }, () => editor.isCurrent(ticket));
  };

  const toggleActive = () => {
    const ticket = editor.capture();
    if (!r || !statusTarget || !ticket || statusBusy.current || saveRecipe.isPending || writeBlocked || statusRecovery.isBlocked()) return;
    if (r.id !== statusTarget.id || r.active !== statusTarget.active || r.editRevision !== statusTarget.revision) {
      setStatusTarget(null);
      Alert.alert('판매 상태가 변경됐어요', '현재 상태를 확인하고 다시 선택해 주세요.'); return;
    }
    const target = { ...statusTarget }; statusBusy.current = ticket;
    saveRecipe.mutate({ patch: 'active', requestId: recipeRequestId(), id: target.id, expectedRevision: target.revision, active: target.desired }, {
      onSuccess: () => { if (editor.isCurrent(ticket)) setStatusTarget(null); },
      onError: error => {
        if (!editor.isCurrent(ticket) || statusRecovery.handleError(error, target.revision)) return;
        Alert.alert('바꾸지 못했어요', error.message);
      },
      onSettled: () => { if (statusBusy.current === ticket) statusBusy.current = null; },
    }, () => editor.isCurrent(ticket));
  };
  const resumePending = () => {
    const intent = saveRecipe.pendingIntent; const ticket = editor.capture();
    if (!editReady || !intent || !ticket || saveRecipe.isPending || saveRecipe.intentBusy) return;
    saveRecipe.mutate({ resumeRequestId: String(intent.payload.request_id) }, {
      onSuccess: savedId => {
        if (!editor.isCurrent(ticket)) return;
        if (savedId === id && memoOpen && intent.payload.patch === 'memo') void memoRecovery.refresh(String(intent.payload.expected_revision), false);
        else if (savedId === id && statusTarget && intent.payload.patch === 'active') void statusRecovery.refresh(String(intent.payload.expected_revision), false);
        else Alert.alert('이전 저장을 확인했어요', '저장된 내용으로 화면을 갱신했어요.');
      },
      onError: error => {
        if (!editor.isCurrent(ticket)) return;
        const basis = intent.payload.expected_revision;
        const sameTarget = intent.payload.id === id;
        if (basis && sameTarget && memoOpen && intent.payload.patch === 'memo' && memoRecovery.handleError(error, String(basis))) return;
        if (basis && sameTarget && statusTarget && intent.payload.patch === 'active' && statusRecovery.handleError(error, String(basis))) return;
        if (isRecipeRevisionConflict(error)) {
          const next = !sameTarget ? '해당 메뉴를 다시 확인해 주세요.'
            : intent.payload.patch === 'memo' ? '메모 수정을 다시 열어 최신 내용을 확인해 주세요.'
            : intent.payload.patch === 'active' ? '판매 상태를 다시 선택해 최신 내용을 확인해 주세요.'
            : '메뉴 수정 화면에서 최신 내용을 다시 확인해 주세요.';
          Alert.alert('이전 저장은 적용되지 않았어요', `다른 곳에서 먼저 수정되어 저장하지 못했어요. ${next}`);
          return;
        }
        Alert.alert('저장 확인을 마치지 못했어요', error.message);
      },
    }, () => editor.isCurrent(ticket));
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {editConfirmation.dialog}
      <AppHeader
        title="메뉴"
        onBack={() => safeBack('/recipes')}
        right={<Pressable disabled={!editReady} onPress={() => setMenuOpen(true)}
          accessibilityRole="button" accessibilityLabel="수정 메뉴 열기"
          style={{ minWidth: minTouchTarget, minHeight: minTouchTarget, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="more" size={19} color={COLOR.text.secondary} />
        </Pressable>}
      />

      {!memoOpen ? <RecipePendingNotice intent={saveRecipe.pendingIntent} error={saveRecipe.intentError} busy={saveRecipe.isPending || Boolean(saveRecipe.intentBusy)} blocked={!editReady} onResume={resumePending}
        onDiscardUnreadable={() => { void saveRecipe.discardUnreadableIntent().catch(error => Alert.alert('확인 정보를 삭제하지 못했어요', error instanceof Error ? error.message : '저장소 상태를 확인해 주세요.')); }} /> : null}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: LAYOUT.scroll.end, gap: space.md }}>
        <QueryState
          isLoading={detail.isLoading || capabilities.isLoading || (internationalEnabled && internationalTax.isLoading)}
          error={detail.error ?? capabilityError ?? (internationalEnabled ? internationalTax.error : null)}
          isEmpty={detail.isFetched && !r}
          onRetry={() => { void detail.refetch(); void capabilities.refetch(); if (internationalEnabled) void internationalTax.refetch(); }}
          emptyTitle="메뉴를 찾을 수 없어요"
        >
          {r && calc ? (() => {
            const { price, material, extra, tax, fixed, profit, profitRate, target, quote, recommended } = calc;
            const warn = r.active && profitRate < target;
            const PROFIT = warn ? COLOR.status.negative : COLOR.status.positive;
            const cm = costMode === 'batch' ? r.baseServings : 1;
            const m = cm;
            const wm = (v: number) => `${won(Math.round(v * m))}원`;
            const p = (v: number) => (price > 0 ? formatPercent(v / price) : '0.0%');

            const response = currentQuote.data;
            const snapshot = response?.status === 'ready' && !currentQuote.isFetching && !currentQuote.error ? response as Extract<DraftPreview, { status: 'ready' }> : null;
            const sameAmount = (a: number, b: number | null | undefined) => b != null && Math.abs(a - b) < 0.000001;
            const sameRecipe = snapshot && snapshot.input.price === r.price && snapshot.input.base_servings === r.baseServings;
            const materialReady = !useInternationalAmounts || Boolean(sameRecipe && sameAmount(r.materialCost, snapshot?.one.material));
            const extraReady = !useInternationalAmounts || Boolean(sameRecipe && sameAmount(r.extraCost, snapshot?.one.extra));
            const fixedReady = !useInternationalAmounts || Boolean(sameRecipe && sameAmount(fixed, snapshot?.one.fixed));
            const taxReady = !useInternationalAmounts || Boolean(sameRecipe && snapshot && quote && internationalTax.data?.quoteContext
              && internationalTax.data.quoteContext.taxProfileId === snapshot.context.taxProfileId && sameAmount(quote.taxAmount, snapshot.one.tax));
            const detailMoney = (amount: number) => useInternationalAmounts && snapshot ? recipeSnapshotMoney(amount, snapshot) : `${won(Math.round(amount))}원`;
            const snapshotPercent = (field: 'material' | 'extra' | 'fixed' | 'tax') => snapshot && snapshot.one[field] !== null && snapshot.one.listedTotal > 0
              ? formatPercent(snapshot.one[field]! / snapshot.one.listedTotal) : undefined;

            // 판매가 1,000원이 어디로 가는지 — 다섯 조각의 합이 곧 판매가다.
            // ⚠ 0원이어도 범례에서 지우지 않는다. 메뉴마다 항목 수가 달라지면
            //   같은 자리에서 다른 것을 읽게 되고, "부자재가 왜 없지?" 가 된다.
            //   도넛만 0을 걸러낸다 — 0인 조각은 그릴 수 없다.
            const breakdown = [
              { label: '식재료', amt: material, color: COMPONENT.profitChart.material },
              { label: '부자재', amt: extra, color: COMPONENT.profitChart.extra },
              { label: '고정 지출', amt: fixed, color: COMPONENT.profitChart.fixed },
              { label: '세금', amt: tax, color: COMPONENT.profitChart.tax },
              { label: '순이익', amt: profit, color: PROFIT },
            ];
            const segments = [breakdown[4]!, ...breakdown.slice(0, 4)]
              .filter((s) => s.amt > 0)
              // 판매가가 0 이면 비중을 낼 수 없다 — 0 으로 두어 도넛을 비운다.
              .map((b) => ({ label: b.label, value: price > 0 ? (b.amt / price) * 100 : 0, color: b.color }));

            // 고정지출 항목별 배분 — 월 합계 대비 비중으로 나눈다.
            const fixedSum = r.fixedItems.reduce((a, i) => a + i.total, 0);
            const fixedItems = r.fixedItems.map((i) => ({
              key: i.key, name: FIXED_LABEL[i.key] ?? i.key,
              amount: fixedSum > 0 ? (fixed * i.total) / fixedSum : 0,
              rate: fixedSum > 0 ? (r.fixedRate * i.total) / fixedSum : 0,
            }));



            return (
              <>
                <RecentChangeCard>
                  <RecentChangeRow standalone change={r.lastChange}
                    onPress={() => router.push(`/recipes/changes/${r.id}` as Href)} />
                </RecentChangeCard>
                <Card pad={0} style={{ overflow: 'hidden' }}>
                  <View style={{ padding: space.lg }}>
                    <View style={{ gap: space.sm }}>
                      {!r.active ? <Badge tone="neutral" sm>판매중지</Badge> : useInternationalAmounts ? (snapshot?.one.meetsTarget === false ? <Badge tone="red" sm>목표 미달</Badge> : snapshot?.one.meetsTarget === true ? <Badge tone="green" sm>목표 달성</Badge> : null) : warn ? <Badge tone="red" sm>목표 미달</Badge> : <Badge tone="green" sm>목표 달성</Badge>}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                        <Text style={{ flex: 1, minWidth: 0, ...TYPE.title, fontWeight: TYPE.body.fontWeight, color: COLOR.text.primary }}>{r.name}</Text>
                        <Button kind={r.active ? 'primary' : 'ghost'} size="sm" presentation="status" icon="chevronDown" iconRight
                          accessibilityLabel={r.active ? '판매 중지' : '판매 재개'} disabled={writeBlocked}
                          onPress={() => { if (canEditRecipeDetail(r)) setStatusTarget({ id: r.id, active: r.active, desired: !r.active, revision: r.editRevision }); }}>{r.active ? '판매중' : '판매중지'}</Button>
                      </View>
                    </View>
                    {/* 메모 — 식재료 상세와 같은 자리, 같은 모양(0063) */}
                    <Pressable
                      onPress={() => { setMemoTarget(canEditRecipeDetail(r) ? { id: r.id, revision: r.editRevision, memo: r.memo ?? '' } : null); setMemoDraft(r.memo ?? ''); setMemoOpen(true); }}
                      accessibilityRole="button" accessibilityLabel="메모 수정"
                      style={{ marginTop: 11, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    >
                      <DetailRowIcon name="note" />
                      <Text style={{ fontSize: TYPE.caption.fontSize, fontWeight: '700', ...COMPONENT.detailMeta.label }}>메모</Text>
                      <Text
                        style={{ flex: 1, fontSize: TYPE.caption.fontSize, fontWeight: '600', color: r.memo ? T.ink2 : COLOR.text.tertiary }}
                        numberOfLines={1}
                      >
                        {r.memo || ''}
                      </Text>
                      <Icon name="chevron" size={16} color={COLOR.text.tertiary} />
                    </Pressable>
                  </View>
                  {useInternationalAmounts ? <RecipeCurrentPrice query={currentQuote} /> : <>
                  <RecipeDetailRow label="판매가" value={`${won(price)}원`} />
                  <RecipeDetailRow label="기준 인분" value={`${r.baseServings}인분`} />
                  <RecipeDetailRow label="목표 순이익률" value={`${r.targetProfitRate}%`} last />
                  </>}
                  <RecipeDetailRow label="최근 30일 기준" value={`판매 ${r.sales30d.qty} · 폐기 ${r.sales30d.waste}`} />
                </Card>

                {useInternationalAmounts ? <RecipeInternationalComposition query={currentQuote} comparison={costMode} /> : <>
                <Card pad={0} style={{ overflow: 'hidden' }}>
                  <SecHead title="판매가 구성" />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: space.lg, padding: space.lg }}>
                    <Donut segments={segments} size={COMPONENT.recipeComposition.donutSize} thick={COMPONENT.recipeComposition.donutThickness} centerTop="순이익률" centerMain={formatPercent(profitRate)} mainSize={TYPE.body.fontSize} mainColor={PROFIT} />
                    <View style={{ flexGrow: 1, flexBasis: COMPONENT.recipeComposition.legendMinWidth, maxWidth: '100%', gap: space.xs }}>
                      {[...breakdown, { label: '소계', amt: price, color: COLOR.text.primary }].map((b) => {
                        const accent = b.label === '순이익';
                        const total = b.label === '소계';
                        return <View key={b.label} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm,
                          ...(total ? { borderTopWidth: 1, borderTopColor: T.line2, paddingTop: space.sm, marginTop: space.xs } : {}) }}>
                          <Text style={{ ...TYPE.captionSm, flex: 1, color: accent ? PROFIT : COLOR.text.secondary, fontWeight: accent ? TYPE.body.fontWeight : TYPE.captionSm.fontWeight }}>{b.label}</Text>
                          <Text style={[{ ...TYPE.captionSm, fontWeight: TYPE.body.fontWeight, color: accent ? PROFIT : COLOR.text.primary }, NUM]}>{won(Math.round(b.amt))}원</Text>
                          <Text style={[{ ...TYPE.captionSm, minWidth: COMPONENT.recipeComposition.rateMinWidth, textAlign: 'right', color: accent ? PROFIT : COLOR.text.tertiary }, NUM]}>{total ? (price > 0 ? '100%' : '—') : p(b.amt)}</Text>
                        </View>;
                      })}
                    </View>
                  </View>
                </Card>

                </>}

                <Card pad={0} style={{ overflow: 'hidden' }}>
                  <SecHead title="식재료" />
                  <CostTabs value={costMode} onChange={setCostMode} servings={r.baseServings} />
                  <RecipeDetailCostBody title="식재료" expanded={disclosure.expanded.material} onToggle={() => disclosure.toggle('material')}
                    empty="등록된 식재료가 없어요"
                    items={[...r.lines].sort((a, b) => a.name.localeCompare(b.name, 'ko')).map(l => {
                      const unit = dispUnit(l.baseUnit);
                      const cost = l.unitPrice === null ? null : l.perServing * l.unitPrice;
                      const quantity = unit === null ? `${l.perServing * cm}인분` : formatQuantity(l.perServing * cm, unit);
                      const unitPrice = !materialReady ? '단가 확인 전' : l.unitPrice === null ? '단가 산출 전' : useInternationalAmounts && snapshot && snapshot.context.currencyCode !== 'KRW' ? `${recipeSnapshotMoney(l.unitPrice, snapshot)}/${unit ?? '인분'}` : unit === null ? `${won(Math.round(l.unitPrice))}원/인분` : formatUnitPrice(l.unitPrice, unit);
                      return { key: l.id, label: l.name, sub: `${quantity} · ${unitPrice}`,
                        value: !materialReady ? '금액 확인 전' : cost === null ? '—' : detailMoney(cost * cm),
                        secondary: !materialReady || cost === null ? '—' : p(cost) };
                    })}
                    total={{ value: useInternationalAmounts ? snapshotAmount(currentQuote, 'material', costMode) : `${won(Math.round(material * cm))}원`,
                      secondary: useInternationalAmounts ? snapshotPercent('material') : p(material) }} />
                </Card>

                <Card pad={0} style={{ overflow: 'hidden' }}>
                  <SecHead title="부자재" sub="(해당 메뉴 전용 비용)" />
                  <CostTabs value={costMode} onChange={setCostMode} servings={r.baseServings} />
                  <RecipeDetailCostBody title="부자재" expanded={disclosure.expanded.extra} onToggle={() => disclosure.toggle('extra')}
                    empty="등록된 부자재가 없어요"
                    items={r.extras.map(e => ({ key: e.id, label: `${e.name}${e.qty !== null && e.qty !== 1 ? ` ×${e.qty}` : ''}`,
                      value: !extraReady ? '금액 확인 전' : detailMoney(e.amount * cm), secondary: !extraReady ? undefined : p(e.amount) }))}
                    total={{ value: useInternationalAmounts ? snapshotAmount(currentQuote, 'extra', costMode) : `${won(Math.round(extra * cm))}원`,
                      secondary: useInternationalAmounts ? snapshotPercent('extra') : p(extra) }} />
                </Card>

                <Card pad={0} style={{ overflow: 'hidden' }}>
                  <SecHead title="고정 지출" sub="(인분당 환산)" />
                  <CostTabs value={costMode} onChange={setCostMode} servings={r.baseServings} />
                  <RecipeDetailCostBody title="고정 지출" expanded={disclosure.expanded.fixed} onToggle={() => disclosure.toggle('fixed')}
                    empty="이번 달 고정지출이 아직 없어요. 마이페이지에서 등록해 주세요."
                    items={fixedItems.map(item => ({ key: item.key, label: item.name,
                      value: fixedItems.length === 1 && useInternationalAmounts ? snapshotAmount(currentQuote, 'fixed', costMode) : !fixedReady ? '금액 확인 전' : detailMoney(item.amount * cm),
                      secondary: fixedItems.length === 1 && useInternationalAmounts ? snapshotPercent('fixed') : !fixedReady ? undefined : formatPercent(item.rate) }))}
                    total={{ value: useInternationalAmounts ? snapshotAmount(currentQuote, 'fixed', costMode) : `${won(Math.round(fixed * cm))}원`,
                      secondary: useInternationalAmounts ? snapshotPercent('fixed') : formatPercent(r.fixedRate) }}
                    notice={<Notice style={{ margin: space.md }}>가게의 월 고정비를 매출 비율로 나누어, 이 메뉴 {cm}인분에 들어가는 비용으로 환산한 금액입니다.</Notice>} />
                  <RecipeDetailFooter onPress={() => router.push('/recipes/fixed-cost' as Href)} accessibilityLabel="고정 지출 관리">고정 지출 관리</RecipeDetailFooter>
                </Card>

                <Card pad={0} style={{ overflow: 'hidden' }}>
                  <SecHead title="세금" sub={quote
                    ? (internationalTax.data?.quoteContext
                      ? (internationalTax.data.quoteContext.market.priceBasis === 'tax_inclusive' ? '(판매가 포함)' : '(판매가 별도)')
                      : undefined)
                    : r.taxMode === 'included' ? '(판매가 포함)' : r.taxMode === 'separate' ? '(별도)' : '(면세)'} />
                  <CostTabs value={costMode} onChange={setCostMode} servings={r.baseServings} />
                  <RecipeDetailCostBody title="세금" expanded={disclosure.expanded.tax} onToggle={() => disclosure.toggle('tax')}
                    empty="빠지는 세금이 없어요."
                    items={(quote?.components ?? r.taxBreakdown).map((t, i) => ({ key: `${t.name}-${i}`, label: t.name,
                      value: !taxReady ? '금액 확인 전' : detailMoney(('roundedAmount' in t ? t.roundedAmount : t.amount) * cm),
                      secondary: taxReady ? p('roundedAmount' in t ? t.roundedAmount : t.amount) : undefined }))}
                    total={{ value: useInternationalAmounts ? snapshotAmount(currentQuote, 'tax', costMode) : `${won(Math.round(tax * cm))}원`,
                      secondary: useInternationalAmounts ? snapshotPercent('tax') : p(tax) }} />
                  <RecipeDetailFooter onPress={() => router.push(`/recipes/tax?id=${r.id}` as Href)} accessibilityLabel="세금 자세히 보기">자세히 보기</RecipeDetailFooter>
                </Card>

                <Card pad={0} style={{ overflow: 'hidden' }}>
                  <SecHead title="판매 손익" />
                  {useInternationalAmounts ? <RecipeCurrentProfit query={currentQuote} comparison={costMode} onComparisonChange={setCostMode} /> : <>
                  <CostTabs value={costMode} onChange={setCostMode} servings={r.baseServings} />
                  <RecipeDetailRow label="판매가" value={wm(price)} secondary={price > 0 ? '100%' : '—'} />
                  <RecipeDetailRow label="판매량" value={`${m}인분`} />
                  {[
                    { label: '세금', amt: tax }, { label: '식재료 원가', amt: material },
                    { label: '고정 지출', amt: fixed }, { label: '부자재', amt: extra },
                  ].map(c => <RecipeDetailRow key={c.label} label={`(−) ${c.label}`} value={wm(c.amt)} secondary={p(c.amt)} />)}
                  <RecipeDetailRow label="순이익" sub={<Text style={{ color: PROFIT }}>{warn ? '목표 미달' : '목표 달성'}</Text>}
                    value={wm(profit)} secondary={formatPercent(profitRate)} color={PROFIT} last />
                  {warn && recommended != null ? <RecipeDetailSubtotal label="권장 판매가" sub={`목표 ${r.targetProfitRate}% 기준`}
                    value={`${won(recommended)}원`} secondary={`${r.targetProfitRate}%`} /> : null}
                  </>}
                  <RecipeDetailFooter tone="accent" onPress={() => router.push(`/recipes/price-simulation?id=${r.id}` as Href)}>판매가 시뮬레이션</RecipeDetailFooter>
                </Card>

                <Card pad={0} style={{ overflow: 'hidden' }}>
                  <SecHead title="손익 변동" />
                  {profitChanges.length === 0 ? <EmptyDataText style={{ padding: space.lg }}>아직 기록된 손익 변동이 없어요</EmptyDataText>
                    : profitChanges.map((h, i) => <ProfitChangeRow key={h.id} item={h} last={i === profitChanges.length - 1} deltaRounding="signed-first" preview
                      onPress={() => router.push(`/recipes/profit-history?id=${r.id}` as Href)} />)}
                  <RecipeDetailFooter onPress={() => router.push(`/recipes/profit-history?id=${r.id}` as Href)} accessibilityLabel="손익 변동 자세히 보기">자세히 보기</RecipeDetailFooter>
                </Card>
              </>
            );
          })() : null}
        </QueryState>
      </ScrollView>

      <ConfirmDialog visible={statusTarget !== null && Boolean(r)}
        title={statusTarget?.desired ? '판매를 재개하시겠습니까?' : '판매를 중지하시겠습니까?'}
        confirmText={statusTarget?.desired ? '판매 재개' : '판매 중지'} kind={statusTarget?.desired ? 'primary' : 'danger'}
        closeLabel="판매 상태 확인 닫기" loading={saveRecipe.isPending}
        onCancel={() => setStatusTarget(null)} onConfirm={toggleActive}>
        <RecipeConflictNotice recovery={statusRecovery} onAccept={latest => setStatusTarget(current => current ? { ...current, active: latest.active, revision: latest.editRevision } : null)} />
      </ConfirmDialog>

      {r ? (
        <RecipeMemoEditor visible={memoOpen} value={memoDraft} onChange={setMemoDraft}
          busy={saveRecipe.isPending} blocked={writeBlocked || memoRecovery.isBlocked()} readOnly={!editReady}
          onClose={() => setMemoOpen(false)} onSave={saveMemo}
          recovery={<>
            <RecipePendingNotice intent={saveRecipe.pendingIntent} error={saveRecipe.intentError} busy={saveRecipe.isPending || Boolean(saveRecipe.intentBusy)} blocked={!editReady} onResume={resumePending}
              onDiscardUnreadable={() => { void saveRecipe.discardUnreadableIntent().catch(error => Alert.alert('확인 정보를 삭제하지 못했어요', error instanceof Error ? error.message : '저장소 상태를 확인해 주세요.')); }} />
            <RecipeConflictNotice recovery={memoRecovery} onAccept={latest => setMemoTarget({ id: latest.id, revision: latest.editRevision, memo: latest.memo ?? '' })} />
          </>} />
      ) : null}

      <ActionSheet floating visible={menuOpen && editReady} onClose={() => setMenuOpen(false)}
        items={[{ label: '수정', onPress: () => {
          if (editReady) editConfirmation.request(() => router.push(`/recipes/add?id=${id}` as Href));
        } }]} />
    </View>
  );
}

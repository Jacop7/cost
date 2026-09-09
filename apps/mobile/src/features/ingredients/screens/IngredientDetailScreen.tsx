// IngredientDetailScreen.tsx — ING-03 식재료 상세 (실데이터)
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { ActionSheet, AppHeader, Badge, Card, Icon, MemoEditSheet, QueryState } from '../../../components/kit';
import { LAYOUT, COLOR, COMPONENT, T, tnum, TYPE, space, radius } from '../../../theme/tokens';
import { formatQuantity, formatUnitPrice } from '@margincook/core';
import { safeBack } from '@/lib/nav';
import { RecentChangeRow } from '@/features/changes';
import { BasePriceCard } from '../components/BasePriceCard';
import { PurchaseAmount } from '../components/PurchaseAmount';
import { DetailMore, DetailPreviewRow, DetailSectionHeader } from '../components/DetailPreview';
import { LossCard } from '../components/LossCard';
import { PurchaseOptionRow } from '../components/PurchaseOptionRow';
import { belowSafety, stockLabel, stockStateOf } from '../components/IngCard';
import { isNegativeStock, shortageOf } from '@margincook/core';
import { StockEditSheet } from './StockEditSheet';
import { dispUnit, toLedgerView } from '../ledger';
import {
  useDeactivateIngredient,
  useIngredientDetail,
  useSaveIngredient,
  useStockChange,
  useStockHistory,
} from '../hooks';

function MetadataChip({ children, warning = false }: { children: React.ReactNode; warning?: boolean }) {
  return <View style={{ paddingHorizontal: COMPONENT.ingredientDetail.metadataPaddingHorizontal,
    paddingVertical: COMPONENT.ingredientDetail.metadataPaddingVertical, borderRadius: radius.sm,
    backgroundColor: warning ? COLOR.status.cautionTint : T.surface2 }}>
    <Text style={{ ...TYPE.captionSm, fontWeight: '700', color: warning ? COLOR.status.caution : T.sub2 }}>{children}</Text>
  </View>;
}

export function IngredientDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const detail = useIngredientDetail(id);
  const history = useStockHistory(id);
  const stockChange = useStockChange();
  const saveIngredient = useSaveIngredient();
  const deactivate = useDeactivateIngredient();

  const [menuOpen, setMenuOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);

  const g = detail.data;
  const unit = g ? dispUnit(g.baseUnit) : 'g';
  const recent = history.data?.slice(0, 3) ?? [];

  const saveMemo = (memo: string) => {
    if (!g) return;
    saveIngredient.mutate(
      {
        id: g.id,
        name: g.name,
        categoryId: g.categoryId,
        baseUnit: g.baseUnit,
        defaultVendorId: g.defaultVendorId,
        perVolume: g.perVolume,
        safetyStock: g.safetyStock,
        minOrderQty: g.minOrderQty,
        memo: memo.trim() || null,
      },
      {
        onSuccess: () => setMemoOpen(false),
        onError: (e) => Alert.alert('저장하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
      },
    );
  };

  const confirmDelete = () => {
    if (!g) return;
    Alert.alert(
      `${g.name} 삭제`,
      '과거 입고·판매 기록은 남고 목록에서만 사라져요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () =>
            deactivate.mutate(g.id, {
              onSuccess: () => safeBack('/ingredients'),
              onError: (e) => Alert.alert('삭제하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
            }),
        },
      ],
    );
  };

  const menuItems: { label: string; danger?: boolean; onPress: () => void }[] = [
    { label: '식재료 수정', onPress: () => router.push(`/ingredients/edit/${id}`) },
    // ⚠ '재고 추가'와 '재고 수정'은 다른 사건이다(0074).
    //   추가 = 입고 → 기준 단가와 연결 메뉴 원가까지 바뀐다
    //   수정 = 실사 → 재고만 바뀐다
    //   같은 항목으로 묶으면 같은 손짓이 전혀 다른 결과를 낸다.
    { label: '재고 추가 (입고)', onPress: () => router.push(`/ingredients/add-stock/${id}` as Href) },
    { label: '재고 수정 (실사)', onPress: () => setStockOpen(true) },
    { label: '메모 수정', onPress: () => setMemoOpen(true) },
    { label: '구매 링크 · 옵션', onPress: () => router.push(`/ingredients/option?ingredient=${id}`) },
    { label: '식재료 삭제', danger: true, onPress: confirmDelete },
  ];

  // 목록 카드와 **같은 함수**를 쓴다. 두 화면이 다른 기준으로 판정하면 목록과 상세가 어긋난다.
  const st = g ? stockLabel(stockStateOf(g)) : null;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader
        title="식재료"
        onBack={() => safeBack('/ingredients')}
        right={
          <Pressable
            onPress={() => setMenuOpen(true)}
            accessibilityRole="button" accessibilityLabel="수정 메뉴 열기"
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="more" size={19} color={T.ink2} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 0, paddingBottom: LAYOUT.scroll.end, gap: COMPONENT.ingredientDetail.cardGap }} showsVerticalScrollIndicator={false}>
        <QueryState
          isLoading={detail.isLoading}
          error={detail.error}
          isEmpty={detail.isFetched && !g}
          onRetry={() => void detail.refetch()}
          emptyTitle="식재료를 찾을 수 없어요"
          emptyHint="목록에서 다시 선택해 주세요"
        >
          {g ? (
            <>
              <Card pad={16} style={{ paddingVertical: COMPONENT.ingredientDetail.cardPaddingVertical }}>
                {g.categoryName ? <View style={{ alignSelf: 'flex-start' }}><MetadataChip>{g.categoryName}</MetadataChip></View> : null}
                <Text style={{ ...TYPE.title, fontWeight: '700', color: T.ink, marginTop: 15 }}>{g.name}</Text>
                <Pressable onPress={() => setMemoOpen(true)} accessibilityRole="button" accessibilityLabel="메모 수정"
                  style={{ marginTop: 15, paddingTop: 15, minHeight: 44, borderTopWidth: 1, borderTopColor: T.line2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, marginBottom: g.memo?.trim() ? space.sm : 0 }}>
                    <Icon name="note" size={14} color={T.sub} />
                    <Text style={{ ...TYPE.caption, fontWeight: '700', color: T.sub, flex: 1 }}>메모</Text>
                    <Icon name="chevron" size={16} color={COLOR.text.tertiary} />
                  </View>
                  {g.memo?.trim() ? <Text style={{ ...TYPE.body, color: T.ink2 }}>{g.memo}</Text> : null}
                </Pressable>
                <RecentChangeRow change={g.lastChange} onPress={() => router.push(`/ingredients/changes/${g.id}` as Href)} />
              </Card>

              <Card pad={16} style={{ paddingVertical: COMPONENT.ingredientDetail.cardPaddingVertical }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 6 }}>
                      <Text style={{ ...TYPE.body, color: T.sub }}>재고</Text>
                      <Text style={[{ ...TYPE.display, fontWeight: '800',
                        color: isNegativeStock(g.stockTotal) ? COLOR.status.negative : T.ink }, tnum]}>{formatQuantity(g.stockTotal, unit)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                      <Text style={{ ...TYPE.captionSm, color: T.sub2 }}>기준 단가</Text>
                      <Text style={[{ ...TYPE.captionSm, color: T.sub }, tnum]}>{g.basePrice === null ? '단가 산출 전' : formatUnitPrice(g.basePrice, unit)}</Text>
                    </View>
                  </View>
                  {st ? <View style={{ marginTop: 3 }}><Badge tone={st.tone} sm>{st.label}</Badge></View> : null}
                </View>
                {isNegativeStock(g.stockTotal) ? <Text style={[{ ...TYPE.caption, color: COLOR.status.negative, marginTop: space.xs }, tnum]}>
                  재고 부족 {formatQuantity(shortageOf(g.stockTotal), unit)} · 입고를 빠뜨렸는지 확인해 주세요
                </Text> : null}
                <View style={{ marginTop: space.md, flexDirection: 'row', gap: COMPONENT.ingredientDetail.metadataGap, flexWrap: 'wrap' }}>
                  <MetadataChip warning={belowSafety(g)}>안전재고 {formatQuantity(g.safetyStock, unit)}</MetadataChip>
                  <MetadataChip>최소 발주 {g.minOrderQty}개</MetadataChip>
                  {g.lastInboundAt ? <MetadataChip>최근 입고 {g.lastInboundAt.slice(5).replace('-', '/')}</MetadataChip> : null}
                </View>
              </Card>

              <Card pad={0} style={{ overflow: 'hidden' }}>
                <DetailSectionHeader>구매 링크</DetailSectionHeader>
                <View style={{ paddingHorizontal: space.lg }}>
                  {g.options.length === 0 ? <Text style={{ ...TYPE.caption, color: T.sub2, paddingVertical: 18 }}>
                    등록된 구매링크가 없습니다.
                  </Text> : g.options.slice(0, 3).map((o, i, rows) => (
                    <DetailPreviewRow key={o.id} title={o.brandName ?? o.vendorName ?? '구매처 미지정'}
                      subAfter={<PurchaseAmount>{`${o.amount.toLocaleString('ko-KR')}원`}</PurchaseAmount>} value={formatQuantity(o.volume, unit)}
                      detail={o.volume > 0 ? formatUnitPrice(o.amount / o.volume, unit) : '단가 산출 전'}
                      last={i === rows.length - 1} />
                  ))}
                </View>
                {g.options.length === 0 ? <DetailMore label="＋ 구매 링크 추가" accessibilityLabel="구매 링크 추가"
                  onPress={() => router.push(`/ingredients/option?ingredient=${g.id}`)} /> : (
                  <DetailMore accessibilityLabel="구매 링크 자세히보기" onPress={() => router.push(`/ingredients/option?ingredient=${g.id}`)} />
                )}
              </Card>

              <BasePriceCard unit={unit} basePrice={g.basePrice} purchase={g.purchase} orders={g.orders}
                onSeeAll={() => router.push(`/ingredients/purchases/${g.id}`)} />

              <Card pad={0} style={{ overflow: 'hidden' }}>
                <DetailSectionHeader>재고 내역</DetailSectionHeader>
                <View style={{ paddingHorizontal: space.lg }}>
                  <QueryState isLoading={history.isLoading} error={history.error}
                    isEmpty={recent.length === 0} onRetry={() => void history.refetch()} emptyTitle="아직 변동 기록이 없어요">
                    {recent.map((e, i) => {
                      const v = toLedgerView(e, g.baseUnit);
                      return <DetailPreviewRow key={v.id} title={`${v.date} · ${v.label}`} sub={v.memo}
                        value={v.delta} detail={v.balance}
                        color={v.up ? COLOR.text.accent : COLOR.status.negative}
                        detailColor={v.balanceNegative ? COLOR.status.negative : COLOR.text.tertiary}
                        detailStyle={{ fontSize: TYPE.caption.fontSize, fontWeight: v.balanceNegative ? '800' : '400' }}
                        last={i === recent.length - 1} />;
                    })}
                  </QueryState>
                </View>
                {(history.data?.length ?? 0) > 0 ? <DetailMore accessibilityLabel="재고 내역 자세히보기"
                  onPress={() => router.push(`/ingredients/history/${g.id}`)} /> : null}
              </Card>

            </>
          ) : null}
        </QueryState>
      </ScrollView>

      {/* 수정 액션 메뉴 */}
      <ActionSheet visible={menuOpen} onClose={() => setMenuOpen(false)} items={menuItems} />

      {g ? (
        <>
          <StockEditSheet
            onAddStock={() => { setStockOpen(false); router.push(`/ingredients/add-stock/${id}` as Href); }}
            visible={stockOpen}
            onClose={() => setStockOpen(false)}
            name={g.name}
            unit={unit}
            stock={g.stockTotal}
            saving={stockChange.isPending}
            onApply={(change) => {
              // 수량만 덮어쓰지 않고 **원장에 이력을 남긴다**. 조정(E5)과 폐기(E2)는 서로 다른 사건이다.
              // 폐기는 기준단가를 바꾸지 않지만(0041), 로스율 표시와 월 손익의 폐기 손실에 잡힌다.
              stockChange.mutate(
                {
                  ingredientId: g.id,
                  kind: change.kind,
                  // 폐기는 **남은 양**을 넘긴다(E2 가 폐기량을 역산한다).
                  value: change.nextStock,
                  reason: change.reason,
                },
                {
                  onSuccess: (res) => {
                    setStockOpen(false);
                    // 버릴 게 없으면 서버가 아무 일도 하지 않는다. 조용히 넘기면
                    // 사장님은 폐기가 기록된 줄 안다.
                    if (res?.skipped) {
                      Alert.alert('기록하지 않았어요', '남은 양이 지금 재고와 같거나 더 많아 버린 양이 0이에요.');
                    }
                  },
                  onError: (e) => Alert.alert('저장하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
                },
              );
            }}
          />
          <MemoEditSheet
            key={g.id}
            visible={memoOpen}
            value={g.memo ?? ''}
            saving={saveIngredient.isPending}
            onClose={() => setMemoOpen(false)}
            onSave={saveMemo}
          />
        </>
      ) : null}
    </View>
  );
}

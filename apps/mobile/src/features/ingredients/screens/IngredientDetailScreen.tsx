// IngredientDetailScreen.tsx — ING-03 식재료 상세 (실데이터)
import { useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { ActionSheet, AppHeader, Badge, Card, Icon, MemoEditSheet, QueryState } from '../../../components/kit';
import { LAYOUT, COLOR, COMPONENT, T, tnum, TYPE, space, radius } from '../../../theme/tokens';
import { formatQuantity, formatUnitPrice } from '@margincook/core';
import { safeBack } from '@/lib/nav';
import { ConfirmDialog } from '@/components/kit/ConfirmDialog';
import { RecentChangeRow } from '@/features/changes';
import { BasePriceCard } from '../components/BasePriceCard';
import { PurchaseAmount } from '../components/PurchaseAmount';
import { DetailMore, DetailPreviewRow, DetailSectionHeader } from '../components/DetailPreview';
import { LossCard } from '../components/LossCard';
import { normalizePurchaseUrl } from '../purchaseUrl';
import { EditConflictNotice, useIngredientEditConflict } from '../editConflict';
import { belowSafety, stockLabel, stockStateOf } from '../components/IngCard';
import { isNegativeStock, shortageOf } from '@margincook/core';
import { dispUnit, toLedgerView } from '../ledger';
import {
  useDeactivateIngredient,
  useIngredientDetail,
  useSaveIngredientMemo,
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
  const { id } = useLocalSearchParams<{ id: string }>();
  return <IngredientDetailContent key={id} id={id} />;
}

function IngredientDetailContent({ id }: { id: string }) {
  const router = useRouter();

  const detail = useIngredientDetail(id);
  const history = useStockHistory(id);
  const saveIngredientMemo = useSaveIngredientMemo();
  const deactivate = useDeactivateIngredient();

  const [menuOpen, setMenuOpen] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [purchaseMenuId, setPurchaseMenuId] = useState<string | null>(null);

  const g = detail.data;
  // Keep an open memo draft even if a conflict refresh discovers a deleted record.
  const lastDetail = useRef(g);
  if (g) lastDetail.current = g;
  const memoIngredient = g ?? lastDetail.current;
  const selectedPurchase = g?.options.find(o => o.id === purchaseMenuId);
  const unit = g ? dispUnit(g.baseUnit) : 'g';
  const recent = history.data?.slice(0, 3) ?? [];

  const saveMemo = (memo: string, expectedMemo: string | null, onConflict: (error: unknown) => boolean) => {
    if (!g) return;
    saveIngredientMemo.mutate(
      {
        id: g.id,
        memo: memo.trim(),
        expectedMemo,
      },
      {
        onSuccess: () => setMemoOpen(false),
        onError: (e) => { if (!onConflict(e)) Alert.alert('저장하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'); },
      },
    );
  };

  const menuItems: { label: string; accessibilityLabel?: string; danger?: boolean; onPress: () => void }[] = [
    { label: '식재료 수정', onPress: () => router.push(`/ingredients/edit/${id}`) },
    // 2026-09-09: 수정 메뉴를 프로토타입과 일치. 다음 화면의 입고/차감/폐기 탭이 서로 다른 RPC를 유지한다.
    { label: '재고 수정', onPress: () => router.push(`/ingredients/add-stock/${id}` as Href) },
    { label: '메모 수정', onPress: () => setMemoOpen(true) },
    { label: '구매 링크 수정', onPress: () => router.push(`/ingredients/option?ingredient=${id}`) },
    { label: '식재료 삭제', danger: true, onPress: () => setDeleteOpen(true) },
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
                      last={i === rows.length - 1} showChevron onPress={() => setPurchaseMenuId(o.id)}
                      accessibilityLabel={`${o.brandName ?? o.vendorName ?? '구매처 미지정'} 구매 링크 메뉴`} />
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
                      return <View key={v.id} style={{ paddingVertical: space.md,
                        borderBottomWidth: i === recent.length - 1 ? 0 : 1, borderBottomColor: T.line2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
                          <Text style={[{ ...TYPE.captionSm, color: T.sub2 }, tnum]}>{v.date}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, marginTop: space.xs }}>
                          <Text style={{ ...TYPE.body, color: T.ink, flex: 1 }}>{v.label}</Text>
                          <Text style={[{ ...TYPE.body, textAlign: 'right', flexShrink: 1,
                            color: v.up ? COLOR.text.accent : COLOR.status.negative }, tnum]}>{v.delta}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 3 }}>
                          {v.memo ? <Text style={{ ...TYPE.captionSm, color: T.sub2, flex: 1 }}>{v.memo}</Text> : null}
                          <Text style={[{ ...TYPE.captionSm, textAlign: 'right', marginLeft: 'auto', flexShrink: 1,
                            color: v.balanceNegative ? COLOR.status.negative : T.sub2,
                            fontWeight: v.balanceNegative ? '800' : TYPE.captionSm.fontWeight }, tnum]}>{v.balance}</Text>
                        </View>
                      </View>;
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
      <ActionSheet visible={menuOpen} onClose={() => setMenuOpen(false)} items={menuItems} floating />
      <ActionSheet floating visible={!!selectedPurchase} onClose={() => setPurchaseMenuId(null)} items={[
        { label: '구매 링크 열기', onPress: () => {
          const link = normalizePurchaseUrl(selectedPurchase?.url ?? '');
          if (!link) { Alert.alert('링크를 열 수 없어요', '올바른 구매 링크를 등록해 주세요.'); return; }
          void Linking.openURL(link).catch(() => Alert.alert('링크를 열 수 없어요', '주소를 확인한 뒤 다시 시도해 주세요.'));
        } },
        { label: '구매 링크 수정', onPress: () => {
          if (selectedPurchase) router.push(`/ingredients/option?ingredient=${id}&option=${selectedPurchase.id}`);
        } },
      ]} />
      {g ? <ConfirmDialog visible={deleteOpen} title="삭제하시겠습니까?"
        message="삭제 시, 복구가 불가합니다." loading={deactivate.isPending}
        onCancel={() => setDeleteOpen(false)} onConfirm={() => {
          if (deactivate.isPending) return;
          deactivate.mutate(g.id, { onSuccess: () => { setDeleteOpen(false); safeBack('/ingredients'); },
            onError: (e) => Alert.alert('삭제하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요') });
        }} /> : null}

      {memoIngredient ? (
        <>
            {memoOpen ? <IngredientMemoEditor
              key={memoIngredient.id}
              id={memoIngredient.id}
              readLatest={() => detail.refetch()}
              value={memoIngredient.memo}
              saving={saveIngredientMemo.isPending}
              onClose={() => setMemoOpen(false)}
              onSave={saveMemo}
            /> : null}
        </>
      ) : null}
    </View>
  );
}

/** Mount per editing session: background reads must not change the CAS baseline. */
function IngredientMemoEditor({ id, readLatest, value, saving, onClose, onSave }: {
  id: string;
  readLatest: () => ReturnType<ReturnType<typeof useIngredientDetail>['refetch']>;
  value: string | null;
  saving: boolean;
  onClose: () => void;
  onSave: (memo: string, expectedMemo: string | null, onConflict: (error: unknown) => boolean) => void;
}) {
  const [initialValue] = useState(value);
  const [expectedMemo, setExpectedMemo] = useState(value);
  const recovery = useIngredientEditConflict(id, readLatest);
  return <MemoEditSheet visible value={initialValue ?? ''} saving={saving} onClose={onClose}
    saveDisabled={Boolean(recovery.conflict)}
    onSave={memo => { if (!recovery.isBlocked()) onSave(memo, expectedMemo, recovery.handleError); }}>
    <EditConflictNotice recovery={recovery} onAccept={latest => setExpectedMemo(latest.memo)}>
      <Text style={{ ...TYPE.captionSm, color: COLOR.text.secondary }}>현재 저장된 메모</Text>
      <Text style={{ ...TYPE.caption, color: COLOR.text.primary }}>{recovery.conflict?.latest?.memo || '메모 없음'}</Text>
      <Text style={{ ...TYPE.captionSm, color: COLOR.text.secondary }}>다시 저장하면 현재 입력한 메모로 변경됩니다.</Text>
    </EditConflictNotice>
  </MemoEditSheet>;
}

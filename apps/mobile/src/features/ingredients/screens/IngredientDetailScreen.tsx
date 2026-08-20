// IngredientDetailScreen.tsx — ING-03 식재료 상세 (실데이터)
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, Badge, Card, Icon, MemoEditSheet, QueryState } from '../../../components/kit';
import { T, tnum } from '../../../theme/tokens';
import { formatQuantity, formatUnitPrice } from '@sikjae/core';
import { safeBack } from '@/lib/nav';
import { RecentChangeRow } from '@/features/changes';
import { LedgerRow } from '../components/LedgerRow';
import { LossCard } from '../components/LossCard';
import { belowSafety, stockLabel, stockStateOf } from '../components/IngCard';
import { StockEditSheet } from './StockEditSheet';
import { dispUnit, toLedgerView } from '../ledger';
import {
  useDeactivateIngredient,
  useIngredientDetail,
  useSaveIngredient,
  useStockChange,
  useStockHistory,
} from '../hooks';

function SectionHeader({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
      <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.sub }}>{children}</Text>
      {right}
    </View>
  );
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
  const recent = history.data?.slice(0, 4) ?? [];
  /** 로스율 카드가 쓸 폐기 줄. 재고 변동 내역과 같은 원장에서 온다. */
  const discards = (history.data ?? []).filter((e) => e.type === 'discard');

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
            style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 8 }}
          >
            <Icon name="edit" size={19} color={T.ink2} />
            <Text style={{ color: T.ink2, fontSize: 16, fontWeight: '700' }}>수정</Text>
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 28, gap: 11 }} showsVerticalScrollIndicator={false}>
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
              {/* 이름 · 메모 */}
              <Card pad={16}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 11 }}>
                  {g.categoryName ? <Badge tone="neutral">{g.categoryName}</Badge> : null}
                  {g.vendorName ? <Badge tone="neutral" sm>{g.vendorName}</Badge> : null}
                </View>
                <Text style={{ fontSize: 20, fontWeight: '800', letterSpacing: -0.5, color: T.ink }}>{g.name}</Text>
                <Pressable
                  onPress={() => setMemoOpen(true)}
                  accessibilityRole="button" accessibilityLabel="메모 수정"
                  style={{ marginTop: 13, paddingTop: 13, borderTopWidth: 1, borderTopColor: T.line2 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                    <Icon name="note" size={16} color={T.amberText} />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub }}>메모</Text>
                  </View>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: g.memo ? T.ink2 : T.ter, lineHeight: 22 }}>
                    {g.memo || '메모를 입력하세요'}
                  </Text>
                </Pressable>
                {/* 최근 수정 — 레시피 상세와 **같은 컴포넌트**를 쓴다(0063). */}
                <RecentChangeRow
                  change={g.lastChange}
                  onPress={() => router.push(`/ingredients/changes/${g.id}` as Href)}
                />
              </Card>

              {/* 잔여 */}
              <Card pad={16}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {st ? <Badge tone={st.tone} solid sm>{st.label}</Badge> : null}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
                  <Text style={[{ fontSize: 20, fontWeight: '800', letterSpacing: -0.6, color: T.ink }, tnum]}>
                    총 {formatQuantity(g.stockTotal, unit)}
                  </Text>
                  <Text style={[{ flexShrink: 1, fontSize: 14, color: g.basePrice === null ? T.ter : T.sub, fontWeight: '700' }, tnum]} numberOfLines={1}>
                    {g.basePrice === null ? '단가 산출 전' : formatUnitPrice(g.basePrice, unit)}
                  </Text>
                </View>
                <Text style={[{ fontSize: 14, color: T.sub2, marginTop: 6, fontWeight: '600' }, tnum]}>
                  개당 {formatQuantity(g.perVolume, unit)}
                </Text>
                <View style={{ marginTop: 10, flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  <Badge tone={belowSafety(g) ? 'amber' : 'neutral'} sm>안전재고 {g.safetyStock}개</Badge>
                  <Badge tone="neutral" sm>최소발주 {g.minOrderQty}개</Badge>
                  {g.lastInboundAt ? <Badge tone="neutral" sm>최근입고 {g.lastInboundAt.slice(5).replace('-', '/')}</Badge> : null}
                </View>
              </Card>

              {/* 기준 단가 */}
              <Card pad={0} style={{ overflow: 'hidden' }}>
                <SectionHeader
                  right={<Text style={{ fontSize: 14, color: T.ter, fontWeight: '600' }}>입고 {g.purchase.count}건 기준</Text>}
                >
                  기준 단가
                </SectionHeader>
                <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <View>
                      <Text style={{ fontSize: 14, color: T.ter, fontWeight: '600' }}>
                        실입고 기준
                      </Text>
                      <Text style={[{ fontSize: 22, fontWeight: '800', color: g.basePrice === null ? T.ter : T.blue, marginTop: 2 }, tnum]}>
                        {g.basePrice === null ? '산출 전' : formatUnitPrice(g.basePrice, unit)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 14, color: T.ter }}>가중평균</Text>
                      <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, tnum]}>
                        {g.purchase.avg === null ? '—' : formatUnitPrice(g.purchase.avg, unit)}
                      </Text>
                    </View>
                  </View>

                  {g.purchase.count > 0 ? (
                    <View style={{ gap: 7, marginTop: 13, paddingTop: 13, borderTopWidth: 1, borderTopColor: T.line2 }}>
                      {([
                        ['최저', g.purchase.low, T.blue],
                        ['최고', g.purchase.high, T.red],
                      ] as const).map(([lbl, val, color]) => (
                        <View key={lbl} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ fontSize: 16, fontWeight: '700', width: 36, color }}>{lbl}</Text>
                          <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, tnum]}>
                            {val === null ? '—' : formatUnitPrice(val, unit)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={{ fontSize: 14, color: T.ter, marginTop: 13, paddingTop: 13, borderTopWidth: 1, borderTopColor: T.line2 }}>
                      입고 기록이 없어 단가를 낼 수 없어요. 발주 → 입고를 등록하면 자동으로 계산돼요.
                    </Text>
                  )}
                </View>
              </Card>

              {/* 로스율 — 폐기 이력 바로 위에 둔다. 숫자만 보면 어디서 나온 값인지 모른다. */}
              <LossCard
                loss={g.loss}
                baseUnit={g.baseUnit}
                discards={discards}
                unitPrice={g.basePrice}
                onPress={() => router.push(`/ingredients/discards/${g.id}`)}
              />

              {/* 재고 변동 내역 */}
              <Card pad={0} style={{ overflow: 'hidden' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.sub }}>현재 재고</Text>
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, tnum]}>{formatQuantity(g.stockTotal, unit)}</Text>
                </View>
                {recent.length === 0 ? (
                  <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, color: T.ter }}>{history.isLoading ? '불러오는 중이에요' : '아직 변동 기록이 없어요'}</Text>
                  </View>
                ) : (
                  recent.map((e, i) => {
                    const v = toLedgerView(e, g.baseUnit);
                    return (
                      <LedgerRow
                        key={v.id}
                        date={v.date}
                        act={v.label}
                        memo={v.memo}
                        delta={v.delta}
                        bal={v.balance}
                        up={v.up}
                        px={15}
                        last={i === recent.length - 1}
                        onPress={() => router.push(`/ingredients/history/${g.id}`)}
                      />
                    );
                  })
                )}
                <Pressable
                  onPress={() => router.push(`/ingredients/history/${g.id}`)}
                  accessibilityRole="button" accessibilityLabel="재고 변동 내역 전체 보기"
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 13, borderTopWidth: 1, borderTopColor: T.line2, backgroundColor: T.surface2 }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub }}>자세히 보기</Text>
                  <Icon name="chevron" size={16} color={T.ter} />
                </Pressable>
              </Card>

              {/* 구매 옵션 */}
              <Card pad={0} style={{ overflow: 'hidden' }}>
                <SectionHeader
                  right={
                    <Pressable
                      onPress={() => router.push(`/ingredients/option?ingredient=${g.id}`)}
                      hitSlop={6} accessibilityRole="button" accessibilityLabel="구매 옵션 관리"
                    >
                      <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue }}>관리</Text>
                    </Pressable>
                  }
                >
                  구매 링크 · 옵션
                </SectionHeader>
                <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 }}>
                  {g.options.length === 0 ? (
                    <Text style={{ fontSize: 14, color: T.ter, paddingVertical: 14 }}>등록된 구매 옵션이 없어요</Text>
                  ) : (
                    g.options.map((o, i) => (
                      <Pressable
                        key={o.id}
                        onPress={() => router.push(`/ingredients/option?ingredient=${g.id}&option=${o.id}`)}
                        accessibilityRole="button" accessibilityLabel={`${o.name} 수정`}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderBottomWidth: i < g.options.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}
                      >
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }} numberOfLines={1}>
                            {o.name} · {formatQuantity(o.volume, unit)}
                          </Text>
                          <Text style={[{ fontSize: 14, color: T.ink, marginTop: 2 }, tnum]}>
                            {o.vendorName ?? '거래처 미지정'} · {o.amount.toLocaleString('ko-KR')}원 · {formatUnitPrice(o.amount / (o.volume || 1), unit)}
                          </Text>
                        </View>
                        <Icon name="chevron" size={16} color={T.line3} />
                      </Pressable>
                    ))
                  )}
                </View>
              </Card>

              {/* 구매 이력 */}
              {g.orders.length > 0 ? (
                <Card pad={0} style={{ overflow: 'hidden' }}>
                  <SectionHeader>구매 이력</SectionHeader>
                  <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 }}>
                    {g.orders.slice(0, 6).map((o, i) => (
                      <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: i < Math.min(6, g.orders.length) - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[{ fontSize: 14, color: T.ter, fontWeight: '600' }, tnum]}>
                            {o.orderedAt.slice(5).replace('-', '/')}
                            {o.status === 'ordered' ? ' · 입고 대기' : o.status === 'partial' ? ' · 부분 입고' : o.status === 'canceled' ? ' · 취소' : ''}
                          </Text>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink, marginTop: 2 }} numberOfLines={1}>
                            {o.vendorName ?? '거래처 미지정'}
                          </Text>
                          <Text style={[{ fontSize: 14, color: T.sub2, marginTop: 2 }, tnum]}>
                            {formatQuantity(o.volume, unit)} × {o.qty}개 · {o.amount.toLocaleString('ko-KR')}원
                          </Text>
                        </View>
                        <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, tnum]}>
                          {o.unitPrice === null ? '—' : formatUnitPrice(o.unitPrice, unit)}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Pressable
                    onPress={() => router.push(`/ingredients/purchases/${g.id}`)}
                    accessibilityRole="button" accessibilityLabel="구매 이력 전체 보기"
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 13, borderTopWidth: 1, borderTopColor: T.line2, backgroundColor: T.surface2 }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub }}>자세히 보기</Text>
                    <Icon name="chevron" size={16} color={T.ter} />
                  </Pressable>
                </Card>
              ) : null}
            </>
          ) : null}
        </QueryState>
      </ScrollView>

      {/* 수정 액션 메뉴 */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)} statusBarTranslucent>
        <Pressable onPress={() => setMenuOpen(false)} accessibilityRole="button" accessibilityLabel="메뉴 닫기" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: T.scrim }}>
          {/* 시트 본문 탭이 배경까지 전달돼 닫히지 않게 여기서 삼킨다.
              빈 onPress 를 단 Pressable 로 막으면 스크린리더가 "버튼"이라고 읽는다 — View 로 처리한다. */}
          <View onStartShouldSetResponder={() => true} style={{ backgroundColor: T.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 16 }}>
            <View style={{ alignItems: 'center', paddingBottom: 14 }}>
              <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: T.line }} />
            </View>
            <View style={{ backgroundColor: T.surface2, borderRadius: 14, overflow: 'hidden', marginBottom: 9 }}>
              {menuItems.map((m, i) => (
                <Pressable
                  key={m.label}
                  onPress={() => { setMenuOpen(false); m.onPress(); }}
                  accessibilityRole="button" accessibilityLabel={m.label}
                  style={{ paddingVertical: 20, alignItems: 'center', borderTopWidth: i > 0 ? 1 : 0, borderTopColor: T.line }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '600', color: m.danger ? T.red : T.ink }}>{m.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => setMenuOpen(false)} accessibilityRole="button" accessibilityLabel="닫기" style={{ paddingVertical: 20, borderRadius: 14, backgroundColor: T.surface2, alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: T.ink }}>닫기</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

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

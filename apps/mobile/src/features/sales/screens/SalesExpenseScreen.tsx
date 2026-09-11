/**
 * SALES-20 추가 지출 상세 — 당일 일회성 현금 지출 목록.
 * 하루 장부에 붙어 있는 항목이라 기간 조회에서는 합계만 보여준다.
 */
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Button, Card, Field, Icon, Input, QueryState, Sheet } from '@/components/kit';
import { ConfirmDialog } from '@/components/kit/ConfirmDialog';
import { safeBack } from '@/lib/nav';
import { LAYOUT, COLOR, T, won, TYPE, space } from '@/theme/tokens';
import { isRevisionConflict, useSalesBusinessDate } from '@/features/business-day/businessDay';
import { useAmendPastSale, useSalesDay, useSalesRange, useSaveSale, type ExtraItem } from '../hooks';
import { rangeLabel } from '@/lib/date';
import { DetailSummary } from '../components/ProfitBlocks';
import { BusinessDateGate } from '@/features/business-day/components/BusinessDateGate';

const NUM = { fontVariant: ['tabular-nums' as const] };

/**
 * ⚠ 서버가 정한 장부 날짜를 받고 나서 본체를 붙인다(0125). 앱이 직접 계산하지 않는다.
 *   게이트가 로딩·오류·재시도를 함께 다룬다 — 날짜 조회가 실패하면 예전엔 영원히
 *   "불러오는 중" 만 떴다.
 */
export default function SalesExpenseScreen() {
  return (
    <BusinessDateGate source={useSalesBusinessDate()} title="추가 지출">
      {(serverToday) => <SalesExpenseScreenBody serverToday={serverToday} />}
    </BusinessDateGate>
  );
}

function SalesExpenseScreenBody({ serverToday }: { serverToday: string }) {
  const params = useLocalSearchParams<{ from?: string; to?: string; date?: string }>();
    const today = serverToday;
  const from = params.from ?? params.date ?? today;
  const to = params.to ?? params.date ?? today;
  const isOneDay = from === to;

  const day = useSalesDay(isOneDay ? from : '');
  const range = useSalesRange(from, to, !isOneDay);
  const saveSale = useSaveSale();
  const amend = useAmendPastSale();
  const pending = saveSale.isPending || amend.isPending;
  const [addition, setAddition] = useState<{ date: string; revision: number } | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [additionError, setAdditionError] = useState<string | null>(null);
  /** 다른 기기가 먼저 저장했을 때 짧게만 알린다(45009 · 0117). 사장님이 할 일은 없다. */
  const [toast, setToast] = useState<string | null>(null);
  const [deletion, setDeletion] = useState<{ index: number; date: string; revision: unknown; name: string } | null>(null);

  const rows = isOneDay ? (day.data?.extraItems ?? []) : [];
  const total = isOneDay ? (day.data?.dailyExtra ?? 0) : (range.data?.summary.dailyExtra ?? 0);
  const canEdit = isOneDay && Boolean(day.data?.hasLedger && day.data.editable) && !day.error;
  const saveExpenses = (extraItems: ExtraItem[], onSuccess: () => void) => {
    if (!canEdit || !day.data || pending) return;
    const callbacks = { onSuccess, onError: (e: unknown) => {
      if (isRevisionConflict(e)) {
        setAddition(null);
        void day.refetch();
        setToast('다른 기기에서 내역이 변경됐어요. 최신 목록을 확인한 뒤 다시 시도해 주세요.');
      } else {
        const message = e instanceof Error ? e.message : '저장하지 못했어요. 다시 시도해 주세요.';
        if (addition) setAdditionError(message);
        else setToast(message);
      }
    } };
    if (day.data.dayStatus === 'closed') {
      amend.mutate({ date: from, items: [], extraItems, baseRevision: day.data.revision }, callbacks);
    } else {
      const items = day.data.items.filter(it => it.recipeId).map(it => ({
        recipeId: it.recipeId as string, qtyHall: it.qtyHall, qtyDelivery: it.qtyDelivery,
        qtyTakeout: it.qtyTakeout, qtyWaste: it.qtyWaste,
      }));
      saveSale.mutate({ date: from, items, extraItems, baseRevision: day.data.revision }, callbacks);
    }
  };
  const add = () => {
    if (!addition || !canEdit || !day.data || pending) return;
    if (addition.date !== from || addition.revision !== day.data.revision) {
      setAddition(null);
      setToast('내역이 변경됐어요. 최신 목록을 확인한 뒤 다시 추가해 주세요.');
      return;
    }
    const value = Number(amount.trim().replace(/,/g, ''));
    if (!name.trim() || !amount.trim() || !Number.isFinite(value) || value <= 0) {
      setAdditionError('항목명과 0보다 큰 금액을 입력해 주세요.');
      return;
    }
    setAdditionError(null);
    saveExpenses([...rows, { name: name.trim(), amount: value, memo: memo.trim() || undefined }], () => {
      setAddition(null); setName(''); setAmount(''); setMemo(''); setToast('지출을 추가했어요.');
    });
  };

  const remove = (index: number) => {
    if (!canEdit || !day.data || pending || !deletion) return;
    if (deletion.date !== from || deletion.revision !== day.data.revision || rows[index]?.name !== deletion.name) {
      setDeletion(null);
      setToast('내역이 변경됐어요. 최신 목록에서 삭제할 항목을 다시 선택해 주세요.');
      return;
    }
    setDeletion(null);
    if (day.data.dayStatus === 'closed') {
      saveExpenses(rows.filter((_, i) => i !== index), () => setToast('지출을 삭제했어요.'));
      return;
    }
    const items = day.data.items
      .filter((it) => it.recipeId)
      .map((it) => ({ recipeId: it.recipeId as string, qtyHall: it.qtyHall, qtyDelivery: it.qtyDelivery, qtyTakeout: it.qtyTakeout, qtyWaste: it.qtyWaste }));
    /*
     * ⚠ 판본을 실어 보낸다(0117). 이 화면도 `extra_items` 를 **배열 통째로** 교체하므로,
     *   빼먹으면 다른 기기가 방금 넣은 지출이 조용히 사라진다.
     *   저장하는 곳이 여럿인데 한 곳만 빠져도 그 문으로 뚫린다.
     */
    saveSale.mutate(
      { date: from, items, extraItems: rows.filter((_, i) => i !== index), baseRevision: day.data.revision },
      {
        onError: (e) => {
          /*
           * ⚠ 매출 홈과 **같게** 다룬다. 판본만 보내고 45009 를 기본 오류창으로 띄우면
           *   데이터는 지켜지지만 사장님은 무슨 일인지 모르고, 낡은 목록을 계속 보며
           *   같은 삭제를 반복하게 된다. 다시 받아서 최신 목록을 보여 줘야 끝난다.
           */
          if (isRevisionConflict(e)) {
            void day.refetch();
            setToast('다른 기기에서 판매 내역이 변경됐어요 · 최신 내역을 다시 불러왔어요');
            return;
          }
          Alert.alert('삭제하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요');
        },
      },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="추가 지출" onBack={() => safeBack(`/sales/day?date=${to}`)}
        right={isOneDay ? <Button kind="ghost" disabled={!canEdit || pending}
          onPress={() => { if (day.data) { setAdditionError(null); setAddition({ date: from, revision: day.data.revision }); } }}>지출 추가</Button> : undefined} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: LAYOUT.scroll.start, paddingBottom: LAYOUT.scroll.end }}>
        <Card pad={0} style={{ overflow: 'hidden', marginBottom: space.md }}>
          <DetailSummary rows={[['영업일', rangeLabel(from, to)]]} />
        </Card>

        <QueryState
          isLoading={isOneDay ? day.isLoading : range.isLoading}
          error={isOneDay ? day.error : range.error}
          isEmpty={total === 0}
          onRetry={() => { void day.refetch(); void range.refetch(); }}
          emptyTitle="기록된 추가 지출이 없어요"
          emptyHint={canEdit ? '상단의 ‘지출 추가’로 등록할 수 있어요' : '영업일을 선택하고 영업을 시작한 뒤 추가할 수 있어요'}
        >
          <Card onLine pad={0} style={{ overflow: 'hidden' }}>
            <View style={{ paddingHorizontal: space.md, paddingBottom: space.md }}>
              {rows.map((r, i) => (
                <View key={`${r.name}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{r.name}</Text>
                    {r.memo ? <Text style={{ fontSize: 14, color: COLOR.text.tertiary, fontWeight: '600', marginTop: space.xs }}>{r.memo}</Text> : null}
                  </View>
                  <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink, marginRight: 12 }, NUM]}>{won(r.amount)}원</Text>
                  <Pressable disabled={pending || !canEdit}
                    onPress={() => setDeletion({ index: i, date: from, revision: day.data?.revision, name: r.name })}
                    hitSlop={8} accessibilityRole="button" accessibilityLabel={`${r.name} 삭제`}>
                    <Icon name="close" size={16} color={COLOR.text.tertiary} />
                  </Pressable>
                </View>
              ))}
              {!isOneDay ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>기간 합계</Text>
                  <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(total)}원</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: T.line }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink2 }}>합계</Text>
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(total)}원</Text>
                </View>
              )}
            </View>
          </Card>
        </QueryState>

      </ScrollView>
      <Sheet visible={addition !== null} title="지출 추가" onClose={() => { if (!pending) setAddition(null); }}>
        <Field variant="stacked" label="항목명" req><Input variant="stacked" disabled={pending} value={name} onChangeText={setName} placeholder="예: 얼음·소모품" /></Field>
        <Field variant="stacked" label="금액" req><Input variant="stacked" disabled={pending} value={amount} onChangeText={setAmount} placeholder="15000" keyboardType="decimal-pad" suffix="원" mono /></Field>
        <Field variant="stacked" label="메모 (선택)"><Input variant="stacked" disabled={pending} value={memo} onChangeText={setMemo} placeholder="간단 메모" /></Field>
        {additionError ? <Text accessibilityRole="alert" accessibilityLiveRegion="assertive"
          style={{ color: COLOR.status.negative, marginBottom: space.md }}>{additionError}</Text> : null}
        <Text style={{ color: COLOR.text.secondary, marginBottom: space.md }}>그날 손익에만 반영되며 고정 지출은 바뀌지 않아요.</Text>
        <Button kind="primary" full loading={pending} disabled={!canEdit || !name.trim() || !amount.trim()} onPress={add}>추가</Button>
      </Sheet>
      <ConfirmDialog visible={deletion !== null} title="지출을 삭제할까요?"
        message={deletion ? `${deletion.name} 지출을 삭제합니다.` : undefined}
        loading={pending} onCancel={() => setDeletion(null)}
        onConfirm={() => { if (deletion) remove(deletion.index); }} />
          {/*
        다른 기기가 먼저 저장했다(45009 · 0117). 최신 목록은 이미 다시 받고 있으므로
        사장님이 누를 것이 없다 — 모달로 세우지 않고 짧게만 알린다. 매출 홈과 같은 모양이다.
      */}
      {toast ? (
        <Pressable
          onPress={() => setToast(null)}
          accessibilityRole="button" accessibilityLabel="알림 닫기"
          style={{ position: 'absolute', left: 16, right: 16, bottom: 24, paddingVertical: space.md, paddingHorizontal: space.md, borderRadius: 12, backgroundColor: 'rgba(25,31,40,0.92)' }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff', lineHeight: TYPE.caption.lineHeight }}>{toast}</Text>
        </Pressable>
      ) : null}
</View>
  );
}

/**
 * ING-10 폐기 내역 — 로스율 카드의 드릴다운.
 *
 * 왜 탭으로 가르나: 두 폐기는 사장님이 할 일이 다르다.
 *   조리 전 폐기가 많다 → 발주를 줄이거나 보관을 손봐야 한다
 *   조리 후 폐기가 많다 → 덜 만들어야 한다
 * 한 숫자로 뭉치면 어느 쪽을 손봐야 할지 알 수 없다.
 *
 * 되돌리기 규칙도 다르다. 조리 전 폐기는 여기서 취소할 수 있지만, 조리 후 폐기는
 * **매출 기록이 주인**이라 그 날 매출에서 고쳐야 한다(0042). 탭으로 갈라두면
 * "왜 어떤 건 되고 어떤 건 안 되지?"가 자연스럽게 설명된다.
 */
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Badge, Card, Icon, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { formatQuantity } from '@sikjae/core';
import { T, tnum, won } from '@/theme/tokens';
import { dispUnit } from '../ledger';
import { useIngredientDetail, useRevertDiscard, useStockHistory, type LedgerEntry } from '../hooks';

type Tab = '전체' | '조리 전 폐기' | '조리 후 폐기';
const TABS: Tab[] = ['전체', '조리 전 폐기', '조리 후 폐기'];

export default function DiscardHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('전체');

  const detail = useIngredientDetail(id);
  const history = useStockHistory(id);
  const revertDiscard = useRevertDiscard(id ?? '');

  const g = detail.data;
  const unit = dispUnit(g?.baseUnit ?? 'g');
  const price = g?.basePrice ?? null;

  /** 폐기만 추린다. 되돌려진 것도 보여주되 취소선으로 표시한다 — 원장은 지우지 않는다. */
  const discards = useMemo(
    () => (history.data ?? []).filter((e) => e.type === 'discard'),
    [history.data],
  );

  const shown = useMemo(() => {
    if (tab === '조리 전 폐기') return discards.filter((e) => !e.waste);
    if (tab === '조리 후 폐기') return discards.filter((e) => e.waste);
    return discards;
  }, [discards, tab]);

  /** 탭별 합계 — 되돌린 건 뺀다. 로스율 카드와 같은 규칙이어야 숫자가 맞는다. */
  const sum = (rows: LedgerEntry[]) =>
    rows.filter((e) => !e.reverted).reduce((a, e) => a + Math.abs(e.countDelta), 0);

  const shownAmount = sum(shown);
  const shownCost = price === null ? null : shownAmount * price;

  const confirmRevert = (e: LedgerEntry) => {
    if (e.reverted) return;
    if (e.waste) {
      Alert.alert('조리 후 폐기는 여기서 못 고쳐요', '만들어 놓고 못 판 몫이라 그 날 매출에서 수량을 고쳐 주세요.');
      return;
    }
    Alert.alert(
      '폐기 취소',
      `${formatQuantity(Math.abs(e.countDelta), unit)} 폐기를 되돌려요. 재고가 폐기 전으로 돌아가고 로스율에서도 빠집니다.`,
      [
        { text: '닫기', style: 'cancel' },
        {
          text: '폐기 취소',
          style: 'destructive',
          onPress: () =>
            revertDiscard.mutate(
              { eventId: e.id },
              {
                onError: (err) =>
                  Alert.alert('되돌리지 못했어요', err instanceof Error ? err.message : '잠시 후 다시 시도해 주세요'),
              },
            ),
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="폐기 내역" onBack={() => safeBack(`/ingredients/${id}`)} />

      {/* 탭 — 밑줄형, 좌측 정렬 */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: T.line2, backgroundColor: T.surface }}>
        {TABS.map((k) => {
          const on = k === tab;
          const n = k === '전체' ? discards.length : discards.filter((e) => (k === '조리 후 폐기' ? e.waste : !e.waste)).length;
          return (
            <Pressable
              key={k}
              onPress={() => setTab(k)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${k} ${n}건`}
              style={{ paddingVertical: 13, paddingHorizontal: 12, borderBottomWidth: 2, borderBottomColor: on ? T.ink : 'transparent' }}
            >
              <Text style={{ fontSize: 15, fontWeight: on ? '800' : '600', color: on ? T.ink : T.sub2 }}>
                {k}{n > 0 ? ` ${n}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 11 }}>
        <QueryState
          isLoading={history.isLoading}
          error={history.error}
          isEmpty={shown.length === 0}
          onRetry={() => void history.refetch()}
          emptyTitle={tab === '전체' ? '아직 폐기 기록이 없어요' : `${tab} 기록이 없어요`}
          emptyHint={
            tab === '조리 후 폐기'
              ? '매출 등록에서 못 판 수량을 적으면 여기 쌓여요'
              : '식재료 상세에서 남은 양을 고치면 폐기로 기록돼요'
          }
        >
          {/* 선택한 탭의 합계 */}
          <Card pad={14}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.sub }}>{tab} 합계</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[{ fontSize: 18, fontWeight: '800', color: T.ink }, tnum]}>
                  {formatQuantity(shownAmount, unit)}
                </Text>
                <Text style={[{ fontSize: 14, color: T.ter, marginTop: 2 }, tnum]}>
                  {shownCost === null ? '단가 산출 전' : `${won(Math.round(shownCost))}원`}
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 14, color: T.ter, lineHeight: 20, marginTop: 8 }}>
              {tab === '조리 후 폐기'
                ? '만들어 놓고 못 판 몫이에요. 자주 남으면 만드는 양을 줄여 보세요.'
                : tab === '조리 전 폐기'
                  ? '쓰기도 전에 상한 몫이에요. 자주 생기면 한 번에 사는 양을 줄여 보세요.'
                  : '되돌린 폐기는 합계에서 빠져요.'}
            </Text>
          </Card>

          {shown.map((e) => (
            <Card key={e.id} pad={0} style={{ overflow: 'hidden', opacity: e.reverted ? 0.5 : 1 }}>
              <Pressable
                onPress={() => confirmRevert(e)}
                accessibilityRole="button"
                accessibilityLabel={`${e.date} ${e.waste ? '조리 후' : '조리 전'} 폐기 ${formatQuantity(Math.abs(e.countDelta), unit)}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 15 }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[{ fontSize: 14, color: T.ter, fontWeight: '600' }, tnum]}>
                      {e.date.slice(5).replace('-', '/')}
                    </Text>
                    <Badge tone={e.waste ? 'amber' : 'neutral'} sm>
                      {e.waste ? '조리 후' : '조리 전'}
                    </Badge>
                    {e.reverted ? <Badge tone="neutral" sm>취소됨</Badge> : null}
                  </View>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink, marginTop: 3 }} numberOfLines={1}>
                    {e.note ?? (e.waste ? '조리 후 폐기' : '조리 전 폐기')}
                  </Text>
                  {!e.reverted && !e.waste ? (
                    <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>탭하면 폐기를 되돌려요</Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: T.red }, tnum]}>
                    −{formatQuantity(Math.abs(e.countDelta), unit)}
                  </Text>
                  {price !== null ? (
                    <Text style={[{ fontSize: 14, color: T.sub2, marginTop: 2 }, tnum]}>
                      {won(Math.round(Math.abs(e.countDelta) * price))}원
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            </Card>
          ))}

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: 2, marginTop: 2 }}>
            <Icon name="info" size={15} color={T.ter} />
            <Text style={{ flex: 1, fontSize: 14, color: T.ter, lineHeight: 20 }}>
              버린 금액은 원가에 얹히지 않고 <Text style={{ fontWeight: '700' }}>월 손익의 폐기 손실</Text>로 잡혀요.
            </Text>
          </View>
        </QueryState>
      </ScrollView>
    </View>
  );
}

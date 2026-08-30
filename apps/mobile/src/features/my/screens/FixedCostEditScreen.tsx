/**
 * MY-05b 고정 지출 수정 — 월 매출과 항목을 입력하고 저장하면 E4 가 돈다.
 *
 * 저장 한 번이 **모든 메뉴의 손익**을 다시 계산한다(고정지출률이 바뀌므로).
 * 이전 구현은 입력칸 4개가 `onChangeText` 없이 값만 그려 타이핑이 되지 않았고,
 * 저장 버튼은 화면만 닫았다. 여기서는 실제로 입력되고 저장된다.
 */
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Button, Card, Field, Icon, Input, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { formatPercent } from '@margincook/core';
import { useStoreLocalDate } from '@/features/business-day/businessDay';
import { BusinessDateGate } from '@/features/business-day/components/BusinessDateGate';
import { T, won } from '@/theme/tokens';
import { clampDecimals } from '@/lib/num';
import { useFixedCosts, useRevenueCheck, useSaveFixedCosts, type ChannelWeights, type FixedCostItem } from '../hooks';
import { RevenueGapCard } from '../components/RevenueGapCard';
import { ChannelWeightSheet } from '../components/ChannelWeightSheet';

const NUM = { fontVariant: ['tabular-nums' as const] };

const LABEL: Record<string, string> = {
  labor: '인건비', rent: '임대료', utility: '공과금', commission: '플랫폼 수수료',
  packing: '포장비', delivery: '배달/배송', ads: '광고/홍보', etc: '기타',
};
/** 처음 등록할 때 보여줄 기본 항목. 빈 화면보다 채워진 틀이 입력을 시작하게 한다. */
const DEFAULT_KEYS = ['labor', 'rent', 'utility', 'commission', 'packing', 'delivery', 'ads'];

/** 채널 코드 -> 표기. 시트와 같은 문구를 써야 한 화면에서 두 이름이 보이지 않는다. */
const CH_LABEL: Record<string, string> = { hall: '매장', delivery: '배달', takeout: '포장' };

const num = (s: string) => {
  const n = parseFloat(String(s).replace(/,/g, ''));
  return Number.isNaN(n) ? 0 : n;
};

interface DraftLine { name: string; amount: string }
interface DraftItem { key: string; label: string; mode: 'total' | 'detail'; total: string; lines: DraftLine[]; weights: ChannelWeights | null }

/**
 * ⚠ 경로에 월이 없으면 **서버 월**을 쓴다(0126). 기기 시계로 만든 이번 달이 아니다 —
 *   서버가 8월 장부를 보는데 여기서 9월을 저장하면 그 달 고정지출률이 통째로 어긋나고,
 *   저장 한 번이 전 메뉴 손익을 다시 계산하므로 되돌리기도 어렵다.
 */
export default function FixedCostEditScreen() {
  return (
    <BusinessDateGate source={useStoreLocalDate()} title="고정 지출 수정" onBack={() => safeBack('/recipes/fixed-cost')}>
      {(localDate) => <FixedCostEditScreenBody localMonth={localDate.slice(0, 7)} />}
    </BusinessDateGate>
  );
}

function FixedCostEditScreenBody({ localMonth }: { localMonth: string }) {
  const params = useLocalSearchParams<{ month?: string }>();
  const month = params.month ?? localMonth;

  const fixed = useFixedCosts(month);
  const check = useRevenueCheck(month);
  const save = useSaveFixedCosts();

  const [revenue, setRevenue] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [weightFor, setWeightFor] = useState<number | null>(null);

  useEffect(() => {
    if (loaded || fixed.isLoading) return;
    const d = fixed.data;
    setRevenue(d && d.totalRevenue > 0 ? String(d.totalRevenue) : '');
    const existing = d?.items ?? [];
    const base: DraftItem[] = existing.length > 0
      ? existing.map((i) => ({
          key: i.key,
          label: LABEL[i.key] ?? i.key,
          mode: i.mode,
          total: String(i.total),
          lines: i.lines.map((l) => ({ name: l.name, amount: String(l.amount) })),
          weights: i.weights,
        }))
      : DEFAULT_KEYS.map((k) => ({ key: k, label: LABEL[k] ?? k, mode: 'total' as const, total: '', lines: [], weights: null }));
    setItems(base);
    setLoaded(true);
  }, [fixed.data, fixed.isLoading, loaded]);

  const itemTotal = (it: DraftItem) =>
    it.mode === 'detail' ? it.lines.reduce((a, l) => a + num(l.amount), 0) : num(it.total);

  const sum = items.reduce((a, i) => a + itemTotal(i), 0);
  const rev = num(revenue);
  const rate = rev > 0 ? sum / rev : null;

  const patchItem = (index: number, next: Partial<DraftItem>) =>
    setItems((xs) => xs.map((it, i) => (i === index ? { ...it, ...next } : it)));

  const addLine = (index: number) =>
    setItems((xs) => xs.map((it, i) => (i === index ? { ...it, mode: 'detail', lines: [...it.lines, { name: '', amount: '' }] } : it)));

  const patchLine = (index: number, li: number, next: Partial<DraftLine>) =>
    setItems((xs) => xs.map((it, i) => (i === index ? { ...it, lines: it.lines.map((l, j) => (j === li ? { ...l, ...next } : l)) } : it)));

  const removeLine = (index: number, li: number) =>
    setItems((xs) => xs.map((it, i) => {
      if (i !== index) return it;
      const lines = it.lines.filter((_, j) => j !== li);
      return { ...it, lines, mode: lines.length === 0 ? 'total' : 'detail' };
    }));

  const addItem = () =>
    setItems((xs) => [...xs, { key: `etc_${xs.length}`, label: '', mode: 'total', total: '', lines: [], weights: null }]);

  const removeItem = (index: number) => setItems((xs) => xs.filter((_, i) => i !== index));

  const revenueError = revenue !== '' && rev <= 0 ? '월 매출은 0보다 커야 해요' : undefined;
  const canSave = rev > 0 && !save.isPending;

  const onSave = () => {
    if (!canSave) return;
    const payload: FixedCostItem[] = items
      .filter((it) => itemTotal(it) > 0)
      .map((it) => ({
        key: it.key,
        mode: it.mode,
        total: itemTotal(it),
        lines: it.lines
          .filter((l) => num(l.amount) > 0)
          .map((l) => ({ name: l.name.trim() || '항목', amount: num(l.amount) })),
        weights: it.weights,
      }));

    save.mutate(
      { month, totalRevenue: rev, items: payload },
      {
        onSuccess: () => safeBack('/recipes/fixed-cost'),
        onError: (e) => Alert.alert('저장하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
      },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title={`${Number(month.slice(5))}월 고정 지출 수정`} onBack={() => safeBack('/recipes/fixed-cost')} />

      <QueryState
        isLoading={fixed.isLoading}
        error={fixed.error}
        isEmpty={false}
        onRetry={() => void fixed.refetch()}
        emptyTitle=""
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24, gap: 12 }}>
          <Card pad={16}>
            <Field label="총 월매출" req error={revenueError} hint="고정지출률의 분모예요">
              <Input
                value={revenue}
                onChangeText={(t) => setRevenue(clampDecimals(t, 0))}
                placeholder="0"
                suffix="원"
                mono
                keyboardType="number-pad"
                error={Boolean(revenueError)}
                accessibilityLabel="총 월매출"
              />
            </Field>
          </Card>

          {/* 실제 매출과 비교 — 채우기는 사장님이 누를 때만 반영된다(자동 덮어쓰기 금지). */}
          {check.data ? (
            <RevenueGapCard check={check.data} onApply={(next) => setRevenue(String(next))} />
          ) : null}

          {items.map((it, si) => (
            <Card key={`${it.key}-${si}`} pad={0} style={{ overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                <View style={{ flex: 1 }}>
                  {LABEL[it.key] ? (
                    <Text style={{ fontSize: 16, fontWeight: '800', color: T.sub }}>{LABEL[it.key]}</Text>
                  ) : (
                    <Input value={it.label} onChangeText={(t) => patchItem(si, { label: t })} placeholder="항목 이름" accessibilityLabel="항목 이름" />
                  )}
                </View>
                <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub2 }, NUM]}>
                  {rev > 0 ? `${((itemTotal(it) / rev) * 100).toFixed(1)}%` : '—'}
                </Text>
                <Pressable onPress={() => removeItem(si)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${LABEL[it.key] ?? it.label} 삭제`} style={{ width: 32, alignItems: 'center' }}>
                  <Icon name="close" size={18} color={T.ter} />
                </Pressable>
              </View>

              <View style={{ padding: 14, gap: 9 }}>
                {/* 채널 배분 — 수수료는 배달에만 드는 식으로 항목마다 다르다. */}
                <Pressable
                  onPress={() => setWeightFor(si)}
                  accessibilityRole="button"
                  accessibilityLabel={`${LABEL[it.key] ?? it.label} 채널 비중`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, backgroundColor: T.surface2 }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub2 }}>채널 배분</Text>
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: it.weights ? T.blue : T.ter }} numberOfLines={1}>
                    {it.weights
                      ? Object.entries(it.weights).filter(([, v]) => v > 0).map(([k, v]) => `${CH_LABEL[k] ?? k} ${v}%`).join(' · ')
                      : '매출 비중으로 자동'}
                  </Text>
                  <Icon name="chevron" size={15} color={T.line3} />
                </Pressable>
                {it.mode === 'total' ? (
                  <Input
                    value={it.total}
                    onChangeText={(t) => patchItem(si, { total: clampDecimals(t, 0) })}
                    placeholder="0"
                    suffix="원"
                    mono
                    keyboardType="number-pad"
                    accessibilityLabel={`${LABEL[it.key] ?? it.label} 금액`}
                  />
                ) : (
                  it.lines.map((l, li) => (
                    <View key={li} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ flex: 1.4 }}>
                        <Input value={l.name} onChangeText={(t) => patchLine(si, li, { name: t })} placeholder="항목명" accessibilityLabel="세부 항목명" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Input value={l.amount} onChangeText={(t) => patchLine(si, li, { amount: clampDecimals(t, 0) })} placeholder="금액" suffix="원" mono keyboardType="number-pad" accessibilityLabel="세부 항목 금액" />
                      </View>
                      <Pressable onPress={() => removeLine(si, li)} hitSlop={6} accessibilityRole="button" accessibilityLabel="세부 항목 삭제" style={{ width: 32, alignItems: 'center' }}>
                        <Icon name="close" size={18} color={T.ter} />
                      </Pressable>
                    </View>
                  ))
                )}

                <Pressable
                  onPress={() => addLine(si)}
                  accessibilityRole="button" accessibilityLabel="세부 항목 추가"
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: T.line }}
                >
                  <Icon name="plus" size={16} color={T.sub2} sw={2.2} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub2 }}>세부 항목 추가</Text>
                </Pressable>

                {it.mode === 'detail' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 6 }}>
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: T.sub2 }}>소계</Text>
                    <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(itemTotal(it))}원</Text>
                  </View>
                ) : null}
              </View>
            </Card>
          ))}

          <Pressable
            onPress={addItem}
            accessibilityRole="button" accessibilityLabel="항목 추가"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 15, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: T.blue, backgroundColor: T.blueTint }}
          >
            <Icon name="plus" size={18} color={T.blue} sw={2.2} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue }}>항목 추가</Text>
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: T.amberTint }}>
            <Icon name="info" size={15} color={T.amberText} />
            <Text style={{ flex: 1, fontSize: 14, color: T.amberText, lineHeight: 20 }}>
              저장하면 이 달 <Text style={{ fontWeight: '700' }}>모든 메뉴의 손익</Text>이 다시 계산돼요.
            </Text>
          </View>
        </ScrollView>
      </QueryState>

      <ChannelWeightSheet
        visible={weightFor !== null}
        onClose={() => setWeightFor(null)}
        title={weightFor !== null ? (LABEL[items[weightFor]?.key ?? ''] ?? items[weightFor]?.label) : undefined}
        value={weightFor !== null ? (items[weightFor]?.weights ?? null) : null}
        onApply={(next) => {
          if (weightFor !== null) patchItem(weightFor, { weights: next });
          setWeightFor(null);
        }}
      />

      <View style={{ paddingHorizontal: 20, paddingTop: 11, paddingBottom: 30, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 11 }}>
          <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.sub2 }}>고정지출률</Text>
          <Text style={[{ fontSize: 18, fontWeight: '800', color: T.ink, marginRight: 8 }, NUM]}>{won(sum)}원</Text>
          <Text style={[{ fontSize: 16, fontWeight: '800', color: rate === null ? T.ter : T.blue }, NUM]}>
            {rate === null ? '—' : formatPercent(rate)}
          </Text>
        </View>
        <Button kind="primary" size="lg" full disabled={!canSave} loading={save.isPending} onPress={onSave}>저장</Button>
      </View>
    </View>
  );
}

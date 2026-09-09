/**
 * MY-05b 고정 지출 수정 — 월 매출과 항목을 입력하고 저장하면 E4 가 돈다.
 *
 * 저장 한 번이 **모든 메뉴의 손익**을 다시 계산한다(고정지출률이 바뀌므로).
 * 이전 구현은 입력칸 4개가 `onChangeText` 없이 값만 그려 타이핑이 되지 않았고,
 * 저장 버튼은 화면만 닫았다. 여기서는 실제로 입력되고 저장된다.
 */
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Button, Card, Field, Icon, Input, QueryState, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { formatPercent } from '@margincook/core';
import { useStoreLocalDate } from '@/features/business-day/businessDay';
import { BusinessDateGate } from '@/features/business-day/components/BusinessDateGate';
import { LAYOUT, COLOR, T, won, TYPE, radius, space } from '@/theme/tokens';
import { clampDecimals } from '@/lib/num';
import { useFixedCosts, useRevenueCheck, useSaveFixedCosts, type ChannelWeights, type FixedCostItem } from '../hooks';
import { RevenueGapCard } from '../components/RevenueGapCard';
import { ChannelWeightSheet } from '../components/ChannelWeightSheet';
import { FixedMonthPicker } from '../components/FixedMonthPicker';
import { ConfirmDialog } from '@/components/kit/ConfirmDialog';

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
  const [month, setMonth] = useState(params.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month) ? params.month : localMonth);
  return <FixedCostEditor key={month} month={month} localMonth={localMonth} onChangeMonth={setMonth} />;
}

function FixedCostEditor({ month, localMonth, onChangeMonth }: {
  month: string; localMonth: string; onChangeMonth: (month: string) => void;
}) {

  const fixed = useFixedCosts(month);
  const check = useRevenueCheck(month);
  const save = useSaveFixedCosts();
  const saveBusy = useRef(false);

  const [revenue, setRevenue] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [originalDraft, setOriginalDraft] = useState('');
  const [pendingMonth, setPendingMonth] = useState<string | null>(null);
  const [weightFor, setWeightFor] = useState<number | null>(null);
  const [lineEditor, setLineEditor] = useState<{ item: number | null; line: number | null } | null>(null);
  const [groupDraft, setGroupDraft] = useState('');
  const [lineNameDraft, setLineNameDraft] = useState('');
  const [lineAmountDraft, setLineAmountDraft] = useState('');

  useEffect(() => {
    if (loaded || fixed.isLoading || fixed.error) return;
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
    setOriginalDraft(JSON.stringify({ revenue: d && d.totalRevenue > 0 ? String(d.totalRevenue) : '', items: base }));
    setLoaded(true);
  }, [fixed.data, fixed.isLoading, fixed.error, loaded]);

  const itemTotal = (it: DraftItem) =>
    it.mode === 'detail' ? it.lines.reduce((a, l) => a + num(l.amount), 0) : num(it.total);

  const sum = items.reduce((a, i) => a + itemTotal(i), 0);
  const rev = num(revenue);
  const rate = rev > 0 ? sum / rev : null;

  const patchItem = (index: number, next: Partial<DraftItem>) =>
    setItems((xs) => xs.map((it, i) => (i === index ? { ...it, ...next } : it)));

  const openLineEditor = (item: number | null, line: number | null = null) => {
    const group = item === null ? undefined : items[item];
    const current = line === null ? undefined : group?.lines[line];
    setGroupDraft(group?.label ?? ''); setLineNameDraft(current?.name ?? '');
    setLineAmountDraft(current?.amount ?? ''); setLineEditor({ item, line });
  };
  const groupName = groupDraft.trim();
  const duplicateGroup = lineEditor?.item === null && items.some((item) => item.label === groupName || item.key === groupName);
  const canApplyLine = Boolean(groupName && lineNameDraft.trim() && num(lineAmountDraft) > 0 && !duplicateGroup);
  const applyLine = () => {
    if (!lineEditor || !canApplyLine) return;
    const line = { name: lineNameDraft.trim(), amount: String(num(lineAmountDraft)) };
    if (lineEditor.item === null) {
      // The RPC persists the key as the custom display name; it has no separate label column.
      const key = Object.keys(LABEL).find((key) => LABEL[key] === groupName) ?? groupName;
      setItems((current) => [...current, { key, label: groupName, mode: 'detail', total: line.amount, lines: [line], weights: null }]);
    } else {
      setItems((current) => current.map((item, index) => {
        if (index !== lineEditor.item) return item;
        const existing = item.mode === 'total' && num(item.total) > 0 ? [{ name: '기존 합계', amount: item.total }] : item.lines;
        const lines = lineEditor.line === null ? [...existing, line] : existing.map((old, i) => i === lineEditor.line ? line : old);
        return { ...item, mode: 'detail', lines };
      }));
    }
    setLineEditor(null);
  };

  const removeLine = (index: number, li: number) =>
    setItems((xs) => xs.map((it, i) => {
      if (i !== index) return it;
      const lines = it.lines.filter((_, j) => j !== li);
      return { ...it, lines, total: lines.length === 0 ? '' : it.total, mode: lines.length === 0 ? 'total' : 'detail' };
    }));

  const addItem = () => openLineEditor(null);

  const removeItem = (index: number) => setItems((xs) => xs.filter((_, i) => i !== index));

  const revenueError = revenue !== '' && rev <= 0 ? '월 매출은 0보다 커야 해요' : undefined;
  const savedKey = (item: DraftItem) => LABEL[item.key] ? item.key : item.label.trim() || item.key;
  const uniqueKeys = new Set(items.map(savedKey)).size === items.length;
  const canSave = loaded && !fixed.error && !fixed.isLoading && Number.isFinite(rev) && rev > 0 && uniqueKeys && !save.isPending;
  const dirty = loaded && JSON.stringify({ revenue, items }) !== originalDraft;

  const onSave = () => {
    if (!canSave || saveBusy.current) return;
    saveBusy.current = true;
    const payload: FixedCostItem[] = items
      .filter((it) => itemTotal(it) > 0)
      .map((it) => ({
        key: savedKey(it),
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
        onError: (e) => { saveBusy.current = false; Alert.alert('저장하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'); },
      },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title={`${Number(month.slice(5))}월 고정 지출 수정`} onBack={() => safeBack('/recipes/fixed-cost')} />
      <FixedMonthPicker value={month} localMonth={localMonth} disabled={save.isPending}
        onChange={(next) => { if (saveBusy.current) return; if (dirty) setPendingMonth(next); else onChangeMonth(next); }} />

      <QueryState
        isLoading={fixed.isLoading}
        error={fixed.error}
        isEmpty={false}
        onRetry={() => void fixed.refetch()}
        emptyTitle=""
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24, gap: 12 }}>
            <Field label="총 월매출" req error={revenueError} variant="stacked">
              <Input
                value={revenue}
                onChangeText={(t) => setRevenue(clampDecimals(t, 0))}
                placeholder="0"
                suffix="원"
                mono
                variant="stacked"
                keyboardType="number-pad"
                error={Boolean(revenueError)}
                accessibilityLabel="총 월매출"
              />
            </Field>

          {/* 실제 매출과 비교 — 채우기는 사장님이 누를 때만 반영된다(자동 덮어쓰기 금지). */}
          {check.data ? (
            <RevenueGapCard check={check.data} onApply={(next) => setRevenue(String(next))} />
          ) : null}

          {items.map((it, si) => (
            <Card key={`${it.key}-${si}`} pad={0} style={{ overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: space.md, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                <View style={{ flexShrink: 1 }}>
                  {LABEL[it.key] ? (
                    <Text style={{ fontSize: 16, fontWeight: '800', color: T.sub }}>{LABEL[it.key]}</Text>
                  ) : (
                    <Input value={it.label} onChangeText={(t) => patchItem(si, { label: t })} placeholder="항목 이름" accessibilityLabel="항목 이름" />
                  )}
                </View>
                <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub2 }, NUM]}>
                  {rev > 0 ? `${((itemTotal(it) / rev) * 100).toFixed(1)}%` : '—'}
                </Text>
                <Pressable onPress={() => removeItem(si)} accessibilityRole="button" accessibilityLabel={`${LABEL[it.key] ?? it.label} 삭제`} style={{ marginLeft: 'auto', width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="close" size={18} color={COLOR.text.tertiary} />
                </Pressable>
              </View>

              <View style={{ padding: space.md, gap: space.sm }}>
                {/* 채널 배분 — 수수료는 배달에만 드는 식으로 항목마다 다르다. */}
                <Pressable
                  onPress={() => setWeightFor(si)}
                  accessibilityRole="button"
                  accessibilityLabel={`${LABEL[it.key] ?? it.label} 채널 비중`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: T.line2 }}
                >
                  <View style={{ flex: 1, gap: space.xs }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>채널 배분</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: COLOR.text.tertiary }}>
                    {it.weights
                      ? Object.entries(it.weights).filter(([, v]) => v > 0).map(([k, v]) => `${CH_LABEL[k] ?? k} ${v}%`).join(' · ')
                      : '매출 비중으로 자동'}
                  </Text>
                  </View>
                  <Icon name="chevron" size={15} color={T.line3} />
                </Pressable>
                {it.mode === 'total' ? (
                  <Input
                    value={it.total}
                    onChangeText={(t) => patchItem(si, { total: clampDecimals(t, 0) })}
                    placeholder="0"
                    suffix="원"
                    mono
                    variant="stacked"
                    keyboardType="number-pad"
                    accessibilityLabel={`${LABEL[it.key] ?? it.label} 금액`}
                  />
                ) : (
                  it.lines.map((l, li) => (
                    <View key={li} style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                      <Pressable accessibilityRole="button" accessibilityLabel={`${l.name} 세부 항목 수정`}
                        onPress={() => openLineEditor(si, li)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 60 }}>
                        <Text style={{ ...TYPE.body, fontWeight: '600', color: T.ink, flex: 1 }}>{l.name}</Text>
                        <Text style={{ ...TYPE.body, fontWeight: '700', color: T.ink, textAlign: 'right', ...NUM }}>{won(num(l.amount))}원</Text>
                      </Pressable>
                      <Pressable onPress={() => removeLine(si, li)} accessibilityRole="button" accessibilityLabel={`${l.name} 세부 항목 삭제`} style={{ width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="close" size={18} color={COLOR.text.tertiary} />
                      </Pressable>
                    </View>
                  ))
                )}

                <Pressable
                  onPress={() => openLineEditor(si)}
                  accessibilityRole="button" accessibilityLabel="세부 항목 추가"
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, paddingVertical: space.md, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: T.line }}
                >
                  <Icon name="plus" size={16} color={T.sub2} sw={2.2} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub2 }}>세부 항목 추가</Text>
                </Pressable>

                {it.mode === 'detail' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: space.sm }}>
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
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, paddingVertical: space.md, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: COLOR.action.primary, backgroundColor: COLOR.action.primaryTint }}
          >
            <Icon name="plus" size={18} color={COLOR.action.primary} sw={2.2} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: COLOR.text.link }}>항목 추가</Text>
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: 12, paddingHorizontal: space.md, borderRadius: 12, backgroundColor: COLOR.status.cautionTint }}>
            <Icon name="info" size={15} color={COLOR.status.caution} />
            <Text style={{ flex: 1, fontSize: 14, color: COLOR.status.caution, lineHeight: TYPE.caption.lineHeight }}>
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
      <Sheet visible={lineEditor !== null} onClose={() => setLineEditor(null)}
        title={lineEditor?.item === null ? '고정 지출 항목 추가' : lineEditor?.line === null ? '세부 항목 추가' : '세부 항목 수정'}>
        <Field label="항목명" req variant="stacked" error={duplicateGroup ? '같은 항목이 있어요. 기존 항목에 세부 항목을 추가해 주세요.' : undefined}>
          <Input value={groupDraft} onChangeText={setGroupDraft} disabled={lineEditor?.item !== null}
            placeholder="예) 임대료" accessibilityLabel="항목 이름" variant="stacked" />
        </Field>
        <Field label="세부 항목" req variant="stacked">
          <Input value={lineNameDraft} onChangeText={setLineNameDraft} placeholder="예) 월 임대료" accessibilityLabel="세부 항목명" variant="stacked" />
        </Field>
        <Field label="금액" req variant="stacked">
          <Input value={lineAmountDraft} onChangeText={(text) => setLineAmountDraft(clampDecimals(text, 0))}
            placeholder="0" suffix="원" mono variant="stacked" keyboardType="number-pad" accessibilityLabel="세부 항목 금액" />
        </Field>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
          <Button kind="gray" size="lg" full style={{ flex: 1 }} onPress={() => setLineEditor(null)}>취소</Button>
          <Button kind="primary" size="lg" full style={{ flex: 1 }} disabled={!canApplyLine} onPress={applyLine}>
            {lineEditor?.line == null ? '추가' : '적용'}
          </Button>
        </View>
      </Sheet>
      <ConfirmDialog visible={pendingMonth !== null} title="다른 달로 이동할까요?"
        message="저장하지 않은 변경 내용은 사라집니다." confirmText="이동"
        onCancel={() => setPendingMonth(null)} onConfirm={() => { if (pendingMonth) onChangeMonth(pendingMonth); }} />

      <View style={{ paddingHorizontal: 20, paddingTop: space.md, paddingBottom: LAYOUT.scroll.end, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        {!uniqueKeys ? <Text accessibilityRole="alert" style={{ ...TYPE.caption, color: COLOR.status.negative, marginBottom: space.sm }}>항목 이름이 중복됩니다.</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.md }}>
          <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.sub2 }}>고정지출률</Text>
          <Text style={[{ fontSize: 18, fontWeight: '800', color: T.ink, marginRight: 8 }, NUM]}>{won(sum)}원</Text>
          <Text style={[{ fontSize: 16, fontWeight: '800', color: rate === null ? COLOR.text.tertiary : COLOR.text.accent }, NUM]}>
            {rate === null ? '—' : formatPercent(rate)}
          </Text>
        </View>
        <Button kind="primary" size="lg" full disabled={!canSave} loading={save.isPending} onPress={onSave}>저장</Button>
      </View>
    </View>
  );
}

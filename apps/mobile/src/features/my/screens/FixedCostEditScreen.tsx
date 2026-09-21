/**
 * MY-05b 고정 지출 입력·수정.
 * 항목 구성은 설정 화면이 소유하고 이 화면은 선택 월의 매출·금액만 저장한다.
 */
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, Button, Card, Field, Icon, Input, QueryState, Select, Sheet } from '@/components/kit';
import { SelectionRow } from '@/components/kit/SelectionRow';
import { safeBack } from '@/lib/nav';
import { formatPercent } from '@costkeep/core';
import { useStoreLocalDate } from '@/features/business-day/businessDay';
import { BusinessDateGate } from '@/features/business-day/components/BusinessDateGate';
import { LAYOUT, COLOR, T, won, TYPE, space } from '@/theme/tokens';
import { clampDecimals } from '@/lib/num';
import {
  useFixedCostConfiguration,
  useFixedCosts,
  useCancelFixedCostReentry,
  useRevenueCheck,
  useSaveFixedCosts,
  type ChannelWeights,
  type FixedCostItem,
} from '../hooks';
import { FixedCostRateCard } from '../components/FixedCostRateCard';
import { CompletedMonthPicker, previousFixedMonths } from '../components/FixedMonthPicker';
import { ConfirmDialog } from '@/components/kit/ConfirmDialog';
import {
  RecipeDetailHeading,
  RecipeDetailSubtotal,
} from '@/features/recipes/components/RecipeDetailParts';

const NUM = { fontVariant: ['tabular-nums' as const] };

const LABEL: Record<string, string> = {
  labor: '인건비',
  rent: '임대료',
  utility: '공과금',
  commission: '플랫폼 수수료',
  packing: '포장비',
  delivery: '배달/배송',
  ads: '광고/홍보',
  etc: '기타',
};
const num = (s: string) => {
  const n = parseFloat(String(s).replace(/,/g, ''));
  return Number.isNaN(n) ? 0 : n;
};

interface DraftLine {
  name: string;
  amount: string;
}
interface DraftItem {
  key: string;
  label: string;
  mode: 'total' | 'detail';
  total: string;
  lines: DraftLine[];
  weights: ChannelWeights | null;
}

/**
 * ⚠ 경로에 월이 없으면 **서버 월**을 쓴다(0126). 기기 시계로 만든 이번 달이 아니다 —
 *   서버가 8월 장부를 보는데 여기서 9월을 저장하면 그 달 고정지출률이 통째로 어긋나고,
 *   저장 한 번이 전 메뉴 손익을 다시 계산하므로 되돌리기도 어렵다.
 */
export default function FixedCostEditScreen() {
  return (
    <BusinessDateGate
      source={useStoreLocalDate()}
      title="고정 지출 입력 / 수정"
      onBack={() => safeBack('/recipes/fixed-cost')}
    >
      {(localDate) => <FixedCostEditScreenBody localMonth={localDate.slice(0, 7)} />}
    </BusinessDateGate>
  );
}

function FixedCostEditScreenBody({ localMonth }: { localMonth: string }) {
  const params = useLocalSearchParams<{ month?: string; reentry?: string }>();
  const editableMonths = previousFixedMonths(localMonth);
  const defaultMonth = editableMonths[0] ?? localMonth;
  const [month, setMonth] = useState(
    params.month && editableMonths.includes(params.month) ? params.month : defaultMonth,
  );
  return (
    <FixedCostEditor key={month} month={month} localMonth={localMonth} onChangeMonth={setMonth} />
  );
}

function FixedCostEditor({
  month,
  localMonth,
  onChangeMonth,
}: {
  month: string;
  localMonth: string;
  onChangeMonth: (month: string) => void;
}) {
  const fixed = useFixedCosts(month);
  const check = useRevenueCheck(month);
  const configuration = useFixedCostConfiguration(month);
  const save = useSaveFixedCosts();
  const cancelReentry = useCancelFixedCostReentry();
  const router = useRouter();
  const saveBusy = useRef(false);

  const [revenue, setRevenue] = useState('');
  const [revenueSource, setRevenueSource] = useState<'manual' | 'sales'>('manual');
  const [revenueSourceOpen, setRevenueSourceOpen] = useState(false);
  const manualRevenueBackup = useRef<string | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [originalDraft, setOriginalDraft] = useState('');
  const [pendingMonth, setPendingMonth] = useState<string | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmCancelReentry, setConfirmCancelReentry] = useState(false);

  const reentry =
    configuration.data?.reentry?.active &&
    configuration.data.reentry.targetMonths.includes(month)
      ? configuration.data.reentry
      : null;

  useEffect(() => {
    if (loaded || fixed.isLoading || configuration.isLoading || fixed.error || configuration.error)
      return;
    const d = fixed.data;
    setRevenue(d && d.totalRevenue > 0 ? String(d.totalRevenue) : '');
    const existing = d?.items ?? [];
    const existingByKey = new Map(existing.map((item) => [item.key, item]));
    const source = reentry
      ? (configuration.data?.items ?? [])
      : existing.length > 0
        ? existing
        : (configuration.data?.items ?? []);
    const base: DraftItem[] = source.map((i) => {
      const previousItem = reentry ? existingByKey.get(i.key) : i;
      const previousTotal = previousItem?.total ?? 0;
      return {
        key: i.key,
        label: i.label ?? LABEL[i.key] ?? i.key,
        mode: i.mode,
        total: previousTotal > 0 ? String(previousTotal) : '',
        lines: i.lines.map((l) => {
          const previous = reentry
            ? previousItem?.lines.find((line) => line.name === l.name)?.amount
            : l.amount;
          return { name: l.name, amount: previous && previous > 0 ? String(previous) : '' };
        }),
        weights: i.weights,
      };
    });
    setItems(base);
    setOriginalDraft(
      JSON.stringify({
        revenue: d && d.totalRevenue > 0 ? String(d.totalRevenue) : '',
        items: base,
      }),
    );
    setLoaded(true);
  }, [
    fixed.data,
    fixed.isLoading,
    fixed.error,
    configuration.data,
    configuration.isLoading,
    configuration.error,
    reentry,
    loaded,
  ]);

  const itemTotal = (it: DraftItem) =>
    it.mode === 'detail' ? it.lines.reduce((a, l) => a + num(l.amount), 0) : num(it.total);

  const sum = items.reduce((a, i) => a + itemTotal(i), 0);
  const rev = num(revenue);
  const rate = rev > 0 ? sum / rev : null;
  const salesRevenue = Math.round(check.data?.actualRevenue ?? 0);
  const canUseSalesRevenue = Boolean(check.data?.hasSales && salesRevenue > 0);
  const useSalesRevenue = revenueSource === 'sales';

  const selectRevenueSource = (next: 'manual' | 'sales') => {
    if (next === revenueSource) {
      setRevenueSourceOpen(false);
      return;
    }
    if (next === 'manual') {
      setRevenue(manualRevenueBackup.current ?? '');
      manualRevenueBackup.current = null;
    } else {
      if (!canUseSalesRevenue) return;
      manualRevenueBackup.current = revenue;
      setRevenue(String(salesRevenue));
    }
    setRevenueSource(next);
    setRevenueSourceOpen(false);
  };

  const patchItem = (index: number, next: Partial<DraftItem>) =>
    setItems((xs) => xs.map((it, i) => (i === index ? { ...it, ...next } : it)));

  const revenueError = revenue !== '' && rev <= 0 ? '월 매출은 0보다 커야 해요' : undefined;
  const canSave =
    loaded &&
    !fixed.error &&
    !configuration.error &&
    !fixed.isLoading &&
    !configuration.isLoading &&
    Number.isFinite(rev) &&
    rev > 0 &&
    items.length > 0 &&
    !save.isPending;
  const dirty = loaded && JSON.stringify({ revenue, items }) !== originalDraft;

  const onSave = () => {
    if (!canSave || saveBusy.current) return;
    saveBusy.current = true;
    const payload: FixedCostItem[] = items.map((it) => ({
      key: it.key,
      label: it.label,
      mode: it.mode,
      total: itemTotal(it),
      lines: it.lines.map((l) => ({ name: l.name, amount: num(l.amount) })),
      weights: it.weights,
    }));

    save.mutate(
      { month, totalRevenue: rev, items: payload },
      {
        onSuccess: (result) => {
          saveBusy.current = false;
          setConfirmSave(false);
          if (result.reentryActive && result.nextMonth) {
            onChangeMonth(result.nextMonth);
            return;
          }
          safeBack('/recipes/fixed-cost');
        },
        onError: (e) => {
          saveBusy.current = false;
          Alert.alert(
            '저장하지 못했어요',
            e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요',
          );
        },
      },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader
        title="고정 지출 입력 / 수정"
        onBack={() => safeBack('/recipes/fixed-cost')}
      />
      {reentry ? null : (
        <CompletedMonthPicker
          value={month}
          localMonth={localMonth}
          disabled={save.isPending}
          onChange={(next) => {
            if (saveBusy.current) return;
            if (dirty) setPendingMonth(next);
            else onChangeMonth(next);
          }}
        />
      )}

      <QueryState
        isLoading={fixed.isLoading || configuration.isLoading}
        error={fixed.error ?? configuration.error}
        isEmpty={false}
        onRetry={() => {
          void fixed.refetch();
          void configuration.refetch();
        }}
        emptyTitle=""
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 4,
            paddingBottom: 24,
            gap: 12,
          }}
        >
          {reentry ? (
            <Card>
              <Text style={{ ...TYPE.body, color: T.ink, fontWeight: '800' }}>
                항목 수정 진행 중
              </Text>
              <Text style={{ ...TYPE.caption, color: COLOR.text.tertiary, marginTop: space.xs }}>
                {reentry.completedCount}/{reentry.basisMonths}개월 입력 완료 · 모두 입력하면 새 기준으로 계산해요.
              </Text>
            </Card>
          ) : null}
          <Field label="월매출 입력 방식" variant="stacked">
            <Select
              value={useSalesRevenue ? '매출관리 매출 적용' : '직접 입력'}
              description={useSalesRevenue ? `${won(salesRevenue)}원` : undefined}
              variant="stacked"
              expanded={revenueSourceOpen}
              accessibilityLabel={`월매출 입력 방식 ${useSalesRevenue ? '매출관리 매출 적용' : '직접 입력'}`}
              onPress={() => {
                if (!save.isPending) setRevenueSourceOpen(true);
              }}
            />
          </Field>

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
              disabled={useSalesRevenue}
              accessibilityLabel="총 월매출"
            />
          </Field>

          <FixedCostRateCard total={sum} rate={rate} />

          {items.map((it, si) => (
            <Card key={`${it.key}-${si}`} pad={0} style={{ overflow: 'hidden' }}>
              <RecipeDetailHeading title={it.label} />

              <View style={{ padding: space.lg, gap: space.sm }}>
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
                    <Field key={li} label={l.name} variant="stacked">
                      <Input
                        value={l.amount}
                        onChangeText={(text) =>
                          setItems((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === si
                                ? {
                                    ...item,
                                    lines: item.lines.map((line, lineIndex) =>
                                      lineIndex === li
                                        ? { ...line, amount: clampDecimals(text, 0) }
                                        : line,
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
                        placeholder="0"
                        suffix="원"
                        mono
                        variant="stacked"
                        keyboardType="number-pad"
                        accessibilityLabel={`${l.name} 금액`}
                      />
                    </Field>
                  ))
                )}

              </View>
              {it.mode === 'detail' ? (
                <RecipeDetailSubtotal
                  value={`${won(itemTotal(it))}원`}
                  secondary={rev > 0 ? formatPercent(itemTotal(it) / rev) : '0%'}
                />
              ) : null}
            </Card>
          ))}

          {!items.length ? (
            <Card>
              <Text style={{ ...TYPE.body, color: T.ink, fontWeight: '800' }}>
                입력할 고정 지출 항목이 없어요.
              </Text>
              <Text
                style={{
                  ...TYPE.caption,
                  color: COLOR.text.tertiary,
                  marginTop: space.xs,
                  marginBottom: space.md,
                }}
              >
                설정에서 항목 구성을 먼저 등록해 주세요.
              </Text>
              <Button
                kind="gray"
                size="lg"
                full
                onPress={() => router.push('/recipes/fixed-cost-settings' as Href)}
              >
                항목 설정
              </Button>
            </Card>
          ) : null}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: space.sm,
              paddingVertical: 12,
              paddingHorizontal: space.md,
              borderRadius: 12,
              backgroundColor: COLOR.status.cautionTint,
            }}
          >
            <Icon name="info" size={15} color={COLOR.status.caution} />
            <Text
              style={{
                flex: 1,
                fontSize: 14,
                color: COLOR.status.caution,
                lineHeight: TYPE.caption.lineHeight,
              }}
            >
              {reentry
                ? '모든 대상 월을 입력하기 전까지 기존 항목과 계산 기준을 사용해요.'
                : '저장하면 이 달 모든 메뉴의 손익이 다시 계산돼요.'}
            </Text>
          </View>
        </ScrollView>
      </QueryState>

      <Sheet
        visible={revenueSourceOpen}
        onClose={() => setRevenueSourceOpen(false)}
        title="월매출 입력 방식"
      >
        <SelectionRow
          label="직접 입력"
          selected={!useSalesRevenue}
          onPress={() => selectRevenueSource('manual')}
        />
        <SelectionRow
          label="매출관리 매출 적용"
          description={canUseSalesRevenue ? `${won(salesRevenue)}원` : '해당 월 매출 없음'}
          selected={useSalesRevenue}
          disabled={!canUseSalesRevenue}
          accessibilityLabel={`매출관리 매출 적용${canUseSalesRevenue ? ` ${won(salesRevenue)}원` : ' 해당 월 매출 없음'}`}
          last
          onPress={() => selectRevenueSource('sales')}
        />
      </Sheet>

      <ConfirmDialog
        visible={pendingMonth !== null}
        title="다른 달로 이동할까요?"
        message="저장하지 않은 변경 내용은 사라집니다."
        confirmText="이동"
        onCancel={() => setPendingMonth(null)}
        onConfirm={() => {
          if (pendingMonth) onChangeMonth(pendingMonth);
        }}
      />
      <ConfirmDialog
        visible={confirmSave}
        title={`${Number(month.slice(5))}월 고정 지출을 저장할까요?`}
        message={
          reentry
            ? `입력한 달은 초안으로 보관하며 ${reentry.basisMonths}개월을 모두 입력하면 새 기준으로 계산합니다.`
            : '이 월이 현재 적용 기준에 포함되면 메뉴 손익이 다시 계산됩니다.'
        }
        confirmText="저장"
        kind="primary"
        loading={save.isPending}
        onCancel={() => setConfirmSave(false)}
        onConfirm={onSave}
      />
      <ConfirmDialog
        visible={confirmCancelReentry}
        title="고정 지출 변경을 중단할까요?"
        message="지금까지 입력한 초안은 사라지고 기존 항목과 계산 기준을 계속 사용합니다."
        confirmText="변경 중단"
        kind="danger"
        loading={cancelReentry.isPending}
        onCancel={() => setConfirmCancelReentry(false)}
        onConfirm={() => {
          if (!reentry) return;
          cancelReentry.mutate(
            { sessionId: reentry.id, baseRevision: reentry.revision },
            {
              onSuccess: () => safeBack('/recipes/fixed-cost'),
              onError: (error) => {
                setConfirmCancelReentry(false);
                Alert.alert(
                  '변경을 중단하지 못했어요',
                  error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.',
                );
              },
            },
          );
        }}
      />

      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: space.md,
          paddingBottom: LAYOUT.scroll.end,
          backgroundColor: T.surface,
          borderTopWidth: 1,
          borderTopColor: T.line2,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.md }}>
          <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.sub2 }}>
            고정 지출률
          </Text>
          <Text style={[{ fontSize: 18, fontWeight: '800', color: T.ink, marginRight: 8 }, NUM]}>
            {won(sum)}원
          </Text>
          <Text
            style={[
              {
                fontSize: 16,
                fontWeight: '800',
                color: rate === null ? COLOR.text.tertiary : COLOR.text.accent,
              },
              NUM,
            ]}
          >
            {rate === null ? '—' : formatPercent(rate)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {reentry ? (
            <Button
              kind="gray"
              size="lg"
              full
              style={{ flex: 1 }}
              disabled={save.isPending || cancelReentry.isPending}
              onPress={() => setConfirmCancelReentry(true)}
            >
              변경 중단
            </Button>
          ) : null}
          <Button
            kind="primary"
            size="lg"
            full
            style={{ flex: 1 }}
            disabled={!canSave || cancelReentry.isPending}
            loading={save.isPending}
            onPress={() => setConfirmSave(true)}
          >
            {reentry ? '입력 저장' : '저장'}
          </Button>
        </View>
      </View>
    </View>
  );
}

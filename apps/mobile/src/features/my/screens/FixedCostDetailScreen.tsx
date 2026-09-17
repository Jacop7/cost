import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import {
  AppHeader,
  Button,
  Card,
  DetailSummaryCard,
  DetailSummaryRow,
  QueryState,
  Select,
  Sheet,
} from '@/components/kit';
import { SelectionRow } from '@/components/kit/SelectionRow';
import {
  RecipeDetailHeading,
  RecipeDetailSubtotal,
} from '@/features/recipes/components/RecipeDetailParts';
import { BusinessDateGate } from '@/features/business-day/components/BusinessDateGate';
import { ConfigurationHistoryLink } from '@/features/changes/components/ConfigurationHistoryLink';
import { useStoreLocalDate } from '@/features/business-day/businessDay';
import { safeBack } from '@/lib/nav';
import { formatPercent } from '@costkeep/core';
import { COLOR, LAYOUT, T, TYPE, space, won } from '@/theme/tokens';
import { useFixedCostBasis, useFixedCosts, type FixedCostItem } from '../hooks';
import {
  completedFixedMonths,
  previousFixedMonths,
} from '../components/FixedMonthPicker';
import {
  averageFixedCostItems,
  FIXED_COST_LABEL,
  fullFixedMonthLabel,
} from '../fixedCostView';

const percent = (value: number | null) => (value == null ? '미산출' : formatPercent(value));
const money = (value: number | null) => (value == null ? '미산출' : `${won(value)}원`);

function FixedItemCards({
  title,
  items,
  total,
}: {
  title: string;
  items: FixedCostItem[];
  total: number;
}) {
  return (
    <View style={{ gap: space.md }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          paddingHorizontal: space.xs,
        }}
      >
        <Text style={{ ...TYPE.body, color: COLOR.text.primary }}>{title}</Text>
        <Text style={{ ...TYPE.caption, color: COLOR.text.tertiary }}>{items.length}개</Text>
      </View>
      {items.map((item) => {
        const rate = total > 0 ? formatPercent(item.total / total) : '0%';
        const lines = item.lines;
        const itemName = item.label ?? FIXED_COST_LABEL[item.key] ?? item.key;
        return (
          <Card key={item.key} pad={0} style={{ overflow: 'hidden' }}>
            <RecipeDetailHeading title={itemName} />
            {lines.map((line, index) => (
              <DetailSummaryRow
                key={`${line.name}-${index}`}
                label={line.name}
                value={money(line.amount)}
                secondary
                last={index === lines.length - 1}
              />
            ))}
            <RecipeDetailSubtotal value={money(item.total)} secondary={rate} />
          </Card>
        );
      })}
    </View>
  );
}

export default function FixedCostDetailScreen() {
  return (
    <BusinessDateGate
      source={useStoreLocalDate()}
      title="고정 지출 상세"
      onBack={() => safeBack('/recipes/fixed-cost')}
    >
      {(localDate) => <FixedCostDetailBody localMonth={localDate.slice(0, 7)} />}
    </BusinessDateGate>
  );
}

function FixedCostDetailBody({ localMonth }: { localMonth: string }) {
  const router = useRouter();
  const { month, mode } = useLocalSearchParams<{ month?: string; mode?: string }>();
  const averageMode = mode === 'average';
  const validMonth = typeof month === 'string' && /^\d{4}-\d{2}$/.test(month) ? month : '';
  const browseMonths = useMemo(() => completedFixedMonths(localMonth, 12), [localMonth]);
  const routeMonth = browseMonths.includes(validMonth) ? validMonth : (browseMonths[0] ?? '');
  const [selectedMonth, setSelectedMonth] = useState(routeMonth);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  useEffect(() => setSelectedMonth(routeMonth), [routeMonth]);

  const basis = useFixedCostBasis(localMonth, averageMode || !selectedMonth);
  const monthlyQuery = useFixedCosts(selectedMonth, !averageMode && Boolean(selectedMonth));
  const basisMonthly = basis.data?.months.find((row) => row.month === selectedMonth);
  const monthly = basisMonthly
    ? {
        month: basisMonthly.month,
        entered: basisMonthly.entered,
        totalRevenue: basisMonthly.totalRevenue ?? 0,
        items: basisMonthly.items,
        rate: basisMonthly.rate,
      }
    : monthlyQuery.data;
  const averageItems = basis.data
    ? averageFixedCostItems(basis.data.months, basis.data.basisMonths)
    : [];
  const empty = averageMode ? !basis.data?.applied : !selectedMonth || !monthly;
  const fixedTotal =
    monthly?.items.reduce((sum, item) => sum + item.total, 0) ?? 0;
  const editable = previousFixedMonths(localMonth).includes(selectedMonth);
  const detailState = averageMode ? basis : monthlyQuery;

  const changeMonth = (nextMonth: string) => {
    setMonthPickerOpen(false);
    if (nextMonth === selectedMonth) return;
    setSelectedMonth(nextMonth);
    router.replace(`/recipes/fixed-cost-detail?month=${nextMonth}` as Href);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader
        title={averageMode ? '평균 고정 지출 상세' : '월별 고정 지출 상세'}
        onBack={() => safeBack('/recipes/fixed-cost')}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: space.lg,
          paddingTop: LAYOUT.scroll.start,
          paddingBottom: averageMode ? LAYOUT.scroll.end : 24,
          gap: space.lg,
        }}
      >
        {!averageMode ? (
          <View style={{ gap: space.sm }}>
            <Text style={{ ...TYPE.caption, color: COLOR.text.secondary, fontWeight: '700' }}>
              년/월
            </Text>
            <Select
              value={fullFixedMonthLabel(selectedMonth)}
              expanded={monthPickerOpen}
              accessibilityLabel={`년/월 ${fullFixedMonthLabel(selectedMonth)} 변경`}
              onPress={() => setMonthPickerOpen(true)}
            />
          </View>
        ) : null}
        <QueryState
          isLoading={detailState.isLoading}
          error={detailState.error}
          isEmpty={empty}
          onRetry={() => {
            void detailState.refetch();
          }}
          emptyTitle={
            averageMode ? '평균을 아직 산출할 수 없어요' : '고정 지출 정보를 찾을 수 없어요'
          }
        >
          {averageMode && basis.data?.applied ? (
            <>
              <DetailSummaryCard title={`최근 ${basis.data.basisMonths}개월 기준`}>
                <DetailSummaryRow
                  label="기준 기간"
                  value={`${fullFixedMonthLabel(basis.data.fromMonth)} ~ ${fullFixedMonthLabel(basis.data.toMonth)}`}
                />
                <DetailSummaryRow
                  label="입력 상태"
                  value={`${basis.data.enteredMonths}/${basis.data.basisMonths}개월`}
                />
                <DetailSummaryRow label="평균 매출" value={money(basis.data.averageRevenue)} />
                <DetailSummaryRow label="평균 고정 지출" value={money(basis.data.averageFixed)} />
                <DetailSummaryRow label="평균 고정 지출률" value={percent(basis.data.rate)} last />
              </DetailSummaryCard>
              <FixedItemCards
                title="평균 고정 지출 항목"
                items={averageItems}
                total={basis.data.averageFixed ?? 0}
              />
            </>
          ) : null}
          {!averageMode && monthly ? (
            <>
              <DetailSummaryCard title="월별 고정 지출">
                <DetailSummaryRow label="년/월" value={fullFixedMonthLabel(monthly.month)} />
                <DetailSummaryRow label="매출" value={money(monthly.totalRevenue)} />
                <DetailSummaryRow label="고정 지출" value={money(fixedTotal)} />
                <DetailSummaryRow label="고정 지출률" value={percent(monthly.rate)} last />
              </DetailSummaryCard>
              <FixedItemCards
                title="고정 지출 항목"
                items={monthly.items}
                total={fixedTotal}
              />
              {monthly.entered ? (
                <ConfigurationHistoryLink kind="fixed_cost" month={selectedMonth} scope="monthly" />
              ) : null}
              {!editable ? (
                <Text style={{ ...TYPE.caption, color: COLOR.text.tertiary, textAlign: 'center' }}>
                  완료된 최근 3개월만 입력·수정할 수 있어요.
                </Text>
              ) : null}
            </>
          ) : null}
        </QueryState>
      </ScrollView>
      <Sheet
        visible={monthPickerOpen}
        onClose={() => setMonthPickerOpen(false)}
        title="년/월 선택"
        sub="이번 달을 제외한 최근 1년을 조회할 수 있어요."
      >
        {browseMonths.map((browseMonth, index) => (
          <SelectionRow
            key={browseMonth}
            label={fullFixedMonthLabel(browseMonth)}
            selected={browseMonth === selectedMonth}
            last={index === browseMonths.length - 1}
            onPress={() => changeMonth(browseMonth)}
          />
        ))}
      </Sheet>
      {!averageMode && selectedMonth && monthly && editable ? (
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
          <Button
            kind="primary"
            size="lg"
            full
            onPress={() => router.push(`/recipes/fixed-cost-edit?month=${selectedMonth}` as Href)}
          >
            {monthly.entered ? '수정' : '입력'}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

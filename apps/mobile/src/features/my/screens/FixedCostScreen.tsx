import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { AppHeader, Button, Card, CardFooterAction, Icon, QueryState, Sheet } from '@/components/kit';
import { SelectionRow } from '@/components/kit/SelectionRow';
import { safeBack } from '@/lib/nav';
import { formatPercent } from '@costkeep/core';
import { LAYOUT, COLOR, T, won, TYPE, space } from '@/theme/tokens';
import { useStoreLocalDate } from '@/features/business-day/businessDay';
import { BusinessDateGate } from '@/features/business-day/components/BusinessDateGate';
import { ConfigurationHistoryLink } from '@/features/changes/components/ConfigurationHistoryLink';
import { useFixedCostBasis } from '../hooks';
import { averageFixedCostItems, FIXED_COST_LABEL, fullFixedMonthLabel } from '../fixedCostView';

const NUM = { fontVariant: ['tabular-nums' as const] };

export default function FixedCostScreen() {
  return (
    <BusinessDateGate source={useStoreLocalDate()} title="고정 지출" onBack={() => safeBack('/my')}>
      {(localDate) => <FixedCostScreenBody localMonth={localDate.slice(0, 7)} />}
    </BusinessDateGate>
  );
}

function SummaryRow({
  label,
  value,
  valueColor = T.ink,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: space.md }}>
      <Text style={{ ...TYPE.body, color: T.sub2, flex: 1 }}>{label}</Text>
      <Text
        style={{ ...TYPE.body, fontWeight: '800', color: valueColor, textAlign: 'right', ...NUM }}
      >
        {value}
      </Text>
    </View>
  );
}

function FixedCostScreenBody({ localMonth }: { localMonth: string }) {
  const router = useRouter();
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const basis = useFixedCostBasis(localMonth);
  const data = basis.data;
  const items = useMemo(
    () => (data ? averageFixedCostItems(data.months, data.basisMonths) : []),
    [data],
  );
  const openEditor = (month: string) =>
    router.push(`/recipes/fixed-cost-edit?month=${month}` as Href);
  const openDetail = (month: string) =>
    router.push(`/recipes/fixed-cost-detail?month=${month}` as Href);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="고정 지출" onBack={() => safeBack('/my')} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: space.lg,
          paddingTop: LAYOUT.scroll.start,
          paddingBottom: 24,
          gap: space.md,
        }}
      >
        <QueryState
          isLoading={basis.isLoading}
          error={basis.error}
          isEmpty={false}
          onRetry={() => void basis.refetch()}
          emptyTitle=""
        >
          {data ? (
            <>
              <ConfigurationHistoryLink kind="fixed_cost" />

              <Card pad={0} style={{ overflow: 'hidden' }}>
                <View
                  style={{
                    minHeight: 52,
                    paddingHorizontal: space.lg,
                    paddingVertical: space.md,
                    borderBottomWidth: 1,
                    borderBottomColor: T.line2,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.md,
                  }}
                >
                  <Text style={{ ...TYPE.body, color: T.sub2, flex: 1 }}>고정 지출 적용</Text>
                  <Text
                    style={{
                      ...TYPE.body,
                      color: data.applied ? COLOR.status.positive : COLOR.status.caution,
                      fontWeight: '800',
                    }}
                  >
                    {data.applied ? '적용' : '미적용'}
                  </Text>
                </View>
                <View style={{ paddingHorizontal: space.lg, paddingVertical: space.md }}>
                  <SummaryRow label="고정 지출 기준" value={`최근 ${data.basisMonths}개월`} />
                  <SummaryRow
                    label="입력 상태"
                    value={`${data.enteredMonths}/${data.basisMonths}개월`}
                  />
                  <SummaryRow
                    label="평균 고정 지출률"
                    value={data.applied ? formatPercent(data.rate ?? 0) : '미산출'}
                    valueColor={data.applied ? T.ink : COLOR.status.caution}
                  />
                </View>
                {!data.applied ? (
                  <View
                    style={{
                      margin: space.lg,
                      marginTop: 0,
                      padding: space.md,
                      borderRadius: 12,
                      backgroundColor: COLOR.status.cautionTint,
                      gap: space.sm,
                    }}
                  >
                    <View
                      testID="fixed-cost-missing-notice"
                      style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}
                    >
                      <Icon name="info" size={16} color={COLOR.status.caution} />
                      <Text style={{ ...TYPE.caption, color: COLOR.status.caution, flex: 1 }}>
                        고정지출을 모두 입력하기 전까지는 메뉴 손익에 고정 지출이 반영되지 않습니다.
                      </Text>
                    </View>
                  </View>
                ) : null}
              </Card>

              <Card pad={0} style={{ overflow: 'hidden' }}>
                <View
                  style={{
                    minHeight: 52,
                    paddingHorizontal: space.lg,
                    paddingVertical: space.md,
                    borderBottomWidth: 1,
                    borderBottomColor: T.line,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.md,
                  }}
                >
                  <Text style={{ ...TYPE.body, color: T.sub2, flex: 1 }}>년/월</Text>
                  <Text
                    style={{
                      ...TYPE.body,
                      color: T.sub2,
                      textAlign: 'right',
                      marginRight: space.sm + 16,
                    }}
                  >
                    고정 지출률
                  </Text>
                </View>
                {data.months.map((row) => (
                  <Pressable
                    key={row.month}
                    onPress={() => openDetail(row.month)}
                    accessibilityRole="button"
                    accessibilityLabel={`${fullFixedMonthLabel(row.month)} 상세`}
                    style={{
                      minHeight: 88,
                      paddingHorizontal: space.lg,
                      paddingVertical: space.md,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space.sm,
                      borderBottomWidth: 1,
                      borderBottomColor: T.line2,
                    }}
                  >
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={{ ...TYPE.body, color: T.ink, fontWeight: '800' }}>
                        {fullFixedMonthLabel(row.month)}
                      </Text>
                      <Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary }}>
                        매출 {won(row.totalRevenue ?? 0)}원
                      </Text>
                      <Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary }}>
                        고정 지출 {won(row.totalFixed ?? 0)}원
                      </Text>
                    </View>
                    <Text
                      style={{
                        ...TYPE.body,
                        fontWeight: '800',
                        color: row.entered ? T.ink : COLOR.status.caution,
                        textAlign: 'right',
                        ...NUM,
                      }}
                    >
                      {row.entered ? formatPercent(row.rate ?? 0) : '미 입력'}
                    </Text>
                    <Icon name="chevron" size={16} color={T.line3} />
                  </Pressable>
                ))}
                {data.applied ? (
                  <CardFooterAction
                    accessibilityLabel="월별 고정 지출 자세히 보기"
                    onPress={() => openDetail(data.toMonth)}
                  >
                    자세히 보기
                  </CardFooterAction>
                ) : null}
              </Card>

              <Card pad={0} style={{ overflow: 'hidden' }}>
                <View
                  style={{
                    minHeight: 52,
                    paddingHorizontal: space.lg,
                    paddingVertical: space.md,
                    backgroundColor: T.surface2,
                    borderBottomWidth: 1,
                    borderBottomColor: T.line2,
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ ...TYPE.body, color: T.ink }}>
                    최근 {data.basisMonths}개월 고정 지출
                  </Text>
                </View>
                {items.length ? (
                  items.map((item) => {
                    const share =
                      data.applied && (data.averageFixed ?? 0) > 0
                        ? item.total / (data.averageFixed ?? 0)
                        : null;
                    return (
                      <View
                        key={item.key}
                        style={{
                          paddingHorizontal: space.lg,
                          paddingVertical: space.md,
                          minHeight: 68,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: space.md,
                          borderBottomWidth: 1,
                          borderBottomColor: T.line2,
                        }}
                      >
                        <Text style={{ ...TYPE.body, color: T.ink2, flex: 1 }}>
                          {item.label ?? FIXED_COST_LABEL[item.key] ?? item.key}
                        </Text>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ ...TYPE.body, color: T.ink, fontWeight: '800', ...NUM }}>
                            {data.applied ? `${won(item.total)}원` : '미산출'}
                          </Text>
                          <Text
                            style={{
                              ...TYPE.captionSm,
                              color: COLOR.text.tertiary,
                              marginTop: space.xs,
                              ...NUM,
                            }}
                          >
                            {share == null ? '0%' : formatPercent(share)}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <View
                    style={{
                      minHeight: 68,
                      paddingHorizontal: space.lg,
                      justifyContent: 'center',
                      borderBottomWidth: 1,
                      borderBottomColor: T.line2,
                    }}
                  >
                    <Text style={{ ...TYPE.caption, color: COLOR.text.tertiary }}>
                      등록된 고정 지출 항목이 없어요.
                    </Text>
                  </View>
                )}
                <View
                  style={{
                    paddingHorizontal: space.lg,
                    paddingVertical: space.md,
                    minHeight: 68,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.md,
                  }}
                >
                  <Text style={{ ...TYPE.body, color: T.ink, fontWeight: '800', flex: 1 }}>
                    고정 지출 합계
                  </Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ ...TYPE.body, color: T.ink, fontWeight: '800', ...NUM }}>
                      {data.applied ? `${won(data.averageFixed ?? 0)}원` : '미산출'}
                    </Text>
                    <Text
                      style={{
                        ...TYPE.captionSm,
                        color: COLOR.text.tertiary,
                        marginTop: space.xs,
                        ...NUM,
                      }}
                    >
                      {data.applied ? '100%' : '0%'}
                    </Text>
                  </View>
                </View>
                {data.applied ? (
                  <CardFooterAction
                    accessibilityLabel="최근 고정 지출 항목 자세히 보기"
                    onPress={() => router.push('/recipes/fixed-cost-detail?mode=average' as Href)}
                  >
                    자세히 보기
                  </CardFooterAction>
                ) : null}
              </Card>
            </>
          ) : null}
        </QueryState>
      </ScrollView>

      <Sheet
        visible={monthPickerOpen}
        onClose={() => setMonthPickerOpen(false)}
        title="고정 지출 입력 / 수정"
        sub="이번 달을 제외한 최근 3개월에서 선택해 주세요."
      >
        {data?.months.map((row, index) => (
          <SelectionRow
            key={row.month}
            label={fullFixedMonthLabel(row.month)}
            description={row.entered ? '입력 완료 · 수정' : '미 입력 · 입력'}
            accessibilityLabel={`${fullFixedMonthLabel(row.month)} ${row.entered ? '수정' : '입력'}`}
            selected={false}
            last={index === data.months.length - 1}
            onPress={() => {
              setMonthPickerOpen(false);
              openEditor(row.month);
            }}
          />
        ))}
      </Sheet>

      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: space.md,
          paddingBottom: LAYOUT.scroll.end,
          backgroundColor: T.surface,
          borderTopWidth: 1,
          borderTopColor: T.line2,
          flexDirection: 'row',
          gap: space.sm,
        }}
      >
        <Button
          kind="gray"
          size="lg"
          full
          style={{ flex: 1 }}
          onPress={() => router.push('/recipes/fixed-cost-settings' as Href)}
        >
          설정
        </Button>
        <Button
          kind="primary"
          size="lg"
          full
          style={{ flex: 2 }}
          disabled={!data?.months.length}
          onPress={() => setMonthPickerOpen(true)}
        >
          고정 지출 입력 / 수정
        </Button>
      </View>
    </View>
  );
}

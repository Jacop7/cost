import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useLocalSearchParams } from 'expo-router';
import { AppHeader, Badge, Button, ConfirmDialog, Icon, QueryState, Sheet } from '@/components/kit';
import { SummaryCard } from '@/components/history/HistoryLayout';
import { HistoryValueRow } from '@/components/history/HistoryValueRow';
import { historyRowStyles } from '@/components/history/historyRowStyles';
import { useBusinessDay, type BusinessDayState } from '@/features/business-day/businessDay';
import { storeDateTimeParts } from '@/lib/date';
import { safeBack } from '@/lib/nav';
import { COLOR, LAYOUT, T, TYPE, radius, space, tnum } from '@/theme/tokens';
import { changeStamp } from '../hooks';
import { ChangeSourceBadge } from '../components/ChangeSourceBadge';
import { ChangeDetailHeader } from '../components/ChangeDetailHeader';
import { classifyChange } from '../changeClassification';
import {
  useConfigurationHistory,
  useRevertFixedCostReentry,
  type ConfigurationEvent,
  type ConfigurationKind,
  type FixedCostHistoryScope,
  type FixedCostRevertBlocker,
} from '../configurationHistory';

const fixedBadgeLabels = (event: ConfigurationEvent): string[] => {
  switch (event.fixedCostType) {
    case 'initial_settings':
      return ['지출 항목 수정'];
    case 'settings_basis':
      return ['평균 기간 수정'];
    case 'settings_items':
      return ['지출 항목 수정'];
    case 'settings_reentry':
      return event.changes.some(change => change.key === 'basis_months')
        ? ['평균 기간 수정', '지출 항목 수정']
        : ['지출 항목 수정'];
    case 'monthly_input':
      return [event.operation === 'create' ? '월별 금액 등록' : '월별 금액 수정'];
    case 'restore':
      return ['이전 버전 복구'];
    default:
      return ['이전 기록'];
  }
};

const blockerMessage = (blocker: FixedCostRevertBlocker | null) => {
  switch (blocker) {
    case 'newer_change':
    case 'not_latest': return '이후에 저장된 변경이 있어 이 내역은 복구할 수 없어요.';
    case 'active_reentry': return '고정 지출을 다시 입력하는 중에는 복구할 수 없어요.';
    case 'state_mismatch': return '현재 값이 이 내역과 달라 복구할 수 없어요.';
    case 'unsupported': return '이 변경은 복구를 지원하지 않아요.';
    default: return blocker ? '현재 이 변경은 복구할 수 없어요.' : null;
  }
};

const monthLabel = (month: string) => `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`;
const groupedMonthLabels = (months: string[]) => {
  let previousYear = '';
  return months.map(month => {
    const year = month.slice(0, 4);
    const label = year === previousYear ? `${Number(month.slice(5))}월` : monthLabel(month);
    previousYear = year;
    return label;
  });
};

const applicationText = (event: ConfigurationEvent, kind: ConfigurationKind) => {
  if (kind === 'fixed_cost') return null;
  if (kind === 'material' && event.applicationMode === 'immediate') return '즉시 적용';
  if (kind === 'material' && event.applicationMode === 'next_business') return '매출 작성 완료 후 반영';
  return event.effectiveFrom ? `${event.effectiveFrom}부터 적용` : null;
};

type FixedApplicationStatus = { text: string; tone: 'green' | 'amber' };

/** 저장 당시 값이 아니라 현재 열린 영업일의 스냅샷을 기준으로 고정 지출 반영 상태를 표시한다. */
const fixedApplicationStatus = (
  event: ConfigurationEvent,
  businessDay: BusinessDayState | undefined,
): FixedApplicationStatus | null => {
  if (!event.applicationMode) return null;
  if (event.applicationMode === 'immediate') return { text: '현재 매출에 반영 중', tone: 'green' };
  if (!businessDay) return null;

  const open = businessDay.status === 'open' || businessDay.status === 'break';
  const occurredAt = Date.parse(event.occurredAt);
  const openedAt = Date.parse(businessDay.openedAt ?? '');
  const pending = open && Number.isFinite(occurredAt) && Number.isFinite(openedAt) && occurredAt > openedAt;
  if (!pending) return { text: '현재 매출에 반영 중', tone: 'green' };

  const close = businessDay.plannedCloseAt
    ? storeDateTimeParts(businessDay.plannedCloseAt, businessDay.timezone)
    : null;
  return close
    ? { text: `${Number(close.month)}월 ${Number(close.day)}일 반영`, tone: 'amber' }
    : null;
};

function backPath(kind: ConfigurationKind, scope: FixedCostHistoryScope, month?: string): Href {
  if (kind === 'tax') return '/my/tax';
  if (kind === 'material') return '/recipes/materials';
  if (month) return `/recipes/fixed-cost-detail?month=${month}` as Href;
  return scope === 'settings' ? '/recipes/fixed-cost-settings' : '/recipes/fixed-cost';
}

export default function ConfigurationHistoryScreen() {
  const params = useLocalSearchParams<{ kind?: string; month?: string; scope?: string }>();
  const kind: ConfigurationKind = params.kind === 'fixed_cost' ? 'fixed_cost' : params.kind === 'material' ? 'material' : 'tax';
  const month = kind === 'fixed_cost' && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month ?? '') ? params.month : undefined;
  const initialScope: FixedCostHistoryScope = kind === 'fixed_cost' && (params.scope === 'settings' || params.scope === 'monthly')
    ? params.scope : month ? 'monthly' : 'all';
  const scope = initialScope;
  const history = useConfigurationHistory(kind, month, scope);
  const businessDay = useBusinessDay().data;
  const timezone = businessDay?.timezone;
  const [selected, setSelected] = useState<ConfigurationEvent | null>(null);
  const [revertTarget, setRevertTarget] = useState<ConfigurationEvent | null>(null);
  const revert = useRevertFixedCostReentry();
  const items = history.data?.pages.flatMap(page => page.items) ?? [];
  const firstPage = history.data?.pages[0];
  const title = kind === 'tax' ? '세금' : kind === 'material' ? '부자재' : '고정 지출';
  const selectedBlocker = selected ? blockerMessage(selected.revertBlocker) : null;
  const selectedCanRevert = kind === 'fixed_cost' && selected?.reversible === true && Boolean(selected.latestChangeId);

  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <AppHeader title="수정 내역" onBack={() => safeBack(backPath(kind, scope, month))} />
    <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: LAYOUT.scroll.start, paddingBottom: LAYOUT.scroll.end }}>
      {kind !== 'fixed_cost' ? <SummaryCard
        prominent
        label={title}
        value={`총 ${firstPage?.count ?? 0}건`}
        metrics={[]}
      /> : null}
      <QueryState
        isLoading={history.isLoading}
        error={history.error}
        isEmpty={!items.length}
        emptyTitle="아직 기록된 수정 내역이 없어요"
        onRetry={() => void history.refetch()}
      >
        <Text style={{ ...TYPE.caption, color: COLOR.text.tertiary, fontWeight: '800', marginHorizontal: space.xs, marginBottom: space.sm }}>
          최근 7일간
        </Text>
        <View>
          {items.map((event, index) => {
            const first = index === 0;
            const last = index === items.length - 1;
            const fixedBadges = kind === 'fixed_cost' ? fixedBadgeLabels(event) : [];
            const fixedApplication = kind === 'fixed_cost' ? fixedApplicationStatus(event, businessDay) : null;
            const applies = applicationText(event, kind);
            return <Pressable
              key={event.id}
              accessibilityRole="button"
              accessibilityLabel={`${event.title} 자세히 보기`}
              onPress={() => setSelected(event)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: space.sm,
                paddingVertical: historyRowStyles.spacing.paddingVertical,
                paddingHorizontal: historyRowStyles.spacing.paddingHorizontal,
                backgroundColor: T.surface,
                borderLeftWidth: 1, borderRightWidth: 1, borderColor: T.line,
                borderTopWidth: first ? 1 : 0,
                borderBottomWidth: 1,
                borderBottomColor: last ? T.line : T.line2,
                borderTopLeftRadius: first ? radius.lg : 0,
                borderTopRightRadius: first ? radius.lg : 0,
                borderBottomLeftRadius: last ? radius.lg : 0,
                borderBottomRightRadius: last ? radius.lg : 0,
              }}
            >
              <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
                <Text style={[historyRowStyles.date, tnum]}>{changeStamp(event.occurredAt, timezone) || '—'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs }}>
                  {kind === 'fixed_cost' ? null : <ChangeSourceBadge change={event} />}
                  {fixedBadges.map(label => <Badge key={label} sm alignSelf="center">{label}</Badge>)}
                  {fixedApplication ? <Badge sm tone={fixedApplication.tone} alignSelf="center">{fixedApplication.text}</Badge> : null}
                  <Text style={[historyRowStyles.title, { flexShrink: 1 }]}>{event.title}</Text>
                </View>
                {applies ? <Text style={[historyRowStyles.description, { marginTop: space.xs, color: COLOR.text.tertiary }]}>{applies}</Text> : null}
              </View>
              <Icon name="chevron" size={16} color={COLOR.text.tertiary} />
            </Pressable>;
          })}
        </View>
      </QueryState>
      {history.hasNextPage ? <Button kind="ghost" onPress={() => void history.fetchNextPage()} disabled={history.isFetchingNextPage}>더 보기</Button> : null}
    </ScrollView>

    <Sheet visible={selected !== null} title={kind === 'fixed_cost' ? undefined : '수정 내용'} onClose={() => setSelected(null)}>
      {selected ? <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.xl }}>
        <ChangeDetailHeader
          title={selected.title}
          stamp={changeStamp(selected.occurredAt, timezone) || '—'}
          sourceLabel={kind === 'fixed_cost' ? fixedBadgeLabels(selected) : classifyChange(selected).label}
          automatic={kind === 'fixed_cost' ? false : classifyChange(selected).automatic}
          application={kind === 'fixed_cost' ? fixedApplicationStatus(selected, businessDay) : null}
        />
        {applicationText(selected, kind) ? <Text style={{ ...TYPE.captionSm, color: COLOR.text.secondary, marginTop: space.sm }}>{applicationText(selected, kind)}</Text> : null}
        {selected.changes.length || (kind === 'fixed_cost' && selected.affectedMonths.length) ? <View style={{ marginTop: space.lg }}>
          {kind === 'fixed_cost' ? <Text style={{ ...TYPE.caption, color: COLOR.text.secondary, fontWeight: '800', marginBottom: space.sm }}>변경 내용</Text> : null}
          <View style={{ borderWidth: 1, borderColor: T.line, borderRadius: radius.md, overflow: 'hidden' }}>
            {kind === 'fixed_cost' && selected.affectedMonths.length ? <View testID="fixed-cost-affected-months" style={{
              gap: space.sm,
              paddingVertical: space.md, paddingHorizontal: space.lg,
              borderBottomWidth: selected.changes.length ? 1 : 0, borderBottomColor: T.line2,
            }}>
              <Text style={{ fontSize: TYPE.caption.fontSize, fontWeight: '700', color: COLOR.text.secondary }}>대상 월</Text>
              <Text style={{ fontSize: TYPE.caption.fontSize, fontWeight: '800', color: COLOR.text.primary }}>
                {groupedMonthLabels(selected.affectedMonths).join(', ')}
              </Text>
            </View> : null}
            {selected.changes.map((line, index) => <HistoryValueRow key={line.key} first={index === 0} stacked={kind === 'fixed_cost'} label={line.label} before={line.before} after={line.after} />)}
          </View>
        </View> : null}
        {!selected.changes.length ? <Text style={{ ...TYPE.captionSm, color: COLOR.text.secondary, marginTop: space.lg }}>기록된 값 변경 없음</Text> : null}
        {selectedBlocker ? <Text style={{ ...TYPE.captionSm, color: COLOR.text.secondary, marginTop: space.lg }}>{selectedBlocker}</Text> : null}
        {selectedCanRevert ? <Button full size="lg" kind="gray" style={{ marginTop: space.lg }} disabled={revert.isPending} onPress={() => setRevertTarget(selected)}>
          이전 상태로 복구
        </Button> : null}
        <Button full size="lg" style={{ marginTop: space.sm }} onPress={() => setSelected(null)}>닫기</Button>
      </ScrollView> : null}
    </Sheet>

    <ConfirmDialog
      visible={revertTarget !== null}
      title="이전 상태로 복구할까요?"
      message={revertTarget?.affectedMonths.length
        ? `${groupedMonthLabels(revertTarget.affectedMonths).join(', ')}의 고정 지출과 설정을 변경 전 상태로 복구합니다. 복구 내역은 새 기록으로 남아요.`
        : '고정 지출을 변경 전 상태로 복구합니다. 복구 내역은 새 기록으로 남아요.'}
      confirmText="복구"
      kind="danger"
      loading={revert.isPending}
      onCancel={() => setRevertTarget(null)}
      onConfirm={() => {
        if (!revertTarget?.latestChangeId) return;
        revert.mutate({ changeId: revertTarget.id, latestChangeId: revertTarget.latestChangeId }, {
          onSuccess: () => { setRevertTarget(null); setSelected(null); },
          onError: error => {
            setRevertTarget(null);
            Alert.alert('복구하지 못했어요', error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.');
          },
        });
      }}
    />
  </View>;
}

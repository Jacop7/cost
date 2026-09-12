import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Button, Card, Icon, QueryState, Sheet } from '@/components/kit';
import { SummaryCard } from '@/components/history/HistoryLayout';
import { HistoryValueRow } from '@/components/history/HistoryValueRow';
import { useBusinessDay } from '@/features/business-day/businessDay';
import { safeBack } from '@/lib/nav';
import { COLOR, T, TYPE, space, minTouchTarget } from '@/theme/tokens';
import { changeStamp } from '../hooks';
import { useConfigurationHistory, type ConfigurationEvent } from '../configurationHistory';

export default function ConfigurationHistoryScreen() {
  const params = useLocalSearchParams<{ kind?: string; month?: string }>();
  const kind = params.kind === 'fixed_cost' ? 'fixed_cost' : 'tax';
  const month = kind === 'fixed_cost' && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month ?? '') ? params.month : undefined;
  const history = useConfigurationHistory(kind, month);
  const timezone = useBusinessDay().data?.timezone;
  const [selected, setSelected] = useState<ConfigurationEvent | null>(null);
  const items = history.data?.pages.flatMap(page => page.items) ?? [];
  const title = kind === 'tax' ? '세금' : `고정 지출${month ? ` · ${month}` : ''}`;
  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <AppHeader title="수정 내역" onBack={() => safeBack(kind === 'tax' ? '/my/tax' : `/recipes/fixed-cost${month ? `?month=${month}` : ''}`)} />
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}>
      <SummaryCard label={title} value={history.data ? `${history.data.pages[0]?.count ?? 0}건` : '—'} />
      <QueryState isLoading={history.isLoading} error={history.error} isEmpty={!items.length} emptyTitle="아직 기록된 수정 내역이 없어요" onRetry={() => void history.refetch()}>
        <Card pad={0}>
          {items.map((event, index) => <Pressable key={event.id} accessibilityRole="button" accessibilityLabel={`${event.title} ${changeStamp(event.occurredAt, timezone)}`} onPress={() => setSelected(event)}
            style={{ minWidth: minTouchTarget, minHeight: minTouchTarget, padding: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm, borderBottomWidth: index === items.length - 1 ? 0 : 1, borderBottomColor: T.line2 }}>
            <View style={{ flex: 1, gap: space.xs }}>
              <Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary }}>{changeStamp(event.occurredAt, timezone)}</Text>
              <Text style={{ ...TYPE.body, color: COLOR.text.primary }}>{event.title}</Text>
              <Text style={{ ...TYPE.captionSm, color: COLOR.text.secondary }}>{event.changes[0]?.label ?? '적용 시점'}{event.changes.length > 1 ? ` 외 ${event.changes.length - 1}개 항목 변경` : ' 변경'}</Text>
              {event.effectiveFrom ? <Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary }}>{event.applicationMode === 'immediate' ? '즉시 적용' : event.applicationMode === 'next_business' ? '영업 종료 후 적용' : `${event.effectiveFrom}부터 적용`}</Text> : null}
            </View><Icon name="chevron" size={16} color={COLOR.text.tertiary} />
          </Pressable>)}
        </Card>
      </QueryState>
      {history.hasNextPage ? <Button kind="ghost" onPress={() => void history.fetchNextPage()} disabled={history.isFetchingNextPage}>더 보기</Button> : null}
    </ScrollView>
    <Sheet visible={selected !== null} title="수정 내용" onClose={() => setSelected(null)}>
      {selected ? <View style={{ paddingBottom: space.xl, gap: space.sm }}>
        <Text style={{ ...TYPE.body, color: COLOR.text.primary }}>{selected.title}</Text>
        <Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary }}>{changeStamp(selected.occurredAt, timezone)}</Text>
        {selected.effectiveFrom ? <Text style={{ ...TYPE.captionSm, color: COLOR.text.secondary }}>{selected.applicationMode === 'immediate' ? '즉시 적용' : selected.applicationMode === 'next_business' ? '영업 종료 후 적용' : `${selected.effectiveFrom}부터 적용`}</Text> : null}
        {selected.changes.map((line, index) => <HistoryValueRow key={line.key} first={index === 0} label={line.label} before={line.before} after={line.after} />)}
      </View> : null}
    </Sheet>
  </View>;
}

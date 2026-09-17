import { Pressable, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { Icon } from '@/components/kit';
import { RecentChangeCard } from './RecentChangeCard';
import { DetailRowIcon } from '@/components/kit/DetailRowIcon';
import { COLOR, COMPONENT, space, minTouchTarget } from '@/theme/tokens';
import { RecentChangeRow } from './RecentChangeRow';
import { useConfigurationHistory, type ConfigurationKind, type FixedCostHistoryScope } from '../configurationHistory';
import { useBusinessDay } from '@/features/business-day/businessDay';
import { addDays, storeDateTimeParts } from '@/lib/date';

export function ConfigurationHistoryLink({ kind, month, scope }: { kind: ConfigurationKind; month?: string; scope?: FixedCostHistoryScope }) {
  const effectiveScope: FixedCostHistoryScope = scope ?? (kind === 'fixed_cost' && month ? 'monthly' : 'all');
  const router = useRouter(); const history = useConfigurationHistory(kind, month, effectiveScope);
  const latest = history.data?.pages[0]?.items[0];
  const businessDay = useBusinessDay().data;
  const occurred = latest && businessDay ? storeDateTimeParts(latest.occurredAt, businessDay.timezone) : null;
  const occurredDate = occurred ? `${occurred.year}-${occurred.month}-${occurred.day}` : null;
  const fixedRecent = kind !== 'fixed_cost' || Boolean(occurredDate && businessDay
    && occurredDate >= addDays(businessDay.localDate, -6) && occurredDate <= businessDay.localDate);
  const pending = kind === 'fixed_cost' && latest?.applicationMode === 'next_business'
    && (businessDay?.status === 'open' || businessDay?.status === 'break')
    && Number.isFinite(Date.parse(latest.occurredAt))
    && Number.isFinite(Date.parse(businessDay.openedAt ?? ''))
    && Date.parse(latest.occurredAt) > Date.parse(businessDay.openedAt ?? '');
  const close = pending && businessDay?.plannedCloseAt
    ? storeDateTimeParts(businessDay.plannedCloseAt, businessDay.timezone) : null;
  const fixedStatusLabel = pending
    ? close ? `${Number(close.month)}/${Number(close.day)} 반영 예정` : '매출 작성 완료 후 반영'
    : '현재 매출에 반영 중';
  const open = () => router.push(`/my/configuration-history?kind=${kind}${kind === 'fixed_cost' && effectiveScope !== 'all' ? `&scope=${effectiveScope}` : ''}${month ? `&month=${month}` : ''}` as Href);
  if (kind === 'fixed_cost' && (!latest || !fixedRecent)) return null;
  return <RecentChangeCard>
    {latest ? <RecentChangeRow standalone statusLabel={kind === 'fixed_cost' ? fixedStatusLabel : undefined} stampLabel={kind === 'fixed_cost' ? '수정' : undefined} change={{ ...latest, eventId: latest.id, hasHistory: true, displayState: null, hasPendingChange: kind === 'fixed_cost' ? false : history.data?.pages[0]?.hasPendingChange, pendingOccurredAt: history.data?.pages[0]?.pendingOccurredAt }} onPress={open} />
      : <Pressable accessibilityRole="button" accessibilityLabel={`${kind === 'tax' ? '세금' : kind === 'material' ? '부자재' : '고정 지출'} 수정 내역 보기`} onPress={open}
        style={{ minWidth: minTouchTarget, minHeight: minTouchTarget, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <DetailRowIcon name="history" />
        <View style={{ flex: 1, gap: space.xs, alignItems: 'flex-end' }}>
          <Text style={{ ...COMPONENT.detailMeta.label, fontSize: COMPONENT.recentChange.labelFontSize }}>최근 변경</Text>
          <Text style={{ ...COMPONENT.recentChange.timestamp, color: COLOR.text.tertiary }}>{history.isLoading ? '확인 중' : history.error ? '내역 확인이 필요해요' : '기록 없음'}</Text>
        </View>
        <Icon name="chevron" size={16} color={COLOR.text.tertiary} />
      </Pressable>}
  </RecentChangeCard>;
}

/** 적용 중·적용 대기 상태와 수정 일시를 같은 공통 행으로 표시한다. */
import { Pressable, Text, View } from 'react-native';
import { Icon } from '@/components/kit';
import { DetailRowIcon } from '@/components/kit/DetailRowIcon';
import { COLOR, COMPONENT, T, space, TYPE, minTouchTarget } from '@/theme/tokens';
import { changeTime, stateLabel, type LastChange } from '../hooks';
import { useBusinessDay } from '@/features/business-day/businessDay';

export function RecentChangeRow({ change, onPress, standalone = false }: { change: LastChange; onPress: () => void; standalone?: boolean }) {
  const timezone = useBusinessDay().data?.timezone;
  const timestamp = changeTime(change.occurredAt, timezone);
  const pending = change.hasPendingChange ?? (change.hasHistory && (change.displayState === 'not_reflected' || change.displayState === 'partial'));
  // An unrelated latest edit must not be used as the pending change's date.
  const pendingAt = change.pendingOccurredAt ?? (change.displayState === 'not_reflected' || change.displayState === 'partial' ? change.occurredAt : '');
  const pendingTimestamp = changeTime(pendingAt, timezone);
  const currentLabel = stateLabel('reflected').text;
  const pendingLabel = '영업 종료 후 반영 예정';
  const stamp = timestamp ? `${timestamp} ${change.hasHistory ? '수정' : '등록'}` : '일시 확인 필요';
  const pendingStamp = pendingTimestamp ? `${pendingTimestamp} 수정` : '수정 일시 확인 필요';
  const row = (label: string, time: string, icon: 'history' | 'hourglass') => (
    <View key={icon} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: minTouchTarget, alignSelf: 'stretch' }}>
      <DetailRowIcon name={icon} />
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, alignItems: 'flex-start' }}>
        <Text style={{ ...TYPE.body, color: COLOR.text.primary }} numberOfLines={2}>{label}</Text>
      </View>
      <Text style={{ ...COMPONENT.recentChange.timestamp, color: T.sub, flexShrink: 0 }} numberOfLines={1}>{time}</Text>
      <Icon name="chevron" size={16} color={COLOR.text.tertiary} />
    </View>
  );
  return <Pressable onPress={onPress} accessibilityRole="button"
    accessibilityLabel={`${stamp} · ${currentLabel}${pending ? ` · ${pendingLabel} · ${pendingStamp}` : ''}. 수정 내역 보기`}
    style={{ flexDirection: 'column', gap: space.sm, marginTop: standalone ? 0 : space.md,
      minHeight: minTouchTarget, paddingTop: standalone ? 0 : space.md,
      borderTopWidth: standalone ? 0 : 1, borderTopColor: T.line2 }}>
    {row(currentLabel, stamp, 'history')}
    {pending ? row(pendingLabel, pendingStamp, 'hourglass') : null}
  </Pressable>;
}

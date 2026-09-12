import { Pressable, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { Card, Icon } from '@/components/kit';
import { DetailRowIcon } from '@/components/kit/DetailRowIcon';
import { COLOR, COMPONENT, space, minTouchTarget } from '@/theme/tokens';
import { RecentChangeRow } from './RecentChangeRow';
import { useConfigurationHistory, type ConfigurationKind } from '../configurationHistory';

export function ConfigurationHistoryLink({ kind, month }: { kind: ConfigurationKind; month?: string }) {
  const router = useRouter(); const history = useConfigurationHistory(kind, month);
  const latest = history.data?.pages[0]?.items[0];
  const open = () => router.push(`/my/configuration-history?kind=${kind}${month ? `&month=${month}` : ''}` as Href);
  return <Card>
    {latest ? <RecentChangeRow standalone change={{ occurredAt: latest.occurredAt, eventId: latest.id, hasHistory: true, displayState: null }} onPress={open} />
      : <Pressable accessibilityRole="button" accessibilityLabel={`${kind === 'tax' ? '세금' : '고정 지출'} 수정 내역 보기`} onPress={open}
        style={{ minWidth: minTouchTarget, minHeight: minTouchTarget, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <DetailRowIcon name="history" />
        <View style={{ flex: 1, gap: space.xs }}>
          <Text style={COMPONENT.detailMeta.label}>최근 수정</Text>
          <Text style={{ ...COMPONENT.recentChange.timestamp, color: COLOR.text.tertiary }}>{history.isLoading ? '확인 중' : history.error ? '내역 확인이 필요해요' : '기록 없음'}</Text>
        </View>
        <Icon name="chevron" size={16} color={COLOR.text.tertiary} />
      </Pressable>}
  </Card>;
}

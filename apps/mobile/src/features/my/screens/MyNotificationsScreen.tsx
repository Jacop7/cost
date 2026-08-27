/**
 * MY-06 알림 설정 — 4종 on/off. 켜고 끄면 서버에 저장된다.
 *
 * 이전에는 지역 상태라 화면을 나갔다 오면 원래대로 돌아갔다.
 */
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { AppHeader, Badge, Card, Icon, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';
import { useSaveSettings, useStoreSettings, type SaveSettingsInput, type StoreSettings } from '../hooks';

type Key = 'alertMorningSummary' | 'alertInboundDelay' | 'alertPriceSpike' | 'alertTargetMiss';

const ITEMS: { key: Key; name: string; desc: string; badge?: string }[] = [
  { key: 'alertMorningSummary', name: '아침 발주 요약', desc: '곧 소진·안전재고 미달 후보를 08:00에 묶어서', badge: '08:00' },
  { key: 'alertInboundDelay', name: '입고 지연', desc: '발주한 건의 도착 예정일이 지났을 때' },
  { key: 'alertPriceSpike', name: '단가 급등', desc: '입고 단가가 직전 평균보다 20% 이상 높을 때' },
  { key: 'alertTargetMiss', name: '목표 미달 전환', desc: '메뉴 순이익률이 목표 아래로 처음 떨어질 때' },
];

function Toggle({ on, disabled, onPress, label }: { on: boolean; disabled?: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on, disabled: Boolean(disabled) }}
      hitSlop={8}
      style={{ width: 50, height: 30, borderRadius: 15, backgroundColor: on ? T.blue : '#D5DAE0', justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}
    >
      <View style={{ position: 'absolute', left: on ? 23 : 3, width: 24, height: 24, borderRadius: 12, backgroundColor: T.onColor, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 2 }} />
    </Pressable>
  );
}

export default function MyNotificationsScreen() {
  const settings = useStoreSettings();
  const save = useSaveSettings();

  const s = settings.data;
  const onCount = s ? ITEMS.filter((it) => s[it.key]).length : 0;

  const toggle = (key: Key) => {
    if (!s) return;
    save.mutate({ [key]: !s[key] } as Partial<SaveSettingsInput>, {
      onError: (e) => Alert.alert('바꾸지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="알림 설정" onBack={() => safeBack('/my')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28 }}>
        <QueryState
          isLoading={settings.isLoading}
          error={settings.error}
          isEmpty={false}
          onRetry={() => void settings.refetch()}
          emptyTitle=""
        >
          <Text style={{ fontSize: 14, color: T.ter, marginHorizontal: 4, marginBottom: 10 }}>4종 중 {onCount}개 켜짐</Text>
          <Card pad={0} style={{ overflow: 'hidden' }}>
            {ITEMS.map((n, i) => (
              <View key={n.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 15, borderBottomWidth: i < ITEMS.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{n.name}</Text>
                    {n.badge ? <Badge tone="blue" sm>{n.badge}</Badge> : null}
                  </View>
                  <Text style={{ fontSize: 14, color: T.ter, marginTop: 3, lineHeight: 19 }}>{n.desc}</Text>
                </View>
                <Toggle on={Boolean(s?.[n.key])} disabled={save.isPending} onPress={() => toggle(n.key)} label={n.name} />
              </View>
            ))}
          </Card>
        </QueryState>

        <View style={{ flexDirection: 'row', gap: 7, marginTop: 14, marginHorizontal: 4, alignItems: 'flex-start' }}>
          <Icon name="info" size={15} color={T.ter} />
          <Text style={{ flex: 1, fontSize: 14, color: T.ter, lineHeight: 20 }}>
            아침 발주 요약은 곧 소진·안전재고 미달 후보를 1건으로 묶어서 보내요. 알림 발송은 서버 작업이 붙은 뒤 동작해요.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

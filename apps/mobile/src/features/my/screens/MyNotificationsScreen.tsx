/**
 * MY-06 알림 설정 — 4종 알림 on/off. ⚠ 디자인 프로토타입(로컬 상태·데모).
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AppHeader, Badge, Card, Icon } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';
import { MY_NOTIFICATIONS } from '../demoData';

function Toggle({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ width: 50, height: 30, borderRadius: 15, backgroundColor: on ? T.blue : '#D5DAE0', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', left: on ? 23 : 3, width: 24, height: 24, borderRadius: 12, backgroundColor: T.onColor, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 2 }} />
    </Pressable>
  );
}

export default function MyNotificationsScreen() {
  const [states, setStates] = useState(MY_NOTIFICATIONS.map((n) => n.on));
  const toggle = (i: number) => setStates((s) => s.map((v, k) => (k === i ? !v : v)));

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="알림 설정" onBack={() => safeBack('/my')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28 }}>
        <Card pad={0} style={{ overflow: 'hidden' }}>
          {MY_NOTIFICATIONS.map((n, i) => (
            <View key={n.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 15, borderBottomWidth: i < MY_NOTIFICATIONS.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{n.name}</Text>
                  {i === 0 ? <Badge tone="blue" sm>08:00</Badge> : null}
                </View>
                <Text style={{ fontSize: 14, color: T.ter, marginTop: 3, lineHeight: 19 }}>{n.desc}</Text>
              </View>
              <Toggle on={states[i] ?? false} onPress={() => toggle(i)} />
            </View>
          ))}
        </Card>
        <View style={{ flexDirection: 'row', gap: 7, marginTop: 14, marginHorizontal: 4, alignItems: 'flex-start' }}>
          <Icon name="info" size={15} color={T.ter} />
          <Text style={{ flex: 1, fontSize: 14, color: T.ter, lineHeight: 20 }}>아침 발주 요약은 곧 소진·안전재고 미달 후보를 1건으로 묶어서 보내요.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

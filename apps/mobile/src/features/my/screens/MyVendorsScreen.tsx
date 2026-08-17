/**
 * MY-05 구매처·브랜드 — 병합 제안 + 구매처 목록(이름변경·병합·숨김). ⚠ 디자인 프로토타입(정적·데모).
 */
import { ScrollView, Text, View } from 'react-native';
import { AppHeader, Badge, Button, Card, Icon } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';
import { MY_VENDORS } from '../demoData';

export default function MyVendorsScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="구매처·브랜드" onBack={() => safeBack('/my')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 28 }}>
        {/* 병합 제안 */}
        <View style={{ backgroundColor: '#FFF9F0', borderWidth: 1, borderColor: T.amberTint, borderRadius: 16, padding: 14, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="swap" size={20} color={T.amberText} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: T.amberText }}>비슷한 구매처 발견</Text>
              <Text style={{ fontSize: 14, color: T.sub2, marginTop: 2 }}>'대림유통' · '대림 유통' — 같은 곳인가요?</Text>
            </View>
            <Button kind="primary" size="sm">병합</Button>
          </View>
        </View>

        <Text style={{ fontSize: 14, fontWeight: '700', color: T.ter, marginHorizontal: 4, marginBottom: 8 }}>구매처 {MY_VENDORS.length}</Text>
        <Card pad={0} style={{ overflow: 'hidden' }}>
          {MY_VENDORS.map((v, i) => (
            <View key={v.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 14, paddingHorizontal: 15, borderBottomWidth: i < MY_VENDORS.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
              <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: T.line2, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="store" size={20} color={T.sub2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{v.name}</Text>
                  {v.dup ? <Badge tone="amber" sm>중복?</Badge> : null}
                </View>
                <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>구매 {v.count}건</Text>
              </View>
              <Icon name="chevron" size={16} color={T.line3} />
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

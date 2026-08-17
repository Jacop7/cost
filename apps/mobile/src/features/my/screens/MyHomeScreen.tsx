/**
 * MY-01 마이페이지 홈 — 사업장 · 월 순이익(추정) 히어로 + 설정 메뉴.
 * ⚠ 디자인 프로토타입(정적·데모). 실데이터/저장은 데이터 연결 단계에서.
 */
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Icon, IconName } from '@/components/kit';
import { T, won } from '@/theme/tokens';
import { MY_COMMON } from '../demoData';

const NUM = { fontVariant: ['tabular-nums' as const] };

interface MenuItem { icon: IconName; bg: string; fg: string; t: string; d: string; route: Href | null; }
const SECTIONS: MenuItem[] = [
  { icon: 'won', bg: '#EBF3FE', fg: '#3182F6', t: '고정 지출 (월)', d: '인건비·수수료·포장 등 → 고정지출률', route: '/recipes/fixed-cost' as Href },
  { icon: 'trend', bg: '#E7F7F0', fg: '#15B374', t: '월 손익 리포트', d: '매출 − 고정 − 재료비', route: '/my/report' as Href },
  { icon: 'grid', bg: '#F0EDFB', fg: '#7C5CE0', t: '카테고리 관리', d: '식재료 · 레시피 · 부자재 분류', route: '/my/categories' as Href },
  { icon: 'ruler', bg: '#FEF1E6', fg: '#E08A2B', t: '단위 설정', d: '미터법 (기본)', route: '/my/units' as Href },
  { icon: 'store', bg: '#EAF6F0', fg: '#179E6B', t: '구매처·브랜드', d: '이름변경 · 병합 · 숨김', route: '/my/vendors' as Href },
  { icon: 'tag', bg: '#FDEEF0', fg: '#F04452', t: '목표 순이익률 기본값', d: '40%', route: null },
  { icon: 'bell', bg: '#FFF5E0', fg: '#D99A1C', t: '알림 설정', d: '4종 · 3개 켜짐', route: '/my/notifications' as Href },
  { icon: 'clipboard', bg: '#EEF1F4', fg: '#4E5968', t: '관리', d: '식재료 · 레시피 · 부자재 관리', route: '/my/manage' as Href },
];

export default function MyHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const c = MY_COMMON;
  const go = (r: Href | null) => r && router.push(r);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* 헤더 */}
      <View style={{ paddingTop: insets.top, backgroundColor: T.bg }}>
        <View style={{ paddingLeft: 20, paddingRight: 16, paddingTop: 8, paddingBottom: 12 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: T.ink, letterSpacing: -0.6 }}>마이페이지</Text>
          <Text style={{ fontSize: 14, color: T.sub2, marginTop: 3, fontWeight: '500' }}>기준값과 월 경영 데이터를 관리해요</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28, gap: 11 }}>
        {/* 사업장 */}
        <Card pad={16} style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
          <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: T.ink, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="store" size={24} color={T.onColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: T.ink }}>한끼 백반</Text>
            <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>일반 식당 · 미터법</Text>
          </View>
          <Icon name="chevron" size={18} color={T.line3} />
        </Card>

        {/* 이번 달 순이익 히어로 */}
        <View style={{ backgroundColor: T.blue, borderRadius: 16, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.85)' }}>2026.06 월 순이익 (추정)</Text>
            <Pressable onPress={() => go('/my/report' as Href)} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: T.onColor }}>리포트</Text>
              <Icon name="chevron" size={14} color={T.onColor} />
            </Pressable>
          </View>
          <Text style={[{ fontSize: 22, fontWeight: '800', color: T.onColor, letterSpacing: -0.6 }, NUM]}>{won(c.netProfit)}<Text style={{ fontSize: 16 }}>원</Text></Text>
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
            {([['순이익률', `${c.netRate}%`], ['고정지출률', `${c.rate}%`], ['재료비율', `${c.materialPct}%`]] as const).map(([l, v]) => (
              <View key={l}>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>{l}</Text>
                <Text style={[{ fontSize: 16, fontWeight: '800', color: T.onColor, marginTop: 1 }, NUM]}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 메뉴 */}
        <Card pad={0} style={{ overflow: 'hidden' }}>
          {SECTIONS.map((s, i) => (
            <Pressable key={s.t} onPress={() => go(s.route)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 15, borderBottomWidth: i < SECTIONS.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
              <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: s.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={s.icon} size={20} color={s.fg} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{s.t}</Text>
                <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>{s.d}</Text>
              </View>
              <Icon name="chevron" size={18} color={T.line3} />
            </Pressable>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

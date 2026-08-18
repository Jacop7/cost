/**
 * MY-01 마이페이지 홈 — 사업장 + 설정 메뉴.
 * ⚠ 디자인 프로토타입(정적·데모). 실데이터/저장은 데이터 연결 단계에서.
 */
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getLocale } from '@sikjae/core';
import { Card, Icon, IconName } from '@/components/kit';
import { T } from '@/theme/tokens';
import { useSettings, useUnitDigits } from '../store';

interface MenuItem { icon: IconName; bg: string; fg: string; t: string; d: string; route: Href | null; }
/** 언어·통화·단위는 현재 선택값을 설명줄에 보여야 해서 함수로 둔다(나머지는 정적). */
const sections = (localeDesc: string, unitDesc: string): MenuItem[] => [
  { icon: 'won', bg: T.blueTint, fg: T.blue, t: '고정 지출 (월)', d: '인건비·수수료·포장 등 → 고정지출률', route: '/recipes/fixed-cost' as Href },
  { icon: 'grid', bg: '#F0EDFB', fg: '#7C5CE0', t: '카테고리 관리', d: '식재료 · 레시피 · 부자재 분류', route: '/my/categories' as Href },
  { icon: 'globe', bg: '#E8F1FB', fg: '#2E6FD0', t: '언어 · 통화', d: localeDesc, route: '/my/language' as Href },
  { icon: 'ruler', bg: '#FEF1E6', fg: '#E08A2B', t: '단위 설정', d: unitDesc, route: '/my/units' as Href },
  { icon: 'store', bg: '#EAF6F0', fg: '#179E6B', t: '구매처·브랜드', d: '이름변경 · 병합 · 숨김', route: '/my/vendors' as Href },
  { icon: 'bell', bg: '#FFF5E0', fg: '#D99A1C', t: '알림 설정', d: '4종 · 3개 켜짐', route: '/my/notifications' as Href },
];

export default function MyHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const go = (r: Href | null) => r && router.push(r);
  const L = getLocale(useSettings((s) => s.locale));
  const unitDigits = useUnitDigits();
  const SECTIONS = sections(`${L.label} · ${L.currencyName} (${L.currency})`, `미터법 · 단가 소수 ${unitDigits}자리`);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* 헤더 */}
      <View style={{ paddingTop: insets.top, backgroundColor: T.bg }}>
        <View style={{ paddingLeft: 20, paddingRight: 16, paddingTop: 8, paddingBottom: 12 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: T.ink, letterSpacing: -0.6 }}>마이페이지</Text>
          <Text style={{ fontSize: 14, color: T.sub2, marginTop: 3, fontWeight: '600' }}>기준값과 기본 설정을 관리해요</Text>
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

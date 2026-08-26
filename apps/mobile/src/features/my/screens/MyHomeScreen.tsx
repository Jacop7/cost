/**
 * MY-01 마이페이지 홈 — 사업장 + 설정 메뉴.
 * 설명줄은 실제 저장값을 보여준다. 고정 문구를 두면 설정을 바꿔도 그대로라 반영 여부를 알 수 없다.
 */
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getLocale } from '@sikjae/core';
import { Card, Icon, IconName } from '@/components/kit';
import { T } from '@/theme/tokens';
import { useSettings, useUnitDigits } from '../store';
import { useHoursStatus, useSettingsLists, useStoreName, useStoreSettings } from '../hooks';

interface MenuItem { icon: IconName; bg: string; fg: string; t: string; d: string; route: Href | null; }
/** 언어·통화·단위는 현재 선택값을 설명줄에 보여야 해서 함수로 둔다(나머지는 정적). */
const sections = (d: {
  locale: string; unit: string; category: string; vendor: string; channel: string; hours: string; alert: string;
}): MenuItem[] => [
  { icon: 'won', bg: T.blueTint, fg: T.blue, t: '고정 지출 (월)', d: '인건비·수수료·포장 등 → 고정지출률', route: '/recipes/fixed-cost' as Href },
  // 세금은 매장 하나에 하나다(0087). 고치면 전 메뉴 손익이 다시 계산된다.
  { icon: 'receipt', bg: T.blueTint, fg: T.blue, t: '세금', d: '부가세 · 카드 수수료 등 판매가에서 빠지는 몫', route: '/my/tax' as Href },
  { icon: 'grid', bg: '#F0EDFB', fg: '#7C5CE0', t: '카테고리 관리', d: d.category, route: '/my/categories' as Href },
  { icon: 'globe', bg: '#E8F1FB', fg: '#2E6FD0', t: '언어 · 통화', d: d.locale, route: '/my/language' as Href },
  { icon: 'ruler', bg: '#FEF1E6', fg: '#E08A2B', t: '단위 설정', d: d.unit, route: '/my/units' as Href },
  { icon: 'store', bg: '#EAF6F0', fg: '#179E6B', t: '구매처', d: d.vendor, route: '/my/vendors' as Href },
  { icon: 'receipt', bg: '#FDECEF', fg: '#D94A5E', t: '판매 채널', d: d.channel, route: '/my/channels' as Href },
  { icon: 'calendar', bg: '#EDF3FF', fg: '#3A6FD8', t: '영업시간', d: d.hours, route: '/my/hours' as Href },
  { icon: 'bell', bg: '#FFF5E0', fg: '#D99A1C', t: '알림 설정', d: d.alert, route: '/my/notifications' as Href },
];

export default function MyHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const go = (r: Href | null) => r && router.push(r);
  const L = getLocale(useSettings().locale);
  const unitDigits = useUnitDigits();
  const lists = useSettingsLists();
  const settings = useStoreSettings();
  // 요일별 규칙(0156)을 알아야 '월요일 값'을 전체인 양 말하지 않는다.
  const hoursStatus = useHoursStatus();
  const storeName = useStoreName();

  // 수수료는 고정 지출에서 관리한다(0043). 여기서는 어떤 채널을 쓰는지만 보인다.
  const activeChannels = (lists.data?.channels ?? []).filter((c) => c.active);
  const channelDesc = activeChannels.length === 0
    ? '등록된 채널 없음'
    : activeChannels.map((c) => c.name).join(' · ');

  /*
   * 종료 시각이 영업일 경계라 자정을 넘는지 함께 보인다(0047).
   * ⚠ 이 값은 표시 폼(settings)의 **월요일** 시간이다 — 요일별 설정(0156)이 들어온 뒤로
   *   전체 영업시간처럼 보이면 거짓말이 된다. 요일마다 다르면 그렇다고 말한다.
   */
  const perDay = (() => {
    const wh = hoursStatus.data?.currentRule?.weeklyHours as Record<string, { open?: string; close?: string; closed?: boolean }> | undefined;
    if (!wh) return false;
    const keys = Array.from({ length: 7 }, (_, d) => JSON.stringify(wh[String(d)] ?? null));
    return new Set(keys).size > 1;
  })();
  const hoursDesc = settings.data
    ? perDay
      ? '요일마다 달라요'
      : `${settings.data.openTime} ~ ${settings.data.overnight ? '익일 ' : ''}${settings.data.closeTime}`
        + ` · ${Math.round(settings.data.openMinutes / 60)}시간`
    : '설정 안 됨';

  const alertOn = settings.data
    ? [settings.data.alertMorningSummary, settings.data.alertInboundDelay, settings.data.alertPriceSpike, settings.data.alertTargetMiss].filter(Boolean).length
    : 0;

  const SECTIONS = sections({
    locale: `${L.label} · ${L.currencyName} (${L.currency})`,
    unit: `미터법 · 단가 소수 ${unitDigits}자리`,
    category: `식재료 ${lists.data?.categories.length ?? 0} · 레시피 ${lists.data?.recipeCategories.length ?? 0} · 부자재 ${lists.data?.materials.length ?? 0}`,
    vendor: `${lists.data?.vendors.length ?? 0}곳 등록`,
    channel: channelDesc,
    hours: hoursDesc,
    alert: `4종 · ${alertOn}개 켜짐`,
  });

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
            <Text style={{ fontSize: 18, fontWeight: '800', color: T.ink }}>{storeName.data ?? '매장'}</Text>
            <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>{L.label} · 미터법</Text>
          </View>
        </Card>

        {/* 메뉴 */}
        <Card pad={0} style={{ overflow: 'hidden' }}>
          {SECTIONS.map((s, i) => (
            <Pressable key={s.t} onPress={() => go(s.route)} accessibilityRole="button" accessibilityLabel={s.t} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 15, borderBottomWidth: i < SECTIONS.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
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

/**
 * MY-02 고정 지출 (월) — zip 프로토타입(RCP-04) 디자인. 레시피 상세 '자세히 보기'로 진입.
 * 총매출 · 항목별 카드(회색 헤더 + 채널 비중 칩 · 금액/% 세로 · 소계) · 공통 지출 합계(고정지출률) · 수정(→ E4).
 * ⚠ 디자인 프로토타입(정적). 실제 입력/저장(E4)은 데이터 연결 단계에서.
 */
import { ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { AppHeader, Badge, Button, Card, Icon } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';

const NUM = { fontVariant: ['tabular-nums' as const] };
const REVENUE = 28_500_000;

interface CostSection {
  title: string;
  channels: string[]; // 적용 채널
  weights: Record<string, number>; // 채널별 배분 비중(%)
  rows: { name: string; amt: number }[];
}

const SECTIONS: CostSection[] = [
  { title: '인건비', channels: ['매장', '배달', '포장'], weights: { 매장: 30, 배달: 50, 포장: 20 }, rows: [{ name: '월 인건비', amt: 4_800_000 }] },
  { title: '플랫폼 수수료', channels: ['배달'], weights: { 배달: 100 }, rows: [{ name: '배민', amt: 1_650_000 }, { name: '쿠팡이츠', amt: 960_000 }] },
  { title: '포장비', channels: ['배달', '포장'], weights: { 배달: 70, 포장: 30 }, rows: [{ name: '중대용기', amt: 225_000 }, { name: '소용기', amt: 155_000 }] },
  { title: '배달/배송 (대행)', channels: ['배달'], weights: { 배달: 100 }, rows: [{ name: '바로고', amt: 540_000 }] },
  { title: '광고/홍보', channels: ['매장', '배달', '포장'], weights: { 매장: 30, 배달: 50, 포장: 20 }, rows: [{ name: '인스타 광고', amt: 253_000 }] },
];

const subtotal = (s: CostSection) => s.rows.reduce((sum, r) => sum + r.amt, 0);
const TOTAL = SECTIONS.reduce((sum, s) => sum + subtotal(s), 0);
const RATE = TOTAL / REVENUE;
const pctOf = (amt: number) => `${((amt / REVENUE) * 100).toFixed(1)}%`;

function Section({ s }: { s: CostSection }) {
  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      {/* 회색 헤더 — 제목 + 채널 비중 칩 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingVertical: 13, paddingHorizontal: 15, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: T.sub, marginRight: 2 }}>{s.title}</Text>
        {s.channels.map((c) => (
          <View key={c} style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: T.blueTint }}>
            <Text style={[{ fontSize: 13, fontWeight: '700', color: T.blue }, NUM]}>{c} {s.weights[c]}%</Text>
          </View>
        ))}
      </View>
      <View style={{ paddingHorizontal: 15, paddingTop: 4, paddingBottom: 15 }}>
        {s.rows.map((r, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: i < s.rows.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.ink2 }}>{r.name}</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(r.amt)}</Text>
              <Text style={[{ fontSize: 14, fontWeight: '600', color: T.ter, marginTop: 2 }, NUM]}>{pctOf(r.amt)}</Text>
            </View>
          </View>
        ))}
        {/* 소계 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: T.line }}>
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink2 }}>소계</Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(subtotal(s))}원</Text>
            <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub2, marginTop: 2 }, NUM]}>{pctOf(subtotal(s))}</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

export default function FixedCostScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="고정 지출" onBack={() => safeBack('/recipes')} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 24, gap: 11 }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: T.ink, paddingHorizontal: 2 }}>평균 3개월 기준</Text>

        {/* 총 월매출 */}
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 16 }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink }}>총 월매출</Text>
            <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(REVENUE)}</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: T.sub2, marginLeft: 4 }}>원</Text>
          </View>
        </Card>

        {SECTIONS.map((s) => (
          <Section key={s.title} s={s} />
        ))}

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: 2, marginTop: 2 }}>
          <Icon name="info" size={15} color={T.ter} />
          <Text style={{ flex: 1, fontSize: 14, color: T.ter, lineHeight: 20 }}>
            배달·포장에만 드는 비용(수수료·대행·용기)은 해당 채널에 직접 반영하고, 인건비·임대 등 공유 비용은 채널 매출 비중으로 자동 배분됩니다.
          </Text>
        </View>
      </ScrollView>

      {/* 하단 합계 + 수정 */}
      <View style={{ paddingHorizontal: 20, paddingTop: 11, paddingBottom: 30, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 11 }}>
          <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.sub2 }}>공통 지출 합계</Text>
          <Text style={[{ fontSize: 18, fontWeight: '800', color: T.ink, marginRight: 8 }, NUM]}>{won(TOTAL)}원</Text>
          <Badge tone="blue" sm>{(RATE * 100).toFixed(1)}%</Badge>
        </View>
        <Button kind="primary" size="lg" full onPress={() => router.push('/recipes/fixed-cost-edit' as Href)}>
          수정
        </Button>
      </View>
    </View>
  );
}

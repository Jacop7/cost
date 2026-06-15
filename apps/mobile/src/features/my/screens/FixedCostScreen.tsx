/**
 * MY-02 고정 지출 (월) — 프로토타입 ScreenMY08 기준. 레시피 상세 '자세히 보기'로 진입.
 * 월 선택 · 총매출 · 인건비 · 플랫폼/포장/배달/광고 항목별(소계) · 공통 지출 합계(고정지출률) · 저장(→ E4 전 레시피 반영).
 * ⚠ 디자인 프로토타입(정적). 실제 입력/저장(E4)은 데이터 연결 단계에서.
 */
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppHeader, Badge, Button, Card, Icon } from '@/components/kit';
import { T, won } from '@/theme/tokens';

const NUM = { fontVariant: ['tabular-nums' as const] };

const REVENUE = 28_500_000;

interface CostRow {
  name: string;
  desc?: string;
  amt: number;
}
interface CostSection {
  title: string;
  tag: string;
  rows: CostRow[];
}

const SECTIONS: CostSection[] = [
  {
    title: '인건비',
    tag: '총액 입력',
    rows: [{ name: '월 인건비', desc: '정직원 · 아르바이트 합계', amt: 4_800_000 }],
  },
  {
    title: '플랫폼 수수료',
    tag: '플랫폼별 입력',
    rows: [
      { name: '배민', desc: '중개 6.8 · 결제 3.0% · 배달비 420건', amt: 1_650_000 },
      { name: '쿠팡이츠', desc: '중개 9.8 · 결제 3.0% · 배달비 총액', amt: 960_000 },
    ],
  },
  {
    title: '포장비',
    tag: '규격별 입력',
    rows: [
      { name: '중대용기', desc: '450원 × 500개', amt: 225_000 },
      { name: '소용기', desc: '500원 × 310개', amt: 155_000 },
    ],
  },
  {
    title: '배달/배송 (대행)',
    tag: '업체별 입력',
    rows: [{ name: '바로고', desc: '180건 × 3,000원', amt: 540_000 }],
  },
  {
    title: '광고/홍보',
    tag: '채널별 입력',
    rows: [{ name: '인스타 광고', desc: '월 정액', amt: 253_000 }],
  },
];

const subtotal = (s: CostSection) => s.rows.reduce((sum, r) => sum + r.amt, 0);
const TOTAL = SECTIONS.reduce((sum, s) => sum + subtotal(s), 0);
const RATE = TOTAL / REVENUE;

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <Card pad={16}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ flex: 1, fontSize: 15.5, fontWeight: '800', color: T.ink }}>{label}</Text>
        <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>
          {won(value)} <Text style={{ fontSize: 13, fontWeight: '700', color: T.sub2 }}>원</Text>
        </Text>
      </View>
    </Card>
  );
}

function Section({ s }: { s: CostSection }) {
  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      <View style={{ paddingHorizontal: 15, paddingTop: 14, paddingBottom: 10 }}>
        <Text style={{ fontSize: 15.5, fontWeight: '800', color: T.ink }}>{s.title}</Text>
      </View>
      {s.rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 11, borderTopWidth: 1, borderTopColor: T.line2 }}>
          <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: T.ink }}>{r.name}</Text>
          <Text style={[{ fontSize: 15, fontWeight: '700', color: T.ink }, NUM]}>{won(r.amt)}</Text>
          <Text style={[{ fontSize: 12.5, fontWeight: '600', color: T.ter, width: 54, textAlign: 'right' }, NUM]}>{((r.amt / REVENUE) * 100).toFixed(1)}%</Text>
        </View>
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12, backgroundColor: T.surface2 }}>
        <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '800', color: T.sub }}>소계</Text>
        <Text style={[{ fontSize: 15, fontWeight: '800', color: T.ink }, NUM]}>{won(subtotal(s))}원</Text>
        <Text style={[{ fontSize: 12.5, fontWeight: '700', color: T.sub2, width: 54, textAlign: 'right' }, NUM]}>{((subtotal(s) / REVENUE) * 100).toFixed(1)}%</Text>
      </View>
    </Card>
  );
}

export default function FixedCostScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="고정 지출" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24, gap: 11 }}>
        {/* 기준 */}
        <Text style={{ fontSize: 18, fontWeight: '800', color: T.ink, paddingHorizontal: 4, paddingVertical: 2 }}>평균 3개월 기준</Text>

        <SummaryRow label="총 월매출" value={REVENUE} />

        {SECTIONS.map((s) => (
          <Section key={s.title} s={s} />
        ))}

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: 4, marginTop: 2 }}>
          <Icon name="info" size={15} color={T.ter} />
          <Text style={{ flex: 1, fontSize: 12, color: T.ter, lineHeight: 18 }}>
            저장하면 전 레시피의 고정 지출에 반영됩니다(고정지출률 재계산).
          </Text>
        </View>
      </ScrollView>

      {/* 하단 합계 + 저장 */}
      <View style={{ paddingHorizontal: 20, paddingTop: 11, paddingBottom: 30, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 11 }}>
          <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: T.sub2 }}>공통 지출 합계</Text>
          <Text style={[{ fontSize: 18, fontWeight: '800', color: T.ink, marginRight: 8 }, NUM]}>{won(TOTAL)}원</Text>
          <Badge tone="blue" sm>{(RATE * 100).toFixed(1)}%</Badge>
        </View>
        <Button kind="primary" size="lg" full onPress={() => router.back()}>
          저장 · 전 레시피 반영
        </Button>
      </View>
    </View>
  );
}

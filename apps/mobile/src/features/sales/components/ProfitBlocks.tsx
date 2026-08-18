/**
 * 손익 구성 블록 — 채널 구성 · 손익 계산 · 메뉴별 판매량.
 * SALES-02 매출 분석(기간별)과 SALES-03 일 손익 상세가 같은 구성을 쓰므로 여기로 뺀다.
 * 두 화면의 차이는 "어느 기간의 수치를 넣느냐"뿐이고, 표의 생김새·계산 표기는 하나여야 한다.
 */
import { Pressable, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { Badge, Card, Donut, Icon } from '@/components/kit';
import { T, won } from '@/theme/tokens';
import type { ChannelSeg, SaleMenu } from '../demoData';

const NUM = { fontVariant: ['tabular-nums' as const] };

/** 목표 순이익률 — 이 값 이상이면 '목표 달성'. */
const TARGET_RATE = 20;

export function SecLabel({ title, onPress }: { title: string; onPress?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 2, marginTop: 2 }}>
      <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: T.sub }}>{title}</Text>
      {onPress ? (
        <Pressable onPress={onPress} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue }}>자세히 보기</Text>
          <Icon name="chevron" size={15} color={T.blue} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** 채널 구성 — 도넛(가운데 순이익률) + 매장·배달·포장 금액·비중. */
export function ChannelMixCard({ revenue, profit, mix }: { revenue: number; profit: number; mix: ChannelSeg[] }) {
  const rate = revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0;
  const color = rate >= TARGET_RATE ? T.green : T.amberText;
  return (
    <Card pad={16} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <Donut size={120} thick={19} segments={mix} centerTop="순이익률" centerMain={`${rate}%`} mainSize={20} mainColor={color} />
      <View style={{ flex: 1 }}>
        <Text style={[{ fontSize: 14, color: T.ter, fontWeight: '700', marginBottom: 8 }, NUM]}>매출 {won(revenue)}원 · 채널 구성</Text>
        {mix.map((c) => (
          <View key={c.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 3 }}>
            <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: c.color }} />
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.sub2 }}>{c.label}</Text>
            <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub, marginRight: 8 }, NUM]}>{won(c.amt)}원</Text>
            <Text style={[{ width: 34, textAlign: 'right', fontSize: 14, fontWeight: '700', color: T.ter }, NUM]}>{c.value}%</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

export interface Breakdown {
  revenue: number;
  material: number;
  waste: number;
  extra: number;
  fixed: number;
  dailyExtra: number;
  tax: number;
  profit: number;
  qty: number;
}

/**
 * 손익 계산 — 매출에서 비용을 차감해 순이익까지. 각 행은 해당 상세 화면으로 연결.
 * qtyLabel 은 판매 수량 우측 표기('오늘 167개' · '5일 · 834개' 등) — 기간에 따라 달라진다.
 */
export function ProfitBreakdownCard({ b, qtyLabel }: { b: Breakdown; qtyLabel: string }) {
  const router = useRouter();
  const pctOf = (v: number) => (b.revenue > 0 ? Math.round((v / b.revenue) * 1000) / 10 : 0);
  const rate = pctOf(b.profit);
  const met = rate >= TARGET_RATE;
  const PROFIT = met ? T.green : T.amberText;

  const costs: [string, number, Href | null][] = [
    ['(−) 재료 원가', b.material, '/sales/material' as Href],
    ['(−) 폐기 손실', b.waste, null],
    ['(−) 부자재', b.extra, '/sales/extra' as Href],
    ['(−) 고정 지출', b.fixed, '/sales/fixed' as Href],
    ['(−) 추가 지출', b.dailyExtra, '/sales/expense' as Href],
    ['(−) 세금', b.tax, null],
  ];

  return (
    <Card onLine pad={0} style={{ overflow: 'hidden' }}>
      <View style={{ paddingHorizontal: 15, paddingTop: 4, paddingBottom: 15 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>판매 수량</Text>
          <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{qtyLabel}</Text>
          <View style={{ width: 15 }} />
        </View>
        <Pressable onPress={() => router.push('/sales/revenue' as Href)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.line }}>
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink }}>매출</Text>
          <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink, marginRight: 16 }, NUM]}>{won(b.revenue)}원</Text>
          <Text style={{ width: 44, textAlign: 'right', fontSize: 14, fontWeight: '600', color: T.ter }}>100%</Text>
          <Icon name="chevron" size={15} color={T.line3} />
        </Pressable>
        {costs.map(([n, v, route]) => (
          <Pressable key={n} onPress={route ? () => router.push(route) : undefined} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>{n}</Text>
            <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ter, marginRight: 16 }, NUM]}>{won(v)}원</Text>
            <Text style={[{ width: 44, textAlign: 'right', fontSize: 14, fontWeight: '600', color: T.ter }, NUM]}>{pctOf(v)}%</Text>
            <Icon name="chevron" size={15} color={route ? T.line3 : 'transparent'} />
          </Pressable>
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 13 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink, marginRight: 8 }}>순이익</Text>
          <Badge tone={met ? 'green' : 'amber'} sm>{met ? '목표 달성' : '목표 미달'}</Badge>
          <View style={{ flex: 1 }} />
          <Text style={[{ fontSize: 16, fontWeight: '800', color: PROFIT, marginRight: 16 }, NUM]}>{won(b.profit)}원</Text>
          <Text style={[{ width: 44, textAlign: 'right', fontSize: 14, fontWeight: '800', color: PROFIT }, NUM]}>{rate}%</Text>
          <View style={{ width: 15 }} />
        </View>
      </View>
    </Card>
  );
}

/** 메뉴별 판매량 — 판매량순 정렬, 기본 10개 + 더보기. 행 탭은 상위에서 처리(손익 시트). */
export function MenuSalesList({ menu, showAll, onShowAll, onSelect }: {
  menu: SaleMenu[];
  showAll: boolean;
  onShowAll: () => void;
  onSelect: (m: SaleMenu) => void;
}) {
  const sorted = [...menu].sort((a, b) => b.qty - a.qty);
  const list = showAll ? sorted : sorted.slice(0, 10);
  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      {list.map((m, i) => (
        <Pressable key={i} onPress={() => onSelect(m)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{m.name} <Text style={{ fontSize: 14, color: T.blue, fontWeight: '700' }}>×{m.qty}</Text></Text>
            <Text style={[{ fontSize: 14, color: T.ter, marginTop: 2 }, NUM]}>매장 {m.hall} · 배달 {m.delivery} · 포장 {m.takeout}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(m.price * m.qty)}원</Text>
            <Text style={[{ fontSize: 14, color: T.ter, marginTop: 2 }, NUM]}>지출 {won(m.cogs * m.qty)}</Text>
          </View>
          <Icon name="chevron" size={17} color={T.line3} />
        </Pressable>
      ))}
      {!showAll && sorted.length > 10 ? (
        <Pressable onPress={onShowAll} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 13 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue }}>더보기 ({sorted.length - 10}개)</Text>
          <Icon name="chevron" size={15} color={T.blue} />
        </Pressable>
      ) : null}
    </Card>
  );
}

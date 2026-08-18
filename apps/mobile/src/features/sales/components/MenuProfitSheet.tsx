/**
 * SALES-08 메뉴별 손익 시트 — 매출 비중만큼 고정지출·폐기·부자재를 자동 배분해 한 메뉴의 손익을 낸다.
 * 매출 분석(기간)·일 손익 상세 양쪽에서 쓰므로 컴포넌트로 뺀다.
 */
import { Pressable, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { Badge, Card, Icon, Sheet } from '@/components/kit';
import { T, won } from '@/theme/tokens';
import type { SaleMenu } from '../demoData';

const NUM = { fontVariant: ['tabular-nums' as const] };
const TARGET_RATE = 20;

export interface SheetTotals {
  revenue: number;
  waste: number;
  extra: number;
  fixed: number;
}

export function MenuProfitSheet({ sel, totals, periodLabel, onClose }: {
  sel: SaleMenu | null;
  totals: SheetTotals; // 배분 기준이 되는 기간 합계
  periodLabel: string; // '오늘' · '6월 14일 ~ 18일' 등
  onClose: () => void;
}) {
  const router = useRouter();
  return (
    <Sheet
      visible={sel != null}
      onClose={onClose}
      title={sel ? `${sel.name} 손익` : undefined}
      sub={sel ? `${periodLabel} ${sel.qty}개 판매 · 채널 배분 자동 계산` : undefined}
      height={600}
      headerRight={
        <Pressable onPress={() => { onClose(); router.push('/sales/menu' as Href); }} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 1, marginTop: 4 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue }}>자세히 보기</Text>
          <Icon name="chevron" size={15} color={T.blue} />
        </Pressable>
      }
    >
      {sel ? (() => {
        const revenue = sel.price * sel.qty;
        const material = sel.cogs * sel.qty;
        const share = totals.revenue > 0 ? revenue / totals.revenue : 0;
        const mWaste = Math.round((totals.waste * share) / 100) * 100;
        const mExtra = Math.round((totals.extra * share) / 100) * 100;
        const mFixed = Math.round((totals.fixed * share) / 1000) * 1000;
        const mTax = Math.round((revenue * 10) / 110);
        const mProfit = revenue - material - mWaste - mExtra - mFixed - mTax;
        const p = (v: number) => (revenue > 0 ? Math.round((v / revenue) * 1000) / 10 : 0);
        const met = p(mProfit) >= TARGET_RATE;
        const MPR = met ? T.green : T.amberText;
        const mCosts: [string, number][] = [
          ['(−) 재료 원가', material],
          ['(−) 폐기 손실', mWaste],
          ['(−) 부자재', mExtra],
          ['(−) 고정 지출', mFixed],
          ['(−) 세금', mTax],
        ];
        return (
          <View>
            <Card onLine pad={0} style={{ overflow: 'hidden', marginBottom: 12 }}>
              <View style={{ paddingHorizontal: 15, paddingTop: 4, paddingBottom: 15 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>판매 수량</Text>
                  <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink, marginRight: 12 }, NUM]}>{sel.qty}개</Text>
                  <Text style={{ width: 44, textAlign: 'right', fontSize: 14, fontWeight: '600', color: T.ter }}>—</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>채널 구성</Text>
                  <Text style={[{ fontSize: 14, fontWeight: '600', color: T.sub2 }, NUM]}>매장 {sel.hall} · 배달 {sel.delivery} · 포장 {sel.takeout}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.line }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink }}>매출</Text>
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink, marginRight: 12 }, NUM]}>{won(revenue)}원</Text>
                  <Text style={{ width: 44, textAlign: 'right', fontSize: 14, fontWeight: '600', color: T.ter }}>100%</Text>
                </View>
                {mCosts.map(([n, v]) => (
                  <View key={n} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                    <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>{n}</Text>
                    <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ter, marginRight: 12 }, NUM]}>{won(v)}원</Text>
                    <Text style={[{ width: 44, textAlign: 'right', fontSize: 14, fontWeight: '600', color: T.ter }, NUM]}>{p(v)}%</Text>
                  </View>
                ))}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 13 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink, marginRight: 8 }}>순이익</Text>
                  <Badge tone={met ? 'green' : 'amber'} sm>{met ? '목표 달성' : '목표 미달'}</Badge>
                  <View style={{ flex: 1 }} />
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: MPR, marginRight: 12 }, NUM]}>{won(mProfit)}원</Text>
                  <Text style={[{ width: 44, textAlign: 'right', fontSize: 14, fontWeight: '800', color: MPR }, NUM]}>{p(mProfit)}%</Text>
                </View>
              </View>
            </Card>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, backgroundColor: T.blueTint }}>
              <Icon name="info" size={15} color={T.blue} />
              <Text style={{ flex: 1, fontSize: 14, color: T.sub2, lineHeight: 20 }}>고정 지출은 이 메뉴의 매출 비중({Math.round(share * 100)}%)만큼 자동 배분됩니다.</Text>
            </View>
          </View>
        );
      })() : null}
    </Sheet>
  );
}

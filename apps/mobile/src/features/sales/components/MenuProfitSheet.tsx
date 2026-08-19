/**
 * SALES-08 메뉴별 손익 시트 — 매출 비중만큼 고정지출·폐기·수수료를 배분해 한 메뉴의 손익을 낸다.
 * 매출 분석(기간)·일 손익 상세 양쪽에서 쓰므로 컴포넌트로 뺀다.
 *
 * 재료비·부자재는 **판매 시점 스냅샷**이라 배분이 아니라 실제값이다.
 * 나머지(폐기·고정지출·추가지출)는 메뉴 하나에 귀속시킬 수 없어 매출 비중으로 나눈다 —
 * 화면에서 그 사실을 반드시 알린다. 배분값을 실제값처럼 보이게 하면 안 된다.
 */
import { Pressable, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { Badge, Card, Icon, Sheet } from '@/components/kit';
import { T, won } from '@/theme/tokens';
import type { RangeMenu, SalesSummary } from '../hooks';

const NUM = { fontVariant: ['tabular-nums' as const] };
const TARGET_RATE = 20;

export function MenuProfitSheet({ sel, summary, periodLabel, from, to, onClose }: {
  sel: RangeMenu | null;
  summary: SalesSummary;
  periodLabel: string;
  from: string;
  to: string;
  onClose: () => void;
}) {
  const router = useRouter();
  return (
    <Sheet
      visible={sel != null}
      onClose={onClose}
      title={sel ? `${sel.menuName} 손익` : undefined}
      sub={sel ? `${periodLabel} ${sel.qty}개 판매 · 공통 비용 자동 배분` : undefined}
      height={620}
      headerRight={
        sel?.recipeId ? (
          <Pressable
            onPress={() => { onClose(); router.push(`/sales/menu?recipe=${sel.recipeId}&from=${from}&to=${to}` as Href); }}
            hitSlop={6}
            accessibilityRole="button" accessibilityLabel="메뉴 손익 자세히 보기"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 1, marginTop: 4 }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue }}>자세히 보기</Text>
            <Icon name="chevron" size={15} color={T.blue} />
          </Pressable>
        ) : undefined
      }
    >
      {sel ? (() => {
        const revenue = sel.revenue;
        const share = summary.revenue > 0 ? revenue / summary.revenue : 0;

        // 실제값 — 판매 시점 스냅샷에서 그대로 온다.
        const material = sel.material;

        // 배분값 — 메뉴 하나에 귀속되지 않는 비용.
        const mWaste = summary.wasteLoss * share;
        const mFixed = summary.fixedCost * share;
        const mDaily = summary.dailyExtra * share;
        const mTax = summary.tax * share;
        const mProfit = revenue - material - mWaste - mFixed - mDaily - mTax;

        const p = (v: number) => (revenue > 0 ? Math.round((v / revenue) * 1000) / 10 : 0);
        const met = p(mProfit) >= TARGET_RATE;
        const MPR = met ? T.green : T.amberText;

        // [라벨, 금액, 배분값인가]
        const mCosts: [string, number, boolean][] = [
          ['(−) 재료 원가', material, false],
          ['(−) 폐기 손실', mWaste, true],
          ['(−) 고정 지출', mFixed, true],
          ['(−) 추가 지출', mDaily, true],
          ['(−) 세금', mTax, true],
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
                  <Text style={[{ fontSize: 14, fontWeight: '600', color: T.sub2 }, NUM]}>
                    매장 {sel.qtyHall} · 배달 {sel.qtyDelivery} · 포장 {sel.qtyTakeout}
                  </Text>
                </View>
                {sel.qtyWaste > 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                    <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>조리 폐기</Text>
                    <Text style={[{ fontSize: 14, fontWeight: '700', color: T.amberText }, NUM]}>{sel.qtyWaste}개 · 매출 0</Text>
                  </View>
                ) : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.line }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink }}>매출</Text>
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink, marginRight: 12 }, NUM]}>{won(revenue)}원</Text>
                  <Text style={{ width: 44, textAlign: 'right', fontSize: 14, fontWeight: '600', color: T.ter }}>100%</Text>
                </View>
                {mCosts.map(([n, v, allocated]) => (
                  <View key={n} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                    <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>
                      {n}
                      {allocated ? <Text style={{ fontSize: 14, color: T.ter, fontWeight: '600' }}> 배분</Text> : null}
                    </Text>
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
              <Text style={{ flex: 1, fontSize: 14, color: T.sub2, lineHeight: 20 }}>
                재료 원가는 판매 시점 실제값이고, ‘배분’이 붙은 항목은 이 메뉴의 매출 비중
                {' '}{Math.round(share * 1000) / 10}% 만큼 나눈 값이에요.
              </Text>
            </View>
          </View>
        );
      })() : null}
    </Sheet>
  );
}

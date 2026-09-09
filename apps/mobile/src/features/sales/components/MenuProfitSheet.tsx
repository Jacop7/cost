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
import { Icon, Sheet } from '@/components/kit';
import { COLOR, T, won, TYPE, radius, space } from '@/theme/tokens';
import type { RangeMenu, SalesSummary } from '../hooks';

const NUM = { fontVariant: ['tabular-nums' as const] };
const TARGET_RATE = 20;

/** 금액 아래 비율, 항목 아래 배분 근거를 두어 작은 화면에서도 열이 섞이지 않게 한다. */
function ProfitSummaryRow({ label, value, detail, percent, last = false }: {
  label: string; value: string; detail?: string; percent?: string; last?: boolean;
}) {
  return <View testID={`menu-profit/${label}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md,
    minHeight: 60, paddingVertical: space.md, borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line2 }}>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ ...TYPE.body, fontWeight: '700', color: T.ink }}>{label}</Text>
      {detail ? <Text style={{ ...TYPE.caption, color: T.sub2, marginTop: space.xs }}>{detail}</Text> : null}
    </View>
    <View style={{ flexShrink: 1, maxWidth: '60%', alignItems: 'flex-end' }}>
      <Text style={[TYPE.body, NUM, { fontWeight: '800', color: T.ink, textAlign: 'right' }]}>{value}</Text>
      {percent ? <Text style={[TYPE.caption, NUM, { color: T.sub2, marginTop: space.xs, textAlign: 'right' }]}>{percent}</Text> : null}
    </View>
  </View>;
}

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
      sub={sel ? `${periodLabel} · ${sel.qty}개 판매` : undefined}
      headerRight={
        sel?.recipeId ? (
          <Pressable
            onPress={() => { onClose(); router.push(`/sales/menu?recipe=${sel.recipeId}&from=${from}&to=${to}` as Href); }}
            hitSlop={6}
            accessibilityRole="button" accessibilityLabel="메뉴 손익 자세히 보기"
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 4 }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: COLOR.text.link }}>자세히 보기</Text>
            <Icon name="chevron" size={15} color={COLOR.action.primary} />
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
            <View style={{ marginBottom: space.md }}>
              <ProfitSummaryRow label="판매 수량" value={`${sel.qty}개`} />
              <ProfitSummaryRow label="채널 구성" value={`매장 ${sel.qtyHall} · 배달 ${sel.qtyDelivery} · 포장 ${sel.qtyTakeout}`} />
              {sel.qtyWaste > 0 ? <ProfitSummaryRow label="조리 폐기" value={`${sel.qtyWaste}개 · 매출 0`} /> : null}
              <ProfitSummaryRow label="매출" value={`${won(revenue)}원`} percent={`${p(revenue)}%`} />
              {mCosts.map(([n, v, allocated]) => <ProfitSummaryRow key={n} label={n} value={`${won(v)}원`}
                detail={allocated ? '배분' : undefined} percent={`${p(v)}%`} />)}
              <ProfitSummaryRow label="순이익" value={`${won(mProfit)}원`} percent={`${p(mProfit)}%`}
                detail={met ? '목표 달성' : '목표 미달'} last />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: 12, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: T.blueLine, backgroundColor: COLOR.action.primaryTint }}>
              <Icon name="info" size={15} color={COLOR.action.primary} />
              <Text style={{ flex: 1, fontSize: 14, color: T.sub2, lineHeight: TYPE.caption.lineHeight }}>
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

/**
 * SALES-08 메뉴별 손익 시트 — 판매 당시 메뉴에 직접 귀속되는 손익을 표시한다.
 * 매출 분석(기간)·일 손익 상세 양쪽에서 쓰므로 컴포넌트로 뺀다.
 *
 * 재료비·부자재는 **판매 시점 스냅샷**이라 배분이 아니라 실제값이다.
 * 세금·고정지출은 해당 메뉴의 기간 원장을 사용하고, 폐기는 해당 메뉴의 조리 후 폐기만 반영한다.
 * 메뉴 귀속 원장이 없는 식재료 폐기·추가 지출은 임의 배분하지 않는다.
 */
import { Pressable, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { Icon, Sheet, Notice, QueryState } from '@/components/kit';
import { COLOR, T, won, TYPE, radius, space } from '@/theme/tokens';
import { useRangeMenuDetail, type RangeMenu, type SalesSummary } from '../hooks';
import { percentOfTotal } from '../periodPercent';

const NUM = { fontVariant: ['tabular-nums' as const] };

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

type MenuProfitSheetProps = {
  sel: RangeMenu | null;
  summary: SalesSummary;
  periodLabel: string;
  from: string;
  to: string;
  onClose: () => void;
};

export function MenuProfitSheet(props: MenuProfitSheetProps) {
  // 닫힌 시트는 세션/장부 조회를 만들지 않는다.
  return props.sel ? <MenuProfitSheetContent {...props} /> : null;
}

function MenuProfitSheetContent({ sel, periodLabel, from, to, onClose }: MenuProfitSheetProps) {
  const router = useRouter();
  const ledger = useRangeMenuDetail(sel ? from : undefined, sel ? to : undefined, sel?.recipeId ?? undefined);
  return (
    <Sheet
      visible={sel != null}
      onClose={onClose}
      title={ledger.data?.sold ? `${ledger.data.name}${sel?.isDeleted ? ' (삭제 메뉴)' : ''} 손익` : '메뉴 손익'}
      sub={ledger.data?.sold ? `${periodLabel} · ${ledger.data.qty}개 판매` : periodLabel}
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
      <QueryState isLoading={ledger.isLoading} error={ledger.error}
        isEmpty={Boolean(sel) && !ledger.data?.sold} emptyTitle="이 기간에 판매 기록이 없어요"
        onRetry={() => { void ledger.refetch(); }}>
      {sel && ledger.data?.sold ? (() => {
        const recorded = ledger.data;
        const revenue = recorded.revenue;
        // 실제값 — 판매 시점 스냅샷에서 그대로 온다.
        const material = recorded.materialCost + recorded.extraCost;

        // 조리 후 폐기는 이 메뉴에 직접 귀속된 원장만 사용한다.
        const mWaste = recorded.wasteMenu;
        const mFixed = recorded.fixedCost;
        const mTax = recorded.tax;
        // 기간 RPC의 확정 메뉴 손익에는 조리 후 폐기가 이미 반영돼 있다.
        const mProfit = Number.isFinite(recorded.profit)
          ? recorded.profit
          : recorded.unitProfit * recorded.qty - mWaste;

        const p = (v: number) => percentOfTotal(v, revenue);
        const recordedChannels = recorded.channels ?? [];
        const channelSummary = recordedChannels.length > 0
          ? recordedChannels.filter(channel => channel.quantity > 0)
              .map(channel => `${channel.name} ${channel.quantity}`).join(' · ')
          : `매장 ${recorded.qtyHall} · 배달 ${recorded.qtyDelivery} · 포장 ${recorded.qtyTakeout}`;

        // 고정 지출만 영업일별 메뉴 매출 기준으로 배분한다.
        const mCosts: [string, number, string?][] = [
          ['(−) 재료 원가', material],
          ...(mWaste > 0 ? [['(−) 폐기 손실', mWaste, `조리 후 폐기 ${recorded.qtyWaste}개`] as [string, number, string]] : []),
          ['(−) 고정 지출', mFixed, '영업일별 배분'],
          // 판매가 세금 별도·레거시 기타 매출은 표시 매출에서 이 금액을 빼지 않는다.
          ['세금 (참고)', mTax],
        ];

        return (
          <View>
            <View style={{ marginBottom: space.md }}>
              <ProfitSummaryRow label="판매 수량" value={`${recorded.qty}개`} />
              <ProfitSummaryRow label="채널 구성" value={channelSummary || '판매 수량 없음'} />
              {recorded.qtyWaste > 0 ? <ProfitSummaryRow label="조리 후 폐기" value={`${recorded.qtyWaste}개 · 매출 0`} /> : null}
              <ProfitSummaryRow label="매출" value={`${won(revenue)}원`} percent={`${p(revenue)}%`} />
              {mCosts.map(([n, v, detail]) => <ProfitSummaryRow key={n} label={n} value={`${won(v)}원`}
                detail={detail} percent={`${p(v)}%`} />)}
              <ProfitSummaryRow label="순이익" value={`${won(mProfit)}원`} percent={`${p(mProfit)}%`} last />
            </View>
            <Notice>
              고정 지출은 각 영업일 기준으로 배분한 금액이에요. 폐기 손실은 이 메뉴에
              {' '}직접 기록된 조리 후 폐기만 반영해요.
            </Notice>
          </View>
        );
      })() : null}
      </QueryState>
    </Sheet>
  );
}

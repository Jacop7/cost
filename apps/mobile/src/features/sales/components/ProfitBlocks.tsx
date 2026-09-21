import { EmptyDataText } from '@/components/kit/EmptyDataText';
/**
 * 손익 구성 블록 — 채널별 매출 · 손익 계산 · 메뉴별 판매량.
 * SALES-02 매출 분석(기간별)과 SALES-03 일 손익 상세가 같은 구성을 쓰므로 여기로 뺀다.
 *
 * ⚠ 숫자는 전부 서버 `sales_summary()` 가 낸 값이다. 여기서 다시 계산하지 않는다 —
 *   비율 표기만 한다(절대원칙 3).
 *
 * ⚠ 0095 에서 **프로토타입 규격에 맞췄다**(`all-detail-history-screens.html?screen=day`).
 *   숫자·경로·계산은 한 줄도 안 건드렸고 배치와 글자만 바꿨다. 핵심은 둘이다 —
 *     ① 금액과 비율을 **세로로 쌓는다.** 가로로 나란히 두니 좁은 폭에서 `47.8 %` 가
 *        두 줄로 쪼개졌다(실제로 그랬다).
 *     ② 채널 카드의 '자세히 보기'는 **카드 안 맨 아래**다. 머리에 두면 섹션 제목과
 *        경쟁하고, 카드가 무엇을 여는지 멀어진다.
 */
import { Pressable, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { Card, Icon } from '@/components/kit';
import { COMPONENT, COLOR, T, won, TYPE, radius, rowMinHeight, space } from '@/theme/tokens';
import type { RangeChannel, RangeMenu, SalesSummary } from '../hooks';
import { nullablePercentOfTotal, percentOfTotalText } from '../periodPercent';

const NUM = { fontVariant: ['tabular-nums' as const] };
const CARD_INSET = COMPONENT.card.contentInset;

/** 목표 순이익률 — 이 값 이상이면 '목표 달성'. */
const TARGET_RATE = 20;

/** 프로토타입 `.sales-breakdown-row` — 화살표 자리는 있든 없든 폭을 차지한다(줄 맞춤). */
const ARROW_W = 16;

/**
 * 섹션 제목 — 메뉴 상세의 `판매 손익` 카드 제목과 같은 본문 크기를 쓴다.
 */
export function SecLabel({ title, right, onPress }: { title: string; right?: string; onPress?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 2, marginTop: 4, marginBottom: -3 }}>
      <Text style={{ flex: 1, ...TYPE.body, fontWeight: '800', color: T.sub }}>{title}</Text>
      {right ? <Text style={[{ fontSize: 13, fontWeight: '700', color: COLOR.text.tertiary }, NUM]}>{right}</Text> : null}
      {onPress ? (
        <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${title} 자세히 보기`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: COLOR.text.link }}>자세히 보기</Text>
          <Icon name="chevron" size={14} color={COLOR.action.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * 손익 카드의 한 줄 — 프로토타입 `.sales-breakdown-row`.
 *
 * 금액이 위, 비율이 아래다. 이 순서가 규격이다 — 사장님이 먼저 보는 건 돈이고,
 * 비율은 그 돈이 큰지 작은지 재는 자다.
 */
export function SalesRow({
  label, amount, percent, strong, tone, labelTone, percentTone, badge, arrow, onPress, last,
  reserveArrowSpace = true,
}: {
  label: string;
  amount: string;
  percent?: string;
  /** 매출·순이익처럼 눈에 먼저 들어와야 하는 줄. */
  strong?: boolean;
  /** 금액 색. 비율도 같이 물든다 — 프로토타입 `.sales-breakdown-row.profit` 이 둘 다 칠한다. */
  tone?: string;
  /** 라벨 색. 매출 분석의 순이익 줄만 라벨까지 초록이다(`.analysis-summary-row.profit>span`). */
  labelTone?: string;
  /** 비율 색을 따로 준다. 매출 분석 카드는 값만 칠하고 비율은 회색으로 둔다. */
  percentTone?: string;
  badge?: { text: string; met: boolean };
  arrow?: boolean;
  onPress?: () => void;
  last?: boolean;
  /** 상세 이동이 전혀 없는 카드에서는 값 끝선을 카드의 다른 우측 값과 맞춘다. */
  reserveArrowSpace?: boolean;
}) {
  const Wrap = onPress ? Pressable : View;
  return (
    <Wrap
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `${label.replace('(−) ', '')} 자세히 보기` : undefined}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: rowMinHeight.oneLine,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line2,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Text style={{ fontSize: TYPE.body.fontSize, lineHeight: TYPE.body.lineHeight, fontWeight: strong ? '800' : '700', color: labelTone ?? (strong ? T.ink : T.sub) }}>
          {label}
        </Text>
        {badge ? (
          <View style={{ paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.sm, backgroundColor: badge.met ? COLOR.status.positiveTint : COLOR.status.cautionTint }}>
            <Text style={{ fontSize: TYPE.captionSm.fontSize, fontWeight: '800', color: badge.met ? COLOR.status.positive : COLOR.status.caution }}>{badge.text}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[{ fontSize: TYPE.body.fontSize, lineHeight: TYPE.body.lineHeight, fontWeight: '800', color: tone ?? (strong ? T.ink : COLOR.text.tertiary) }, NUM]}>{amount}</Text>
        {percent ? (
          <Text style={[{ fontSize: TYPE.captionSm.fontSize, fontWeight: '700', color: percentTone ?? tone ?? COLOR.text.tertiary, marginTop: space.xs }, NUM]}>{percent}</Text>
        ) : null}
      </View>

      {reserveArrowSpace ? (
        <View testID="sales-row-arrow-space" style={{ width: ARROW_W, alignItems: 'flex-end' }}>
          {arrow ? <Icon name="chevron" size={16} color={T.line3} /> : null}
        </View>
      ) : null}
    </Wrap>
  );
}

/**
 * 상세 화면 머리 — 프로토타입 `.revenue-summary`.
 *
 * ⚠ 합계는 **머리에** 온다. 예전엔 목록 아래 있었는데, 재료가 20줄이면
 *   "그래서 얼마?"를 스크롤해서 찾아야 했다. 먼저 답하고 그다음에 내역이다.
 */
export function DetailSummary({ rows }: { rows: [string, string, string?, string?][] }) {
  return (
    <View style={{ backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line }}>
      {rows.map(([k, v, sub, tone], i) => (
        <View
          key={k}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: rowMinHeight.oneLine,
            paddingVertical: 12, paddingHorizontal: CARD_INSET,
            borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: T.line2,
          }}
        >
          <Text style={{ flex: 1, ...TYPE.body, color: T.sub }}>{k}</Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[{ ...TYPE.body, fontWeight: '800', color: tone ?? T.ink }, NUM]}>{v}</Text>
            {/* 고정지출률처럼 값 옆이 아니라 **아래**에 붙는 보조 숫자(프로토타입 규격). */}
            {sub ? <Text style={[{ fontSize: TYPE.captionSm.fontSize, fontWeight: '800', color: COLOR.text.accent, marginTop: space.xs }, NUM]}>{sub}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

/** 상세 카드 안 섹션 제목 — 프로토타입 `.detail-section-title`. */
export function DetailSection({ title, divider }: { title: string; divider?: boolean }) {
  return (
    <Text
      style={{
        paddingTop: space.md, paddingBottom: space.xs, paddingHorizontal: CARD_INSET,
        ...TYPE.body, fontWeight: '800', color: T.ink,
        borderTopWidth: divider ? 1 : 0, borderTopColor: T.line2, marginTop: divider ? 8 : 0,
      }}
    >
      {title}
    </Text>
  );
}

/** 상세 카드의 한 줄 — 프로토타입 `.detail-list-row`. 왼쪽 이름+보조, 오른쪽 금액+보조. */
export function DetailRow({ name, sub, amount, percent, muted, last, empty = false }: {
  name: string;
  sub?: string;
  amount: string;
  percent?: string;
  muted?: boolean;
  empty?: boolean;
  last?: boolean;
}) {
  const c = muted ? COLOR.text.tertiary : T.ink;
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: rowMinHeight.oneLine,
        paddingVertical: space.sm, paddingHorizontal: CARD_INSET,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line2,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        {empty ? <EmptyDataText numberOfLines={1}>{name}</EmptyDataText>
          : <Text style={{ ...TYPE.body, fontWeight: '800', color: c }} numberOfLines={1}>{name}</Text>}
        {sub ? <Text style={[{ fontSize: TYPE.captionSm.fontSize, fontWeight: '600', color: COLOR.text.tertiary, marginTop: space.xs }, NUM]}>{sub}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[{ ...TYPE.body, fontWeight: '800', color: c }, NUM]}>{amount}</Text>
        {percent ? <Text style={[{ fontSize: TYPE.captionSm.fontSize, fontWeight: '700', color: COLOR.text.tertiary, marginTop: space.xs }, NUM]}>{percent}</Text> : null}
      </View>
    </View>
  );
}

/**
 * 채널별 매출 — 프로토타입 `actualChannelMix`.
 *
 * ⚠ 도넛을 뺐다. 채널이 셋뿐이라 도넛이 알려 주는 건 줄에 적힌 비율과 같은 것이고,
 *   가운데 순이익률은 아래 손익 카드의 순이익 줄과 겹쳤다. 같은 말을 두 번 했다.
 */
export function ChannelMixCard({
  summary, channels, onMore,
}: { summary: SalesSummary; channels: RangeChannel[]; onMore?: () => void }) {
  const revenue = summary.revenue;

  // 최신 서버의 채널 금액에는 채널이 지정된 기타 매출까지 포함된다.
  // 차액은 채널 기능 도입 전 기록처럼 실제 귀속 채널을 알 수 없는 금액뿐이다.
  const chSum = channels.reduce((a, c) => a + c.amount, 0);
  const rest = Math.max(0, revenue - chSum);
  /*
   * 기본 3개를 먼저 두고 사용자 채널은 서버의 manifest 순서를 유지한다.
   * 금액순으로 재정렬하면 날짜마다 자리가 바뀌므로 사용하지 않는다.
   */
  const ORDER: Record<string, number> = { hall: 0, delivery: 1, takeout: 2 };
  const ordered = [...channels].sort((a, b) => (ORDER[a.code] ?? 9) - (ORDER[b.code] ?? 9));
  const rows = [
    ...ordered.map((c) => ({ label: c.name, amt: c.amount })),
    ...(rest > 0 ? [{ label: '채널 미지정', amt: rest }] : []),
  ].filter((r) => r.amt > 0);

  const pct = (v: number) => percentOfTotalText(v, revenue);

  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      <View style={{ paddingHorizontal: CARD_INSET, paddingTop: space.xs }}>
        {rows.map((r, i) => (
          <SalesRow
            key={r.label}
            label={r.label}
            amount={`${won(r.amt)}원`}
            percent={pct(r.amt)}
            strong
            last={i === rows.length - 1}
          />
        ))}
        {rows.length === 0 ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <EmptyDataText >판매 기록이 없어요</EmptyDataText>
          </View>
        ) : null}
      </View>

      {/* 프로토타입 `.channel-more` — 카드 안 맨 아래, 전체 폭. */}
      {onMore ? (
        <Pressable
          onPress={onMore}
          accessibilityRole="button" accessibilityLabel="채널별 손익 자세히 보기"
          style={{
            minHeight: COMPONENT.cardFooter.minHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs,
            borderTopWidth: 1, borderTopColor: T.line, backgroundColor: T.surface2,
          }}
        >
          <Text style={{ fontSize: COMPONENT.cardFooter.fontSize, fontWeight: '700', color: T.sub }}>자세히 보기</Text>
          <Icon name="chevron" size={16} color={T.sub2} />
        </Pressable>
      ) : null}
    </Card>
  );
}

/**
 * 손익 계산 — 매출에서 비용을 차감해 순이익까지. 각 줄이 해당 상세 화면으로 간다.
 * qtyLabel 은 판매 수량 우측 표기('54개' · '7일 · 834개' 등).
 */
export function ProfitBreakdownCard({
  summary, qtyLabel, from, to, profitFirst, blackAmounts,
}: {
  summary: SalesSummary;
  qtyLabel: string;
  from: string;
  to: string;
  /**
   * 비용 금액을 **검정**으로 표시한다(프로토타입 `.sales-breakdown.black-amounts`).
   */
  blackAmounts?: boolean;
  /**
   * 순이익을 **매출 바로 아래**로 올리고 그 아래 총 지출을 표시한다.
   */
  profitFirst?: boolean;
}) {
  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      <View style={{ paddingHorizontal: CARD_INSET, paddingTop: space.xs, paddingBottom: space.xs }}>
        <ProfitBreakdownRows
          summary={summary}
          qtyLabel={qtyLabel}
          from={from}
          to={to}
          profitFirst={profitFirst}
          blackAmounts={blackAmounts}
        />
      </View>

      {/* 고정지출률을 과거 월에서 빌려 쓴 상태면 그대로 확정값처럼 보이면 안 된다. */}
      {summary.fixedRateProvisional ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginHorizontal: CARD_INSET, marginBottom: 12, paddingVertical: space.sm, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: COLOR.status.cautionTint }}>
          <Icon name="info" size={15} color={COLOR.status.caution} />
          <Text style={{ flex: 1, fontSize: 13, color: COLOR.status.caution, lineHeight: TYPE.captionSm.lineHeight }}>
            이 달 고정 지출이 아직 없어 최근 입력값으로 잠정 계산했어요.
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

/**
 * 매출분석·일별 손익과 상세 화면이 같은 손익 행 순서를 공유한다.
 * 카드 외곽이 필요한 화면은 `ProfitBreakdownCard`, 다른 첫 카드 안에 넣는 화면은 이 행 묶음을 쓴다.
 */
export function ProfitBreakdownRows({
  summary, qtyLabel, from, to, profitFirst, blackAmounts,
  includeAdditionalExpense = true, linkDetails = true, targetRate = TARGET_RATE,
}: {
  summary: SalesSummary;
  qtyLabel: string;
  from: string;
  to: string;
  profitFirst?: boolean;
  blackAmounts?: boolean;
  /** 메뉴 손익처럼 공통 추가 지출을 귀속하지 않는 화면은 false. */
  includeAdditionalExpense?: boolean;
  /** 같은 페이지 아래에 해당 메뉴의 근거가 이어지면 전체 매출 상세 링크를 만들지 않는다. */
  linkDetails?: boolean;
  targetRate?: number;
}) {
  const router = useRouter();
  const q = `?from=${from}&to=${to}`;
  const pctOf = (v: number | null) => v == null ? '—' : percentOfTotalText(v, summary.revenue);
  const rate = nullablePercentOfTotal(summary.profit, summary.revenue);
  const totalExpense = summary.profit == null ? null : summary.revenue - summary.profit;
  const met = rate != null && rate >= targetRate;
  const PROFIT = met ? COLOR.status.positive : COLOR.status.caution;

  const costs: [string, number | null, Href][] = [
    ['(−) 재료', summary.materialCost + summary.extraMaterialCost, `/sales/material${q}` as Href],
    ['(−) 폐기 손실', summary.wasteLoss, `/sales/waste${q}` as Href],
    ['(−) 고정 지출', summary.fixedCost, `/sales/fixed${q}` as Href],
    ...(includeAdditionalExpense
      ? [['(−) 추가 지출', summary.dailyExtra, `/sales/expense${q}` as Href] as [string, number | null, Href]]
      : []),
    ...(summary.tax !== null && summary.tax !== 0
      ? [['(−) 세금', summary.tax, `/sales/tax${q}` as Href] as [string, number | null, Href]]
      : []),
  ];

  const profitRow = (last: boolean) => (
    <SalesRow
      label="순이익"
      badge={{ text: met ? '목표 달성' : '목표 미달', met }}
      amount={summary.profit == null ? '미산출' : `${won(summary.profit)}원`}
      percent={rate == null ? '—' : `${rate}%`}
      strong tone={PROFIT} last={last}
      reserveArrowSpace={linkDetails}
    />
  );

  return (
    <>
      <SalesRow label="판매 수량" amount={qtyLabel} strong reserveArrowSpace={linkDetails} />
      <SalesRow
        label="매출" amount={`${won(summary.revenue)}원`} percent={summary.revenue > 0 ? '100%' : '0%'} strong
        arrow={linkDetails}
        onPress={linkDetails ? () => router.push(`/sales/revenue${q}` as Href) : undefined}
        reserveArrowSpace={linkDetails}
      />
      {profitFirst ? profitRow(false) : null}
      {profitFirst ? (
        <SalesRow
          label="총 지출"
          amount={totalExpense == null ? '미산출' : `${won(totalExpense)}원`}
          percent={pctOf(totalExpense)}
          strong
          tone={blackAmounts ? T.ink : undefined}
          percentTone={COLOR.text.tertiary}
          reserveArrowSpace={linkDetails}
        />
      ) : null}
      {costs.map(([n, v, route], i) => (
        <SalesRow
          key={n}
          label={n}
          amount={v == null ? '미산출' : `${won(v)}원`}
          percent={pctOf(v)}
          tone={blackAmounts ? T.ink : undefined}
          percentTone={COLOR.text.tertiary}
          arrow={linkDetails}
          onPress={linkDetails ? () => router.push(route) : undefined}
          last={profitFirst && i === costs.length - 1}
          reserveArrowSpace={linkDetails}
        />
      ))}
      {profitFirst ? null : profitRow(true)}
    </>
  );
}

/** 메뉴별 판매량 — 프로토타입 `.sales-menu-row`. 판매량순, 기본 10개 + 더보기. */
export function MenuSalesList({ menu, totalRevenue, showAll, onShowAll, onSelect }: {
  menu: RangeMenu[];
  totalRevenue: number;
  showAll: boolean;
  onShowAll: () => void;
  onSelect: (m: RangeMenu) => void;
}) {
  const sorted = [...menu].sort((a, b) => b.qty - a.qty);
  const list = showAll ? sorted : sorted.slice(0, 10);
  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      {list.map((m, i) => (
        <Pressable
          key={m.recipeId ?? m.menuName}
          onPress={() => onSelect(m)}
          accessibilityRole="button" accessibilityLabel={`${m.menuName}${m.isDeleted ? ' 삭제 메뉴' : ''} 손익 보기`}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: rowMinHeight.twoLine,
            paddingVertical: space.md, paddingHorizontal: CARD_INSET,
            borderBottomWidth: i === list.length - 1 ? 0 : 1, borderBottomColor: T.line2,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ ...TYPE.body, fontWeight: '800', color: T.ink }} numberOfLines={1}>
              {m.menuName}
              {m.isDeleted ? <Text style={{ color: COLOR.text.tertiary, fontWeight: '700' }}> (삭제 메뉴)</Text> : null}
              {' '}<Text style={{ fontSize: TYPE.body.fontSize, color: COLOR.text.accent, fontWeight: '700' }}>×{m.qty}</Text>
            </Text>
            <Text style={[{ flexShrink: 1, fontSize: TYPE.captionSm.fontSize, fontWeight: '600', color: COLOR.text.tertiary, marginTop: 4 }, NUM]}>
              {(m.channels.length > 0
                ? m.channels.filter(channel => channel.quantity > 0)
                    .map(channel => `${channel.name} ${channel.quantity}`).join(' · ')
                : `매장 ${m.qtyHall} · 배달 ${m.qtyDelivery} · 포장 ${m.qtyTakeout}`)}
              {m.qtyWaste > 0 ? ` · 폐기 ${m.qtyWaste}` : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[{ ...TYPE.body, fontWeight: '800', color: T.ink }, NUM]}>{won(m.revenue)}원</Text>
            <Text style={[{ fontSize: TYPE.captionSm.fontSize, fontWeight: '700', color: COLOR.text.tertiary, marginTop: space.xs }, NUM]}>
              {percentOfTotalText(m.revenue, totalRevenue)}
            </Text>
          </View>
          <View style={{ width: ARROW_W, alignItems: 'flex-end' }}>
            <Icon name="chevron" size={16} color={T.line3} />
          </View>
        </Pressable>
      ))}
      {list.length === 0 ? (
        <View style={{ paddingVertical: 28, alignItems: 'center' }}>
          <EmptyDataText >이 기간에 판매된 메뉴가 없어요</EmptyDataText>
        </View>
      ) : null}
      {!showAll && sorted.length > 10 ? (
        <Pressable
          onPress={onShowAll}
          accessibilityRole="button" accessibilityLabel={`메뉴 ${sorted.length - 10}개 더 보기`}
          style={{
            minHeight: COMPONENT.cardFooter.minHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
            borderTopWidth: 1, borderTopColor: T.line, backgroundColor: T.surface2,
          }}
        >
          <Text style={{ fontSize: COMPONENT.cardFooter.fontSize, fontWeight: '700', color: T.sub }}>더보기 ({sorted.length - 10}개)</Text>
          <Icon name="chevronDown" size={15} color={T.sub2} />
        </Pressable>
      ) : null}
    </Card>
  );
}

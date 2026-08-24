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
import { T, won } from '@/theme/tokens';
import type { RangeChannel, RangeMenu, SalesSummary } from '../hooks';

const NUM = { fontVariant: ['tabular-nums' as const] };

/** 목표 순이익률 — 이 값 이상이면 '목표 달성'. */
const TARGET_RATE = 20;

/** 프로토타입 `.sales-breakdown-row` — 화살표 자리는 있든 없든 폭을 차지한다(줄 맞춤). */
const ARROW_W = 14;

/**
 * 섹션 제목 — 프로토타입 `.sales-section`.
 * 13px/800 이고 카드보다 **작다.** 제목이 카드 숫자보다 크면 눈이 제목에 먼저 걸린다.
 */
export function SecLabel({ title, right, onPress }: { title: string; right?: string; onPress?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 2, marginTop: 4, marginBottom: -3 }}>
      <Text style={{ flex: 1, fontSize: 13, fontWeight: '800', color: T.sub }}>{title}</Text>
      {right ? <Text style={[{ fontSize: 13, fontWeight: '700', color: T.ter }, NUM]}>{right}</Text> : null}
      {onPress ? (
        <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${title} 자세히 보기`} style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: T.blue }}>자세히 보기</Text>
          <Icon name="chevron" size={14} color={T.blue} />
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
}) {
  const Wrap = onPress ? Pressable : View;
  return (
    <Wrap
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `${label.replace('(−) ', '')} 자세히 보기` : undefined}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 55,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line2,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ fontSize: 15, fontWeight: strong ? '800' : '700', color: labelTone ?? (strong ? T.ink : T.sub) }}>
          {label}
        </Text>
        {badge ? (
          <View style={{ paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, backgroundColor: badge.met ? T.greenTint : T.amberTint }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: badge.met ? T.green : T.amberText }}>{badge.text}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[{ fontSize: 15, fontWeight: '800', color: tone ?? (strong ? T.ink : T.ter) }, NUM]}>{amount}</Text>
        {percent ? (
          <Text style={[{ fontSize: 12, fontWeight: '700', color: percentTone ?? tone ?? T.ter, marginTop: 3 }, NUM]}>{percent}</Text>
        ) : null}
      </View>

      <View style={{ width: ARROW_W, alignItems: 'flex-end' }}>
        {arrow ? <Icon name="chevron" size={16} color={T.line3} /> : null}
      </View>
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
            flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 47,
            paddingVertical: 12, paddingHorizontal: 15,
            borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: T.line2,
          }}
        >
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: T.sub }}>{k}</Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[{ fontSize: 15, fontWeight: '800', color: tone ?? T.ink }, NUM]}>{v}</Text>
            {/* 고정지출률처럼 값 옆이 아니라 **아래**에 붙는 보조 숫자(프로토타입 규격). */}
            {sub ? <Text style={[{ fontSize: 12, fontWeight: '800', color: T.blue, marginTop: 3 }, NUM]}>{sub}</Text> : null}
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
        paddingTop: 13, paddingBottom: 5, paddingHorizontal: 14,
        fontSize: 13, fontWeight: '800', color: T.ink,
        borderTopWidth: divider ? 1 : 0, borderTopColor: T.line2, marginTop: divider ? 8 : 0,
      }}
    >
      {title}
    </Text>
  );
}

/** 상세 카드의 한 줄 — 프로토타입 `.detail-list-row`. 왼쪽 이름+보조, 오른쪽 금액+보조. */
export function DetailRow({ name, sub, amount, percent, muted, last }: {
  name: string;
  sub?: string;
  amount: string;
  percent?: string;
  muted?: boolean;
  last?: boolean;
}) {
  const c = muted ? T.ter : T.ink;
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 52,
        paddingVertical: 9, paddingLeft: 10, paddingRight: 0,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line2,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: c }} numberOfLines={1}>{name}</Text>
        {sub ? <Text style={[{ fontSize: 12, fontWeight: '600', color: T.ter, marginTop: 3 }, NUM]}>{sub}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[{ fontSize: 15, fontWeight: '800', color: c }, NUM]}>{amount}</Text>
        {percent ? <Text style={[{ fontSize: 12, fontWeight: '700', color: T.ter, marginTop: 3 }, NUM]}>{percent}</Text> : null}
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

  // 채널 합계는 메뉴 매출만이라 기타 매출이 빠진다. 그 차액을 세워야 비율 합이 100% 가 된다.
  const chSum = channels.reduce((a, c) => a + c.amount, 0);
  const rest = Math.max(0, revenue - chSum);
  /*
   * ⚠ 순서는 **매장 · 배달앱 · 포장 고정**이다(프로토타입). 서버는 금액 내림차순으로
   *   주는데, 그러면 날마다 줄 순서가 바뀌어 어제 화면과 눈으로 못 겹친다.
   */
  const ORDER: Record<string, number> = { hall: 0, delivery: 1, takeout: 2 };
  const ordered = [...channels].sort((a, b) => (ORDER[a.code] ?? 9) - (ORDER[b.code] ?? 9));
  const rows = [
    ...ordered.map((c) => ({ label: c.name, amt: c.amount })),
    ...(rest > 0 ? [{ label: '기타 매출', amt: rest }] : []),
  ].filter((r) => r.amt > 0);

  const pct = (v: number) => (revenue > 0 ? `${Math.round((v / revenue) * 1000) / 10}%` : '0%');

  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      <View style={{ paddingHorizontal: 14, paddingTop: 5 }}>
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
            <Text style={{ fontSize: 14, color: T.ter }}>판매 기록이 없어요</Text>
          </View>
        ) : null}
      </View>

      {/* 프로토타입 `.channel-more` — 카드 안 맨 아래, 전체 폭. */}
      {onMore ? (
        <Pressable
          onPress={onMore}
          accessibilityRole="button" accessibilityLabel="채널별 손익 자세히 보기"
          style={{
            minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
            borderTopWidth: 1, borderTopColor: T.line, backgroundColor: T.surface2,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '800', color: T.sub }}>자세히 보기</Text>
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
   * 비용 금액을 **검정**으로(프로토타입 `.sales-breakdown.black-amounts`).
   * 일 손익은 회색, 매출 분석은 검정이다 — 기간을 볼 땐 비용 하나하나가 읽을 값이고,
   * 하루를 볼 땐 매출·순이익만 도드라지면 된다.
   */
  blackAmounts?: boolean;
  /**
   * 순이익을 **매출 바로 아래**로 올린다(매출 분석 규격).
   *
   * ⚠ 프로토타입은 두 화면의 순서가 다르다 — 일 손익은 비용을 다 빼고 맨 끝에,
   *   매출 분석은 매출 다음에 바로. 기간을 볼 땐 "얼마 남았나"가 첫 질문이고,
   *   하루를 볼 땐 무엇에 얼마나 썼는지 훑고 나서 결과를 본다.
   */
  profitFirst?: boolean;
}) {
  const router = useRouter();
  const q = `?from=${from}&to=${to}`;
  const pctOf = (v: number) => (summary.revenue > 0 ? `${Math.round((v / summary.revenue) * 1000) / 10}%` : '0%');
  const rate = summary.revenue > 0 ? Math.round((summary.profit / summary.revenue) * 1000) / 10 : 0;
  const met = rate >= TARGET_RATE;
  const PROFIT = met ? T.green : T.amberText;

  const costs: [string, number, Href][] = [
    ['(−) 재료 원가', summary.materialCost, `/sales/material${q}` as Href],
    ['(−) 부자재', summary.extraMaterialCost, `/sales/extra${q}` as Href],
    ['(−) 폐기 손실', summary.wasteLoss, `/sales/waste${q}` as Href],
    ['(−) 고정 지출', summary.fixedCost, `/sales/fixed${q}` as Href],
    ['(−) 추가 지출', summary.dailyExtra, `/sales/expense${q}` as Href],
    ['(−) 세금', summary.tax, `/sales/tax${q}` as Href],
  ];

  const profitRow = (last: boolean) => (
    <SalesRow
      label="순이익"
      badge={{ text: met ? '목표 달성' : '목표 미달', met }}
      amount={`${won(summary.profit)}원`}
      percent={`${rate}%`}
      strong tone={PROFIT} last={last}
    />
  );

  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      <View style={{ paddingHorizontal: 14, paddingTop: 5, paddingBottom: 5 }}>
        <SalesRow label="판매 수량" amount={qtyLabel} strong />
        <SalesRow
          label="매출" amount={`${won(summary.revenue)}원`} percent="100%" strong arrow
          onPress={() => router.push(`/sales/revenue${q}` as Href)}
        />
        {profitFirst ? profitRow(false) : null}
        {costs.map(([n, v, route], i) => (
          <SalesRow
            key={n}
            label={n}
            amount={`${won(v)}원`}
            percent={pctOf(v)}
            tone={blackAmounts ? T.ink : undefined}
            percentTone={T.ter}
            arrow
            onPress={() => router.push(route)}
            last={profitFirst && i === costs.length - 1}
          />
        ))}
        {profitFirst ? null : profitRow(true)}
      </View>

      {/* 고정지출률을 과거 월에서 빌려 쓴 상태면 그대로 확정값처럼 보이면 안 된다. */}
      {summary.fixedRateProvisional ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginHorizontal: 14, marginBottom: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: T.amberTint }}>
          <Icon name="info" size={15} color={T.amberText} />
          <Text style={{ flex: 1, fontSize: 13, color: T.amberText, lineHeight: 19 }}>
            이 달 고정지출이 아직 없어 최근 입력값으로 잠정 계산했어요.
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

/** 메뉴별 판매량 — 프로토타입 `.sales-menu-row`. 판매량순, 기본 10개 + 더보기. */
export function MenuSalesList({ menu, showAll, onShowAll, onSelect }: {
  menu: RangeMenu[];
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
          accessibilityRole="button" accessibilityLabel={`${m.menuName} 손익 보기`}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 70,
            paddingVertical: 11, paddingHorizontal: 14,
            borderBottomWidth: i === list.length - 1 ? 0 : 1, borderBottomColor: T.line2,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: T.ink }} numberOfLines={1}>
              {m.menuName} <Text style={{ fontSize: 14, color: T.blue, fontWeight: '700' }}>×{m.qty}</Text>
            </Text>
            <Text style={[{ fontSize: 12, fontWeight: '600', color: T.ter, marginTop: 4 }, NUM]} numberOfLines={1}>
              매장 {m.qtyHall} · 배달 {m.qtyDelivery} · 포장 {m.qtyTakeout}
              {m.qtyWaste > 0 ? ` · 폐기 ${m.qtyWaste}` : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[{ fontSize: 15, fontWeight: '800', color: T.ink }, NUM]}>{won(m.revenue)}원</Text>
            <Text style={[{ fontSize: 12, fontWeight: '700', color: T.ter, marginTop: 3 }, NUM]}>재료 {won(m.material)}</Text>
          </View>
          <View style={{ width: ARROW_W, alignItems: 'flex-end' }}>
            <Icon name="chevron" size={16} color={T.line3} />
          </View>
        </Pressable>
      ))}
      {list.length === 0 ? (
        <View style={{ paddingVertical: 28, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, color: T.ter }}>이 기간에 판매된 메뉴가 없어요</Text>
        </View>
      ) : null}
      {!showAll && sorted.length > 10 ? (
        <Pressable
          onPress={onShowAll}
          accessibilityRole="button" accessibilityLabel={`메뉴 ${sorted.length - 10}개 더 보기`}
          style={{
            minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
            borderTopWidth: 1, borderTopColor: T.line, backgroundColor: T.surface2,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '800', color: T.sub }}>더보기 ({sorted.length - 10}개)</Text>
          <Icon name="chevronDown" size={15} color={T.sub2} />
        </Pressable>
      ) : null}
    </Card>
  );
}

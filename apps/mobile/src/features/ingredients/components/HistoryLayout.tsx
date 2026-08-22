/**
 * 식재료 상세의 **내역 화면 공통 뼈대** (0089).
 *
 * 프로토타입 `all-detail-history-screens.html` 의 구조를 한 곳에 옮겼다.
 * 재고 내역 · 구매 이력 · 폐기 내역 · 수정 내역 · 구매 옵션 다섯이 같은 짜임을 쓴다.
 *
 *     [조건 줄]                    유형 ⌄   기간 ⌄
 *     [요약 카드]  라벨 ................. 값
 *                  칸1   칸2   칸3   칸4
 *     [월 머리말]  2026년 8월 .......... 총 7건
 *     [행 카드]    한 장에 구분선
 *
 * 화면마다 따로 그리면 다섯이 조금씩 달라진다 — 실제로 그랬다.
 * 여기 하나만 고치면 다섯이 같이 움직인다.
 */
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, Icon } from '@/components/kit';
import { T, tnum } from '@/theme/tokens';

/** 조건 줄 — **왼쪽부터** 채운다(프로토타입 `.condition`). 오른쪽은 건수 자리다. */
export function ConditionRow({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 6 }}>
      {children}
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}

/** 조건 줄의 버튼 하나 — `최근 3개월 ⌄`. */
export function FilterButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} 변경`}
      hitSlop={6}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, borderColor: T.line, backgroundColor: T.surface }}
    >
      <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub }}>{label}</Text>
      <Icon name="chevronDown" size={15} color={T.ter} />
    </Pressable>
  );
}

export interface Metric {
  label: string;
  value: string;
  /** 파랑=늘어난 것 · 빨강=나간 것 · 없으면 기본색. */
  tone?: 'blue' | 'red';
}

/**
 * 요약 카드 — 머리에 대표값, 아래 칸칸이 세부.
 *
 * ⚠ 칸은 **개수가 변해도 자리가 안 흔들리게** 항상 같은 것들을 그린다.
 *   0 이라고 감추면 어제 화면과 오늘 화면을 눈으로 못 겹친다.
 */
export function SummaryCard({ label, value, sub, metrics = [] }: {
  label: string;
  value: string;
  /** 대표값 옆 회색 보조 — `2,700원 · 9개` 의 뒷부분. */
  sub?: string;
  metrics?: Metric[];
}) {
  /*
   * ⚠ 칸은 **두 개씩 줄바꿈**한다(프로토타입 `.summary-grid` = 2열).
   *   네 개를 한 줄에 밀어 넣으면 '판매 소진' 같은 라벨이 잘리고 숫자도 좁아진다.
   */
  const pairs: Metric[][] = [];
  for (let i = 0; i < metrics.length; i += 2) pairs.push(metrics.slice(i, i + 2));

  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 15 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: T.sub }}>{label}</Text>
        <View style={{ flex: 1 }} />
        <Text style={[{ fontSize: 18, fontWeight: '800', color: T.ink }, tnum]}>{value}</Text>
        {sub ? (
          <Text style={[{ fontSize: 12, fontWeight: '700', color: T.ter, marginLeft: 4 }, tnum]}>· {sub}</Text>
        ) : null}
      </View>
      {metrics.length > 0 ? (
        <View style={{ paddingVertical: 12, paddingHorizontal: 15, gap: 14, borderTopWidth: 1, borderTopColor: T.line2 }}>
          {pairs.map((pair, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 14 }}>
              {pair.map((m) => (
                <View key={m.label} style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 12, color: T.ter, fontWeight: '700', marginBottom: 4 }} numberOfLines={1}>
                    {m.label}
                  </Text>
                  <Text
                    style={[{ fontSize: 15, fontWeight: '800', color: m.tone === 'blue' ? T.blue : m.tone === 'red' ? T.red : T.ink }, tnum]}
                    numberOfLines={1}
                  >
                    {m.value}
                  </Text>
                </View>
              ))}
              {/* 홀수 개면 마지막 줄의 빈 칸을 잡아 둔다 — 안 그러면 한 칸이 폭을 다 먹는다. */}
              {pair.length === 1 ? <View style={{ flex: 1 }} /> : null}
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

/** 월 머리말 — 왼쪽 `2026년 8월`, 오른쪽 `총 7건`. */
export function MonthHead({ month, count }: { month: string; count: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 6, marginBottom: 7 }}>
      <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: T.sub }}>{month}</Text>
      <Text style={[{ fontSize: 13, fontWeight: '600', color: T.ter }, tnum]}>총 {count}건</Text>
    </View>
  );
}

/** `2026-08` → `2026년 8월`. 다섯 화면이 같은 문장을 쓰게 여기서만 만든다. */
export const monthTitle = (ym: string) => `${ym.slice(0, 4)}년 ${Number(ym.slice(5, 7))}월`;

/** 날짜 문자열(`2026-08-20`)로 월별 묶음을 만든다. 순서는 들어온 대로 지킨다. */
export function groupByMonth<T>(rows: T[], dateOf: (r: T) => string): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const ym = dateOf(r).slice(0, 7);
    const arr = m.get(ym);
    if (arr) arr.push(r);
    else m.set(ym, [r]);
  }
  return [...m.entries()];
}

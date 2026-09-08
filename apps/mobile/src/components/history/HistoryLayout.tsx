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
import { LAYOUT, COLOR, T, tnum, TYPE, space } from '@/theme/tokens';

/** 조건 줄 — **왼쪽부터** 채운다(프로토타입 `.condition`). 오른쪽은 건수 자리다. */
export function ConditionRow({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, minHeight: 44, marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, flex: 1, minWidth: 0 }}>
        {children}
      </View>
      {right ? <View style={{ marginLeft: 'auto', maxWidth: '100%' }}>{right}</View> : null}
    </View>
  );
}

/**
 * 조건 줄의 버튼 하나 — `최근 3개월 ⌄`.
 * ⚠ 정의는 **kit 한 곳**이다(0096). 매출 분석도 같은 버튼을 쓰므로 두 벌이 되면 어긋난다.
 */
export { FilterButton } from '@/components/kit';

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
   * 칸은 최대 두 개씩 묶되, 긴 값/큰 글자는 칸 전체가 다음 줄로 이동한다.
   * 줄바꿈을 막거나 숫자를 축소·말줄임하지 않는다. 45%는 두 칸과 gap을 위한
   * 이 컴포넌트의 배치 하한이며 전역 크기 토큰이 아니다.
   */
  const pairs: Metric[][] = [];
  for (let i = 0; i < metrics.length; i += 2) pairs.push(metrics.slice(i, i + 2));

  return (
    <Card pad={0} style={{ overflow: 'hidden', marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs, paddingVertical: space.md, paddingHorizontal: space.md }}>
        <Text style={{ maxWidth: '100%', fontSize: TYPE.caption.fontSize, fontWeight: '800', color: T.sub }}>{label}</Text>
        {/* Keep value + supporting amount in one role group. When text grows the
            group moves below the label, instead of compressing all three columns. */}
        <View style={{ flexGrow: 1, maxWidth: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: space.xs }}>
          <Text style={[{ maxWidth: '100%', fontSize: 18, fontWeight: '800', color: T.ink }, tnum]}>{value}</Text>
          {sub ? (
            <Text style={[{ maxWidth: '100%', fontSize: TYPE.captionSm.fontSize, fontWeight: '700', color: COLOR.text.tertiary }, tnum]}>· {sub}</Text>
          ) : null}
        </View>
      </View>
      {metrics.length > 0 ? (
        <View style={{ paddingVertical: 12, paddingHorizontal: space.md, gap: space.md, borderTopWidth: 1, borderTopColor: T.line2 }}>
          {pairs.map((pair, i) => (
            <View key={i} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
              {pair.map((m) => (
                <View key={m.label} style={{ flexGrow: 1, flexBasis: 'auto', minWidth: '45%', maxWidth: '100%' }}>
                  <Text style={{ fontSize: TYPE.captionSm.fontSize, color: COLOR.text.tertiary, fontWeight: '700', marginBottom: 4 }}>
                    {m.label}
                  </Text>
                  <Text
                    style={[{ fontSize: TYPE.caption.fontSize, fontWeight: '800', color: m.tone === 'blue' ? COLOR.text.accent : m.tone === 'red' ? COLOR.status.negative : T.ink }, tnum]}
                  >
                    {m.value}
                  </Text>
                </View>
              ))}
              {/* 홀수 개면 마지막 줄의 빈 칸을 잡아 둔다 — 안 그러면 한 칸이 폭을 다 먹는다. */}
              {pair.length === 1 ? <View style={{ flexGrow: 1, minWidth: '45%' }} /> : null}
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

/**
 * 월 머리말 — 왼쪽 `2026년 8월`, 오른쪽 `총 7건`.
 * 양쪽이 **같은 무게**다(프로토타입 `.month`). 한쪽만 흐리면 짝이 안 맞는다.
 */
export function MonthHead({ month, count, first = false }: { month: string; count: number; first?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: space.xs, marginTop: first ? 0 : 16, marginBottom: space.sm }}>
      <Text style={{ flex: 1, fontSize: 13, fontWeight: '800', color: T.sub }}>{month}</Text>
      <Text style={[{ fontSize: 13, fontWeight: '800', color: T.sub }, tnum]}>총 {count}건</Text>
    </View>
  );
}

/**
 * 내역 화면 본문의 공통 여백 — 프로토타입 `.content{padding:12px 16px 30px}`.
 * ⚠ 조건 줄은 **이 안**에 둔다. 헤더 밑에 고정하면 목록만 스크롤돼서
 *   프로토타입과 다른 화면이 된다.
 */
export const historyContent = { paddingHorizontal: 16, paddingTop: 12, paddingBottom: LAYOUT.scroll.end } as const;

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

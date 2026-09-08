/**
 * RCP-16 손익 변동.
 *
 * 사장님의 질문은 하나다 — **언제, 무엇 때문에, 얼마만큼.**
 *
 *   2026년 8월
 *   08/20 · 14:41
 *   고춧가루 단가 반영                        4,046.69원  ›
 *   재료비 32원 감소                              +32원
 *
 * 예전 화면은 `순이익률 33.72% · 재료비율 23.39%` 만 되뇌었다. 비율만으로는
 * "이번 달 얼마 손해 봤나"에 답할 수 없어서 금액을 남기게 했다(0083).
 *
 * 여기 없는 것들 — 전부 다른 화면의 몫이다.
 *   · 현재 순이익 요약 카드 → 레시피 상세에 이미 있다
 *   · 직접 수정 / 자동 갱신 → 수정 내역
 *   · 현재 매출 반영 배지   → 수정 내역
 *   · 전체 손익표          → 레시피 상세의 손익 미리보기
 */
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Button, Card, QueryState, Sheet } from '@/components/kit';
import { HistoryValueRow } from '@/components/history/HistoryValueRow';
import { monthLabel, changeStamp } from '@/features/changes';
import { safeBack } from '@/lib/nav';
import { LAYOUT, COLOR, T, TYPE, radius, space } from '@/theme/tokens';
import { useProfitHistory, type ProfitChange } from '../profitHistory';
import { ProfitChangeRow, formatProfitAmount as amount } from '../components/ProfitChangeRow';

function rate(v: number): string {
  return `${(Math.round(v * 100) / 100).toFixed(2)}%`;
}

export default function ProfitHistoryScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const q = useProfitHistory(id);
  const [open, setOpen] = useState<ProfitChange | null>(null);

  const items = useMemo(
    () => (q.data?.pages ?? []).flatMap((p) => p.items),
    [q.data],
  );

  /** 월 머리말을 목록에 섞어 넣는다. 같은 배열에 둬야 스크롤이 자연스럽다. */
  const blocks = useMemo(() => {
    const out: { month: string; rows: ProfitChange[] }[] = [];
    for (const it of items) {
      const m = monthLabel(it.occurredAt);
      const tail = out[out.length - 1];
      if (tail && tail.month === m) tail.rows.push(it);
      else out.push({ month: m, rows: [it] });
    }
    return out;
  }, [items]);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* 헤더에 레시피 이름을 붙이지 않는다(기획 5.1). 어느 메뉴인지는 들어온 화면이 안다. */}
      <AppHeader title="손익 변동" onBack={() => safeBack(id ? `/recipes/${id}` : '/recipes')} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: space.md, paddingBottom: LAYOUT.scroll.end }}
        onScroll={({ nativeEvent: e }) => {
          const near = e.layoutMeasurement.height + e.contentOffset.y >= e.contentSize.height - 220;
          if (near && q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
        }}
        scrollEventThrottle={200}
      >
        <QueryState
          isLoading={q.isLoading}
          error={q.error}
          isEmpty={items.length === 0}
          onRetry={() => void q.refetch()}
          emptyTitle="아직 기록된 손익 변동이 없어요"
          emptyHint="레시피나 원가가 바뀌면 여기에 기록돼요"
        >
          {blocks.map((b) => (
            <View key={b.month} style={{ marginBottom: space.md }}>
              <Text style={{ marginHorizontal: space.sm, marginBottom: 8, fontSize: 13, fontWeight: '800', color: T.sub }}>
                {b.month}
              </Text>
              {/* 카드 하나에 행 구분선 — 줄마다 카드를 쓰면 목록이 아니라 더미가 된다. */}
              <Card pad={0} style={{ overflow: 'hidden' }}>
                {b.rows.map((it, i) => (
                  <ProfitChangeRow key={it.id} item={it} last={i === b.rows.length - 1} onPress={() => setOpen(it)} />
                ))}
              </Card>
            </View>
          ))}

          {q.isFetchingNextPage ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <ActivityIndicator color={COLOR.action.primary} />
            </View>
          ) : null}
        </QueryState>
      </ScrollView>

      {/* ── 하단 시트 — 변동 원인과 손익 결과, 두 덩어리만 ────────── */}
      <Sheet visible={open !== null} onClose={() => setOpen(null)} title="손익 변동 상세" height={430}>
        {open ? (
          <View style={{ paddingBottom: space.sm }}>
            <Text style={{ fontSize: TYPE.title.fontSize, fontWeight: '800', color: T.ink }}>{open.title}</Text>
            <Text style={{ fontSize: 14, color: COLOR.text.tertiary, marginTop: space.xs }}>
              {changeStamp(open.occurredAt).replace(' · ', ' ')}
              {open.sourceLabel ? ` · ${open.sourceLabel}` : ''}
            </Text>

            {open.cause ? (
              <View style={{ marginTop: 20 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: T.sub2 }}>변동 원인</Text>
                <View style={{ marginTop: space.xs, borderWidth: 1, borderColor: T.line, borderRadius: radius.md, overflow: 'hidden' }}>
                  <HistoryValueRow first
                    label={open.cause.label}
                    before={amount(open.cause.before)}
                    after={amount(open.cause.after)}
                  />
                </View>
              </View>
            ) : null}

            {/* 순이익과 순이익률 두 줄은 **항상** 보인다. 이게 질문의 답이다. */}
            <View style={{ marginTop: space.lg }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: T.sub2 }}>손익 결과</Text>
              <View style={{ marginTop: space.xs, borderWidth: 1, borderColor: T.line, borderRadius: radius.md, overflow: 'hidden' }}>
                <HistoryValueRow first
                  label="순이익"
                  before={open.profitBefore === null ? '—' : amount(open.profitBefore)}
                  after={amount(open.profitAfter)}
                />
                <HistoryValueRow
                  label="순이익률"
                  before={open.rateBefore === null ? '—' : rate(open.rateBefore)}
                  after={rate(open.rateAfter)}
                />
              </View>
            </View>

            <Button kind="gray" full
              onPress={() => setOpen(null)}
              style={{ marginTop: space.xxl }}
            >
              닫기
            </Button>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

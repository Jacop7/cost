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
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Card, Icon, QueryState, Sheet } from '@/components/kit';
import { monthLabel, changeStamp } from '@/features/changes';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';
import { deltaTone, useProfitHistory, type ProfitChange } from '../profitHistory';

const NUM = { fontVariant: ['tabular-nums' as const] };

/** 4046.69 → `4,046.69원`. 정수면 소수점을 붙이지 않는다. */
function amount(v: number): string {
  const r = Math.round(v * 100) / 100;
  return `${won(r)}원`;
}

function rate(v: number): string {
  return `${(Math.round(v * 100) / 100).toFixed(2)}%`;
}

/** 증감 한 줄. 0원은 `변동 없음` 이다 — `+0원`은 아무 말도 아니다. */
function DeltaText({ delta }: { delta: number | null }) {
  const tone = deltaTone(delta);
  if (tone === 'flat') {
    return <Text style={{ fontSize: 13, fontWeight: '700', color: T.ter }}>변동 없음</Text>;
  }
  const up = tone === 'up';
  return (
    <Text style={[{ fontSize: 13, fontWeight: '800', color: up ? T.green : T.red }, NUM]}>
      {up ? '+' : '−'}
      {amount(Math.abs(delta as number))}
    </Text>
  );
}

/** 목록 한 줄 — 프로토타입의 4칸 배치 그대로. */
function Row({ item, last, onPress }: { item: ProfitChange; last: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.summary ?? ''}. 순이익 ${amount(item.profitAfter)}`}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        paddingVertical: 13,
        paddingHorizontal: 15,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: T.line2,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[{ fontSize: 13, color: T.ter, fontWeight: '600' }, NUM]}>
          {changeStamp(item.occurredAt)}
        </Text>
        <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink, marginTop: 4 }} numberOfLines={1}>
          {item.title}
        </Text>
        {item.summary ? (
          <Text style={{ fontSize: 14, color: T.sub, marginTop: 3 }} numberOfLines={1}>
            {item.summary}
          </Text>
        ) : null}
      </View>

      <View style={{ alignItems: 'flex-end', paddingTop: 15 }}>
        <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>
          {amount(item.profitAfter)}
        </Text>
        <View style={{ marginTop: 3 }}>
          <DeltaText delta={item.profitDelta} />
        </View>
      </View>

      <Icon name="chevron" size={16} color={T.line3} />
    </Pressable>
  );
}

/** 시트 안의 전후 한 줄 — `재료비  2,838.40원 → 2,806.40원`. */
function BeforeAfter({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11 }}>
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: T.sub }}>{label}</Text>
      <Text style={[{ fontSize: 15, color: T.ter }, NUM]}>{before}</Text>
      <Text style={{ fontSize: 15, color: T.line3, marginHorizontal: 7 }}>→</Text>
      <Text style={[{ fontSize: 15, fontWeight: '800', color: T.ink }, NUM]}>{after}</Text>
    </View>
  );
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
        contentContainerStyle={{ padding: 14, paddingBottom: 32 }}
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
            <View key={b.month} style={{ marginBottom: 14 }}>
              <Text style={{ marginHorizontal: 6, marginBottom: 8, fontSize: 13, fontWeight: '800', color: T.sub }}>
                {b.month}
              </Text>
              {/* 카드 하나에 행 구분선 — 줄마다 카드를 쓰면 목록이 아니라 더미가 된다. */}
              <Card pad={0} style={{ overflow: 'hidden' }}>
                {b.rows.map((it, i) => (
                  <Row key={it.id} item={it} last={i === b.rows.length - 1} onPress={() => setOpen(it)} />
                ))}
              </Card>
            </View>
          ))}

          {q.isFetchingNextPage ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <ActivityIndicator color={T.blue} />
            </View>
          ) : null}
        </QueryState>
      </ScrollView>

      {/* ── 하단 시트 — 변동 원인과 손익 결과, 두 덩어리만 ────────── */}
      <Sheet visible={open !== null} onClose={() => setOpen(null)} height={430}>
        {open ? (
          <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
            <Text style={{ fontSize: 19, fontWeight: '800', color: T.ink }}>{open.title}</Text>
            <Text style={{ fontSize: 14, color: T.ter, marginTop: 5 }}>
              {changeStamp(open.occurredAt).replace(' · ', ' ')}
              {open.sourceLabel ? ` · ${open.sourceLabel}` : ''}
            </Text>

            {open.cause ? (
              <View style={{ marginTop: 20 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: T.sub2 }}>변동 원인</Text>
                <View style={{ marginTop: 4, borderTopWidth: 1, borderTopColor: T.line2 }}>
                  <BeforeAfter
                    label={open.cause.label}
                    before={amount(open.cause.before)}
                    after={amount(open.cause.after)}
                  />
                </View>
              </View>
            ) : null}

            {/* 순이익과 순이익률 두 줄은 **항상** 보인다. 이게 질문의 답이다. */}
            <View style={{ marginTop: 18 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: T.sub2 }}>손익 결과</Text>
              <View style={{ marginTop: 4, borderTopWidth: 1, borderTopColor: T.line2 }}>
                <BeforeAfter
                  label="순이익"
                  before={open.profitBefore === null ? '—' : amount(open.profitBefore)}
                  after={amount(open.profitAfter)}
                />
                <BeforeAfter
                  label="순이익률"
                  before={open.rateBefore === null ? '—' : rate(open.rateBefore)}
                  after={rate(open.rateAfter)}
                />
              </View>
            </View>

            <Pressable
              onPress={() => setOpen(null)}
              accessibilityRole="button"
              style={{
                marginTop: 24,
                paddingVertical: 14,
                borderRadius: 12,
                backgroundColor: T.surface2,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub }}>닫기</Text>
            </Pressable>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

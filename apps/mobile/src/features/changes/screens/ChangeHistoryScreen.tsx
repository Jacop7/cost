/**
 * 수정 내역 — 식재료·레시피가 같은 화면을 쓴다.
 *
 * 프로토타입: docs/prototypes/ingredient-recipe-change-history.html
 *
 * 목록은 **한 줄**이고 자세한 건 눌러서 시트로 본다. 카드로 다 펼치면 세 건만 있어도
 * 한 화면을 넘겨야 해서, 정작 "언제 뭐가 바뀌었나"를 훑을 수가 없다.
 *
 * 상단 요약의 세 숫자는 **서버가 창 전체를 세서** 준다(0075). 받은 페이지에서 세면
 * 20건까지만 센 값인데 사장님은 전체라고 읽는다.
 */
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, Card, Icon, QueryState, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';
import {
  changeHeadline,
  changeImpact,
  changeStamp,
  changeSubtitle,
  changeTime,
  formatChangeValue,
  monthLabel,
  sourceLabel,
  stateLabel,
  useChangeHistory,
  useChangeSubject,
  type ChangeEntity,
  type ChangeEvent,
  type ChangeWindow,
} from '../hooks';

const NUM = { fontVariant: ['tabular-nums' as const] };

const TONE = {
  green: { fg: T.green, bg: T.greenTint },
  amber: { fg: T.amberText, bg: T.amberTint },
  neutral: { fg: T.sub2, bg: T.line2 },
} as const;

/** 목록에 섞여 들어가는 월 머리말. 같은 배열에 두어야 스크롤이 자연스럽다. */
type Row = { kind: 'month'; key: string; label: string } | { kind: 'event'; key: string; event: ChangeEvent };

const WINDOWS: { label: string; days: ChangeWindow }[] = [
  { label: '7일', days: 7 },
  { label: '30일', days: 30 },
  { label: '전체', days: null },
];

function StateBadge({ state }: { state: ChangeEvent['state'] }) {
  const s = stateLabel(state);
  const c = TONE[s.tone];
  return (
    <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: c.bg }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: c.fg }}>{s.text}</Text>
    </View>
  );
}

export function ChangeHistoryScreen({ entity }: { entity: ChangeEntity }) {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id;
  const router = useRouter();

  const [days, setDays] = useState<ChangeWindow>(7);
  const [open, setOpen] = useState<ChangeEvent | null>(null);

  const q = useChangeHistory(entity, id, days);
  const subject = useChangeSubject(entity, id);

  const items = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);
  const summary = q.data?.pages[0]?.summary;

  /** 월이 바뀌는 자리에 머리말을 끼운다. */
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let last = '';
    for (const e of items) {
      const m = monthLabel(e.occurredAt);
      if (m && m !== last) {
        out.push({ kind: 'month', key: `m-${m}`, label: m });
        last = m;
      }
      out.push({ kind: 'event', key: e.id ?? e.occurredAt, event: e });
    }
    return out;
  }, [items]);

  /**
   * 재고 변동·폐기는 여기 담지 않는다(기획 §5). 기준단가를 바꾸지 않고,
   * 재고 원장이 이미 단일 출처다 — 두 곳에 적으면 어느 쪽이 맞는지 몰라진다.
   */
  const ledgers =
    entity === 'ingredient' && id
      ? [
          { label: '재고 변동', hint: '입고·소진·실사·폐기 수량', href: `/ingredients/history/${id}` },
          { label: '구매 이력', hint: '언제 얼마에 샀는지', href: `/ingredients/purchases/${id}` },
        ]
      : [];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader
        title={subject.data ? `수정 내역 · ${subject.data}` : '수정 내역'}
        onBack={() => safeBack(entity === 'recipe' ? `/recipes/${id}` : `/ingredients/${id}`)}
      />

      {/* 기간 — 좁히면 그 밖의 기록이 닿을 수 없으므로 고를 수 있어야 한다 */}
      <View style={{ flexDirection: 'row', gap: 7, paddingHorizontal: 16, paddingBottom: 10 }}>
        {WINDOWS.map((w) => {
          const on = w.days === days;
          return (
            <Pressable
              key={w.label}
              onPress={() => setDays(w.days)}
              accessibilityRole="button" accessibilityLabel={`${w.label} 보기`}
              accessibilityState={{ selected: on }}
              style={{ paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: on ? T.blue : T.line, backgroundColor: on ? T.blueTint : T.surface }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: on ? T.blue : T.sub2 }}>{w.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <QueryState
        isLoading={q.isLoading}
        error={q.error}
        isEmpty={items.length === 0}
        onRetry={() => void q.refetch()}
        emptyTitle={days === null ? '아직 수정한 적이 없어요' : '이 기간에는 수정 내역이 없어요'}
        emptyHint={days === null ? '값을 고치거나 입고를 확정하면 여기에 남아요' : '기간을 넓혀 보세요'}
      >
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}
          ListHeaderComponent={
            summary ? (
              <Card pad={0} style={{ overflow: 'hidden', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15 }}>
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: T.ink }}>
                    {summary.days === null ? '전체' : `최근 ${summary.days}일`} 기준 {summary.count}건
                  </Text>
                  <Text style={[{ fontSize: 14, color: T.ter, fontWeight: '600' }, NUM]}>
                    {summary.lastAt ? `최근 수정 ${changeTime(summary.lastAt)}` : '기록 없음'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 16, paddingVertical: 11, paddingHorizontal: 15, borderTopWidth: 1, borderTopColor: T.line2, backgroundColor: T.surface2 }}>
                  {([
                    ['직접 수정', summary.direct],
                    ['자동 변경', summary.auto],
                  ] as const).map(([k, v]) => (
                    <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text style={{ fontSize: 14, color: T.sub2, fontWeight: '600' }}>{k}</Text>
                      <Text style={[{ fontSize: 14, fontWeight: '800', color: T.ink }, NUM]}>{v}건</Text>
                    </View>
                  ))}
                </View>
              </Card>
            ) : null
          }
          renderItem={({ item }) =>
            item.kind === 'month' ? (
              <Text style={{ fontSize: 14, fontWeight: '800', color: T.ter, marginTop: 6, marginBottom: 6 }}>
                {item.label}
              </Text>
            ) : (
              <Pressable
                onPress={() => setOpen(item.event)}
                accessibilityRole="button"
                accessibilityLabel={`${item.event.title} 자세히 보기`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 15, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: T.line, backgroundColor: T.surface }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[{ fontSize: 13, color: T.ter, fontWeight: '600' }, NUM]}>
                    {changeStamp(item.event.occurredAt)}
                  </Text>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink, marginTop: 2 }} numberOfLines={1}>
                    {item.event.title}
                  </Text>
                  <Text style={{ fontSize: 14, color: T.sub2, marginTop: 2 }} numberOfLines={1}>
                    {changeSubtitle(item.event)}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]} numberOfLines={1}>
                    {changeHeadline(item.event)}
                  </Text>
                  <StateBadge state={item.event.state} />
                </View>
                <Icon name="chevron" size={16} color={T.ter} />
              </Pressable>
            )
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            // 20건씩 이어 받는다. 이미 받는 중이면 또 부르지 않는다.
            if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
          }}
          ListFooterComponent={
            <>
              {q.isFetchingNextPage ? (
                <View style={{ paddingVertical: 18 }}>
                  <ActivityIndicator color={T.ter} />
                </View>
              ) : null}
              {!q.hasNextPage && ledgers.length > 0 ? (
                <Card pad={0} style={{ overflow: 'hidden', marginTop: 6 }}>
                  <View style={{ paddingHorizontal: 15, paddingTop: 13 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: T.sub }}>수량 변동은 따로 봐요</Text>
                    <Text style={{ fontSize: 14, color: T.ter, marginTop: 3, lineHeight: 20 }}>
                      재고와 폐기는 기준 단가를 바꾸지 않아 여기에 남지 않아요.
                    </Text>
                  </View>
                  {ledgers.map((l, i) => (
                    <Pressable
                      key={l.href}
                      onPress={() => router.push(l.href as Href)}
                      accessibilityRole="button" accessibilityLabel={l.label}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 13, paddingHorizontal: 15, borderTopWidth: 1, borderTopColor: T.line2, marginTop: i === 0 ? 9 : 0 }}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{l.label}</Text>
                        <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>{l.hint}</Text>
                      </View>
                      <Icon name="chevron" size={16} color={T.ter} />
                    </Pressable>
                  ))}
                </Card>
              ) : null}
            </>
          }
        />
      </QueryState>

      {/* 변경 내용 — 목록은 훑는 곳이고, 자세한 건 여기서 본다 */}
      <Sheet visible={open !== null} onClose={() => setOpen(null)} title="변경 내용" height={520}>
        {open ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: T.ink }}>{open.title}</Text>
                <Text style={[{ fontSize: 14, color: T.sub2, marginTop: 3 }, NUM]}>
                  {changeStamp(open.occurredAt)} · {sourceLabel(open)}
                  {open.sourceName ? ` · ${open.sourceName}` : ''}
                </Text>
              </View>
              <StateBadge state={open.state} />
            </View>

            {open.changes.length > 0 ? (
              <View style={{ marginTop: 16, borderRadius: 12, borderWidth: 1, borderColor: T.line, overflow: 'hidden' }}>
                {open.changes.map((l, i) => (
                  <View
                    key={l.key}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 13, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: T.line2 }}
                  >
                    <Text style={{ width: 84, fontSize: 14, fontWeight: '700', color: T.sub }} numberOfLines={1}>
                      {l.label}
                    </Text>
                    <Text style={[{ fontSize: 15, color: T.ter }, NUM]} numberOfLines={1}>
                      {formatChangeValue(l.before, l.unit)}
                    </Text>
                    <Text style={{ fontSize: 14, color: T.ter }}>→</Text>
                    <Text style={[{ flex: 1, fontSize: 15, fontWeight: '800', color: T.ink }, NUM]} numberOfLines={1}>
                      {formatChangeValue(l.after, l.unit)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* 그래서 뭐가 달라지나 — 상태만으로는 알 수 없다 */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, padding: 13, borderRadius: 12, backgroundColor: T.surface2 }}>
              <Icon name="info" size={16} color={T.sub2} />
              <Text style={{ flex: 1, fontSize: 14, color: T.sub, lineHeight: 21 }}>
                {changeImpact(open, entity)}
              </Text>
            </View>
          </ScrollView>
        ) : null}
      </Sheet>
    </View>
  );
}

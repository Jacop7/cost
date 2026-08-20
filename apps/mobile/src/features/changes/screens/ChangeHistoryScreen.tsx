/**
 * 수정 내역 — 식재료·레시피가 **같은 화면**을 쓰고 데이터만 바꾼다.
 *
 * 기획: docs/식재료-레시피-수정내역-최종기획.md (개정)
 * 프로토타입: docs/prototypes/unified-change-history-all-cases.html
 *
 * 세 가지를 지킨다.
 *   ① 헤더는 `수정 내역` 고정. 유형·이름은 본문에서 밝힌다.
 *   ② 목록 우측에 **대표 금액을 두지 않는다** — 식재료와 레시피의 단위가 다르고
 *      한 사건에 여러 값이 섞인다. 전후값은 전부 상세 시트에서 본다.
 *   ③ 상태 배지는 목록 전체에서 **최대 두 건**. 어느 사건에 달지는 서버가 정한다 —
 *      앱이 고르면 식재료 화면과 레시피 화면이 다르게 고를 수 있다.
 */
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, Card, Icon, QueryState, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';
import {
  badgeFor,
  changeStamp,
  formatChangeValue,
  monthLabel,
  sourceLabel,
  stateLabel,
  useChangeHistory,
  useChangeSubject,
  type ChangeEntity,
  type ChangeEvent,
  type ChangeState,
  type ChangeSummary,
} from '../hooks';

const NUM = { fontVariant: ['tabular-nums' as const] };

const TONE = {
  green: { fg: T.green, bg: T.greenTint },
  amber: { fg: T.amberText, bg: T.amberTint },
  neutral: { fg: T.sub2, bg: T.line2 },
} as const;

/** 화면은 최근 7일만 본다. 서버는 30일 보관하고 핵심 장부는 영구 보존한다(0076). */
const WINDOW_DAYS = 7;

/** 목록에 섞여 들어가는 월 머리말. 같은 배열에 둬야 스크롤이 자연스럽다. */
type Row = { kind: 'month'; key: string; label: string } | { kind: 'event'; key: string; event: ChangeEvent };

function StateBadge({ state }: { state: ChangeState }) {
  const s = stateLabel(state);
  const c = TONE[s.tone];
  return (
    <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: c.bg }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: c.fg }}>{s.text}</Text>
    </View>
  );
}

/** 상세 시트의 한 묶음 — `직접 수정` 또는 `자동 갱신`. */
function ChangeGroup({ title, lines }: { title: string; lines: ChangeEvent['changes'] }) {
  if (lines.length === 0) return null;
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ fontSize: 14, fontWeight: '800', color: T.sub, marginBottom: 8 }}>{title}</Text>
      <View style={{ borderRadius: 12, borderWidth: 1, borderColor: T.line, overflow: 'hidden' }}>
        {lines.map((l, i) => (
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
    </View>
  );
}

export function ChangeHistoryScreen({ entity }: { entity: ChangeEntity }) {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id;
  const router = useRouter();

  const [open, setOpen] = useState<ChangeEvent | null>(null);

  const q = useChangeHistory(entity, id, WINDOW_DAYS);
  const subject = useChangeSubject(entity, id);

  const items = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);
  const summary: ChangeSummary | undefined = q.data?.pages[0]?.summary;

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
   * 재고 수량 변동은 여기 담지 않는다(기획 §7). 기준 단가를 바꾸지 않고
   * 재고 원장이 이미 단일 출처다 — 두 곳에 적으면 어느 쪽이 맞는지 몰라진다.
   */
  const ledgers =
    entity === 'ingredient' && id
      ? [
          { label: '재고 변동', hint: '입고·소진·실사·폐기 수량', href: `/ingredients/history/${id}` },
          { label: '구매 이력', hint: '언제 얼마에 샀는지', href: `/ingredients/purchases/${id}` },
        ]
      : [];

  const openBadge = open ? badgeFor(open, summary) : null;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* 헤더는 대상 이름 없이 고정한다 — 유형·이름은 본문이 밝힌다(기획 §4.1) */}
      <AppHeader
        title="수정 내역"
        onBack={() => safeBack(entity === 'recipe' ? `/recipes/${id}` : `/ingredients/${id}`)}
      />

      <QueryState
        isLoading={q.isLoading}
        error={q.error}
        isEmpty={items.length === 0}
        onRetry={() => void q.refetch()}
        emptyTitle="최근 7일 동안 수정한 적이 없어요"
        emptyHint="값을 고치거나 입고를 확정하면 여기에 남아요"
      >
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}
          ListHeaderComponent={
            <View style={{ marginBottom: 12 }}>
              {/* 무엇의 내역인가 — 헤더가 아니라 여기서 밝힌다 */}
              <Text style={{ fontSize: 14, fontWeight: '700', color: T.ter }}>
                {entity === 'recipe' ? '레시피' : '식재료'}
              </Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: T.ink, letterSpacing: -0.5, marginTop: 2 }}>
                {subject.data ?? ''}
              </Text>

              {summary ? (
                <Card pad={0} style={{ overflow: 'hidden', marginTop: 13 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15 }}>
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: T.ink }}>최근 7일 기준</Text>
                    <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{summary.count}건</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 16, paddingVertical: 11, paddingHorizontal: 15, borderTopWidth: 1, borderTopColor: T.line2, backgroundColor: T.surface2 }}>
                    {([
                      ['직접 수정', summary.directCount],
                      ['자동 갱신', summary.autoCount],
                    ] as const).map(([k, v]) => (
                      <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Text style={{ fontSize: 14, color: T.sub2, fontWeight: '600' }}>{k}</Text>
                        <Text style={[{ fontSize: 14, fontWeight: '800', color: T.ink }, NUM]}>{v}건</Text>
                      </View>
                    ))}
                  </View>
                </Card>
              ) : null}
            </View>
          }
          renderItem={({ item, index }) => {
            if (item.kind === 'month') {
              return (
                <Text style={{ fontSize: 14, fontWeight: '800', color: T.ter, marginTop: index === 0 ? 0 : 10, marginBottom: 8 }}>
                  {item.label}
                </Text>
              );
            }
            const badge = badgeFor(item.event, summary);
            // 카드 여러 장이 아니라 **하나의 그룹 카드**다 — 위아래 모서리만 둥글린다.
            const first = index === 0 || rows[index - 1]?.kind === 'month';
            const next = rows[index + 1];
            const last = !next || next.kind === 'month';
            return (
              <Pressable
                onPress={() => setOpen(item.event)}
                accessibilityRole="button"
                accessibilityLabel={`${item.event.title} 자세히 보기`}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  paddingVertical: 14, paddingHorizontal: 15,
                  backgroundColor: T.surface,
                  borderLeftWidth: 1, borderRightWidth: 1, borderColor: T.line,
                  borderTopWidth: first ? 1 : 0,
                  borderBottomWidth: 1,
                  borderBottomColor: last ? T.line : T.line2,
                  borderTopLeftRadius: first ? 12 : 0,
                  borderTopRightRadius: first ? 12 : 0,
                  borderBottomLeftRadius: last ? 12 : 0,
                  borderBottomRightRadius: last ? 12 : 0,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[{ fontSize: 13, color: T.ter, fontWeight: '600' }, NUM]}>
                    {changeStamp(item.event.occurredAt)}
                  </Text>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink, marginTop: 2 }} numberOfLines={1}>
                    {item.event.title}
                  </Text>
                  <Text style={{ fontSize: 14, color: T.sub2, marginTop: 2 }} numberOfLines={1}>
                    {item.event.summary}
                  </Text>
                </View>
                {badge ? <StateBadge state={badge} /> : null}
                <Icon name="chevron" size={16} color={T.ter} />
              </Pressable>
            );
          }}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
          }}
          ListFooterComponent={
            <>
              {q.isFetchingNextPage ? (
                <View style={{ paddingVertical: 18 }}>
                  <ActivityIndicator color={T.ter} />
                </View>
              ) : null}
              {!q.hasNextPage ? (
                <Text style={{ fontSize: 13, color: T.ter, lineHeight: 19, marginTop: 12, marginBottom: 10 }}>
                  최근 7일 수정 내역만 표시합니다. 메모 변경
                  {entity === 'ingredient' ? '과 재고 수량 변동은' : '은'} 포함하지 않습니다.
                </Text>
              ) : null}
              {!q.hasNextPage && ledgers.length > 0 ? (
                <Card pad={0} style={{ overflow: 'hidden' }}>
                  {ledgers.map((l, i) => (
                    <Pressable
                      key={l.href}
                      onPress={() => router.push(l.href as Href)}
                      accessibilityRole="button" accessibilityLabel={l.label}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 13, paddingHorizontal: 15, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: T.line2 }}
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

      {/*
        상세 — 사건 제목으로 시작한다. `변경 내용` 헤더도, 하단 안내 문구도 두지 않는다.
        항목이 많거나 영향이 섞이면 한 문장이 실제 상태와 어긋난다(기획 §6).
      */}
      <Sheet visible={open !== null} onClose={() => setOpen(null)} height={520}>
        {open ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: T.ink }}>{open.title}</Text>
                <Text style={[{ fontSize: 14, color: T.sub2, marginTop: 3 }, NUM]}>
                  {changeStamp(open.occurredAt)} · {sourceLabel(open)}
                </Text>
              </View>
              {/* 선택된 최신 상태 사건일 때만 배지를 단다 */}
              {openBadge ? <StateBadge state={openBadge} /> : null}
            </View>

            <ChangeGroup title="직접 수정" lines={open.changes.filter((c) => c.kind === 'direct')} />
            <ChangeGroup title="자동 갱신" lines={open.changes.filter((c) => c.kind === 'derived')} />

            <View style={{ height: 12 }} />
          </ScrollView>
        ) : null}
      </Sheet>
    </View>
  );
}

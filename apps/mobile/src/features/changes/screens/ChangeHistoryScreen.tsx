/**
 * ING-11 / RCP-02b 수정 내역 — 식재료·레시피가 **같은 화면**을 쓰고 데이터만 바꾼다.
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
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Badge, Button, Icon, QueryState, Sheet } from '@/components/kit';
import { SummaryCard } from '@/components/history/HistoryLayout';
import { HistoryValueRow } from '@/components/history/HistoryValueRow';
import { historyRowStyles } from '@/components/history/historyRowStyles';
import { formatQuantity } from '@margincook/core';
import { safeBack } from '@/lib/nav';
import { useBusinessDay } from '@/features/business-day/businessDay';
import { LAYOUT, COLOR, T, TYPE, radius, space } from '@/theme/tokens';
import {
  badgeFor,
  changeStamp,
  formatChangeValue,
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
const CHANGE_META = { fontSize: 13, color: COLOR.text.tertiary, fontWeight: '600' as const };

const TONE = {
  green: { fg: COLOR.status.positive, bg: COLOR.status.positiveTint },
  amber: { fg: COLOR.status.caution, bg: COLOR.status.cautionTint },
  neutral: { fg: T.sub2, bg: T.line2 },
} as const;

/** 화면은 최근 7일만 본다. 서버는 30일 보관하고 핵심 장부는 영구 보존한다(0076). */
const WINDOW_DAYS = 7;

/** 월 경계를 지나도 최근 7일 내역을 하나의 목록으로 표시한다. */
type Row = { kind: 'period'; key: string; label: string } | { kind: 'event'; key: string; event: ChangeEvent };

function StateBadge({ state, allowShrink = false, compact = false }: { state: ChangeState; allowShrink?: boolean; compact?: boolean }) {
  const s = stateLabel(state);
  const c = TONE[s.tone];
  if (compact) return <View style={{ flexShrink: 1, minWidth: 0, maxWidth: '100%' }}><Badge sm tone={s.tone} alignSelf="center">{s.text}</Badge></View>;
  return (
    <View style={[{ paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.sm, backgroundColor: c.bg }, allowShrink && { flexShrink: 1, minWidth: 0, maxWidth: '100%' }]}>
      <Text style={{ fontSize: TYPE.captionSm.fontSize, fontWeight: '700', color: c.fg }}>{s.text}</Text>
    </View>
  );
}

/** 날짜/시각 경계만 줄바꿈. 분리 Text의 선행 공백이 웹에서 소실되지 않게 NBSP로 보존한다. */
function ListChangeStamp({ occurredAt, timezone, ingredient = false }: { occurredAt: string; timezone: string | undefined; ingredient?: boolean }) {
  const stamp = changeStamp(occurredAt, timezone) || '—';
  const boundary = stamp.indexOf(' ');
  const parts = boundary < 0 ? [stamp] : [stamp.slice(0, boundary), `\u00a0${stamp.slice(boundary + 1)}`];
  return (
    <View testID="change-history-date" style={{ flexDirection: 'row', flexWrap: 'wrap', maxWidth: '100%' }}>
      {parts.map((part, index) => (
        <Text key={index} style={[ingredient ? historyRowStyles.date : CHANGE_META, { flexShrink: 0 }, NUM]} numberOfLines={1}>
          {part}
        </Text>
      ))}
    </View>
  );
}

/** 상세 시트의 한 묶음 — `직접 수정` 또는 `자동 갱신`. */
function ChangeGroup({ title, lines, boxed = false }: { title: string; lines: ChangeEvent['changes']; boxed?: boolean }) {
  if (lines.length === 0) return null;
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ fontSize: 14, fontWeight: '800', color: T.sub, marginBottom: 8 }}>{title}</Text>
      <View style={boxed ? { gap: space.sm } : { borderRadius: 12, borderWidth: 1, borderColor: T.line, overflow: 'hidden' }}>
        {lines.map((l, i) => (
          <HistoryValueRow
            key={l.key}
            testID="change-history-value-row"
            boxed={boxed}
            first={i === 0}
            label={l.label}
            before={formatDetailValue(l.before, l.unit, l.key)}
            after={formatDetailValue(l.after, l.unit, l.key)}
          />
        ))}
      </View>
    </View>
  );
}

function formatDetailValue(value: string | number | null, unit: string | null, key: string) {
  if (key === 'received_quantity' && value !== null && value !== '' && Number.isFinite(Number(value)) && (unit === 'g' || unit === 'ml' || unit === 'ea'))
    return formatQuantity(Number(value), unit, { maxDigits: 3 });
  return formatChangeValue(value, unit);
}

export function ChangeHistoryScreen({ entity }: { entity: ChangeEntity }) {
  const ingredient = entity === 'ingredient';
  const timezone = useBusinessDay().data?.timezone;
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id;

  const [open, setOpen] = useState<ChangeEvent | null>(null);

  const q = useChangeHistory(entity, id, WINDOW_DAYS);
  const subject = useChangeSubject(entity, id);

  const items = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);
  const summary: ChangeSummary | undefined = q.data?.pages[0]?.summary;

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = items.length ? [{ kind: 'period', key: 'recent-seven-days', label: '최근 7일간' }] : [];
    for (const e of items) {
      out.push({ kind: 'event', key: e.id ?? e.occurredAt, event: e });
    }
    return out;
  }, [items]);

  const openBadge = open ? badgeFor(open, summary) : null;
  const directLines = open?.changes.filter(c => c.kind === 'direct') ?? [];
  // Old inbound records did not snapshot inputs. Show the missing fields honestly,
  // never infer their historical amount from today's average price or inventory.
  const missingInboundInputs = ingredient && open?.sourceType === 'inbound' && open.title === '입고 단가 반영'
    ? [['received_quantity', '실입고량'], ['paid_amount', '결제금액']].filter(([key]) => !open.changes.some(c => c.key === key))
      .map(([key, label]) => ({ key: key!, label: label!, before: '기록 없음', after: '기록 없음', unit: null, kind: 'direct' as const }))
    : [];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* 헤더는 대상 이름 없이 고정한다 — 유형·이름은 본문이 밝힌다(기획 §4.1) */}
      <AppHeader
        title="수정 내역"
        onBack={() => safeBack(entity === 'recipe' ? `/recipes/${id}` : `/ingredients/${id}`)}
      />

      <QueryState
        isLoading={q.isLoading || subject.isLoading}
        error={q.error || subject.error}
        isEmpty={items.length === 0}
        onRetry={() => { void q.refetch(); void subject.refetch(); }}
        emptyTitle="최근 7일 동안 수정한 적이 없어요"
        emptyHint="값을 고치거나 입고를 확정하면 여기에 남아요"
      >
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: ingredient ? space.sm : 0, paddingBottom: LAYOUT.scroll.end }}
          ListHeaderComponent={
            <View style={{ marginBottom: 12 }}>
              {/* 무엇의 내역인가 — 헤더가 아니라 여기서 밝힌다 */}
              {!ingredient ? <><Text style={{ fontSize: 14, fontWeight: '700', color: COLOR.text.tertiary }}>
                {entity === 'recipe' ? '레시피' : '식재료'}
              </Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: T.ink, letterSpacing: TYPE.display.letterSpacing, marginTop: space.xs }}>
                {subject.data ?? ''}
              </Text></> : null}

              {/*
                요약 카드 — 다섯 내역 화면이 **같은 카드**를 쓴다(0089).
                머리에 대표값(건수), 아래 칸칸이 갈래.
              */}
              {summary ? (
                <View accessibilityLabel={ingredient ? `최근 7일 수정 내역, ${subject.data ?? ''}, 총 ${summary.count}건` : undefined} style={{ marginTop: ingredient ? 0 : space.md }}>
                  <SummaryCard
                    prominent={ingredient}
                    label={ingredient ? subject.data ?? '' : '최근 7일 기준'}
                    value={`${ingredient ? '총 ' : ''}${summary.count}건`}
                    metrics={[
                      { label: '직접 수정', value: `${summary.directCount}건` },
                      { label: '자동 갱신', value: `${summary.autoCount}건` },
                    ]}
                  />
                </View>
              ) : null}
            </View>
          }
          renderItem={({ item, index }) => {
            if (item.kind === 'period') {
              return (
                <Text style={{ fontSize: 14, fontWeight: '800', color: COLOR.text.tertiary, marginTop: index === 0 ? 0 : 10, marginBottom: 8 }}>
                  {item.label}
                </Text>
              );
            }
            const selectedBadge = badgeFor(item.event, summary);
            const badge = ingredient && selectedBadge === 'irrelevant' ? null : selectedBadge;
            // 카드 여러 장이 아니라 **하나의 그룹 카드**다 — 위아래 모서리만 둥글린다.
            const first = index === 0 || rows[index - 1]?.kind === 'period';
            const next = rows[index + 1];
            const last = !next || next.kind === 'period';
            return (
              <Pressable
                onPress={() => setOpen(item.event)}
                accessibilityRole="button"
                accessibilityLabel={`${item.event.title} 자세히 보기`}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: space.sm,
                  paddingVertical: historyRowStyles.spacing.paddingVertical, paddingHorizontal: ingredient ? historyRowStyles.spacing.paddingHorizontal : space.md,
                  backgroundColor: T.surface,
                  borderLeftWidth: ingredient ? 0 : 1, borderRightWidth: ingredient ? 0 : 1, borderColor: T.line,
                  borderTopWidth: !ingredient && first ? 1 : 0,
                  borderBottomWidth: ingredient && last ? 0 : 1,
                  borderBottomColor: last ? T.line : T.line2,
                  borderTopLeftRadius: first ? radius.lg : 0,
                  borderTopRightRadius: first ? radius.lg : 0,
                  borderBottomLeftRadius: last ? radius.lg : 0,
                  borderBottomRightRadius: last ? radius.lg : 0,
                }}
              >
                <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
                  <ListChangeStamp occurredAt={item.event.occurredAt} timezone={timezone} ingredient={ingredient} />
                  <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink, marginTop: space.xs }, ingredient && historyRowStyles.title]}>
                    {item.event.title}
                  </Text>
                  <Text style={[{ fontSize: 14, color: T.sub2, marginTop: space.xs }, ingredient && historyRowStyles.description]} numberOfLines={ingredient ? 2 : 1}>
                    {item.event.summary}
                  </Text>
                </View>
                {badge ? <StateBadge state={badge} allowShrink compact={ingredient} /> : null}
                <Icon name="chevron" size={16} color={COLOR.text.tertiary} />
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
                <View style={{ paddingVertical: space.lg }}>
                  <ActivityIndicator color={COLOR.text.tertiary} />
                </View>
              ) : null}
              {!ingredient && !q.hasNextPage ? (
                <Text style={{ fontSize: 13, color: COLOR.text.tertiary, lineHeight: TYPE.captionSm.lineHeight, marginTop: 12, marginBottom: space.sm }}>
                  최근 7일 수정 내역만 표시합니다. 메모 변경은 포함하지 않습니다.
                </Text>
              ) : null}
            </>
          }
        />
      </QueryState>

      {/*
        상세 — 사건 제목으로 시작한다. `변경 내용` 헤더도, 하단 안내 문구도 두지 않는다.
        항목이 많거나 영향이 섞이면 한 문장이 실제 상태와 어긋난다(기획 §6).
      */}
      <Sheet visible={open !== null} onClose={() => setOpen(null)} height={ingredient ? undefined : 520}>
        {open ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: space.sm }}>
              <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, maxWidth: '100%' }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: T.ink }}>{open.title}</Text>
                <Text style={[{ fontSize: 14, color: T.sub2, marginTop: space.xs }, NUM]}>
                  {changeStamp(open.occurredAt, timezone) || '—'}{!ingredient ? ` · ${sourceLabel(open)}` : ''}
                </Text>
              </View>
              {/* 선택된 최신 상태 사건일 때만 배지를 단다 */}
              {!ingredient && openBadge ? <StateBadge state={openBadge} allowShrink /> : null}
            </View>

            <ChangeGroup title="직접 수정" lines={[...directLines, ...missingInboundInputs]} boxed={ingredient} />
            {missingInboundInputs.length > 0 ? <Text style={[historyRowStyles.description, { marginTop: space.sm }]}>이전 기록에는 실입고량·결제금액이 저장되지 않았습니다.</Text> : null}
            <ChangeGroup title="자동 갱신" lines={open.changes.filter((c) => c.kind === 'derived')} boxed={ingredient} />

            <View style={{ height: space.md }} />
            {ingredient ? <Button full size="lg" onPress={() => setOpen(null)}>닫기</Button> : null}
          </ScrollView>
        ) : null}
      </Sheet>
    </View>
  );
}

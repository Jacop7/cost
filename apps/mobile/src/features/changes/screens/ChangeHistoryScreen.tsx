/**
 * 수정 내역 목록 — 식재료·레시피가 같은 화면을 쓴다(기획 §4).
 *
 * 한 번의 저장·입고·전파는 **카드 한 장**이다. 필드마다 카드를 나누면
 * 판매가 하나 고친 것이 네 장으로 보여서 무엇이 일어났는지 알 수 없다.
 */
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Card, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';
import {
  changeTime,
  formatChangeValue,
  sourceLabel,
  stateLabel,
  useChangeHistory,
  useChangeSubject,
  type ChangeEntity,
  type ChangeEvent,
} from '../hooks';

const NUM = { fontVariant: ['tabular-nums' as const] };

const TONE = {
  green: { fg: T.green, bg: T.greenTint },
  amber: { fg: T.amberText, bg: T.amberTint },
  neutral: { fg: T.sub2, bg: T.line2 },
} as const;

function ChangeCard({ event, entity }: { event: ChangeEvent; entity: ChangeEntity }) {
  const s = stateLabel(event.state);
  const c = TONE[s.tone];

  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      <View style={{ padding: 15 }}>
        {/* 시각 · 반영 상태 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[{ flex: 1, fontSize: 14, fontWeight: '700', color: T.ter }, NUM]}>
            {changeTime(event.occurredAt)}
          </Text>
          <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: c.bg }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: c.fg }}>{s.text}</Text>
          </View>
        </View>

        {/* 제목 · 출처 */}
        <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink, marginTop: 8 }}>{event.title}</Text>
        <Text style={{ fontSize: 14, color: T.sub2, marginTop: 2 }}>{sourceLabel(event)}</Text>

        {/* 전후값 — 한 번의 변경에서 달라진 필드만 */}
        {event.changes.length > 0 ? (
          <View style={{ marginTop: 12, gap: 7 }}>
            {event.changes.map((l) => (
              <View key={l.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ width: 88, fontSize: 14, fontWeight: '600', color: T.sub }} numberOfLines={1}>
                  {l.label}
                </Text>
                <Text style={[{ fontSize: 14, color: T.ter }, NUM]} numberOfLines={1}>
                  {formatChangeValue(l.before, l.unit)}
                </Text>
                <Text style={{ fontSize: 14, color: T.ter }}>→</Text>
                <Text style={[{ flex: 1, fontSize: 14, fontWeight: '700', color: T.ink }, NUM]} numberOfLines={1}>
                  {formatChangeValue(l.after, l.unit)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {/* 자동 전파의 결과 — 몇 개 메뉴가 함께 움직였는지 */}
      {event.affectedRecipes > 0 ? (
        <View
          style={{
            paddingVertical: 11, paddingHorizontal: 15,
            borderTopWidth: 1, borderTopColor: T.line2, backgroundColor: T.surface2,
          }}
        >
          <Text style={{ fontSize: 14, color: T.sub2, lineHeight: 20 }}>
            {entity === 'ingredient'
              ? `연결 레시피 ${event.affectedRecipes}개의 원가와 순이익을 자동 재계산했어요.`
              : `같은 변경으로 다른 메뉴 ${event.affectedRecipes}개도 함께 바뀌었어요.`}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

/**
 * 라우트가 어느 쪽인지 알려 준다. 식재료·레시피가 같은 화면을 쓰되
 * 뒤로 가기와 안내 문구만 달라진다.
 */
export function ChangeHistoryScreen({ entity }: { entity: ChangeEntity }) {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id;

  const q = useChangeHistory(entity, id);
  const subject = useChangeSubject(entity, id);
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader
        title={subject.data ? `수정 내역 · ${subject.data}` : '수정 내역'}
        onBack={() => safeBack(entity === 'recipe' ? `/recipes/${id}` : `/ingredients/${id}`)}
      />
      <QueryState
        isLoading={q.isLoading}
        error={q.error}
        isEmpty={items.length === 0}
        onRetry={() => void q.refetch()}
        emptyTitle="아직 수정한 적이 없어요"
        emptyHint="값을 고치거나 입고를 확정하면 여기에 남아요"
      >
        <FlatList
          data={items}
          keyExtractor={(x) => x.id ?? x.occurredAt}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 28, gap: 11 }}
          renderItem={({ item }) => <ChangeCard event={item} entity={entity} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            // 20건씩 이어 받는다. 이미 받는 중이면 또 부르지 않는다.
            if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
          }}
          ListFooterComponent={
            q.isFetchingNextPage ? (
              <View style={{ paddingVertical: 18 }}>
                <ActivityIndicator color={T.ter} />
              </View>
            ) : null
          }
        />
      </QueryState>
    </View>
  );
}

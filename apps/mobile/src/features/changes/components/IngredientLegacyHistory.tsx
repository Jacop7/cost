import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button, Card, QueryState, Sheet } from '@/components/kit';
import { HistoryValueRow } from '@/components/history/HistoryValueRow';
import { COLOR, TYPE, space } from '@/theme/tokens';
import { useBusinessDay } from '@/features/business-day/businessDay';
import { useIngredientLegacyHistory } from '../configurationHistory';
import { changeStamp } from '../hooks';

export function IngredientLegacyHistory({ id }: { id: string }) {
  const q = useIngredientLegacyHistory(id);
  const [open, setOpen] = useState(false);
  const day = useBusinessDay();
  const count = q.data?.pages[0]?.count ?? 0;
  if (!count && !q.error) return null;
  return <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
    <Button kind="gray" full onPress={() => setOpen(true)}>통합 전 수정 내역{count ? ` ${count}건` : ''}</Button>
    <Sheet visible={open} title="통합 전 수정 내역" onClose={() => setOpen(false)}>
      <QueryState isLoading={q.isLoading} error={q.error} isEmpty={count === 0} emptyTitle="통합 전 수정 내역이 없어요" onRetry={() => void q.refetch()}>
        <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ gap: space.md }}>
          {q.data?.pages.flatMap(p => p.items).map(e => <Card key={e.id}>
            <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>{changeStamp(e.occurredAt, day.data?.timezone)}</Text>
            <Text style={{ ...TYPE.body, color: COLOR.text.primary }}>{e.title}</Text>
            {e.changes.map((c, index) => <HistoryValueRow key={c.key} first={index === 0} label={c.label} before={c.before} after={c.after} />)}
          </Card>)}
          {q.hasNextPage ? <Button kind="gray" loading={q.isFetchingNextPage} onPress={() => void q.fetchNextPage()}>더 보기</Button> : null}
        </ScrollView>
      </QueryState>
    </Sheet>
  </View>;
}

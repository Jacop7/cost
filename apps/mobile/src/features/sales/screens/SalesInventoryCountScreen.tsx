import { useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader, Button, Card, Field, Icon, Input, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { useSessionState } from '@/lib/SessionProvider';
import { COLOR, LAYOUT, T, TYPE, space } from '@/theme/tokens';
import {
  createSalesRequestKey,
  useBeginInventoryCount,
  useCancelInventoryCount,
  useCommitInventoryCount,
  type InventoryCountSession,
} from '../lifecycle';
import {
  clearInventoryCountIntent,
  discardUnreadableInventoryCountIntent,
  keepInventoryCountIntent,
  readInventoryCountIntent,
  type InventoryCountIntent,
  type InventoryCountScope,
} from '../inventoryCountOperation';

const terminalCountError = (error: unknown) => {
  const value = error as { code?: unknown; detail?: unknown } | null;
  return value?.code === '45030'
    || value?.detail === 'COUNT_SESSION_EXPIRED'
    || value?.detail === 'COUNT_SESSION_NOT_FOUND';
};

export default function SalesInventoryCountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const begin = useBeginInventoryCount();
  const commit = useCommitInventoryCount();
  const cancel = useCancelInventoryCount();
  const { userId, storeId } = useSessionState();
  const [session, setSession] = useState<InventoryCountSession | null>(null);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [cancelOpen, setCancelOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const sessionKey = useRef(createSalesRequestKey());
  const commitKey = useRef(createSalesRequestKey());
  const busy = begin.isPending || commit.isPending || cancel.isPending;
  const scope: InventoryCountScope = { actorId: userId ?? '', storeId: storeId ?? '' };

  const keepCounts = (nextCounts: Record<string, string>, nextSession = session, prepared = false) => {
    if (!nextSession || !scope.actorId || !scope.storeId) return Promise.resolve();
    return keepInventoryCountIntent({ version: 1, scope, sessionId: nextSession.id,
      requestKey: commitKey.current, targetIds: nextSession.targets.map(target => target.ingredientId),
      counts: nextCounts, prepared });
  };

  const goBack = () => {
    if (session?.status === 'active') setCancelOpen(true);
    else safeBack(date ? (`/sales/write?date=${date}` as Href) : ('/sales' as Href));
  };
  const start = async () => {
    setMessage(null);
    try {
      let saved: InventoryCountIntent | null = null;
      try { saved = await readInventoryCountIntent(scope); }
      catch {
        await discardUnreadableInventoryCountIntent(scope);
        setMessage('이 기기에 남은 손상된 실사 정보를 정리했어요. 서버의 진행 중 실사를 다시 불러옵니다.');
      }
      if (saved?.prepared) {
        const prepared = saved;
        try {
          const result = await commit.mutateAsync({ sessionId: prepared.sessionId,
            requestKey: prepared.requestKey, counts: prepared.targetIds.map(ingredientId => ({
              ingredientId, countedQuantity: Number(prepared.counts[ingredientId]),
            })) });
          if (result.status !== 'invalidated') {
            await clearInventoryCountIntent(scope, prepared.sessionId);
            router.replace(date ? (`/sales/write?date=${date}` as Href) : ('/sales' as Href));
            return;
          }
          await clearInventoryCountIntent(scope, prepared.sessionId);
          saved = null;
        } catch (error) {
          // 성공 응답을 잃은 경우에는 같은 요청 키로 먼저 영수증을 확인한다. 서버가 세션의
          // 종료를 확정한 경우에만 로컬 의도를 버리고 새 세션으로 진행한다.
          if (!terminalCountError(error)) throw error;
          await clearInventoryCountIntent(scope, prepared.sessionId);
          saved = null;
          setMessage('이전 재고 실사가 종료되어 새 실사를 시작합니다.');
        }
      }
      let next = await begin.mutateAsync(saved?.sessionId ?? sessionKey.current);
      if (next.status !== 'active') {
        if (saved) await clearInventoryCountIntent(scope, saved.sessionId);
        saved = null;
        sessionKey.current = createSalesRequestKey();
        commitKey.current = createSalesRequestKey();
        next = await begin.mutateAsync(sessionKey.current);
        if (next.status !== 'active') {
          setMessage('진행할 수 있는 재고 실사 세션이 아니에요. 다시 시작해 주세요.');
          return;
        }
      }
      sessionKey.current = next.id;
      commitKey.current = saved?.requestKey ?? createSalesRequestKey();
      const targetIds = next.targets.map(target => target.ingredientId).sort();
      const restored = saved && [...saved.targetIds].sort().join('|') === targetIds.join('|')
        ? saved.counts : Object.fromEntries(next.targets.map(target => [target.ingredientId, '']));
      setSession(next);
      setCounts(restored);
      await keepCounts(restored, next, false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '재고 실사를 시작하지 못했어요.');
    }
  };
  const finish = async () => {
    if (!session || busy) return;
    const rows = session.targets.map(target => ({
      ingredientId: target.ingredientId,
      countedQuantity: Number(counts[target.ingredientId]),
    }));
    if (rows.some(row => !Number.isFinite(row.countedQuantity) || row.countedQuantity < 0)) {
      setMessage('모든 식재료의 실제 재고를 0 이상으로 입력해 주세요.');
      return;
    }
    setMessage(null);
    try {
      await keepCounts(counts, session, true);
      const result = await commit.mutateAsync({
        sessionId: session.id, requestKey: commitKey.current, counts: rows,
      });
      if (result.status === 'invalidated') {
        await clearInventoryCountIntent(scope, session.id);
        setSession(null);
        sessionKey.current = createSalesRequestKey();
        commitKey.current = createSalesRequestKey();
        setMessage('실사 중 재고가 변경됐어요. 현재 재고를 확인한 뒤 실사를 다시 시작해 주세요.');
        return;
      }
      await clearInventoryCountIntent(scope, session.id);
      router.replace(date ? (`/sales/write?date=${date}` as Href) : ('/sales' as Href));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '재고 실사를 완료하지 못했어요.');
    }
  };
  const cancelAndLeave = async () => {
    if (!session || busy) return;
    try {
      await cancel.mutateAsync(session.id);
      await clearInventoryCountIntent(scope, session.id);
      setCancelOpen(false);
      router.replace(date ? (`/sales/write?date=${date}` as Href) : ('/sales' as Href));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '재고 실사를 취소하지 못했어요.');
      setCancelOpen(false);
    }
  };
  const valid = Boolean(session?.targets.length)
    && session!.targets.every(target => {
      const value = counts[target.ingredientId]?.trim();
      return value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;
    });

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="재고 실사" onBack={goBack} />
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: LAYOUT.scroll.start, paddingBottom: 92 + insets.bottom, gap: space.md }}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
            <Icon name="info" size={18} color={COLOR.text.accent} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ ...TYPE.body, color: T.ink }}>모든 식재료의 실제 재고를 확인해 주세요.</Text>
              <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>
                실사를 시작한 뒤 완료할 때까지 입고·폐기·판매 등 재고를 바꾸는 작업을 잠시 멈춰 주세요.
              </Text>
            </View>
          </View>
        </Card>

        {message ? (
          <Text accessibilityRole="alert" style={{ ...TYPE.caption, color: COLOR.status.negative }}>{message}</Text>
        ) : null}

        {!session ? (
          <Card>
            <Text style={{ ...TYPE.body, color: T.ink }}>재고 실사를 시작하면 4시간 안에 완료해야 해요.</Text>
            <Text style={{ marginTop: space.sm, ...TYPE.caption, color: COLOR.text.secondary }}>
              시작 시점의 재고를 고정해 비교하므로 다른 기기에서도 재고를 수정하지 말아 주세요.
            </Text>
            <Button kind="primary" size="lg" full loading={begin.isPending} style={{ marginTop: space.lg }} onPress={() => void start()}>
              실사 시작
            </Button>
          </Card>
        ) : (
          <>
            <Text style={{ ...TYPE.caption, fontWeight: '700', color: COLOR.text.secondary }}>
              실제 재고 입력 · 총 {session.targets.length}개
            </Text>
            {session.targets.map(target => (
              <Card key={target.ingredientId}>
                <Field variant="stacked" label={target.name} req>
                  <Input variant="stacked" value={counts[target.ingredientId] ?? ''}
                    onChangeText={value => {
                      if (busy) return;
                      setCounts(current => {
                        const next = { ...current, [target.ingredientId]: value };
                        void keepCounts(next).catch(() => setMessage('입력한 실사 수량을 기기에 저장하지 못했어요.'));
                        return next;
                      });
                    }}
                    disabled={busy}
                    keyboardType="decimal-pad" suffix={target.baseUnit}
                    accessibilityLabel={`${target.name} 실제 재고`} />
                </Field>
                <Text style={{ marginTop: space.sm, ...TYPE.captionSm, color: COLOR.text.tertiary }}>
                  실사 전 기록 {target.stockTotal.toLocaleString()} {target.baseUnit}
                </Text>
              </Card>
            ))}
          </>
        )}
      </ScrollView>

      {session ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: space.sm,
          paddingHorizontal: 16, paddingTop: space.sm, paddingBottom: 10 + insets.bottom,
          borderTopWidth: 1, borderTopColor: T.line2, backgroundColor: T.bg }}>
          <Button kind="gray" size="lg" style={{ flex: 1 }} disabled={busy} onPress={() => setCancelOpen(true)}>취소</Button>
          <Button kind="primary" size="lg" style={{ flex: 1 }} disabled={!valid || busy}
            loading={commit.isPending} onPress={() => void finish()}>실사 완료</Button>
        </View>
      ) : null}

      <Sheet visible={cancelOpen} title="재고 실사를 취소할까요?" onClose={() => { if (!busy) setCancelOpen(false); }}>
        <View style={{ gap: space.lg }}>
          <Text style={{ ...TYPE.bodyWeak, color: COLOR.text.secondary }}>입력한 실사 수량은 저장되지 않습니다.</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button kind="ghost" style={{ flex: 1 }} disabled={busy} onPress={() => setCancelOpen(false)}>계속 입력</Button>
            <Button kind="danger" style={{ flex: 1 }} loading={cancel.isPending} onPress={() => void cancelAndLeave()}>실사 취소</Button>
          </View>
        </View>
      </Sheet>
    </View>
  );
}

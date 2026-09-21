/**
 * MY-06 알림 설정 — 6종 on/off. 켜고 끄면 서버에 저장된다.
 *
 * 이전에는 지역 상태라 화면을 나갔다 오면 원래대로 돌아갔다.
 */
import { useRef, useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { AppHeader, Button, Card, QueryState, Notice } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { RpcError } from '@/lib/supabase';
import { LAYOUT, COLOR, T, TYPE, radius, space } from '@/theme/tokens';
import { Toggle } from '@/components/kit/Toggle';
import { useSaveSettings, useStoreSettings, type SaveSettingsInput, type StoreSettings } from '@/features/settings/hooks';
import { usePushDeviceRegistration } from '@/features/notifications/hooks';

type Key =
  | 'alertMorningSummary'
  | 'alertInboundDelay'
  | 'alertNegativeStockCheck'
  | 'alertTargetMiss'
  | 'alertSalesEntry'
  | 'alertFixedCostMissing';

const ITEMS: { key: Key; name: string; desc: string }[] = [
  { key: 'alertMorningSummary', name: '재료 부족 알림', desc: '최소재고 이하의 발주 후보가 있으면 다음 영업일 시작 3시간 전에 알려요' },
  { key: 'alertInboundDelay', name: '입고 확인 알림', desc: '예상 입고일이 지난 발주가 있으면 영업 시작 2시간 전에 알려요' },
  { key: 'alertNegativeStockCheck', name: '재고 확인 알림', desc: '마이너스 재고가 남아 있으면 주 1회 알려요' },
  { key: 'alertTargetMiss', name: '순이익률 변동 알림', desc: '자동 재계산으로 목표 달성에서 목표 미달로 바뀌면 알려요' },
  { key: 'alertSalesEntry', name: '매출 작성 알림', desc: '미작성·작성 중 매출과 작성 기한을 알려요' },
  { key: 'alertFixedCostMissing', name: '고정 지출 알림', desc: '순이익 계산에 필요한 고정 지출이 입력되지 않았을 때 알려요' },
];

export default function MyNotificationsScreen() {
  const settings = useStoreSettings();
  const pushDevice = usePushDeviceRegistration();
  const save = useSaveSettings();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [serverChanged, setServerChanged] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const conflictBaseRevision = useRef<number | null>(null);

  const s = settings.data;
  const onCount = s ? ITEMS.filter((it) => s[it.key]).length : 0;

  const toggle = (key: Key) => {
    if (!s || serverChanged || settings.isError) return;
    const attemptedRevision = s.revision;
    setSaveError(null);
    save.mutate({ values: { [key]: !s[key] } as Partial<SaveSettingsInput>, baseRevision: attemptedRevision }, {
      onError: (e) => {
        if (e instanceof RpcError && e.code === '45009') {
          conflictBaseRevision.current = attemptedRevision;
          setServerChanged(true);
          return;
        }
        setSaveError(e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요');
      },
    });
  };

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const r = await settings.refetch();
      if (!r.isError && r.data) {
        const conflictBase = conflictBaseRevision.current;
        // 45009 를 낸 판본과 같거나 그보다 오래된 재조회는 충돌을 해결한 것이 아니다.
        // 현재 화면 캐시보다 낮은 응답도 늦게 도착한 옛 조회이므로 채택하지 않는다.
        if (serverChanged && (conflictBase === null || r.data.revision <= conflictBase || (s && r.data.revision < s.revision))) return;
        conflictBaseRevision.current = null;
        setServerChanged(false);
        setSaveError(null);
      }
    } finally { setRefreshing(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="알림 설정" onBack={() => safeBack('/my')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: space.lg, paddingBottom: LAYOUT.scroll.end }}>
        <Card pad={0} style={{ overflow: 'hidden', marginBottom: space.lg }}>
          <View style={{ paddingVertical: 16, paddingHorizontal: space.lg }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>이 기기 알림</Text>
            <Text style={{ fontSize: 14, color: COLOR.text.tertiary, marginTop: space.xs, lineHeight: TYPE.caption.lineHeight }}>
              {pushDevice.query.isLoading ? '기기 알림 상태를 확인하고 있어요'
                : pushDevice.query.isError ? '기기 알림 상태를 확인하지 못했어요'
                  : pushDevice.query.data?.kind === 'registered' ? '이 기기에서 업무 알림을 받을 수 있어요'
                    : pushDevice.query.data?.kind === 'denied' ? '기기 설정에서 코스트킵 알림을 허용해 주세요'
                      : pushDevice.query.data?.kind === 'simulator' ? '실제 모바일 기기에서 푸시 알림을 연결할 수 있어요'
                        : pushDevice.query.data?.kind === 'unsupported-web' ? '모바일 앱에서 푸시 알림을 연결할 수 있어요'
                          : '알림을 허용하면 선택한 업무 알림을 이 기기로 보내요'}
            </Text>
            {pushDevice.query.isError ? (
              <View style={{ marginTop: space.md }}>
                <Button kind="gray" size="md" onPress={() => { void pushDevice.query.refetch(); }}>다시 시도</Button>
              </View>
            ) : pushDevice.query.data?.kind === 'denied' ? (
              <View style={{ marginTop: space.md }}>
                <Button kind="gray" size="md" onPress={() => { void Linking.openSettings(); }}>기기 설정 열기</Button>
              </View>
            ) : pushDevice.query.data?.kind === 'undetermined' ? (
              <View style={{ marginTop: space.md }}>
                <Button kind="primary" size="md" loading={pushDevice.enable.isPending}
                  onPress={() => pushDevice.enable.mutate()}>이 기기 알림 켜기</Button>
              </View>
            ) : null}
            {pushDevice.enable.isError ? (
              <Text role="alert" style={{ color: COLOR.status.negative, fontWeight: '700', marginTop: space.sm }}>
                연결하지 못했어요 · {pushDevice.enable.error instanceof Error ? pushDevice.enable.error.message : '잠시 후 다시 시도해 주세요'}
              </Text>
            ) : null}
          </View>
        </Card>
        <QueryState
          isLoading={settings.isLoading}
          error={settings.data ? null : settings.error}
          isEmpty={false}
          onRetry={() => void settings.refetch()}
          emptyTitle=""
        >
          {settings.isError && settings.data ? (
            <View role="alert" accessibilityLabel="재조회 실패" style={{ marginBottom: space.sm, padding: space.md, borderRadius: 12, backgroundColor: COLOR.status.negativeTint }}>
              <Text style={{ color: COLOR.status.negative, fontWeight: '700' }}>최신 설정을 불러오지 못했어요. 다시 시도해 주세요.</Text>
              <View style={{ marginTop: 8 }}><Button kind="gray" size="md" onPress={() => { void refresh(); }}>다시 시도</Button></View>
            </View>
          ) : null}
          {serverChanged ? (
            <View role="status" style={{ marginBottom: space.sm, padding: space.md, borderRadius: 12, backgroundColor: COLOR.status.negativeTint, borderWidth: 1, borderColor: COLOR.status.negative }}>
              <Text style={{ color: COLOR.status.negative, fontWeight: '700' }}>다른 기기에서 설정이 변경됐어요. 새로고침 후 다시 저장해 주세요.</Text>
              <View style={{ marginTop: 8 }}><Button kind="gray" size="md" loading={refreshing} onPress={() => { void refresh(); }} accessibilityLabel="새로고침">새로고침</Button></View>
            </View>
          ) : null}
          {saveError ? <Text role="alert" style={{ color: COLOR.status.negative, fontWeight: '700', marginBottom: space.sm }}>바꾸지 못했어요 · {saveError}</Text> : null}
          <Text style={{ fontSize: 14, fontWeight: '600', color: COLOR.text.tertiary, textAlign: 'right', marginBottom: space.md }}>6종 중 {onCount}개 켜짐</Text>
          <Card pad={0} style={{ overflow: 'hidden' }}>
            {ITEMS.map((n, i) => (
              <View key={n.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: space.lg, borderBottomWidth: i < ITEMS.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{n.name}</Text>
                  </View>
                  <Text style={{ fontSize: 14, color: COLOR.text.tertiary, marginTop: space.xs, lineHeight: TYPE.caption.lineHeight }}>{n.desc}</Text>
                </View>
                <Toggle on={Boolean(s?.[n.key])} disabled={save.isPending || serverChanged || settings.isError} onPress={() => toggle(n.key)} label={n.name} />
              </View>
            ))}
          </Card>
        </QueryState>

        <Notice style={{ marginTop: space.md, marginHorizontal: space.md }}>
          알림을 끄면 해당 푸시만 중단돼요. 앱 안의 재고 상태와 미작성 안내는 계속 표시돼요.
        </Notice>
      </ScrollView>
    </View>
  );
}

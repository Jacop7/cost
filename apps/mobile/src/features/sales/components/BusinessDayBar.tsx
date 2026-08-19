/**
 * 영업 상태 바 — 영업중 / 브레이크타임 / 영업종료.
 *
 * 사장님 결정(0048~0050): **영업 시작 시점의 값으로 하루가 고정된다.**
 * 영업 중에 레시피·식재료를 고쳐도 오늘 매출·원가·손익은 안 움직이고, 고친 값은
 * 다음 영업일 기준부터 들어간다. 그래서 "영업 시작"은 단순한 표시가 아니라
 * **오늘 기준값을 굳히는 순간**이다 — 화면이 그렇게 말해야 한다.
 *
 * 자동 종료는 예정 종료(설정한 마감 시각) 뒤에도 활동이 있으면 마지막 활동 + 1시간으로
 * 미뤄진다. 22:00 마감인데 21:47 에 팔았으면 22:47 이다.
 */
import { Alert, Pressable, Text, View } from 'react-native';
import { Badge, Button, Icon } from '@/components/kit';
import { T } from '@/theme/tokens';
import {
  hhmm,
  useAckAutoClose,
  useBusinessDay,
  useCloseBusinessDay,
  useOpenBusinessDay,
  useReopenBusinessDay,
  useSetBreak,
  type BusinessDayState,
} from '../businessDay';

const TONE = {
  open: { label: '영업중', tone: 'green' as const },
  break: { label: '브레이크타임', tone: 'amber' as const },
  closed: { label: '영업종료', tone: 'neutral' as const },
  none: { label: '영업 전', tone: 'ghost' as const },
};

/** 'HH:MM:SS' → 'HH:MM'. 설정값은 시각이라 초까지 오지만 화면엔 분까지면 된다. */
const clock = (t: string | null): string => (t ? t.slice(0, 5) : '');

export function BusinessDayBar({ state }: { state: BusinessDayState }) {
  const open = useOpenBusinessDay();
  const setBreak = useSetBreak();
  const close = useCloseBusinessDay();
  const reopen = useReopenBusinessDay();
  const ack = useAckAutoClose();

  const st = TONE[state.status];
  const busy = open.isPending || setBreak.isPending || close.isPending || reopen.isPending;
  const fail = (e: unknown) =>
    Alert.alert('처리하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요');

  const onOpen = () =>
    Alert.alert(
      '오늘 영업을 시작할까요?',
      '지금의 판매가·재료 구성·단가·부자재·고정지출·세금이 오늘 기준으로 정해져요.\n'
        + '영업 중에 메뉴를 고쳐도 오늘 매출에는 반영되지 않고, 다음 영업일부터 적용돼요.',
      [{ text: '취소', style: 'cancel' }, { text: '영업 시작', onPress: () => open.mutate(undefined, { onError: fail }) }],
    );

  const onClose = () =>
    Alert.alert(
      '오늘 영업을 종료할까요?',
      '오늘 판매량·매출·원가·세부 항목을 마감하고 잠가요. 빠뜨린 게 있으면 나중에 되돌릴 수 있어요.',
      [{ text: '취소', style: 'cancel' }, { text: '영업 종료', onPress: () => close.mutate(undefined, { onError: fail }) }],
    );

  const onReopen = () =>
    Alert.alert(
      '영업 기록을 다시 열까요?',
      '빠뜨린 판매를 넣을 수 있어요. 오늘 기준값(판매가·원가)은 영업 시작 때 그대로예요.',
      [
        { text: '취소', style: 'cancel' },
        { text: '다시 열기', onPress: () => reopen.mutate(state.businessDate, { onError: fail }) },
      ],
    );

  /** 예정 종료 시각 안내. 설정한 마감과 실제 자동 종료 시각이 다를 수 있다. */
  const planned = hhmm(state.plannedCloseAt);
  const auto = hhmm(state.autoCloseAt);

  const note = (() => {
    if (state.status === 'none') {
      const o = clock(state.hours.openTime);
      const c = clock(state.hours.closeTime);
      return o && c ? `영업시간 ${o} ~ ${c}${state.hours.overnight ? ' (자정 넘김)' : ''}` : '영업을 시작하면 오늘 기준이 정해져요';
    }
    if (state.status === 'closed') {
      const t = hhmm(state.closedAt);
      return state.closeMethod === 'auto'
        ? `${t} 자동 종료됐어요`
        : t ? `${t} 종료했어요` : '오늘 영업을 마쳤어요';
    }
    if (state.warnSoon) return `${auto} 에 자동 종료돼요`;
    if (state.pastPlanned) return `예정 종료 ${planned} 이 지났어요 · ${auto} 자동 종료`;
    return planned ? `${planned} 종료 예정` : '영업 중이에요';
  })();

  return (
    <View style={{ marginBottom: 11 }}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 9,
          paddingVertical: 11, paddingHorizontal: 13,
          borderRadius: 12, borderWidth: 1,
          borderColor: state.warnSoon || state.pastPlanned ? T.amberText : T.line,
          backgroundColor: state.warnSoon || state.pastPlanned ? T.amberTint : T.surface,
        }}
      >
        <Badge tone={st.tone}>{st.label}</Badge>
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.sub, minWidth: 0 }} numberOfLines={1}>
          {note}
        </Text>

        {state.status === 'none' ? (
          <Button kind="primary" size="sm" onPress={onOpen} loading={open.isPending} accessibilityLabel="영업 시작">
            영업 시작
          </Button>
        ) : state.status === 'closed' ? (
          <Button kind="ghost" size="sm" onPress={onReopen} loading={reopen.isPending} accessibilityLabel="영업 기록 다시 열기">
            다시 열기
          </Button>
        ) : (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Button
              kind="ghost" size="sm" disabled={busy}
              onPress={() => setBreak.mutate(state.status !== 'break', { onError: fail })}
              accessibilityLabel={state.status === 'break' ? '영업 재개' : '브레이크타임 시작'}
            >
              {state.status === 'break' ? '영업 재개' : '브레이크'}
            </Button>
            <Button kind="ghost" size="sm" disabled={busy} onPress={onClose} accessibilityLabel="영업 종료">
              종료
            </Button>
          </View>
        )}
      </View>

      {/* 지난 자동 종료 알림 — 사장님이 누른 게 아니라 시간이 눌렀으므로 한 번은 알려야 한다. */}
      {state.unacked ? (
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 7,
            paddingVertical: 11, paddingHorizontal: 13, borderRadius: 12,
            borderWidth: 1, borderColor: T.line, backgroundColor: T.surface2,
          }}
        >
          <Icon name="info" size={17} color={T.sub2} />
          <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.sub, minWidth: 0 }}>
            {state.unacked.businessDate} 영업이 {hhmm(state.unacked.closedAt)} 에 자동 종료됐어요
          </Text>
          <Pressable
            onPress={() => reopen.mutate(state.unacked!.businessDate, { onError: fail })}
            accessibilityRole="button" accessibilityLabel="영업 기록 수정"
            hitSlop={6}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue }}>기록 수정</Text>
          </Pressable>
          <Pressable
            onPress={() => ack.mutate(state.unacked!.businessDayId)}
            accessibilityRole="button" accessibilityLabel="확인"
            hitSlop={6}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub2 }}>확인</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** 매출 화면들이 같은 상태를 공유하도록 조회까지 묶어 둔다. */
export function BusinessDayBarConnected() {
  const q = useBusinessDay();
  return q.data ? <BusinessDayBar state={q.data} /> : null;
}

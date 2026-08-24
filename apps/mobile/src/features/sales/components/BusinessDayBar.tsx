/**
 * 영업 상태 바.
 *
 * 사장님 결정(0048~0050): **영업 시작 시점의 값으로 하루가 고정된다.**
 * 영업 중에 레시피·식재료를 고쳐도 오늘 매출·원가·손익은 안 움직이고, 고친 값은
 * 다음 영업일부터 들어간다. 이 잠금이 이 화면의 존재 이유다 — 없애지 않는다.
 *
 * ⚠ 0094 에서 **로직은 한 줄도 안 바꿨다.** 바뀐 건 말이다.
 *   사장님: "일반 유저 입장에서 뭐가 뭔지 이해가 안 돼"
 *   화면이 `예정 종료 22:00 이 지났어요 · 22:47 자동 종료` 를 띄우고 있었다.
 *   `planned_close_at` 과 `auto_close_at` 을 그대로 읽힌 것이다 — 내부 변수 이름을
 *   사장님한테 떠넘긴 셈이다. 사장님이 묻는 건 셋뿐이다.
 *     ① 지금 팔면 기록되나  ② 언제 닫히나  ③ 뭘 눌러야 하나
 *   그 셋에만 답한다.
 */
import { Alert, Pressable, Text, View } from 'react-native';
import { Badge, Button, Icon } from '@/components/kit';
import { T } from '@/theme/tokens';
import {
  hhmm,
  useAckAutoClose,
  useBusinessDay,
  useCloseBusinessDay,
  useCloseStaleAndOpen,
  useOpenBusinessDay,
  useReopenBusinessDay,
  useSetBreak,
  type BusinessDayState,
} from '../businessDay';

const TONE = {
  open: { label: '기록 중', tone: 'green' as const },
  break: { label: '브레이크타임', tone: 'amber' as const },
  closed: { label: '마감됨', tone: 'neutral' as const },
  none: { label: '시작 전', tone: 'ghost' as const },
};

/** 'HH:MM:SS' → 'HH:MM'. 설정값은 시각이라 초까지 오지만 화면엔 분까지면 된다. */
const clock = (t: string | null): string => (t ? t.slice(0, 5) : '');

/** '2026-08-22' → '8/22'. 어제 얘기를 할 때만 쓴다. */
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

export function BusinessDayBar({ state }: { state: BusinessDayState }) {
  const open = useOpenBusinessDay();
  const setBreak = useSetBreak();
  const close = useCloseBusinessDay();
  const reopen = useReopenBusinessDay();
  const fixStale = useCloseStaleAndOpen();
  const ack = useAckAutoClose();

  const st = TONE[state.status];
  const busy = open.isPending || setBreak.isPending || close.isPending || reopen.isPending || fixStale.isPending;
  const fail = (e: unknown) =>
    Alert.alert('처리하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요');

  /*
   * ⚠ 이 확인창이 잠금의 **유일한 설명**이다. 여기서 못 알아들으면 어디서도 못 알아듣는다.
   *   그래서 기능 설명("기준값이 고정돼요")이 아니라 **사장님에게 좋은 점**으로 적는다 —
   *   장사 중에 레시피를 고쳐도 오늘 장부가 안 흔들린다는 게 이 기능의 값어치다.
   */
  const onOpen = () =>
    Alert.alert(
      '오늘 값을 지금으로 굳힐까요?',
      '지금의 판매가·재료비·부자재·고정지출·세금으로 오늘 장부가 정해져요.\n\n'
        + '오늘 장사 중에 레시피나 재료값을 고쳐도 오늘 매출·손익은 안 흔들려요. '
        + '고친 값은 내일부터 들어가요.',
      [{ text: '취소', style: 'cancel' }, { text: '시작', onPress: () => open.mutate(undefined, { onError: fail }) }],
    );

  const onClose = () =>
    Alert.alert(
      '오늘 장사를 마칠까요?',
      '오늘 판매·매출·원가를 잠가요. 빠뜨린 게 있으면 나중에 다시 열 수 있어요.',
      [{ text: '취소', style: 'cancel' }, { text: '마감', onPress: () => close.mutate(undefined, { onError: fail }) }],
    );

  const onReopen = () =>
    Alert.alert(
      '다시 열까요?',
      '빠뜨린 판매를 넣을 수 있어요. 그날 가격·원가는 그날 굳은 값 그대로예요.',
      [
        { text: '취소', style: 'cancel' },
        { text: '다시 열기', onPress: () => reopen.mutate(state.businessDate, { onError: fail }) },
      ],
    );

  const onFixStale = () =>
    Alert.alert(
      `${md(state.businessDate)} 을 마감하고 오늘을 시작할까요?`,
      `${md(state.businessDate)} 장부는 그날 값 그대로 잠기고, 오늘 값이 지금으로 새로 정해져요.`,
      [
        { text: '취소', style: 'cancel' },
        { text: '마감하고 시작', onPress: () => fixStale.mutate(undefined, { onError: fail }) },
      ],
    );

  /*
   * 시각은 **하나만** 말한다. 예전엔 '예정 종료'와 '자동 종료' 둘을 같이 띄웠는데,
   * 둘이 왜 다른지는 아무 데도 안 적혀 있었다(활동이 있으면 1시간씩 미뤄진다).
   * 사장님이 알아야 할 건 '언제 닫히나' 하나다 — 실제로 닫히는 시각만 적는다.
   */
  const autoAt = hhmm(state.autoCloseAt);

  /** 급한가? 급하면 색이 바뀌고, 배지 대신 할 일이 앞에 온다. */
  const urgent = state.staleDay;
  const warn = !urgent && (state.warnSoon || state.pastPlanned);

  const note = (() => {
    if (state.status === 'none') {
      const o = clock(state.hours.openTime);
      const c = clock(state.hours.closeTime);
      // ⚠ 여기서 '왜 눌러야 하나'를 말해야 한다. 영업시간만 적어 두면 버튼이 장식으로 보인다.
      return o && c
        ? `시작하면 지금 가격·원가로 오늘이 정해져요 · 영업시간 ${o}~${c}`
        : '시작하면 지금 가격·원가로 오늘이 정해져요';
    }
    if (state.status === 'closed') {
      const t = hhmm(state.closedAt);
      return state.closeMethod === 'auto'
        ? `${t} 에 자동으로 마감됐어요`
        : t ? `${t} 에 마감했어요` : '오늘 장사를 마쳤어요';
    }
    /*
     * ⚠ 안 닫힌 날이 남아 있으면 **이 말이 제일 먼저** 나와야 한다.
     *   예전엔 초록 '영업중' 배지를 달고 작은 글씨로만 알렸다. 오늘 매출은 서버가
     *   45001 로 막는데 화면은 영업 중이라고 하니, 왜 저장이 안 되는지 알 길이 없었다
     *   (실제로 이틀 열려 있었고 판매 저장이 막혔다).
     */
    if (state.staleDay) return `${md(state.businessDate)} 장사가 안 닫혔어요 · 지금은 오늘 판매를 못 적어요`;
    if (state.warnSoon) return `곧 자동으로 마감돼요 · ${autoAt}`;
    // 예정 시각을 지나도 판매가 있으면 미뤄진다. 그 사실을 괄호로 붙여 준다.
    if (state.pastPlanned) return `${autoAt} 에 자동 마감돼요 · 판매가 있으면 더 미뤄져요`;
    return autoAt ? `${autoAt} 에 자동으로 마감돼요` : '판매를 적을 수 있어요';
  })();

  return (
    <View style={{ marginBottom: 11 }}>
      {/*
        ⚠ 배지·문장·버튼을 **한 줄에 넣지 않는다.** 그렇게 했더니 390px 폰에서
          버튼이 화면 밖으로 밀려 아예 안 보였다 — 눌러야 할 걸 못 누르니
          "알 수가 아예 없다"가 된다. 520px 에서만 멀쩡했다.
          위 줄은 배지와 버튼만(항상 들어간다), 설명은 아래 줄에서 마음껏 접힌다.
      */}
      <View
        style={{
          paddingVertical: 11, paddingHorizontal: 13,
          borderRadius: 12, borderWidth: 1,
          borderColor: urgent ? T.red : warn ? T.amberText : T.line,
          backgroundColor: urgent ? T.redTint : warn ? T.amberTint : T.surface,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Badge tone={urgent ? 'red' : st.tone}>{urgent ? '멈춤' : st.label}</Badge>
        <View style={{ flex: 1 }} />

        {/* ⚠ 막혀 있을 땐 버튼이 **하나**여야 한다. 뭘 눌러야 할지 고르게 하면 안 된다. */}
        {state.staleDay ? (
          <Button kind="primary" size="sm" onPress={onFixStale} loading={fixStale.isPending} accessibilityLabel="지난 장사 마감하고 오늘 시작">
            마감하고 시작
          </Button>
        ) : state.status === 'none' ? (
          <Button kind="primary" size="sm" onPress={onOpen} loading={open.isPending} accessibilityLabel="오늘 시작">
            시작
          </Button>
        ) : state.status === 'closed' ? (
          <Button kind="ghost" size="sm" onPress={onReopen} loading={reopen.isPending} accessibilityLabel="다시 열기">
            다시 열기
          </Button>
        ) : (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Button
              kind="ghost" size="sm" disabled={busy}
              onPress={() => setBreak.mutate(state.status !== 'break', { onError: fail })}
              accessibilityLabel={state.status === 'break' ? '영업 재개' : '브레이크타임 시작'}
            >
              {state.status === 'break' ? '재개' : '브레이크'}
            </Button>
            <Button kind="ghost" size="sm" disabled={busy} onPress={onClose} accessibilityLabel="오늘 마감">
              마감
            </Button>
          </View>
        )}
        </View>

        <Text style={{ fontSize: 14, fontWeight: '600', color: urgent ? T.red : T.sub, marginTop: 7, lineHeight: 20 }}>
          {note}
        </Text>
      </View>

      {/* 지난 자동 마감 알림 — 사장님이 누른 게 아니라 시간이 눌렀으므로 한 번은 알려야 한다. */}
      {state.unacked ? (
        <View
          style={{
            marginTop: 7,
            paddingVertical: 11, paddingHorizontal: 13, borderRadius: 12,
            borderWidth: 1, borderColor: T.line, backgroundColor: T.surface2,
          }}
        >
          {/* 여기도 한 줄에 몰지 않는다 — 위와 같은 이유로 '고치기'가 밀려 나갔다. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="info" size={17} color={T.sub2} />
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.sub, minWidth: 0 }}>
              {md(state.unacked.businessDate)} 장사가 {hhmm(state.unacked.closedAt)} 에 자동으로 마감됐어요
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 16, marginTop: 8 }}>
          <Pressable
            onPress={() => reopen.mutate(state.unacked!.businessDate, { onError: fail })}
            accessibilityRole="button" accessibilityLabel="그날 기록 고치기"
            hitSlop={6}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue }}>고치기</Text>
          </Pressable>
          <Pressable
            onPress={() => ack.mutate(state.unacked!.businessDayId)}
            accessibilityRole="button" accessibilityLabel="확인"
            hitSlop={6}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub2 }}>확인</Text>
          </Pressable>
          </View>
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

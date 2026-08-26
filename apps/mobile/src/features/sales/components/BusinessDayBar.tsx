/**
 * 영업 상태 카드 — 프로토타입 `business-hours-negative-stock-flow.html?screen=sales` 규격.
 *
 * 사장님 결정(0048~0050): **영업 시작 시점의 값으로 하루가 고정된다.**
 * 영업 중에 레시피·식재료를 고쳐도 오늘 매출·원가·손익은 안 움직인다. 이 잠금은 그대로다.
 *
 * ⚠ 0099 에서 **말과 배치만** 프로토타입에 맞췄다. 로직·데이터는 한 줄도 안 바꿨다.
 *   카드는 `.day-state` 한 줄이다 — 좌측 영업일 + 영업시간, 우측 상태/행동.
 *     · 설명 문장을 없앤다. 예전엔 `시작하면 지금 가격·원가로…` 같은 문장을 달았는데
 *       프로토타입은 **문장을 안 쓴다**(사장님: "설명이 더 헷갈려").
 *     · 상태 배지도 없앤다. 영업 중·브레이크는 **파란 셀렉터**가 상태를 겸하고,
 *       종료는 회색 pill 하나다.
 *     · 종료 원인 문구도 안 쓴다 — 직접 종료는 `영업 종료`, 자동은 `자동 영업종료` 로
 *       **뱃지 글자만** 다르다.
 */
import { Pressable, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { Button, ConfirmSheet, Icon, Sheet } from '@/components/kit';
import { useState } from 'react';
import { T } from '@/theme/tokens';
import { useCheckRecipeShortages, type ShortageRecipe } from '../hooks';
import { ShortageWarningSheet } from './ShortageWarningSheet';
import {
  hhmm,
  useBusinessDay,
  useCloseBusinessDay,
  useCloseStaleAndOpen,
  useOpenBusinessDay,
  useSetBreak,
  type BusinessDayState,
} from '../businessDay';

/** 'HH:MM:SS' → 'HH:MM'. */
const clock = (t: string | null): string => (t ? t.slice(0, 5) : '');

/** '2026-08-24' → ['8월 24일', '(월)'] — 날짜는 굵게, 요일은 보조. */
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
function dayParts(d: string): [string, string] {
  const [y, m, day] = d.split('-').map(Number);
  const w = new Date(Date.UTC(y!, (m ?? 1) - 1, day)).getUTCDay();
  return [`${m}월 ${day}일`, `(${DOW[w]})`];
}

/** 프로토타입 `.pill` — 11px/850, 안쪽 4/7. */
function Pill({ text, bg, fg, onPress }: { text: string; bg: string; fg: string; onPress?: () => void }) {
  const Wrap = onPress ? Pressable : View;
  return (
    <Wrap
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `${text} 바꾸기` : undefined}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 7, borderRadius: 7, backgroundColor: bg }}
    >
      <Text style={{ fontSize: 11, fontWeight: '800', color: fg }}>{text}</Text>
      {onPress ? <Icon name="chevronDown" size={11} color={fg} /> : null}
    </Wrap>
  );
}

export function BusinessDayBar({ state }: { state: BusinessDayState }) {
  const open = useOpenBusinessDay();
  const setBreak = useSetBreak();
  const close = useCloseBusinessDay();
  const fixStale = useCloseStaleAndOpen();
  const [manage, setManage] = useState(false);
  /*
   * ⚠ 확인은 **시트로** 한다. `Alert.alert()` 은 웹에서 빈 함수라 아무 일도 안 일어난다
   *   (`react-native-web` 의 구현이 `static alert() {}` 이다).
   *   그래서 '영업 시작' 버튼이 죽은 것처럼 보였다 — 실제로 사장님이 그렇게 겪었다.
   */
  const [ask, setAsk] = useState<null | 'open' | 'close'>(null);
  const [err, setErr] = useState<string | null>(null);
  const fail = (e: unknown) => setErr(e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요');
  const router = useRouter();
  /*
   * 영업 시작 전 부족 확인(기획안 §4.4) — 판정은 서버가 한다.
   * `현재 재고 < 1개 필요량` 인 레시피만 잡는다. 안전재고 미달인데 1개는 만들 수
   * 있는 건 여기 안 넣는다 — 매일 뜨는 빨간 경고는 아무도 안 읽는다.
   */
  const checkShortages = useCheckRecipeShortages();
  const [askShort, setAskShort] = useState<null | ShortageRecipe[]>(null);
  const [checking, setChecking] = useState(false);

  /**
   * 잠금 설명을 먼저 보이고, 그다음에 부족을 알린다. 부족이 없으면 바로 시작한다.
   *
   * ⚠ 여기서 **그 순간 서버에 묻는다.** 캐시를 읽던 시절엔 아직 안 받았거나 실패했을 때
   *   `?? 0` 에 걸려 부족이 없는 것처럼 지나갔다 — 경고가 있어야 할 자리에서 조용했다.
   */
  const startDay = () => {
    setChecking(true);
    void (async () => {
      try {
        const short = await checkShortages();
        if (short.ingredientCount > 0) { setAskShort(short.recipes); return; }
        open.mutate(undefined, { onError: fail });
      } catch {
        /*
         * 재는 데 실패했다고 **영업 시작을 막지 않는다.** 부족 확인은 알려 주는 절차이지
         * 허가가 아니다(기획안 §4.4). 조회 한 번 실패했다고 장사를 못 열면 그게 더 나쁘다.
         */
        open.mutate(undefined, { onError: fail });
      } finally {
        setChecking(false);
      }
    })();
  };

  /*
   * ⚠ 이 확인창이 잠금의 **유일한 설명**이다. 카드에서 문장을 뺐으므로 여기서만 말한다.
   *   기능 설명이 아니라 **사장님에게 좋은 점**으로 적는다 — 장사 중에 레시피를 고쳐도
   *   오늘 장부가 안 흔들린다는 게 이 기능의 값어치다.
   */
  const onOpen = () => setAsk('open');
  const onClose = () => setAsk('close');

  const [dateLabel, dowLabel] = dayParts(state.businessDate);
  const o = clock(state.hours.openTime);
  const c = clock(state.hours.closeTime);

  /*
   * 영업시간 자리 — 프로토타입 `.state-hours`.
   * 종료된 날은 **실제 시작–종료**를 보여 준다(직접 종료 11:00–21:30, 자동 11:00–22:00).
   *
   * ⚠ 자동 종료는 `closedAt` 이 아니라 `plannedCloseAt` 으로 그린다(0138).
   *   자동 마감의 `closedAt` 은 **기한**(예정 종료 + 유예)이라 23:00 이다.
   *   그 값을 그리면 `11:00–23:00` 이 되어 §6.1 이 못 박은 `11:00–22:00` 과 어긋난다.
   *   장부에는 기한이 맞고(22:45 판매보다 뒤여야 한다), 화면에는 예정 종료가 맞다 —
   *   **두 값은 뜻이 다르다.** 섞었던 게 0137 의 잘못이었다.
   */
  const closeShown = state.closeMethod === 'auto' ? state.plannedCloseAt : state.closedAt;
  const hours = state.status === 'closed' && closeShown
    ? `${o || '—'}–${hhmm(closeShown)}`
    : o && c ? `${o}–${c}` : '';

  const running = state.status === 'open' || state.status === 'break';
  const stateLabel = state.status === 'break' ? '브레이크 중' : '영업 중';

  return (
    <View style={{ marginBottom: 11 }}>
      <View
        style={{
          padding: 14, borderRadius: 16, borderWidth: 1, borderColor: T.line,
          // 프로토타입 `.state-closed` 만 배경이 다르다. 경고색 카드는 쓰지 않는다.
          backgroundColor: state.status === 'closed' ? T.surface2 : T.surface,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* 좌측 — 영업일과 영업시간. 프로토타입 `.state-info` */}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, minWidth: 0, flexShrink: 1 }}>
            <Text style={{ fontSize: 14, color: T.ink }} numberOfLines={1}>
              <Text style={{ fontWeight: '800' }}>{dateLabel}</Text>
              <Text style={{ fontSize: 12, color: T.sub2 }}> {dowLabel}</Text>
            </Text>
            {hours ? <Text style={{ fontSize: 12, fontWeight: '700', color: T.ter }}>{hours}</Text> : null}
          </View>

          <View style={{ flex: 1 }} />

          {/*
            우측 — 상태가 곧 행동이다(프로토타입 `.state-actions`).
            ⚠ 안 닫힌 날이 남은 경우는 프로토타입에 **없다.** 서버가 예정 시각에
              자동으로 닫으면 생기지 않는 상태이기 때문이다(기획안 §7.3, 3단계).
              그때까지는 빠져나갈 길이 필요하므로 `영업 시작` 과 **같은 자리·같은 모양**에
              글자만 바꿔 둔다. 새 색이나 새 카드를 만들지 않는다.
          */}
          {state.staleDay ? (
            <Button
              kind="primary" size="sm" loading={fixStale.isPending}
              onPress={() => fixStale.mutate(undefined, { onError: fail })}
              accessibilityLabel="지난 장사 마감하고 오늘 시작"
            >
              마감하고 시작
            </Button>
          ) : state.status === 'none' ? (
            <Button kind="primary" size="sm" onPress={onOpen} loading={open.isPending || checking} accessibilityLabel="영업 시작">
              영업 시작
            </Button>
          ) : running ? (
            <Pill text={stateLabel} bg={T.blue} fg={T.onColor} onPress={() => setManage(true)} />
          ) : (
            <Pill
              text={state.closeMethod === 'auto' ? '자동 영업종료' : '영업 종료'}
              bg={T.line2}
              fg={T.sub2}
            />
          )}
        </View>
      </View>

      {/*
        ⚠ 자동 마감 확인 배너는 **없앴다**(기획안 §5-4, §11 4단계).
          "예정 종료는 정상 동작이므로 매일 확인 배너를 띄우지 않는다."
          직접 종료와 자동 종료는 뱃지 글자로만 구분한다 — `영업 종료` / `자동 영업종료`.
          지난 장부를 고치는 길은 과거 매출 수정 화면이다.
      */}

      {/*
        상태 셀렉터가 여는 시트 — 프로토타입은 하단 메뉴에 두 줄만 둔다.
          영업 중   ① 브레이크 타임  ② 영업 종료
          브레이크  ① 영업 재개      ② 영업 종료
      */}
      <ConfirmSheet
        visible={ask === 'open'}
        title="오늘 값을 지금으로 굳힐까요?"
        message={'지금의 판매가·재료비·부자재·고정지출·세금으로 오늘 장부가 정해져요.\n\n'
          + '오늘 장사 중에 레시피나 재료값을 고쳐도 오늘 매출·손익은 안 흔들려요. 고친 값은 내일부터 들어가요.'}
        confirmText="영업 시작"
        loading={open.isPending}
        onCancel={() => setAsk(null)}
        onConfirm={() => { setAsk(null); startDay(); }}
      />

      {/*
        ⚠ 부족해도 **막지 않는다**(기획안 §4.4). 알고 넘어갈 기회만 준다.
          `그대로 영업 시작` 을 누르면 그대로 연다. 미해결 부족은 매출 상단의
          `식재료 부족 N개` 안내가 계속 들고 있는다.
      */}
      <ShortageWarningSheet
        visible={askShort !== null}
        mode="start"
        recipes={askShort ?? []}
        loading={open.isPending}
        onCheck={() => { setAskShort(null); router.push('/sales/stock-check?mode=start' as Href); }}
        onContinue={() => { setAskShort(null); open.mutate(undefined, { onError: fail }); }}
        onClose={() => setAskShort(null)}
      />
      <ConfirmSheet
        visible={ask === 'close'}
        title="오늘 장사를 마칠까요?"
        message="오늘 판매·매출·원가를 잠가요. 종료한 뒤에는 오늘 장부에 더 넣을 수 없어요."
        confirmText="영업 종료"
        loading={close.isPending}
        onCancel={() => setAsk(null)}
        onConfirm={() => { setAsk(null); close.mutate(undefined, { onError: fail }); }}
      />
      <ConfirmSheet
        visible={err !== null}
        title="처리하지 못했어요"
        message={err ?? ''}
        confirmText="확인"
        cancelText="닫기"
        onCancel={() => setErr(null)}
        onConfirm={() => setErr(null)}
      />

      <Sheet visible={manage} onClose={() => setManage(false)} title={stateLabel} sub={`${dateLabel} ${dowLabel}`} height={300}>
        {([
          state.status === 'break'
            ? ['영업 재개', () => setBreak.mutate(false, { onError: fail })] as const
            : ['브레이크 타임', () => setBreak.mutate(true, { onError: fail })] as const,
          ['영업 종료', onClose] as const,
        ]).map(([label, run], i) => (
          <Pressable
            key={label}
            onPress={() => { setManage(false); run(); }}
            accessibilityRole="button" accessibilityLabel={label}
            style={{
              flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 4,
              borderBottomWidth: i === 0 ? 1 : 0, borderBottomColor: T.line2,
            }}
          >
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.ink }}>{label}</Text>
            <Icon name="chevron" size={16} color={T.line3} />
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}

/** 매출 화면들이 같은 상태를 공유하도록 조회까지 묶어 둔다. */
export function BusinessDayBarConnected() {
  const q = useBusinessDay();
  return q.data ? <BusinessDayBar state={q.data} /> : null;
}

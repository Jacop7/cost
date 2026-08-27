/**
 * MY-09 영업시간 — 요일별 시간·브레이크·매장 시간대 (0156).
 *
 * 왜 필요한가: 종료 시각이 **영업일 경계**다. 10:00~02:00 영업인데 자정을 경계로
 * 쓰면 새벽 1시 매출이 다음 날로 넘어가 하루 장사가 둘로 쪼개진다. 경계 판정은
 * 서버(resolve_sales_business_context)가 요일별 규칙으로 한다 — 여기는 그 규칙을
 * 적는 화면이다.
 *
 * 짜임 —
 *   · 요일 칩(월~일)을 **골라서** 공통 시간을 적용한다. 요일마다 화면을 오가지 않는다.
 *   · 시각은 15분 단위 선택 + 직접 입력. 자정 넘김은 종료<시작이면 자동으로 '다음 날'.
 *   · 검증은 서버(assert_weekly_schedule)가 권위이고, 같은 규칙의 거울
 *     (`weeklySchedule.ts`)이 저장 전에 같은 말을 미리 해 준다.
 *   · 매장 시간대는 별도 문(set_store_timezone) — 영업 중이면 서버가 45011 로 막는다.
 *     정한 적 없으면(confirmed=false) 기기 시간대를 제안한다.
 *
 * 브레이크 타임은 판매가 없는 시간대 표시일 뿐이고, 장부를 확정하지 않는다.
 * 확정은 영업 종료 한 번이다.
 */
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { RpcError } from '@/lib/supabase';
import { AppHeader, Badge, Button, Card, Icon, QueryState, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';
import { useHoursStatus, useSetOperatingHours, useSetStoreTimezone } from '@/features/settings/hooks';
import {
  DEFAULT_DAY, DOW_LABEL, DOW_ORDER, QUARTER_SLOTS, WeeklySchedule,
  fromRule, isOvernight, normalizeTimeInput, spanLabel, spanMinutes,
  toWeeklyJson, validateWeeklySchedule,
} from '../weeklySchedule';

const NUM = { fontVariant: ['tabular-nums' as const] };

/** '2026-08-27' → '8월 27일'. 이 화면 한 줄에만 쓰므로 여기 둔다. */
const mdLabel = (ymd: string) => `${Number(ymd.slice(5, 7))}월 ${Number(ymd.slice(8, 10))}일`;

/** 자주 쓰는 시간대 — 전체 IANA 목록은 화면에 못 싣는다. 나머지는 직접 입력. */
const COMMON_TZ = [
  'Asia/Seoul', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Bangkok',
  'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Australia/Sydney',
];

/** 기기 시간대 — 최초 제안용. 못 읽으면 null(제안을 안 하는 게 낫다). */
function deviceTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // `UTC`도 Intl·PostgreSQL이 모두 아는 유효한 IANA 시간대다. 지역/도시 형태만
    // 받으면 UTC로 설정된 기기에서는 최초 시간대 제안이 조용히 사라진다.
    return typeof tz === 'string' && tz.trim() ? tz : null;
  } catch {
    return null;
  }
}

const dayLabel = (s: { open: string; close: string; closed: boolean; breakStart: string | null; breakEnd: string | null }) => {
  if (s.closed) return '휴무';
  const night = isOvernight(s.open, s.close);
  const base = `${s.open}~${night ? '다음 날 ' : ''}${s.close}`;
  return s.breakStart && s.breakEnd ? `${base} · 브레이크 ${s.breakStart}~${s.breakEnd}` : base;
};

export default function MyHoursScreen() {
  const status = useHoursStatus();
  const save = useSetOperatingHours();
  const saveTz = useSetStoreTimezone();

  /** 편집 중인 주간표. 서버 규칙을 받아 시작한다. */
  const [days, setDays] = useState<WeeklySchedule | null>(null);
  /**
   * 편집 기준의 판본(0159 · 검토 P1-1). 저장에 되보내 다른 기기의 변경을 덮지 않는다.
   * 저장 응답의 새 판본으로 갱신해 이어서 편집할 수 있다.
   */
  const [base, setBase] = useState<{ ruleId: string; revision: number } | null>(null);
  /** 지금 고른 요일들(dow). 편집 패널의 값이 여기 요일에 적용된다. */
  const [selected, setSelected] = useState<Set<number>>(new Set());
  /**
   * 패널 값을 가져온 **기준 요일**(검토 P1 재재검토). 그 요일이 해제되면 남은 요일 중
   * 첫 요일의 값을 다시 싣는다 — 2→1 만 보면 3→2 에서 기준이 빠진 뒤 다른 요일이
   * 기준 요일 값으로 조용히 덮인다.
   */
  const [panelSource, setPanelSource] = useState<number | null>(null);

  // 편집 패널 — 선택 요일에 적용할 값.
  const [pOpen, setPOpen] = useState('11:00');
  const [pClose, setPClose] = useState('22:00');
  const [pClosed, setPClosed] = useState(false);
  const [useBreak, setUseBreak] = useState(false);
  const [pBs, setPBs] = useState('15:00');
  const [pBe, setPBe] = useState('17:00');

  const [picking, setPicking] = useState<null | 'open' | 'close' | 'bs' | 'be'>(null);
  const [typed, setTyped] = useState('');
  const [tzOpen, setTzOpen] = useState(false);
  const [tzTyped, setTzTyped] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const st = status.data;

  useEffect(() => {
    if (!st || days !== null) return;
    /*
     * 편집 기준은 **예약이 있으면 예약**이다(0159 · 검토 P1-1). 예전엔 늘 현재 규칙으로
     * 시작해서, 영업 중에 바꿔 둔 예약을 재진입한 화면이 못 보고 다시 덮었다.
     * ⚠ 규칙 모양이 어긋나면 기본값으로 **메우지 않는다**(fromRule 이 null).
     *   메우면 사장님이 저장하는 순간 진짜 규칙이 기본값으로 덮인다.
     *   규칙이 아예 없는 새 매장만 기본값에서 시작한다.
     */
    const basis = st.pending ?? st.currentRule;
    if (basis) {
      const parsed = fromRule(basis.weeklyHours, basis.weeklyBreaks);
      if (parsed) {
        setDays(parsed);
        setBase({ ruleId: basis.ruleId, revision: basis.revision });
      }
      return;
    }
    const fresh: WeeklySchedule = {};
    for (let d = 0; d < 7; d += 1) fresh[d] = { ...DEFAULT_DAY };
    setDays(fresh);
    setBase(null);
  }, [st, days]);

  const brokenRule = Boolean(st?.pending ?? st?.currentRule) && days === null && !status.isLoading;

  const validationError = useMemo(() => (days ? validateWeeklySchedule(days) : null), [days]);
  const overnight = !pClosed && isOvernight(pOpen, pClose);

  /*
   * 첫 요일을 고르면 **그 요일의 현재 값**을 패널에 싣는다(검토 P2-5).
   * 예전엔 늘 11:00~22:00 으로 시작해서, 09:00~17:00 요일의 브레이크만 바꾸려다
   * 시간까지 기본값으로 덮을 수 있었다.
   */
  const loadDayIntoPanel = (d: number) => {
    const day = days?.[d];
    if (!day) return;
    setPanelSource(d);
    setPClosed(day.closed);
    if (!day.closed) { setPOpen(day.open); setPClose(day.close); }
    const hasBreak = day.breakStart !== null && day.breakEnd !== null;
    setUseBreak(hasBreak);
    if (hasBreak) { setPBs(day.breakStart!); setPBe(day.breakEnd!); }
  };

  const toggleDay = (d: number) => {
    const next = new Set(selected);
    const removing = next.has(d);
    if (removing) next.delete(d); else next.add(d);
    /*
     * 패널은 "기준 요일의 현재 값"을 따라간다 —
     *   · 첫 선택: 그 요일이 기준이다.
     *   · **기준 요일이 해제되면** 남은 요일 중 표시 순서상 첫 요일을 새 기준으로 싣는다.
     *     2→1 만 보면 부족하다(검토 P1): 수(09~17)·화·목을 고른 뒤 수를 빼면 패널은
     *     09~17 인 채 화·목만 남고, 적용이 둘을 조용히 덮는다.
     */
    if (next.size === 0) {
      setPanelSource(null);
    } else if (selected.size === 0 || (removing && d === panelSource)) {
      const first = DOW_ORDER.find((x) => next.has(x));
      if (first !== undefined) loadDayIntoPanel(first);
    }
    setSelected(next);
  };

  /** 고른 요일들의 저장된 값이 서로 다른가 — 적용하면 전부 패널 값으로 덮인다. */
  const mixedSelection = useMemo(() => {
    if (!days || selected.size < 2) return false;
    const keys = [...selected].map((d) => JSON.stringify(days[d] ?? null));
    return new Set(keys).size > 1;
  }, [days, selected]);

  /** 편집 패널 값을 고른 요일들에 적는다. */
  const applyToSelected = () => {
    if (!days || selected.size === 0) return;
    // 적용하면 고른 요일이 전부 패널 값이 된다 — 기준 요일은 그중 첫 요일로 둔다.
    setPanelSource(DOW_ORDER.find((x) => selected.has(x)) ?? null);
    const next: WeeklySchedule = { ...days };
    for (const d of selected) {
      next[d] = pClosed
        ? { ...(next[d] ?? DEFAULT_DAY), closed: true, breakStart: null, breakEnd: null }
        : {
            open: pOpen, close: pClose, closed: false,
            breakStart: useBreak ? pBs : null,
            breakEnd: useBreak ? pBe : null,
          };
    }
    setDays(next);
    setToast(`${DOW_ORDER.filter((d) => selected.has(d)).map((d) => DOW_LABEL[d]).join('·')}요일에 적용했어요`);
  };

  /**
   * 최신 규칙으로 편집을 **직접** 교체한다(검토 P1-1 재검토).
   * ⚠ `setDays(null)` 뒤 refetch 만 부르면, 재조회가 끝나기 전에 effect 가 캐시의
   *   **옛** 데이터로 다시 초기화한다 — 새 응답은 무시되고 45009 가 반복됐다.
   *   refetch 의 결과를 기다려 그 값으로 바꿔 넣는다.
   */
  const reloadFromServer = async () => {
    const r = await status.refetch();
    /*
     * ⚠ 재조회가 **실패**하면 r.data 에는 캐시의 옛 데이터가 남아 있다(react-query 는
     *   오류 때 이전 데이터를 유지한다). 그걸 최신으로 오판해 다시 적용하면 옛 판본이
     *   되살아나 45009 가 반복된다 — 성공한 응답으로만 교체한다.
     */
    if (r.isError || !r.data) return false;
    const basis = r.data.pending ?? r.data.currentRule;
    if (!basis) return false;
    const parsed = fromRule(basis.weeklyHours, basis.weeklyBreaks);
    if (!parsed) return false;
    setDays(parsed);
    setBase({ ruleId: basis.ruleId, revision: basis.revision });
    setSelected(new Set());
    setPanelSource(null);
    return true;
  };

  const submit = () => {
    if (!days) return;
    // 거울 검증 — 서버가 할 말을 미리 한다. 권위는 서버다.
    const err = validateWeeklySchedule(days);
    if (err) { Alert.alert('저장할 수 없어요', err); setToast(err); return; }
    // ⚠ 판본 없이는 저장하지 않는다(0163) — 서버도 거부하지만, 여기서 먼저 최신 값을 받아 온다.
    if (!base) {
      // ⚠ 재조회가 또 실패할 수 있다 — 결과를 보고 말한다("불러왔어요"는 성공했을 때만).
      void reloadFromServer().then((ok) => setToast(ok
        ? '편집 기준을 다시 불러왔어요 · 다시 저장해 주세요'
        : '최신 값을 못 받았어요 · 잠시 뒤 다시 시도해 주세요'));
      return;
    }
    const { hours, breaks } = toWeeklyJson(days);
    save.mutate(
      // ⚠ 판본을 반드시 실어 보낸다(0159) — 빼먹으면 다른 기기의 변경을 조용히 덮는다.
      { weeklyHours: hours, weeklyBreaks: breaks, baseRuleId: base.ruleId, baseRevision: base.revision },
      {
        onSuccess: (r) => {
          // 다음 저장에 되보낼 판본 — 이어서 편집해도 내 저장과 충돌하지 않는다.
          setBase({ ruleId: r.ruleId, revision: r.ruleRevision });
          setToast(r.appliesToday
            ? '저장했어요 · 오늘부터 적용돼요'
            : `저장했어요 · ${mdLabel(r.effectiveFrom)}부터 적용돼요`);
        },
        onError: (e) => {
          /*
           * 낡은 화면(45009) — 다른 기기가 먼저 저장했다. 붙잡을 게 없다:
           * 들고 있던 편집을 버리고 최신 규칙으로 **교체**한다(판매 저장과 같은 처리).
           */
          if (e instanceof RpcError && e.code === '45009') {
            // 낡은 판본으로는 더 저장하지 못하게 먼저 막는다 — 재조회가 실패해도 그대로다.
            setBase(null);
            void reloadFromServer().then((ok) => {
              setToast(ok
                ? '다른 기기에서 영업시간이 변경됐어요 · 최신 값을 다시 불러왔어요'
                : '다른 기기에서 영업시간이 변경됐어요 · 최신 값을 못 받았어요. 다시 시도해 주세요');
            });
            return;
          }
          const msg = e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요';
          Alert.alert('저장하지 못했어요', msg); setToast(msg);
        },
      },
    );
  };

  const chooseTz = (tz: string) => {
    setTzOpen(false);
    saveTz.mutate(tz, {
      onSuccess: () => setToast(`매장 시간대를 ${tz} 로 저장했어요`),
      onError: (e) => {
        // 영업 중(45011)이면 서버 문구가 그대로 할 일을 말한다.
        const msg = e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요';
        Alert.alert('시간대를 바꾸지 못했어요', msg); setToast(msg);
      },
    });
  };

  const pickValue = picking === 'open' ? pOpen : picking === 'close' ? pClose : picking === 'bs' ? pBs : pBe;
  const applyPick = (t: string) => {
    if (picking === 'open') setPOpen(t);
    else if (picking === 'close') setPClose(t);
    else if (picking === 'bs') setPBs(t);
    else if (picking === 'be') setPBe(t);
    setPicking(null); setTyped('');
  };

  const TimeRow = ({ label, value, kind, hint }: { label: string; value: string; kind: 'open' | 'close' | 'bs' | 'be'; hint?: string }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, borderTopWidth: 1, borderTopColor: T.line2 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: T.sub }}>{label}</Text>
        {hint ? <Text style={{ fontSize: 13, color: T.ter, marginTop: 1 }}>{hint}</Text> : null}
      </View>
      <Pressable onPress={() => { setPicking(kind); setTyped(''); }} accessibilityRole="button" accessibilityLabel={`${label} 선택`} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{value}</Text>
        <Icon name="chevronDown" size={16} color={T.ter} />
      </Pressable>
    </View>
  );

  const deviceTz = deviceTimezone();

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="영업시간" onBack={() => safeBack('/my')} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 11 }}>
        <QueryState
          isLoading={status.isLoading}
          error={status.error ?? (brokenRule ? new Error('영업시간 규칙을 읽지 못했어요. 잠시 후 다시 시도해 주세요') : null)}
          isEmpty={false}
          onRetry={() => { void reloadFromServer(); }}
          emptyTitle="설정을 불러오지 못했어요"
        >
          {/* 예약된 변경이 있으면 **제일 위에** 말한다(0131). */}
          {st?.pending ? (
            <Card pad={0} style={{ overflow: 'hidden', borderColor: T.blue }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 14 }}>
                <View style={{ paddingTop: 1 }}><Icon name="calendar" size={18} color={T.blue} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: T.blue }}>
                    변경한 영업시간은 {mdLabel(st.pending.effectiveFrom)}부터 적용돼요
                  </Text>
                  <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>
                    오늘 영업시간은 {st.today.openTime.slice(0, 5)}~{st.today.closeTime.slice(0, 5)} 그대로예요.
                  </Text>
                </View>
              </View>
            </Card>
          ) : null}

          {/* 매장 시간대 — 날짜 계산의 뿌리. 정한 적 없으면 기기 시간대를 제안한다. */}
          {st && !st.timezoneConfirmed && deviceTz ? (
            <Card pad={0} style={{ overflow: 'hidden', borderColor: T.blue }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 }}>
                <Icon name="info" size={18} color={T.blue} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: T.blue }}>매장 시간대를 정해 주세요</Text>
                  <Text style={{ fontSize: 13.5, color: T.ter, marginTop: 2 }}>기기 시간대는 {deviceTz} 예요.</Text>
                </View>
                <Button kind="primary" size="sm" loading={saveTz.isPending} onPress={() => chooseTz(deviceTz)}>
                  기기 시간대 사용
                </Button>
              </View>
            </Card>
          ) : null}

          <Card pad={0} style={{ overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: T.sub }}>매장 시간대</Text>
                <Text style={{ fontSize: 13.5, color: T.ter, marginTop: 2 }}>
                  {st?.timezoneConfirmed ? '날짜·영업일 계산의 기준이에요' : '아직 정하지 않아 서울 기준이에요'}
                </Text>
              </View>
              <Pressable onPress={() => { setTzTyped(''); setTzOpen(true); }} accessibilityRole="button" accessibilityLabel="시간대 변경" style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: T.ink }}>{st?.timezone ?? ''}</Text>
                <Icon name="chevronDown" size={16} color={T.ter} />
              </Pressable>
            </View>
          </Card>

          {/* 요일별 현재 값 — 저장될 결과를 그대로 보여 준다. */}
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.sub }}>요일별 영업시간</Text>
              <Text style={{ fontSize: 13.5, color: T.ter }}>바꿀 요일을 고르세요</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 6, padding: 13 }}>
              {DOW_ORDER.map((d) => {
                const on = selected.has(d);
                const closed = days?.[d]?.closed === true;
                return (
                  <Pressable
                    key={d}
                    onPress={() => toggleDay(d)}
                    accessibilityRole="button"
                    accessibilityLabel={`${DOW_LABEL[d]}요일`}
                    accessibilityState={{ selected: on }}
                    style={{
                      flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10, borderWidth: 1,
                      borderColor: on ? T.blue : T.line,
                      backgroundColor: on ? T.blueTint : closed ? T.surface2 : T.surface,
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: on ? '800' : '600', color: on ? T.blue : closed ? T.ter : T.sub2 }}>
                      {DOW_LABEL[d]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {days ? DOW_ORDER.map((d) => (
              <View key={d} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 15, borderTopWidth: 1, borderTopColor: T.line2 }}>
                <Text style={{ width: 34, fontSize: 15, fontWeight: '800', color: selected.has(d) ? T.blue : T.sub }}>{DOW_LABEL[d]}</Text>
                <Text style={[{ flex: 1, fontSize: 14.5, fontWeight: '600', color: days[d]?.closed ? T.ter : T.ink }, NUM]}>
                  {days[d] ? dayLabel(days[d]) : '—'}
                </Text>
              </View>
            )) : null}
          </Card>

          {/* 편집 패널 — 고른 요일에 공통 적용 */}
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 13, paddingHorizontal: 15, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.sub }}>
                {selected.size > 0
                  ? `${DOW_ORDER.filter((d) => selected.has(d)).map((d) => DOW_LABEL[d]).join('·')}요일 시간`
                  : '요일을 먼저 고르세요'}
              </Text>
              {mixedSelection ? <Badge tone="neutral" sm>값이 서로 달라요</Badge> : null}
              {overnight ? <Badge tone="blue" sm>자정 넘김</Badge> : null}
              {!pClosed ? (
                <Text style={[{ fontSize: 15, fontWeight: '800', color: T.ink }, NUM]}>
                  {pOpen === pClose ? '—' : spanLabel(spanMinutes(pOpen, pClose))}
                </Text>
              ) : null}
            </View>

            {/* 휴무 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15 }}>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: T.sub }}>휴무</Text>
              <Pressable
                onPress={() => setPClosed((v) => !v)}
                accessibilityRole="switch" accessibilityLabel="휴무"
                accessibilityState={{ checked: pClosed }}
                style={{ paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, backgroundColor: pClosed ? T.blue : T.line2 }}
              >
                <Text style={{ fontSize: 13.5, fontWeight: '800', color: pClosed ? T.onColor : T.sub2 }}>{pClosed ? '휴무' : '영업'}</Text>
              </Pressable>
            </View>

            {!pClosed ? (
              <>
                <TimeRow label="시작" value={pOpen} kind="open" />
                <TimeRow label="종료" value={pClose} kind="close" hint={overnight ? '다음 날' : undefined} />

                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, borderTopWidth: 1, borderTopColor: T.line2 }}>
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: T.sub }}>브레이크 타임</Text>
                  <Pressable
                    onPress={() => setUseBreak((v) => !v)}
                    accessibilityRole="switch" accessibilityLabel="브레이크 타임 사용"
                    accessibilityState={{ checked: useBreak }}
                    style={{ paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, backgroundColor: useBreak ? T.blue : T.line2 }}
                  >
                    <Text style={{ fontSize: 13.5, fontWeight: '800', color: useBreak ? T.onColor : T.sub2 }}>{useBreak ? '사용' : '사용 안 함'}</Text>
                  </Pressable>
                </View>
                {useBreak ? (
                  <>
                    <TimeRow label="브레이크 시작" value={pBs} kind="bs" />
                    <TimeRow label="브레이크 종료" value={pBe} kind="be" />
                  </>
                ) : null}
              </>
            ) : null}

            <View style={{ padding: 13, borderTopWidth: 1, borderTopColor: T.line2 }}>
              <Button kind="ghost" full disabled={selected.size === 0} onPress={applyToSelected}>
                선택한 요일에 적용
              </Button>
            </View>
          </Card>

          {/* 거울 검증 결과 — 저장 전에 서버가 할 말을 미리 보여 준다. */}
          {validationError ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: 2 }}>
              <Icon name="info" size={15} color={T.red} />
              <Text style={{ flex: 1, fontSize: 14, color: T.red, lineHeight: 20 }}>{validationError}</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: 2 }}>
              <Icon name="info" size={15} color={T.ter} />
              <Text style={{ flex: 1, fontSize: 14, color: T.ter, lineHeight: 20 }}>
                종료 시각이 <Text style={{ fontWeight: '700' }}>하루의 경계</Text>예요. 종료를 시작보다
                이르게 두면 자동으로 다음 날 종료(자정 넘김)로 저장돼요.
              </Text>
            </View>
          )}
        </QueryState>
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 11, paddingBottom: 30, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <Button kind="primary" size="lg" full loading={save.isPending} disabled={!days || validationError !== null} onPress={submit}>
          저장
        </Button>
      </View>

      {/* 시각 선택 — 15분 단위 + 직접 입력 */}
      <Sheet
        visible={picking !== null}
        onClose={() => { setPicking(null); setTyped(''); }}
        title={picking === 'open' ? '영업 시작' : picking === 'close' ? '영업 종료' : picking === 'bs' ? '브레이크 시작' : '브레이크 종료'}
        height="72%"
      >
        <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 11, alignItems: 'center' }}>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            placeholder="직접 입력 · 예) 21:30"
            placeholderTextColor={T.ter}
            keyboardType="numbers-and-punctuation"
            accessibilityLabel="시각 직접 입력"
            style={{ flex: 1, borderWidth: 1, borderColor: T.line, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, fontSize: 15, color: T.ink, backgroundColor: T.surface }}
          />
          <Button
            kind="primary" size="sm"
            onPress={() => {
              const t = normalizeTimeInput(typed);
              if (t === null) { setToast('시각은 HH:MM 으로 적어 주세요'); return; }
              applyPick(t);
            }}
          >
            입력
          </Button>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingBottom: 24 }}>
          {QUARTER_SLOTS.map((t) => {
            const on = t === pickValue;
            return (
              <Pressable
                key={t}
                onPress={() => applyPick(t)}
                accessibilityRole="button" accessibilityLabel={t}
                accessibilityState={{ selected: on }}
                style={{ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, borderColor: on ? T.blue : T.line, backgroundColor: on ? T.blueTint : T.surface }}
              >
                <Text style={[{ fontSize: 14, fontWeight: on ? '800' : '600', color: on ? T.blue : T.sub2 }, NUM]}>{t}</Text>
              </Pressable>
            );
          })}
        </View>
      </Sheet>

      {/* 시간대 선택 */}
      <Sheet visible={tzOpen} onClose={() => setTzOpen(false)} title="매장 시간대" sub="날짜·영업일 계산의 기준이에요" height="72%">
        <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 11, alignItems: 'center' }}>
          <TextInput
            value={tzTyped}
            onChangeText={setTzTyped}
            placeholder="직접 입력 · 예) Asia/Seoul"
            placeholderTextColor={T.ter}
            autoCapitalize="none"
            accessibilityLabel="시간대 직접 입력"
            style={{ flex: 1, borderWidth: 1, borderColor: T.line, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, fontSize: 15, color: T.ink, backgroundColor: T.surface }}
          />
          <Button kind="primary" size="sm" onPress={() => { if (tzTyped.trim()) chooseTz(tzTyped.trim()); }}>
            입력
          </Button>
        </View>
        {(deviceTz && !COMMON_TZ.includes(deviceTz) ? [deviceTz, ...COMMON_TZ] : COMMON_TZ).map((tz) => {
          const on = tz === st?.timezone;
          return (
            <Pressable
              key={tz}
              onPress={() => chooseTz(tz)}
              accessibilityRole="button" accessibilityLabel={tz}
              accessibilityState={{ selected: on }}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: T.line2 }}
            >
              <Text style={{ flex: 1, fontSize: 15, fontWeight: on ? '800' : '600', color: on ? T.blue : T.ink }}>{tz}</Text>
              {tz === deviceTz ? <Badge tone="blue" sm>기기</Badge> : null}
              {on ? <Icon name="check" size={17} color={T.blue} /> : null}
            </Pressable>
          );
        })}
        <View style={{ height: 24 }} />
      </Sheet>

      {/* 짧은 알림 — 팝업 대신. 웹에서도 뜬다(Alert 는 웹에서 빈 함수다). */}
      {toast ? (
        <Pressable
          onPress={() => setToast(null)}
          accessibilityRole="button" accessibilityLabel="알림 닫기"
          style={{ position: 'absolute', left: 16, right: 16, bottom: 24, paddingVertical: 13, paddingHorizontal: 15, borderRadius: 12, backgroundColor: 'rgba(25,31,40,0.92)' }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff', lineHeight: 20 }}>{toast}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

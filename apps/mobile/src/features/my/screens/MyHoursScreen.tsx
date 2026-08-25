/**
 * MY-09 영업시간 — 시작·종료·브레이크 타임.
 *
 * 왜 필요한가: 종료 시각이 **영업일 경계**다(0047). 10:00~02:00 영업인데 자정을
 * 경계로 쓰면 새벽 1시 매출이 다음 날로 넘어가 하루 장사가 둘로 쪼개진다.
 * 여기서 종료를 02:00 으로 두면 새벽 장사가 전날에 묶인다.
 *
 * 브레이크 타임은 판매가 없는 시간대 표시일 뿐이고, 장부를 확정하지 않는다.
 * 확정은 영업 종료 한 번이다.
 */
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { AppHeader, Badge, Button, Card, Icon, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';
import { useHoursStatus, useSaveSettings, useStoreSettings } from '../hooks';

const NUM = { fontVariant: ['tabular-nums' as const] };

/** 30분 단위. 분 단위까지 받으면 입력만 번거롭고 경계 계산에 득이 없다. */
const SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
});

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** 자정을 넘으면 24시간을 더해 길이를 구한다. */
function spanMinutes(open: string, close: string): number {
  const d = toMin(close) - toMin(open);
  return d <= 0 ? d + 24 * 60 : d;
}

const spanLabel = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
};

/** '2026-08-27' → '8월 27일'. 이 화면 한 줄에만 쓰므로 여기 둔다. */
const mdLabel = (ymd: string) => `${Number(ymd.slice(5, 7))}월 ${Number(ymd.slice(8, 10))}일`;

export default function MyHoursScreen() {
  const settings = useStoreSettings();
  /**
   * ⚠ 저장한 값과 **적용 중인 값**은 다를 수 있다(0130·0131).
   *   영업 중에 시간을 바꾸면 오늘은 옛 시간으로 끝내고 내일부터 새 시간이다.
   *   이 줄이 없으면 사장님은 오늘부터 바뀐 줄 안다 — 서버는 맞는데 화면이 거짓말한다.
   */
  const status = useHoursStatus();
  const save = useSaveSettings();
  const s = settings.data;
  const pending = status.data?.pending ?? null;

  const [open, setOpen] = useState('11:00');
  const [close, setClose] = useState('22:00');
  const [bStart, setBStart] = useState<string | null>(null);
  const [bEnd, setBEnd] = useState<string | null>(null);
  const [picking, setPicking] = useState<null | 'open' | 'close' | 'bStart' | 'bEnd'>(null);

  useEffect(() => {
    if (!s) return;
    setOpen(s.openTime);
    setClose(s.closeTime);
    setBStart(s.breakStart);
    setBEnd(s.breakEnd);
  }, [s]);

  const overnight = toMin(close) <= toMin(open);
  const span = spanMinutes(open, close);
  const sameTime = open === close;
  const breakBroken = (bStart === null) !== (bEnd === null);

  const dirty =
    s !== undefined &&
    (open !== s.openTime || close !== s.closeTime || bStart !== s.breakStart || bEnd !== s.breakEnd);

  const submit = () => {
    if (sameTime) { Alert.alert('시작과 종료가 같아요', '영업일 경계를 정할 수 없어요. 다른 시각으로 바꿔 주세요.'); return; }
    if (breakBroken) { Alert.alert('브레이크 타임', '시작과 종료를 모두 정하거나, 둘 다 비워 주세요.'); return; }
    save.mutate(
      { openTime: open, closeTime: close, breakStart: bStart, breakEnd: bEnd },
      { onError: (e) => Alert.alert('저장하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요') },
    );
  };

  const Row = ({ label, value, hint, onPress, onClear }: {
    label: string; value: string | null; hint?: string;
    onPress: () => void; onClear?: () => void;
  }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub }}>{label}</Text>
        {hint ? <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>{hint}</Text> : null}
      </View>
      {onClear && value !== null ? (
        <Pressable onPress={onClear} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${label} 지우기`} style={{ paddingHorizontal: 8 }}>
          <Icon name="close" size={17} color={T.ter} />
        </Pressable>
      ) : null}
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label} 선택`} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <Text style={[{ fontSize: 16, fontWeight: '800', color: value === null ? T.ter : T.ink }, NUM]}>
          {value ?? '없음'}
        </Text>
        <Icon name="chevronDown" size={16} color={T.ter} />
      </Pressable>
    </View>
  );

  const cur =
    picking === 'open' ? open : picking === 'close' ? close : picking === 'bStart' ? bStart : bEnd;

  const applySlot = (t: string) => {
    if (picking === 'open') setOpen(t);
    else if (picking === 'close') setClose(t);
    else if (picking === 'bStart') setBStart(t);
    else if (picking === 'bEnd') setBEnd(t);
    setPicking(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="영업시간" onBack={() => safeBack('/my')} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 11 }}>
        <QueryState
          isLoading={settings.isLoading}
          error={settings.error}
          isEmpty={false}
          onRetry={() => void settings.refetch()}
          emptyTitle="설정을 불러오지 못했어요"
        >
          {/*
            예약된 변경이 있으면 **제일 위에** 말한다. 저장 버튼 근처에 두면
            이미 저장을 누른 뒤에야 눈에 들어온다.
          */}
          {pending ? (
            <Card pad={0} style={{ overflow: 'hidden', borderColor: T.blue }}>
              {/* 아이콘은 제목 줄에 맞춘다 — 가운데 정렬하면 두 줄 사이에 뜬다. */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 14 }}>
                <View style={{ paddingTop: 1 }}><Icon name="calendar" size={18} color={T.blue} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: T.blue }}>
                    {mdLabel(pending.effectiveFrom)}부터 적용돼요
                  </Text>
                  <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>
                    오늘은 {status.data?.today.openTime.slice(0, 5)}~{status.data?.today.closeTime.slice(0, 5)} 그대로예요.
                    영업 중에 바꾼 시간은 다음 영업일부터 적용돼요.
                  </Text>
                </View>
              </View>
            </Card>
          ) : null}

          <Card pad={0} style={{ overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 13, paddingHorizontal: 15, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.sub }}>영업시간</Text>
              {overnight && !sameTime ? <Badge tone="blue" sm>자정 넘김</Badge> : null}
              <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>
                {sameTime ? '—' : spanLabel(span)}
              </Text>
            </View>
            <Row label="시작" value={open} onPress={() => setPicking('open')} />
            <Row
              label="종료"
              hint={overnight && !sameTime ? '다음 날' : undefined}
              value={close}
              onPress={() => setPicking('close')}
            />
          </Card>

          <Card pad={0} style={{ overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.sub }}>브레이크 타임</Text>
              <Text style={{ fontSize: 14, color: T.ter, fontWeight: '600' }}>선택</Text>
            </View>
            <Row label="시작" value={bStart} onPress={() => setPicking('bStart')} onClear={() => setBStart(null)} />
            <Row label="종료" value={bEnd} onPress={() => setPicking('bEnd')} onClear={() => setBEnd(null)} />
          </Card>

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: 2, marginTop: 2 }}>
            <Icon name="info" size={15} color={T.ter} />
            <Text style={{ flex: 1, fontSize: 14, color: T.ter, lineHeight: 20 }}>
              종료 시각이 <Text style={{ fontWeight: '700' }}>하루의 경계</Text>예요.
              {overnight && !sameTime
                ? ` 새벽 ${close} 까지 판 건 전날 매출로 잡혀요.`
                : ' 자정에 날짜가 바뀌어요.'}
            </Text>
          </View>

          {/* 시각 고르기 — 30분 단위 */}
          {picking !== null ? (
            <Card pad={0} style={{ overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.sub }}>
                  {picking === 'open' ? '영업 시작' : picking === 'close' ? '영업 종료' : picking === 'bStart' ? '브레이크 시작' : '브레이크 종료'}
                </Text>
                <Pressable onPress={() => setPicking(null)} hitSlop={6} accessibilityRole="button" accessibilityLabel="닫기">
                  <Icon name="close" size={19} color={T.ter} />
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, padding: 13 }}>
                {SLOTS.map((t) => {
                  const on = t === cur;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => applySlot(t)}
                      accessibilityRole="button" accessibilityLabel={t}
                      accessibilityState={{ selected: on }}
                      style={{ paddingVertical: 8, paddingHorizontal: 11, borderRadius: 9, borderWidth: 1, borderColor: on ? T.blue : T.line, backgroundColor: on ? T.blueTint : T.surface }}
                    >
                      <Text style={[{ fontSize: 14, fontWeight: on ? '800' : '600', color: on ? T.blue : T.sub2 }, NUM]}>{t}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          ) : null}
        </QueryState>
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 11, paddingBottom: 30, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <Button kind="primary" size="lg" full loading={save.isPending} disabled={!dirty || sameTime} onPress={submit}>
          저장
        </Button>
      </View>
    </View>
  );
}

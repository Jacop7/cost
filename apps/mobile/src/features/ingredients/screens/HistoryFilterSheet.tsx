// HistoryFilterSheet.tsx — ING-08 조회 설정 (재고 내역 필터)
//
// 기간 칩을 고르면 **실제 적용될 날짜 구간**을 그 자리에서 보여준다.
// 예전에는 고정 문자열('2026.03.22 ~ 2026.06.21')이 박혀 있어 어떤 기간이 조회되는지
// 알 수 없었고, 칩을 바꿔도 그대로였다.
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Icon, Sheet } from '../../../components/kit';
import { T, tnum } from '../../../theme/tokens';
import { addDays, todayBusiness } from '@/features/sales/period';

function Seg({ opts, sel, onSelect }: { opts: string[]; sel: string; onSelect: (o: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {opts.map((o) => {
        const on = o === sel;
        return (
          <Pressable
            key={o}
            onPress={() => onSelect(o)}
            accessibilityRole="button"
            accessibilityLabel={o}
            accessibilityState={{ selected: on }}
            style={{
              paddingVertical: 11,
              paddingHorizontal: 16,
              borderRadius: 11,
              backgroundColor: on ? T.blueTint : T.surface,
              borderWidth: 1,
              borderColor: on ? T.blue : T.line,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: on ? T.blue : T.sub }}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export type HistoryPeriod = '오늘' | '최근 1개월' | '최근 3개월' | '최근 6개월' | '최근 1년' | '전체';
export type HistoryOrder = '최신순' | '오래된순';

export interface HistoryFilter {
  period: HistoryPeriod;
  /** 표시 라벨. '전체' 포함. */
  kind: string;
  order: HistoryOrder;
}

const PERIODS: HistoryPeriod[] = ['오늘', '최근 1개월', '최근 3개월', '최근 6개월', '최근 1년', '전체'];
const ORDERS: HistoryOrder[] = ['최신순', '오래된순'];

const DAYS: Record<HistoryPeriod, number | null> = {
  '오늘': 0, '최근 1개월': 30, '최근 3개월': 90, '최근 6개월': 180, '최근 1년': 365, '전체': null,
};

/** 칩이 뜻하는 실제 구간. 화면 표시와 조회가 같은 규칙을 쓰게 여기서만 만든다. */
export function periodRange(period: HistoryPeriod, today = todayBusiness()): { from?: string; to: string } {
  const d = DAYS[period];
  return d === null ? { to: today } : { from: addDays(today, -d), to: today };
}

const fmt = (s?: string) => (s ? s.replace(/-/g, '.') : '처음');

/**
 * 기간만 고르는 시트 — 폐기 내역(ING-10)이 쓴다.
 *
 * 거기에는 유형 칩이 이미 화면 위 탭으로 나와 있고 정렬은 항상 최신순이다.
 * 조회 설정 시트를 통째로 재사용하면 쓰지도 않을 두 줄이 따라붙는다.
 * ⚠ 기간 목록과 `periodRange()` 는 **이 파일 하나**를 같이 쓴다 — 두 화면이 갈리면 안 된다.
 */
export function PeriodSheet({
  visible, onClose, value, onApply,
}: {
  visible: boolean;
  onClose: () => void;
  value: HistoryPeriod;
  onApply: (v: HistoryPeriod) => void;
}) {
  const [period, setPeriod] = useState<HistoryPeriod>(value);
  useEffect(() => { if (visible) setPeriod(value); }, [visible, value]);

  const range = periodRange(period);

  return (
    <Sheet visible={visible} onClose={onClose} height={330} title="기간">
      <View style={{ flex: 1, paddingTop: 6 }}>
        <Seg opts={PERIODS} sel={period} onSelect={(o) => setPeriod(o as HistoryPeriod)} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: T.line, borderRadius: 12, backgroundColor: T.surface2 }}>
          <Icon name="calendar" size={18} color={T.sub2} />
          <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, tnum]}>{fmt(range.from)}</Text>
          <Text style={{ flex: 1, textAlign: 'center', color: T.ter }}>~</Text>
          <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, tnum]}>{fmt(range.to)}</Text>
        </View>
      </View>
      <View style={{ paddingTop: 12, paddingBottom: 10 }}>
        <Button kind="primary" size="lg" full onPress={() => onApply(period)}>적용</Button>
      </View>
    </Sheet>
  );
}

export function HistoryFilterSheet({
  visible, onClose, value, onApply, kinds,
}: {
  visible: boolean;
  onClose: () => void;
  value: HistoryFilter;
  onApply: (v: HistoryFilter) => void;
  kinds: string[];
}) {
  const [period, setPeriod] = useState<HistoryPeriod>(value.period);
  const [kind, setKind] = useState(value.kind);
  const [order, setOrder] = useState<HistoryOrder>(value.order);

  // 열릴 때 현재 적용값으로 동기화.
  useEffect(() => {
    if (visible) { setPeriod(value.period); setKind(value.kind); setOrder(value.order); }
  }, [visible, value.period, value.kind, value.order]);

  const range = periodRange(period);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      height={560}
      title="조회 설정"
      headerRight={
        <Pressable onPress={onClose} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="닫기">
          <Icon name="close" size={22} color={T.ink2} />
        </Pressable>
      }
    >
      <View style={{ flex: 1, paddingTop: 6 }}>
        <View style={{ gap: 20 }}>
          <View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub, marginBottom: 9 }}>기간</Text>
            <Seg opts={PERIODS} sel={period} onSelect={(o) => setPeriod(o as HistoryPeriod)} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: T.line, borderRadius: 12, backgroundColor: T.surface2 }}>
              <Icon name="calendar" size={18} color={T.sub2} />
              <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, tnum]}>{fmt(range.from)}</Text>
              <Text style={{ flex: 1, textAlign: 'center', color: T.ter }}>~</Text>
              <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, tnum]}>{fmt(range.to)}</Text>
            </View>
          </View>
          <View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub, marginBottom: 9 }}>유형</Text>
            <Seg opts={kinds} sel={kind} onSelect={setKind} />
          </View>
          <View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub, marginBottom: 9 }}>정렬</Text>
            <Seg opts={ORDERS} sel={order} onSelect={(o) => setOrder(o as HistoryOrder)} />
          </View>
        </View>
      </View>
      <View style={{ paddingTop: 12, paddingBottom: 10 }}>
        <Button kind="primary" size="lg" full onPress={() => onApply({ period, kind, order })}>조회</Button>
      </View>
    </Sheet>
  );
}

// HistoryFilterSheet.tsx — ING-08 조회 설정 (재고 내역 필터)
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Sheet, Button, Icon } from '../../../components/kit';
import { T, FONT, tnum } from '../../../theme/tokens';

function Seg({
  opts,
  sel,
  fill,
  onSelect,
}: {
  opts: string[];
  sel: string;
  fill?: boolean;
  onSelect: (o: string) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: fill ? 0 : 8,
        backgroundColor: fill ? T.surface2 : 'transparent',
        borderWidth: fill ? 1 : 0,
        borderColor: T.line,
        borderRadius: 12,
        padding: fill ? 4 : 0,
      }}
    >
      {opts.map((o) => {
        const on = o === sel;
        return (
          <Pressable
            key={o}
            onPress={() => onSelect(o)}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 11,
              paddingHorizontal: 4,
              borderRadius: fill ? 9 : 11,
              backgroundColor: on ? (fill ? T.surface : T.blueTint) : fill ? 'transparent' : T.surface,
              borderWidth: fill ? 0 : 1,
              borderColor: on ? T.blue : T.line,
              shadowColor: '#000',
              shadowOpacity: on && fill ? 0.08 : 0,
              shadowRadius: 2,
              shadowOffset: { width: 0, height: 1 },
              elevation: on && fill ? 1 : 0,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: on ? T.blue : T.sub }}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export interface HistoryFilter {
  period: string;
  type: string;
  sort: string;
}

export function HistoryFilterSheet({ visible, onClose, value, onApply }: { visible: boolean; onClose: () => void; value: HistoryFilter; onApply: (v: HistoryFilter) => void }) {
  const [period, setPeriod] = useState(value.period);
  const [type, setType] = useState(value.type);
  const [sort, setSort] = useState(value.sort);

  // 열릴 때 현재 적용값으로 동기화.
  useEffect(() => {
    if (visible) {
      setPeriod(value.period);
      setType(value.type);
      setSort(value.sort);
    }
  }, [visible, value.period, value.type, value.sort]);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      height={520}
      title="조회 설정"
      headerRight={
        <Pressable onPress={onClose} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="닫기">
          <Icon name="close" size={22} color={T.ink2} />
        </Pressable>
      }
    >
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 14 }}>
        <View style={{ gap: 20 }}>
          <View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub, marginBottom: 9 }}>기간 선택</Text>
            <Seg opts={['오늘', '1개월', '3개월', '6개월', '직접']} sel={period} onSelect={setPeriod} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: T.line, borderRadius: 12, backgroundColor: T.surface }}>
              <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, tnum]}>2026.03.22</Text>
              <Text style={{ flex: 1, textAlign: 'center', color: T.ter }}>~</Text>
              <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, tnum]}>2026.06.21</Text>
              <Icon name="calendar" size={18} color={T.sub2} />
            </View>
          </View>
          <View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub, marginBottom: 9 }}>유형</Text>
            <Seg opts={['전체', '입고', '소진', '조정']} sel={type} onSelect={setType} />
          </View>
          <View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub, marginBottom: 9 }}>정렬</Text>
            <Seg opts={['최신순', '과거순']} sel={sort} onSelect={setSort} />
          </View>
        </View>
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 26, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <Button kind="primary" size="lg" full onPress={() => { onApply({ period, type, sort }); onClose(); }}>조회</Button>
      </View>
    </Sheet>
  );
}

// StockEditSheet.tsx — ING-05 재고 수정 (시트 · 수량 조정/완전 소진/폐기)
// 입력은 표기단위(kg·L·개), 저장은 기준단위(g·ml·개)로 환산해 onApply 로 파급. ⚠ E2/E5 영속은 Supabase 단계.
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { Sheet, Input, Button, Icon } from '../../../components/kit';
import { T, tnum } from '../../../theme/tokens';
import { clampByUnit } from '@/lib/num';

type TabId = 'adj' | 'out' | 'waste';
const TABS: [TabId, string][] = [
  ['adj', '수량 조정'],
  ['out', '완전 소진'],
  ['waste', '폐기'],
];

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * 재고 변경 1건. **어떤 종류의 변경인지**가 반드시 함께 나가야 한다.
 *
 * 수량만 넘기면 상위가 "얼마로 바뀌었는지"만 알고 **왜 바뀌었는지**를 모른다.
 * 그런데 절대원칙 2 에 따라 조정(E5)·폐기(E2)는 서로 다른 RPC 이고, 폐기는 실측 로스율에
 * 누적되어 기준단가까지 바꾼다. 유형을 잃으면 폐기가 단순 조정으로 기록돼 로스율이 영원히 0 이 된다.
 */
export interface StockChange {
  /** 'adj' 수량 조정(E5) · 'out' 완전 소진(E5) · 'waste' 폐기(E2) */
  kind: TabId;
  /** 변경 후 재고(기준단위 g/ml/개) */
  nextStock: number;
  /** 폐기 수량(기준단위). kind='waste' 일 때만 의미가 있다 — E2 는 폐기량을 받는다. */
  wasteAmount: number;
  /** 사용자가 적은 사유. 재고 이벤트 note 로 남는다. */
  reason: string;
}

/**
 * 수량 입력칸 — **모듈 스코프에 둬야 한다.**
 *
 * 컴포넌트 본문 안에서 화살표 함수로 선언하면 렌더마다 새 함수 참조가 만들어지고,
 * React 는 elementType 을 참조 동일성으로 비교하므로 **다른 컴포넌트로 보고 언마운트→리마운트**한다.
 * 안의 TextInput 이 매 글자마다 파괴·재생성되어 네이티브 포커스가 풀리고 키보드가 닫힌다.
 * (입력값 자체는 부모 state 라 남지만, 한 글자 칠 때마다 칸을 다시 눌러야 해 사실상 입력이 안 된다.)
 */
function InputBox({ value, onChange, accent, unit }: {
  value: string;
  onChange?: (t: string) => void;
  accent: string;
  unit: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15, borderWidth: 1.5, borderColor: accent, borderRadius: 12, backgroundColor: T.surface }}>
      <TextInput
        style={[{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: '700', color: T.ink, padding: 0 }, tnum]}
        value={value}
        onChangeText={onChange}
        editable={!!onChange}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={T.ter}
        accessibilityLabel={`수량 (${unit})`}
      />
      <Text style={{ fontSize: 16, fontWeight: '600', color: T.sub2 }}>{unit}</Text>
    </View>
  );
}

/** 계산 결과 띠 — 상태를 갖지 않지만 같은 이유로 모듈 스코프에 둔다. */
function Band({ children, bg }: { children: React.ReactNode; bg?: string }) {
  return (
    <View style={{ marginTop: 9, paddingVertical: 13, paddingHorizontal: 15, borderRadius: 12, backgroundColor: bg || T.surface2, alignItems: 'center' }}>{children}</View>
  );
}

export function StockEditSheet({
  visible,
  onClose,
  name,
  unit,
  stock,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  name?: string;
  unit: '개' | 'g' | 'ml';
  stock: number; // 기준단위 현재 재고
  onApply: (next: StockChange) => void;
}) {
  const isCount = unit === '개';
  const dispUnit = isCount ? '개' : unit === 'ml' ? 'L' : 'kg';
  const factor = isCount ? 1 : 1000; // 기준단위 / 표기단위
  const curDisp = round2(stock / factor);

  const [tab, setTab] = useState<TabId>('adj');
  const [adjVal, setAdjVal] = useState(String(curDisp));
  const [wasteVal, setWasteVal] = useState('');
  const [reason, setReason] = useState('');

  // 열릴 때 현재 재고로 초기화.
  useEffect(() => {
    if (visible) {
      setTab('adj');
      setAdjVal(String(curDisp));
      setWasteVal('');
      setReason('');
    }
  }, [visible, curDisp]);

  const action = { adj: '저장', out: '소진 처리', waste: '폐기 처리' }[tab];
  const reasonPH = { adj: '예) 실사 후 보정', out: '예) 영업 종료 후 소진 확인', waste: '예) 유통기한 경과, 상함' }[tab];
  const note = {
    adj: '수량만 변경되며 평균 단가 영향 없어요.',
    out: '수량만 0으로 변경되며 평균 단가 영향 없어요.',
    waste: '폐기 손실로 기록되며 평균 단가 영향 없어요.',
  }[tab];

  // 탭별 다음 재고(기준단위) 계산.
  const nextAdj = isNaN(parseFloat(adjVal)) ? stock : Math.max(0, Math.round(parseFloat(adjVal) * factor));
  const diffDisp = round2((nextAdj - stock) / factor);
  const wasteBase = isNaN(parseFloat(wasteVal)) ? 0 : Math.round(parseFloat(wasteVal) * factor);
  const afterWaste = Math.max(0, stock - wasteBase);
  const nextStock = tab === 'adj' ? nextAdj : tab === 'out' ? 0 : afterWaste;

  return (
    <Sheet visible={visible} onClose={onClose} title={name ? `${name} 재고 수정` : '재고 수정'} scroll={false}>
      <View>
        {/* 탭 (언더라인) — 전체폭 밑줄·좌측 시작 (식재료/발주현황 동일) */}
        <View style={{ borderBottomWidth: 1, borderBottomColor: T.line3, marginTop: 6 }}>
          <View style={{ flexDirection: 'row', gap: 22, paddingHorizontal: 20 }}>
            {TABS.map(([id, label]) => {
              const on = tab === id;
              const accent = id === 'waste' ? T.red : T.ink;
              return (
                <Pressable key={id} onPress={() => setTab(id)} style={{ paddingBottom: 11 }}>
                  <Text style={{ fontSize: 16, fontWeight: on ? '700' : '600', color: on ? accent : T.ter }}>{label}</Text>
                  {on ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2.5, backgroundColor: accent, borderRadius: 2 }} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 내용 (스크롤 없음) */}
        <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 18 }}>
          {tab === 'adj' ? (
            <>
              <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub, marginBottom: 7 }}>수량</Text>
              <InputBox unit={dispUnit} value={adjVal} onChange={(t) => setAdjVal(clampByUnit(t, dispUnit))} accent={T.blue} />
              <Band bg={diffDisp === 0 ? undefined : diffDisp < 0 ? T.redTint : T.greenTint}>
                {diffDisp === 0 ? (
                  <Text style={{ fontSize: 16, fontWeight: '800', color: T.sub }}>변동 없음</Text>
                ) : (
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: diffDisp < 0 ? T.red : T.green }, tnum]}>
                    {Math.abs(diffDisp)}{dispUnit} {diffDisp < 0 ? '감소' : '증가'}
                  </Text>
                )}
              </Band>
            </>
          ) : null}

          {tab === 'out' ? (
            <Band>
              <Text style={[{ fontSize: 18, fontWeight: '800' }, tnum]}>
                <Text style={{ color: T.ter, textDecorationLine: 'line-through', fontWeight: '700' }}>{curDisp}{dispUnit}</Text>
                <Text style={{ color: T.ter }}>{'   →   '}</Text>
                <Text style={{ color: T.red }}>0{dispUnit}</Text>
              </Text>
            </Band>
          ) : null}

          {tab === 'waste' ? (
            <>
              <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub, marginBottom: 7 }}>폐기 수량</Text>
              <InputBox unit={dispUnit} value={wasteVal} onChange={(t) => setWasteVal(clampByUnit(t, dispUnit))} accent={T.red} />
              <Band>
                <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink2 }, tnum]}>
                  폐기 후 재고 <Text style={{ fontWeight: '800' }}>{round2(afterWaste / factor)}{dispUnit}</Text>
                </Text>
              </Band>
            </>
          ) : null}

          <View style={{ marginTop: 18 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub, marginBottom: 7 }}>사유 (선택)</Text>
            <Input value={reason} onChangeText={setReason} placeholder={reasonPH} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 11 }}>
            <Icon name="info" size={15} color={T.ter} />
            <Text style={{ flex: 1, fontSize: 14, color: T.sub2, fontWeight: '600', lineHeight: 19 }}>{note}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 26, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
          <Button kind="gray" size="lg" style={{ flex: 1 }} onPress={onClose}>취소</Button>
          <Button kind={tab === 'waste' ? 'danger' : 'primary'} size="lg" style={{ flex: 1.3 }} onPress={() => onApply({ kind: tab, nextStock, wasteAmount: tab === 'waste' ? wasteBase : 0, reason: reason.trim() })}>{action}</Button>
        </View>
      </View>
    </Sheet>
  );
}

// StockEditSheet.tsx — ING-05 재고 수정 (시트 · 수량 조정/완전 소진/폐기)
// 입력은 표기단위(kg·L·개), 저장은 기준단위(g·ml·개)로 환산해 onApply 로 파급. ⚠ E2/E5 영속은 Supabase 단계.
import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { Sheet, Input, Button, Icon, ScrollTabs, Notice } from '../../../components/kit';
import { LAYOUT, COLOR, T, tnum, TYPE, space } from '../../../theme/tokens';
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

/** 계산 결과 띠 — 상태를 갖지 않지만 같은 이유로 모듈 스코프에 둔다. */
function Band({ children, bg }: { children: React.ReactNode; bg?: string }) {
  return (
    <View style={{ marginTop: space.sm, paddingVertical: space.md, paddingHorizontal: space.md, borderRadius: 12, backgroundColor: bg || T.surface2, alignItems: 'center' }}>{children}</View>
  );
}

export function StockEditSheet({
  visible,
  onClose,
  name,
  unit,
  stock,
  onApply,
  saving = false,
  onAddStock,
}: {
  visible: boolean;
  onClose: () => void;
  name?: string;
  unit: '개' | 'g' | 'ml';
  stock: number; // 기준단위 현재 재고
  onApply: (next: StockChange) => void;
  /** 서버 저장 중. 버튼이 두 번 눌려 이벤트가 두 번 기록되는 것을 막는다. */
  saving?: boolean;
  /** '재고 추가'로 건너갈 자리. 새로 사 온 것은 여기서 늘리면 안 된다(0074). */
  onAddStock?: () => void;
}) {
  const isCount = unit === '개';
  const dispUnit = isCount ? '개' : unit === 'ml' ? 'L' : 'kg';
  const factor = isCount ? 1 : 1000; // 기준단위 / 표기단위
  const curDisp = round2(stock / factor);

  const [tab, setTab] = useState<TabId>('adj');
  /**
   * 조정 방향. **얼마로 만들지가 아니라 얼마를 더할지/뺄지**를 묻는다(0087).
   *
   * 예전에는 최종 수량을 직접 적게 했다. 그러면 사장님이 머릿속으로 뺄셈을 해야 하고,
   * 4,510 에서 200 을 빼려다 4,310 을 잘못 적으면 그대로 저장된다 — 확인할 방법도 없다.
   * 이제 '차감 200' 이라고 말하면 최종값은 화면이 계산해서 보여 준다.
   */
  const [dir, setDir] = useState<'add' | 'sub'>('sub');
  const [adjVal, setAdjVal] = useState('');
  const [wasteVal, setWasteVal] = useState('');
  const [reason, setReason] = useState('');

  // 열릴 때 초기화. 입력칸은 **비워 둔다** — 기본값은 위에 현재 재고로 보여 준다.
  useEffect(() => {
    if (visible) {
      setTab('adj');
      setDir('sub');
      setAdjVal('');
      setWasteVal('');
      setReason('');
    }
  }, [visible]);

  const action = { adj: '저장', out: '소진 처리', waste: '폐기 처리' }[tab];
  const reasonPH = { adj: '예) 실사 후 보정', out: '예) 영업 종료 후 소진 확인', waste: '예) 유통기한 경과, 상함' }[tab];
  const note = {
    adj: '수량만 변경되며 평균 단가 영향 없어요.',
    out: '수량만 0으로 변경되며 평균 단가 영향 없어요.',
    waste: '폐기 손실로 기록되며 평균 단가 영향 없어요.',
  }[tab];

  // 탭별 다음 재고(기준단위) 계산.
  // 조정은 **증감량**을 받는다. 최종값은 여기서 만든다 — 사장님이 뺄셈하지 않는다.
  const adjBase = isNaN(parseFloat(adjVal)) ? 0 : Math.round(parseFloat(adjVal) * factor);
  const nextAdj = Math.max(0, dir === 'add' ? stock + adjBase : stock - adjBase);
  const diffDisp = round2((nextAdj - stock) / factor);
  const wasteBase = isNaN(parseFloat(wasteVal)) ? 0 : Math.round(parseFloat(wasteVal) * factor);
  const afterWaste = Math.max(0, stock - wasteBase);
  const nextStock = tab === 'adj' ? nextAdj : tab === 'out' ? 0 : afterWaste;

  return (
    <Sheet visible={visible} onClose={onClose} title={name ? `${name} 재고 수정` : '재고 수정'} height="90%" scroll={false}>
      <View style={{ flex: 1 }}>
        {/* 탭 (언더라인) — 전체폭 밑줄·좌측 시작 (식재료/발주현황 동일) */}
        <View style={{ borderBottomWidth: 1, borderBottomColor: T.line3, marginTop: space.sm }}>
          <ScrollTabs
            tabs={TABS.map(([, label]) => label)}
            active={TABS.findIndex(([id]) => id === tab)}
            onChange={(index) => { const selected = TABS[index]; if (selected) setTab(selected[0]); }}
            activeColors={[undefined, undefined, COLOR.status.negative]}
          />
        </View>

        {/* 본문만 스크롤한다. 탭과 저장 버튼은 유지해 작은 화면·큰 글자에서도 행동을 잃지 않는다. */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: space.lg, paddingBottom: space.lg }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {tab === 'adj' ? (
            <>
              {/* 기본값 — 지금 얼마인지부터 못 박고 시작한다. */}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingBottom: space.md }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.sub }}>현재 재고</Text>
                <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, tnum]}>{curDisp}{dispUnit}</Text>
              </View>

              {/* 추가 / 차감 */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {([['add', '추가', COLOR.text.accent], ['sub', '차감', COLOR.status.negative]] as const).map(([id, label, accent]) => {
                  const on = dir === id;
                  return (
                    <Pressable
                      key={id}
                      onPress={() => setDir(id)}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      accessibilityState={{ selected: on }}
                      style={{
                        flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
                        borderWidth: 1.5, borderColor: on ? accent : T.line,
                        backgroundColor: on ? (id === 'add' ? COLOR.action.primaryTint : COLOR.status.negativeTint) : T.surface,
                      }}
                    >
                      <Text style={{ fontSize: 16, fontWeight: on ? '800' : '600', color: on ? accent : T.sub2 }}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub, marginBottom: space.sm }}>
                {dir === 'add' ? '추가할 수량' : '차감할 수량'}
              </Text>
              <Input
                suffix={dispUnit}
                value={adjVal}
                onChangeText={(t) => setAdjVal(clampByUnit(t, dispUnit))}
                tone={dir === 'add' ? 'accent' : 'danger'}
                keyboardType="decimal-pad"
                placeholder="0"
                accessibilityLabel={`수량 (${dispUnit})`}
              />

              {/* 최종값 — 사장님이 뺄셈하지 않는다. */}
              <Band bg={diffDisp === 0 ? undefined : diffDisp < 0 ? COLOR.status.negativeTint : COLOR.status.positiveTint}>
                {diffDisp === 0 ? (
                  <Text style={{ fontSize: 16, fontWeight: '800', color: T.sub }}>변동 없음</Text>
                ) : (
                  <Text style={[{ fontSize: TYPE.body.fontSize, fontWeight: '800' }, tnum]}>
                    <Text style={{ color: COLOR.text.tertiary, fontWeight: '700' }}>{curDisp}{dispUnit}</Text>
                    <Text style={{ color: COLOR.text.tertiary }}>{'   →   '}</Text>
                    <Text style={{ color: diffDisp < 0 ? COLOR.status.negative : COLOR.status.positive }}>
                      {round2(nextAdj / factor)}{dispUnit}
                    </Text>
                  </Text>
                )}
              </Band>
            </>
          ) : null}

          {tab === 'out' ? (
            <Band>
              <Text style={[{ fontSize: 18, fontWeight: '800' }, tnum]}>
                <Text style={{ color: COLOR.text.tertiary, textDecorationLine: 'line-through', fontWeight: '700' }}>{curDisp}{dispUnit}</Text>
                <Text style={{ color: COLOR.text.tertiary }}>{'   →   '}</Text>
                <Text style={{ color: COLOR.status.negative }}>0{dispUnit}</Text>
              </Text>
            </Band>
          ) : null}

          {tab === 'waste' ? (
            <>
              <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub, marginBottom: space.sm }}>폐기 수량</Text>
              <Input
                suffix={dispUnit}
                value={wasteVal}
                onChangeText={(t) => setWasteVal(clampByUnit(t, dispUnit))}
                tone="danger"
                keyboardType="decimal-pad"
                placeholder="0"
                accessibilityLabel={`폐기 수량 (${dispUnit})`}
              />
              <Band>
                <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink2 }, tnum]}>
                  폐기 후 재고 <Text style={{ fontWeight: '800' }}>{round2(afterWaste / factor)}{dispUnit}</Text>
                </Text>
              </Band>
            </>
          ) : null}

          <View style={{ marginTop: space.lg }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub, marginBottom: space.sm }}>사유 (선택)</Text>
            <Input value={reason} onChangeText={setReason} placeholder={reasonPH} />
          </View>
          <Notice style={{ marginTop: space.md }}>{note}</Notice>

          {/* ⚠ 새로 사 온 것을 여기서 늘리면 재고만 늘고 **기준 단가는 안 바뀐다.**
              그러면 원가가 옛 가격에 머문다. 입고는 다른 사건이라 다른 길로 보낸다(0074). */}
          {onAddStock ? (
            <Pressable
              onPress={onAddStock}
              accessibilityRole="button" accessibilityLabel="재고 추가로 이동"
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: T.line2 }}
            >
              <Icon name="info" size={15} color={COLOR.text.tertiary} />
              <Text style={{ flex: 1, fontSize: 14, color: T.sub2, lineHeight: TYPE.caption.lineHeight }}>
                새로 사 왔다면 <Text style={{ fontWeight: '700', color: COLOR.text.accent }}>재고 추가</Text>로 넣어 주세요 · 단가도 함께 반영돼요
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: 20, paddingTop: 12, paddingBottom: LAYOUT.scroll.end, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
          <Button kind="gray" size="lg" style={{ flex: 1 }} disabled={saving} onPress={onClose}>취소</Button>
          <Button
            kind={tab === 'waste' ? 'danger' : 'primary'}
            size="lg"
            style={{ flex: 1.3 }}
            loading={saving}
            /* 아무것도 안 적었으면 누를 수 없다. 예전엔 현재값이 채워져 있어 그냥 눌리면
               '변동 없음' 이벤트가 원장에 쌓였다. */
            disabled={(tab === 'waste' && wasteBase <= 0) || (tab === 'adj' && adjBase <= 0)}
            onPress={() => onApply({ kind: tab, nextStock, wasteAmount: tab === 'waste' ? wasteBase : 0, reason: reason.trim() })}
          >{action}</Button>
        </View>
      </View>
    </Sheet>
  );
}

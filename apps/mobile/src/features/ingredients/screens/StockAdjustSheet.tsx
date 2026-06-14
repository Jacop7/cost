/**
 * ING-04 재고 수정 — 바텀시트 팝업(식재료(잔여) 4.7절). 상세(ING-02)의 '재고 수정'에서 호출.
 * 미개봉/개봉 개수 직접 보정(실사·E5) · 완전소진(로스 0) · 폐기(→E2) · 처리 후 로스율 조정 시트.
 * ⚠ 현재는 디자인 프로토타입(로컬 상태). 실제 보정/폐기/실사는 데이터 연결 단계에서 RPC(E2/E5)로.
 *    절대 원칙: 재고·단가·이력은 E1(입고)·E2/E5(재고 수정)에서만 변경 — 이 시트가 그 출처.
 */
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Badge, Button, Icon, Sheet, Stepper } from '@/components/kit';
import { round } from '@sikjae/core';
import { T } from '@/theme/tokens';
import { getIngredient } from '../demoData';

const NUM = { fontVariant: ['tabular-nums' as const] };

export function StockAdjustSheet({ visible, ingredientId, onClose }: { visible: boolean; ingredientId?: string; onClose: () => void }) {
  const g = getIngredient(ingredientId);
  const [sealed, setSealed] = useState(g?.sealed ?? 0);
  const [opened, setOpened] = useState(g?.opened ?? 0);
  const [confirmConsume, setConfirmConsume] = useState(false); // 완전소진 처리 여부 확인
  const [confirmLoss, setConfirmLoss] = useState(false); // 완전소진 후 로스율 인하 제안
  const [confirmDiscard, setConfirmDiscard] = useState(false); // 폐기 처리 여부 확인
  const [discardLoss, setDiscardLoss] = useState(false); // 폐기 후 로스율 인상 제안
  const [lossSheet, setLossSheet] = useState(false); // 로스율 수정 시트
  const [lossRate, setLossRate] = useState(g?.loss ?? 0);

  if (!g) return null;

  const total = sealed + opened;

  // 완전소진 — 먼저 처리 여부를 확인.
  const requestConsume = () => {
    if (total <= 0) return;
    setConfirmConsume(true);
  };
  // 확인 후 실제 처리 — 미개봉·개봉 모두 0으로(로스 0) + 로스율 인하 제안.
  const doConsume = () => {
    setConfirmConsume(false);
    setSealed(0);
    setOpened(0);
    setConfirmLoss(true);
  };
  // 폐기 — 먼저 처리 여부를 확인.
  const requestDiscard = () => {
    if (total <= 0) return;
    setConfirmDiscard(true);
  };
  // 확인 후 실제 처리 — 미개봉·개봉 모두 0으로(폐기→로스 누적) + 로스율 인상 제안.
  const doDiscard = () => {
    setConfirmDiscard(false);
    setSealed(0);
    setOpened(0);
    setDiscardLoss(true);
  };

  // 저장 — 미개봉·개봉을 모두 0으로 맞춰 저장하면 완전소진으로 보고 로스율 인하 제안.
  const onSave = () => {
    if (total <= 0) {
      setConfirmLoss(true);
      return;
    }
    onClose();
  };

  return (
    <>
      <Sheet visible={visible} onClose={onClose} title="재고 수정">
        {/* 개수 보정 (실사) */}
        <View style={{ backgroundColor: T.surface2, borderRadius: 16, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.line }}>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: T.ink }}>미개봉</Text>
            <Stepper value={sealed} unit="개" onChange={(v) => setSealed(Math.max(0, v))} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: T.ink }}>개봉</Text>
            <Stepper value={opened} unit="개" onChange={(v) => setOpened(Math.max(0, v))} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: T.line }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub }}>총</Text>
            <View style={{ flex: 1 }} />
            <Text style={[{ fontSize: 18, fontWeight: '800', color: total === g.sealed + g.opened ? T.ink : T.blue }, NUM]}>{total}개</Text>
          </View>
        </View>

        {/* 액션 — 완전소진 · 폐기 · 저장 한 줄 */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
          <Button kind="gray" size="lg" onPress={requestConsume} style={{ flex: 1, opacity: total <= 0 ? 0.45 : 1 }}>
            완전소진
          </Button>
          <Button kind="danger" size="lg" onPress={requestDiscard} style={{ flex: 1, opacity: total <= 0 ? 0.45 : 1 }}>
            폐기
          </Button>
          <Button kind="primary" size="lg" onPress={onSave} style={{ flex: 1.4 }}>
            저장
          </Button>
        </View>
      </Sheet>

      {/* 완전소진 처리 여부 확인 다이얼로그 */}
      <Modal visible={confirmConsume} transparent animationType="fade" onRequestClose={() => setConfirmConsume(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{ width: '100%', maxWidth: 340, backgroundColor: T.surface, borderRadius: 18, paddingTop: 24, paddingHorizontal: 20, paddingBottom: 14 }}>
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 17.5, fontWeight: '800', color: T.ink, textAlign: 'center' }}>완전소진 처리하시겠습니까?</Text>
              <Text style={{ fontSize: 14, color: T.sub, textAlign: 'center', lineHeight: 20 }}>
                현재 남은 모든 재고(미개봉/개봉)를 모두 소진 처리합니다.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 9, marginTop: 18 }}>
              <Pressable onPress={() => setConfirmConsume(false)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: T.line2 }}>
                <Text style={{ fontSize: 15.5, fontWeight: '700', color: T.ink2 }}>아니오</Text>
              </Pressable>
              <Pressable onPress={doConsume} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: T.blue }}>
                <Text style={{ fontSize: 15.5, fontWeight: '700', color: '#fff' }}>예</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 완전소진 후 — 로스율 인하 제안 다이얼로그 */}
      <Modal visible={confirmLoss} transparent animationType="fade" onRequestClose={() => setConfirmLoss(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{ width: '100%', maxWidth: 340, backgroundColor: T.surface, borderRadius: 18, paddingTop: 22, paddingHorizontal: 20, paddingBottom: 14 }}>
            <View style={{ alignItems: 'center', gap: 10 }}>
              <View style={{ width: 46, height: 46, borderRadius: 999, backgroundColor: T.greenTint, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="check" size={26} color={T.green} sw={2.4} />
              </View>
              <Text style={{ fontSize: 17.5, fontWeight: '800', color: T.ink, textAlign: 'center' }}>완전소진 처리되었습니다</Text>
              <Text style={{ fontSize: 14, color: T.sub, textAlign: 'center', lineHeight: 20 }}>
                남김없이 다 쓰셨네요. 로스율을 낮추겠습니까?
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 9, marginTop: 18 }}>
              <Pressable onPress={() => { setConfirmLoss(false); onClose(); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: T.line2 }}>
                <Text style={{ fontSize: 15.5, fontWeight: '700', color: T.ink2 }}>아니오</Text>
              </Pressable>
              <Pressable onPress={() => { setConfirmLoss(false); setLossSheet(true); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: T.blue }}>
                <Text style={{ fontSize: 15.5, fontWeight: '700', color: '#fff' }}>예</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 폐기 처리 여부 확인 다이얼로그 */}
      <Modal visible={confirmDiscard} transparent animationType="fade" onRequestClose={() => setConfirmDiscard(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{ width: '100%', maxWidth: 340, backgroundColor: T.surface, borderRadius: 18, paddingTop: 24, paddingHorizontal: 20, paddingBottom: 14 }}>
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 17.5, fontWeight: '800', color: T.ink, textAlign: 'center' }}>폐기 처리하시겠습니까?</Text>
              <Text style={{ fontSize: 14, color: T.sub, textAlign: 'center', lineHeight: 20 }}>
                현재 남은 모든 재고(미개봉/개봉)를 폐기 처리합니다.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 9, marginTop: 18 }}>
              <Pressable onPress={() => setConfirmDiscard(false)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: T.line2 }}>
                <Text style={{ fontSize: 15.5, fontWeight: '700', color: T.ink2 }}>아니오</Text>
              </Pressable>
              <Pressable onPress={doDiscard} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: T.red }}>
                <Text style={{ fontSize: 15.5, fontWeight: '700', color: '#fff' }}>예</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 폐기 후 — 로스율 인상 제안 다이얼로그 */}
      <Modal visible={discardLoss} transparent animationType="fade" onRequestClose={() => setDiscardLoss(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{ width: '100%', maxWidth: 340, backgroundColor: T.surface, borderRadius: 18, paddingTop: 22, paddingHorizontal: 20, paddingBottom: 14 }}>
            <View style={{ alignItems: 'center', gap: 10 }}>
              <View style={{ width: 46, height: 46, borderRadius: 999, backgroundColor: T.redTint, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="warn" size={26} color={T.red} sw={2.3} />
              </View>
              <Text style={{ fontSize: 17.5, fontWeight: '800', color: T.ink, textAlign: 'center' }}>폐기 처리되었습니다</Text>
              <Text style={{ fontSize: 14, color: T.sub, textAlign: 'center', lineHeight: 20 }}>
                남은 재고를 버렸어요. 로스율을 높이겠습니까?
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 9, marginTop: 18 }}>
              <Pressable onPress={() => { setDiscardLoss(false); onClose(); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: T.line2 }}>
                <Text style={{ fontSize: 15.5, fontWeight: '700', color: T.ink2 }}>아니오</Text>
              </Pressable>
              <Pressable onPress={() => { setDiscardLoss(false); setLossSheet(true); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: T.blue }}>
                <Text style={{ fontSize: 15.5, fontWeight: '700', color: '#fff' }}>예</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 로스율 수정 시트 */}
      <Sheet visible={lossSheet} onClose={() => setLossSheet(false)} title="로스율 수정" sub="실제 재료 소진 기록을 바탕으로 로스율을 조정합니다.">
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: T.ink }}>로스율</Text>
          </View>
          <Stepper value={lossRate} unit="%" onChange={(v) => setLossRate(Math.max(0, Math.min(99, v)))} />
        </View>

        {/* 실사용 단가 비교 — 현재 로스율 vs 변경 로스율 */}
        {(() => {
          const baseUnit = round(g.price * (1 - (g.loss ?? 0) / 100), 2); // 구매가(로스 0) 단가 역산
          const currentReal = round(baseUnit / (1 - (g.loss ?? 0) / 100), 2); // = 현재 기준단가
          const newReal = round(baseUnit / (1 - lossRate / 100), 2);
          const diff = round(newReal - currentReal, 2);
          const down = diff < 0;
          return (
            <View style={{ marginTop: 14, backgroundColor: T.blueTint, borderWidth: 1, borderColor: T.blue, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: T.sub, marginBottom: 8 }}>
                실사용 단가 <Text style={{ fontSize: 11.5, fontWeight: '600', color: T.sub2 }}>(로스 반영)</Text>
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3 }}>
                <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: T.sub2 }}>현재 {g.loss ?? 0}%</Text>
                <Text style={[{ fontSize: 14.5, fontWeight: '700', color: T.ink }, NUM]}>{currentReal}{g.priceUnit}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3 }}>
                <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: T.blue }}>변경 {lossRate}%</Text>
                <Text style={[{ fontSize: 16, fontWeight: '800', color: T.blue, marginRight: 8 }, NUM]}>{newReal}{g.priceUnit}</Text>
                {diff !== 0 ? (
                  <Badge tone={down ? 'green' : 'red'} sm>{`${down ? '▼' : '▲'}${Math.abs(diff)}`}</Badge>
                ) : (
                  <Badge tone="neutral" sm>변동 없음</Badge>
                )}
              </View>
            </View>
          );
        })()}

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 12, marginBottom: 18, backgroundColor: T.surface2, borderRadius: 11, padding: 12 }}>
          <Icon name="info" size={16} color={T.sub2} />
          <Text style={{ flex: 1, fontSize: 12.5, color: T.sub, lineHeight: 18 }}>
            로스율이 낮아질수록 실사용 단가도 내려가, 원가 계산 및 발주 예측의 정확도가 높아집니다.
          </Text>
        </View>
        <Button kind="primary" size="lg" full onPress={() => { setLossSheet(false); onClose(); }}>
          로스율 {lossRate}%로 저장
        </Button>
      </Sheet>
    </>
  );
}

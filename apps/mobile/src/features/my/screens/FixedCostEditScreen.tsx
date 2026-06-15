/**
 * MY-02 고정 지출 수정 — '자세히 보기(FixedCostScreen)'의 [수정]에서 진입.
 * 총 월매출·항목별(타이틀 입력 + 항목명/금액 입력 + 항목 추가) 입력 폼 → 저장(확인 후 전 레시피 반영).
 * ⚠ 디자인 프로토타입(정적 입력). 실제 입력/저장(E4)은 데이터 연결 단계에서 TextInput·RPC로.
 */
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppHeader, Button, Field, Icon, Input } from '@/components/kit';
import { T, won } from '@/theme/tokens';

const REVENUE = 28_500_000;

const SECTIONS: { title: string; rows: { name: string; amt: number }[] }[] = [
  { title: '인건비', rows: [{ name: '월 인건비', amt: 4_800_000 }] },
  { title: '플랫폼 수수료', rows: [{ name: '배민', amt: 1_650_000 }, { name: '쿠팡이츠', amt: 960_000 }] },
  { title: '포장비', rows: [{ name: '중대용기', amt: 225_000 }, { name: '소용기', amt: 155_000 }] },
  { title: '배달/배송 (대행)', rows: [{ name: '바로고', amt: 540_000 }] },
  { title: '광고/홍보', rows: [{ name: '인스타 광고', amt: 253_000 }] },
];

export default function FixedCostEditScreen() {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="고정 지출 수정" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24, gap: 11 }}>
        {/* 총 월매출 */}
        <View style={{ backgroundColor: T.surface, borderRadius: 16, padding: 16 }}>
          <Field label="총 월매출" req>
            <Input value={won(REVENUE)} suffix="원" mono />
          </Field>
        </View>

        {/* 항목별 카드 */}
        {SECTIONS.map((s, si) => (
          <View key={si} style={{ backgroundColor: T.surface, borderRadius: 16, padding: 16 }}>
            {/* 타이틀 입력 */}
            <Input value={s.title} />
            {/* 항목 행 */}
            <View style={{ gap: 8, marginTop: 10 }}>
              {s.rows.map((r, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Input value={r.name} />
                  </View>
                  <View style={{ width: 132 }}>
                    <Input value={won(r.amt)} suffix="원" mono />
                  </View>
                  <Pressable hitSlop={6}>
                    <Icon name="close" size={18} color={T.ter} />
                  </Pressable>
                </View>
              ))}
            </View>
            {/* 항목 추가 */}
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: T.blue, borderStyle: 'dashed', backgroundColor: T.blueTint }}>
              <Icon name="plus" size={17} color={T.blue} sw={2.2} />
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.ter }}>항목명 입력</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue }}>추가</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>

      {/* 하단 저장 */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <Button kind="primary" size="lg" full onPress={() => setConfirmOpen(true)}>
          저장
        </Button>
      </View>

      {/* 저장 확인 다이얼로그 */}
      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{ width: '100%', maxWidth: 340, backgroundColor: T.surface, borderRadius: 18, paddingTop: 24, paddingHorizontal: 20, paddingBottom: 14 }}>
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 17.5, fontWeight: '800', color: T.ink, textAlign: 'center' }}>레시피를 저장하시겠습니까?</Text>
              <Text style={{ fontSize: 14, color: T.sub, textAlign: 'center', lineHeight: 20 }}>
                레시피 저장 시 전 레시피에 반영됩니다.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 9, marginTop: 18 }}>
              <Pressable onPress={() => setConfirmOpen(false)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: T.line2 }}>
                <Text style={{ fontSize: 15.5, fontWeight: '700', color: T.ink2 }}>아니오</Text>
              </Pressable>
              <Pressable onPress={() => { setConfirmOpen(false); router.back(); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: T.blue }}>
                <Text style={{ fontSize: 15.5, fontWeight: '700', color: '#fff' }}>예</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

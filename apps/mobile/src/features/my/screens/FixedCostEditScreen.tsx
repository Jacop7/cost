/**
 * MY-02 고정 지출 수정 — '자세히 보기(FixedCostScreen)'의 [수정]에서 진입.
 * 총 월매출·항목별(타이틀 입력 + 항목명/금액 입력 + 항목 추가) 입력 폼 → 저장(확인 후 전 레시피 반영).
 * ⚠ 디자인 프로토타입(정적 입력). 실제 입력/저장(E4)은 데이터 연결 단계에서 TextInput·RPC로.
 */
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppHeader, Button, Field, Icon, Input } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { cardShadow, T, won } from '@/theme/tokens';
import { ChannelWeightSheet } from '../components/ChannelWeightSheet';

const REVENUE = 28_500_000;
const CHANNELS = ['매장', '배달', '포장'];

const SECTIONS: { title: string; channels: string[]; rows: { name: string; amt: number }[] }[] = [
  { title: '인건비', channels: ['매장', '배달', '포장'], rows: [{ name: '월 인건비', amt: 4_800_000 }] },
  { title: '플랫폼 수수료', channels: ['배달'], rows: [{ name: '배민', amt: 1_650_000 }, { name: '쿠팡이츠', amt: 960_000 }] },
  { title: '포장비', channels: ['배달', '포장'], rows: [{ name: '중대용기', amt: 225_000 }, { name: '소용기', amt: 155_000 }] },
  { title: '배달/배송 (대행)', channels: ['배달'], rows: [{ name: '바로고', amt: 540_000 }] },
  { title: '광고/홍보', channels: ['매장', '배달', '포장'], rows: [{ name: '인스타 광고', amt: 253_000 }] },
];

export default function FixedCostEditScreen() {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [weightSi, setWeightSi] = useState<number | null>(null); // 채널·비중 시트 대상 섹션
  const [sections, setSections] = useState(() =>
    SECTIONS.map((s) => ({ title: s.title, channels: [...s.channels], rows: s.rows.map((r) => ({ ...r })) })),
  );
  const addRow = (si: number) =>
    setSections((prev) => prev.map((s, i) => (i === si ? { ...s, rows: [...s.rows, { name: '', amt: 0 }] } : s)));
  const removeRow = (si: number, ri: number) =>
    setSections((prev) => prev.map((s, i) => (i === si ? { ...s, rows: s.rows.filter((_, j) => j !== ri) } : s)));
  const addSection = () => setSections((prev) => [...prev, { title: '', channels: [], rows: [{ name: '', amt: 0 }] }]);
  const removeSection = (si: number) => setSections((prev) => prev.filter((_, i) => i !== si));
  const toggleChannel = (si: number, ch: string) =>
    setSections((prev) => prev.map((s, i) => (i === si ? { ...s, channels: s.channels.includes(ch) ? s.channels.filter((c) => c !== ch) : [...s.channels, ch] } : s)));

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="고정 지출 수정" onBack={() => safeBack('/recipes/fixed-cost')} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24, gap: 11 }}>
        {/* 총 월매출 */}
        <View style={{ backgroundColor: T.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: T.line, ...cardShadow }}>
          <Field label="총 월매출" req>
            <Input value={won(REVENUE)} mono />
          </Field>
        </View>

        {/* 항목별 카드 */}
        {sections.map((s, si) => (
          <View key={si} style={{ backgroundColor: T.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: T.line, ...cardShadow }}>
            {/* 타이틀 입력 + 카드 삭제 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Input value={s.title} placeholder="항목 제목" />
              </View>
              <Pressable hitSlop={6} onPress={() => removeSection(si)}>
                <Icon name="close" size={18} color={T.ter} />
              </Pressable>
            </View>
            {/* 적용 채널 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: T.sub2 }}>적용 채널</Text>
              {CHANNELS.map((ch) => {
                const on = s.channels.includes(ch);
                return (
                  <Pressable key={ch} onPress={() => toggleChannel(si, ch)} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: on ? T.blue : T.line, backgroundColor: on ? T.blueTint : T.surface }}>
                    {on ? <Icon name="check" size={12} color={T.blue} sw={2.6} /> : null}
                    <Text style={{ fontSize: 13, fontWeight: '700', color: on ? T.blue : T.sub }}>{ch}</Text>
                  </Pressable>
                );
              })}
              {s.channels.length > 0 ? (
                <Pressable onPress={() => setWeightSi(si)} hitSlop={4} style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: T.line2 }}>
                  <Icon name="swap" size={13} color={T.sub} sw={2.2} />
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: T.sub }}>비중</Text>
                </Pressable>
              ) : null}
            </View>
            {/* 구분선 */}
            <View style={{ height: 1, backgroundColor: T.line2, marginTop: 12, marginBottom: 12 }} />
            {/* 항목 행 */}
            <View style={{ gap: 8 }}>
              {s.rows.map((r, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Input value={r.name} placeholder="항목명 입력" />
                  </View>
                  <View style={{ width: 132 }}>
                    <Input value={r.amt > 0 ? won(r.amt) : ''} placeholder="금액" mono />
                  </View>
                  <Pressable hitSlop={6} onPress={() => removeRow(si, i)}>
                    <Icon name="close" size={18} color={T.ter} />
                  </Pressable>
                </View>
              ))}
            </View>
            {/* 항목 추가 */}
            <Pressable onPress={() => addRow(si)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: T.blue, borderStyle: 'dashed', backgroundColor: T.blueTint }}>
              <Icon name="plus" size={17} color={T.blue} sw={2.2} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: T.blue }}>추가</Text>
            </Pressable>
          </View>
        ))}

        {/* 새 항목(카드) 추가 */}
        <Pressable onPress={addSection} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 14, borderRadius: 16, borderWidth: 1.5, borderColor: T.line, borderStyle: 'dashed', backgroundColor: T.surface }}>
          <Icon name="plus" size={18} color={T.sub} sw={2.2} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub }}>새 항목 추가</Text>
        </Pressable>
      </ScrollView>

      {/* 하단 저장 */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <Button kind="primary" size="lg" full onPress={() => setConfirmOpen(true)}>
          저장
        </Button>
      </View>

      {/* 저장 확인 다이얼로그 */}
      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <View style={{ flex: 1, backgroundColor: T.scrim, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{ width: '100%', maxWidth: 340, backgroundColor: T.surface, borderRadius: 18, paddingTop: 24, paddingHorizontal: 20, paddingBottom: 14 }}>
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: T.ink, textAlign: 'center' }}>레시피를 저장하시겠습니까?</Text>
              <Text style={{ fontSize: 16, color: T.sub, textAlign: 'center', lineHeight: 20 }}>
                레시피 저장 시 전 레시피에 반영됩니다.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 9, marginTop: 18 }}>
              <Pressable onPress={() => setConfirmOpen(false)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: T.line2 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink2 }}>아니오</Text>
              </Pressable>
              <Pressable onPress={() => { setConfirmOpen(false); safeBack('/recipes/fixed-cost'); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: T.blue }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: T.onColor }}>예</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* RCP-15 적용 채널·비중 시트 */}
      <ChannelWeightSheet
        visible={weightSi != null}
        onClose={() => setWeightSi(null)}
        channels={weightSi != null ? sections[weightSi]?.channels ?? [] : []}
      />
    </View>
  );
}

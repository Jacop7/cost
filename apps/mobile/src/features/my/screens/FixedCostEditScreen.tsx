/**
 * MY-02 고정 지출 수정 — '자세히 보기(FixedCostScreen)'의 [수정]에서 진입. zip 프로토타입(RCP-09) 디자인.
 * 총 월매출 · 항목별(회색 헤더: 제목 입력 + 적용 채널 비중 칩 → 탭 시 채널·비중 시트) · 항목명/금액 입력 · 추가/삭제 → 저장(→ E4).
 * ⚠ 디자인 프로토타입(정적 입력). 실제 입력/저장(E4)은 데이터 연결 단계에서.
 */
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppHeader, Button, Icon, Input } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { cardShadow, T, won } from '@/theme/tokens';
import { ChannelWeightSheet } from '../components/ChannelWeightSheet';

const REVENUE = 28_500_000;
const CHANNELS = ['매장', '배달', '포장'];

interface Section {
  title: string;
  channels: string[];
  weights: Record<string, number>;
  rows: { name: string; amt: number }[];
}
const SECTIONS: Section[] = [
  { title: '인건비', channels: ['매장', '배달', '포장'], weights: { 매장: 30, 배달: 50, 포장: 20 }, rows: [{ name: '월 인건비', amt: 4_800_000 }] },
  { title: '플랫폼 수수료', channels: ['배달'], weights: { 배달: 100 }, rows: [{ name: '배민', amt: 1_650_000 }, { name: '쿠팡이츠', amt: 960_000 }] },
  { title: '포장비', channels: ['배달', '포장'], weights: { 배달: 70, 포장: 30 }, rows: [{ name: '중대용기', amt: 225_000 }, { name: '소용기', amt: 155_000 }] },
  { title: '배달/배송 (대행)', channels: ['배달'], weights: { 배달: 100 }, rows: [{ name: '바로고', amt: 540_000 }] },
  { title: '광고/홍보', channels: ['매장', '배달', '포장'], weights: { 매장: 30, 배달: 50, 포장: 20 }, rows: [{ name: '인스타 광고', amt: 253_000 }] },
];

export default function FixedCostEditScreen() {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [weightSi, setWeightSi] = useState<number | null>(null); // 채널·비중 시트 대상 섹션
  const [sections, setSections] = useState<Section[]>(() =>
    SECTIONS.map((s) => ({ title: s.title, channels: [...s.channels], weights: { ...s.weights }, rows: s.rows.map((r) => ({ ...r })) })),
  );
  const addRow = (si: number) =>
    setSections((prev) => prev.map((s, i) => (i === si ? { ...s, rows: [...s.rows, { name: '', amt: 0 }] } : s)));
  const removeRow = (si: number, ri: number) =>
    setSections((prev) => prev.map((s, i) => (i === si ? { ...s, rows: s.rows.filter((_, j) => j !== ri) } : s)));
  const addSection = () => setSections((prev) => [...prev, { title: '', channels: [], weights: {}, rows: [{ name: '', amt: 0 }] }]);
  const removeSection = (si: number) => setSections((prev) => prev.filter((_, i) => i !== si));

  const XBtn = ({ onPress }: { onPress: () => void }) => (
    <Pressable onPress={onPress} hitSlop={6} style={{ width: 40, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="close" size={18} color={T.ter} />
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="고정 지출 수정" onBack={() => safeBack('/recipes/fixed-cost')} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24, gap: 12 }}>
        {/* 총 월매출 */}
        <View style={{ backgroundColor: T.surface, borderRadius: 16, padding: 16, ...cardShadow }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub, marginBottom: 8 }}>
            총 월매출 <Text style={{ color: T.blue }}>*</Text>
          </Text>
          <Input value={won(REVENUE)} mono />
        </View>

        {/* 항목별 카드 */}
        {sections.map((s, si) => (
          <View key={si} style={{ backgroundColor: T.surface, borderRadius: 16, overflow: 'hidden', ...cardShadow }}>
            {/* 회색 헤더 — 제목 입력 + 적용 채널(비중 칩, 탭 → 시트) */}
            <View style={{ backgroundColor: T.surface2, padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 11 }}>
                <View style={{ flex: 1 }}>
                  <Input value={s.title} placeholder="항목 제목" />
                </View>
                <XBtn onPress={() => removeSection(si)} />
              </View>
              <Pressable onPress={() => setWeightSi(si)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: T.sub2, paddingTop: 5 }}>적용 채널</Text>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {CHANNELS.map((c) => {
                    const on = s.channels.includes(c);
                    return (
                      <View key={c} style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: on ? T.blue : T.line, backgroundColor: on ? T.blueTint : T.surface }}>
                        <Text style={[{ fontSize: 13, fontWeight: '700', color: on ? T.blue : T.ter }, { fontVariant: ['tabular-nums'] }]}>{c} {on ? s.weights[c] ?? 0 : 0}%</Text>
                      </View>
                    );
                  })}
                </View>
              </Pressable>
            </View>
            {/* 항목 행 */}
            <View style={{ padding: 14 }}>
              {s.rows.map((r, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                  <View style={{ flex: 1.4 }}>
                    <Input value={r.name} placeholder="항목명 입력" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input value={r.amt > 0 ? won(r.amt) : ''} placeholder="금액" suffix="원" mono />
                  </View>
                  <XBtn onPress={() => removeRow(si, i)} />
                </View>
              ))}
              <Pressable onPress={() => addRow(si)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: T.blue, backgroundColor: T.blueTint }}>
                <Icon name="plus" size={17} color={T.blue} sw={2.2} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue }}>추가</Text>
              </Pressable>
            </View>
          </View>
        ))}

        {/* 새 항목(카드) 추가 */}
        <Pressable onPress={addSection} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: T.line3 }}>
          <Icon name="plus" size={17} color={T.sub2} sw={2.2} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub2 }}>새 항목 추가</Text>
        </Pressable>
      </ScrollView>

      {/* 하단 저장 */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <Button kind="primary" size="lg" full onPress={() => setConfirmOpen(true)}>저장</Button>
      </View>

      {/* 저장 확인 다이얼로그 */}
      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <View style={{ flex: 1, backgroundColor: T.scrim, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{ width: '100%', maxWidth: 340, backgroundColor: T.surface, borderRadius: 18, paddingTop: 24, paddingHorizontal: 20, paddingBottom: 14 }}>
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: T.ink, textAlign: 'center' }}>고정 지출을 저장하시겠습니까?</Text>
              <Text style={{ fontSize: 16, color: T.sub, textAlign: 'center', lineHeight: 22 }}>저장 시 전 레시피의 고정지출률에 반영됩니다.</Text>
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

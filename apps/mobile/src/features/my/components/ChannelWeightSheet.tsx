/**
 * RCP-15 적용 채널 · 비중 (시트) — 인건비 등 고정지출을 채널별로 몇 %씩 배분할지.
 * 선택된 채널마다 슬라이더로 비중 조정, 합계 100% 검증.
 * ⚠ 미리보기/설정 UI(데모). 실제 배분 저장은 E4(고정지출) 연결 단계에서.
 */
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Icon, Sheet, Slider } from '@/components/kit';
import { T } from '@/theme/tokens';

const NUM = { fontVariant: ['tabular-nums' as const] };

/** 채널 목록으로 균등 분할 비중 시드(합계 100). */
function seed(channels: string[]): Record<string, number> {
  const n = channels.length;
  if (n === 0) return {};
  const base = Math.floor(100 / n / 5) * 5;
  const out: Record<string, number> = {};
  channels.forEach((c) => { out[c] = base; });
  out[channels[0]!] = 100 - base * (n - 1); // 나머지를 첫 채널에 몰아 합계 100
  return out;
}

export function ChannelWeightSheet({ visible, onClose, channels }: {
  visible: boolean;
  onClose: () => void;
  channels: string[];
}) {
  const [weights, setWeights] = useState<Record<string, number>>({});

  useEffect(() => { if (visible) setWeights(seed(channels)); }, [visible, channels]);

  const sum = channels.reduce((a, c) => a + (weights[c] ?? 0), 0);
  const ok = sum === 100;

  return (
    <Sheet visible={visible} onClose={onClose} title="적용 채널 · 비중" sub="인건비를 어느 채널에 얼마씩 배분할까요?" height={452}>
      {channels.length === 0 ? (
        <Text style={{ fontSize: 16, color: T.ter, textAlign: 'center', paddingVertical: 28 }}>먼저 적용 채널을 선택해 주세요.</Text>
      ) : (
        <>
          <View style={{ gap: 18 }}>
            {channels.map((c) => (
              <View key={c}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 9 }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.ink }}>{c}</Text>
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: T.blue }, NUM]}>{weights[c] ?? 0}%</Text>
                </View>
                <Slider
                  value={weights[c] ?? 0}
                  min={0}
                  max={100}
                  step={5}
                  onChange={(v) => setWeights((w) => ({ ...w, [c]: v }))}
                />
              </View>
            ))}
          </View>

          {/* 합계 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18, paddingVertical: 13, paddingHorizontal: 15, borderRadius: 11, backgroundColor: ok ? T.blueTint : T.amberTint }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: ok ? T.blue : T.amberText }}>합계</Text>
            {ok ? <Icon name="check" size={15} color={T.blue} sw={3} /> : null}
            <Text style={[{ fontSize: 16, fontWeight: '800', color: ok ? T.blue : T.amberText }, NUM]}>{sum}%</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 9, marginTop: 18 }}>
            <View style={{ flex: 1 }}><Button kind="ghost" size="lg" full onPress={onClose}>취소</Button></View>
            <View style={{ flex: 2 }}><Button kind="primary" size="lg" full onPress={onClose}>적용</Button></View>
          </View>
        </>
      )}
    </Sheet>
  );
}

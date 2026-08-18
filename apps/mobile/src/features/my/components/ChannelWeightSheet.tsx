/**
 * RCP-15 적용 채널 · 비중 (시트) — 고정지출 항목을 채널별로 몇 %씩 배분할지.
 *
 * 왜 필요한가: 플랫폼 수수료는 배달에만, 포장비는 배달·포장에만 든다. 매출 비중으로만
 * 나누면 매장이 배달 수수료를 떠안아 "매장이 적자"라는 잘못된 결론이 나온다.
 *
 * 합계는 100%를 **강제하지 않는다** — 서버가 비율로 정규화하므로 "매장 3 배달 5 포장 2"도 된다.
 * 다만 100%가 아니면 그 사실을 보여준다.
 */
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Icon, Sheet, Slider } from '@/components/kit';
import { T } from '@/theme/tokens';
import { useSettingsLists } from '../hooks';

const NUM = { fontVariant: ['tabular-nums' as const] };

export type ChannelWeights = Record<string, number>;

export function ChannelWeightSheet({ visible, onClose, title, value, onApply }: {
  visible: boolean;
  onClose: () => void;
  /** 어떤 항목의 비중인지 — '인건비' 처럼. */
  title?: string;
  /** 현재 비중. null 이면 "지정 안 함"(매출 비중으로 배분). */
  value: ChannelWeights | null;
  onApply: (next: ChannelWeights | null) => void;
}) {
  const lists = useSettingsLists();
  const channels = (lists.data?.channels ?? []).filter((c) => c.active);

  const [weights, setWeights] = useState<ChannelWeights>({});
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (value) { setWeights(value); setEnabled(true); return; }
    // 처음 켤 때는 균등 분할로 시작한다. 빈 값에서 슬라이더를 하나씩 올리게 하면 번거롭다.
    const n = channels.length || 1;
    const base = Math.floor(100 / n / 5) * 5;
    const seed: ChannelWeights = {};
    channels.forEach((c) => { seed[c.code] = base; });
    if (channels[0]) seed[channels[0].code] = 100 - base * (n - 1);
    setWeights(seed);
    setEnabled(false);
  }, [visible, value, lists.data]);

  const sum = channels.reduce((a, c) => a + (weights[c.code] ?? 0), 0);
  const exact = sum === 100;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="적용 채널 · 비중"
      sub={title ? `${title}을(를) 어느 채널에 얼마씩 배분할까요?` : '어느 채널에 얼마씩 배분할까요?'}
      height={540}
    >
      {channels.length === 0 ? (
        <Text style={{ fontSize: 16, color: T.ter, textAlign: 'center', paddingVertical: 28 }}>
          등록된 판매 채널이 없어요.
        </Text>
      ) : (
        <>
          {/* 지정 안 함 — 매출 비중으로 자동 배분 */}
          <Pressable
            onPress={() => setEnabled((v) => !v)}
            accessibilityRole="switch"
            accessibilityLabel="채널 비중 직접 지정"
            accessibilityState={{ checked: enabled }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: enabled ? T.blue : T.line, backgroundColor: enabled ? T.blueTint : T.surface, marginBottom: 16 }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: enabled ? T.blue : T.ink }}>비중 직접 지정</Text>
              <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>
                끄면 채널 매출 비중으로 자동 배분돼요
              </Text>
            </View>
            {enabled ? <Icon name="check" size={18} color={T.blue} sw={2.4} /> : null}
          </Pressable>

          <View style={{ gap: 18, opacity: enabled ? 1 : 0.4 }}>
            {channels.map((c) => (
              <View key={c.code}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 9 }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.ink }}>{c.name}</Text>
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: T.blue }, NUM]}>{weights[c.code] ?? 0}%</Text>
                </View>
                <Slider
                  value={weights[c.code] ?? 0}
                  min={0}
                  max={100}
                  step={5}
                  onChange={(v) => { setEnabled(true); setWeights((w) => ({ ...w, [c.code]: v })); }}
                />
              </View>
            ))}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18, paddingVertical: 13, paddingHorizontal: 15, borderRadius: 11, backgroundColor: exact ? T.blueTint : T.surface2 }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: exact ? T.blue : T.sub }}>합계</Text>
            {exact ? <Icon name="check" size={15} color={T.blue} sw={3} /> : null}
            <Text style={[{ fontSize: 16, fontWeight: '800', color: exact ? T.blue : T.sub }, NUM]}>{sum}%</Text>
          </View>
          {!exact && enabled ? (
            <Text style={{ fontSize: 14, color: T.ter, marginTop: 8, lineHeight: 20 }}>
              합이 100%가 아니어도 괜찮아요. 입력한 비율대로 나눠서 배분해요.
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 9, marginTop: 18 }}>
            <View style={{ flex: 1 }}><Button kind="ghost" size="lg" full onPress={onClose}>취소</Button></View>
            <View style={{ flex: 2 }}>
              <Button
                kind="primary" size="lg" full
                disabled={enabled && sum <= 0}
                onPress={() => onApply(enabled ? weights : null)}
              >
                적용
              </Button>
            </View>
          </View>
        </>
      )}
    </Sheet>
  );
}

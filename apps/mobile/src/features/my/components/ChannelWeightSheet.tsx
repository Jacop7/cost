/** RCP-15/MY-05b: edit allocation weights, preserving server normalization. */
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Field, Input, Sheet } from '@/components/kit';
import { SelectionRow } from '@/components/kit/SelectionRow';
import { ResultField } from '@/components/kit/ResultField';
import { COLOR, TYPE, space } from '@/theme/tokens';
import { clampDecimals } from '@/lib/num';
import { useSettingsLists } from '@/features/master-data/hooks';

export type ChannelWeights = Record<string, number>;

export function ChannelWeightSheet({ visible, onClose, title, value, onApply }: {
  visible: boolean; onClose: () => void; title?: string;
  value: ChannelWeights | null; onApply: (next: ChannelWeights | null) => void;
}) {
  const lists = useSettingsLists();
  // Keep existing inactive allocations visible; never silently drop their weights.
  const channels = (lists.data?.channels ?? []).filter((c) => c.active || (value?.[c.code] ?? 0) > 0);
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState(false);
  const initialized = useRef(false);
  useEffect(() => {
    if (!visible) { initialized.current = false; return; }
    if (initialized.current || lists.isLoading || lists.error) return;
    initialized.current = true;
    if (value) {
      setWeights(Object.fromEntries(Object.entries(value).map(([key, weight]) => [key, String(weight)])));
      setEnabled(true); return;
    }
    const base = Math.floor(100 / (channels.length || 1) / 5) * 5;
    const seed = Object.fromEntries(channels.map((c, i) => [c.code, String(i === 0 ? 100 - base * (channels.length - 1) : base)]));
    setWeights(seed); setEnabled(false);
  }, [visible, value, lists.data, lists.isLoading, lists.error]);
  const numbers = Object.fromEntries(Object.entries(weights).map(([key, weight]) => [key, Number(weight) || 0]));
  const sum = Object.values(numbers).reduce((a, b) => a + b, 0);
  const valid = Object.values(numbers).every((weight) => Number.isFinite(weight) && weight >= 0);
  const canApply = !lists.isLoading && !lists.error && channels.length > 0 && (!enabled || (valid && sum > 0));

  return <Sheet visible={visible} onClose={onClose} title="채널 배분">
    {title ? <Text style={{ ...TYPE.caption, color: COLOR.text.tertiary, marginBottom: space.sm }}>{title}</Text> : null}
    {channels.length === 0 ? <Text style={{ ...TYPE.body, color: COLOR.text.tertiary }}>등록된 판매 채널이 없어요.</Text> : <>
      <SelectionRow label="매출 비중으로 자동" selected={!enabled} onPress={() => setEnabled(false)} />
      <SelectionRow label="직접 배분" selected={enabled} onPress={() => setEnabled(true)} last />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md }}>
        {channels.map((channel, index) => <View key={channel.code} style={{
          flexBasis: channels.length % 2 === 1 && index === channels.length - 1 ? '100%' : '47%', flexGrow: 1 }}>
          <Field label={channel.name + (channel.active ? '' : ' (사용 안 함)')} variant="stacked">
            <Input value={weights[channel.code] ?? '0'} suffix="%" variant="stacked" mono keyboardType="decimal-pad"
              accessibilityLabel={channel.name + ' 배분 비중'} onChangeText={(text) => {
                setEnabled(true); setWeights((current) => ({ ...current, [channel.code]: clampDecimals(text, 4) }));
              }} />
          </Field>
        </View>)}
      </View>
      <ResultField label="배분 합계" value={Number(sum.toFixed(4)) + '%'} />
      {enabled && sum !== 100 ? <Text style={{ ...TYPE.caption, color: COLOR.text.tertiary }}>
        합이 100%가 아니어도 입력한 비율대로 나눠서 배분해요.
      </Text> : null}
    </>}
    <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
      <Button kind="gray" size="lg" full style={{ flex: 1 }} onPress={onClose}>취소</Button>
      <Button kind="primary" size="lg" full style={{ flex: 1 }} disabled={!canApply}
        onPress={() => { if (canApply) onApply(enabled ? numbers : null); }}>적용</Button>
    </View>
  </Sheet>;
}

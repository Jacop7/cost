/**
 * SortSheet — 정렬 선택 바텀시트 + 이를 여는 칩.
 *
 * 정렬은 "현재 맥락을 유지해야 하는 짧은 선택"이라 바텀시트가 맞다(가이드 §9.9).
 * 선택은 색이 아니라 체크 아이콘 + 접근성 state 로도 전달한다(§9.6-6, §9.4-3).
 */
import { Pressable, Text, View } from 'react-native';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { T } from '@/theme/tokens';

export interface SortOption<K extends string> {
  key: K;
  label: string;
  /** 무엇을 기준으로 줄 세우는지 한 줄 설명. 사장님이 결과를 예측할 수 있게 한다. */
  hint?: string;
}

/** 정렬 기준을 여는 칩. 현재 선택된 라벨을 그대로 보여준다. */
export function SortChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`정렬 기준: ${label}`}
      accessibilityHint="정렬 기준을 바꿉니다"
      hitSlop={6}
      style={{
        alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
        borderWidth: 1, borderColor: T.line, backgroundColor: T.surface,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: '600', color: T.ink2 }}>{label}</Text>
      <Icon name="chevronDown" size={15} color={T.sub2} />
    </Pressable>
  );
}

export function SortSheet<K extends string>({ visible, options, value, onSelect, onClose }: {
  visible: boolean;
  options: readonly SortOption<K>[];
  value: K;
  onSelect: (k: K) => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="정렬 기준" height={120 + options.length * 62}>
      {options.map((o, i) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => { onSelect(o.key); onClose(); }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              paddingVertical: 14,
              borderBottomWidth: i < options.length - 1 ? 1 : 0, borderBottomColor: T.line2,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 16, fontWeight: on ? '800' : '600', color: on ? T.blue : T.ink }}>{o.label}</Text>
              {o.hint ? <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>{o.hint}</Text> : null}
            </View>
            {on ? <Icon name="check" size={20} color={T.blue} sw={2.4} /> : null}
          </Pressable>
        );
      })}
    </Sheet>
  );
}

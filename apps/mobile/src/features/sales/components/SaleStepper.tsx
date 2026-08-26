/**
 * − N + 판매 수량 스테퍼.
 *
 * ⚠ **한 벌만 둔다.** 원래 매출관리 홈 안에만 있었는데 과거 정정 화면(§6.4)도 같은 것이
 *   필요해졌다. 복사하면 한쪽만 고쳐지는 날이 온다 — 이 앱에서 재고 상태 판정이
 *   그렇게 두 벌이 됐었다(0108).
 *
 * 34×34 라 hitSlop 5 를 더해 최소 44×44 를 채운다(가이드 §9.6-1).
 */
import { Pressable, Text, View } from 'react-native';
import { Icon } from '@/components/kit';
import { T } from '@/theme/tokens';

const NUM = { fontVariant: ['tabular-nums' as const] };

export function SaleStepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const Btn = ({ ic, delta, disabled }: { ic: 'minus' | 'plus'; delta: number; disabled?: boolean }) => (
    <Pressable
      onPress={() => onChange(Math.max(0, value + delta))}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${delta > 0 ? '늘리기' : '줄이기'}`}
      accessibilityState={{ disabled: Boolean(disabled) }}
      hitSlop={5}
      style={{
        width: 34, height: 34, borderRadius: 9,
        backgroundColor: disabled ? T.line2 : delta > 0 ? T.blue : T.line2,
        opacity: disabled ? 0.5 : 1,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Icon name={ic} size={18} color={delta > 0 && !disabled ? T.onColor : T.sub} sw={2.4} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
      <Btn ic="minus" delta={-1} disabled={value <= 0} />
      <Text style={[{ minWidth: 26, textAlign: 'center', fontSize: 18, fontWeight: '800', color: value ? T.ink : T.ter }, NUM]}>{value}</Text>
      <Btn ic="plus" delta={1} />
    </View>
  );
}

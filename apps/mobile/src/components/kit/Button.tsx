import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Icon, type IconName } from './Icon';
import { COLOR, T, space } from '@/theme/tokens';

type Kind = 'primary' | 'tint' | 'gray' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

/** 공용 버튼. 배럴(index.tsx)을 역참조하지 않아 시트·상태 UI의 순환 import를 막는다. */
export function Button({
  children, kind = 'primary', size = 'md', full, icon, iconRight, onPress, style,
  disabled = false, loading = false, accessibilityLabel, accessibilityHint,
}: {
  children: ReactNode;
  kind?: Kind;
  size?: Size;
  full?: boolean;
  icon?: IconName;
  iconRight?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const kinds: Record<Kind, { bg: string; fg: string; border?: string }> = {
    primary: { bg: COLOR.action.primary, fg: T.onColor },
    tint: { bg: COLOR.action.primaryTint, fg: COLOR.action.onTint },
    gray: { bg: T.line2, fg: T.ink2 },
    ghost: { bg: 'transparent', fg: T.sub, border: T.line },
    danger: { bg: T.redTint, fg: T.red },
  };
  const sizes: Record<Size, { pv: number; ph: number; fs: number; r: number; hs: number }> = {
    sm: { pv: 8, ph: 12, fs: 14, r: 9, hs: 7 },
    md: { pv: 13, ph: 16, fs: 16, r: 12, hs: 1 },
    lg: { pv: 16, ph: 18, fs: 17, r: 14, hs: 0 },
  };
  const c = kinds[kind];
  const s = sizes[size];
  const blocked = disabled || loading;
  const iconEl = icon && !loading ? <Icon name={icon} size={s.fs + 3} color={c.fg} sw={2} /> : null;

  return (
    <Pressable
      onPress={blocked ? undefined : onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: blocked, busy: loading }}
      hitSlop={{ top: s.hs, bottom: s.hs }}
      style={({ pressed }) => [
        {
          flexDirection: iconRight ? 'row-reverse' : 'row',
          alignItems: 'center', justifyContent: 'center', gap: space.sm,
          alignSelf: full ? 'stretch' : 'flex-start',
          backgroundColor: kind === 'primary' && pressed && !blocked ? COLOR.action.primaryPressed : c.bg,
          borderWidth: c.border ? 1 : 0, borderColor: c.border,
          paddingVertical: s.pv, paddingHorizontal: s.ph, borderRadius: s.r,
          // 2026-09-06 소유자 결정: variant 고유색은 유지하고 비활성 표현만 공통 opacity로 통일한다.
          opacity: disabled ? 0.4 : pressed && kind !== 'primary' ? 0.85 : 1,
        },
        style,
      ]}
    >
      {iconEl}
      <Text style={{ color: c.fg, fontSize: s.fs, fontWeight: '700', letterSpacing: -0.2, opacity: loading ? 0 : 1 }}>
        {children}
      </Text>
      {loading ? (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="small" color={c.fg} />
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

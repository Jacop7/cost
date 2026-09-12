import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Icon, type IconName } from './Icon';
import { COLOR, COMPONENT, T, minTouchTarget, space } from '@/theme/tokens';

type Kind = 'primary' | 'tint' | 'gray' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

/** 공용 버튼. 배럴(index.tsx)을 역참조하지 않아 시트·상태 UI의 순환 import를 막는다. */
export function Button({
  children, kind = 'primary', size = 'md', full, icon, iconRight, onPress, style,
  disabled = false, loading = false, accessibilityLabel, accessibilityHint, presentation = 'default',
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
  presentation?: 'default' | 'status' | 'cardFooter';
}) {
  const kinds: Record<Kind, { bg: string; fg: string; border?: string }> = {
    primary: { bg: COLOR.action.primary, fg: T.onColor },
    tint: { bg: COLOR.action.primaryTint, fg: COLOR.action.onTint },
    gray: { bg: T.line2, fg: T.ink2 },
    ghost: { bg: 'transparent', fg: T.sub, border: T.line },
    danger: { bg: COLOR.status.negativeTint, fg: COLOR.status.negative },
  };
  const sizes: Record<Size, { pv: number; ph: number; fs: number; r: number; hs: number; minHeight?: number }> = {
    // 네이티브 측정에서 10개 소비처 중 발주·영업 시작을 포함한 5개 이상이
    // 가장 가까운 부모에 잘려 36.57dp로 남았다. 반복 예외 대신 공용 시각 높이를 보장한다.
    sm: { pv: 8, ph: 12, fs: 14, r: 9, hs: 0, minHeight: 44 },
    md: { pv: 13, ph: 16, fs: 16, r: 12, hs: 1 },
    lg: { pv: 16, ph: 18, fs: 17, r: 14, hs: 0 },
  };
  const c = kinds[kind];
  const s = sizes[size];
  const blocked = disabled || loading;
  const status = presentation === 'status' ? COMPONENT.button.status : null;
  const iconEl = icon && !loading ? <Icon name={icon} size={s.fs + 3} color={c.fg} sw={2} /> : null;

  const button = (
    <Pressable
      onPress={blocked ? undefined : onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: blocked, busy: loading }}
      hitSlop={{ top: status ? (minTouchTarget - status.visualHeight) / 2 : s.hs, bottom: status ? (minTouchTarget - status.visualHeight) / 2 : s.hs }}
      style={({ pressed }) => [
        {
          flexDirection: iconRight ? 'row-reverse' : 'row',
          alignItems: 'center', justifyContent: 'center', gap: status?.gap ?? space.sm,
          alignSelf: full ? 'stretch' : 'flex-start',
          backgroundColor: kind === 'primary' && pressed && !blocked ? COLOR.action.primaryPressed : c.bg,
          borderWidth: c.border ? 1 : 0, borderColor: c.border,
          paddingVertical: status ? 0 : s.pv, paddingHorizontal: status?.paddingHorizontal ?? s.ph,
          borderRadius: status?.radius ?? s.r, minHeight: status?.visualHeight ?? s.minHeight,
          // 2026-09-06 소유자 결정: variant 고유색은 유지하고 비활성 표현만 공통 opacity로 통일한다.
          opacity: disabled ? 0.4 : pressed && kind !== 'primary' ? 0.85 : 1,
        },
        style,
      ]}
    >
      {iconEl}
      <Text style={{ color: c.fg, fontSize: presentation === 'cardFooter' ? COMPONENT.cardFooter.largeFontSize : s.fs, fontWeight: '700', ...status?.label, letterSpacing: COMPONENT.button.label.letterSpacing, opacity: loading ? 0 : 1 }}>
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
  return status ? <View style={{ minHeight: minTouchTarget, minWidth: minTouchTarget, justifyContent: 'center', alignSelf: 'center' }}>{button}</View> : button;
}

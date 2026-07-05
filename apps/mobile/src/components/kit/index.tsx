/**
 * 공통 UI 킷 — kit.jsx 를 React Native 로 이식 (B0-3).
 * 웹 전용 속성은 RN 등가로 변환: whiteSpace→numberOfLines, boxShadow→cardShadow,
 * backdropFilter blur→반투명 배경, fontVariantNumeric→fontVariant.
 */
import { ReactNode } from 'react';
import { KeyboardTypeOptions, Pressable, ScrollView, StyleProp, Text, TextInput, TextStyle, View, ViewStyle } from 'react-native';
import { Icon, IconName } from './Icon';
import { cardShadow, FONT, STATUS, T, won } from '@/theme/tokens';

const NUM: TextStyle = { fontVariant: FONT.num as unknown as TextStyle['fontVariant'] };
export { Icon };
export type { IconName } from './Icon';
export { AppHeader } from './AppHeader';
export { Sheet } from './Sheet';
export { Slider } from './Slider';
export { Donut, TrendChart } from './charts';
export type { DonutSeg, TrendPoint } from './charts';

// ── 텍스트 헬퍼 ───────────────────────────────────────────────
export function Txt({ children, style, num, n }: { children: ReactNode; style?: StyleProp<TextStyle>; num?: boolean; n?: number }) {
  return (
    <Text numberOfLines={n} style={[num ? NUM : null, style]}>
      {children}
    </Text>
  );
}

// ── 상태 뱃지 ─────────────────────────────────────────────────
export function StatusBadge({ status, sm }: { status: 'ok' | 'low' | 'out'; sm?: boolean }) {
  const s = STATUS[status];
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: s.bar, paddingHorizontal: sm ? 7 : 9, paddingVertical: sm ? 4 : 5, borderRadius: 7 }}>
      <Text style={{ color: T.onColor, fontWeight: '700', fontSize: sm ? 12 : 13 }}>{s.label}</Text>
    </View>
  );
}

type Tone = 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'ghost';
export function Badge({ children, tone = 'neutral', sm, solid }: { children: ReactNode; tone?: Tone; sm?: boolean; solid?: boolean }) {
  const tones: Record<Tone, { bg: string; fg: string; border?: string }> = {
    neutral: { bg: T.line2, fg: T.sub2 },
    blue: { bg: T.blueTint, fg: T.blue },
    green: { bg: T.greenTint, fg: T.green },
    amber: { bg: T.amberTint, fg: T.amberText },
    red: { bg: T.redTint, fg: T.red },
    ghost: { bg: 'transparent', fg: T.ter, border: T.line },
  };
  const c = tones[tone];
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: solid ? c.fg : c.bg, borderWidth: c.border ? 1 : 0, borderColor: c.border, paddingHorizontal: sm ? 6 : 8, paddingVertical: sm ? 3 : 4, borderRadius: 6 }}>
      <Text style={{ color: solid ? T.onColor : c.fg, fontWeight: '600', fontSize: sm ? 12 : 13 }}>{children}</Text>
    </View>
  );
}

// ── 카드 ──────────────────────────────────────────────────────
export function Card({ children, style, pad = 16, onLine, shadow = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; pad?: number; onLine?: boolean; shadow?: boolean }) {
  return (
    <View style={[{ backgroundColor: T.surface, borderRadius: 16, padding: pad, borderWidth: onLine ? 1 : 0, borderColor: T.line }, shadow ? cardShadow : null, style]}>
      {children}
    </View>
  );
}

// ── 버튼 ──────────────────────────────────────────────────────
type Kind = 'primary' | 'tint' | 'gray' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';
export function Button({ children, kind = 'primary', size = 'md', full, icon, iconRight, onPress, style }: { children: ReactNode; kind?: Kind; size?: Size; full?: boolean; icon?: IconName; iconRight?: boolean; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const kinds: Record<Kind, { bg: string; fg: string; border?: string }> = {
    primary: { bg: T.blue, fg: T.onColor },
    tint: { bg: T.blueTint, fg: T.blue },
    gray: { bg: T.line2, fg: T.ink2 },
    ghost: { bg: 'transparent', fg: T.sub, border: T.line },
    danger: { bg: T.redTint, fg: T.red },
  };
  const c = kinds[kind];
  const sizes: Record<Size, { pv: number; ph: number; fs: number; r: number }> = {
    sm: { pv: 8, ph: 12, fs: 14, r: 9 },
    md: { pv: 13, ph: 16, fs: 16, r: 12 },
    lg: { pv: 16, ph: 18, fs: 17, r: 14 },
  };
  const s = sizes[size];
  const iconEl = icon ? <Icon name={icon} size={s.fs + 3} color={c.fg} sw={2} /> : null;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        { flexDirection: iconRight ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: full ? 'stretch' : 'flex-start', backgroundColor: kind === 'primary' && pressed ? T.bluePressed : c.bg, borderWidth: c.border ? 1 : 0, borderColor: c.border, paddingVertical: s.pv, paddingHorizontal: s.ph, borderRadius: s.r, opacity: pressed && kind !== 'primary' ? 0.85 : 1 },
        style,
      ]}
    >
      {iconEl}
      <Text style={{ color: c.fg, fontSize: s.fs, fontWeight: '700', letterSpacing: -0.2 }}>{children}</Text>
    </Pressable>
  );
}

// ── 칩 ────────────────────────────────────────────────────────
export function Chip({ children, active, tone, onPress }: { children: ReactNode; active?: boolean; tone?: 'blue'; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: active ? T.ink : tone === 'blue' ? T.blueTint : T.surface, borderWidth: active ? 0 : 1, borderColor: T.line }}>
      <Text style={{ fontSize: 16, fontWeight: '600', color: active ? T.onColor : tone === 'blue' ? T.blue : T.sub }}>{children}</Text>
    </Pressable>
  );
}

// ── 스테퍼 ────────────────────────────────────────────────────
export function Stepper({ value, unit, onChange }: { value: number; unit?: string; onChange?: (v: number) => void }) {
  const btn = (ic: IconName, delta: number) => (
    <Pressable onPress={() => onChange?.(value + delta)} style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: T.line2, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={ic} size={18} color={T.sub} sw={2.2} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {btn('minus', -1)}
      <View style={{ minWidth: 56, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}>
        <Text style={[{ fontSize: 18, fontWeight: '800', color: T.ink }, NUM]}>{value}</Text>
        {unit ? <Text style={{ fontSize: 16, fontWeight: '600', color: T.sub2, marginLeft: 1 }}>{unit}</Text> : null}
      </View>
      {btn('plus', 1)}
    </View>
  );
}

// ── FAB ───────────────────────────────────────────────────────
export function FAB({ label = '추가', icon = 'plus', bottom = 24, onPress }: { label?: string; icon?: IconName; bottom?: number; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ position: 'absolute', right: 18, bottom, zIndex: 30, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.blue, paddingVertical: 14, paddingLeft: 15, paddingRight: 18, borderRadius: 999, shadowColor: T.blue, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 20, elevation: 6 }}>
      <Icon name={icon} size={22} color={T.onColor} sw={2.4} />
      <Text style={{ color: T.onColor, fontWeight: '700', fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

// ── 폼 필드 ───────────────────────────────────────────────────
export function Field({ label, children, hint, req, right }: { label: string; children: ReactNode; hint?: string; req?: boolean; right?: ReactNode }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub }}>
          {label}
          {req ? <Text style={{ color: T.blue }}> *</Text> : null}
        </Text>
        {right}
      </View>
      {children}
      {hint ? <Text style={{ fontSize: 16, color: T.ter, marginTop: 6, lineHeight: 17 }}>{hint}</Text> : null}
    </View>
  );
}

// `mono` prop 유지(호출부 호환)하되 tabular-nums는 적용하지 않음.
// Pretendard 미번들 환경에서 tabular-nums가 숫자를 작고 얇은 대체 글꼴로 렌더 → 한글 라벨과 크기·굵기 불일치.
// 입력칸은 값이 하나뿐이라 자릿수 정렬이 필요 없으므로 한글과 동일 글꼴로 렌더한다.
export function Input({ value, placeholder, suffix, prefix, mono: _mono, right, onChangeText, keyboardType }: { value?: string; placeholder?: string; suffix?: string; prefix?: string; mono?: boolean; right?: ReactNode; onChangeText?: (t: string) => void; keyboardType?: KeyboardTypeOptions }) {
  const empty = value == null || value === '';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14 }}>
      {prefix ? <Text style={{ fontSize: 16, color: T.ter, fontWeight: '600' }}>{prefix}</Text> : null}
      {onChangeText ? (
        <TextInput
          style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: '600', color: T.ink, padding: 0 }}
          value={value}
          placeholder={placeholder}
          placeholderTextColor={T.ter}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
        />
      ) : (
        <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: '600', color: empty ? T.ter : T.ink }}>{empty ? placeholder : value}</Text>
      )}
      {suffix ? <Text style={{ fontSize: 16, color: T.sub2, fontWeight: '600', flexShrink: 0 }}>{suffix}</Text> : null}
      {right}
    </View>
  );
}

/** 페이지 컨테이너 — header(상단) + 본문. 탭바는 expo-router Tabs가 제공. */
export function ScreenShell({ children, header }: { children: ReactNode; header?: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {header}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

export function Select({ value, placeholder, onPress }: { value?: string; placeholder?: string; onPress?: () => void }) {
  const empty = value == null || value === '';
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14 }}>
      <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: empty ? T.ter : T.ink }}>{empty ? placeholder : value}</Text>
      <Icon name="chevronDown" size={18} color={T.ter} />
    </Pressable>
  );
}

// ── 손익표 행 ─────────────────────────────────────────────────
export function PLRow({ label, amt, pct, kind = 'cost', detail, bold }: { label: string; amt: number; pct: number | string; kind?: 'sales' | 'cost' | 'profit'; detail?: string; bold?: boolean }) {
  const sign = kind === 'cost' ? '−' : '';
  const valColor = kind === 'profit' ? T.green : kind === 'cost' ? T.ter : T.ink;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: bold ? 15.5 : 14.5, fontWeight: bold ? '800' : '600', color: kind === 'profit' ? T.green : T.ink2 }}>{label}</Text>
        {detail ? <Text style={{ fontSize: 13, color: T.ter, marginTop: 3, lineHeight: 16 }}>{detail}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end', minWidth: 96 }}>
        <Text style={[{ fontSize: bold ? 17 : 15, fontWeight: bold ? '800' : '700', color: valColor }, NUM]}>
          {sign}
          {won(amt)}
          <Text style={{ fontSize: 16, fontWeight: '600' }}>원</Text>
        </Text>
        <Text style={[{ fontSize: 16, fontWeight: '600', color: T.ter }, NUM]}>{pct}%</Text>
      </View>
    </View>
  );
}

// ── 세그먼트 탭 (후보/대기/완료) ───────────────────────────────
export function SegTabs({ tabs, active = 0, onChange }: { tabs: { label: string; count?: number }[]; active?: number; onChange?: (i: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, padding: 5, backgroundColor: T.line, borderRadius: 13 }}>
      {tabs.map((t, i) => {
        const on = active === i;
        return (
          <Pressable key={i} onPress={() => onChange?.(i)} style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5, paddingVertical: 9, borderRadius: 9, backgroundColor: on ? T.surface : 'transparent' }, on ? cardShadow : null]}>
            <Text style={{ fontSize: 16, fontWeight: on ? '700' : '600', color: on ? T.ink : T.ter }}>{t.label}</Text>
            {t.count != null ? <Text style={{ fontSize: 16, fontWeight: '700', color: on ? T.blue : T.ter }}>{t.count}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ── 카테고리 스크롤 탭 (밑줄형) ────────────────────────────────
export function ScrollTabs({ tabs, active = 0, onChange }: { tabs: string[]; active?: number; onChange?: (i: number) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 18, paddingHorizontal: 20 }}>
      {tabs.map((t, i) => {
        const on = i === active;
        return (
          <Pressable key={i} onPress={() => onChange?.(i)} style={{ paddingBottom: 11 }}>
            <Text style={{ fontSize: 16, fontWeight: on ? '700' : '600', color: on ? T.ink : T.ter }}>{t}</Text>
            {on ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2.5, backgroundColor: T.ink, borderRadius: 2 }} /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ── 기간 칩 (최근 3개월 ▾) ─────────────────────────────────────
export function PeriodChip({ value = '최근 3개월', onPress }: { value?: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 5, paddingLeft: 11, paddingRight: 9, borderRadius: 999, backgroundColor: T.line2 }}>
      <Text style={{ color: T.sub, fontSize: 16, fontWeight: '700' }}>{value}</Text>
      <Icon name="chevronDown" size={14} color={T.ter} />
    </Pressable>
  );
}

/**
 * 공통 UI 킷 — kit.jsx 를 React Native 로 이식 (B0-3).
 * 웹 전용 속성은 RN 등가로 변환: whiteSpace→numberOfLines, boxShadow→cardShadow,
 * backdropFilter blur→반투명 배경, fontVariantNumeric→fontVariant.
 */
import { ReactNode, useState } from 'react';
import { ActivityIndicator, KeyboardTypeOptions, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle } from 'react-native';
import { Icon, IconName } from './Icon';
import { cardShadow, FONT, STATUS, T, won } from '@/theme/tokens';

const NUM: TextStyle = { fontVariant: FONT.num as unknown as TextStyle['fontVariant'] };
export { Icon };
export { MemoEditSheet } from './MemoEditSheet';
export type { IconName } from './Icon';
export { AppHeader } from './AppHeader';
export { ConfirmSheet, Sheet } from './Sheet';
export { SearchBar } from './SearchBar';
export { QueryState } from './QueryState';
export { SortChip, SortSheet } from './SortSheet';
export type { SortOption } from './SortSheet';
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

/**
 * Notice — 파랑 톤 안내 배너. 원 안 i 아이콘 + 문구, 화살표 없음(눌러서 이동하지 않는 정보 전달용).
 * 섹션 설명을 회색 본문으로 흘리는 대신 이 배너로 묶어 "읽어야 하는 안내" 임을 드러낸다.
 * 탭하면 이동하는 링크형 배너는 별개다(그쪽은 chevron 을 단다).
 */
export function Notice({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: T.blueTint, borderWidth: 1, borderColor: T.blue, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }, style]}>
      {/* 아이콘은 첫 줄 중앙에 맞춘다 — 여러 줄 문구에서 위로 뜨지 않게 */}
      <View style={{ marginTop: 1 }}><Icon name="info" size={17} color={T.blue} /></View>
      <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: T.blue, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

// ── 버튼 ──────────────────────────────────────────────────────
type Kind = 'primary' | 'tint' | 'gray' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

/**
 * Button — 상태 계약(가이드 §9.7): Default / Pressed / Disabled / Loading.
 *
 * 데이터를 바꾸는 버튼(전파 이벤트·저장·삭제)은 탭 즉시 `loading` 으로 전환해 중복 제출을 막는다.
 * 단, debounce 만으로 데이터 무결성을 보장하지 않는다 — 서버 멱등성(예: E1 의 idempotency key)과
 * 함께 써야 한다. 여기서 막는 것은 "사용자 눈에 보이는 연타"까지다.
 *
 * `loading` 중에도 **버튼 너비가 변하지 않게** 라벨을 자리에 두고 투명하게 만든 뒤 spinner 를 겹친다.
 * 너비가 출렁이면 옆 버튼 위치가 밀려 오터치가 난다.
 */
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
  /** 조건 미충족으로 실행할 수 없는 상태. 터치가 차단되고 접근성에도 전달된다. */
  disabled?: boolean;
  /** 제출 진행 중. 터치가 차단되고 spinner 가 표시된다. */
  loading?: boolean;
  /** 아이콘만 있는 버튼은 필수 — 스크린리더가 행동을 읽을 수 있어야 한다. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
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
  // 진행 중에도 눌린 것처럼 보이면 안 되므로 두 상태를 함께 잠근다.
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
      style={({ pressed }) => [
        {
          flexDirection: iconRight ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          alignSelf: full ? 'stretch' : 'flex-start',
          backgroundColor: kind === 'primary' && pressed && !blocked ? T.bluePressed : c.bg,
          borderWidth: c.border ? 1 : 0,
          borderColor: c.border,
          paddingVertical: s.pv,
          paddingHorizontal: s.ph,
          borderRadius: s.r,
          // 비활성은 색만이 아니라 접근성 state 로도 전달된다(색만으로 상태를 알리지 않는다).
          opacity: disabled ? 0.4 : pressed && kind !== 'primary' ? 0.85 : 1,
        },
        style,
      ]}
    >
      {iconEl}
      {/* 라벨은 자리를 유지한 채 투명해지고, spinner 가 그 위에 겹친다 → 너비 불변 */}
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

// ── 칩 ────────────────────────────────────────────────────────
export function Chip({ children, active, tone, onPress }: { children: ReactNode; active?: boolean; tone?: 'blue'; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      hitSlop={6}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: active ? T.ink : tone === 'blue' ? T.blueTint : T.surface, borderWidth: active ? 0 : 1, borderColor: T.line }}
    >
      <Text style={{ fontSize: 16, fontWeight: '600', color: active ? T.onColor : tone === 'blue' ? T.blue : T.sub }}>{children}</Text>
    </Pressable>
  );
}

/**
 * 조건 줄의 필터 버튼 — 프로토타입 `.condition-filter`.
 *
 * ⚠ 앱에서 **기간·유형을 고르는 입구는 이것 하나**다(0096). 식재료 내역 5개 화면이
 *   이미 이 모양을 쓰는데 매출 분석만 칩 여섯 개를 따로 뒀다. 같은 일을 하는 길이
 *   둘이면 사장님은 둘 다 안 믿는다 — 실제로 "이해가 안 된다"가 여기서 나왔다.
 */
export function FilterButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} 변경`}
      hitSlop={6}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, borderColor: T.line, backgroundColor: T.surface }}
    >
      <Text style={{ fontSize: 13, fontWeight: '700', color: T.sub }} numberOfLines={1}>{label}</Text>
      <Icon name="chevronDown" size={14} color={T.ter} />
    </Pressable>
  );
}

// ── 스테퍼 ────────────────────────────────────────────────────
export function Stepper({ value, unit, onChange, label }: { value: number; unit?: string; onChange?: (v: number) => void; label?: string }) {
  // 34×34 버튼이라 hitSlop 5 를 더해 최소 44×44 터치 영역을 채운다(가이드 §9.6-1·2).
  // 아이콘만 있으므로 무엇이 늘고 주는지 라벨로 알린다.
  const btn = (ic: IconName, delta: number, action: string) => (
    <Pressable
      onPress={() => onChange?.(value + delta)}
      accessibilityRole="button"
      accessibilityLabel={label ? `${label} ${action}` : action}
      hitSlop={5}
      style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: T.line2, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={ic} size={18} color={T.sub} sw={2.2} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityRole="adjustable" accessibilityValue={{ now: value, text: `${value}${unit ?? ''}` }}>
      {btn('minus', -1, '줄이기')}
      <View style={{ minWidth: 56, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}>
        <Text style={[{ fontSize: 18, fontWeight: '800', color: T.ink }, NUM]}>{value}</Text>
        {unit ? <Text style={{ fontSize: 16, fontWeight: '600', color: T.sub2, marginLeft: 1 }}>{unit}</Text> : null}
      </View>
      {btn('plus', 1, '늘리기')}
    </View>
  );
}

// ── FAB ───────────────────────────────────────────────────────
export function FAB({ label = '추가', icon = 'plus', bottom = 24, onPress }: { label?: string; icon?: IconName; bottom?: number; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ position: 'absolute', right: 18, bottom, zIndex: 30, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.blue, paddingVertical: 14, paddingLeft: 15, paddingRight: 18, borderRadius: 999, shadowColor: T.blue, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 20, elevation: 6 }}
    >
      <Icon name={icon} size={22} color={T.onColor} sw={2.4} />
      <Text style={{ color: T.onColor, fontWeight: '700', fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

// ── 폼 필드 ───────────────────────────────────────────────────
/**
 * Field — 라벨 + 입력 + 안내/오류. 오류 메시지는 **필드 가까이** 둔다(가이드 §9.10-7).
 * `error` 가 있으면 hint 대신 오류를 보여준다. 둘을 동시에 띄우면 무엇을 고쳐야 하는지 흐려진다.
 * 오류는 색뿐 아니라 텍스트로도 전달된다(§9.12-3) — 색각 이상에서도 읽혀야 한다.
 */
export function Field({ label, children, hint, req, right, error }: { label: string; children: ReactNode; hint?: string; req?: boolean; right?: ReactNode; error?: string }) {
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
      {error ? (
        <Text accessibilityRole="alert" style={{ fontSize: 16, color: T.red, marginTop: 6, lineHeight: 20, fontWeight: '600' }}>{error}</Text>
      ) : hint ? (
        <Text style={{ fontSize: 16, color: T.ter, marginTop: 6, lineHeight: 17 }}>{hint}</Text>
      ) : null}
    </View>
  );
}

// `mono` prop 유지(호출부 호환)하되 tabular-nums는 적용하지 않음.
// Pretendard 미번들 환경에서 tabular-nums가 숫자를 작고 얇은 대체 글꼴로 렌더 → 한글 라벨과 크기·굵기 불일치.
// 입력칸은 값이 하나뿐이라 자릿수 정렬이 필요 없으므로 한글과 동일 글꼴로 렌더한다.
export function Input({
  value, placeholder, suffix, prefix, mono: _mono, right, onChangeText, keyboardType,
  error = false, disabled = false, accessibilityLabel, onBlur, onFocus, maxLength, returnKeyType, onSubmitEditing,
}: {
  value?: string;
  placeholder?: string;
  suffix?: string;
  prefix?: string;
  mono?: boolean;
  right?: ReactNode;
  onChangeText?: (t: string) => void;
  keyboardType?: KeyboardTypeOptions;
  /** 검증 실패 상태. 테두리를 붉게 바꾼다. 메시지는 Field 의 `error` 로 함께 전달할 것. */
  error?: boolean;
  /** 입력 불가. 편집이 차단되고 접근성 state 로도 전달된다. */
  disabled?: boolean;
  /** 라벨이 시각적으로만 붙어 있을 때 스크린리더가 읽을 이름. */
  accessibilityLabel?: string;
  onBlur?: () => void;
  onFocus?: () => void;
  maxLength?: number;
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
}) {
  const empty = value == null || value === '';
  const [focused, setFocused] = useState(false);
  // 상태 우선순위: 오류 > 포커스 > 기본. 오류를 포커스가 가리면 사용자가 원인을 못 찾는다.
  const borderColor = error ? T.red : focused ? T.blue : T.line;
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: disabled ? T.surface2 : T.surface,
        borderWidth: error || focused ? 1.5 : 1,
        borderColor,
        borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14,
      }}
    >
      {prefix ? <Text style={{ fontSize: 16, color: T.ter, fontWeight: '600' }}>{prefix}</Text> : null}
      {onChangeText ? (
        <TextInput
          style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: '600', color: disabled ? T.ter : T.ink, padding: 0 }}
          value={value}
          placeholder={placeholder}
          placeholderTextColor={T.ter}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          editable={!disabled}
          maxLength={maxLength}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ disabled }}
          onFocus={() => { setFocused(true); onFocus?.(); }}
          onBlur={() => { setFocused(false); onBlur?.(); }}
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

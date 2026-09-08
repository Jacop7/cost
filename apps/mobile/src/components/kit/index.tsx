/**
 * 공통 UI 킷 — kit.jsx 를 React Native 로 이식 (B0-3).
 * 웹 전용 속성은 RN 등가로 변환: whiteSpace→numberOfLines, boxShadow→cardShadow,
 * backdropFilter blur→반투명 배경, fontVariantNumeric→fontVariant.
 */
import { ReactNode, useState } from 'react';
import { KeyboardTypeOptions, Pressable, ScrollView, StyleProp, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from './Icon';
import { COLOR, COMPONENT, FONT, shadow as SHADOW, STATUS, T, won, TYPE, controlVisualHeight, radius, space } from '@/theme/tokens';

const NUM: TextStyle = { fontVariant: FONT.num as unknown as TextStyle['fontVariant'] };
export { Icon };
export { ActionSheet } from './ActionSheet';
export type { ActionSheetItem } from './ActionSheet';
export { Button } from './Button';
export { Txt } from './Txt';
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

// ── 상태 뱃지 ─────────────────────────────────────────────────
export function StatusBadge({ status, sm }: { status: keyof typeof STATUS; sm?: boolean }) {
  const s = STATUS[status];
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: s.bg, ...COMPONENT.badge[sm ? 'small' : 'regular'], borderRadius: COMPONENT.badge.borderRadius }}>
      <Text style={{ ...COMPONENT.badge.text, color: s.fg }}>{s.label}</Text>
    </View>
  );
}

type Tone = 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'ghost';
// solid는 기존 호출 호환용. 모든 뱃지는 공통의 옅은 배경 + 진한 글자 표현을 따른다.
export function Badge({ children, tone = 'neutral', sm }: { children: ReactNode; tone?: Tone; sm?: boolean; solid?: boolean }) {
  const tones: Record<Tone, { bg: string; fg: string; border?: string }> = {
    neutral: { bg: T.line2, fg: T.sub2 },
    blue: { bg: COLOR.action.primaryTint, fg: COLOR.action.onTint },
    green: { bg: COLOR.status.positiveTint, fg: COLOR.status.positive },
    amber: { bg: COLOR.status.cautionTint, fg: COLOR.status.caution },
    red: { bg: COLOR.status.negativeTint, fg: COLOR.status.negative },
    ghost: { bg: 'transparent', fg: COLOR.text.tertiary, border: T.line },
  };
  const c = tones[tone];
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: c.bg, borderWidth: c.border ? 1 : 0, borderColor: c.border, ...COMPONENT.badge[sm ? 'small' : 'regular'], borderRadius: COMPONENT.badge.borderRadius }}>
      <Text style={{ ...COMPONENT.badge.text, color: c.fg }}>{children}</Text>
    </View>
  );
}

// ── 카드 ──────────────────────────────────────────────────────
export function Card({ children, style, pad = 16, onLine, shadow = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; pad?: number; onLine?: boolean; shadow?: boolean }) {
  return (
    <View style={[{ backgroundColor: T.surface, borderRadius: 16, padding: pad, borderWidth: onLine ? 1 : 0, borderColor: T.line }, shadow ? SHADOW.card : null, style]}>
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
    <View style={[{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: COLOR.action.primaryTint, borderWidth: 1, borderColor: COLOR.action.onTint, borderRadius: 12, paddingVertical: 12, paddingHorizontal: space.md }, style]}>
      {/* 아이콘은 첫 줄 중앙에 맞춘다 — 여러 줄 문구에서 위로 뜨지 않게 */}
      <View style={{ marginTop: 1 }}><Icon name="info" size={17} color={COLOR.action.onTint} /></View>
      <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: COLOR.action.onTint, lineHeight: TYPE.caption.lineHeight }}>{children}</Text>
    </View>
  );
}

// ── 버튼 ──────────────────────────────────────────────────────
// ── 칩 ────────────────────────────────────────────────────────
export function Chip({ children, active, tone, onPress }: { children: ReactNode; active?: boolean; tone?: 'blue'; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      hitSlop={{ top: 9, bottom: 9, left: 0, right: 0 }}
      style={{ minHeight: COMPONENT.chip.visualHeight, flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: space.sm, paddingHorizontal: 12, borderRadius: 999, backgroundColor: active ? T.ink : tone === 'blue' ? COLOR.action.primaryTint : T.surface, borderWidth: active ? 0 : 1, borderColor: T.line }}
    >
      <Text style={{ fontSize: 16, fontWeight: '600', color: active ? T.onColor : tone === 'blue' ? COLOR.text.accent : T.sub }}>{children}</Text>
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
export { FilterButton } from './FilterChip';

// ── 스테퍼 ────────────────────────────────────────────────────
export function Stepper({ value, unit, onChange, label }: { value: number; unit?: string; onChange?: (v: number) => void; label?: string }) {
  // 32×32 버튼이라 hitSlop 6 을 더해 최소 44×44 터치 영역을 채운다(가이드 §9.6-1·2).
  // 아이콘만 있으므로 무엇이 늘고 주는지 라벨로 알린다.
  const btn = (ic: IconName, delta: number, action: string) => (
    <Pressable
      onPress={() => onChange?.(value + delta)}
      accessibilityRole="button"
      accessibilityLabel={label ? `${label} ${action}` : action}
      hitSlop={6}
      style={{ width: controlVisualHeight.sm, height: controlVisualHeight.sm, borderRadius: radius.md, backgroundColor: T.line2, alignItems: 'center', justifyContent: 'center' }}
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
      style={{ position: 'absolute', right: 18, bottom, minHeight: COMPONENT.fab.visualHeight, zIndex: 30, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: COLOR.action.primary, paddingVertical: space.md, paddingLeft: space.md, paddingRight: space.lg, borderRadius: 999, ...SHADOW.fab }}
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
export function Field({ label, children, hint, req, right, error, variant }: { label: string; children: ReactNode; hint?: string; req?: boolean; right?: ReactNode; error?: string; variant?: 'stacked' }) {
  return (
    <View style={{ marginBottom: variant ? COMPONENT.stackedForm.fieldGap : space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, marginBottom: variant ? COMPONENT.stackedForm.labelGap : 8, marginHorizontal: variant ? COMPONENT.stackedForm.labelInset : 0 }}>
        <Text style={{ flexShrink: 1, fontSize: 16, fontWeight: '700', color: T.sub, ...(variant ? COMPONENT.stackedForm.label : {}) }}>
          {label}
          {req ? <Text style={{ color: COLOR.text.required }}> *</Text> : null}
        </Text>
        {right}
      </View>
      {children}
      {error ? (
        <Text accessibilityRole="alert" style={{ fontSize: 16, color: COLOR.status.negative, marginTop: space.sm, lineHeight: TYPE.body.lineHeight, fontWeight: '600' }}>{error}</Text>
      ) : hint ? (
        <Text style={{ fontSize: 16, color: COLOR.text.tertiary, marginTop: space.sm, lineHeight: TYPE.body.lineHeight }}>{hint}</Text>
      ) : null}
    </View>
  );
}

// `mono` prop 유지(호출부 호환)하되 tabular-nums는 적용하지 않음.
// Pretendard 미번들 환경에서 tabular-nums가 숫자를 작고 얇은 대체 글꼴로 렌더 → 한글 라벨과 크기·굵기 불일치.
// 입력칸은 값이 하나뿐이라 자릿수 정렬이 필요 없으므로 한글과 동일 글꼴로 렌더한다.
export function Input({
  value, placeholder, suffix, prefix, mono: _mono, right, onChangeText, keyboardType,
  error = false, disabled = false, tone = 'default', accessibilityLabel, onBlur, onFocus, maxLength, returnKeyType, onSubmitEditing, variant,
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
  /** 오류와 다른 의미 강조. 재고 증가·감소처럼 입력 역할 자체가 색을 소유할 때만 사용한다. */
  tone?: 'default' | 'accent' | 'danger';
  /** 라벨이 시각적으로만 붙어 있을 때 스크린리더가 읽을 이름. */
  accessibilityLabel?: string;
  onBlur?: () => void;
  onFocus?: () => void;
  maxLength?: number;
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
  variant?: 'stacked';
}) {
  const empty = value == null || value === '';
  const [focused, setFocused] = useState(false);
  // 상태 우선순위: 오류 > 포커스 > 기본. 오류를 포커스가 가리면 사용자가 원인을 못 찾는다.
  const borderColor = error
    ? COLOR.status.negative
    : focused
      ? COLOR.action.primary
      : COMPONENT.input.border[tone];
  const emphasized = error || focused || tone !== 'default';
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: COMPONENT.input.gap,
        backgroundColor: disabled ? T.surface2 : T.surface,
        borderWidth: emphasized ? COMPONENT.input.activeBorderWidth : COMPONENT.input.borderWidth,
        borderColor,
        borderRadius: COMPONENT.input.radius,
        paddingVertical: COMPONENT.input.paddingVertical,
        paddingHorizontal: COMPONENT.input.paddingHorizontal,
        ...(variant ? { minHeight: COMPONENT.stackedForm.controlMinHeight, paddingHorizontal: COMPONENT.stackedForm.controlPaddingHorizontal } : {}),
      }}
    >
      {prefix ? <Text style={{ fontSize: COMPONENT.input.textSize, color: COLOR.text.tertiary, fontWeight: COMPONENT.input.textWeight }}>{prefix}</Text> : null}
      {onChangeText ? (
        <TextInput
          style={{ flex: 1, minWidth: 0, fontSize: COMPONENT.input.textSize, fontWeight: COMPONENT.input.textWeight, color: disabled ? COLOR.text.disabled : T.ink, padding: 0, ...(variant ? { ...COMPONENT.stackedForm.value, textAlign: _mono ? 'right' as const : 'left' as const } : {}) }}
          value={value}
          placeholder={placeholder}
          placeholderTextColor={COLOR.text.tertiary}
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
        <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: COMPONENT.input.textSize, fontWeight: COMPONENT.input.textWeight, color: empty ? COLOR.text.tertiary : T.ink }}>{empty ? placeholder : value}</Text>
      )}
      {suffix ? <Text style={{ fontSize: COMPONENT.input.textSize, color: T.sub2, fontWeight: COMPONENT.input.textWeight, flexShrink: 0 }}>{suffix}</Text> : null}
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

/**
 * 탭 루트 화면의 큰 제목 헤더.
 *
 * 프로토타입의 `.header.is-main` 계약을 한 곳에서 소유한다. 상세 화면용 `AppHeader`와는
 * 역할이 다르며, 검색 입력처럼 헤더 아래에 붙는 내용은 `below` 슬롯으로 전달한다.
 */
export function HubHeader({
  title,
  subtitle,
  actions,
  below,
  testID,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  below?: ReactNode;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const hasActions = actions != null;
  const token = COMPONENT.hubHeader;

  return (
    <View
      testID={testID}
      style={{
        paddingTop: insets.top,
        minHeight: subtitle ? insets.top + token.subtitleMinHeight : undefined,
        backgroundColor: T.bg,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: subtitle ? 'flex-start' : 'center',
          paddingLeft: token.paddingLeft,
          paddingRight: hasActions ? token.paddingRight : token.paddingRightWithoutActions,
          paddingTop: token.paddingTop,
          paddingBottom: token.paddingBottom,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontSize: TYPE.display.fontSize,
              fontWeight: TYPE.display.fontWeight,
              lineHeight: TYPE.display.lineHeight,
              letterSpacing: TYPE.display.letterSpacing,
              color: T.ink,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{
                marginTop: token.subtitleGap,
                fontSize: TYPE.caption.fontSize,
                fontWeight: TYPE.caption.fontWeight,
                lineHeight: TYPE.caption.lineHeight,
                color: T.sub2,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {actions}
      </View>
      {below}
    </View>
  );
}

/** 메인 헤더의 40dp 시각 아이콘과 44dp 실제 누름 상자를 함께 소유한다. */
export function HubHeaderAction({
  label,
  icon,
  onPress,
  selected,
  dot = false,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  selected?: boolean;
  dot?: boolean;
}) {
  const token = COMPONENT.hubHeader;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      style={{ width: COMPONENT.hubHeader.actionTouchSize, height: COMPONENT.hubHeader.actionTouchSize, alignItems: 'center', justifyContent: 'center' }}
    >
      <View style={{ width: token.actionVisualSize, height: token.actionVisualSize, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={token.actionIconSize} color={selected ? COLOR.action.primary : T.ink2} />
        {dot ? (
          <View
            style={{
              position: 'absolute',
              top: token.notificationDot.top,
              right: token.notificationDot.right,
              width: token.notificationDot.size,
              height: token.notificationDot.size,
              borderRadius: radius.full,
              backgroundColor: COLOR.status.negative,
              borderWidth: token.notificationDot.borderWidth,
              borderColor: T.surface,
            }}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

export function Select({ value, placeholder, onPress, accessibilityLabel, expanded, variant }: {
  value?: string; placeholder?: string; onPress?: () => void;
  accessibilityLabel?: string; expanded?: boolean;
  variant?: 'stacked';
}) {
  const empty = value == null || value === '';
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (empty ? placeholder : value)}
      accessibilityState={{ expanded }} aria-expanded={expanded}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingVertical: space.md, paddingHorizontal: variant ? COMPONENT.stackedForm.controlPaddingHorizontal : space.md, minHeight: variant ? COMPONENT.stackedForm.controlMinHeight : undefined }}>
      <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: empty ? COLOR.text.tertiary : T.ink, ...(variant && !empty ? COMPONENT.stackedForm.value : {}) }}>{empty ? placeholder : value}</Text>
      <Icon name="chevronDown" size={18} color={COLOR.text.tertiary} />
    </Pressable>
  );
}

// ── 손익표 행 ─────────────────────────────────────────────────
export function PLRow({ label, amt, pct, kind = 'cost', detail, bold }: { label: string; amt: number; pct: number | string; kind?: 'sales' | 'cost' | 'profit'; detail?: string; bold?: boolean }) {
  const sign = kind === 'cost' ? '−' : '';
  const valColor = kind === 'profit' ? COLOR.status.positive : kind === 'cost' ? COLOR.text.tertiary : T.ink;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: bold ? 15.5 : 14.5, fontWeight: bold ? '800' : '600', color: kind === 'profit' ? COLOR.status.positive : T.ink2 }}>{label}</Text>
        {detail ? <Text style={{ fontSize: 13, color: COLOR.text.tertiary, marginTop: space.xs, lineHeight: TYPE.captionSm.lineHeight }}>{detail}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end', minWidth: 96 }}>
        <Text style={[{ fontSize: bold ? 17 : 15, fontWeight: bold ? '800' : '700', color: valColor }, NUM]}>
          {sign}
          {won(amt)}
          <Text style={{ fontSize: 16, fontWeight: '600' }}>원</Text>
        </Text>
        <Text style={[{ fontSize: 16, fontWeight: '600', color: COLOR.text.tertiary }, NUM]}>{pct}%</Text>
      </View>
    </View>
  );
}

// ── 세그먼트 탭 (후보/대기/완료) ───────────────────────────────
export function SegTabs({ tabs, active = 0, onChange }: { tabs: { label: string; count?: number }[]; active?: number; onChange?: (i: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.sm, padding: space.xs, backgroundColor: T.line, borderRadius: radius.md }}>
      {tabs.map((t, i) => {
        const on = active === i;
        return (
          <Pressable key={i} onPress={() => onChange?.(i)} style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.xs, paddingVertical: space.sm, borderRadius: radius.md, backgroundColor: on ? T.surface : 'transparent' }, on ? SHADOW.card : null]}>
            <Text style={{ fontSize: 16, fontWeight: on ? '700' : '600', color: on ? T.ink : COLOR.text.tertiary }}>{t.label}</Text>
            {t.count != null ? <Text style={{ fontSize: 16, fontWeight: '700', color: on ? COLOR.state.selectedText : COLOR.text.tertiary }}>{t.count}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ── 카테고리 스크롤 탭 (밑줄형) ────────────────────────────────
export function ScrollTabs({ tabs, active = 0, onChange, activeColors, counts }: {
  tabs: string[];
  active?: number;
  onChange?: (i: number) => void;
  /** 폐기처럼 이미 정해진 의미 색만 전달한다. 미지정 탭은 기존 ink를 유지한다. */
  activeColors?: readonly (string | undefined)[];
  /** 전체 목록 건수. 검색 결과 건수와 구분하며 0도 표시한다. */
  counts?: readonly (number | undefined)[];
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.lg, paddingHorizontal: 20 }}>
      {tabs.map((t, i) => {
        const on = i === active;
        const activeColor = activeColors?.[i] ?? T.ink;
        const count = counts?.[i];
        return (
          <Pressable key={i} onPress={() => onChange?.(i)} accessibilityRole="tab" accessibilityLabel={count == null ? t : `${t} ${count}건`} accessibilityState={{ selected: on }} aria-selected={on} style={{ paddingBottom: space.md }}>
            <Text style={{ fontSize: 16, fontWeight: on ? '700' : '600', color: on ? activeColor : COLOR.text.tertiary }}>{t}{count == null ? null : <> <Text style={{ color: on ? COLOR.state.selectedText : COLOR.text.tertiary, fontVariant: ['tabular-nums'] }}>{count}</Text></>}</Text>
            {on ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2.5, backgroundColor: activeColor, borderRadius: radius.full }} /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ── 기간 칩 (최근 3개월 ▾) ─────────────────────────────────────
export function PeriodChip({ value = '최근 3개월', onPress }: { value?: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs, paddingLeft: space.md, paddingRight: space.sm, borderRadius: 999, backgroundColor: T.line2 }}>
      <Text style={{ color: T.sub, fontSize: 16, fontWeight: '700' }}>{value}</Text>
      <Icon name="chevronDown" size={14} color={COLOR.text.tertiary} />
    </Pressable>
  );
}

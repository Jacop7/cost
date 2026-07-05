/**
 * 앱 폰트 — 전 플랫폼 고정 + 로케일별 스크립트 폴백 (글로벌 대응).
 * 시스템 폰트 의존 제거: iOS·Android·웹이 동일하게 렌더되고, 숫자·한글 크기 불일치도 사라짐.
 *
 * 매핑
 *   기본(한글·라틴·유럽어·베트남어) → Pretendard  (디자인 원천, Toss/Cashnote 감성)
 *   일본어(ja)                      → Noto Sans JP
 *   아랍어(ar)                      → Noto Sans Arabic (+ RTL)
 *
 * 굵기 처리: RN 커스텀 폰트는 안드로이드에서 fontWeight 자동 매칭이 불안정하므로
 * 굵기별 family 를 각각 로드하고, 렌더 시 fontWeight → face 로 해석해 주입한다(patchTextFonts).
 */
import { cloneElement } from 'react';
import { I18nManager, StyleSheet, Text as RNText, TextInput as RNTextInput } from 'react-native';
import { NotoSansJP_400Regular, NotoSansJP_700Bold } from '@expo-google-fonts/noto-sans-jp';
import { NotoSansArabic_400Regular, NotoSansArabic_700Bold } from '@expo-google-fonts/noto-sans-arabic';
import PretendardRegular from '../../assets/fonts/Pretendard-Regular.otf';
import PretendardMedium from '../../assets/fonts/Pretendard-Medium.otf';
import PretendardSemiBold from '../../assets/fonts/Pretendard-SemiBold.otf';
import PretendardBold from '../../assets/fonts/Pretendard-Bold.otf';
import PretendardExtraBold from '../../assets/fonts/Pretendard-ExtraBold.otf';

export type AppLocale = 'ko' | 'en' | 'de' | 'es' | 'pt' | 'vi' | 'ja' | 'ar';
type ScriptFamily = 'Pretendard' | 'NotoSansJP' | 'NotoSansArabic';

/** 글꼴군별 family→asset 맵. key 가 곧 fontFamily 이름이 된다. */
const PRETENDARD_ASSETS: Record<string, number> = {
  'Pretendard-Regular': PretendardRegular,
  'Pretendard-Medium': PretendardMedium,
  'Pretendard-SemiBold': PretendardSemiBold,
  'Pretendard-Bold': PretendardBold,
  'Pretendard-ExtraBold': PretendardExtraBold,
};
const SCRIPT_ASSETS: Record<ScriptFamily, Record<string, number>> = {
  Pretendard: PRETENDARD_ASSETS,
  NotoSansJP: { 'NotoSansJP-Regular': NotoSansJP_400Regular, 'NotoSansJP-Bold': NotoSansJP_700Bold },
  NotoSansArabic: { 'NotoSansArabic-Regular': NotoSansArabic_400Regular, 'NotoSansArabic-Bold': NotoSansArabic_700Bold },
};

/**
 * 현재 로케일에 필요한 폰트만 useFonts 로 등록(시작 속도).
 * Pretendard 는 항상(라틴·한글 폴백), 스크립트가 다르면 해당 Noto 를 추가.
 * 로케일 전환은 재시작 수준 작업이라 시작 시 확정한 값 기준으로 로드한다.
 */
export function getFontAssets(locale: AppLocale = _locale): Record<string, number> {
  const script = SCRIPT_BY_LOCALE[locale] ?? 'Pretendard';
  return script === 'Pretendard'
    ? PRETENDARD_ASSETS
    : { ...PRETENDARD_ASSETS, ...SCRIPT_ASSETS[script] };
}

/** 로케일 → 스크립트 글꼴군. 미정의 로케일은 Pretendard(라틴·한글 커버). */
const SCRIPT_BY_LOCALE: Record<string, ScriptFamily> = {
  ko: 'Pretendard', en: 'Pretendard', de: 'Pretendard', es: 'Pretendard', pt: 'Pretendard', vi: 'Pretendard',
  ja: 'NotoSansJP',
  ar: 'NotoSansArabic',
};

/** 글꼴군이 실제 로드한 굵기 face(숫자 weight → family 이름). */
const FACES: Record<ScriptFamily, Record<number, string>> = {
  Pretendard: { 400: 'Pretendard-Regular', 500: 'Pretendard-Medium', 600: 'Pretendard-SemiBold', 700: 'Pretendard-Bold', 800: 'Pretendard-ExtraBold' },
  NotoSansJP: { 400: 'NotoSansJP-Regular', 700: 'NotoSansJP-Bold' },
  NotoSansArabic: { 400: 'NotoSansArabic-Regular', 700: 'NotoSansArabic-Bold' },
};

/** RTL(오른쪽→왼쪽) 로케일. */
export const RTL_LOCALES = new Set<AppLocale>(['ar']);

// ── 현재 앱 로케일(폰트/방향 기준) ──────────────────────────────
// TODO(i18n): 실제 i18n 로케일 상태와 연결. 현재 콘텐츠가 한국어라 'ko' 고정.
// 방향(RTL) 전환은 네이티브 재시작이 필요하므로 로케일은 시작 시 1회 확정하는 값으로 다룬다.
let _locale: AppLocale = 'ko';
export const getAppLocale = (): AppLocale => _locale;
export const setAppLocale = (l: AppLocale): void => { _locale = l; };

/** fontWeight 스타일값 → 숫자 정규화. */
function normalizeWeight(w: unknown): number {
  if (typeof w === 'number') return w;
  if (w === 'bold') return 700;
  if (w == null || w === 'normal') return 400;
  const n = parseInt(String(w), 10);
  return Number.isFinite(n) ? n : 400;
}

/** 글꼴군의 로드된 face 중 요청 굵기에 가장 가까운 것(동률이면 더 굵은 쪽). */
function pickFace(faces: Record<number, string>, weight: number): string {
  const exact = faces[weight];
  if (exact) return exact;
  const keys = Object.keys(faces).map(Number);
  let best = keys[0] ?? 400;
  let bestDiff = Infinity;
  for (const k of keys) {
    const d = Math.abs(k - weight);
    if (d < bestDiff || (d === bestDiff && k > best)) { best = k; bestDiff = d; }
  }
  return faces[best] ?? 'Pretendard-Regular';
}

/** 현재(또는 지정) 로케일·굵기에 맞는 fontFamily 이름. */
export function resolveFontFamily(weight: unknown, locale: AppLocale = _locale): string {
  const script = SCRIPT_BY_LOCALE[locale] ?? 'Pretendard';
  return pickFace(FACES[script], normalizeWeight(weight));
}

/** 로케일 방향 확정(아랍어 등 RTL). 앱 시작 시 1회. 전환은 재시작 후 반영. */
export function initTextDirection(locale: AppLocale = _locale): void {
  const rtl = RTL_LOCALES.has(locale);
  I18nManager.allowRTL(rtl);
  if (I18nManager.isRTL !== rtl) I18nManager.forceRTL(rtl);
}

// ── 전역 적용: Text/TextInput 렌더 인터셉트 ─────────────────────
// 화면 수백 곳을 수정하지 않고, 렌더된 모든 Text 의 fontWeight·현재 로케일을 읽어
// 알맞은 fontFamily 를 주입한다. (React 19 removes defaultProps → render 패치가 확실한 전역 수단)
//
// ⚠ Fast Refresh 안전: 원본 render 를 컴포넌트에 1회 보관하고, 재실행 시에도 "원본"만 다시 감싼다.
// (모듈 재평가 때 이미 감싼 render 를 또 감싸면 이중 래핑 → 새로 진입한 화면이 깨져 빈 화면이 됨)
type Patchable = { render?: (...a: unknown[]) => any; __fontOrigRender?: (...a: unknown[]) => any };
export function patchTextFonts(): void {
  for (const Comp of [RNText, RNTextInput] as unknown as Patchable[]) {
    const orig = Comp.__fontOrigRender ?? Comp.render;
    if (typeof orig !== 'function') continue;
    Comp.__fontOrigRender = orig;
    Comp.render = function patchedRender(...args: unknown[]) {
      const el = orig.apply(this, args);
      try {
        if (!el || !el.props) return el;
        const flat = StyleSheet.flatten(el.props.style) || {};
        const fontFamily = resolveFontFamily((flat as { fontWeight?: unknown }).fontWeight);
        // ⚠ 반드시 flatten 으로 "단일 객체" 를 넘긴다. 배열([{...}, style])을 그대로 넘기면
        // react-native-web 에서 DOM <span> style 로 배열이 전달돼 react-dom 이 터진다
        // (Failed to set indexed property [0] on CSSStyleDeclaration). 네이티브는 배열도 OK지만 웹 호환 위해 객체로.
        return cloneElement(el, { style: StyleSheet.flatten([{ fontFamily }, el.props.style]) });
      } catch {
        return el; // 폰트 주입 실패 시 원본 그대로 — 절대 화면을 깨지 않음.
      }
    };
  }
}

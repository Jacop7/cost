/**
 * 로케일 숫자 서식 (표기 규칙) — 통화 · 자릿수 구분자 · 소수점 · 자릿수.
 *
 * ⚠ 표기 계층 전용. 저장은 항상 최소단위(g/ml/개)·풀정밀도이고, 확정값은 packages/db RPC 가 권위다.
 *   서식은 계산 "결과를 보여줄 때"만 적용하며, 어떤 경우에도 계산 입력으로 되돌아가지 않는다.
 *
 * 축 분리 — 무엇을 누가 정하는가
 *   로케일이 정한다(사실, 선택 대상 아님) : 자릿수 구분자 · 소수점 문자 · 통화기호 · 금액 소수 자릿수
 *   사용자가 정한다(취향)                 : 단가 소수 자릿수 — 단위 설정(MY-04). 기본값은 여기서 파생.
 *   같은 미터법 안에서도 서식이 갈리므로(독일 1.250,50 / 멕시코 1,250.50) 단위 시스템과는 독립 축이다.
 *
 * Intl.NumberFormat 을 쓰지 않는 이유: Hermes(안드로이드)의 Intl 은 플랫폼 ICU 에 의존해 기기마다
 * 결과가 달라질 수 있다. 원가·손익 숫자는 기기와 무관하게 같아야 하므로 테이블로 고정한다.
 */

/** 지역까지 분화된 서식 키 (언어 8 · 지역 분화 2 = 10). */
export type LocaleKey =
  | 'ko' | 'en-US' | 'ja' | 'de' | 'ar-SA' | 'ar-AE' | 'vi' | 'es-ES' | 'es-MX' | 'pt-BR';

/** 스크립트·폰트 판정용 언어 코드 (apps/mobile theme/fonts.ts 의 AppLocale 과 동일 집합). */
export type LocaleLang = 'ko' | 'en' | 'ja' | 'de' | 'ar' | 'vi' | 'es' | 'pt';

export interface LocaleFormat {
  key: LocaleKey;
  lang: LocaleLang;
  /** 설정 화면 표기 (한국어). */
  label: string;
  /** 해당 언어 표기 — 언어 목록에서 자기 언어로 보이도록. */
  native: string;
  /** 통화 ISO 코드 · 이름 · 기호. */
  currency: string;
  currencyName: string;
  symbol: string;
  /** 기호 위치 — 'pre' = $1,250.50 · 'post' = 1.250,50 € */
  symbolPos: 'pre' | 'post';
  /** 후치 기호 앞 공백 (유럽식 € 표기). */
  symbolSpace: boolean;
  /** 자릿수 구분자 · 소수점 문자. 둘은 항상 서로 다르다. */
  group: string;
  decimal: string;
  /** 금액 소수 자릿수 = 통화 최소단위. 원·엔·동 = 0, 그 외 = 2. */
  moneyDigits: number;
  /** 오른쪽에서 왼쪽으로 쓰는 표기. */
  rtl: boolean;
}

// 아랍어 문자열은 테이블 밖 상수로 뺀다 — RTL 문자를 표 안에 섞으면 에디터에서 그 행의 앞뒤가 뒤집혀 보여
// 정렬이 깨지고 diff 를 읽기 어렵다. 값 자체는 그대로다.
const AR_SA = 'العربية (السعودية)'; // 아랍어 (사우디아라비아)
const AR_AE = 'العربية (الإمارات)'; // 아랍어 (UAE)
const SYM_SAR = 'ر.س'; // 리얄 기호
const SYM_AED = 'د.إ'; // 디르함 기호

/**
 * 서식 테이블. 금액 자릿수는 통화가, 구분자는 지역이 정한다.
 * 단가 자릿수는 여기 두지 않는다 — moneyDigits + 2 로 파생되고 사용자가 덮어쓸 수 있다(unitPriceDigits).
 */
export const LOCALES: readonly LocaleFormat[] = [
  { key: 'ko',    lang: 'ko', label: '한국어',                   native: '한국어',             currency: 'KRW', currencyName: 'Won',    symbol: '원',    symbolPos: 'post', symbolSpace: false, group: ',', decimal: '.', moneyDigits: 0, rtl: false },
  { key: 'en-US', lang: 'en', label: '영어 (미국)',              native: 'English (US)',       currency: 'USD', currencyName: 'Dollar', symbol: '$',     symbolPos: 'pre',  symbolSpace: false, group: ',', decimal: '.', moneyDigits: 2, rtl: false },
  { key: 'ja',    lang: 'ja', label: '일본어',                   native: '日本語',              currency: 'JPY', currencyName: 'Yen',    symbol: '¥',     symbolPos: 'pre',  symbolSpace: false, group: ',', decimal: '.', moneyDigits: 0, rtl: false },
  { key: 'de',    lang: 'de', label: '독일어 (독일·오스트리아)', native: 'Deutsch',            currency: 'EUR', currencyName: 'Euro',   symbol: '€',     symbolPos: 'post', symbolSpace: true,  group: '.', decimal: ',', moneyDigits: 2, rtl: false },
  { key: 'ar-SA', lang: 'ar', label: '아랍어 (사우디아라비아)',  native: AR_SA,                currency: 'SAR', currencyName: 'Riyal',  symbol: SYM_SAR, symbolPos: 'post', symbolSpace: true,  group: ',', decimal: '.', moneyDigits: 2, rtl: true },
  { key: 'ar-AE', lang: 'ar', label: '아랍어 (UAE)',             native: AR_AE,                currency: 'AED', currencyName: 'Dirham', symbol: SYM_AED, symbolPos: 'post', symbolSpace: true,  group: ',', decimal: '.', moneyDigits: 2, rtl: true },
  { key: 'vi',    lang: 'vi', label: '베트남어',                 native: 'Tiếng Việt',         currency: 'VND', currencyName: 'Dong',   symbol: '₫',     symbolPos: 'post', symbolSpace: false, group: ',', decimal: '.', moneyDigits: 0, rtl: false },
  { key: 'es-ES', lang: 'es', label: '스페인어 (스페인)',        native: 'Español (España)',   currency: 'EUR', currencyName: 'Euro',   symbol: '€',     symbolPos: 'post', symbolSpace: true,  group: '.', decimal: ',', moneyDigits: 2, rtl: false },
  { key: 'es-MX', lang: 'es', label: '스페인어 (멕시코)',        native: 'Español (México)',   currency: 'MXN', currencyName: 'Peso',   symbol: '$',     symbolPos: 'pre',  symbolSpace: false, group: ',', decimal: '.', moneyDigits: 2, rtl: false },
  { key: 'pt-BR', lang: 'pt', label: '포르투갈어 (브라질)',      native: 'Português (Brasil)', currency: 'BRL', currencyName: 'Real',   symbol: 'R$',    symbolPos: 'pre',  symbolSpace: false, group: '.', decimal: ',', moneyDigits: 2, rtl: false },
] as const;

export const DEFAULT_LOCALE: LocaleKey = 'ko';

const BY_KEY: Record<string, LocaleFormat> = Object.fromEntries(LOCALES.map((l) => [l.key, l]));

/** 서식 조회. 미등록 키는 기본 로케일로 폴백 — 표기가 절대 깨지지 않게. */
export function getLocale(key: LocaleKey = DEFAULT_LOCALE): LocaleFormat {
  return BY_KEY[key] ?? BY_KEY[DEFAULT_LOCALE]!;
}

/**
 * 단가 소수 자릿수 기본값 = 금액 자릿수 + 2.
 * 단가는 최소단위(g/ml/개) 기준이라 금액보다 두 자리 잘다. 한국 4.71원/g(2자리) · 미국 $0.0047/g(4자리).
 * 사용자가 단위 설정에서 0~4 로 덮어쓸 수 있고, 그 값이 있으면 이 함수 대신 그 값을 쓴다.
 */
export function unitPriceDigits(key: LocaleKey = DEFAULT_LOCALE): number {
  return getLocale(key).moneyDigits + 2;
}

/** 선택 가능한 단가 자릿수 (단위 설정 UI). */
export const UNIT_PRICE_DIGIT_OPTIONS = [0, 1, 2, 3, 4] as const;

/**
 * 기본 표시 예시 — 언어·통화 설정에서 서식을 한눈에 보여주는 견본. 통화기호는 붙이지 않는다.
 * 소수를 쓰는 통화에만 .50 을 붙여 소수점 문자를 드러낸다. 0자리 통화(원·엔·동)에 1,250.5 를 넣으면
 * 1,251 로 반올림돼 견본 구실을 못 하므로 1,250 을 쓴다.
 * 검산: 한국 1,250 · 미국 1,250.50 · 독일 1.250,50
 */
export function localeSample(key: LocaleKey = DEFAULT_LOCALE): string {
  const L = getLocale(key);
  return formatNumber(L.moneyDigits > 0 ? 1250.5 : 1250, { digits: L.moneyDigits, group: L.group, decimal: L.decimal });
}

/**
 * 숫자 → 서식 문자열. 반올림 후 고정 자릿수로 채우고 세 자리마다 구분자를 넣는다.
 * 유한수가 아니면 0 으로 취급 — 표기 계층이 화면을 깨뜨리지 않게.
 */
export function formatNumber(value: number, opts: { digits: number; group: string; decimal: string }): string {
  const { digits, group, decimal } = opts;
  const v = Number.isFinite(value) ? value : 0;
  const neg = v < 0;
  const fixed = Math.abs(v).toFixed(digits); // 반올림 + 자릿수 채움
  const [intPart = '0', decPart = ''] = fixed.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return (neg ? '-' : '') + grouped + (decPart ? decimal + decPart : '');
}

/** 통화기호 부착 — 음수 부호는 항상 기호 바깥(-$1,250.50). */
function withSymbol(body: string, L: LocaleFormat, neg: boolean): string {
  const s = L.symbolPos === 'pre' ? L.symbol + body : body + (L.symbolSpace ? ' ' : '') + L.symbol;
  return (neg ? '-' : '') + s;
}

/** 금액 표기 — 판매가·매출·고정지출 등. 자릿수는 통화가 정한다(12,000원 · $1,250.50). */
export function formatMoney(value: number, key: LocaleKey = DEFAULT_LOCALE): string {
  const L = getLocale(key);
  const v = Number.isFinite(value) ? value : 0;
  return withSymbol(formatNumber(Math.abs(v), { digits: L.moneyDigits, group: L.group, decimal: L.decimal }), L, v < 0);
}

/**
 * 단가 표기 — 최소단위 기준(4.71원/g). digits 미지정 시 로케일 기본값(금액 + 2).
 * baseUnit 은 저장 최소단위 문자열(g·ml·개)을 그대로 붙인다.
 */
export function formatUnitPrice(
  value: number,
  baseUnit: string,
  key: LocaleKey = DEFAULT_LOCALE,
  digits: number = unitPriceDigits(key),
): string {
  const L = getLocale(key);
  const v = Number.isFinite(value) ? value : 0;
  return withSymbol(formatNumber(Math.abs(v), { digits, group: L.group, decimal: L.decimal }), L, v < 0) + '/' + baseUnit;
}

/**
 * 비율 표기 — 절사(내림). 4,014/12,000 = 33.45% → 33.4%.
 * ⚠ 반올림하면 33.5% 가 되어 검산 기준값 표기와 어긋난다. 자릿수 설정 대상이 아니다(1자리 고정).
 * 부동소수 오차 보정용 epsilon: 0.313 × 1000 = 312.9999… 가 312 로 내려가는 것을 막는다.
 */
export function formatPercent(ratio: number, key: LocaleKey = DEFAULT_LOCALE, digits = 1): string {
  const L = getLocale(key);
  const r = Number.isFinite(ratio) ? ratio : 0;
  const f = 10 ** digits;
  const v = Math.floor(Math.abs(r) * 100 * f + 1e-9) / f;
  return (r < 0 ? '-' : '') + formatNumber(v, { digits, group: L.group, decimal: L.decimal }) + '%';
}

/**
 * 서식 문자열 → 숫자. 사용자 입력 파싱용(독일 "1.250,50" → 1250.5).
 * 구분자를 먼저 제거한 뒤 소수점 문자를 '.' 로 통일한다 — 순서가 바뀌면 독일식에서 정수부가 뭉개진다.
 */
export function parseNumber(text: string, key: LocaleKey = DEFAULT_LOCALE): number {
  const L = getLocale(key);
  const cleaned = text
    .split(L.group).join('')
    .split(L.decimal).join('.')
    .replace(/[^\d.-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

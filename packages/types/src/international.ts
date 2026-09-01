/**
 * 한국 + 영어권 4개국 국제 출시 계약.
 *
 * 앱 언어는 인증 사용자 선호이고, 국가·업무 로케일·통화·가격 기준은 매장 시장 프로필이다.
 * 세율은 법·지역·상품에 따라 달라지므로 출시국 metadata에 넣지 않는다.
 */

export const LAUNCH_COUNTRY_CODES = ['KR', 'US', 'GB', 'AU', 'CA'] as const;
export type LaunchCountryCode = (typeof LAUNCH_COUNTRY_CODES)[number];
export const LAUNCH_CURRENCY_CODES = ['KRW', 'USD', 'GBP', 'AUD', 'CAD'] as const;
export type LaunchCurrencyCode = (typeof LAUNCH_CURRENCY_CODES)[number];
export const BUSINESS_LOCALE_CODES = ['ko-KR', 'en-US', 'en-GB', 'en-AU', 'en-CA'] as const;
export type BusinessLocaleCode = (typeof BUSINESS_LOCALE_CODES)[number];

/** 사용자별 UI 언어. 매장 국가·통화의 기본값으로 저장하지 않는다. */
export type AppLanguageCode = 'ko' | 'en';
/** 메뉴판 가격에 세금이 이미 들어 있는지 여부. */
export const TAX_PRICE_BASES = ['tax_inclusive', 'tax_exclusive'] as const;
export type TaxPriceBasis = (typeof TAX_PRICE_BASES)[number];
/** 일반 과세와 0% 과세는 신고 의미가 달라 금액이 0이어도 구분한다. */
export const TAX_TREATMENTS = ['taxable', 'zero_rated', 'exempt'] as const;
export type TaxTreatment = (typeof TAX_TREATMENTS)[number];
export const TAX_REMITTANCE_OWNERS = ['merchant', 'marketplace'] as const;
export type TaxRemittanceOwner = (typeof TAX_REMITTANCE_OWNERS)[number];
export const INTERNATIONAL_SALES_CHANNEL_CODES = ['hall', 'delivery', 'takeout'] as const;
export type SalesChannelCode = (typeof INTERNATIONAL_SALES_CHANNEL_CODES)[number];
export const TAX_COMPONENT_KINDS = ['primary', 'additional'] as const;
export type TaxComponentKind = (typeof TAX_COMPONENT_KINDS)[number];
export const TAX_CALCULATION_BASES = ['primary_tax_exclusive', 'primary_tax_inclusive'] as const;
export type TaxCalculationBasis = (typeof TAX_CALCULATION_BASES)[number];
export const INTERNATIONAL_TAX_CALCULATION_VERSIONS = ['international_tax_v1', 'legacy_effective_rate_v1'] as const;
export type InternationalTaxCalculationVersion = 'international_tax_v1';
export type LegacyTaxCalculationVersion = 'legacy_effective_rate_v1';
export const TAX_JURISDICTION_LEVELS = [
  'national', 'state', 'province', 'county', 'city', 'special', 'custom',
] as const;
export type TaxJurisdictionLevel = (typeof TAX_JURISDICTION_LEVELS)[number];

/**
 * 하위 관할 코드. 사용자 자유 입력값이 아니다. INTL-1B의 관할 카탈로그가 소유하며,
 * 표준 코드가 있는 지역은 ISO 3166-2를 우선하고 그 밖의 지역은 카탈로그의 불변 코드를 쓴다.
 */
export type TaxRegionCode = string;

/**
 * 메뉴 과세 분류의 불변 코드. 표시 이름이 아니며 INTL-1B의 세금 프로필 카탈로그가 소유한다.
 * 판매 스냅샷은 판매 시점 코드를 그대로 보존한다.
 */
export type TaxCategoryCode = string;

export interface LaunchMarketDefinition {
  countryCode: LaunchCountryCode;
  countryNameKo: string;
  currencyCode: LaunchCurrencyCode;
  businessLocaleCode: BusinessLocaleCode;
  /** ISO 4217 minor unit. KRW=0, 이번 출시의 나머지 통화=2. */
  minorUnit: 0 | 2;
  defaultTaxPriceBasis: TaxPriceBasis;
  /** true면 온보딩에서 제품 카탈로그가 아는 하위 관할 코드를 받아야 한다. */
  requiresTaxRegion: boolean;
}

export const LAUNCH_MARKETS: Readonly<Record<LaunchCountryCode, LaunchMarketDefinition>> = {
  KR: { countryCode: 'KR', countryNameKo: '한국', currencyCode: 'KRW', businessLocaleCode: 'ko-KR', minorUnit: 0, defaultTaxPriceBasis: 'tax_inclusive', requiresTaxRegion: false },
  US: { countryCode: 'US', countryNameKo: '미국', currencyCode: 'USD', businessLocaleCode: 'en-US', minorUnit: 2, defaultTaxPriceBasis: 'tax_exclusive', requiresTaxRegion: true },
  GB: { countryCode: 'GB', countryNameKo: '영국', currencyCode: 'GBP', businessLocaleCode: 'en-GB', minorUnit: 2, defaultTaxPriceBasis: 'tax_inclusive', requiresTaxRegion: false },
  AU: { countryCode: 'AU', countryNameKo: '호주', currencyCode: 'AUD', businessLocaleCode: 'en-AU', minorUnit: 2, defaultTaxPriceBasis: 'tax_inclusive', requiresTaxRegion: false },
  CA: { countryCode: 'CA', countryNameKo: '캐나다', currencyCode: 'CAD', businessLocaleCode: 'en-CA', minorUnit: 2, defaultTaxPriceBasis: 'tax_exclusive', requiresTaxRegion: true },
} as const;

/** 일정 시점부터 적용되는 매장 시장 프로필. 앱 언어를 소유하지 않는다. */
export interface StoreMarketProfile {
  id: string;
  storeId: string;
  countryCode: LaunchCountryCode;
  regionCode: TaxRegionCode | null;
  currencyCode: LaunchCurrencyCode;
  businessLocaleCode: BusinessLocaleCode;
  priceBasis: TaxPriceBasis;
  /** 매장 현지 날짜 YYYY-MM-DD. */
  effectiveFrom: string;
  effectiveTo: string | null;
  revision: number;
}

/** DB `store_tax_profiles`에 직접 저장되는 세금 프로필 행. 국가·지역을 중복 저장하지 않는다. */
export interface StoredStoreTaxProfile {
  id: string;
  storeId: string;
  marketProfileId: string;
  defaultTreatment: TaxTreatment;
  effectiveFrom: string;
  effectiveTo: string | null;
  revision: number;
}

/**
 * 시장 프로필 안에서 일정 시점부터 적용되는 세금 프로필 조회 계약.
 * `countryCode`와 `regionCode`는 `store_market_profiles`에서 파생한 조회값이며
 * `store_tax_profiles`에 중복 저장하지 않는다.
 */
export interface StoreTaxProfile extends StoredStoreTaxProfile {
  countryCode: LaunchCountryCode;
  regionCode: TaxRegionCode | null;
  components: readonly TaxRateComponent[];
  remittanceRules: readonly TaxComponentChannelRemittance[];
}

export interface TaxRateComponent {
  id: string;
  /** 프로필 판본 안에서 UI 초안과 채널 납부 설정을 연결하는 안정 키. */
  configKey: string;
  kind: TaxComponentKind;
  name: string;
  /** 법정 표면 세율(%). 10은 10%이며 포함가의 10/110을 직접 입력하지 않는다. */
  ratePct: number;
  jurisdictionLevel: TaxJurisdictionLevel;
  calculationBasis: TaxCalculationBasis;
  appliesToTreatments: readonly TaxTreatment[];
  sortOrder: number;
}

/** 납부 주체는 판매 전체가 아니라 세금 구성 항목×판매 채널로 정한다. */
export interface TaxComponentChannelRemittance {
  taxComponentId: string;
  salesChannel: SalesChannelCode;
  remittanceOwner: TaxRemittanceOwner;
}

export interface TaxComponentAmountSnapshot {
  taxComponentId: string;
  kind: TaxComponentKind;
  name: string;
  ratePct: number;
  jurisdictionLevel: TaxJurisdictionLevel;
  calculationBasis: TaxCalculationBasis;
  appliesToTreatments: readonly TaxTreatment[];
  remittanceOwner: TaxRemittanceOwner;
  unroundedAmount: number;
  roundedAmount: number;
}

/** 판매 계산선(영업일×메뉴×채널)에 고정되는 국제 세금 입력·결과. */
export interface SaleTaxSnapshot {
  marketProfileId: string;
  marketProfileRevision: number;
  taxProfileId: string;
  taxProfileRevision: number;
  countryCode: LaunchCountryCode;
  regionCode: TaxRegionCode | null;
  currencyCode: LaunchCurrencyCode;
  minorUnit: 0 | 2;
  priceBasis: TaxPriceBasis;
  treatment: TaxTreatment;
  /** 명시적 treatment override를 쓴 판매는 카테고리가 null이다. */
  taxCategory: TaxCategoryCode | null;
  salesChannel: SalesChannelCode;
  calculationVersion: InternationalTaxCalculationVersion;
  unitPrice: number;
  finalQuantity: number;
  listedTotal: number;
  netSales: number;
  customerTotal: number;
  taxAmount: number;
  merchantTaxLiability: number;
  marketplaceTaxLiability: number;
  components: readonly TaxComponentAmountSnapshot[];
}

/** DB numeric이 확정한 현재 가격의 국제 세금 견적. 앱은 이 금액을 재계산하지 않는다. */
export interface InternationalTaxQuote {
  listedTotal: number;
  netSales: number;
  customerTotal: number;
  taxAmount: number;
  merchantTaxLiability: number;
  marketplaceTaxLiability: number;
  components: readonly TaxComponentAmountSnapshot[];
}

export type SemanticAppVersion = `${number}.${number}.${number}`;
export interface AppCapabilities {
  contractVersion: 1;
  minimumSupportedAppVersion: SemanticAppVersion;
  internationalTax: {
    contractVersion: InternationalTaxCalculationVersion;
    readEnabled: boolean;
    writeEnabled: boolean;
    minimumWriteAppVersion: SemanticAppVersion | null;
  };
}

/** INTL-1F 제품 활성 기준선. 서버 응답·앱 배포 판본·DB parity 시험이 같은 값이다. */
export const APP_CAPABILITIES_BASELINE: AppCapabilities = {
  contractVersion: 1,
  minimumSupportedAppVersion: '0.2.0',
  internationalTax: {
    contractVersion: 'international_tax_v1',
    readEnabled: true,
    writeEnabled: true,
    minimumWriteAppVersion: '0.2.0',
  },
};

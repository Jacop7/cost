import {
  BUSINESS_LOCALE_CODES,
  INTERNATIONAL_SALES_CHANNEL_CODES,
  LAUNCH_COUNTRY_CODES,
  LAUNCH_CURRENCY_CODES,
  TAX_CALCULATION_BASES,
  TAX_COMPONENT_KINDS,
  TAX_JURISDICTION_LEVELS,
  TAX_PRICE_BASES,
  TAX_REMITTANCE_OWNERS,
  TAX_TREATMENTS,
  type AppCapabilities,
  type AppLanguageCode,
  type SaleTaxSnapshot,
  type StoreMarketProfile,
  type StoreTaxProfile,
  type TaxCategoryCode,
  type TaxRegionCode,
} from '@margincook/types';

type R = Record<string, unknown>;
const YMD = /^\d{4}-(0[1-9]|1[0-2])-([12]\d|3[01]|0[1-9])$/;
const SEMVER = /^\d+\.\d+\.\d+$/;

const bad = (message: string): never => { throw new Error(`서버 국제 세금 계약이 달라요 · ${message}`); };
const obj = (v: unknown, name: string): R =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? v as R : bad(`${name} 객체 없음`);
const arr = (v: unknown, name: string): unknown[] => Array.isArray(v) ? v : bad(`${name} 배열 없음`);
const str = (v: unknown, name: string): string => typeof v === 'string' && v !== '' ? v : bad(`${name} 문자열 없음`);
const nullableStr = (v: unknown, name: string): string | null => v === null ? null : str(v, name);
const num = (v: unknown, name: string): number => typeof v === 'number' && Number.isFinite(v) ? v : bad(`${name} 숫자 아님`);
const int = (v: unknown, name: string, min = 0): number => {
  const n = num(v, name); return Number.isSafeInteger(n) && n >= min ? n : bad(`${name} 정수 아님`);
};
const bool = (v: unknown, name: string): boolean => typeof v === 'boolean' ? v : bad(`${name} 참/거짓 아님`);
const oneOf = <T extends readonly string[]>(v: unknown, values: T, name: string): T[number] =>
  typeof v === 'string' && values.includes(v) ? v as T[number] : bad(`${name} 값 ${String(v)}`);
const ymd = (v: unknown, name: string): string => { const s = str(v, name); return YMD.test(s) ? s : bad(`${name} 날짜 형식`); };
const uuid = (v: unknown, name: string): string => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(v)) ? String(v) : bad(`${name} UUID 형식`);

export function parseAppCapabilities(v: unknown): AppCapabilities {
  const r = obj(v, 'capabilities');
  const tax = obj(r.international_tax, 'international_tax');
  const minimum = str(r.minimum_supported_app_version, 'minimum_supported_app_version');
  if (!SEMVER.test(minimum)) bad('minimum_supported_app_version 형식');
  const minWrite = nullableStr(tax.minimum_write_app_version, 'minimum_write_app_version');
  if (minWrite !== null && !SEMVER.test(minWrite)) bad('minimum_write_app_version 형식');
  if (int(r.contract_version, 'contract_version', 1) !== 1) bad('contract_version 값');
  return {
    contractVersion: 1,
    minimumSupportedAppVersion: minimum as AppCapabilities['minimumSupportedAppVersion'],
    internationalTax: {
      contractVersion: oneOf(tax.contract_version, ['international_tax_v1'] as const, 'international_tax.contract_version'),
      readEnabled: bool(tax.read_enabled, 'read_enabled'),
      writeEnabled: bool(tax.write_enabled, 'write_enabled'),
      minimumWriteAppVersion: minWrite as AppCapabilities['internationalTax']['minimumWriteAppVersion'],
    },
  };
}

export interface UserPreferencesContract {
  appLanguage: AppLanguageCode | null;
  needsConfirmation: boolean;
  sourceLocale: string | null;
  revision: number;
}
export function parseUserPreferences(v: unknown): UserPreferencesContract {
  const r = obj(v, '사용자 선호');
  const language = r.app_language === null ? null : oneOf(r.app_language, ['ko','en'] as const, 'app_language');
  const needs = bool(r.needs_confirmation, 'needs_confirmation');
  if (needs !== (language === null)) bad('언어 확인 상태 조합');
  return { appLanguage: language, needsConfirmation: needs, sourceLocale: nullableStr(r.source_locale, 'source_locale'), revision: int(r.revision, 'revision', 1) };
}

export function parseAppLanguageSaveResult(v:unknown):UserPreferencesContract{
  const r=obj(v,'언어 저장 결과');
  bool(r.changed,'changed');
  return {appLanguage:oneOf(r.app_language,['ko','en'] as const,'app_language'),needsConfirmation:false,sourceLocale:null,revision:int(r.revision,'revision',1)};
}

export interface TaxCategoryOption { code: TaxCategoryCode; name: string; treatment: 'taxable'|'zero_rated'|'exempt'; active?: boolean }
export interface InternationalTaxState {
  capabilities: AppCapabilities;
  localDate: string;
  onboardingStatus: 'profile_ready'|'tax_profile_required'|'manual_review_required'|'country_confirmation_required';
  migration: { decision: string; reasonCodes: string[]; futureEffectiveFrom: string | null } | null;
  marketProfile: StoreMarketProfile | null;
  taxProfile: (StoreTaxProfile & { categories: TaxCategoryOption[] }) | null;
}

export function parseInternationalTaxState(v: unknown): InternationalTaxState {
  const r = obj(v, '앱 상태');
  const m = r.market_profile === null ? null : obj(r.market_profile, 'market_profile');
  const t = r.tax_profile === null ? null : obj(r.tax_profile, 'tax_profile');
  const migration = r.migration === null ? null : obj(r.migration, 'migration');
  const marketProfile: StoreMarketProfile | null = m ? {
    id: uuid(m.id,'market_profile.id'), storeId: uuid(m.store_id,'market_profile.store_id'),
    countryCode: oneOf(m.country_code,LAUNCH_COUNTRY_CODES,'country_code'),
    regionCode: nullableStr(m.region_code,'region_code') as TaxRegionCode|null,
    currencyCode: oneOf(m.currency_code,LAUNCH_CURRENCY_CODES,'currency_code'),
    businessLocaleCode: oneOf(m.business_locale_code,BUSINESS_LOCALE_CODES,'business_locale_code'),
    priceBasis: oneOf(m.price_basis,TAX_PRICE_BASES,'price_basis'),
    effectiveFrom: ymd(m.effective_from,'market effective_from'),
    effectiveTo: m.effective_to===null?null:ymd(m.effective_to,'market effective_to'),
    revision:int(m.revision,'market revision',1),
  } : null;
  const taxProfile = t ? {
    id:uuid(t.id,'tax_profile.id'),storeId:uuid(t.store_id,'tax_profile.store_id'),marketProfileId:uuid(t.market_profile_id,'market_profile_id'),
    countryCode: marketProfile?.countryCode ?? bad('세금 프로필의 시장 프로필 없음'),
    regionCode: marketProfile?.regionCode ?? null,
    defaultTreatment:oneOf(t.default_treatment,TAX_TREATMENTS,'default_treatment'),
    effectiveFrom:ymd(t.effective_from,'tax effective_from'),effectiveTo:t.effective_to===null?null:ymd(t.effective_to,'tax effective_to'),
    revision:int(t.revision,'tax revision',1),
    components:arr(t.components,'components').map((x,i)=>{const c=obj(x,`component ${i}`);return{
      id:uuid(c.id,'component.id'),configKey:str(c.key,'component.key'),kind:oneOf(c.kind,TAX_COMPONENT_KINDS,'kind'),name:str(c.name,'name'),
      ratePct:num(c.rate_pct,'rate_pct'),jurisdictionLevel:oneOf(c.jurisdiction_level,TAX_JURISDICTION_LEVELS,'jurisdiction_level'),
      calculationBasis:oneOf(c.calculation_basis,TAX_CALCULATION_BASES,'calculation_basis'),
      appliesToTreatments:arr(c.applies_to_treatments,'applies_to_treatments').map(y=>oneOf(y,TAX_TREATMENTS,'treatment')),
      sortOrder:int(c.sort_order,'sort_order'),
    }}),
    remittanceRules:arr(t.remittance,'remittance').map((x,i)=>{const q=obj(x,`remittance ${i}`);return{
      taxComponentId:uuid(q.tax_component_id,'tax_component_id'),salesChannel:oneOf(q.sales_channel_code,INTERNATIONAL_SALES_CHANNEL_CODES,'sales_channel'),
      remittanceOwner:oneOf(q.remittance_owner,TAX_REMITTANCE_OWNERS,'remittance_owner'),
    }}),
    categories:arr(t.categories,'categories').map((x,i)=>{const c=obj(x,`category ${i}`);return{
      code:str(c.code,'category.code') as TaxCategoryCode,name:str(c.name,'category.name'),
      treatment:oneOf(c.treatment,TAX_TREATMENTS,'category.treatment'),active:bool(c.active,'category.active'),
    }}),
  } : null;
  const onboardingStatus=oneOf(r.onboarding_status,['profile_ready','tax_profile_required','manual_review_required','country_confirmation_required'] as const,'onboarding_status');
  if(onboardingStatus==='profile_ready'&&(!marketProfile||!taxProfile))bad('준비 완료인데 시장·세금 프로필 없음');
  if(onboardingStatus==='tax_profile_required'&&(!marketProfile||taxProfile))bad('세금 프로필 필요 상태 조합');
  if(taxProfile&&marketProfile&&taxProfile.storeId!==marketProfile.storeId)bad('시장·세금 프로필 매장 불일치');
  return {
    capabilities:parseAppCapabilities(r.capabilities),localDate:ymd(r.local_date,'local_date'),
    onboardingStatus,
    migration:migration?{decision:str(migration.decision,'migration.decision'),reasonCodes:arr(migration.reason_codes,'reason_codes').map(x=>str(x,'reason_code')),futureEffectiveFrom:migration.future_effective_from===null?null:ymd(migration.future_effective_from,'future_effective_from')}:null,
    marketProfile,taxProfile,
  };
}

export interface RecipeTaxState { capabilities: AppCapabilities; taxProfileId: string|null; taxProfileRevision:number|null; defaultTreatment:'taxable'|'zero_rated'|'exempt'|null; overrideRevision:number; taxCategory: string|null; treatment: 'taxable'|'zero_rated'|'exempt'|null; categories: TaxCategoryOption[] }
export function parseRecipeTaxState(v:unknown):RecipeTaxState{const r=obj(v,'메뉴 과세');return{
  capabilities:parseAppCapabilities(r.capabilities),taxProfileId:r.tax_profile_id===null?null:uuid(r.tax_profile_id,'tax_profile_id'),
  taxProfileRevision:r.tax_profile_revision===null?null:int(r.tax_profile_revision,'tax_profile_revision',1),
  defaultTreatment:r.default_treatment===null?null:oneOf(r.default_treatment,TAX_TREATMENTS,'default_treatment'),
  overrideRevision:int(r.override_revision,'override_revision'),
  taxCategory:nullableStr(r.tax_category,'tax_category'),treatment:r.treatment===null?null:oneOf(r.treatment,TAX_TREATMENTS,'treatment'),
  categories:arr(r.categories,'categories').map((x,i)=>{const c=obj(x,`category ${i}`);return{code:str(c.code,'code'),name:str(c.name,'name'),treatment:oneOf(c.treatment,TAX_TREATMENTS,'treatment')}}),
};}

export interface ProfileSaveResult { changed:boolean; profileId:string; revision:number; effectiveFrom:string }
export function parseProfileSaveResult(v:unknown):ProfileSaveResult{const r=obj(v,'프로필 저장 결과');return{
  changed:bool(r.changed,'changed'),profileId:uuid(r.profile_id,'profile_id'),revision:int(r.revision,'revision',1),effectiveFrom:ymd(r.effective_from,'effective_from'),
};}
export interface MenuTaxSaveResult { changed:boolean; revision:number; taxCategory:string|null; treatment:'taxable'|'zero_rated'|'exempt'|null }
export function parseMenuTaxSaveResult(v:unknown):MenuTaxSaveResult{const r=obj(v,'메뉴 과세 저장 결과');return{
  changed:bool(r.changed,'changed'),revision:int(r.revision,'revision',1),taxCategory:nullableStr(r.tax_category,'tax_category'),
  treatment:r.treatment===null?null:oneOf(r.treatment,TAX_TREATMENTS,'treatment'),
};}

export interface SalesTaxLine extends SaleTaxSnapshot {
  dailySalesItemId: string;
  recipeId: string;
  menuName: string;
  saleDate: string;
}
export interface SalesTaxDetail { capabilities: AppCapabilities; from:string; to:string; lines:SalesTaxLine[] }
export function parseSalesTaxDetail(v:unknown):SalesTaxDetail{const r=obj(v,'판매 세금 상세');const from=ymd(r.from,'from');const to=ymd(r.to,'to');if(from>to)bad('조회 기간 순서');return{
  capabilities:parseAppCapabilities(r.capabilities),from,to,
  lines:arr(r.lines,'lines').map((x,i)=>{const s=obj(x,`line ${i}`);return{
    dailySalesItemId:uuid(s.daily_sales_item_id,'daily_sales_item_id'),recipeId:uuid(s.recipe_id,'recipe_id'),menuName:str(s.menu_name,'menu_name'),saleDate:ymd(s.sale_date,'sale_date'),
    marketProfileId:uuid(s.market_profile_id,'market_profile_id'),marketProfileRevision:int(s.market_profile_revision,'market_profile_revision',1),
    taxProfileId:uuid(s.tax_profile_id,'tax_profile_id'),taxProfileRevision:int(s.tax_profile_revision,'tax_profile_revision',1),
    countryCode:oneOf(s.country_code,LAUNCH_COUNTRY_CODES,'country_code'),regionCode:nullableStr(s.region_code,'region_code'),
    currencyCode:oneOf(s.currency_code,LAUNCH_CURRENCY_CODES,'currency_code'),minorUnit:(()=>{const n=int(s.minor_unit,'minor_unit');return n===0||n===2?n:bad('minor_unit 값')})(),
    priceBasis:oneOf(s.price_basis,TAX_PRICE_BASES,'price_basis'),treatment:oneOf(s.treatment,TAX_TREATMENTS,'treatment'),
    taxCategory:nullableStr(s.tax_category,'tax_category') as TaxCategoryCode|null,salesChannel:oneOf(s.sales_channel_code,INTERNATIONAL_SALES_CHANNEL_CODES,'sales_channel'),
    calculationVersion:oneOf(s.calculation_version,['international_tax_v1'] as const,'calculation_version'),
    unitPrice:num(s.unit_price,'unit_price'),finalQuantity:num(s.final_quantity,'final_quantity'),
    listedTotal:num(s.listed_total,'listed_total'),netSales:num(s.net_sales,'net_sales'),customerTotal:num(s.customer_total,'customer_total'),taxAmount:num(s.tax_total,'tax_total'),
    merchantTaxLiability:num(s.merchant_tax_liability,'merchant_tax_liability'),marketplaceTaxLiability:num(s.marketplace_tax_liability,'marketplace_tax_liability'),
    components:arr(s.components,'components').map((y,j)=>{const c=obj(y,`component ${j}`);return{
      taxComponentId:uuid(c.component_id,'component_id'),kind:oneOf(c.kind,TAX_COMPONENT_KINDS,'kind'),name:str(c.name,'name'),ratePct:num(c.rate_pct,'rate_pct'),
      jurisdictionLevel:oneOf(c.jurisdiction_level,TAX_JURISDICTION_LEVELS,'jurisdiction_level'),calculationBasis:oneOf(c.calculation_basis,TAX_CALCULATION_BASES,'calculation_basis'),
      appliesToTreatments:arr(c.applies_to_treatments,'applies').map(z=>oneOf(z,TAX_TREATMENTS,'treatment')),
      remittanceOwner:oneOf(c.remittance_owner,TAX_REMITTANCE_OWNERS,'remittance_owner'),unroundedAmount:num(c.unrounded_amount,'unrounded_amount'),roundedAmount:num(c.rounded_amount,'rounded_amount'),
    }}),
  }}),
};}

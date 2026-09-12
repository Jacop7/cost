import { describe, expect, it } from 'vitest';
import { parseProfileSaveResult, parseAppCapabilities, parseInternationalTaxState, parseRecipeTaxState, parseSalesTaxDetail, parseUserPreferences } from '@/features/international-tax/contracts';
import { CURRENT_MARKET, CURRENT_STORE, QUOTE_CONTEXT } from './fixtures/internationalTaxCurrentContext';

const CAP={contract_version:1,minimum_supported_app_version:'0.1.0',international_tax:{contract_version:'international_tax_v1',read_enabled:false,write_enabled:false,minimum_write_app_version:null}};
const ID='00000000-0000-0000-0000-000000000001';
const STATE={capabilities:CAP,local_date:'2026-09-01',onboarding_status:'profile_ready',migration:null,market_profile:{id:ID,store_id:ID,country_code:'KR',region_code:null,currency_code:'KRW',business_locale_code:'ko-KR',price_basis:'tax_inclusive',effective_from:'2026-09-02',effective_to:null,revision:1},tax_profile:{id:ID,store_id:ID,market_profile_id:ID,default_treatment:'taxable',effective_from:'2026-09-02',effective_to:null,revision:1,components:[{id:ID,config_key:'primary',kind:'primary',name:'부가세',rate_pct:10,jurisdiction_level:'national',calculation_basis:'primary_tax_exclusive',applies_to_treatments:['taxable'],sort_order:0}],categories:[{code:'standard',name:'일반 과세',treatment:'taxable',active:true}],remittance:[{tax_component_id:ID,sales_channel_code:'hall',remittance_owner:'merchant'}]}};

const reservedState = { ...STATE, market_profile: { ...STATE.market_profile, store_id: CURRENT_STORE },
  tax_profile: { ...STATE.tax_profile, store_id: CURRENT_STORE } };
const quoteState = () => ({ capabilities: CAP, tax_profile_id: ID, tax_profile_revision: 2,
  default_treatment: 'taxable', override_revision: 3, effective_from: '2026-09-02', tax_category: null,
  treatment: null, currency_code: 'GBP', minor_unit: 2, price_basis: 'tax_inclusive', categories: [],
  quote: { listed_total: 12.34, net_sales: 12.34, customer_total: 13.57, tax_total: 1.23,
    merchant_tax_liability: 1.23, marketplace_tax_liability: 0, components: [] },
});

describe('F4-6 현재 시장·quote provenance와 예약 편집 호환', () => {
  it('현재 USD/P0와 미래 예약 KR/P1을 구분하고 저장용 기존 값을 보존한다', () => {
    const app = parseInternationalTaxState({ ...reservedState, current_market: CURRENT_MARKET }, CURRENT_STORE);
    expect(app.currentMarket).toMatchObject({ id: CURRENT_MARKET.id, currencyCode: 'USD', minorUnit: 2 });
    expect(app.marketProfile).toMatchObject({ id: ID, currencyCode: 'KRW', effectiveFrom: '2026-09-02' });
    const recipe = parseRecipeTaxState({ ...quoteState(), quote_context: QUOTE_CONTEXT }, CURRENT_STORE);
    expect(recipe.quoteContext).toMatchObject({ localDate: '2026-09-01', taxProfileId: QUOTE_CONTEXT.tax_profile_id,
      market: { currencyCode: 'USD', priceBasis: 'tax_exclusive' }, salesChannel: 'hall' });
    expect(recipe).toMatchObject({ taxProfileId: ID, taxProfileRevision: 2, overrideRevision: 3,
      currencyCode: 'GBP', priceBasis: 'tax_inclusive', quote: { taxAmount: 1.23, netSales: 12.34 } });
  });
  it('구 서버의 키 누락과 새 서버의 명시적 null을 구분한다', () => {
    expect(parseInternationalTaxState(STATE).currentMarket).toBeUndefined();
    expect(parseInternationalTaxState({ ...STATE, current_market: null }).currentMarket).toBeNull();
    expect(parseRecipeTaxState(quoteState()).quoteContext).toBeUndefined();
    expect(parseRecipeTaxState({ ...quoteState(), quote: null, quote_context: null }).quoteContext).toBeNull();
  });
  it.each([
    { minor_unit: 0 }, { currency_code: 'EUR' }, { business_locale_code: 'ko-KR' },
    { region_code: null }, { id: 'not-an-id' }, { id: '00000000----------------------------' }, { revision: 0 },
    { effective_from: '2026-09-02' }, { effective_to: '2026-08-31' }, { effective_from: '2026-02-30' },
  ])('잘못된 현재 시장 계약 %j를 거부한다', patch => {
    expect(() => parseInternationalTaxState({ ...reservedState, current_market: { ...CURRENT_MARKET, ...patch } })).toThrow();
  });
  it('quote의 현재 시장도 날짜·매장·채널 경계를 검증한다', () => {
    expect(() => parseRecipeTaxState({ ...quoteState(), quote_context: QUOTE_CONTEXT }, ID)).toThrow(/매장/);
    expect(() => parseRecipeTaxState({ ...quoteState(), quote_context: { ...QUOTE_CONTEXT, local_date: '2026-09-02' } })).toThrow(/구간/);
    expect(() => parseRecipeTaxState({ ...quoteState(), quote_context: { ...QUOTE_CONTEXT, sales_channel_code: 'delivery' } })).toThrow();
    expect(() => parseInternationalTaxState({ ...reservedState, current_market: { ...CURRENT_MARKET, store_id: ID } })).toThrow(/매장/);
  });
  it.each([null, undefined])('quote/context null 조합의 모순을 거부한다 (%s)', missing => {
    expect(() => parseRecipeTaxState({ ...quoteState(), quote_context: null })).toThrow(/quote/);
    expect(() => parseRecipeTaxState({ ...quoteState(), quote: missing, quote_context: QUOTE_CONTEXT })).toThrow();
  });
});

describe('국제 세금 앱 응답 계약',()=>{
  it('비활성 capability를 false 그대로 읽는다',()=>expect(parseAppCapabilities(CAP).internationalTax).toEqual({contractVersion:'international_tax_v1',readEnabled:false,writeEnabled:false,minimumWriteAppVersion:null}));
  it('필드 누락과 모르는 판본을 조용히 기본값으로 메우지 않는다',()=>{
    expect(()=>parseAppCapabilities({...CAP,international_tax:{...CAP.international_tax,read_enabled:undefined}})).toThrow(/read_enabled/);
    expect(()=>parseAppCapabilities({...CAP,contract_version:2})).toThrow(/contract_version/);
  });
  it('시장·세금 프로필과 구성·카테고리·납부 주체를 함께 읽는다',()=>{
    const r=parseInternationalTaxState(STATE);expect(r.marketProfile?.currencyCode).toBe('KRW');expect(r.taxProfile?.components[0]?.ratePct).toBe(10);expect(r.taxProfile?.categories[0]?.code).toBe('standard');
  });
  it('프로필 준비 상태인데 시장 프로필이 없으면 거부한다',()=>expect(()=>parseInternationalTaxState({...STATE,market_profile:null})).toThrow(/시장 프로필 없음/));
  it('시장 프로필만 있으면 세금 프로필 필요 상태를 구분한다',()=>{
    const parsed=parseInternationalTaxState({...STATE,onboarding_status:'tax_profile_required',tax_profile:null});
    expect(parsed.marketProfile?.currencyCode).toBe('KRW');expect(parsed.taxProfile).toBeNull();
    expect(()=>parseInternationalTaxState({...STATE,onboarding_status:'tax_profile_required'})).toThrow(/상태 조합/);
  });
  it('서로 다른 매장의 시장·세금 프로필을 한 화면으로 섞지 않는다',()=>expect(()=>parseInternationalTaxState({...STATE,tax_profile:{...STATE.tax_profile,store_id:'00000000-0000-0000-0000-000000000002'}})).toThrow(/매장 불일치/));
  it('사용자 언어 null은 확인 필요일 때만 허용한다',()=>{
    expect(parseUserPreferences({app_language:null,needs_confirmation:true,source_locale:'ja',revision:1}).appLanguage).toBeNull();
    expect(()=>parseUserPreferences({app_language:null,needs_confirmation:false,source_locale:'ja',revision:1})).toThrow(/조합/);
  });
  it('legacy 판매를 국제 세금 상세로 가장하지 않고 기간의 빈 배열을 허용한다',()=>expect(parseSalesTaxDetail({capabilities:CAP,from:'2026-09-01',to:'2026-09-02',lines:[],etc_lines:[]}).lines).toEqual([]));
  it('판매 세금 응답의 기간 순서를 검증한다',()=>expect(()=>parseSalesTaxDetail({capabilities:CAP,from:'2026-09-02',to:'2026-09-01',lines:[],etc_lines:[]})).toThrow(/기간 순서/));
  it('판매 시점 날짜·단가·프로필과 구성 항목을 서버 응답 그대로 읽는다',()=>{
    const line={daily_sales_item_id:ID,recipe_id:ID,menu_name:'제육볶음',sale_date:'2026-09-01',unit_price:12000,
      sales_channel_code:'hall',country_code:'KR',region_code:null,currency_code:'KRW',minor_unit:0,
      price_basis:'tax_inclusive',treatment:'taxable',tax_category:'standard',market_profile_id:ID,
      market_profile_revision:1,tax_profile_id:ID,tax_profile_revision:2,calculation_version:'international_tax_v1',
      final_quantity:1,listed_total:12000,net_sales:10909,customer_total:12000,tax_total:1091,
      merchant_tax_liability:1091,marketplace_tax_liability:0,components:[{component_id:ID,kind:'primary',name:'부가세',rate_pct:10,
        jurisdiction_level:'national',calculation_basis:'primary_tax_exclusive',applies_to_treatments:['taxable'],remittance_owner:'merchant',unrounded_amount:1090.9,rounded_amount:1091}]};
    const parsed=parseSalesTaxDetail({capabilities:CAP,from:'2026-09-01',to:'2026-09-01',lines:[line],etc_lines:[]});
    expect(parsed.lines[0]).toMatchObject({saleDate:'2026-09-01',unitPrice:12000,taxProfileRevision:2,taxAmount:1091});
  });
  it('기타매출도 판매 시점 프로필과 구성 항목을 그대로 읽는다',()=>{
    const line={daily_sales_id:ID,sale_date:'2026-09-01',name:'음료',sales_channel_code:'hall',country_code:'KR',region_code:null,currency_code:'KRW',minor_unit:0,
      price_basis:'tax_inclusive',treatment:'taxable',market_profile_revision:1,tax_profile_revision:2,calculation_version:'international_tax_v1',
      listed_total:1000,net_sales:909,customer_total:1000,tax_total:91,merchant_tax_liability:91,marketplace_tax_liability:0,
      components:[{component_id:ID,kind:'primary',name:'부가세',rate_pct:10,jurisdiction_level:'national',calculation_basis:'primary_tax_exclusive',applies_to_treatments:['taxable'],remittance_owner:'merchant',unrounded_amount:90.9,rounded_amount:91}]};
    expect(parseSalesTaxDetail({capabilities:CAP,from:'2026-09-01',to:'2026-09-01',lines:[],etc_lines:[line]}).etcLines[0])
      .toMatchObject({name:'음료',taxAmount:91,taxProfileRevision:2});
  });
  it('메뉴 현재 세금 quote를 앱에서 다시 계산하지 않고 읽는다',()=>{
    const quote={listed_total:12000,net_sales:10909,customer_total:12000,tax_total:1091,merchant_tax_liability:1091,marketplace_tax_liability:0,
      components:[{component_id:ID,kind:'primary',name:'부가세',rate_pct:10,jurisdiction_level:'national',calculation_basis:'primary_tax_exclusive',applies_to_treatments:['taxable'],remittance_owner:'merchant',unrounded_amount:1090.9,rounded_amount:1091}]};
    const parsed=parseRecipeTaxState({capabilities:CAP,tax_profile_id:ID,tax_profile_revision:1,default_treatment:'taxable',override_revision:0,effective_from:null,tax_category:null,treatment:null,currency_code:'KRW',minor_unit:0,price_basis:'tax_inclusive',quote,categories:[]});
    expect(parsed.quote).toMatchObject({taxAmount:1091,netSales:10909});
  });
});


describe('영업 상태별 현재 설정 계약', () => {
  it('자정을 넘긴 영업은 실제 서버 날짜와 이전 영업일의 견적 날짜를 구분한다', () => {
    const current = { ...CURRENT_MARKET, effective_from: '2026-08-30', effective_to: '2026-08-31' };
    const input = { ...reservedState, application_mode: 'next_business', quote_date: '2026-08-31', current_market: current };
    expect(parseInternationalTaxState(input, CURRENT_STORE)).toMatchObject({ localDate: '2026-09-01', currentMarket: { id: current.id } });
    expect(() => parseInternationalTaxState({ ...input, application_mode: 'immediate' }, CURRENT_STORE)).toThrow();
  });
  it('서버의 즉시 적용 응답과 별도 quote 날짜를 보존한다', () => {
    expect(parseProfileSaveResult({ changed: true, profile_id: ID, revision: 2, effective_from: '2026-09-02', application_mode: 'immediate' }).applicationMode).toBe('immediate');
    const current = { ...CURRENT_MARKET, effective_from: '2026-09-02', effective_to: null };
    const input = { ...reservedState, application_mode: 'immediate', quote_date: '2026-09-02', current_market: current };
    expect(parseInternationalTaxState(input, CURRENT_STORE)).toMatchObject({ localDate: '2026-09-01', applicationMode: 'immediate', currentMarket: { id: current.id } });
    expect(() => parseInternationalTaxState({ ...input, application_mode: 'next_business' }, CURRENT_STORE)).toThrow();
    expect(() => parseInternationalTaxState({ ...input, quote_date: '2026-08-31' }, CURRENT_STORE)).toThrow();
    const recipe = parseRecipeTaxState({ ...quoteState(), quote_context: { ...QUOTE_CONTEXT, market: current, quote_date: '2026-09-02', application_mode: 'immediate' } }, CURRENT_STORE);
    expect(recipe.quoteContext?.localDate).toBe('2026-09-01');
  });
});

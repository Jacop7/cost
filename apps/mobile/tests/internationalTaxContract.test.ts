import { describe, expect, it } from 'vitest';
import { parseAppCapabilities, parseInternationalTaxState, parseRecipeTaxState, parseSalesTaxDetail, parseUserPreferences } from '@/features/international-tax/contracts';

const CAP={contract_version:1,minimum_supported_app_version:'0.1.0',international_tax:{contract_version:'international_tax_v1',read_enabled:false,write_enabled:false,minimum_write_app_version:null}};
const ID='00000000-0000-0000-0000-000000000001';
const STATE={capabilities:CAP,local_date:'2026-09-01',onboarding_status:'profile_ready',migration:null,market_profile:{id:ID,store_id:ID,country_code:'KR',region_code:null,currency_code:'KRW',business_locale_code:'ko-KR',price_basis:'tax_inclusive',effective_from:'2026-09-02',effective_to:null,revision:1},tax_profile:{id:ID,store_id:ID,market_profile_id:ID,default_treatment:'taxable',effective_from:'2026-09-02',effective_to:null,revision:1,components:[{id:ID,config_key:'primary',kind:'primary',name:'부가세',rate_pct:10,jurisdiction_level:'national',calculation_basis:'primary_tax_exclusive',applies_to_treatments:['taxable'],sort_order:0}],categories:[{code:'standard',name:'일반 과세',treatment:'taxable',active:true}],remittance:[{tax_component_id:ID,sales_channel_code:'hall',remittance_owner:'merchant'}]}};

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

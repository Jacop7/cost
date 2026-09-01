import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
vi.mock('expo-router',()=>({router:{canGoBack:()=>true,back:vi.fn(),replace:vi.fn()},useRouter:()=>({push:vi.fn()})}));
vi.mock('@/lib/nav',()=>({safeBack:vi.fn()}));
const state=vi.fn();const save=vi.fn();const regions=vi.fn();vi.mock('@/features/international-tax',()=>({useInternationalTaxState:()=>state(),useSaveMarketProfile:()=>save(),useInternationalTaxRegions:()=>regions()}));
import MyCountryScreen from '@/features/my/screens/MyCountryScreen';
const CAP={internationalTax:{readEnabled:false,writeEnabled:false}};
describe('MY-12 국가 확인',()=>{
  beforeEach(()=>{save.mockReturnValue({mutate:vi.fn(),isPending:false});regions.mockReturnValue({data:[],isLoading:false,error:null,refetch:vi.fn()});});
  it('국가가 없으면 확인 필요를 말하고 비활성 쓰기를 열지 않는다',()=>{
    state.mockReturnValue({data:{capabilities:CAP,onboardingStatus:'country_confirmation_required',marketProfile:null},isLoading:false,error:null,refetch:vi.fn()});render(<MyCountryScreen/>);expect(screen.getByText(/국가를 확인해야 해요/)).toBeTruthy();expect(screen.getByLabelText('국가 확인 저장').getAttribute('aria-disabled')).toBe('true');
  });
  it('준비된 시장 프로필의 국가·통화·가격 기준을 서버값으로 표시한다',()=>{
    state.mockReturnValue({data:{capabilities:CAP,onboardingStatus:'profile_ready',marketProfile:{countryCode:'GB',currencyCode:'GBP',businessLocaleCode:'en-GB',priceBasis:'tax_inclusive',effectiveFrom:'2026-09-02',revision:2}},isLoading:false,error:null,refetch:vi.fn()});render(<MyCountryScreen/>);expect(screen.getByLabelText('영국 선택됨')).toBeTruthy();expect(screen.getByText('GBP · en-GB')).toBeTruthy();expect(screen.getByLabelText('세금 포함 선택됨')).toBeTruthy();
  });
  it('국가는 있지만 세금 프로필이 없으면 국가 재확인을 요구하지 않는다',()=>{
    state.mockReturnValue({data:{capabilities:CAP,onboardingStatus:'tax_profile_required',marketProfile:{countryCode:'GB',currencyCode:'GBP',businessLocaleCode:'en-GB',priceBasis:'tax_inclusive',effectiveFrom:'2026-09-02',revision:2}},isLoading:false,error:null,refetch:vi.fn()});
    render(<MyCountryScreen/>);expect(screen.getByText('GBP · en-GB')).toBeTruthy();expect(screen.queryByText(/매장이 영업하는 국가를 확인해야/)).toBeNull();
  });
  it('쓰기가 열리면 국가·지역·가격 기준과 현재 판본을 서버에 보낸다',()=>{
    const mutate=vi.fn();save.mockReturnValue({mutate,isPending:false});regions.mockReturnValue({data:[{regionCode:'US-NY',name:'New York'}],isLoading:false,error:null,refetch:vi.fn()});
    state.mockReturnValue({data:{capabilities:{internationalTax:{readEnabled:true,writeEnabled:true}},onboardingStatus:'country_confirmation_required',marketProfile:null},isLoading:false,error:null,refetch:vi.fn()});
    render(<MyCountryScreen/>);fireEvent.click(screen.getByText('미국'));fireEvent.click(screen.getByText('New York'));fireEvent.click(screen.getByText('저장'));
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({countryCode:'US',regionCode:'US-NY',currencyCode:'USD',businessLocaleCode:'en-US',priceBasis:'tax_exclusive',baseProfileId:null,baseRevision:null}),expect.any(Object));
  });
});

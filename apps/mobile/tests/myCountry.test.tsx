import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
vi.mock('expo-router',()=>({router:{canGoBack:()=>true,back:vi.fn(),replace:vi.fn()},useRouter:()=>({push:vi.fn()})}));
vi.mock('@/lib/nav',()=>({safeBack:vi.fn()}));
const state=vi.fn();vi.mock('@/features/international-tax',()=>({useInternationalTaxState:()=>state()}));
import MyCountryScreen from '@/features/my/screens/MyCountryScreen';
const CAP={internationalTax:{readEnabled:false,writeEnabled:false}};
describe('MY-12 국가 확인',()=>{
  it('국가가 없으면 확인 필요를 말하고 비활성 쓰기를 열지 않는다',()=>{
    state.mockReturnValue({data:{capabilities:CAP,onboardingStatus:'country_confirmation_required',marketProfile:null},isLoading:false,error:null,refetch:vi.fn()});render(<MyCountryScreen/>);expect(screen.getByText(/국가를 확인해야 해요/)).toBeTruthy();expect(screen.getByLabelText('국가 확인 저장').getAttribute('aria-disabled')).toBe('true');
  });
  it('준비된 시장 프로필의 국가·통화·가격 기준을 서버값으로 표시한다',()=>{
    state.mockReturnValue({data:{capabilities:CAP,onboardingStatus:'profile_ready',marketProfile:{countryCode:'GB',currencyCode:'GBP',businessLocaleCode:'en-GB',priceBasis:'tax_inclusive',effectiveFrom:'2026-09-02',revision:2}},isLoading:false,error:null,refetch:vi.fn()});render(<MyCountryScreen/>);expect(screen.getByText('영국')).toBeTruthy();expect(screen.getByText(/GBP · en-GB · 세금 포함 가격/)).toBeTruthy();
  });
  it('국가는 있지만 세금 프로필이 없으면 국가 재확인을 요구하지 않는다',()=>{
    state.mockReturnValue({data:{capabilities:CAP,onboardingStatus:'tax_profile_required',marketProfile:{countryCode:'GB',currencyCode:'GBP',businessLocaleCode:'en-GB',priceBasis:'tax_inclusive',effectiveFrom:'2026-09-02',revision:2}},isLoading:false,error:null,refetch:vi.fn()});
    render(<MyCountryScreen/>);expect(screen.getByText(/국가와 통화는 확인됐어요/)).toBeTruthy();expect(screen.queryByText(/매장이 영업하는 국가를 확인해야/)).toBeNull();
  });
});

import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('expo-router',()=>({router:{canGoBack:()=>true,back:vi.fn(),replace:vi.fn()}}));
vi.mock('@/lib/nav',()=>({safeBack:vi.fn()}));
vi.mock('@/features/changes/components/ConfigurationHistoryLink',()=>({ConfigurationHistoryLink:()=>null}));
const state=vi.fn(); const mutateAsync=vi.fn(); const regions=vi.fn();
vi.mock('@/features/international-tax',async original=>({
  ...(await original<Record<string,unknown>>()),useInternationalTaxState:()=>state(),
  useSaveTaxConfiguration:()=>({mutateAsync,isPending:false}),useInternationalTaxRegions:()=>regions(),
  useSaveMarketProfile:()=>{throw new Error('Country must not use the standalone market writer');},
}));
import MyCountryScreen from '@/features/my/screens/MyCountryScreen';
const data={capabilities:{internationalTax:{readEnabled:true,writeEnabled:true}},onboardingStatus:'profile_ready',applicationMode:'immediate',
  marketProfile:{id:'market-1',revision:2,countryCode:'KR',currencyCode:'KRW',businessLocaleCode:'ko-KR',priceBasis:'tax_inclusive'},
  taxProfile:{id:'tax-1',revision:3,defaultTreatment:'taxable',categories:[],remittanceRules:[],components:[{id:'primary-id',configKey:'primary',kind:'primary',name:'부가세',ratePct:10,jurisdictionLevel:'national',calculationBasis:'primary_tax_exclusive',appliesToTreatments:['taxable'],sortOrder:0}]}};
beforeEach(()=>{mutateAsync.mockReset();mutateAsync.mockResolvedValue({changed:true,applicationMode:'immediate'});
 regions.mockReturnValue({data:[{regionCode:'US-NY',name:'New York'}],isLoading:false,error:null,refetch:vi.fn()});
 state.mockReturnValue({data,isLoading:false,error:null,refetch:vi.fn().mockResolvedValue({data})});});
it('country route displays server market and disables writes when capability is closed',()=>{
 state.mockReturnValue({data:{...data,capabilities:{internationalTax:{readEnabled:true,writeEnabled:false}}},isLoading:false,error:null,refetch:vi.fn()});
 render(<MyCountryScreen/>);expect(screen.getByText('국가 · 통화')).toBeTruthy();expect(screen.getByText('KRW · KR')).toBeTruthy();
 expect(screen.getByLabelText('국제 세금 프로필 저장').getAttribute('aria-disabled')).toBe('true');
});
it('price basis is saved with both profile revisions in one confirmed transaction',async()=>{
 render(<MyCountryScreen/>);fireEvent.click(screen.getByText('부가세 미포함'));
 fireEvent.click(screen.getByLabelText('국제 세금 프로필 저장'));expect(mutateAsync).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button', { name: '저장' }));
 await waitFor(()=>expect(mutateAsync).toHaveBeenCalledTimes(1));
 expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
   market:expect.objectContaining({countryCode:'KR',priceBasis:'tax_exclusive',baseProfileId:'market-1',baseRevision:2}),
   tax:expect.objectContaining({baseProfileId:'tax-1',baseRevision:3,defaultTreatment:'taxable'})}));
 await waitFor(()=>expect(screen.getByText('저장했어요. 바로 적용됐어요.')).toBeTruthy());
});
it('new country and required region are sent with a complete tax profile',async()=>{
 render(<MyCountryScreen/>);fireEvent.click(screen.getByLabelText('국가 선택'));fireEvent.click(screen.getByText('미국'));fireEvent.click(screen.getByText('New York'));
 fireEvent.click(screen.getByLabelText('국제 세금 프로필 저장'));fireEvent.click(screen.getByRole('button', { name: '저장' }));
 await waitFor(()=>expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
 market:expect.objectContaining({countryCode:'US',regionCode:'US-NY',currencyCode:'USD',priceBasis:'tax_exclusive'}),
 tax:expect.objectContaining({components:expect.arrayContaining([expect.objectContaining({kind:'primary',ratePct:0})])})})));
});
it('atomic failure keeps the editor available without claiming partial market success',async()=>{
 mutateAsync.mockRejectedValue(new Error('transaction failed'));render(<MyCountryScreen/>);
 fireEvent.click(screen.getByLabelText('국제 세금 프로필 저장'));fireEvent.click(screen.getByRole('button', { name: '저장' }));
 await waitFor(()=>expect(screen.getByText('transaction failed')).toBeTruthy());expect(screen.queryByText(/저장했어요/)).toBeNull();expect(mutateAsync).toHaveBeenCalledTimes(1);
});

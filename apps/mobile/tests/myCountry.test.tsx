import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
const push=vi.fn();
vi.mock('expo-router',()=>({useRouter:()=>({push}),router:{canGoBack:()=>true,back:vi.fn(),replace:vi.fn()}}));
vi.mock('@/lib/nav',()=>({safeBack:vi.fn()}));
vi.mock('@/features/changes/components/ConfigurationHistoryLink',()=>({ConfigurationHistoryLink:()=>null}));
const state=vi.fn(); const mutateAsync=vi.fn(); const mutateLanguage=vi.fn(); const regions=vi.fn();
const hoursStatus=vi.fn(); const saveTimezone=vi.fn();
vi.mock('@/features/international-tax',async original=>({
  ...(await original<Record<string,unknown>>()),useInternationalTaxState:()=>state(),
  useSaveTaxConfiguration:()=>({mutateAsync,isPending:false}),useInternationalTaxRegions:()=>regions(),
  useUserPreferences:()=>({data:{appLanguage:'ko',revision:1},isLoading:false,isError:false,error:null}),
  useSaveAppLanguage:()=>({mutate:mutateLanguage,isPending:false}),
  useSaveMarketProfile:()=>{throw new Error('Country must not use the standalone market writer');},
}));
vi.mock('@/features/settings/hooks',async original=>({
  ...(await original<Record<string,unknown>>()),
  useHoursStatus:()=>hoursStatus(),
  useSetStoreTimezone:()=>({mutate:saveTimezone,isPending:false}),
}));
import MyCountryScreen from '@/features/my/screens/MyCountryScreen';
const data={capabilities:{internationalTax:{readEnabled:true,writeEnabled:true}},onboardingStatus:'profile_ready',applicationMode:'immediate',
  marketProfile:{id:'market-1',revision:2,countryCode:'KR',regionCode:null,currencyCode:'KRW',businessLocaleCode:'ko-KR',priceBasis:'tax_inclusive'},
  taxProfile:{id:'tax-1',revision:3,defaultTreatment:'taxable',categories:[],remittanceRules:[],components:[{id:'primary-id',configKey:'primary',kind:'primary',name:'부가세',ratePct:10,jurisdictionLevel:'national',calculationBasis:'primary_tax_exclusive',appliesToTreatments:['taxable'],sortOrder:0}]}};
beforeEach(()=>{push.mockReset();mutateAsync.mockReset();mutateAsync.mockResolvedValue({changed:true,applicationMode:'immediate'});mutateLanguage.mockReset();
 saveTimezone.mockReset();
 regions.mockReturnValue({data:[{regionCode:'US-NY',name:'New York'}],isLoading:false,error:null,refetch:vi.fn()});
 hoursStatus.mockReturnValue({data:{timezone:'Asia/Seoul',timezoneConfirmed:true},isLoading:false,error:null,refetch:vi.fn()});
 state.mockReturnValue({data,isLoading:false,error:null,refetch:vi.fn().mockResolvedValue({data})});});
it('country route displays server market and disables writes when capability is closed',()=>{
 state.mockReturnValue({data:{...data,capabilities:{internationalTax:{readEnabled:true,writeEnabled:false}}},isLoading:false,error:null,refetch:vi.fn()});
 render(<MyCountryScreen/>);expect(screen.getByText('지역 설정')).toBeTruthy();
 expect(screen.getByText('한국 KRW · ₩')).toBeTruthy();
 expect(screen.getByText('한국어')).toBeTruthy();
 expect(screen.queryByText('부가세 계산 기준')).toBeNull();
 expect(screen.queryByText('과세 및 납부 설정')).toBeNull();
 expect(screen.queryByText('추가 세금 항목')).toBeNull();
 expect(screen.queryByText('세금 시뮬레이션')).toBeNull();
 expect(screen.getByText('통화 변경 기능은 준비 중이에요. 현재 설정은 그대로 유지됩니다.')).toBeTruthy();
 expect(screen.queryByLabelText('지역 설정 저장')).toBeNull();
});
it('언어 행은 화면 안의 선택 시트에서 사용자 선호를 저장한다',()=>{
 render(<MyCountryScreen/>);fireEvent.click(screen.getByLabelText('언어 선택'));expect(screen.getByText('언어 선택')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'English'}));
 expect(mutateLanguage).toHaveBeenCalledWith({appLanguage:'en',baseRevision:1},expect.any(Object));
});
it('시간대 행은 국가 탭별 도시와 UTC를 표시하고 서버 시간대를 저장한다',()=>{
 render(<MyCountryScreen/>);
 expect(screen.getByText('시간대')).toBeTruthy();
 expect(screen.getByText('서울 · UTC+9')).toBeTruthy();
 fireEvent.click(screen.getByLabelText('시간대 선택'));
 expect(screen.getByText('매장 시간대')).toBeTruthy();
 expect(screen.getByRole('tab',{name:'한국'}).getAttribute('aria-selected')).toBe('true');
 for (const tab of ['미국','영국','호주','캐나다']) expect(screen.getByRole('tab',{name:tab})).toBeTruthy();
 fireEvent.click(screen.getByRole('tab',{name:'미국'}));
 expect(screen.getByRole('button',{name:/뉴욕 · UTC/})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:/뉴욕 · UTC/}));
 expect(saveTimezone).toHaveBeenCalledTimes(1);
 expect(saveTimezone.mock.calls[0]![0]).toBe('America/New_York');
});
it('unconfirmed store timezone suggests the device timezone here',()=>{
 const current=Intl.DateTimeFormat().resolvedOptions();
 const timezone=vi.spyOn(Intl.DateTimeFormat.prototype,'resolvedOptions').mockReturnValue({...current,timeZone:'UTC'});
 try {
   hoursStatus.mockReturnValue({data:{timezone:'Asia/Seoul',timezoneConfirmed:false},isLoading:false,error:null,refetch:vi.fn()});
   render(<MyCountryScreen/>);
   expect(screen.getByText('매장 시간대를 정해 주세요')).toBeTruthy();
   expect(screen.getByText('기기 시간대는 UTC 예요.')).toBeTruthy();
   fireEvent.click(screen.getByText('기기 시간대 사용'));
   expect(saveTimezone.mock.calls[0]![0]).toBe('UTC');
 } finally { timezone.mockRestore(); }
});
it('country currency change is saved with both profile revisions in one confirmed transaction',async()=>{
 render(<MyCountryScreen/>);fireEvent.click(screen.getByLabelText('통화 선택'));fireEvent.click(screen.getByText('영국 GBP · £'));
 expect(screen.getAllByText('영국 GBP · £').length).toBeGreaterThan(0);
 fireEvent.click(screen.getByLabelText('지역 설정 저장'));expect(mutateAsync).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button', { name: '저장' }));
 await waitFor(()=>expect(mutateAsync).toHaveBeenCalledTimes(1));
 expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
   market:expect.objectContaining({countryCode:'GB',currencyCode:'GBP',priceBasis:'tax_inclusive',baseProfileId:'market-1',baseRevision:2}),
   tax:expect.objectContaining({baseProfileId:'tax-1',baseRevision:3,defaultTreatment:'taxable',components:expect.arrayContaining([expect.objectContaining({kind:'primary',ratePct:0})])})}));
 await waitFor(()=>expect(screen.getByText('저장했어요. 바로 적용됐어요.')).toBeTruthy());
});
it('new country and required region are sent with a complete tax profile',async()=>{
 render(<MyCountryScreen/>);fireEvent.click(screen.getByLabelText('통화 선택'));fireEvent.click(screen.getByText('미국 USD · $'));fireEvent.click(screen.getByText('New York'));
 fireEvent.click(screen.getByLabelText('지역 설정 저장'));fireEvent.click(screen.getByRole('button', { name: '저장' }));
 await waitFor(()=>expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
 market:expect.objectContaining({countryCode:'US',regionCode:'US-NY',currencyCode:'USD',priceBasis:'tax_exclusive'}),
 tax:expect.objectContaining({components:expect.arrayContaining([expect.objectContaining({kind:'primary',ratePct:0})])})})));
});
it('atomic failure keeps the editor available without claiming partial market success',async()=>{
 mutateAsync.mockRejectedValue(new Error('transaction failed'));render(<MyCountryScreen/>);
 fireEvent.click(screen.getByLabelText('통화 선택'));fireEvent.click(screen.getByText('영국 GBP · £'));
 fireEvent.click(screen.getByLabelText('지역 설정 저장'));fireEvent.click(screen.getByRole('button', { name: '저장' }));
 await waitFor(()=>expect(screen.getByText('transaction failed')).toBeTruthy());expect(screen.queryByText(/저장했어요/)).toBeNull();expect(mutateAsync).toHaveBeenCalledTimes(1);
});

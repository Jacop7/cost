import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { useSaveMenuTaxOverride, useSaveTaxConfiguration } from '@/features/international-tax/hooks';
import { qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/SessionProvider',()=>({useStoreId:()=> 'store-1'}));

let qc:QueryClient;
let rpc:ReturnType<typeof vi.spyOn>;
const wrapper=({children}:{children:ReactNode})=>
  createElement(QueryClientProvider,{client:qc},children);

beforeEach(()=>{
  qc=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
  rpc=vi.spyOn(supabase,'rpc' as never);
});
describe('메뉴 과세 저장 캐시 경계',()=>{
  it('MY 원자 저장은 두 판본을 한 RPC로 보내고 모든 메뉴·수정 내역·매출 캐시를 무효화한다',async()=>{
    const id='11111111-1111-4111-8111-111111111111';
    rpc.mockResolvedValue({data:{changed:true,profile_id:id,revision:2,effective_from:'2026-09-13',application_mode:'next_business'},error:null} as never);
    const keys=[qk.recipe('r1'),qk.recipe('r2'),qk.recipeTax('r1'),qk.recipeTax('r2'),
      qk.changeHistory('recipe','r1'),qk.changeHistory('recipe','r2'),qk.salesDay('2026-09-12'),[...qk.configurationHistory,'store-1','tax']];
    keys.forEach(key=>qc.setQueryData(key,{old:true})); qc.setQueryData(qk.ingredient('unrelated'),{old:true});
    const {result}=renderHook(()=>useSaveTaxConfiguration(),{wrapper});
    await act(async()=>{await result.current.mutateAsync({
      market:{countryCode:'KR',regionCode:null,currencyCode:'KRW',businessLocaleCode:'ko-KR',priceBasis:'tax_exclusive',baseProfileId:id,baseRevision:3},
      tax:{defaultTreatment:'taxable',components:[],categories:[],baseProfileId:id,baseRevision:7},
    });});
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('save_tax_configuration',expect.objectContaining({p_market_id:id,p_market_revision:3,p_tax_id:id,p_tax_revision:7,
      p_market:expect.objectContaining({price_basis:'tax_exclusive'})}));
    keys.forEach(key=>expect(qc.getQueryState(key)?.isInvalidated).toBe(true));
    expect(qc.getQueryState(qk.ingredient('unrelated'))?.isInvalidated).toBe(false);
  });
  it('현재 과세 카드뿐 아니라 레시피 손익과 매출 손익도 다시 읽는다',async()=>{
    rpc.mockResolvedValue({data:{changed:true,revision:2,tax_category:null,treatment:'exempt'},error:null} as never);
    const invalidate=vi.spyOn(qc,'invalidateQueries');
    const {result}=renderHook(()=>useSaveMenuTaxOverride('recipe-1'),{wrapper});
    await act(async()=>{
      await result.current.mutateAsync({
        taxProfileId:'11111111-1111-1111-1111-111111111111',
        taxCategory:null,treatment:'exempt',baseRevision:1,
      });
    });
    const keys=invalidate.mock.calls.map(([arg])=>(arg as {queryKey?:readonly unknown[]}).queryKey);
    expect(keys).toContainEqual(qk.internationalTax);
    expect(keys).toContainEqual(['changes', 'recipe']);
    expect(keys).toContainEqual(qk.recipes);
    expect(keys).toContainEqual(qk.sales);
  });
});

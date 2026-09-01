import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { useSaveMenuTaxOverride } from '@/features/international-tax/hooks';
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
    expect(keys).toContainEqual(qk.recipeTax('recipe-1'));
    expect(keys).toContainEqual(qk.internationalTax);
    expect(keys).toContainEqual(qk.recipes);
    expect(keys).toContainEqual(qk.sales);
  });
});

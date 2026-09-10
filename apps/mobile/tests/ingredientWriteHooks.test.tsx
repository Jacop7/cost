import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useStockChange, useSaveIngredient, useSavePurchaseOption } from '@/features/ingredients/hooks';
import { qk } from '@/lib/queryClient';
const rpc=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/supabase',()=>({supabase:{rpc}}));
vi.mock('@/lib/SessionProvider',()=>({useStoreId:()=> 'store-a'}));
beforeEach(()=>rpc.mockReset().mockResolvedValue({data:{discarded:100},error:null}));
function fixture(retry: false | number = false) {
  const qc=new QueryClient({defaultOptions:{mutations:{retry,retryDelay:0}}});
  const wrapper=({children}:{children:ReactNode})=><QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return {qc,wrapper};
}
it('수량·확인 재고·사유·요청키는 새 RPC로 전달하고 성공 뒤만 공유 캐시를 갱신한다',async()=>{
  const {qc,wrapper}=fixture();
  const hook=renderHook(()=>useStockChange(),{wrapper});
  const key=qk.ingredient('i'); qc.setQueryData(key,{});
  const input={ingredientId:'i',kind:'waste' as const,value:900,quantity:100,expectedStock:1000,reason:'유통기한',idempotencyKey:'key'};
  await act(async()=>{await hook.result.current.mutateAsync(input);});
  expect(rpc).toHaveBeenCalledWith('change_stock_quantity',{p_ingredient:'i',p_kind:'discard',p_quantity:100,p_expected_stock:1000,p_note:'유통기한',p_idempotency_key:'key'});
  expect(qc.getQueryState(key)?.isInvalidated).toBe(true);
  qc.setQueryData(key,{}); rpc.mockResolvedValue({error:{code:'45009',details:'REVISION_CONFLICT',message:'stale'}});
  await act(async()=>{await expect(hook.result.current.mutateAsync(input)).rejects.toMatchObject({code:'45009',details:'REVISION_CONFLICT'});});
  expect(qc.getQueryState(key)?.isInvalidated).toBe(false); qc.clear();
});
it.each(['full','stock'] as const)('%s 저장은 code/details를 보존하고 전역 retry2에서도1회만 요청한다',async kind=>{
  const {qc,wrapper}=fixture(2);
  const full=renderHook(()=>useSaveIngredient(),{wrapper});
  const stock=renderHook(()=>useStockChange(),{wrapper});
  rpc.mockResolvedValue({data:null,error:{code:'45009',details:'REVISION_CONFLICT',message:'stale'}});
  await act(async()=>{
    const request=kind==='full'
      ?full.result.current.mutateAsync({id:'i',name:'대파',baseUnit:'g',perVolume:1000,categoryId:null,safetyStock:0,minOrderQty:1,defaultVendorId:null,memo:null,expected:{name:'원래'}})
      :stock.result.current.mutateAsync({ingredientId:'i',kind:'adj',value:900,quantity:100,expectedStock:1000,reason:'차감',idempotencyKey:'key'});
    await expect(request).rejects.toMatchObject({code:'45009',details:'REVISION_CONFLICT'});
  });
  expect(rpc).toHaveBeenCalledTimes(1);qc.clear();
});
it.each([
  {code:'40001',details:undefined},{code:'40001',details:'REVISION_CONFLICT'},
  {code:'45009',details:'OPTION_EDIT_CONFLICT'},{code:'PT409',details:'REVISION_CONFLICT'},
])('재고 일반 오류 $code/$details 문구·메타데이터를 충돌로 바꾸지 않는다',async error=>{
  const {qc,wrapper}=fixture(2);const stock=renderHook(()=>useStockChange(),{wrapper});
  rpc.mockResolvedValue({data:null,error:{...error,message:'원래 오류'}});
  await act(async()=>{await expect(stock.result.current.mutateAsync({ingredientId:'i',kind:'adj',value:900,quantity:100,expectedStock:1000,reason:'차감',idempotencyKey:'key'}))
    .rejects.toMatchObject({...error,message:'원래 오류'});});
  expect(rpc).toHaveBeenCalledTimes(1);qc.clear();
});
it('참고 구매 가격과 구매 옵션 기준단위가 실제 저장 RPC payload에 포함된다',async()=>{
  const {qc,wrapper}=fixture();
  const ingredient=renderHook(()=>useSaveIngredient(),{wrapper});
  const option=renderHook(()=>useSavePurchaseOption(),{wrapper});
  await act(async()=>{await ingredient.result.current.mutateAsync({name:'대파',baseUnit:'g',perVolume:1000,purchasePrice:4000,categoryId:null,safetyStock:0,minOrderQty:1,defaultVendorId:null,memo:null});});
  expect(rpc.mock.lastCall?.[1].p_payload).toEqual(expect.objectContaining({purchase_price:4000}));
  expect(rpc.mock.lastCall?.[1].p_payload).not.toHaveProperty('base_price');
  await act(async()=>{await option.result.current.mutateAsync({ingredientId:'i',name:'링크',baseUnit:'g',volume:1000,amount:4000,vendorId:null,url:'https://example.com'});});
  expect(rpc.mock.lastCall?.[1].p_payload).toEqual(expect.objectContaining({base_unit:'g',volume:1000})); qc.clear();
});
